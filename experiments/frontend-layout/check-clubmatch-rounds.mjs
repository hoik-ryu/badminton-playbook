// (B16, r14) 청백전 생성 페이지 라운드·코트 E2E — SCR-241 코트 수 · SCR-244 라운드 편집 · SCR-225 같은 라운드 제약 · SCR-245 라운드 요약·확정
// 실제 API 모드 Vite(BASE, 기본 http://localhost:5174) + APP_ENV=e2e 백엔드 + 임시 PostgreSQL(e2e-guard가 확인)
//   개인전: 코트 수 2로 만들기 → 라운드 수 미리보기 → 생성 → 휴식자·접기 → 삭제(코트 정리 토스트) → 코트 추가(같은 라운드 선택 불가)
//           → 라운드 추가 → 라운드 이동 시트(선택 불가 사유) → 저장 실패·다시 시도 → 두 화면 동시 편집 충돌 → 확정 요약 → 확정(1라운드 시작)
//   팀전: 미리보기(팀별 1인 경기 수) → 생성 → 선수 교체 시트(같은 라운드 출전자 선택 불가) → 확정
//   폭: 360·390·1440·200%(195×422) 가로 넘침, VD-086(카드 높이 = 라운드 정보 없는 청백전 카드, 라운드 머리글 ≤ 40, 390×844 첫 화면 카드 3개 이상), 누름 영역 44
// 사용: DEV_ADMIN_PASSWORD=… E2E_BACKEND=http://localhost:8011 OUT=<저장소 밖 결과 폴더> node experiments/frontend-layout/check-clubmatch-rounds.mjs
import fs from 'node:fs'
import path from 'node:path'

import { assertE2ETarget, guardBrowser, reportBlocked } from './e2e-guard.mjs'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5174'
const OUT = process.env.OUT || path.join(here, 'results/clubmatch-rounds')
fs.mkdirSync(OUT, { recursive: true })
const PASSWORD = process.env.DEV_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('DEV_ADMIN_PASSWORD 환경변수가 필요합니다')
await assertE2ETarget(BASE) // APP_ENV=e2e 백엔드(임시 DB)가 아니면 중단
const RUN = Date.now().toString(36).slice(-4)
const EXPECTED_HTTP = /status of (401|403|404|409|422)|net::ERR_FAILED/
const report = { run: RUN, checks: {}, info: {}, errors: [] }
const fails = []
const check = (name, ok, info) => {
  report.checks[name] = ok ? 'pass' : `FAIL ${info === undefined ? '' : JSON.stringify(info).slice(0, 400)}`
  if (!ok) fails.push(name)
}
const shot = (page, f, full = false) => page.screenshot({ path: path.join(OUT, f), fullPage: full })
const seen = (loc, timeout = 6000) => loc.waitFor({ timeout }).then(() => true, () => false)
const hScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)

const browser = await chromium.launch()
const blocked = guardBrowser(browser, BASE)
const ctxOpts = (w, h, m) => ({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m, locale: 'ko-KR' })

const st = (page) => page.locator('.su[data-scr]').getAttribute('data-st').catch(() => null)
const waitSt = (page, id, timeout = 8000) => page.waitForSelector(`.su[data-st="${id}"]`, { timeout })
const sheet = (page) => page.locator('[data-testid=club-swap-sheet]')
const sheetGone = (page) => page.waitForSelector('[data-testid=club-swap-sheet]', { state: 'detached', timeout: 8000 })
const sections = (page) => page.locator('[data-testid=round-section]')
async function confirmDialog(page, title, button) {
  const d = page.getByRole('alertdialog', { name: title })
  await d.waitFor({ timeout: 6000 })
  await d.getByRole('button', { name: button }).click()
  await d.waitFor({ state: 'detached', timeout: 6000 }).catch(() => {})
}
async function pickOk(page) {
  await sheet(page).waitFor()
  await sheet(page).locator('button[data-cmp=CMP-044]:not([aria-disabled])').first().click()
  if (await page.getByRole('alertdialog').count().catch(() => 0)) {
    await page.waitForTimeout(150)
    if (await page.getByRole('alertdialog').count()) await page.getByRole('alertdialog').getByRole('button', { name: '바꾸기' }).click()
  }
  await sheetGone(page)
}
async function fillAll(page) {
  if (await sheet(page).count()) await pickOk(page)
  for (let i = 0; i < 4; i++) {
    const empty = page.getByRole('button', { name: /빈 자리 선택$/ }).first()
    if (!(await empty.count())) break
    await empty.click()
    await pickOk(page)
  }
}

