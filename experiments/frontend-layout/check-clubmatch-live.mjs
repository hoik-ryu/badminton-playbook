// (B17, r14) 청백전 라운드 진행 실제 API E2E — SCR-112 ST16–ST24 · SCR-226 ST1·ST4·ST8 · SCR-225 ST7·ST13 · 회원 취소 표시 · 마이페이지 전적
// 실제 API 모드 Vite(BASE, 기본 http://localhost:5174) + APP_ENV=e2e 백엔드 + 임시 PostgreSQL(e2e-guard가 확인). 생성 화면(B16)은 check-clubmatch-rounds.mjs
//   개인전(9명)·팀전(10명) 각각 코트 2·3라운드: 확정(토스트 '1라운드를 시작했습니다') → 시작 전 잠금·서버 거부(round_not_started)
//   → 1라운드 결과 → 다음 라운드(토스트) → 지난 라운드 되돌리기 거부(round_locked)·접힘 → 라운드 시작 취소·다시 시작 → 새로고침 유지
//   → 두 화면 동시 조작 충돌 → 중도 귀가 ①(그 라운드 휴식자로 대체, 같은 라운드 출전자 후보 없음) ②(대체 불가 → '이 경기 취소' 체크 → 취소)
//   → 회원 계정: '취소' 배지·다음 경기 제외 → 마지막 라운드까지 진행 → 종료 조건 사유 → 종료 → 회원 마이페이지 전적(취소 경기 제외)
//   폭: 진행 화면 360·390·1440·200%(195×422) 가로 넘침, VD-086(진행 카드 ≤ 140, 진행 구역 첫 카드가 첫 화면에), 누름 영역 44
// 사용: DEV_ADMIN_PASSWORD=… E2E_BACKEND=http://localhost:8011 PSQL_ARGS="-h 127.0.0.1 -p 55433 -U app smapsh_e2e" OUT=<저장소 밖 결과 폴더> node experiments/frontend-layout/check-clubmatch-live.mjs
//   PSQL_ARGS: 회원 세션을 임시 DB에 직접 만듦(e2e-guard가 포트 5432·보호 DB 이름이면 중단). 비밀번호는 환경변수로만
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
const OUT = process.env.OUT || path.join(here, 'results/clubmatch-live')
fs.mkdirSync(OUT, { recursive: true })
const PASSWORD = process.env.DEV_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('DEV_ADMIN_PASSWORD 환경변수가 필요합니다')
const PSQL_ARGS = process.env.PSQL_ARGS
if (!PSQL_ARGS) throw new Error('PSQL_ARGS 환경변수가 필요합니다(임시 테스트 DB)')
assertTestPsqlArgs(PSQL_ARGS)
await assertE2ETarget(BASE) // APP_ENV=e2e 백엔드(임시 DB)가 아니면 중단
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
  get: async (p) => (await page.request.get(BASE + p)).json(),
  send: async (method, p, data) => {
    const res = await page.request.fetch(BASE + p, { method, data, headers: { Origin: BASE } })
    return { status: res.status(), body: res.status() === 204 ? null : await res.json().catch(() => null) }
  },
})
const keysOf = (g) => [...g.team1, ...g.team2].map((p) => p.key)
const processed = (g) => g.winner !== null || g.cancelled !== null
/** 라운드 규칙: 같은 라운드 중복 출전 0(취소 경기 제외) */
const noRoundDup = (v) => [...new Set(v.games.map((g) => g.round))].every((r) => {
  const ks = v.games.filter((g) => g.round === r && !g.cancelled).flatMap(keysOf)
  return new Set(ks).size === ks.length
})

