// (B14, r13) 청백전 대진 직접 구성·확정 전 공통 편집 E2E — SCR-244 편집기 · SCR-225 시트 · SCR-245 요약 · 확정 후 정책
// MODE=api(기본): 실제 API 모드 Vite(BASE, 기본 http://localhost:5174) + APP_ENV=e2e 백엔드 + 임시 PostgreSQL(e2e-guard가 확인)
//   개인전: 자동 생성 → 경기 추가(빈 자리 4개 채움) → 삭제(확인·취소) → 맞교환 → 같은 대진 반복 표시 → 편집 후 다시 생성 확인·취소
//           → 저장 실패·다시 시도 → 두 화면 동시 편집 충돌 → 미완성 경기 다음 불가·뒤로 가기·새로고침 확인 → 0경기 → 직접 구성
//   팀전: 직접 구성(팀 소속 후보만) → 항상 막는 규칙 API 거부 → 참가자 변경 폐기 확인 → 확정 → 확정 후 추가·삭제·맞교환 거부, 교체 시트
//   폭: 390(흐름), 360·1440·200%(195×422) 가로 넘침·카드 높이
// MODE=mock: Mock 모드 Vite(BASE, 기본 http://localhost:5175) — 같은 개인전 흐름 축약판(브라우저 localStorage만, 서버·DB 없음)
// 사용: MODE=api DEV_ADMIN_PASSWORD=… OUT=<저장소 밖 결과 폴더> node experiments/frontend-layout/check-clubmatch-edit.mjs
//       MODE=mock BASE=http://localhost:5175 OUT=… node experiments/frontend-layout/check-clubmatch-edit.mjs
import fs from 'node:fs'
import path from 'node:path'

import { assertE2ETarget, guardBrowser, reportBlocked } from './e2e-guard.mjs'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const MODE = process.env.MODE || 'api'
const BASE = process.env.BASE || (MODE === 'api' ? 'http://localhost:5174' : 'http://localhost:5175')
const OUT = process.env.OUT || path.join(here, `results/clubmatch-edit-${MODE}`)
fs.mkdirSync(OUT, { recursive: true })
const PASSWORD = process.env.DEV_ADMIN_PASSWORD
if (MODE === 'api') {
  if (!PASSWORD) throw new Error('DEV_ADMIN_PASSWORD 환경변수가 필요합니다')
  await assertE2ETarget(BASE) // APP_ENV=e2e 백엔드(임시 DB)가 아니면 중단
}
const RUN = Date.now().toString(36).slice(-4)
const EXPECTED_HTTP = /status of (401|403|404|409|422)|net::ERR_FAILED/
const report = { mode: MODE, run: RUN, checks: {}, info: {}, errors: [] }
const fails = []
const check = (name, ok, info) => {
  report.checks[name] = ok ? 'pass' : `FAIL ${info === undefined ? '' : JSON.stringify(info).slice(0, 400)}`
  if (!ok) fails.push(name)
}
const shot = (page, f, full = false) => page.screenshot({ path: path.join(OUT, f), fullPage: full })
const hScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)

const browser = await chromium.launch()
const blocked = MODE === 'api' ? guardBrowser(browser, BASE) : null
const ctxOpts = (w, h, m) => ({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m, locale: 'ko-KR' })

// ── 공통 조작 ──
const st = (page) => page.locator('.su[data-scr]').getAttribute('data-st').catch(() => null)
const waitSt = (page, id, timeout = 8000) => page.waitForSelector(`.su[data-st="${id}"]`, { timeout })
const sheet = (page) => page.locator('[data-testid=club-swap-sheet]')
const sheetGone = (page) => page.waitForSelector('[data-testid=club-swap-sheet]', { state: 'detached', timeout: 8000 })
const dialog = (page) => page.locator('[role=alertdialog]')
async function pickOk(page) {
  await sheet(page).waitFor()
  await sheet(page).locator('button[data-cmp=CMP-044]:not([aria-disabled])').first().click()
  if (await dialog(page).count().catch(() => 0)) {
    await page.waitForTimeout(150)
    if (await dialog(page).count()) await dialog(page).locator('button', { hasText: '바꾸기' }).click()
  }
  await sheetGone(page)
}
/** n경기의 빈 자리를 모두 채움(열린 시트가 있으면 먼저 고름) */
async function fill(page, no) {
  if (await sheet(page).count()) await pickOk(page)
  for (let i = 0; i < 4; i++) {
    const empty = page.getByRole('button', { name: new RegExp(`^${no}경기 .* 빈 자리 선택$`) }).first()
    if (!(await empty.count())) break
    await empty.click()
    await pickOk(page)
  }
}
const cards = (page) => page.locator('li.su-game')
const reason = (page) => page.locator('#su-reason').textContent({ timeout: 2000 }).catch(() => '')
async function confirmDialog(page, title, button) {
  const d = page.getByRole('alertdialog', { name: title })
  await d.waitFor({ timeout: 6000 })
  await d.getByRole('button', { name: button }).click()
  await d.waitFor({ state: 'detached', timeout: 6000 }).catch(() => {})
}