async function login(page) {
  await page.goto(BASE + '/login')
  await page.evaluate(() => localStorage.setItem('smapsh.introSeen.v1', '1'))
  await page.goto(BASE + '/login')
  await page.locator('button', { hasText: '운영진 로그인하기' }).click()
  await page.fill('input[name=username]', 'super_admin')
  await page.fill('input[name=password]', PASSWORD)
  await page.locator('form button[type=submit]').click()
  await page.waitForURL(BASE + '/ops')
}
const api = (page) => ({
  get: async (p) => (await page.request.get(BASE + p)).json(),
  send: async (method, p, data) => {
    const res = await page.request.fetch(BASE + p, { method, data, headers: { Origin: BASE } })
    return { status: res.status(), body: res.status() === 204 ? null : await res.json().catch(() => null) }
  },
})
/** 저장 상태의 라운드 규칙(같은 라운드 중복 0, 라운드 경기 ≤ 코트, 코트·번호 빈틈 없음) */
function roundRulesOk(v) {
  const by = new Map()
  for (const g of v.games) by.set(g.round, [...(by.get(g.round) ?? []), g])
  const rounds = [...by.keys()].sort((a, b) => a - b)
  if (rounds.some((r, i) => r !== i + 1)) return false
  for (const gs of by.values()) {
    if (gs.length > v.courtCount) return false
    const courts = gs.map((g) => g.court).sort((a, b) => a - b)
    if (courts.some((c, i) => c !== i + 1)) return false
    const keys = gs.filter((g) => !g.cancelled).flatMap((g) => [...g.team1, ...g.team2].map((p) => p.key))
    if (new Set(keys).size !== keys.length) return false
  }
  const ordered = [...v.games].sort((a, b) => a.round - b.round || a.court - b.court)
  return ordered.every((g, i) => g.no === i + 1)
}

// ── 준비(API): 점수 있는 회원 10명, 팀전·기존 방식(코트 없음) 준비 중 청백전 ──
async function prepare(page) {
  const A = api(page)
  const seed = parseInt(RUN, 36)
  const syl = (n) => String.fromCharCode(0xac00 + (n % 11172))
  const names = Array.from({ length: 10 }, (_, i) => `${'김이박최정강조윤장한'[i]}${syl(seed * 7 + i * 131)}${syl(seed * 13 + i * 577)}`)
  for (const [i, name] of names.entries()) await A.send('POST', '/api/roster/members', { name, gender: i % 2 ? '여' : '남', grade: 'C조', score: 1 + i })
  const roster = (await A.get('/api/roster')).members
  const keys = names.map((n) => `member:${roster.find((m) => m.name === n).id}`)
  const make = async (method, name, courtCount, people) => {
    const created = await A.send('POST', '/api/club-matches', { method, date: '2026-12-20', name, ...(courtCount ? { courtCount } : {}) })
    const id = created.body.id
    let v = await A.get(`/api/club-matches/${id}`)
    v = (await A.send('PUT', `/api/club-matches/${id}/participants`, { keys: people, version: v.version })).body
    if (method === 'team') v = (await A.send('PUT', `/api/club-matches/${id}/teams`, { assignments: Object.fromEntries(people.map((k, i) => [k, i % 2 ? 'white' : 'blue'])), version: v.version })).body
    return { id, v }
  }
  const team = await make('team', `라운드 팀전 ${RUN}`, 2, keys)
  // 기존 방식 카드 높이 비교용(코트 수 없음, 개인전 8명 4경기)
  const legacy = await make('individual', `기존 방식 ${RUN}`, null, keys.slice(0, 8))
  await A.send('POST', `/api/club-matches/${legacy.id}/games`, { version: legacy.v.version, totalGames: 4, rules: { balance: true, gender: false } })
  return { names, keys, team: team.id, legacy: legacy.id }
}