// ── 준비: 점수 있는 회원(이름 겹치지 않게) + 실제 회원 세션 1명(참가자) ──
async function prepare(page) {
  const A = api(page)
  const seed = parseInt(RUN, 36)
  const syl = (n) => String.fromCharCode(0xac00 + (n % 11172))
  const names = Array.from({ length: 10 }, (_, i) => `${'김이박최정강조윤장한'[i]}${syl(seed * 5 + i * 197)}${syl(seed * 11 + i * 389)}`)
  for (const [i, name] of names.entries()) await A.send('POST', '/api/roster/members', { name, gender: i % 2 ? '여' : '남', grade: 'C조', score: 2 + (i % 8) })
  // 회원 세션: 임시 DB에 승인 회원·세션을 직접 만듦(카카오 로그인 대신)
  const token = crypto.randomBytes(24).toString('hex')
  const memberName = `회원${syl(seed * 3)}${syl(seed * 17)}`
  const mid = psql(`INSERT INTO users (id, name, gender, grade, role, status) VALUES (gen_random_uuid(), '${memberName}', '남', 'C조', 'member', 'approved') RETURNING id`).split('\n')[0]
  psql(`INSERT INTO auth_sessions (id, token_hash, user_id, expires_at) VALUES (gen_random_uuid(), encode(sha256('${token}'::bytea), 'hex'), '${mid}', now() + interval '1 day')`)
  await A.send('PUT', `/api/roster/members/${mid}/score`, { score: 6, previous: null })
  const roster = (await A.get('/api/roster')).members
  const keys = names.map((n) => `member:${roster.find((m) => m.name === n).id}`)
  return { keys, member: { id: mid, key: `member:${mid}`, name: memberName, token } }
}

async function makeDraft(page, method, people, name) {
  const A = api(page)
  const id = (await A.send('POST', '/api/club-matches', { method, date: '2026-12-27', name, courtCount: 2 })).body.id
  let v = await A.get(`/api/club-matches/${id}`)
  v = (await A.send('PUT', `/api/club-matches/${id}/participants`, { keys: people, version: v.version })).body
  if (method === 'team') v = (await A.send('PUT', `/api/club-matches/${id}/teams`, { assignments: Object.fromEntries(people.map((k, i) => [k, i % 2 ? 'white' : 'blue'])), version: v.version })).body
  await A.send('POST', `/api/club-matches/${id}/games`, { version: v.version, rounds: 3, rules: { balance: true, gender: true } })
  return id
}

const ops = (page) => page.locator('[data-testid=ops-area]')
const opsCard = (page, no) => ops(page).locator(`article[data-game="${no}"]`)
const progress = (page) => page.locator('[data-testid=round-progress]')
const toastSeen = (page, text) => seen(page.locator('[data-cmp=CMP-029]', { hasText: text }), 6000)
async function recordUI(page, method, no, side = 1) {
  const label = method === 'team' ? (side === 1 ? '청 승' : '백 승') : `${side}팀 승`
  const btn = opsCard(page, no).getByRole('group', { name: `${no}경기 결과` }).getByRole('button', { name: label })
  await btn.click()
  await page.waitForFunction((n) => document.querySelector(`[data-testid=ops-area] article[data-game="${n}"]`)?.getAttribute('data-recorded') === 'true', no, { timeout: 8000 })
}
async function waitRound(page, r) {
  await page.waitForFunction((x) => document.querySelector('[data-testid=round-progress] h2')?.textContent === `${x}라운드 진행 중`, r, { timeout: 8000 })
}

