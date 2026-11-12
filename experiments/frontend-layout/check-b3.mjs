// B3 브라우저 확인(dev 서버 5173, Mock): 오늘 운동 시작 → 참석(점수 입력·게스트 추가 자동 참석) → 대진 생성·교체·확정 → 참석 해제(다음 라운드부터 제외) → 라운드 완료 → 2라운드(대기자 우선) → 세션 종료, 이전 날짜 배너.
// 사용: node experiments/frontend-layout/check-b3.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(here, 'results/b3'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ st: [...document.querySelectorAll('[data-scr]')].map((e) => `${e.dataset.scr}:${e.dataset.st}`).join(' '), hScroll: document.documentElement.scrollWidth > innerWidth })
const db = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('smapsh.mock.db.v1')))
const vis = (page, sel, opts) => page.locator(sel, opts).filter({ visible: true }).first()

// 운영 셸은 PC에서도 모바일 배치(사용자 결정 2026-11-12): 운영 화면 동작은 모든 뷰포트에서 모바일 경로
const OPS_MOBILE = true
const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }
  await page.goto(BASE + '/login'); await page.evaluate(() => { localStorage.removeItem('smapsh.mock.db.v1'); localStorage.setItem('smapsh.introSeen.v1', '1') })
  const panel = OPS_MOBILE ? '[data-testid=attendance-sheet]' : '[data-testid=session-panel]'

  await page.goto(BASE + '/ops/session?as=admin'); await page.waitForSelector('[data-scr=SCR-202]'); await page.waitForTimeout(400); await step('1-no-session'); await shot(page, `${vp.n}-1-no-session.jpg`)
  await page.locator('button', { hasText: '오늘 운동 시작' }).click(); await page.waitForSelector(panel); await page.waitForTimeout(400)
  await step('2-started-panel-open', { panel: await page.locator(panel).count() }); await shot(page, `${vp.n}-2-attendance.jpg`)
  // 회원 전원 + 게스트 4명(진바람 제외) 체크
  const names = await page.locator(`${panel} ul[aria-label=회원] input[type=checkbox]`).count()
  for (let i = 0; i < names; i++) { await page.locator(`${panel} ul[aria-label=회원] label`).nth(i).click(); await page.waitForTimeout(120) }
  for (const g of ['남보람', '문솔빛', '하솔', '유하람']) { await page.locator(`${panel} ul[aria-label=게스트] label`, { hasText: g }).click(); await page.waitForTimeout(120) }
  await page.waitForTimeout(500)
  await step('3-checked', { summary: await page.locator(`${panel} [data-cmp=CMP-028]`).textContent() }); await shot(page, `${vp.n}-3-checked.jpg`)
  // 점수 미설정 → 점수 입력 시트(두 번째 시트)
  await page.locator(`${panel} button`, { hasText: '점수 미설정' }).click(); await page.waitForSelector('[data-testid=score-sheet]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-4-scores.jpg`)
  const groups = await page.locator('[data-testid=score-sheet] [role=radiogroup]').count()
  for (let i = 0; i < groups; i++) { await page.locator('[data-testid=score-sheet] [role=radiogroup]').nth(i).locator('[role=radio]', { hasText: /^5$/ }).click(); await page.waitForTimeout(450) }
  await page.waitForSelector('[data-testid=score-sheet]', { state: 'detached', timeout: 4000 }).catch(() => {})
  await step('5-scored', { scoreSheet: await page.locator('[data-testid=score-sheet]').count(), panelStill: await page.locator(panel).count() })
  // 참석 패널에서 게스트 추가 → 자동 참석
  await page.locator(`${panel} button`, { hasText: '+ 게스트 추가' }).click(); await page.waitForSelector('[data-testid=add-sheet]')
  await page.fill('[data-testid=add-sheet] input[name=name]', '현장손님'); await page.locator('[data-testid=add-sheet] [role=radio]', { hasText: '여' }).click(); await page.locator('[data-testid=add-sheet] [role=radio]', { hasText: 'C조' }).click(); await page.locator('[data-testid=add-sheet] [role=radio]', { hasText: /^6$/ }).click()
  await page.locator('[data-testid=add-sheet] button', { hasText: '추가' }).click(); await page.waitForTimeout(900)
  await step('6-guest-added-checked', { summary: await page.locator(`${panel} [data-cmp=CMP-028]`).textContent(), panelStill: await page.locator(panel).count() })
  if (OPS_MOBILE) { await page.locator(`${panel} button[aria-label=닫기]`).click(); await page.waitForTimeout(400) }
  // 대진 생성
  await vis(page, 'button', { hasText: '대진 생성' }).click(); await page.waitForTimeout(1200)
  const d1 = await db(page); const r1 = d1.sessions[0].rounds.at(-1)
  await step('7-generated', { courts: await page.locator('[data-cmp=CMP-041]').count(), waiting: await page.locator('section[aria-label=대기자]').textContent(), relaxed: await page.locator('[data-cmp=CMP-041] [data-cmp=CMP-005]').count() }); await shot(page, `${vp.n}-5-generated.jpg`)
  // 선수 교체(SCR-205)
  await page.locator('[data-cmp=CMP-041] button[aria-label$=교체]').first().click(); await page.waitForSelector('[data-testid=swap-sheet]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-6-swap.jpg`)
  const cand = page.locator('[data-testid=swap-sheet] [data-cmp=CMP-044] button:not([aria-disabled])').first(); const candText = await cand.textContent()
  await cand.click(); await page.waitForTimeout(700)
  const d2 = await db(page)
  await step('8-swapped', { candText, changed: JSON.stringify(d2.sessions[0].rounds.at(-1).courts) !== JSON.stringify(r1.courts) || JSON.stringify(d2.sessions[0].rounds.at(-1).waiting) !== JSON.stringify(r1.waiting) })
  // 확정
  await vis(page, 'button', { hasText: /^확정$/ }).click(); await page.locator('[role=alertdialog] button', { hasText: '확정' }).click(); await page.waitForTimeout(800)
  await step('9-confirmed', { status: (await db(page)).sessions[0].rounds.at(-1).status }); await shot(page, `${vp.n}-7-in-progress.jpg`)
  // 진행 중 선수 참석 해제 → 다음 라운드부터 제외
  const playing = (await db(page)).sessions[0].rounds.at(-1).courts[0].team1[0]
  const playingName = await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem('smapsh.mock.db.v1')); const [kind, id] = k.split(':'); return (kind === 'member' ? d.users : d.guests).find((x) => x.id === id).name }, playing)
  if (OPS_MOBILE) { await vis(page, 'button', { hasText: /^참석 \d+명/ }).click(); await page.waitForSelector(panel) }
  await page.locator(`${panel} label`, { hasText: playingName }).first().click(); await page.waitForTimeout(700)
  if (OPS_MOBILE) { await page.locator(`${panel} button[aria-label=닫기]`).click(); await page.waitForTimeout(400) }
  await step('10-excluded-next', { badge: await page.locator('[data-cmp=CMP-041]', { hasText: '다음 라운드부터 제외' }).count() }); await shot(page, `${vp.n}-8-excluded.jpg`)
  // 진행 중 세션 종료 메뉴 비활성
  await vis(page, 'button[aria-label=더보기]').click(); await page.waitForTimeout(300)
  r.steps['11-close-disabled'] = { disabled: await page.locator('[role=menuitem]', { hasText: '세션 종료' }).getAttribute('data-disabled') !== null, reason: await page.locator('[role=menuitem]', { hasText: '세션 종료' }).textContent() }
  await shot(page, `${vp.n}-9-close-disabled.jpg`); await page.keyboard.press('Escape'); await page.waitForTimeout(200)
  // 라운드 완료 → 2라운드(대기자 우선)
  await vis(page, 'button', { hasText: '라운드 완료' }).click(); await page.locator('[role=alertdialog] button', { hasText: '완료' }).click(); await page.waitForTimeout(800)
  await step('12-round2-ready', { notice: await page.locator('[data-cmp=CMP-023]', { hasText: '지난 라운드 대기자' }).textContent().catch(() => null) }); await shot(page, `${vp.n}-10-round2.jpg`)
  await vis(page, 'button', { hasText: '대진 생성' }).click(); await page.waitForTimeout(1200)
  const d3 = await db(page); const round1 = d3.sessions[0].rounds.find((x) => x.no === 1); const round2 = d3.sessions[0].rounds.find((x) => x.no === 2)
  const r2players = round2.courts.flatMap((c) => [...c.team1, ...c.team2])
  await step('13-round2', { waitedFirst: round1.waiting.filter((k) => k in d3.sessions[0].attendance).every((k) => r2players.includes(k)), excludedNotPlaying: !r2players.includes(playing) })
  // 세션 종료(검토 중 → 폐기 안내)
  await vis(page, 'button[aria-label=더보기]').click(); await page.locator('[role=menuitem]', { hasText: '세션 종료' }).click(); await page.waitForSelector('[role=alertdialog]')
  const closeText = await page.locator('[role=alertdialog]').textContent(); await shot(page, `${vp.n}-11-close-confirm.jpg`)
  await page.locator('[role=alertdialog] button', { hasText: '종료' }).click(); await page.waitForTimeout(800)
  await step('14-closed', { closeText }); await shot(page, `${vp.n}-12-closed.jpg`)
  // 이전 날짜 미종료 세션 배너
  await page.evaluate(() => { const k = 'smapsh.mock.db.v1'; const d = JSON.parse(localStorage.getItem(k)); d.sessions.push({ id: 's-old', date: '2026-11-02', status: 'open', attendance: {}, checkSeq: 0, excludedNext: [], options: { method: 'level', rules: { balance: true, gender: true, fairness: true, noRepeat: false } }, rounds: [], version: 1 }); localStorage.setItem(k, JSON.stringify(d)) })
  await page.goto(BASE + '/ops/session'); await page.waitForTimeout(700); await step('15-stale-banner', { banner: await page.locator('[data-cmp=CMP-023]', { hasText: '종료되지 않은' }).textContent().catch(() => null) }); await shot(page, `${vp.n}-13-stale.jpg`)
  await page.locator('button', { hasText: '이어서 열기' }).click(); await page.waitForTimeout(600); await step('16-stale-opened', { header: await page.locator('header').first().textContent() })
  // 권한
  await page.goto(BASE + '/ops/session?as=member'); await page.waitForTimeout(500); await step('17-member-blocked', { path: await page.evaluate(() => location.pathname) })
  await page.evaluate(() => localStorage.removeItem('smapsh.mock.db.v1'))
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 1))
for (const [vp, r] of Object.entries(report)) { console.log('==', vp, 'errors', r.errors.length, r.errors.slice(0, 3)); for (const [k, v] of Object.entries(r.steps)) console.log(k, JSON.stringify(v).slice(0, 260)) }