// ── 개인전: 만들기(코트 수)부터 확정까지 ──
async function individualFlow(page, data) {
  const A = api(page)
  await page.goto(`${BASE}/club-matches/new`)
  await waitSt(page, 'SCR-241-ST7')
  await page.getByRole('radio', { name: '개인전' }).click()
  await page.getByRole('textbox', { name: '청백전 이름' }).fill(`라운드 개인전 ${RUN}`)
  check('basic-court-default-4', (await page.getByRole('textbox', { name: '사용 코트 수' }).inputValue()) === '4')
  await page.getByRole('button', { name: '코트 수 줄이기' }).click()
  await page.getByRole('button', { name: '코트 수 줄이기' }).click()
  check('basic-court-help', await page.getByText('한 라운드에 최대 2경기를 동시에 진행합니다').isVisible())
  await shot(page, 'ind-241.png')
  await page.locator('[data-testid=su-next]').click()
  await page.waitForURL(/\/setup\/participants$/)
  const id = page.url().split('/')[4]
  let v = await A.get(`/api/club-matches/${id}`)
  check('basic-court-saved', v.courtCount === 2, v.courtCount)
  v = (await A.send('PUT', `/api/club-matches/${id}/participants`, { keys: data.keys.slice(0, 9), version: v.version })).body
  await page.goto(`${BASE}/club-matches/${id}/setup/games`)
  await page.locator('[data-testid=round-preview]').waitFor()
  const plan = await page.locator('[data-testid=round-preview]').textContent()
  check('preview-lines', plan.includes('라운드당 2경기 · 코트 2 · 참가 9명') && plan.includes('예상 10경기 · 1인 4–5경기') && plan.includes('출전 8명 · 휴식 1명'), plan)
  check('preview-default-5', (await page.getByRole('textbox', { name: '자동 생성 기준 라운드 수' }).inputValue()) === '5')
  check('preview-even-proposals', await page.getByRole('group', { name: '균등안' }).isVisible())
  await page.locator('[data-testid=su-generate]').click()
  await waitSt(page, 'SCR-244-ST7')
  v = await A.get(`/api/club-matches/${id}`)
  check('generated-5-rounds-10', v.games.length === 10 && new Set(v.games.map((g) => g.round)).size === 5 && v.plannedRounds === 5, { n: v.games.length })
  check('generated-round-rules', roundRulesOk(v))
  check('sections-5', (await sections(page).count()) === 5)
  // 휴식자·접기
  await sections(page).first().getByRole('button', { name: /^1라운드 휴식 1, 휴식자 보기$/ }).click()
  check('rest-names', await sections(page).first().getByLabel('1라운드 휴식자').isVisible())
  await sections(page).first().getByRole('button', { name: '1라운드 접기' }).click()
  await waitSt(page, 'SCR-244-ST24')
  check('fold-hides-cards', (await page.locator('li.su-game').count()) === 8)
  await sections(page).first().getByRole('button', { name: '1라운드 펼치기' }).click()
  await shot(page, 'ind-244-rounds.png', true)

  // 삭제: 2라운드 코트 1 → 코트 정리 토스트
  await sections(page).nth(1).getByRole('button', { name: '3경기 삭제' }).click()
  await confirmDialog(page, '3경기를 삭제할까요?', '삭제')
  check('delete-toast', await seen(page.getByText('2라운드 코트를 다시 정리했습니다').first()))
  v = await A.get(`/api/club-matches/${id}`)
  check('delete-courts-pulled', v.games.length === 9 && v.games.filter((g) => g.round === 2).map((g) => g.court).join() === '1' && roundRulesOk(v))

  // 코트 추가: 2라운드 '코트 2에 경기 추가' → 첫 빈 자리 시트에서 같은 라운드 출전자는 선택 불가
  await sections(page).nth(1).getByRole('button', { name: '코트 2에 경기 추가' }).click()
  await sheet(page).waitFor()
  const offs = await sheet(page).locator('button[aria-disabled=true]').allTextContents()
  check('court-add-round-busy-disabled', offs.some((t) => t.includes('이 라운드에 이미 출전')), offs.slice(0, 3))
  await fillAll(page)
  await waitSt(page, 'SCR-244-ST7')
  v = await A.get(`/api/club-matches/${id}`)
  check('court-add-saved', v.games.filter((g) => g.round === 2).length === 2 && roundRulesOk(v))

  // 라운드 추가 → 6라운드
  await page.getByRole('button', { name: '라운드 추가' }).click()
  await sheet(page).waitFor()
  check('round-add-sheet-header', (await sheet(page).textContent()).includes('6라운드 코트 1'))
  await fillAll(page)
  await waitSt(page, 'SCR-244-ST7')
  v = await A.get(`/api/club-matches/${id}`)
  check('round-add-saved', new Set(v.games.map((g) => g.round)).size === 6 && roundRulesOk(v))

  // 라운드 이동 시트: 꽉 찬 라운드는 '빈 코트 없음'
  const last = v.games.length
  await sections(page).nth(5).getByRole('button', { name: `${last}경기 다른 라운드로 이동` }).click()
  const ms = page.locator('[data-testid=move-sheet]')
  await ms.waitFor()
  await waitSt(page, 'SCR-244-ST20').catch(() => {})
  const rows = await ms.locator('[data-testid=move-row]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  check('move-sheet-reasons', rows.length === 5 && rows.every((r) => r.includes('빈 코트 없음')), rows)
  await shot(page, 'ind-244-move.png')
  await ms.getByRole('button', { name: '닫기' }).click()

  // 저장 실패 → 다시 시도
  let aborted = false
  await page.route('**/api/club-matches/*/games/*', async (route) => {
    if (!aborted && route.request().method() === 'DELETE') {
      aborted = true
      return route.abort()
    }
    return route.continue()
  })
  await sections(page).nth(5).getByRole('button', { name: `${last}경기 삭제` }).click()
  await confirmDialog(page, `${last}경기를 삭제할까요?`, '삭제')
  await waitSt(page, 'SCR-244-ST13').catch(() => {})
  check('delete-fail-notice', (await st(page)) === 'SCR-244-ST13' && (await page.getByText(`${last}경기를 삭제하지 못했습니다. 대진은 그대로입니다`).isVisible()))
  check('delete-fail-unchanged', (await A.get(`/api/club-matches/${id}`)).games.length === last)
  await page.getByRole('button', { name: '다시 시도' }).click()
  await page.waitForFunction((n) => document.querySelectorAll('li.su-game').length === n, last - 1, { timeout: 8000 }).catch(() => {})
  v = await A.get(`/api/club-matches/${id}`)
  check('delete-retry-ok-round-gone', v.games.length === last - 1 && new Set(v.games.map((g) => g.round)).size === 5 && roundRulesOk(v))
  await page.unroute('**/api/club-matches/*/games/*')

  // 두 화면 동시 편집 충돌: 다른 화면이 먼저 지우면 이 화면의 삭제는 충돌 창
  const other = await page.context().newPage()
  await other.goto(`${BASE}/club-matches/${id}/setup/games`)
  await waitSt(other, 'SCR-244-ST7')
  await sections(other).first().getByRole('button', { name: '1경기 삭제' }).click()
  await confirmDialog(other, '1경기를 삭제할까요?', '삭제')
  await other.waitForTimeout(600)
  await sections(page).first().getByRole('button', { name: '2경기 삭제' }).click()
  await confirmDialog(page, '2경기를 삭제할까요?', '삭제')
  check('conflict-dialog', await seen(page.getByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })))
  await page.getByRole('alertdialog').getByRole('button', { name: '확인' }).click()
  await other.close()
  v = await A.get(`/api/club-matches/${id}`)
  check('conflict-only-one-applied', v.games.length === last - 2 && roundRulesOk(v), v.games.length)

  // 확정 요약 → 확정(1라운드 시작)
  await page.goto(`${BASE}/club-matches/${id}/setup/confirm`)
  await waitSt(page, 'SCR-245-ST1')
  const rounds = new Set(v.games.map((g) => g.round)).size
  check('confirm-court-round-row', await page.getByText(`코트 2 · ${rounds}라운드`).isVisible())
  check('confirm-round-checks', (await page.getByText('같은 라운드 중복 출전 없음').isVisible()) && (await page.getByText('라운드마다 경기 수 ≤ 코트 수(2)').isVisible()))
  check('confirm-round1-notice', await page.getByText('확정하면 1라운드가 바로 시작됩니다').first().isVisible())
  await page.locator('[data-testid=show-rounds]').click()
  check('confirm-readonly-rounds', (await page.locator('[data-testid=readonly-rounds] [data-testid=round-section]').count()) === rounds)
  await shot(page, 'ind-245.png', true)
  await page.locator('[data-testid=su-next]').click()
  await confirmDialog(page, '대진을 확정하고 회원에게 공개할까요?', '확정')
  await page.waitForURL(`${BASE}/club-matches/${id}`)
  v = await A.get(`/api/club-matches/${id}`)
  check('confirmed-round-1', v.status === 'confirmed' && v.currentRound === 1)
}

