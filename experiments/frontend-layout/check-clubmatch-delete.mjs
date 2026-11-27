// (CP-001, B19) 청백전 삭제 실제 API E2E — 기획 r15 C-32·AC-134·AC-166, UX Spec SCR-241-ST10·SCR-112-ST25, UXD-114, VD-068 CP-001 항목
// 실제 API 모드 Vite(BASE, 기본 http://localhost:5174) + APP_ENV=e2e 백엔드 + 임시 PostgreSQL(e2e-guard가 확인)
//   운영진: 준비 중(생성 페이지 더보기 메뉴) 삭제 — 취소·확인·목록+토스트 / 진행 예정(상세 더보기 메뉴) 삭제 — 이름 있는 확인 창·목록+토스트·명단 회원 보존
//   진행 중(지난 날짜·결과 있음)·종료·운영 이력(경기 취소)에는 메뉴 없음 + 서버 409 locked / 회원: 메뉴 없음 + 서버 403
//   두 화면 동시 조작: 다른 화면이 결과를 먼저 기록하면 이 화면의 삭제는 충돌 창, 청백전은 남음
//   폭: 진행 예정 상세(메뉴 열림·확인 창) 360·390·1440·200% 가로 넘침, 메뉴 항목 높이 44
// 사용: DEV_ADMIN_PASSWORD=… E2E_BACKEND=http://localhost:8011 PSQL_ARGS="-h 127.0.0.1 -p 55433 -U app smapsh_e2e" OUT=<저장소 밖 결과 폴더> node experiments/frontend-layout/check-clubmatch-delete.mjs
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { assertE2ETarget, assertTestPsqlArgs, guardBrowser, reportBlocked } from './e2e-guard.mjs'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5174'
const OUT = process.env.OUT || path.join(here, 'results/clubmatch-delete')
fs.mkdirSync(OUT, { recursive: true })
const PASSWORD = process.env.DEV_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('DEV_ADMIN_PASSWORD 환경변수가 필요합니다')
const PSQL_ARGS = process.env.PSQL_ARGS
if (!PSQL_ARGS) throw new Error('PSQL_ARGS 환경변수가 필요합니다(임시 테스트 DB)')
assertTestPsqlArgs(PSQL_ARGS)
await assertE2ETarget(BASE)
const psql = (sql) => execFileSync(process.env.PSQL || 'psql', [...PSQL_ARGS.split(' '), '-Atc', sql]).toString().trim()
const RUN = Date.now().toString(36).slice(-4)
const EXPECTED_HTTP = /status of (401|403|404|409|422)|net::ERR_FAILED/
const report = { run: RUN, checks: {}, info: {}, errors: [] }
const fails = []
const check = (name, ok, info) => {
  report.checks[name] = ok ? 'pass' : `FAIL ${info === undefined ? '' : JSON.stringify(info).slice(0, 400)}`
  if (!ok) fails.push(name)
}
const shot = (page, f, full = false) => page.screenshot({ path: path.join(OUT, f), fullPage: full })
const hScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
const seen = (loc, timeout = 6000) => loc.waitFor({ timeout }).then(() => true, () => false)

const browser = await chromium.launch()
const blocked = guardBrowser(browser, BASE)
const ctxOpts = (w, h, m) => ({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m, locale: 'ko-KR' })

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
  get: async (p) => {
    const r = await page.request.get(BASE + p)
    return { status: r.status(), body: await r.json().catch(() => null) }
  },
  send: async (method, p, data) => {
    const res = await page.request.fetch(BASE + p, { method, data, headers: { Origin: BASE } })
    return { status: res.status(), body: res.status() === 204 ? null : await res.json().catch(() => null) }
  },
})

async function prepare(page) {
  const A = api(page)
  const seed = parseInt(RUN, 36)
  const syl = (n) => String.fromCharCode(0xac00 + (n % 11172))
  const names = Array.from({ length: 8 }, (_, i) => `${'김이박최정강조윤'[i]}${syl(seed * 7 + i * 211)}${syl(seed * 13 + i * 401)}`)
  for (const [i, name] of names.entries()) await A.send('POST', '/api/roster/members', { name, gender: i % 2 ? '여' : '남', grade: 'C조', score: 2 + i })
  const roster = (await A.get('/api/roster')).body.members
  const keys = names.map((n) => `member:${roster.find((m) => m.name === n).id}`)
  const token = crypto.randomBytes(24).toString('hex')
  const mid = psql(`INSERT INTO users (id, name, gender, grade, role, status) VALUES (gen_random_uuid(), '회원${syl(seed * 3)}', '남', 'C조', 'member', 'approved') RETURNING id`).split('\n')[0]
  psql(`INSERT INTO auth_sessions (id, token_hash, user_id, expires_at) VALUES (gen_random_uuid(), encode(sha256('${token}'::bytea), 'hex'), '${mid}', now() + interval '1 day')`)
  return { keys, names, token }
}
/** 확정된 라운드 기반 개인전(코트 2·2라운드). date로 진행 예정/진행 중을 정함 */
async function confirmed(page, keys, name, date) {
  const A = api(page)
  const id = (await A.send('POST', '/api/club-matches', { method: 'individual', date, name, courtCount: 2 })).body.id
  let v = (await A.get(`/api/club-matches/${id}`)).body
  v = (await A.send('PUT', `/api/club-matches/${id}/participants`, { keys, version: v.version })).body
  v = (await A.send('POST', `/api/club-matches/${id}/games`, { version: v.version, rounds: 2, rules: { balance: true, gender: true } })).body
  v = (await A.send('POST', `/api/club-matches/${id}/confirm`, { version: v.version })).body
  return v
}
const openMore = async (page) => {
  await page.getByRole('button', { name: '더보기' }).click()
  return page.getByRole('menuitem', { name: '청백전 삭제' })
}

