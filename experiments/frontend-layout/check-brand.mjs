// 실제 frontend dev 서버(5173)의 브랜드 로고·개발용 인트로 확인(실험 보조 스크립트).
// 사용: node experiments/frontend-layout/check-brand.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = 'http://localhost:5173'
const OUT = path.join(here, 'results/brand'); fs.mkdirSync(OUT, { recursive: true })
const VPS = [{ n: 'mobile-360', w: 360, h: 800, m: true }, { n: 'mobile-390', w: 390, h: 844, m: true }, { n: 'mobile-430', w: 430, h: 932, m: true }, { n: 'pc-1280', w: 1280, h: 800 }, { n: 'pc-1440', w: 1440, h: 900 }]
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const browser = await chromium.launch(); const results = []
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  const t0 = Date.now(); await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dev-intro]', { timeout: 8000 })
  const introBox = await page.evaluate(() => { const b = document.querySelector('[data-dev-intro]').getBoundingClientRect(), c = document.querySelector('.app-column').getBoundingClientRect(); return { x: b.x, w: b.width, h: b.height, colX: c.x, colW: c.width } })
  await page.waitForTimeout(3550); await shot(page, `${vp.n}-intro-logo.jpg`)
  await page.waitForSelector('[data-dev-intro]', { state: 'detached', timeout: 6000 }); const introMs = Date.now() - t0
  await page.waitForTimeout(150); await shot(page, `${vp.n}-login.jpg`)
  const m = await page.evaluate(() => {
    const img = document.querySelector('.login__logo'), b = img.getBoundingClientRect(), col = document.querySelector('.app-column').getBoundingClientRect(), k = document.querySelector('.login__kakao').getBoundingClientRect()
    return { path: location.pathname, heading: document.querySelector('h1')?.textContent || document.querySelector('h1 img')?.alt, alt: img.alt, natural: `${img.naturalWidth}x${img.naturalHeight}`, shown: `${b.width.toFixed(0)}x${b.height.toFixed(1)}`, density: +(img.naturalWidth / b.width).toFixed(2), ratioOk: Math.abs(img.naturalWidth / img.naturalHeight - b.width / b.height) < 0.02, centered: Math.abs((b.left + b.right) / 2 - (col.left + col.right) / 2) < 1, col: { x: col.x, w: col.width }, kakao: { y: k.y, h: k.height, inCol: k.left >= col.left && k.right <= col.right }, hScroll: document.documentElement.scrollWidth > innerWidth }
  })
  results.push({ ...vp, introBox, introMs, ...m, errors }); await ctx.close()
}
// 건너뛰기·Esc·reduced-motion 회귀
const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await c2.newPage(); await p2.goto(BASE + '/'); await p2.waitForSelector('[data-dev-intro] .skip'); await p2.waitForTimeout(800); const t1 = Date.now(); await p2.click('[data-dev-intro] .skip'); await p2.waitForSelector('[data-dev-intro]', { state: 'detached', timeout: 2000 }); const skipMs = Date.now() - t1
await p2.goto(BASE + '/login'); await p2.waitForSelector('[data-dev-intro]'); await p2.waitForTimeout(500); await p2.keyboard.press('Escape'); await p2.waitForSelector('[data-dev-intro]', { state: 'detached', timeout: 2000 }).then(() => 'ok'); await c2.close()
const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const p3 = await c3.newPage(); await p3.goto(BASE + '/'); await p3.waitForTimeout(1200); const reducedShown = await p3.$('[data-dev-intro]'); await c3.close()
const c4 = await browser.newContext(); const p4 = await c4.newPage(); await p4.goto(BASE + '/dev/health'); await p4.waitForTimeout(1200); const devHealthIntro = await p4.$('[data-dev-intro]'); await c4.close()
// 파비콘 식별성: 16·32·48을 8배 확대로 나란히
const c5 = await browser.newContext({ viewport: { width: 980, height: 420 } }); const p5 = await c5.newPage()
await p5.setContent(`<body style="margin:0;padding:16px;background:#fff;display:flex;gap:16px;align-items:flex-end;font:12px system-ui">${[16, 32, 48].map((s) => `<figure style="margin:0;text-align:center"><img src="${BASE}/favicon.ico" hidden><img src="data:image/png;base64,${fs.readFileSync(path.resolve(here, `../brand-assets/out/smapsh-icon-dark-${s}.png`)).toString('base64')}" style="width:${s * 6}px;image-rendering:pixelated"><figcaption>${s}px ×6</figcaption></figure>`).join('')}<figure style="margin:0"><div style="display:flex;gap:8px;align-items:center;background:#dee1e6;padding:8px 12px;border-radius:8px 8px 0 0"><img src="${BASE}/favicon.ico" width="16" height="16"><span>SMAPSH</span></div><figcaption>탭 실제 크기</figcaption></figure></body>`)
await p5.waitForTimeout(300); await shot(p5, 'favicon-legibility.jpg'); await c5.close()
await browser.close()
const summary = { viewports: results, skipMs, escape: 'ok', reducedMotionIntroShown: !!reducedShown, devHealthIntroShown: !!devHealthIntro }
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(summary, null, 1))
for (const r of results) console.log(r.n, 'intro', JSON.stringify(r.introBox), `${r.introMs}ms`, '→', r.path, 'alt', r.alt, r.natural, '→', r.shown, 'density', r.density, 'ratioOk', r.ratioOk, 'centered', r.centered, 'kakao', JSON.stringify(r.kakao), 'hScroll', r.hScroll, 'errors', r.errors.length)
console.log('skipMs', skipMs, 'reducedShown', !!reducedShown, 'devHealthIntro', !!devHealthIntro)