// ── 팀전: 미리보기 → 생성 → 교체 시트의 같은 라운드 제약 → 확정 ──
async function teamFlow(page, data) {
  const A = api(page)
  const id = data.team
  await page.goto(`${BASE}/club-matches/${id}/setup/games`)
  const plan = await page.locator('[data-testid=round-preview]').textContent()
  check('team-preview', plan.includes('청팀 1인 4경기') && plan.includes('백팀 1인 4경기') && plan.includes('휴식 청 1·백 1'), plan)
  await page.locator('[data-testid=su-generate]').click()
  await waitSt(page, 'SCR-244-ST7')
  let v = await A.get(`/api/club-matches/${id}`)
  check('team-generated', v.games.length === 10 && roundRulesOk(v))
  // 참고 기록: 규칙 완화 배지가 있는 카드(390)의 높이 — VD-072 '배지가 길면 머리 줄 안에서 줄바꿈'
  report.info.relaxCardHeights = await page.locator('li.su-game:has(.su-relax)').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().height)))])
  await page.getByRole('button', { name: /^1경기 청팀 .* 교체$/ }).first().click()
  await sheet(page).waitFor()
  const sst = await sheet(page).locator('[data-scr=SCR-225]').getAttribute('data-st')
  const offs = await sheet(page).locator('button[aria-disabled=true]').allTextContents()
  check('team-sheet-round-busy', sst === 'SCR-225-ST13' && offs.some((t) => t.includes('이 라운드에 이미 출전')), { sst, offs: offs.slice(0, 2) })
  check('team-sheet-header', (await sheet(page).textContent()).includes('1라운드 코트 1 · 1경기'))
  await shot(page, 'team-225.png')
  await sheet(page).getByRole('button', { name: '닫기' }).click()
  await page.goto(`${BASE}/club-matches/${id}/setup/confirm`)
  await waitSt(page, 'SCR-245-ST1')
  check('team-confirm-play-line', await page.getByText('라운드마다 청 4·백 4 출전 · 휴식 청 1·백 1').isVisible())
  await page.locator('[data-testid=su-next]').click()
  await confirmDialog(page, '대진을 확정하고 회원에게 공개할까요?', '확정')
  await page.waitForURL(`${BASE}/club-matches/${id}`)
  v = await A.get(`/api/club-matches/${id}`)
  check('team-confirmed-round-1', v.status === 'confirmed' && v.currentRound === 1)
}

