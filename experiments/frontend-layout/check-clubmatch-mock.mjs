// 청백전 Mock 브라우저 회귀(현재 통합 화면 SCR-111 목록·SCR-112 상세, UX Spec r6) — 5-B2
// 이전 check-b4.mjs(B4 당시 SCR-221·223 화면 기록)는 그대로 두고, 현재 화면은 이 스크립트로 확인합니다. 실제 API 검증은 check-clubmatch-api.mjs.
// 흐름(운영진, B12 생성 페이지): 목록 → '새 청백전'(SCR-241, 빈 이름 → 다음 비활성) → 팀전 → 참가자(SCR-242)·점수(SCR-214) → 팀 구성(SCR-243)
//   → 대진(SCR-244) 생성 → 다시 생성 → 교체(SCR-225) → 나가기 → 목록 재진입(계산된 단계 = 확정) → 확정(SCR-245 → SCR-112 ST13, 종료 비활성 + 'n경기 남음') → 결과 입력 → 되돌리기 → 확정 후 교체('변경됨') → 종료(ST14, 최종 결과)
//   → cm-1 중도 귀가(SCR-226) / 권한·주소: 구 주소 리다이렉트(쿼리 유지), 회원·비로그인 차단, 회원 준비 중 404, 잘못된 주소 ST5 / 하단 탭 3·4
// 사용: Mock 개발 서버(VITE_DATA_SOURCE=mock)를 띄운 뒤 BASE=http://localhost:5173 OUT=<결과 폴더> node experiments/frontend-layout/check-clubmatch-mock.mjs
//   (Mock 저장소는 브라우저 localStorage만 씀. 서버·DB에 쓰지 않음)
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = process.env.OUT || path.join(here, 'results/clubmatch-mock'); fs.mkdirSync(OUT, { recursive: true })
const db = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('smapsh.mock.db.v1')))
const newest = (d) => d.clubMatches.find((m) => !['cm-1', 'cm-2', 'cm-3'].includes(m.id))
const vis = (page, sel, opts) => page.locator(sel, opts).filter({ visible: true }).first()
const st = (page) => page.evaluate(() => ({ scr: document.querySelector('[data-scr]')?.dataset.scr, st: document.querySelector('[data-scr]')?.dataset.st, ops: document.querySelector('[data-testid=ops-area]')?.dataset.st }))
const hScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
const ready = (page) => page.waitForFunction(() => { const e = document.querySelector('[data-scr]'); return e && !/ST2$/.test(e.dataset.st || '') }, null, { timeout: 8000 }).catch(() => {})
const tabs = (page) => page.evaluate(() => [...document.querySelectorAll('nav[aria-label="주 메뉴"] a')].map((a) => [a.querySelector(':scope > span:last-child').textContent, a.getAttribute('aria-current') || '']))
const fails = []

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm360', w: 360, h: 640, m: true }, { n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 2 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { checks: {}, errors })
  const check = (name, ok, info) => { r.checks[name] = ok ? 'pass' : `FAIL ${info === undefined ? '' : JSON.stringify(info).slice(0, 300)}`; if (!ok) fails.push(`${vp.n}:${name}`) }
  const shot = (f) => page.screenshot({ path: path.join(OUT, `${vp.n}-${f}.png`) })
  page.on('console', (m) => m.type() === 'error' && !/status of (401|403|404|409|422)/.test(m.text()) && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const panel = '[data-testid=participants-sheet]'
  await page.goto(BASE + '/login'); await page.evaluate(() => { localStorage.removeItem('smapsh.mock.db.v1'); localStorage.setItem('smapsh.introSeen.v1', '1') })

  // 1. 목록(SCR-111, 운영진): 준비 중 포함, 4탭
  await page.goto(BASE + '/club-matches?as=admin'); await ready(page)
  check('list-SCR-111', (await st(page)).scr === 'SCR-111' && (await page.locator('a[data-match=cm-2]').count()) === 1)
  check('admin-tabs-4', (await tabs(page)).length === 4 && (await tabs(page))[1][1] === 'page', await tabs(page))
  check('hscroll-list', !(await hScroll(page))); await shot('1-list')
  // 2. 생성 페이지(SCR-241): 이름이 비면 다음 비활성 → 팀전 → 만들기 → 참가자(SCR-242)
  const waitSt = (id) => page.waitForSelector(`.su[data-st="${id}"]`, { timeout: 8000 }).catch(() => {})
  const next = async () => { await page.waitForSelector('[data-testid=su-next]:not([disabled])', { timeout: 8000 }); await page.locator('[data-testid=su-next]').click() }
  await page.locator('[data-testid=cm-create]').click(); await page.waitForURL((u) => u.pathname === '/club-matches/new')
  await page.getByRole('radio', { name: '팀전' }).click()
  await page.locator('[data-testid=su-next]').click(); await page.waitForTimeout(300)
  check('create-name-required', new URL(page.url()).pathname === '/club-matches/new' && (await page.locator('.su', { hasText: '이름을 입력해 주세요' }).count()) === 1 && newest(await db(page)) === undefined)
  await page.getByRole('textbox', { name: '청백전 이름' }).fill('브라우저 청백전')
  await next(); await page.waitForURL(/\/setup\/participants$/)
  const cid = page.url().split('/')[4]
  check('created-setup-242', /^cm-/.test(cid) && newest(await db(page))?.status === 'draft', cid)
  check('setup-no-tabbar', (await page.locator('nav[aria-label="주 메뉴"]').count()) === 0)
  // 3. 참가자 9명 + 점수 미설정(SCR-214)
  await waitSt('SCR-242-ST1')
  const boxes = page.getByRole('checkbox', { name: /, (\d+점|점수 미설정)$/ }) // '표시된 n명 모두 선택' 제외, 사람 행만
  for (let i = 0; i < 9; i++) { await boxes.nth(i).click(); await page.waitForTimeout(60) }
  for (let k = 0; k < 9 && (await page.getByRole('button', { name: /점수 미설정 \d+명, 점수 매기기/ }).count()); k++) {
    await page.getByRole('button', { name: /점수 미설정 \d+명, 점수 매기기/ }).click(); await page.waitForSelector('[data-testid=score-sheet]')
    const rg = await page.locator('[data-testid=score-sheet] [role=radiogroup]').count()
    for (let i = 0; i < rg; i++) { await page.locator('[data-testid=score-sheet] [role=radiogroup]').nth(i).locator('[role=radio]', { hasText: /^5$/ }).click(); await page.waitForTimeout(400) }
    await page.waitForSelector('[data-testid=score-sheet]', { state: 'detached', timeout: 4000 }).catch(() => {})
  }
  check('hscroll-242', !(await hScroll(page))); await shot('2-242')
  await next(); await page.waitForURL(/\/setup\/teams$/); await waitSt('SCR-243-ST7')
  // 4. 팀 구성(SCR-243) → 대진(SCR-244)
  check('hscroll-243', !(await hScroll(page))); await shot('2-243')
  await next(); await page.waitForURL(/\/setup\/games$/)
  const parts = Object.values(newest(await db(page)).participants)
  check('participants-teams', parts.length === 9 && parts.every((p) => p.team), { n: parts.length })
  await page.getByRole('textbox', { name: '총 경기 수' }).fill('7')
  await page.locator('[data-testid=su-generate]').click(); await waitSt('SCR-244-ST7')
  const g1 = newest(await db(page))
  check('generated-244', g1.games.length === 7 && g1.totalGames === 7, { games: g1.games.length })
  check('hscroll-244', !(await hScroll(page))); await shot('2-244')
  // 5. 다시 생성(새 시드)
  await page.getByRole('button', { name: /다시 생성/ }).click(); await page.waitForTimeout(1000)
  check('regenerated', newest(await db(page)).seed !== g1.seed)
  // 6. 교체(SCR-225, 확정 전)
  const before = JSON.stringify(newest(await db(page)).games)
  await page.getByRole('button', { name: /^1경기 .* 교체$/ }).first().click(); await page.waitForSelector('[data-testid=club-swap-sheet]')
  const cand = page.locator('[data-testid=club-swap-sheet] button[data-cmp=CMP-044]:not([aria-disabled])').first()
  if (await cand.count()) { await cand.click(); await page.waitForTimeout(400); if (await page.locator('[role=alertdialog]').count()) await page.locator('[role=alertdialog] button', { hasText: '바꾸기' }).click(); await page.waitForTimeout(600) }
  else await page.locator('[data-testid=club-swap-sheet] button[aria-label=닫기]').click()
  await page.waitForSelector('[data-testid=club-swap-sheet]', { state: 'detached', timeout: 4000 }).catch(() => {})
  check('swap-before-confirm', JSON.stringify(newest(await db(page)).games) !== before && (await page.locator('[data-testid=club-swap-sheet]').count()) === 0)
  // 7. 나가기 → 목록 재진입(계산된 단계 = 확정, AC-131) → 확정 → SCR-112 ST13, 종료 비활성 + 'n경기 남음'
  await page.getByRole('button', { name: '나가기(청백전 목록)' }).click(); await page.waitForURL((u) => u.pathname === '/club-matches')
  await page.locator(`a[data-match="${cid}"]`).click(); await page.waitForURL(/\/setup\/confirm$/, { timeout: 8000 }).catch(() => {})
  check('resume-confirm', page.url().endsWith(`/${cid}/setup/confirm`), page.url())
  await next(); await page.locator('[role=alertdialog] button', { hasText: '확정' }).click()
  await page.waitForURL((u) => u.pathname === `/club-matches/${cid}`); await page.waitForSelector('[data-testid=ops-area]'); await page.waitForTimeout(600)
  check('confirmed-ST13', newest(await db(page)).status === 'confirmed' && (await st(page)).ops === 'SCR-112-ST13' && (await page.locator('[data-testid=public-area]').count()) === 1)
  check('finish-disabled-left', (await page.getByRole('button', { name: '청백전 종료' }).isDisabled()) && (await page.getByRole('button', { name: /경기 남음$/ }).count()) === 1)
  // 8. 결과 입력(마지막 경기 남김) → 되돌리기 → 다시 기록
  const n = newest(await db(page)).games.length
  for (let i = 1; i < n; i++) { await page.locator(`[role=group][aria-label="${i}경기 결과"] button`, { hasText: '청 승' }).click(); await page.waitForTimeout(220) }
  await page.waitForTimeout(600)
  check('results-recorded', newest(await db(page)).games.filter((g) => g.winner).length === n - 1)
  await page.locator('article[aria-label="1경기"] button', { hasText: '미기록으로 되돌리기' }).click(); await page.locator('[role=alertdialog] button', { hasText: '되돌리기' }).click(); await page.waitForTimeout(600)
  check('result-reverted', newest(await db(page)).games[0].winner === null)
  await page.locator('[role=group][aria-label="1경기 결과"] button', { hasText: '백 승' }).click(); await page.waitForTimeout(500)
  check('result-rerecorded', newest(await db(page)).games[0].winner === 2)
  check('hscroll-ST13', !(await hScroll(page))); await shot('3-ST13')
  // 9. 확정 후 교체(결과 없는 경기만) → '변경됨'
  await page.locator('[data-testid=ops-area] [data-cmp=CMP-041][data-recorded=false] button[aria-label$=교체]').first().click(); await page.waitForSelector('[data-testid=club-swap-sheet]')
  const c2 = page.locator('[data-testid=club-swap-sheet] button[data-cmp=CMP-044]:not([aria-disabled])').first()
  if (await c2.count()) { await c2.click(); await page.waitForTimeout(400); if (await page.locator('[role=alertdialog]').count()) await page.locator('[role=alertdialog] button', { hasText: '바꾸기' }).click(); await page.waitForTimeout(600) }
  else await page.locator('[data-testid=club-swap-sheet] button[aria-label=닫기]').click()
  await page.waitForSelector('[data-testid=club-swap-sheet]', { state: 'detached', timeout: 4000 }).catch(() => {})
  const m2 = newest(await db(page))
  check('swap-after-confirm', m2.modifiedAt !== null && (await page.locator('[data-testid=ops-area] [data-cmp=CMP-041]', { hasText: '변경됨' }).count()) > 0)
  // 10. 마지막 결과 → 종료(ST14, 최종 결과)
  await page.locator(`[role=group][aria-label="${n}경기 결과"] button`, { hasText: '백 승' }).click(); await page.waitForTimeout(400)
  await page.getByRole('button', { name: '청백전 종료' }).click(); await page.locator('[role=alertdialog] button', { hasText: '종료' }).click(); await page.waitForTimeout(800)
  check('finished-ST14', newest(await db(page)).status === 'finished' && (await st(page)).ops === 'SCR-112-ST14' && (await page.getByRole('region', { name: '최종 결과' }).count()) === 1)
  check('hscroll-ST14', !(await hScroll(page))); await shot('4-ST14')
  // 11. cm-1 중도 귀가 → 대체 선수(SCR-226)
  await page.goto(BASE + '/club-matches/cm-1'); await ready(page)
  await vis(page, 'button', { hasText: /^참가자 \d+명/ }).click(); await page.waitForSelector(panel)
  await page.locator(`${panel} button`, { hasText: '이후 대진에서 제외' }).first().click(); await page.waitForSelector('[data-testid=substitute-sheet]')
  await page.locator('[data-testid=substitute-sheet] button', { hasText: '반영' }).click(); await page.waitForTimeout(800)
  const cm1 = (await db(page)).clubMatches.find((m) => m.id === 'cm-1'); const leaver = Object.entries(cm1.participants).find(([, p]) => p.left)?.[0]
  check('leave-substitute', !!leaver && !cm1.games.some((g) => !g.winner && [...g.team1, ...g.team2].includes(leaver)) && (await page.locator('[data-testid=substitute-sheet]').count()) === 0)
  // 12. 주소·권한
  await page.goto(BASE + '/ops/club-matches/cm-1?from=bookmark'); await page.waitForURL((u) => u.pathname === '/club-matches/cm-1', { timeout: 5000 }).catch(() => {})
  check('legacy-redirect-admin', new URL(page.url()).pathname === '/club-matches/cm-1' && new URL(page.url()).search === '?from=bookmark', page.url())
  await page.goto(BASE + '/club-matches/not-a-uuid'); await ready(page)
  check('malformed-id-ST5', (await st(page)).st === 'SCR-112-ST5', await st(page))
  await page.goto(BASE + '/club-matches?as=member'); await ready(page)
  check('member-tabs-3', (await tabs(page)).length === 3 && (await tabs(page))[1][1] === 'page', await tabs(page))
  check('member-list-no-pending', (await page.locator('a[data-match=cm-2]').count()) === 0 && (await page.locator('a[data-match=cm-1]').count()) === 1)
  await page.goto(BASE + '/club-matches/cm-1'); await ready(page)
  check('member-detail-public-only', (await page.locator('[data-testid=public-area]').count()) === 1 && (await page.locator('[data-testid=ops-area]').count()) === 0)
  await page.goto(BASE + '/club-matches/cm-2'); await ready(page)
  check('member-pending-ST5', (await st(page)).st === 'SCR-112-ST5')
  for (const p of ['/ops/club-matches', '/ops/club-matches/cm-1']) { await page.goto(BASE + p); await page.waitForURL((u) => u.pathname === '/forbidden', { timeout: 5000 }).catch(() => {}); check(`member-legacy-forbidden ${p}`, new URL(page.url()).pathname === '/forbidden') }
  await page.goto(BASE + '/ops/club-matches/cm-1?as=guest'); await page.waitForURL((u) => u.pathname === '/login', { timeout: 5000 }).catch(() => {})
  check('guest-legacy-login', new URL(page.url()).pathname === '/login')
  // 11-1. 준비 중 cm-2: 상세 주소 → 생성 페이지로, 기본정보 더보기 → 삭제(SCR-241-ST10, AC-134)
  await page.goto(BASE + '/club-matches?as=admin'); await ready(page)
  await page.goto(BASE + '/club-matches/cm-2'); await page.waitForURL(/\/club-matches\/cm-2\/setup\/\w+$/, { timeout: 8000 }).catch(() => {})
  check('draft-detail-to-setup', /\/club-matches\/cm-2\/setup\/\w+$/.test(new URL(page.url()).pathname), page.url())
  await page.goto(BASE + '/club-matches/cm-2/setup/basic'); await page.getByRole('button', { name: '더보기: 청백전 삭제' }).click()
  await page.locator('[role=alertdialog] button', { hasText: '삭제' }).click(); await page.waitForURL((u) => u.pathname === '/club-matches')
  check('delete-draft', !(await db(page)).clubMatches.some((m) => m.id === 'cm-2'))
  check('no-console-errors', errors.length === 0, errors)
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
for (const [vp, v] of Object.entries(report)) console.log(vp, Object.values(v.checks).filter((x) => x === 'pass').length, '/', Object.keys(v.checks).length)
console.log(fails.length ? `FAILED: ${fails.join(', ')}` : 'ALL CHECKS PASSED')
