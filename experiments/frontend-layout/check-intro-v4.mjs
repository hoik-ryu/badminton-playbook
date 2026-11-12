// 인트로(v4 보드 컷 + v4 로고) 프레임 확인: 모바일 390·PC 1440에서 장면별 시점에 애니메이션을 멈추고 캡처, 끝까지 재생 후 로그인 화면 전환 확인
// 사용: BASE=http://localhost:5175 node experiments/frontend-layout/check-intro-v4.mjs (개발 빌드)
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(here, 'results/intro-v4'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const MOMENTS = [[700, '1-shuttle'], [1950, '2-smash'], [3200, '3-split'], [4400, '4-celebrate'], [6000, '5-logo'], [7350, '6-afterimage']]

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { errors })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
  await page.goto(BASE + '/login'); await page.evaluate(() => { localStorage.removeItem('smapsh.introSeen.v1'); localStorage.removeItem('smapsh.mock.db.v1') })
  await page.goto(BASE + '/'); await page.waitForSelector('[data-intro]')
  // 이미지 디코딩 후 애니메이션이 붙을 때까지
  await page.waitForFunction(() => document.querySelector('[data-intro]')?.getAnimations({ subtree: true }).length > 20, null, { timeout: 5000 })
  await page.evaluate(() => document.querySelector('[data-intro]').getAnimations({ subtree: true }).forEach((a) => a.pause()))
  for (const [ms, name] of MOMENTS) {
    await page.evaluate((t) => document.querySelector('[data-intro]').getAnimations({ subtree: true }).forEach((a) => (a.currentTime = t)), ms)
    await page.waitForTimeout(150)
    await shot(page, `${vp.n}-${name}.jpg`)
  }
  r.images = await page.evaluate(() => [...document.querySelectorAll('[data-intro] img')].map((i) => `${i.getAttribute('src')?.split('/').pop()?.split('?')[0]} ${i.naturalWidth}x${i.naturalHeight}`))
  // 끝까지 재생 → 로그인 화면
  await page.evaluate(() => document.querySelector('[data-intro]').getAnimations({ subtree: true }).forEach((a) => a.play()))
  await page.waitForSelector('[data-intro]', { state: 'detached', timeout: 15000 })
  r.after = { path: new URL(page.url()).pathname, seen: await page.evaluate(() => localStorage.getItem('smapsh.introSeen.v1')) }
  await page.reload(); await page.waitForTimeout(800); r.secondVisitIntro = await page.locator('[data-intro]').count()
  await ctx.close()
}
await browser.close()
console.log(JSON.stringify(report, null, 1))
