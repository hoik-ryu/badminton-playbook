// 인트로 PoC 브라우저 검증. 사용: node experiments/cinematic-intro/verify.mjs (서버 55190이 떠 있어야 함)
// Playwright·Chromium은 experiments/c-preview-poc/에 설치된 것을 읽기만 합니다.
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = 'http://localhost:55190/'
const OUT = path.join(here, 'results'); const SHOTS = path.join(OUT, 'frames'); fs.mkdirSync(SHOTS, { recursive: true })
const VIEWPORTS = [{ name: 'mobile-360', w: 360, h: 800, mobile: true }, { name: 'mobile-390', w: 390, h: 844, mobile: true }, { name: 'mobile-430', w: 430, h: 932, mobile: true }, { name: 'pc-1280', w: 1280, h: 800 }, { name: 'pc-1440', w: 1440, h: 900 }]
const FRAMES = [350, 1000, 1200, 1850, 2650, 3080, 3200, 3350, 3550, 3900] // 컷마다 대표 시점(ms)

async function shot(page, file) {
  const s = await page.context().newCDPSession(page)
  const r = await Promise.race([s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }), new Promise((_, j) => setTimeout(() => j(new Error('screenshot timeout')), 15000))])
  fs.writeFileSync(file, Buffer.from(r.data, 'base64')); await s.detach()
}
async function open(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, locale: 'ko-KR', reducedMotion: opts.reduced ? 'reduce' : 'no-preference', ...(opts.video ? { recordVideo: { dir: opts.video, size: { width: vp.w, height: vp.h } } } : {}) })
  const page = await ctx.newPage(); const errors = []; const failed = []
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errors.push(m.text().slice(0, 160)))
  page.on('pageerror', (e) => errors.push('pageerror ' + String(e).slice(0, 160)))
  page.on('requestfailed', (r) => failed.push(r.url())); page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`))
  await page.goto(BASE + (opts.query || ''), { waitUntil: 'domcontentloaded' })
  return { ctx, page, errors, failed }
}
const geom = () => { const c = document.querySelector('#column').getBoundingClientRect(), i = document.querySelector('#intro').getBoundingClientRect(), s = document.querySelector('#skip').getBoundingClientRect(); return { column: { x: c.x, w: c.width, h: c.height }, intro: { x: i.x, w: i.width, h: i.height }, skip: { w: s.width, h: s.height, right: innerWidth - s.right, top: s.top, insideColumn: s.left >= c.left && s.right <= c.right }, hScroll: document.documentElement.scrollWidth > innerWidth, vScroll: document.documentElement.scrollHeight > innerHeight + 1, outerBg: getComputedStyle(document.documentElement).backgroundColor } }
const imgState = () => [...document.querySelectorAll('#intro img')].map((im) => ({ src: im.getAttribute('src'), ok: im.complete && im.naturalWidth > 0, natural: `${im.naturalWidth}x${im.naturalHeight}`, shown: `${Math.round(im.getBoundingClientRect().width)}x${Math.round(im.getBoundingClientRect().height)}` }))

const browser = await chromium.launch()
const results = { generatedAt: new Date().toISOString(), browser: browser.version(), viewports: [], cases: {} }
for (const vp of VIEWPORTS) {
  // 1) 실제 시간 재생: 단계 시점·끝·콘솔 오류
  const { ctx, page, errors, failed } = await open(browser, vp)
  await page.waitForFunction(() => document.documentElement.dataset.introResult, null, { timeout: 12000 })
  const log = await page.evaluate(() => window.__intro.log)
  const live = { result: await page.evaluate(() => document.documentElement.dataset.introResult), log, focusAfter: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName), loginVisible: await page.evaluate(() => !document.querySelector('#intro').offsetParent && !document.querySelector('#login').inert) }
  // 2) 시점 고정 프레임 + 배치 측정
  await page.evaluate(() => window.__intro.play()); await page.waitForFunction(() => window.__intro.log.some((e) => e.event === 'loaded'))
  const g = await page.evaluate(geom); const imgs = await page.evaluate(imgState)
  for (const ms of FRAMES) { await page.evaluate((t) => window.__intro.seek(t), ms); await page.waitForTimeout(60); await shot(page, path.join(SHOTS, `${vp.name}-${String(ms).padStart(4, '0')}.jpg`)) }
  await page.evaluate(() => window.__intro.skip()); await page.waitForTimeout(80); await shot(page, path.join(SHOTS, `${vp.name}-login.jpg`))
  const gLogin = await page.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > innerWidth, kakao: (() => { const b = document.querySelector('.login__kakao').getBoundingClientRect(); return { y: b.y, h: b.height, bottomThird: b.y > innerHeight * 2 / 3 } })() }))
  results.viewports.push({ ...vp, live, geometry: g, images: imgs, loginGeometry: gLogin, errors, failed })
  await ctx.close()
}
// 3) 건너뛰기(1.0초 시점 클릭)
{ const { ctx, page, errors } = await open(browser, VIEWPORTS[1]); await page.waitForFunction(() => window.__intro.log.some((e) => e.event === 'loaded')); await page.waitForTimeout(1000); await page.click('#skip'); await page.waitForTimeout(100)
  results.cases.skip = { result: await page.evaluate(() => document.documentElement.dataset.introResult), log: await page.evaluate(() => window.__intro.log.filter((e) => e.event !== 'phase')), introHidden: await page.evaluate(() => document.querySelector('#intro').hidden), errors }; await ctx.close() }
// 4) Esc 키 건너뛰기
{ const { ctx, page } = await open(browser, VIEWPORTS[3]); await page.waitForFunction(() => window.__intro.log.some((e) => e.event === 'loaded')); await page.waitForTimeout(500); await page.keyboard.press('Escape'); await page.waitForTimeout(100)
  results.cases.escape = await page.evaluate(() => document.documentElement.dataset.introResult); await ctx.close() }
// 5) 움직임 줄이기
{ const { ctx, page, errors } = await open(browser, VIEWPORTS[1], { reduced: true }); await page.waitForTimeout(400)
  results.cases.reducedMotion = { result: await page.evaluate(() => document.documentElement.dataset.introResult), introHidden: await page.evaluate(() => document.querySelector('#intro').hidden), errors }; await shot(page, path.join(SHOTS, 'reduced-390.jpg')); await ctx.close() }
// 6) 이미지 로딩 실패
{ const { ctx, page, errors } = await open(browser, VIEWPORTS[1], { query: '?fail=1' }); await page.waitForFunction(() => document.documentElement.dataset.introResult, null, { timeout: 8000 })
  results.cases.loadFailure = { result: await page.evaluate(() => document.documentElement.dataset.introResult), log: await page.evaluate(() => window.__intro.log), consoleExpected404: errors.length }; await ctx.close() }
// 7) 최초 방문 정책(같은 브라우저 컨텍스트에서 새로고침)
{ const { ctx, page } = await open(browser, VIEWPORTS[1], { query: '?policy=first-visit' }); await page.waitForFunction(() => document.documentElement.dataset.introResult, null, { timeout: 12000 })
  const first = await page.evaluate(() => document.documentElement.dataset.introResult); await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.introResult, null, { timeout: 8000 })
  results.cases.firstVisitPolicy = { first, afterReload: await page.evaluate(() => document.documentElement.dataset.introResult), stored: await page.evaluate(() => localStorage.getItem('smapsh.introSeen.v1')) }; await ctx.close() }
// 8) 짧은 녹화(모바일 390, 실제 시간)
try { const dir = path.join(OUT, 'video'); fs.rmSync(dir, { recursive: true, force: true }); const { ctx, page } = await open(browser, VIEWPORTS[1], { video: dir }); await page.waitForFunction(() => document.documentElement.dataset.introResult, null, { timeout: 12000 }); await page.waitForTimeout(600); const v = page.video(); await ctx.close(); const f = await v.path(); fs.renameSync(f, path.join(dir, 'intro-mobile-390.webm')); results.cases.video = 'results/video/intro-mobile-390.webm' } catch (e) { results.cases.video = 'failed: ' + String(e).slice(0, 120) }
await browser.close()
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1))
for (const v of results.viewports) console.log(v.name, v.live.result, JSON.stringify(v.live.log.map((e) => `${e.event}${e.phase ? ':' + e.phase : ''}@${e.t}`)), 'col', JSON.stringify(v.geometry.column), 'skip', JSON.stringify(v.geometry.skip), 'hScroll', v.geometry.hScroll || v.loginGeometry.hScroll, 'imgsOk', v.images.every((i) => i.ok), 'kakao', JSON.stringify(v.loginGeometry.kakao), 'focus', v.live.focusAfter, 'loginVisible', v.live.loginVisible, 'errors', v.errors.length, 'failed', v.failed.length)
console.log('cases', JSON.stringify(results.cases))
setTimeout(() => process.exit(0), 200)