// ── 한 방식의 전체 진행 ──
async function liveFlow(page, mctx, data, method) {
  const A = api(page)
  const tag = method === 'team' ? 'team' : 'ind'
  const people = method === 'team' ? [data.member.key, ...data.keys.slice(0, 9)] : [data.member.key, ...data.keys.slice(0, 8)]
  const id = await makeDraft(page, method, people, `라운드 진행 ${tag} ${RUN}`)
  // 확정(생성 페이지 SCR-245) → 상세 토스트 '1라운드를 시작했습니다'
  await page.goto(`${BASE}/club-matches/${id}/setup/confirm`)
  await page.locator('.su[data-st="SCR-245-ST1"]').waitFor()
  await page.locator('[data-testid=su-next]').click()
  await page.getByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' }).getByRole('button', { name: '확정' }).click()
  await page.waitForURL(`${BASE}/club-matches/${id}`)
  check(`${tag}-confirm-toast`, await toastSeen(page, '1라운드를 시작했습니다'))
  await progress(page).waitFor()
  check(`${tag}-ST16-round1`, (await progress(page).locator('h2').textContent()) === '1라운드 진행 중')
  let v = await A.get(`/api/club-matches/${id}`)
  const round = (r) => v.games.filter((g) => g.round === r)
  // 시작 전 라운드: 결과 버튼 없음 + '시작 전'. 서버도 거부(round_not_started)
  const fut = round(2)[0]
  check(`${tag}-ST20-locked-ui`, (await opsCard(page, fut.no).getByLabel('시작 전, 결과를 기록할 수 없음').count()) === 1 && (await opsCard(page, fut.no).getByRole('group', { name: `${fut.no}경기 결과` }).count()) === 0)
  const nr = await A.send('PUT', `/api/club-matches/${id}/games/${fut.no}/result`, { winner: 1, version: v.version })
  check(`${tag}-ST20-server-refuses`, nr.status === 409 && nr.body?.error?.code === 'round_not_started', nr)
  // ST18: 남은 경기 → 다음 라운드 비활성
  check(`${tag}-ST18-next-disabled`, await page.locator('[data-testid=next-round]').isDisabled())
  await shot(page, `${tag}-ST16.png`)
  // 1라운드 결과 → ST17 활성(자동으로 넘어가지 않음) → 다음 라운드
  for (const g of round(1)) await recordUI(page, method, g.no, 1)
  await page.waitForFunction(() => !document.querySelector('[data-testid=next-round]')?.hasAttribute('disabled'), null, { timeout: 8000 })
  check(`${tag}-ST17-no-auto`, (await A.get(`/api/club-matches/${id}`)).currentRound === 1)
  await page.locator('[data-testid=next-round]').click()
  await waitRound(page, 2)
  check(`${tag}-next-toast`, await toastSeen(page, '2라운드를 시작했습니다'))
  v = await A.get(`/api/club-matches/${id}`)
  check(`${tag}-server-round2`, v.currentRound === 2)
  // 지난 라운드: 접힘, 펼치면 되돌리기 없음. 서버도 되돌리기 거부(round_locked)
  check(`${tag}-ST21-folded`, (await opsCard(page, round(1)[0].no).count()) === 0)
  await page.getByRole('button', { name: '1라운드 펼치기' }).click()
  check(`${tag}-ST21-no-revert`, (await opsCard(page, round(1)[0].no).getByRole('button', { name: '미기록으로 되돌리기' }).count()) === 0)
  const rl = await A.send('PUT', `/api/club-matches/${id}/games/${round(1)[0].no}/result`, { winner: null, version: v.version })
  check(`${tag}-ST21-server-refuses`, rl.status === 409 && rl.body?.error?.code === 'round_locked', rl)
  // 라운드 시작 취소(ST19) → 1라운드 → 다시 시작
  await page.locator('[data-testid=undo-round]').click()
  await page.getByRole('alertdialog', { name: '2라운드 시작을 취소하고 1라운드로 돌아갈까요?' }).getByRole('button', { name: '시작 취소' }).click()
  await waitRound(page, 1)
  check(`${tag}-ST19-undo`, (await toastSeen(page, '2라운드 시작을 취소했습니다')) && (await A.get(`/api/club-matches/${id}`)).currentRound === 1)
  await page.locator('[data-testid=next-round]').click()
  await waitRound(page, 2)
  // 새로고침해도 진행 라운드 유지
  await page.reload()
  await progress(page).waitFor()
  check(`${tag}-reload-keeps`, (await progress(page).locator('h2').textContent()) === '2라운드 진행 중')
  // 두 화면 동시 조작: 다른 화면이 2라운드 결과를 먼저 기록 → 이 화면의 '라운드 시작 취소'는 충돌 창
  const other = await page.context().newPage()
  await other.goto(`${BASE}/club-matches/${id}`)
  await progress(other).waitFor()
  await recordUI(other, method, round(2)[0].no, 2)
  await other.close()
  await page.locator('[data-testid=undo-round]').click()
  await page.getByRole('alertdialog', { name: '2라운드 시작을 취소하고 1라운드로 돌아갈까요?' }).getByRole('button', { name: '시작 취소' }).click()
  check(`${tag}-ST6-conflict`, await seen(page.getByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })))
  await page.getByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' }).getByRole('button', { name: '확인' }).click()
  check(`${tag}-conflict-kept`, (await A.get(`/api/club-matches/${id}`)).currentRound === 2)
  await waitRound(page, 2)

  // 중도 귀가 ①: 2라운드 미기록 경기의 사람 → 대체(그 라운드 휴식자만 후보)
  v = await A.get(`/api/club-matches/${id}`)
  const openG = v.games.find((g) => g.round === 2 && !processed(g))
  const leaverTeam = method === 'team' ? 'blue' : null
  const rowOf = (k) => v.rows.find((r) => r.key === k)
  const leaver1 = keysOf(openG).find((k) => k !== data.member.key && (!leaverTeam || rowOf(k).team === leaverTeam))
  await page.locator('[data-testid=open-participants]').click()
  const panel = page.locator('[data-testid=participants-sheet]')
  await panel.waitFor()
  await panel.locator(`li[data-participant="${leaver1}"]`).getByRole('button', { name: '이후 대진에서 제외' }).click()
  const sub = page.locator('[data-testid=substitute-sheet]')
  await sub.waitFor()
  check(`${tag}-ST1-state`, (await sub.locator('[data-scr=SCR-226]').getAttribute('data-st')) === 'SCR-226-ST1')
  const rem1 = v.games.filter((g) => !processed(g) && keysOf(g).includes(leaver1))
  let candOk = true
  for (const g of rem1) {
    const rowBtn = sub.getByRole('button', { name: new RegExp(`^${g.no}경기, ${g.round}라운드 코트 ${g.court}, 대체: `) })
    if (!(await rowBtn.count())) { candOk = false; break }
    await rowBtn.click()
    const busy = v.games.filter((x) => x.round === g.round && x.no !== g.no && !x.cancelled).flatMap(keysOf).map((k) => rowOf(k).name)
    const shown = await sub.locator('ul[data-cmp=CMP-044] button').allTextContents()
    if (shown.some((t) => busy.some((n) => t.startsWith(n)))) candOk = false
    await rowBtn.click()
  }
  check(`${tag}-ST1-round-candidates`, candOk)
  await shot(page, `${tag}-226-ST1.png`)
  await sub.getByRole('button', { name: '반영' }).click()
  await sub.waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
  v = await A.get(`/api/club-matches/${id}`)
  check(`${tag}-leave1-substituted`, rowOf(leaver1) && v.rows.find((r) => r.key === leaver1).left && !v.games.some((g) => g.cancelled) && noRoundDup(v), { cancelled: v.games.filter((g) => g.cancelled).length })

  // 중도 귀가 ②: 남은 사람이 모두 출전 → 대체 불가 → '이 경기 취소' 체크(ST8). 회원이 나오는 경기의 사람을 고름
  const memberOpen = v.games.filter((g) => !processed(g) && keysOf(g).includes(data.member.key))
  const leaver2 = memberOpen.flatMap(keysOf).find((k) => k !== data.member.key && k !== leaver1 && !v.rows.find((r) => r.key === k).left && (!leaverTeam || v.rows.find((r) => r.key === k).team === leaverTeam))
  await panel.locator(`li[data-participant="${leaver2}"]`).getByRole('button', { name: '이후 대진에서 제외' }).click()
  await sub.waitFor()
  check(`${tag}-ST8-state`, (await sub.locator('[data-scr=SCR-226]').getAttribute('data-st')) === 'SCR-226-ST8')
  const boxes = sub.getByRole('checkbox', { name: /경기 취소, 대체할 사람이 없음$/ })
  const rem2 = v.games.filter((g) => !processed(g) && keysOf(g).includes(leaver2))
  check(`${tag}-ST8-boxes`, (await boxes.count()) === rem2.length && (await sub.getByRole('button', { name: '반영' }).isDisabled()), { boxes: await boxes.count(), rem: rem2.length })
  await shot(page, `${tag}-226-ST8.png`)
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check()
  await sub.getByRole('button', { name: '반영' }).click()
  await sub.waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
  await page.locator('[data-testid=participants-sheet] button[aria-label=닫기]').click().catch(() => {})
  v = await A.get(`/api/club-matches/${id}`)
  const cancelled = v.games.filter((g) => g.cancelled).map((g) => g.no)
  check(`${tag}-leave2-cancelled`, cancelled.length === rem2.length && rem2.every((g) => cancelled.includes(g.no)), { cancelled })
  // 운영 화면: 취소 카드
  await page.goto(`${BASE}/club-matches/${id}`)
  await progress(page).waitFor()
  // 회원이 나오는 취소 경기(회원 화면 확인용). 없으면 아무 취소 경기
  const cg = v.games.find((g) => g.cancelled && keysOf(g).includes(data.member.key)) ?? v.games.find((g) => g.cancelled)
  if (cg.round < v.currentRound) await page.getByRole('button', { name: `${cg.round}라운드 펼치기` }).click().catch(() => {})
  const cc = opsCard(page, cg.no)
  check(`${tag}-ST22-admin-card`, (await cc.getAttribute('data-cancelled')) === 'true' && (await cc.textContent()).includes('취소 · 중도 귀가') && (await cc.getByRole('group').count()) === 0)
  await cc.scrollIntoViewIfNeeded()
  await shot(page, `${tag}-ST22.png`)

  // 회원 계정: '취소' 배지(사유 없음), 다음 경기에서 빠짐
  const mp = await mctx.newPage()
  await mp.goto(`${BASE}/club-matches/${id}`)
  await mp.locator('[data-testid=public-area]').waitFor()
  const mine = mp.locator(`[data-audience=member][data-game="${cg.no}"]`).first()
  const mineCancelled = keysOf(cg).includes(data.member.key)
  if (mineCancelled) {
    check(`${tag}-member-cancel-badge`, (await mine.getAttribute('data-cancelled')) === 'true' && (await mine.textContent()).includes('취소') && !(await mine.textContent()).includes('중도 귀가'))
    const next = mp.getByRole('region', { name: '다음 경기' })
    check(`${tag}-member-next-excludes`, !(await next.count()) || (await next.locator(`[data-game="${cg.no}"]`).count()) === 0)
  } else check(`${tag}-member-cancel-badge`, false, { note: '회원 경기가 취소되지 않음', cg: cg.no })
  const mv = await api(mp).get(`/api/member/club-matches/${id}`)
  check(`${tag}-member-api-cancel-only`, mv.games.some((g) => g.cancelled === true) && !JSON.stringify(mv).includes('"reason"'))
  await shot(mp, `${tag}-member.png`, true)
  await mp.close()

  // 마지막 라운드까지: 종료 조건 사유(ST23) → 종료
  let reasonSeen = false
  for (let guard = 0; guard < 5; guard++) {
    v = await A.get(`/api/club-matches/${id}`)
    const last = Math.max(...v.games.map((g) => g.round))
    if (v.currentRound < last) reasonSeen ||= (await page.locator('[data-testid=end-why]').textContent()) === '마지막 라운드를 시작해야 종료할 수 있습니다'
    for (const g of v.games.filter((x) => x.round === v.currentRound && !processed(x))) await recordUI(page, method, g.no, 2)
    if (v.currentRound >= last) break
    await page.locator('[data-testid=next-round]').click()
    await waitRound(page, v.currentRound + 1)
  }
  check(`${tag}-ST23-reason`, reasonSeen)
  check(`${tag}-last-round-text`, await seen(page.locator('[data-testid=last-round]')))
  await page.waitForFunction(() => !document.querySelector('[data-testid=action-bar] button[data-cmp=CMP-001]')?.hasAttribute('disabled'), null, { timeout: 8000 }).catch(() => {})
  await page.getByRole('button', { name: '청백전 종료' }).click()
  await page.getByRole('alertdialog', { name: '청백전을 종료할까요?' }).getByRole('button', { name: '종료' }).click()
  await page.waitForTimeout(800)
  v = await A.get(`/api/club-matches/${id}`)
  check(`${tag}-finished`, v.status === 'finished' && noRoundDup(v))
  const memberGames = v.games.filter((g) => !g.cancelled && g.winner && keysOf(g).includes(data.member.key)).length
  report.info[`${tag}-memberGames`] = memberGames
  return { id, memberGames }
}

