// B5 브라우저 확인(Mock, 390·1440): 회원 청백전 목록(SCR-111) → 상세(SCR-112: 다음 경기·내 경기·승수·전체 대진) → 종료 상세(최종 결과)
// → 미확정 상세(찾을 수 없음) → 마이페이지(SCR-121: 랭크·전적·프로필, 랭크 기준 시트) → 프로필 수정(SCR-122) → 운영진 '관리 화면으로'
// 사용: BASE=http://localhost:5175 node experiments/frontend-layout/check-b5.mjs (Mock 모드 Vite)
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(here, 'results/b5'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ path: location.pathname, st: [...document.querySelectorAll('[data-scr]')].map((e) => `${e.dataset.scr}:${e.dataset.st}`).join(' '), hScroll: document.documentElement.scrollWidth > innerWidth })
const FORBIDDEN = /실력차|성별 규칙 완화|\(\d+\)|점수|7점/

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }
  const text = () => page.locator('[data-scr]').first().textContent()
  await page.goto(BASE + '/login'); await page.evaluate(() => { localStorage.removeItem('smapsh.mock.db.v1'); localStorage.setItem('smapsh.introSeen.v1', '1') })

  // 1. 목록
  await page.goto(BASE + '/club-matches?as=member'); await page.waitForSelector('ul[aria-label=청백전]'); await page.waitForTimeout(300)
  await step('1-list', { items: await page.locator('ul[aria-label=청백전] a').allTextContents(), nav: await page.locator('nav a[aria-current=page]').filter({ visible: true }).first().textContent() }); await shot(page, `${vp.n}-1-list.jpg`)
  // 2. 진행 중 상세
  await page.locator('a[data-match=cm-1]').click(); await page.waitForSelector('[data-scr=SCR-112][data-st=SCR-112-ST1]'); await page.waitForTimeout(300)
  await step('2-detail', { next: await page.locator('section[aria-labelledby=next-title] article').getAttribute('aria-label'), mine: await page.locator('section[aria-labelledby=mine-title] article').count(), forbidden: FORBIDDEN.test(await text()) }); await shot(page, `${vp.n}-2-detail.jpg`)
  await page.locator('summary', { hasText: '전체 대진' }).click(); await page.waitForTimeout(300)
  await step('3-all-games', { cards: await page.locator('details [data-cmp=CMP-041]').count(), forbidden: FORBIDDEN.test(await text()) }); await page.locator('details').scrollIntoViewIfNeeded(); await shot(page, `${vp.n}-3-all-games.jpg`)
  // 3. 종료 상세
  await page.goto(BASE + '/club-matches/cm-3'); await page.waitForSelector('[data-scr=SCR-112][data-st=SCR-112-ST8]'); await page.waitForTimeout(300)
  await step('4-finished', { final: await page.locator('[data-cmp=CMP-042]').first().textContent(), next: await page.locator('#next-title').count() }); await shot(page, `${vp.n}-4-finished.jpg`)
  // 4. 미확정
  await page.goto(BASE + '/club-matches/cm-2'); await page.waitForSelector('[data-scr=SCR-112][data-st=SCR-112-ST5]'); await step('5-draft-hidden'); await shot(page, `${vp.n}-5-not-found.jpg`)
  // 5. 마이페이지
  await page.goto(BASE + '/me'); await page.waitForSelector('[data-scr=SCR-121][data-st=SCR-121-ST1]'); await page.waitForTimeout(300)
  await step('6-mypage', { text: (await text()).replace(/\s+/g, ' ').slice(0, 160), forbidden: /점수|7점/.test(await text()) }); await shot(page, `${vp.n}-6-mypage.jpg`)
  await page.locator('button[aria-label="랭크 기준 보기"]').click(); await page.waitForSelector('[data-testid=rank-help-sheet]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-7-rank-help.jpg`)
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  // 6. 프로필 수정
  await page.locator('button', { hasText: '프로필 수정' }).click(); await page.waitForSelector('[data-testid=profile-sheet]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-8-profile.jpg`)
  await page.locator('[data-testid=profile-sheet] [role=radio]', { hasText: 'B조' }).click(); await page.locator('[data-testid=profile-sheet] button', { hasText: /^저장$/ }).click()
  await page.waitForSelector('[data-testid=profile-sheet]', { state: 'detached', timeout: 4000 }); await page.waitForTimeout(300)
  await step('9-saved', { profile: await page.locator('section[aria-labelledby=profile-title] p').textContent(), focus: await page.evaluate(() => document.activeElement?.textContent) }); await shot(page, `${vp.n}-9-saved.jpg`)
  // 7. 운영진: 회원 화면 → 관리 화면으로
  await page.goto(BASE + '/club-matches/cm-1?as=admin'); await page.waitForSelector('[data-scr=SCR-112]'); await page.waitForTimeout(300)
  await page.locator('a', { hasText: '관리 화면으로' }).click(); await page.waitForSelector('[data-scr=SCR-223]'); await step('10-admin-to-ops')
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