// ── 폭·밀도(VD-086)·누름 영역: 새 팀전 준비 중 청백전(코트 4, 10명 → 라운드당 2경기, 5라운드) ──
async function layout(ctxPage, data) {
  const A = api(ctxPage)
  const created = await A.send('POST', '/api/club-matches', { method: 'team', date: '2026-12-21', name: `밀도 ${RUN}`, courtCount: 4 })
  const id = created.body.id
  let v = await A.get(`/api/club-matches/${id}`)
  v = (await A.send('PUT', `/api/club-matches/${id}/participants`, { keys: data.keys, version: v.version })).body
  v = (await A.send('PUT', `/api/club-matches/${id}/teams`, { assignments: Object.fromEntries(data.keys.map((k, i) => [k, i % 2 ? 'white' : 'blue'])), version: v.version })).body
  await A.send('POST', `/api/club-matches/${id}/games`, { version: v.version, rounds: 5, rules: { balance: true, gender: false } })
  const sizes = [
    ['m390', 390, 844, true],
    ['m360', 360, 640, true],
    ['d1440', 1440, 900, false],
    ['z200', 195, 422, true],
  ]
  const storage = await ctxPage.context().storageState()
  for (const [name, w, h, m] of sizes) {
    const ctx = await browser.newContext({ ...ctxOpts(w, h, m), storageState: storage })
    const p = await ctx.newPage()
    for (const [label, url] of [
      ['241', `/club-matches/${id}/setup/basic`],
      ['244', `/club-matches/${id}/setup/games`],
      ['245', `/club-matches/${id}/setup/confirm`],
    ]) {
      await p.goto(BASE + url)
      await p.locator('.su[data-scr]').waitFor()
      await p.waitForTimeout(300)
      check(`overflow-${label}-${name}`, !(await hScroll(p)))
      if (label === '244') await shot(p, `layout-244-${name}.png`, name !== 'd1440')
    }
    if (name === 'm390') {
      await p.goto(`${BASE}/club-matches/${id}/setup/games`)
      await p.locator('[data-testid=round-section]').first().waitFor()
      const heads = await p.locator('[data-testid=round-section] > div:first-child').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
      check('vd086-round-head-le-40', Math.max(...heads) <= 40, heads)
      // VD-086 비교는 Preview 측정과 같은 조건(규칙 완화 배지 없는 카드 중앙값)
      const roundCards = await p.locator('li.su-game:not(:has(.su-relax))').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)).sort((a, b) => a - b))
      const visible = await p.evaluate(() => {
        const r = document.querySelector('[data-testid=round-section]')
        r.scrollIntoView({ block: 'start' })
        const bar = document.querySelector('[data-testid=su-next]')?.closest('.app-fixed-bar, .su-bar, footer')?.getBoundingClientRect().top ?? innerHeight
        return [...document.querySelectorAll('li.su-game')].filter((c) => { const b = c.getBoundingClientRect(); return b.top >= 0 && b.bottom <= bar }).length
      })
      check('vd086-first-screen-3-cards', visible >= 3, visible)
      const targets = await p.evaluate(() => {
        const sel = ['[data-testid=round-section] button', 'button[aria-label="라운드 수 줄이기"]', 'button[aria-label="라운드 수 늘리기"]', '.su-add']
        return [...document.querySelectorAll(sel.join(','))].filter((b) => b.offsetParent).map((b) => {
          const r = b.getBoundingClientRect()
          const after = getComputedStyle(b, '::after')
          // ::after 누름 영역(position:absolute, inset 음수)만큼 더함
          const pad = after.content !== 'none' && after.position === 'absolute' ? -2 * (parseFloat(after.top) || 0) : 0
          return { label: b.getAttribute('aria-label') ?? b.textContent.trim().slice(0, 20), w: Math.round(r.width + pad), h: Math.round(r.height + pad) }
        })
      })
      const small = targets.filter((t) => t.h < 44 || t.w < 44)
      check('touch-targets-44', small.length === 0, small.slice(0, 5))
      await p.goto(`${BASE}/club-matches/${data.legacy}/setup/games`)
      await p.locator('li.su-game').first().waitFor()
      const legacyCards = await p.locator('li.su-game:not(:has(.su-relax))').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)).sort((a, b) => a - b))
      const med = (xs) => xs[Math.floor(xs.length / 2)]
      report.info.cardHeights = { round: med(roundCards), legacy: med(legacyCards) }
      check('vd086-card-height-same', med(roundCards) === med(legacyCards), report.info.cardHeights)
    }
    await ctx.close()
  }
}

const ctx = await browser.newContext(ctxOpts(390, 844, true))
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && !EXPECTED_HTTP.test(m.text()) && report.errors.push(m.text()))
page.on('pageerror', (e) => report.errors.push(String(e)))
try {
  await login(page)
  const data = await prepare(page)
  await individualFlow(page, data)
  await teamFlow(page, data)
  await layout(page, data)
} catch (e) {
  report.errors.push(String(e?.stack ?? e))
  await shot(page, 'error.png', true).catch(() => {})
}
await browser.close()
reportBlocked(blocked)
report.blockedOutsideBase = blocked.length
check("outside-base-requests-0", blocked.length === 0, blocked.slice(0, 3))
check('console-errors-0', report.errors.length === 0, report.errors.slice(0, 3))
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ fails, errors: report.errors.slice(0, 3), info: report.info, total: Object.keys(report.checks).length }, null, 1))
process.exit(fails.length ? 1 : 0)