async function flows(page, mctx, data) {
  const A = api(page)
  const F = '2099-12-31'
  // ── 준비 중: 생성 페이지 더보기 메뉴 ──
  const draftId = (await A.send('POST', '/api/club-matches', { method: 'team', date: F, name: `준비 삭제 ${RUN}`, courtCount: 2 })).body.id
  await page.goto(`${BASE}/club-matches/${draftId}/setup/basic`)
  await page.locator('.su[data-st="SCR-241-ST8"]').waitFor()
  let item = await openMore(page)
  check('draft-menu-danger', (await item.getAttribute('data-tone')) === 'danger')
  await shot(page, 'draft-menu.png')
  await item.click()
  // 이름 끝 글자에 따라 조사(을/를/을(를))가 붙음
  check('draft-dialog-named', await seen(page.getByRole('alertdialog', { name: new RegExp(`^'준비 삭제 ${RUN}'(을|를|을\\(를\\)) 삭제할까요\\?$`) })))
  const dlg = page.getByRole('alertdialog')
  await dlg.getByRole('button', { name: '취소' }).click()
  check('draft-cancel-keeps', (await A.get(`/api/club-matches/${draftId}`)).status === 200)
  await (await openMore(page)).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제' }).click()
  await page.waitForURL(`${BASE}/club-matches`)
  check('draft-deleted-toast', await seen(page.locator('[data-cmp=CMP-029]', { hasText: '청백전을 삭제했습니다' })))
  check('draft-gone', (await A.get(`/api/club-matches/${draftId}`)).status === 404)

  // ── 진행 예정: 상세 더보기 메뉴 ──
  const up = await confirmed(page, data.keys, `예정 삭제 ${RUN}`, F)
  check('upcoming-round1', up.status === 'confirmed' && up.currentRound === 1)
  await page.goto(`${BASE}/club-matches/${up.id}`)
  await page.getByTestId('ops-area').waitFor()
  check('upcoming-badge', (await page.getByTestId('detail-badges').textContent()).includes('진행 예정'))
  item = await openMore(page)
  check('upcoming-menu-danger', (await item.getAttribute('data-tone')) === 'danger')
  await item.click()
  check('upcoming-dialog-ST25', (await seen(page.getByRole('alertdialog'))) && (await page.getByTestId('ops-area').getAttribute('data-st')) === 'SCR-112-ST25')
  check('upcoming-dialog-text', (await page.getByRole('alertdialog').textContent()).includes('참가자와 대진도 함께 지워지고 되돌릴 수 없습니다') && (await page.getByRole('alertdialog').textContent()).includes(`'예정 삭제 ${RUN}'`))
  await shot(page, 'upcoming-dialog.png')
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제' }).click()
  await page.waitForURL(`${BASE}/club-matches`)
  check('upcoming-deleted-toast', await seen(page.locator('[data-cmp=CMP-029]', { hasText: '청백전을 삭제했습니다' })))
  check('upcoming-gone', (await A.get(`/api/club-matches/${up.id}`)).status === 404)
  const roster = (await A.get('/api/roster')).body.members
  check('roster-members-kept', data.names.every((n) => roster.some((m) => m.name === n && m.score !== null)))

  // ── 삭제 불가: 진행 중(지난 날짜)·진행 중(결과)·종료·이력 ──
  const past = await confirmed(page, data.keys, `지남 ${RUN}`, '2026-11-15')
  let rec = await confirmed(page, data.keys, `결과 ${RUN}`, F)
  rec = (await A.send('PUT', `/api/club-matches/${rec.id}/games/1/result`, { winner: 1, version: rec.version })).body
  let fin = await confirmed(page, data.keys, `종료 ${RUN}`, '2026-11-15')
  for (let r = 1; r <= 2; r++) {
    for (const g of fin.games.filter((x) => x.round === r)) fin = (await A.send('PUT', `/api/club-matches/${fin.id}/games/${g.no}/result`, { winner: 1, version: fin.version })).body
    if (r === 1) fin = (await A.send('POST', `/api/club-matches/${fin.id}/rounds/next`, { version: fin.version })).body
  }
  fin = (await A.send('POST', `/api/club-matches/${fin.id}/finish`, { version: fin.version })).body
  let hist = await confirmed(page, data.keys, `이력 ${RUN}`, F)
  const leaver = hist.games[0].team1[0].key
  hist = (await A.send('POST', `/api/club-matches/${hist.id}/participants/${encodeURIComponent(leaver)}/leave`, { assignments: [], cancel: hist.games.filter((g) => [...g.team1, ...g.team2].some((p) => p.key === leaver)).map((g) => g.no), version: hist.version })).body
  check('setup-blocked-states', fin.status === 'finished' && hist.games.some((g) => g.cancelled), { fin: fin.status })
  for (const [tag, v] of [['live-date', past], ['live-result', rec], ['finished', fin], ['history', hist]]) {
    await page.goto(`${BASE}/club-matches/${v.id}`)
    await page.getByTestId('ops-area').waitFor()
    await page.waitForTimeout(200)
    check(`${tag}-no-menu`, (await page.getByRole('button', { name: '더보기' }).count()) === 0)
    const r = await A.send('DELETE', `/api/club-matches/${v.id}?version=${v.version}`)
    check(`${tag}-server-locked`, r.status === 409 && r.body?.error?.code === 'locked' && (await A.get(`/api/club-matches/${v.id}`)).status === 200, r)
  }

  // ── 회원: 메뉴 없음 + 서버 403 ──
  const mem = await confirmed(page, data.keys, `회원 ${RUN}`, F)
  const mp = await mctx.newPage()
  await mp.goto(`${BASE}/club-matches/${mem.id}`)
  await mp.getByTestId('public-area').waitFor()
  check('member-no-menu', (await mp.getByRole('button', { name: '더보기' }).count()) === 0)
  const mr = await api(mp).send('DELETE', `/api/club-matches/${mem.id}?version=${mem.version}`)
  check('member-server-403', mr.status === 403 && (await A.get(`/api/club-matches/${mem.id}`)).status === 200, mr)
  await mp.close()

  // ── 두 화면 동시 조작: 다른 화면이 먼저 결과 기록 → 이 화면의 삭제는 충돌 ──
  const race = await confirmed(page, data.keys, `경합 ${RUN}`, F)
  await page.goto(`${BASE}/club-matches/${race.id}`)
  await page.getByTestId('ops-area').waitFor()
  await (await openMore(page)).click()
  await A.send('PUT', `/api/club-matches/${race.id}/games/1/result`, { winner: 1, version: race.version })
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제' }).click()
  check('race-conflict-dialog', await seen(page.getByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })))
  check('race-kept', (await A.get(`/api/club-matches/${race.id}`)).status === 200 && page.url() === `${BASE}/club-matches/${race.id}`)
  await page.getByRole('alertdialog').getByRole('button', { name: '확인' }).click()
  await page.waitForTimeout(500)
  check('race-menu-gone-after-refresh', (await page.getByRole('button', { name: '더보기' }).count()) === 0)
  return { layoutId: (await confirmed(page, data.keys, `밀도 ${RUN}`, F)).id }
}

