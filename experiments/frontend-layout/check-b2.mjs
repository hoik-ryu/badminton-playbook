// B2 브라우저 확인(dev 서버 5173, Mock): 명단·필터·편집(시트/옆 패널)·게스트 삭제 분기·사람 추가·점수 입력·역할 관리 + 로그인 브랜드(B안).
// 사용: node experiments/frontend-layout/check-b2.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(here, 'results/b2'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ path: location.pathname, st: [...document.querySelectorAll('[data-scr]')].map((e) => `${e.dataset.scr}:${e.dataset.st}`).join(' '), hScroll: document.documentElement.scrollWidth > innerWidth })
const vis = (page, sel, opts) => page.locator(sel, opts).filter({ visible: true }).first()
const row = (page, name) => vis(page, `button[aria-label^="${name},"]`)

// 운영 셸은 PC에서도 모바일 배치(사용자 결정 2026-11-12): 운영 화면 동작은 모든 뷰포트에서 모바일 경로
const OPS_MOBILE = true
const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }
  await page.goto(BASE + '/login'); await page.evaluate(() => { localStorage.removeItem('smapsh.mock.db.v1'); localStorage.setItem('smapsh.introSeen.v1', '1') })
  // 0) 로그인 브랜드(B안 심볼 + HTML 'SMAPSH')
  await page.goto(BASE + '/login?as=guest'); await page.waitForTimeout(500)
  await step('0-login', { brand: await page.evaluate(() => { const i = document.querySelector('.login__symbol'), h = document.querySelector('h1'); const b = i.getBoundingClientRect(); return { symbol: i.getAttribute('src'), size: `${Math.round(b.width)}x${Math.round(b.height)}`, h1: h.textContent.trim(), color: getComputedStyle(h).color, weight: getComputedStyle(h).fontWeight } }), favicon: await page.evaluate(() => document.querySelector('link[rel=icon]').href) })
  await shot(page, `${vp.n}-0-login.jpg`)
  // 1) 명단
  await page.goto(BASE + '/ops/roster?as=admin'); await page.waitForSelector('[data-scr=SCR-211][data-st=SCR-211-ST1]')
  await step('1-roster', { members: await page.locator('ul[aria-label=회원] li').count(), guests: await page.locator('ul[aria-label=게스트] li').count(), chips: await page.locator('[data-cmp=CMP-004]').allTextContents(), fab: await page.locator('[data-testid=fab]').filter({ visible: true }).count(), rowH: await row(page, '김가람').evaluate((e) => e.getBoundingClientRect().height) })
  await shot(page, `${vp.n}-1-roster.jpg`)
  await vis(page, '[data-cmp=CMP-004]', { hasText: '점수 미설정' }).click(); await page.waitForTimeout(200)
  await step('2-chip-unset', { rows: await page.locator('[data-cmp=CMP-024]').filter({ visible: true }).count() }); await shot(page, `${vp.n}-2-chip.jpg`)
  await vis(page, '[data-cmp=CMP-004]', { hasText: '점수 미설정' }).click()
  // 2) 회원 편집: 점수 → 저장
  await row(page, '서이든').click(); await page.waitForSelector('[data-cmp=CMP-021]'); await page.waitForTimeout(500)
  const panel = await vis(page, '[data-cmp=CMP-021]').evaluate((e) => ({ presentation: e.dataset.presentation, w: Math.round(e.getBoundingClientRect().width) }))
  await step('3-edit-member', { panel, status: await vis(page, '[data-cmp=CMP-045]').textContent().catch(() => null) }); await shot(page, `${vp.n}-3-edit-member.jpg`)
  await vis(page, '[data-cmp=CMP-021] [role=radio]', { hasText: /^4$/ }).click()
  if (!OPS_MOBILE) { // PC: 바뀐 값 있는 채로 다른 행 → 확인 창
    await row(page, '김가람').click(); await page.waitForTimeout(300)
    r.steps['4-pc-switch-dirty'] = { dialog: await page.locator('[role=alertdialog]').textContent().catch(() => null) }; await shot(page, `${vp.n}-4-switch-confirm.jpg`)
    await page.locator('[role=alertdialog] button', { hasText: '계속 편집' }).click(); await page.waitForTimeout(200)
  }
  await vis(page, '[data-cmp=CMP-021] button', { hasText: '저장' }).click(); await page.waitForTimeout(800)
  await step('5-saved', { toast: await page.locator('[data-cmp=CMP-029]').textContent().catch(() => null), sheetOpen: await page.locator('[data-cmp=CMP-021]').count(), score: await page.evaluate(() => JSON.parse(localStorage.getItem('smapsh.mock.db.v1')).users.find((u) => u.name === '서이든').score) })
  if (!OPS_MOBILE) { await page.keyboard.press('Escape').catch(() => {}); await vis(page, '[data-cmp=CMP-021] button[aria-label=닫기]').click(); await page.waitForTimeout(300) }
  // 3) 게스트: 삭제 불가(확정 청백전) / 확정 전 대진 폐기 확인
  await row(page, '하솔').click(); await page.waitForTimeout(500); await step('6-guest-blocked', { disabled: await vis(page, '[data-cmp=CMP-021] button', { hasText: '게스트 삭제' }).isDisabled() }); await shot(page, `${vp.n}-5-guest-blocked.jpg`)
  await vis(page, '[data-cmp=CMP-021] button[aria-label=닫기]').click(); await page.waitForTimeout(300)
  await row(page, '문솔빛').click(); await page.waitForTimeout(500); await vis(page, '[data-cmp=CMP-021] button', { hasText: '게스트 삭제' }).click(); await page.waitForSelector('[role=alertdialog]')
  await shot(page, `${vp.n}-6-guest-delete-confirm.jpg`); await page.locator('[role=alertdialog] button', { hasText: '삭제' }).click(); await page.waitForTimeout(800)
  await step('7-guest-deleted', { toast: await page.locator('[data-cmp=CMP-029]').textContent().catch(() => null), guests: await page.locator('ul[aria-label=게스트] li').count() })
  // 4) 게스트 추가(오류 → 입력 → 추가)
  if (OPS_MOBILE) await page.locator('[data-testid=fab]').click(); else await vis(page, 'header button', { hasText: '게스트 추가' }).click()
  await page.waitForSelector('[data-testid=add-sheet]'); await page.locator('[data-testid=add-sheet] button', { hasText: '추가' }).click(); await page.waitForTimeout(200)
  await step('8-add-errors', { presentation: await page.locator('[data-testid=add-sheet]').getAttribute('data-presentation') }); await shot(page, `${vp.n}-7-add-errors.jpg`)
  await page.fill('[data-testid=add-sheet] input[name=name]', `손님${vp.n}`); await page.locator('[data-testid=add-sheet] [role=radio]', { hasText: '여' }).click(); await page.locator('[data-testid=add-sheet] [role=radio]', { hasText: '입문자' }).click()
  await page.locator('[data-testid=add-sheet] button', { hasText: '추가' }).click(); await page.waitForTimeout(800)
  await step('9-guest-added', { found: await row(page, `손님${vp.n}`).count() })
  // 5) 회원 직접 추가(더보기)
  await vis(page, 'button[aria-label=더보기]').click(); await page.locator('[role=menuitem]', { hasText: '회원 직접 추가' }).click(); await page.waitForSelector('[data-testid=add-sheet]'); await page.waitForTimeout(300)
  await shot(page, `${vp.n}-8-add-member.jpg`); await step('10-add-member-open', { notice: await page.locator('[data-testid=add-sheet] [data-cmp=CMP-023]').textContent() })
  await page.locator('[data-testid=add-sheet] button[aria-label=닫기]').click(); await page.waitForTimeout(300)
  // 6) 역할 관리
  await page.goto(BASE + '/ops/roles?as=superAdmin'); await page.waitForSelector('[data-scr=SCR-232][data-st=SCR-232-ST1]'); await shot(page, `${vp.n}-9-roles.jpg`)
  const li = page.locator('ul[aria-label=회원] li', { hasText: '권초록' }); await li.locator('button', { hasText: '운영진 지정' }).click(); await page.locator('[role=alertdialog] button', { hasText: '지정' }).click(); await page.waitForTimeout(700)
  await step('11-role-appointed', { staff: await page.locator('ul[aria-label="슈퍼 관리자 · 운영진"]').textContent(), width: await page.locator('[data-scr=SCR-232]').evaluate((e) => Math.round(e.getBoundingClientRect().width)) })
  await page.goto(BASE + '/ops/roles?as=admin'); await page.waitForTimeout(500); await step('12-admin-roles-blocked')
  // 7) 점수 입력 시트(개발 도구 진입)
  await page.goto(BASE + '/dev?as=admin'); await page.waitForTimeout(300); await page.goto(BASE + '/dev'); await page.locator('button', { hasText: '점수 입력 시트 열기' }).click(); await page.waitForSelector('[data-testid=score-sheet]'); await page.waitForTimeout(300)
  const title0 = await page.locator('[data-testid=score-sheet] h2').textContent(); await shot(page, `${vp.n}-10-score-sheet.jpg`)
  await page.locator('[data-testid=score-sheet] [role=radiogroup]').first().locator('[role=radio]', { hasText: /^5$/ }).click(); await page.waitForTimeout(600)
  await step('13-score-entry', { before: title0, after: await page.locator('[data-testid=score-sheet] h2').textContent(), done: await page.locator('[data-testid=score-sheet] [data-cmp=CMP-005]').first().textContent() })
  await shot(page, `${vp.n}-11-score-done.jpg`)
  await page.evaluate(() => localStorage.removeItem('smapsh.mock.db.v1'))
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 1))
for (const [vp, r] of Object.entries(report)) { console.log('==', vp, 'errors', r.errors.length, r.errors.slice(0, 3)); for (const [k, v] of Object.entries(r.steps)) console.log(k, JSON.stringify(v).slice(0, 330)) }
