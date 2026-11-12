// B1 브라우저 확인(dev 서버 5173, Mock 데이터): 인트로·로그인 회귀 → 가입 → 승인 대기 → 운영진 승인·거절·일괄 → 승인된 사용자 진입, 역할별 접근.
// 사용: node experiments/frontend-layout/check-b1.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(here, 'results/b1'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ path: location.pathname + location.search, scr: document.querySelector('[data-scr]')?.dataset.scr ?? null, st: document.querySelector('[data-scr]')?.dataset.st ?? null, hScroll: document.documentElement.scrollWidth > innerWidth, intro: !!document.querySelector('[data-intro]') })
const visible = (page, sel) => page.locator(sel).filter({ visible: true }).first()

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }
  const name = `브라우저${vp.n}`

  // 1) B0 회귀: 최초 방문 인트로 → Esc → 로그인
  await page.goto(BASE + '/'); const intro = await page.waitForSelector('[data-intro]', { timeout: 8000 }).then(() => true, () => false)
  await page.waitForTimeout(600); await page.keyboard.press('Escape'); await page.waitForTimeout(400); await step('1-intro-login', { introShown: intro }); await shot(page, `${vp.n}-1-login.jpg`)
  // 2) Mock 카카오 → 가입(빈 제출 → 오류) → 입력 → 제출
  await page.click('text=카카오로 시작하기'); await page.waitForURL('**/signup'); await step('2-signup')
  await page.click('button[type=submit]'); await page.waitForTimeout(200); await step('3-signup-errors', { focused: await page.evaluate(() => document.activeElement?.getAttribute('name')) }); await shot(page, `${vp.n}-2-signup-errors.jpg`)
  await page.fill('input[name=name]', name); await page.click('[role=radio]:has-text("남")'); await page.click('[role=radio]:has-text("B조")'); await page.fill('input[name=referrer]', '김가람')
  await page.waitForTimeout(400); await shot(page, `${vp.n}-3-signup-filled.jpg`)
  await page.click('button[type=submit]'); await page.waitForURL('**/account-status'); await page.waitForTimeout(200); await step('4-account-pending'); await shot(page, `${vp.n}-4-account-status.jpg`)
  await page.click('text=상태 다시 확인'); await page.waitForTimeout(500); await step('5-recheck-same', { toast: await page.locator('[data-cmp=CMP-029]').textContent().catch(() => null) })
  // 3) 운영진: 운영 홈 → 가입 승인
  await page.goto(BASE + '/ops?as=admin'); await page.waitForTimeout(800); await step('6-ops-home', { menu: await page.locator('ul[aria-label="운영 메뉴"] a').allTextContents(), tabBadge: await visible(page, 'nav[data-cmp=CMP-025] [data-cmp=CMP-005]').textContent().catch(() => null) }); await shot(page, `${vp.n}-5-ops-home.jpg`)
  await page.goto(BASE + '/ops/approvals'); await page.waitForTimeout(800); await step('7-approvals', { rows: await page.locator('[data-applicant]').count(), dupWarn: await page.locator('text=명단에 같은 이름이 있습니다').filter({ visible: true }).count() }); await shot(page, `${vp.n}-6-approvals.jpg`)
  // 새 신청자 승인
  const myRow = page.locator('li[data-applicant]', { hasText: name })
  await myRow.locator('button:has-text("승인")').filter({ visible: true }).click(); await page.waitForTimeout(700)
  await step('8-approved-one', { toast: await page.locator('[data-cmp=CMP-029]').textContent().catch(() => null), rows: await page.locator('[data-applicant]').count() }); await shot(page, `${vp.n}-7-approved-toast.jpg`)
  // 첫 행 거절(확인 창)
  await page.locator('li[data-applicant]').first().locator('button:has-text("거절")').filter({ visible: true }).click(); await page.waitForSelector('[role=alertdialog]'); await shot(page, `${vp.n}-8-reject-dialog.jpg`)
  await page.locator('[role=alertdialog] button:has-text("거절")').click(); await page.waitForTimeout(700); await step('9-rejected', { rows: await page.locator('[data-applicant]').count() })
  // 전체 선택 → 일괄 승인 버튼 위치
  await page.locator('label:has-text("전체 선택")').click(); await page.waitForTimeout(200)
  const bulk = visible(page, 'button:has-text("명 승인")'); const bulkBox = await bulk.boundingBox(); await shot(page, `${vp.n}-9-bulk-selected.jpg`)
  const navBox = await visible(page, 'nav[data-cmp=CMP-025]').boundingBox()
  await bulk.click(); await page.waitForTimeout(800); await step('10-bulk', { bulkBox, navBox, empty: await page.locator('text=승인을 기다리는 신청이 없습니다').count() }); await shot(page, `${vp.n}-10-empty.jpg`)
  // 4) 승인된 새 사용자: 로그아웃 → 같은 기기 카카오로 로그인 → 튜토리얼
  await page.goto(BASE + '/login?as=guest'); await page.waitForTimeout(500); await page.click('text=카카오로 시작하기'); await page.waitForURL('**/tutorial'); await page.waitForTimeout(300); await step('11-approved-user-login'); await shot(page, `${vp.n}-11-tutorial.jpg`)
  // 5) 접근 제어
  await page.goto(BASE + '/ops/approvals?as=member'); await page.waitForTimeout(600); await step('12-member-blocked')
  await page.goto(BASE + '/ops?as=superAdmin'); await page.waitForTimeout(600); await step('13-super-menu', { menu: await page.locator('ul[aria-label="운영 메뉴"] a').allTextContents() })
  await page.goto(BASE + '/?as=rejected'); await page.waitForTimeout(600); await step('14-rejected'); await shot(page, `${vp.n}-12-rejected.jpg`)
  // 6) 카카오 실패 2회 안내
  await page.goto(BASE + '/login?as=guest'); await page.evaluate(() => { const k = 'smapsh.mock.db.v1'; const d = JSON.parse(localStorage.getItem(k)); d.failNextKakao = true; localStorage.setItem(k, JSON.stringify(d)); localStorage.removeItem('smapsh.kakaoFailCount') })
  await page.click('text=카카오로 시작하기'); await page.waitForTimeout(900)
  await page.evaluate(() => { const k = 'smapsh.mock.db.v1'; const d = JSON.parse(localStorage.getItem(k)); d.failNextKakao = true; localStorage.setItem(k, JSON.stringify(d)) })
  await page.click('text=다시 시도'); await page.waitForTimeout(900); await step('15-kakao-fail-2', { alert: await page.locator('[role=alert]').textContent().catch(() => null) }); await shot(page, `${vp.n}-13-kakao-fail.jpg`)
  await page.evaluate(() => localStorage.removeItem('smapsh.mock.db.v1'))
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 1))
for (const [vp, r] of Object.entries(report)) { console.log('==', vp, 'errors', r.errors.length, r.errors.slice(0, 3)); for (const [k, v] of Object.entries(r.steps)) console.log(k, JSON.stringify(v).slice(0, 300)) }