async function login(page) {
  if (MODE === 'mock') {
    await page.goto(BASE + '/login')
    await page.evaluate(() => {
      localStorage.removeItem('smapsh.mock.db.v1')
      localStorage.setItem('smapsh.introSeen.v1', '1')
    })
    await page.goto(BASE + '/club-matches?as=admin')
    return
  }
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
/** Mock 저장소의 청백전(localStorage) */
const mockMatch = (page, id) => page.evaluate((x) => JSON.parse(localStorage.getItem('smapsh.mock.db.v1')).clubMatches.find((m) => m.id === x), id)

// ── 준비(API): 점수 있는 회원 8명 + 참가하지 않는 회원 1명, 개인전·팀전 준비 중 청백전 ──
async function prepare(page) {
  const A = api(page)
  // 일반적인 3글자 이름(카드 밀도 확인용). 실행마다 다른 음절로 만들어 이전 실행과 겹치지 않게 함
  const seed = parseInt(RUN, 36)
  const syl = (n) => String.fromCharCode(0xac00 + (n % 11172))
  const names = Array.from({ length: 8 }, (_, i) => `${'김이박최정강조윤'[i]}${syl(seed * 7 + i * 131)}${syl(seed * 13 + i * 577)}`)
  for (const [i, name] of names.entries()) await A.send('POST', '/api/roster/members', { name, gender: i % 2 ? '여' : '남', grade: 'C조', score: 3 + i })
  const outsider = `장${syl(seed * 3 + 11)}${syl(seed * 5 + 29)}`
  await A.send('POST', '/api/roster/members', { name: outsider, gender: '남', grade: 'C조', score: 5 })
  const roster = (await A.get('/api/roster')).members
  const key = (n) => `member:${roster.find((m) => m.name === n).id}`
  const keys = names.map(key)
  const make = async (method, name) => {
    const created = await A.send('POST', '/api/club-matches', { method, date: '2026-12-20', name })
    const id = created.body.id
    let v = await A.get(`/api/club-matches/${id}`)
    v = (await A.send('PUT', `/api/club-matches/${id}/participants`, { keys, version: v.version })).body
    if (method === 'team') v = (await A.send('PUT', `/api/club-matches/${id}/teams`, { assignments: Object.fromEntries(keys.map((k, i) => [k, i % 2 ? 'white' : 'blue'])), version: v.version })).body
    return id
  }
  return { ind: await make('individual', `편집 개인전 ${RUN}`), team: await make('team', `편집 팀전 ${RUN}`), keys, outsider: key(outsider) }
}

// ── 개인전 흐름 ──
async function individualFlow(page, id) {
  const A = api(page)
  const view = async () => (MODE === 'api' ? A.get(`/api/club-matches/${id}`) : mockView(page, id))
  await page.goto(`${BASE}/club-matches/${id}/setup/games`)
  await waitSt(page, MODE === 'api' ? 'SCR-244-ST1' : await st(page) ?? 'SCR-244-ST1').catch(() => {})
  check('ind-auto-default', (await page.getByRole('radio', { name: '자동 생성' }).getAttribute('aria-checked')) === 'true')
  await page.getByRole('textbox', { name: '총 경기 수' }).fill('8')
  await page.locator('[data-testid=su-generate]').click()
  await waitSt(page, 'SCR-244-ST7')
  let v = await view()
  check('ind-generated-8', v.games.length === 8 && v.totalGames === 8, { n: v.games.length, t: v.totalGames })

  // 경기 추가 → 첫 빈 자리 시트 자동 → 4자리 → 저장
  await page.getByRole('button', { name: '경기 추가' }).click()
  await sheet(page).waitFor()
  check('ind-add-opens-sheet', (await sheet(page).locator('[data-scr=SCR-225]').getAttribute('data-st')) === 'SCR-225-ST9')
  await pickOk(page)
  await waitSt(page, 'SCR-244-ST11')
  check('ind-partial-not-saved', (await view()).games.length === 8)
  check('ind-partial-next-blocked', (await reason(page)).includes('9경기에 빈 자리가 있습니다'), await reason(page))
  await fill(page, 9)
  await waitSt(page, 'SCR-244-ST7')
  v = await view()
  check('ind-added-9', v.games.length === 9 && v.totalGames === 9 && v.games[8].manual === true, { n: v.games.length, t: v.totalGames })
  check('ind-base-caption', await page.getByText('기준 8경기에서 편집됨').isVisible())
  // 사람별 경기 수 = 서버 집계
  const region = await page.getByRole('region', { name: '사람별 경기 수' }).textContent()
  const rows = (v.rows ?? []).filter((r) => r.participating)
  check('ind-counts-match-server', rows.every((r) => region.includes(`${r.name} ${r.games}`)), { region: region.slice(0, 200) })
  const relaxCount = v.games.filter((g) => g.genderRelaxed || g.repeatedMatchup || g.relaxations.length).length
  check('ind-summary-recalc', (await page.getByRole('region', { name: '대진 요약' }).textContent()).includes(`${relaxCount}경기`))

  // 삭제: 확인 창 취소 → 그대로, 확인 → 저장·번호 재정렬
  await page.getByRole('button', { name: '3경기 삭제' }).click()
  await confirmDialog(page, '3경기를 삭제할까요?', '취소')
  check('ind-delete-cancel-keeps', (await view()).games.length === 9)
  const fourth = JSON.stringify((await view()).games[3].team1.map((p) => p.key))
  await page.getByRole('button', { name: '3경기 삭제' }).click()
  await confirmDialog(page, '3경기를 삭제할까요?', '삭제')
  await page.waitForFunction(() => document.querySelectorAll('li.su-game').length === 8)
  v = await view()
  check('ind-deleted-renumbered', v.games.length === 8 && v.totalGames === 8 && JSON.stringify(v.games[2].team1.map((p) => p.key)) === fourth)

  // 같은 경기 맞교환
  const g1 = v.games[0]
  await page.getByRole('button', { name: new RegExp(`^1경기 1팀 ${g1.team1[0].name} 교체$`) }).click()
  await sheet(page).waitFor()
  const swapSec = sheet(page).getByRole('region', { name: '같은 경기 맞교환' })
  check('ind-exchange-section', (await swapSec.locator('button').count()) === 2)
  await shot(page, `${MODE}-ind-sheet-390.png`)
  await swapSec.locator('button').first().click()
  await sheetGone(page)
  v = await view()
  check('ind-exchanged', v.games[0].team2.some((p) => p.key === g1.team1[0].key) && v.games[0].manual === true)

  // 실패 → 다시 시도(네트워크 끊김 1회 주입)
  let aborted = false
  await page.route('**/api/club-matches/*/games/2?*', (route) => {
    if (!aborted && route.request().method() === 'DELETE') {
      aborted = true
      return route.abort()
    }
    return route.continue()
  })
  if (MODE === 'api') {
    await page.getByRole('button', { name: '2경기 삭제' }).click()
    await confirmDialog(page, '2경기를 삭제할까요?', '삭제')
    await page.getByText('2경기를 삭제하지 못했습니다. 대진은 그대로입니다').waitFor({ timeout: 6000 })
    check('ind-fail-notice-kept', (await st(page)) === 'SCR-244-ST13' && (await view()).games.length === 8)
    await page.getByRole('button', { name: '다시 시도' }).click()
    await page.waitForFunction(() => document.querySelectorAll('li.su-game').length === 7)
    check('ind-retry-deleted', (await view()).games.length === 7)
  }
  await page.unroute('**/api/club-matches/*/games/2?*')

  // 미완성 경기: 다음 불가 · 뒤로 가기 확인 · 새로고침(beforeunload)
  await page.getByRole('button', { name: '경기 추가' }).click()
  await pickOk(page)
  await waitSt(page, 'SCR-244-ST11')
  check('ind-next-disabled-partial', await page.locator('[data-testid=su-next]').isDisabled())
  // 브라우저 뒤로 가기: 직전 기록이 앱 안이면 앱 확인 창(useBlocker), 다른 문서면 브라우저 확인(beforeunload). 어느 쪽이든 머묾
  let backDialog = null
  page.once('dialog', async (d) => {
    backDialog = d.type()
    await d.dismiss()
  })
  await page.goBack({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(400)
  const appDialog = await page.getByRole('alertdialog', { name: '완성하지 않은 경기가 있습니다' }).count()
  check('ind-back-blocked', appDialog > 0 || backDialog === 'beforeunload', { appDialog, backDialog })
  if (appDialog) await confirmDialog(page, '완성하지 않은 경기가 있습니다', '계속 편집')
  check('ind-back-stays', new URL(page.url()).pathname === `/club-matches/${id}/setup/games`, page.url())
  // 앱 안 이동(머리글 나가기)은 앱 확인 창
  await page.getByRole('button', { name: '나가기(청백전 목록)' }).click()
  await confirmDialog(page, '완성하지 않은 경기가 있습니다', '계속 편집')
  check('ind-exit-blocked-stays', new URL(page.url()).pathname === `/club-matches/${id}/setup/games`)
  let unload = null
  page.once('dialog', async (d) => {
    unload = d.type()
    await d.dismiss()
  })
  await page.reload({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(500)
  check('ind-reload-beforeunload', unload === 'beforeunload', unload)
  await shot(page, `${MODE}-ind-partial-390.png`, true)
  const partialNo = (await cards(page).count())
  await page.getByRole('button', { name: `${partialNo}경기 삭제` }).click() // 미완성: 확인 없이
  check('ind-partial-delete-no-confirm', (await dialog(page).count()) === 0)
  return { view }
}

/** Mock 저장소 상세를 화면과 같은 모양으로 읽기(경기·총 경기 수만) */
async function mockView(page, id) {
  const m = await mockMatch(page, id)
  const names = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('smapsh.mock.db.v1'))
    return Object.fromEntries([...db.users.map((u) => [`member:${u.id}`, u.name]), ...(db.guests ?? []).map((g) => [`guest:${g.id}`, g.name])])
  })
  const p = (k) => ({ key: k, name: names[k] })
  return { totalGames: m.totalGames, version: m.version, status: m.status, games: m.games.map((g) => ({ ...g, team1: g.team1.map(p), team2: g.team2.map(p), relaxations: g.relaxations ?? [] })) }
}

async function individualApiExtras(page, id) {
  const A = api(page)
  // 같은 대진 반복: 1경기와 같은 경기를 추가 → 두 경기 모두 '운영진 수동 변경'
  let v = await A.get(`/api/club-matches/${id}`)
  const g = v.games[0]
  const rep = await A.send('POST', `/api/club-matches/${id}/games/manual`, { team1: g.team1.map((p) => p.key), team2: g.team2.map((p) => p.key), version: v.version })
  check('ind-repeat-allowed-api', rep.status === 200 && rep.body.games[0].repeatedMatchup && rep.body.games.at(-1).repeatedMatchup, rep.status)
  await page.reload()
  await waitSt(page, 'SCR-244-ST7')
  check('ind-repeat-badges', (await page.getByText('규칙 완화: 운영진 수동 변경').count()) >= 2)
  check('ind-reentry-no-method', (await page.getByRole('radio', { name: '자동 생성' }).getAttribute('aria-checked')) === 'false')
  // 편집 후 다시 생성: 확인 창 취소 → 그대로, 확인 → 기준값으로
  await page.getByRole('radio', { name: '자동 생성' }).click()
  await page.getByRole('button', { name: '다시 생성' }).click()
  await confirmDialog(page, '편집한 대진이 사라집니다', '취소')
  const before = (await A.get(`/api/club-matches/${id}`)).games.length
  check('ind-regen-cancel-keeps', before === v.games.length + 1)
  await page.getByRole('button', { name: '다시 생성' }).click()
  await confirmDialog(page, '편집한 대진이 사라집니다', '다시 생성')
  await page.waitForFunction(() => !document.querySelector('[aria-label="대진을 만드는 중"]'))
  await waitSt(page, 'SCR-244-ST7')
  v = await A.get(`/api/club-matches/${id}`)
  check('ind-regen-base', v.games.length === v.totalGames && !v.games.some((x) => x.manual), { n: v.games.length, t: v.totalGames })

  // 두 화면 동시 편집 → 충돌 → 최신 대진
  const p2 = await page.context().newPage()
  await p2.goto(`${BASE}/club-matches/${id}/setup/games`)
  await waitSt(p2, 'SCR-244-ST7')
  await p2.getByRole('button', { name: '1경기 삭제' }).click()
  await confirmDialog(p2, '1경기를 삭제할까요?', '삭제')
  await p2.waitForFunction((n) => document.querySelectorAll('li.su-game').length === n, v.games.length - 1)
  await p2.close()
  await page.getByRole('button', { name: '2경기 삭제' }).click()
  await confirmDialog(page, '2경기를 삭제할까요?', '삭제')
  await page.getByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' }).waitFor({ timeout: 6000 })
  check('ind-conflict-dialog', (await st(page)) === 'SCR-244-ST6')
  await page.getByRole('alertdialog').getByRole('button', { name: '확인' }).click()
  await page.waitForTimeout(500)
  const latest = await A.get(`/api/club-matches/${id}`)
  check('ind-conflict-redraw', (await cards(page).count()) === latest.games.length && latest.games.length === v.games.length - 1, { ui: await cards(page).count(), api: latest.games.length })

  // 0경기 → '직접 구성' 선택, 다음·확정 불가, 총 경기 수는 기준값 유지(제약 1–200)
  for (let n = latest.games.length; n > 0; n--) {
    await page.getByRole('button', { name: '1경기 삭제' }).click()
    await confirmDialog(page, '1경기를 삭제할까요?', '삭제')
    await page.waitForFunction((x) => document.querySelectorAll('li.su-game').length === x, n - 1)
  }
  await waitSt(page, 'SCR-244-ST10')
  v = await A.get(`/api/club-matches/${id}`)
  check('ind-zero-games', v.games.length === 0 && v.totalGames >= 1 && (await page.getByRole('radio', { name: '직접 구성' }).getAttribute('aria-checked')) === 'true', { t: v.totalGames })
  check('ind-zero-next-blocked', (await page.locator('[data-testid=su-next]').isDisabled()) && (await reason(page)).includes('대진이 없습니다'))
  const conf = await A.send('POST', `/api/club-matches/${id}/confirm`, { version: v.version })
  check('ind-zero-confirm-409', conf.status === 409 && conf.body.error.code === 'no_games', conf.status)
  await shot(page, `${MODE}-ind-zero-390.png`)
  // 직접 구성으로 다시 1경기 → 실제 경기 수 저장
  await page.locator('.su-empty').getByRole('button', { name: '경기 추가' }).click()
  await fill(page, 1)
  await page.waitForFunction(() => document.querySelectorAll('li.su-game:not([data-incomplete])').length === 1)
  v = await A.get(`/api/club-matches/${id}`)
  check('ind-direct-saved', v.games.length === 1 && v.totalGames === 1)
}

async function teamFlow(page, ids) {
  const A = api(page)
  const id = ids.team
  await page.goto(`${BASE}/club-matches/${id}/setup/games`)
  await waitSt(page, 'SCR-244-ST1')
  await page.getByRole('radio', { name: '직접 구성' }).click()
  await waitSt(page, 'SCR-244-ST10')
  let v = await A.get(`/api/club-matches/${id}`)
  const team = Object.fromEntries(v.rows.filter((r) => r.participating).map((r) => [r.name, r.team]))
  await page.locator('.su-empty').getByRole('button', { name: '경기 추가' }).click()
  await sheet(page).waitFor()
  const blueNames = await sheet(page).locator('button[data-cmp=CMP-044] .su-name').allTextContents()
  check('team-blue-slot-blue-only', blueNames.length > 0 && blueNames.every((n) => team[n] === 'blue'), blueNames)
  await pickOk(page)
  await page.getByRole('button', { name: /^1경기 백팀 빈 자리 선택$/ }).first().click()
  await sheet(page).waitFor()
  const whiteNames = await sheet(page).locator('button[data-cmp=CMP-044] .su-name').allTextContents()
  check('team-white-slot-white-only', whiteNames.every((n) => team[n] === 'white'), whiteNames)
  check('team-no-exchange-section', (await sheet(page).getByText('같은 경기 맞교환').count()) === 0)
  await pickOk(page)
  await fill(page, 1)
  await page.waitForFunction(() => document.querySelectorAll('li.su-game:not([data-incomplete])').length === 1)
  v = await A.get(`/api/club-matches/${id}`)
  const g = v.games[0]
  check('team-direct-saved', v.games.length === 1 && g.team1.every((p) => team[p.name] === 'blue') && g.team2.every((p) => team[p.name] === 'white'))
  await shot(page, `${MODE}-team-direct-390.png`)

  // 항상 막는 규칙(서버)
  const blue = v.rows.filter((r) => r.team === 'blue').map((r) => r.key)
  const white = v.rows.filter((r) => r.team === 'white').map((r) => r.key)
  const post = (body) => A.send('POST', `/api/club-matches/${id}/games/manual`, { ...body, version: v.version })
  const codeOf = (x) => `${x.status} ${x.body?.error?.code}`
  check('team-rule-team-violation', codeOf(await post({ team1: [blue[0], white[0]], team2: [white[1], white[2]] })) === '422 team_violation')
  check('team-rule-duplicate', codeOf(await post({ team1: [blue[0], blue[0]], team2: [white[1], white[2]] })) === '422 duplicate_player')
  check('team-rule-not-eligible', codeOf(await post({ team1: [blue[0], ids.outsider], team2: [white[1], white[2]] })) === '422 not_eligible')
  check('team-rule-exchange', codeOf(await A.send('POST', `/api/club-matches/${id}/games/1/exchange`, { out: g.team1[0].key, in: g.team2[0].key, version: v.version })) === '422 exchange_not_allowed')
  // 참가자 변경 시 대진 폐기 확인(기존 규칙 유지)
  const drop = await A.send('PUT', `/api/club-matches/${id}/participants`, { keys: ids.keys.slice(0, 7), version: v.version })
  check('team-participants-confirm-required', codeOf(drop) === '409 confirm_required')
  // 두 번째 경기(API) → 확정 단계 요약 → 확정
  v = (await post({ team1: [blue[2], blue[3]], team2: [white[2], white[3]] })).body
  check('team-second-game', v.games.length === 2 && v.totalGames === 2)
  await page.goto(`${BASE}/club-matches/${id}/setup/confirm`)
  await waitSt(page, 'SCR-245-ST1')
  check('team-confirm-summary-actual', (await page.getByRole('region', { name: '대진' }).textContent()).includes('2경기'))
  await page.locator('[data-testid=su-next]').click()
  await confirmDialog(page, '대진을 확정하고 회원에게 공개할까요?', '확정')
  await page.waitForURL((u) => u.pathname === `/club-matches/${id}`)
  v = await A.get(`/api/club-matches/${id}`)
  check('team-confirmed', v.status === 'confirmed')
  // 확정 후: 추가·삭제·맞교환·폐기 거부, 교체 시트는 교체만
  check('post-add-locked', codeOf(await post({ team1: [blue[0], blue[1]], team2: [white[0], white[1]] })) === '409 locked')
  check('post-delete-locked', codeOf(await A.send('DELETE', `/api/club-matches/${id}/games/1?version=${v.version}`)) === '409 locked')
  check('post-discard-locked', codeOf(await A.send('DELETE', `/api/club-matches/${id}/games?version=${v.version}`)) === '409 locked')
  check('post-exchange-locked', codeOf(await A.send('POST', `/api/club-matches/${id}/games/1/exchange`, { out: g.team1[0].key, in: g.team2[0].key, version: v.version })) === '409 locked')
  await page.waitForSelector('[data-testid=ops-area] [data-cmp=CMP-041]')
  await page.locator('[data-testid=ops-area] button[aria-label$=교체]').first().click()
  await sheet(page).waitFor()
  check('post-sheet-st7', (await sheet(page).locator('[data-scr=SCR-225]').getAttribute('data-st')) === 'SCR-225-ST7')
  check('post-sheet-replace-only', (await sheet(page).getByText('같은 경기 맞교환').count()) === 0 && (await sheet(page).getByText('다른 참가자와 교체').count()) === 1)
  await shot(page, `${MODE}-post-confirm-sheet-390.png`)
  await sheet(page).getByRole('button', { name: '닫기' }).click()
}

async function widths(page, id) {
  // 편집기·시트를 여러 폭에서: 가로 넘침 0, 완성 카드 높이(Preview r9 146px) 이하
  for (const [w, h, m] of [[360, 640, true], [390, 844, true], [1440, 900, false], [195, 422, false]]) {
    const ctx = await browser.newContext({ ...ctxOpts(w, h, m), storageState: await page.context().storageState() })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/club-matches/${id}/setup/games${MODE === 'mock' ? '?as=admin' : ''}`)
    await p.waitForSelector('li.su-game', { timeout: 8000 }).catch(() => {})
    // 배지 없는 완성 카드는 Preview r9 기준 146px 이하, 규칙 완화 배지가 있는 카드는 승인본(r8)의 규칙 완화 카드 172px 이하
    const heights = await p.evaluate(() => [...document.querySelectorAll('li.su-game:not([data-incomplete]):not(:has(.su-relax))')].map((e) => Math.round(e.getBoundingClientRect().height)))
    const badged = await p.evaluate(() => [...document.querySelectorAll('li.su-game:not([data-incomplete]):has(.su-relax)')].map((e) => Math.round(e.getBoundingClientRect().height)))
    report.info[`w${w}-card-heights`] = { plain: [...new Set(heights)], badged: [...new Set(badged)] }
    if (w >= 360 && badged.length) check(`w${w}-badged-card-height`, Math.max(...badged) <= 172, badged.slice(0, 5))
    // 200% 확대(195)는 B14가 바꾼 영역(대진 카드·경기 추가)의 넘침을 보고, 페이지 전체 폭은 정보로 남김(하단 바는 B11 부품)
    const over = await p.evaluate(() => [...document.querySelectorAll('li.su-game, li.su-game *, .su-add, .su-tiles, .su-stats')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length)
    report.info[`w${w}-page-scrollWidth`] = await p.evaluate(() => document.documentElement.scrollWidth)
    check(`w${w}-editor-no-overflow`, over === 0, over)
    if (w >= 360) check(`w${w}-no-hscroll`, !(await hScroll(p)))
    if (w >= 360) check(`w${w}-card-height`, heights.length > 0 && Math.max(...heights) <= 146, heights.slice(0, 5))
    await shot(p, `${MODE}-games-${w}.png`)
    const slot = p.getByRole('button', { name: /^1경기 .* 교체$/ }).first()
    if (await slot.count()) {
      await slot.click()
      await p.locator('[data-testid=club-swap-sheet]').waitFor()
      const sOver = await p.evaluate(() => [...document.querySelectorAll('[data-testid=club-swap-sheet] *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length)
      check(`w${w}-sheet-no-overflow`, sOver === 0, sOver)
      await shot(p, `${MODE}-sheet-${w}.png`)
    }
    await ctx.close()
  }
}

const ctx = await browser.newContext(ctxOpts(390, 844, true))
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && !EXPECTED_HTTP.test(m.text()) && report.errors.push(m.text().slice(0, 200)))
page.on('pageerror', (e) => report.errors.push(String(e).slice(0, 200)))
await login(page)
if (MODE === 'api') {
  const ids = await prepare(page)
  report.info.ids = { ind: ids.ind, team: ids.team }
  await individualFlow(page, ids.ind)
  await individualApiExtras(page, ids.ind)
  await teamFlow(page, ids)
  // 폭 확인용: 여러 경기가 있는 개인전 하나 더
  const A = api(page)
  const c = await A.send('POST', '/api/club-matches', { method: 'individual', date: '2026-12-21', name: `편집 폭 ${RUN}` })
  let v = await A.get(`/api/club-matches/${c.body.id}`)
  v = (await A.send('PUT', `/api/club-matches/${c.body.id}/participants`, { keys: ids.keys, version: v.version })).body
  await A.send('POST', `/api/club-matches/${c.body.id}/games`, { totalGames: 8, rules: { balance: true, gender: true }, version: v.version })
  report.info.ids.widths = c.body.id
  await widths(page, c.body.id)
} else {
  // Mock 샘플의 준비 중 청백전(cm-2)
  await individualFlow(page, 'cm-2')
  await widths(page, 'cm-2')
}
check('no-console-errors', report.errors.length === 0, report.errors)
await browser.close()
if (blocked) reportBlocked(blocked)
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ mode: MODE, checks: Object.keys(report.checks).length, fails, info: report.info }, null, 1))
console.log(fails.length ? `FAILED: ${fails.join(', ')}` : 'ALL CHECKS PASSED')