// ── 라운드 정보 없는 기존 청백전(코트 수 없음, AC-163·SCR-112-ST24·SCR-241-ST12) + 단계 주소 직접 접근 ──
async function legacy(page, data) {
  const A = api(page)
  const people = data.keys.slice(0, 8)
  const id = (await A.send('POST', '/api/club-matches', { method: 'individual', date: '2026-12-28', name: `기존 방식 ${RUN}` })).body.id
  let v = await A.get(`/api/club-matches/${id}`)
  v = (await A.send('PUT', `/api/club-matches/${id}/participants`, { keys: people, version: v.version })).body
  v = (await A.send('POST', `/api/club-matches/${id}/games`, { version: v.version, totalGames: 4, rules: { balance: true, gender: true } })).body
  check('legacy-draft-no-court', v.courtCount === null && v.games.length === 4 && v.games.every((g) => g.round === null))
  // 상세 주소 → 운영진은 생성 페이지(계산된 단계)로
  await page.goto(`${BASE}/club-matches/${id}`)
  await page.waitForURL(/\/setup\//, { timeout: 8000 }).catch(() => {})
  report.info.legacyDetailRedirect = new URL(page.url()).pathname.replace(id, ':id')
  check('legacy-detail-to-setup', /\/setup\/(games|confirm)$/.test(page.url()), page.url())
  // 단계 주소 직접 접근: 기본정보(ST12 안내·코트 4 채움), 대진 설정(기존 편집기), 확정(기존 요약) — 화면 오류·넘침 없음
  const steps = {}
  for (const step of ['basic', 'participants', 'games', 'confirm']) {
    await page.goto(`${BASE}/club-matches/${id}/setup/${step}`)
    await page.locator('.su[data-scr]').waitFor({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(300)
    steps[step] = { st: await page.locator('.su[data-scr]').getAttribute('data-st').catch(() => null), url: new URL(page.url()).pathname.replace(id, ':id'), rounds: await page.locator('[data-testid=round-section]').count(), hs: await hScroll(page) }
  }
  report.info.legacySteps = steps
  check('legacy-basic-ST12', steps.basic.st === 'SCR-241-ST12' && (await (async () => { await page.goto(`${BASE}/club-matches/${id}/setup/basic`); await page.locator('.su[data-scr]').waitFor(); return (await page.getByRole('textbox', { name: '사용 코트 수' }).inputValue()) === '4' })()), steps.basic)
  check('legacy-steps-render', Object.values(steps).every((x) => x.st && !x.hs), steps)
  check('legacy-games-step-no-rounds', steps.games.rounds === 0, steps.games)
  // 확정 단계로 바로 들어가 확정 → 기존 상세(ST13): 진행 카드·라운드 구역 없음, 결과·종료 기존대로
  await page.goto(`${BASE}/club-matches/${id}/setup/confirm`)
  await page.locator('.su[data-st="SCR-245-ST1"]').waitFor()
  await page.locator('[data-testid=su-next]').click()
  await page.getByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' }).getByRole('button', { name: '확정' }).click()
  await page.waitForURL(`${BASE}/club-matches/${id}`)
  await ops(page).waitFor()
  await page.waitForTimeout(500)
  check('legacy-ST13', (await ops(page).getAttribute('data-st')) === 'SCR-112-ST13' && (await progress(page).count()) === 0 && (await page.locator('[data-testid=round-section]').count()) === 0)
  check('legacy-no-round-toast', (await page.locator('[data-cmp=CMP-029]', { hasText: '라운드를 시작했습니다' }).count()) === 0)
  check('legacy-left-button', (await page.getByRole('button', { name: /경기 남음$/ }).count()) === 1)
  for (const no of [1, 2, 3, 4]) await recordUI(page, 'individual', no, 1)
  await page.getByRole('button', { name: '청백전 종료' }).click()
  await page.getByRole('alertdialog', { name: '청백전을 종료할까요?' }).getByRole('button', { name: '종료' }).click()
  await page.waitForTimeout(800)
  v = await A.get(`/api/club-matches/${id}`)
  check('legacy-finished', v.status === 'finished' && v.currentRound === null)
  await shot(page, 'legacy-ST14.png')
}

// ── 진행 화면 폭·VD-086·누름 영역: 새 팀전(코트 2, 10명, 3라운드)을 2라운드 진행 중으로 ──
async function layout(page, data) {
  const A = api(page)
  const id = await makeDraft(page, 'team', data.keys.slice(0, 10), `밀도 진행 ${RUN}`)
  let v = await A.get(`/api/club-matches/${id}`)
  v = (await A.send('POST', `/api/club-matches/${id}/confirm`, { version: v.version })).body
  for (const g of v.games.filter((x) => x.round === 1)) v = (await A.send('PUT', `/api/club-matches/${id}/games/${g.no}/result`, { winner: 1, version: v.version })).body
  v = (await A.send('POST', `/api/club-matches/${id}/rounds/next`, { version: v.version })).body
  check('layout-setup-round2', v.currentRound === 2)
  const storage = await page.context().storageState()
  for (const [name, w, h, m] of [['m390', 390, 844, true], ['m360', 360, 640, true], ['d1440', 1440, 900, false], ['z200', 195, 422, true]]) {
    const ctx = await browser.newContext({ ...ctxOpts(w, h, m), storageState: storage })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/club-matches/${id}`)
    await p.locator('[data-testid=round-progress]').waitFor()
    await p.waitForTimeout(400)
    check(`overflow-112-${name}`, !(await hScroll(p)))
    if (name === 'm390') {
      const h = await p.locator('[data-testid=round-progress]').evaluate((e) => Math.round(e.getBoundingClientRect().height))
      report.info.progressHeight = h
      check('vd086-progress-le-140', h <= 140, h)
      // 열면 진행 중 구역으로 스크롤 → 그 구역 첫 카드가 하단 바 위로 보임
      const firstVisible = await p.evaluate(() => {
        const sec = document.getElementById('live-r2')
        const card = sec?.querySelector('article[data-game]')
        const bar = document.querySelector('[data-testid=action-bar]')?.getBoundingClientRect().top ?? innerHeight
        const b = card?.getBoundingClientRect()
        return { ok: !!b && b.top >= 0 && b.bottom <= bar, scrollY, top: b && Math.round(b.top), bottom: b && Math.round(b.bottom), bar: Math.round(bar), sec: sec && Math.round(sec.getBoundingClientRect().top) }
      })
      report.info.firstCard = firstVisible
      check('vd086-live-first-card-visible', firstVisible.ok, firstVisible)
      const heads = await p.locator('[data-testid=round-section] > div:first-child').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
      check('vd086-round-head-le-40', Math.max(...heads) <= 40, heads)
      const small = await p.evaluate(() => {
        const sel = ['[data-testid=round-progress] button', '[data-testid=round-section] button']
        return [...document.querySelectorAll(sel.join(','))].filter((b) => b.offsetParent).map((b) => {
          const r = b.getBoundingClientRect()
          const a = getComputedStyle(b, '::after')
          const pad = a.content !== 'none' && a.position === 'absolute' ? -2 * (parseFloat(a.top) || 0) : 0
          return { label: b.getAttribute('aria-label') ?? b.textContent.trim().slice(0, 20), w: Math.round(r.width + pad), h: Math.round(r.height + pad) }
        }).filter((t) => t.h < 44 || t.w < 44)
      })
      check('touch-targets-44', small.length === 0, small.slice(0, 5))
    }
    // 전체 화면 캡처는 스크롤 위치를 바꾸므로 측정 뒤에 찍음. 390은 첫 화면(진행 구역으로 스크롤된 상태)도 남김
    if (name === 'm390') await shot(p, 'layout-112-m390-first.png')
    await shot(p, `layout-112-${name}.png`, name !== 'd1440')
    await ctx.close()
  }
}

const ctx = await browser.newContext(ctxOpts(390, 844, true))
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && !EXPECTED_HTTP.test(m.text()) && report.errors.push(m.text()))
page.on('pageerror', (e) => report.errors.push(String(e)))
let mctx
try {
  await login(page)
  const data = await prepare(page)
  mctx = await browser.newContext(ctxOpts(390, 844, true))
  await mctx.addCookies([{ name: 'smapsh_session', value: data.member.token, url: BASE, httpOnly: true, sameSite: 'Lax' }])
  await mctx.addInitScript(() => localStorage.setItem('smapsh.introSeen.v1', '1'))
  const ind = await liveFlow(page, mctx, data, 'individual')
  const team = await liveFlow(page, mctx, data, 'team')
  // 회원 마이페이지 전적 = 두 청백전에서 결과가 있는(취소 아닌) 내 경기 수
  const mp = await mctx.newPage()
  const rec = await api(mp).get('/api/me/record')
  report.info.memberRecord = rec
  check('member-record-excludes-cancelled', rec.games === ind.memberGames + team.memberGames, { rec, expect: ind.memberGames + team.memberGames })
  await mp.goto(`${BASE}/me`)
  const recText = await mp.getByRole('region', { name: '청백전 전적' }).textContent()
  check('member-mypage-record', recText.includes(`${rec.games}경기`), recText)
  await shot(mp, 'member-mypage.png')
  await layout(page, data)
  await legacy(page, data)
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
