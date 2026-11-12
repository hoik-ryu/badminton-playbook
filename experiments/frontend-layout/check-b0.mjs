// B0 브라우저 확인(dev 서버 5173): 인트로 최초 1회·재방문 생략·개발용 재생·reduced-motion, 로그인 로고, 역할별 셸·가드·탭, 404·권한 없음.
// 사용: node experiments/frontend-layout/check-b0.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = 'http://localhost:5173'
const OUT = path.join(here, 'results/b0'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const layout = () => {
  const q = (s) => document.querySelector(s), R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), visible: getComputedStyle(el).display !== 'none' && b.width > 0 } }
  const navs = [...document.querySelectorAll('nav[data-cmp=CMP-025]')].map((n) => ({ layout: n.dataset.layout, ...R(n), tabs: [...n.querySelectorAll('a')].map((a) => a.textContent.trim()), current: n.querySelector('[aria-current=page]')?.textContent.trim() }))
  return { path: location.pathname + location.search, shell: q('[data-shell]')?.dataset.shell, column: R(q('.app-column')), navs, h1: q('h1')?.textContent || q('h1 img')?.alt, pending: q('[data-pending]')?.dataset.pending ?? null, scr: q('[data-scr]')?.dataset.scr ?? null, hScroll: document.documentElement.scrollWidth > innerWidth, intro: !!q('[data-intro]') }
}
const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const r = (report[vp.n] = { steps: {} })
  // 1) 최초 방문 '/': 인트로 재생 → 로그인
  await page.goto(BASE + '/'); const introShown = await page.waitForSelector('[data-intro]', { timeout: 8000 }).then(() => true, () => false)
  await page.waitForTimeout(3400); await shot(page, `${vp.n}-1-intro-logo.jpg`)
  await page.waitForSelector('[data-intro]', { state: 'detached', timeout: 8000 }); await page.waitForTimeout(200)
  r.steps.firstVisit = { introShown, ...(await page.evaluate(layout)), seenKey: await page.evaluate(() => localStorage.getItem('smapsh.introSeen.v1')), logo: await page.evaluate(() => { const i = document.querySelector('.login__logo'); const b = i.getBoundingClientRect(); return { natural: `${i.naturalWidth}x${i.naturalHeight}`, shown: `${Math.round(b.width)}x${b.height.toFixed(1)}` } }) }
  await shot(page, `${vp.n}-2-login.jpg`)
  // 2) 새로고침·재방문: 인트로 없음
  await page.goto(BASE + '/'); await page.waitForTimeout(1500); r.steps.revisit = await page.evaluate(layout)
  // 3) 개발용 재생
  await page.goto(BASE + '/?intro=replay'); r.steps.devReplay = { introShown: await page.waitForSelector('[data-intro]', { timeout: 5000 }).then(() => true, () => false) }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); r.steps.devReplay.afterEsc = await page.evaluate(layout)
  // 4) 직접 진입 링크(신규 컨텍스트, 기록 없음) → 인트로 없음
  const ctx2 = await browser.newContext({ viewport: { width: vp.w, height: vp.h } }); const p2 = await ctx2.newPage(); await p2.goto(BASE + '/club-matches/12'); await p2.waitForTimeout(1500); r.steps.deepLinkFresh = await p2.evaluate(layout); await ctx2.close()
  // 5) reduced-motion(신규 컨텍스트) → 인트로 없음
  const ctx3 = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: 'reduce' }); const p3 = await ctx3.newPage(); await p3.goto(BASE + '/'); await p3.waitForTimeout(1500); r.steps.reducedFresh = await p3.evaluate(layout); await ctx3.close()
  // 6) 역할별 셸
  for (const [key, url] of [['member', '/?as=member'], ['admin-ops', '/ops?as=admin'], ['admin-roles', '/ops/roles?as=admin'], ['super-roles', '/ops/roles?as=superAdmin'], ['pending', '/tutorial?as=pending'], ['notfound', '/nope'], ['dev', '/dev']]) {
    await page.goto(BASE + url); await page.waitForTimeout(700); r.steps[key] = await page.evaluate(layout); await shot(page, `${vp.n}-3-${key}.jpg`)
  }
  r.errors = errors; await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 1))
for (const [vp, r] of Object.entries(report)) { console.log('==', vp, 'errors', r.errors.length, r.errors.slice(0, 3)); for (const [k, v] of Object.entries(r.steps)) console.log(k, JSON.stringify(v).slice(0, 420)) }