async function layout(page, id) {
  const storage = await page.context().storageState()
  for (const [name, w, h, m] of [['m390', 390, 844, true], ['m360', 360, 640, true], ['d1440', 1440, 900, false], ['z200', 195, 422, true]]) {
    const ctx = await browser.newContext({ ...ctxOpts(w, h, m), storageState: storage })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/club-matches/${id}`)
    await p.getByTestId('ops-area').waitFor()
    await p.waitForTimeout(300)
    check(`overflow-detail-${name}`, !(await hScroll(p)))
    const it = await openMore(p)
    await it.waitFor()
    const ih = await it.evaluate((e) => Math.round(e.getBoundingClientRect().height))
    check(`menu-item-44-${name}`, ih >= 44, ih)
    check(`overflow-menu-${name}`, !(await hScroll(p)))
    await shot(p, `layout-menu-${name}.png`)
    await it.click()
    await p.getByRole('alertdialog').waitFor()
    check(`overflow-dialog-${name}`, !(await hScroll(p)))
    await shot(p, `layout-dialog-${name}.png`)
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
  const mctx = await browser.newContext(ctxOpts(390, 844, true))
  await mctx.addCookies([{ name: 'smapsh_session', value: data.token, url: BASE, httpOnly: true, sameSite: 'Lax' }])
  await mctx.addInitScript(() => localStorage.setItem('smapsh.introSeen.v1', '1'))
  const { layoutId } = await flows(page, mctx, data)
  await layout(page, layoutId)
} catch (e) {
  report.errors.push(String(e?.stack ?? e))
  await shot(page, 'error.png', true).catch(() => {})
}
await browser.close()
reportBlocked(blocked)
check('outside-base-requests-0', blocked.length === 0, blocked.slice(0, 3))
check('console-errors-0', report.errors.length === 0, report.errors.slice(0, 3))
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ fails, errors: report.errors.slice(0, 3), total: Object.keys(report.checks).length }, null, 1))
process.exit(fails.length ? 1 : 0)
