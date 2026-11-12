// I3-d4 청백전 실제 API 모드 E2E(SCR-221–226 운영진, SCR-111·112 회원, SCR-121 마이페이지, 명단 게스트 추가·삭제)
// 준비: API 모드 Vite(BASE, 기본 http://localhost:5174, API_PROXY_TARGET=별도 백엔드) + 백엔드(개발용 운영진 로그인 켬) + 마이그레이션된 임시 DB
// 사용: DEV_ADMIN_PASSWORD=... OUT=<결과 폴더> node experiments/frontend-layout/check-clubmatch-api.mjs (비밀번호는 환경변수로만)
// 영속 개발 DB(smapsh)에 쓰지 않도록 반드시 임시 DB에 연결된 백엔드로 실행하세요(테스트 데이터를 만듭니다).
import fs from 'node:fs'
import path from 'node:path'

import { assertE2ETarget, guardBrowser, reportBlocked } from './e2e-guard.mjs'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5174'
const PASSWORD = process.env.DEV_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('DEV_ADMIN_PASSWORD 환경변수가 필요합니다')
// E2E 보호(e2e-guard.mjs): 프록시 대상이 APP_ENV=e2e 백엔드인지 브라우저를 띄우기 전에 확인
await assertE2ETarget(BASE)
const OUT = process.env.OUT || path.join(here, 'results/clubmatch-api'); fs.mkdirSync(OUT, { recursive: true })
const RUN = Date.now().toString(36).slice(-4)

const shot = (page, f) => page.screenshot({ path: path.join(OUT, f) })
const hScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
const vis = (page, sel, opts) => page.locator(sel, opts).filter({ visible: true }).first()
const EXPECTED_HTTP = /status of (401|403|404|409|422)/ // 의도한 오류 응답의 브라우저 콘솔 기록은 제외
const fails = []
const check = (r, name, ok, info) => { r.checks[name] = ok ? 'pass' : `FAIL ${info ? JSON.stringify(info) : ''}`; if (!ok) fails.push(`${r.vp}:${name}`) }

async function login(page) {
  await page.goto(BASE + '/login'); await page.evaluate(() => localStorage.setItem('smapsh.introSeen.v1', '1'))
  await page.goto(BASE + '/login'); await page.locator('button', { hasText: '운영진 로그인하기' }).click()
  await page.fill('input[name=username]', 'super_admin'); await page.fill('input[name=password]', PASSWORD)
  await page.locator('form button[type=submit]').click(); await page.waitForURL(BASE + '/ops')
}
const api = (page) => ({
  get: async (p) => (await page.request.get(BASE + p)).json(),
  send: async (method, p, data) => { const res = await page.request.fetch(BASE + p, { method, data, headers: { Origin: BASE } }); return { status: res.status(), body: res.status() === 204 ? null : await res.json() } },
})

const browser = await chromium.launch(); const report = {}
const blocked = guardBrowser(browser, BASE) // BASE 밖 API 요청 차단
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const opts = { viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 2 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' }
  const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errors = []
  const r = (report[vp.n] = { vp: vp.n, checks: {}, info: {}, errors })
  page.on('console', (m) => m.type() === 'error' && !EXPECTED_HTTP.test(m.text()) && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const panel = '[data-testid=participants-sheet]' // 운영 셸은 PC에서도 모바일 배치(사용자 결정 2026-11-12)
  const A = api(page)
  await login(page)

  // ── 준비(명단 API): 회원 5명 + 점수 미설정 1명 + 게스트 2명, 개발용 관리자도 참가(전적 확인) ──
  const me = await A.get('/api/auth/me')
  await A.send('PUT', `/api/roster/members/${me.id}/score`, { score: 6, previous: (await A.get(`/api/roster`)).members.find((x) => x.id === me.id)?.score ?? null })
  const names = ['가', '나', '다', '라', '마'].map((x) => `E${RUN}${vp.n.slice(0, 1)}${x}`)
  for (const [i, name] of names.entries()) check(r, `setup-member-${i}`, (await A.send('POST', '/api/roster/members', { name, gender: i % 2 ? '여' : '남', grade: 'C조', score: 3 + i })).status === 201)
  const unscored = `E${RUN}${vp.n.slice(0, 1)}미설정`
  await A.send('POST', '/api/roster/members', { name: unscored, gender: '남', grade: 'D조', score: null })
  const g1 = (await A.send('POST', '/api/roster/guests', { name: `E${RUN}${vp.n.slice(0, 1)}손님`, gender: '여', grade: '초심', score: 4 })).body
  const g2 = (await A.send('POST', '/api/roster/guests', { name: `E${RUN}${vp.n.slice(0, 1)}미참가`, gender: '남', grade: '초심', score: 5 })).body
  check(r, 'guest-add', !!g1?.id && !!g2?.id)

  // ── 만들기(SCR-222) → 참가자(SCR-224) → 점수(SCR-214) → 대진 생성 → 확정 ──
  await page.goto(BASE + '/ops/club-matches'); await page.waitForSelector('[data-scr=SCR-221]')
  await vis(page, 'button', { hasText: /^만들기$/ }).click(); await page.waitForSelector('[data-testid=create-sheet]')
  await page.locator('[data-testid=create-sheet] input[name=name]').fill(`E2E ${RUN}`); await page.locator('[data-testid=create-sheet] [role=radio]', { hasText: '개인전' }).click()
  await page.locator('[data-testid=create-sheet] button', { hasText: /^만들기$/ }).click(); await page.waitForURL(/\/ops\/club-matches\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop(); r.info.matchId = id
  await page.waitForSelector(panel)
  for (const n of [me.name, ...names, unscored, g1.name]) { await page.locator(`${panel} [role=checkbox]`, { hasText: n }).or(page.getByRole('checkbox', { name: new RegExp(`^${n},`) })).first().click(); await page.waitForTimeout(250) }
  await page.waitForTimeout(500)
  let v = await A.get(`/api/club-matches/${id}`)
  check(r, 'participants', v.summary.count === 8, { count: v.summary.count })
  await shot(page, `${vp.n}-1-panel.png`)
  await page.locator(`${panel} button`, { hasText: '점수 미설정' }).click(); await page.waitForSelector('[data-testid=score-sheet]')
  await page.locator('[data-testid=score-sheet] [role=radiogroup]').first().locator('[role=radio]', { hasText: /^5$/ }).click()
  await page.waitForSelector('[data-testid=score-sheet]', { state: 'detached', timeout: 5000 }).catch(() => {})
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'score-entry-api', v.summary.unscored.length === 0 && (await A.get('/api/roster')).members.find((x) => x.name === unscored)?.score === 5)
  await page.locator(`${panel} button[aria-label=닫기]`).click(); await page.waitForTimeout(400)
  await vis(page, 'input[type=number]').fill('6'); await page.waitForTimeout(700)
  await vis(page, 'button', { hasText: '대진 생성' }).click(); await page.waitForSelector('[data-cmp=CMP-041]'); await page.waitForTimeout(500)
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'generated', v.games.length === 6 && v.totalGames === 6, { games: v.games.length })
  await vis(page, 'button', { hasText: /^확정$/ }).click(); await page.locator('[role=alertdialog] button', { hasText: '확정' }).click(); await page.waitForTimeout(800)
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'confirmed', v.status === 'confirmed'); check(r, 'hscroll-confirmed', !(await hScroll(page)))
  await shot(page, `${vp.n}-2-confirmed.png`)

  // ── 결과 기록 → 되돌리기(D-8) ──
  for (const no of [1, 2]) { await page.locator(`[role=group][aria-label="${no}경기 결과"] button`, { hasText: '1팀 승' }).click(); await page.waitForTimeout(500) }
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'results', v.games[0].winner === 1 && v.games[1].winner === 1)
  await page.locator('article[aria-label="2경기"] button', { hasText: '미기록으로 되돌리기' }).click()
  await page.locator('[role=alertdialog] button', { hasText: '되돌리기' }).click()
  const toast = await page.locator('[data-cmp=CMP-029]').textContent({ timeout: 4000 }).catch(() => null)
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'revert', v.games[1].winner === null && toast === '경기 결과가 미기록으로 변경되었습니다.', { toast })

  // ── 게스트 삭제 차단(확정 미종료 청백전의 남은 경기) / 미참가 게스트 삭제 ──
  const g1Remaining = v.games.filter((g) => !g.winner && [...g.team1, ...g.team2].some((p) => p.key === `guest:${g1.id}`)).length
  if (g1Remaining) {
    const blocked = await A.send('DELETE', `/api/roster/guests/${g1.id}`)
    check(r, 'guest-delete-blocked', blocked.status === 409 && blocked.body.error.code === 'guest_delete_blocked', blocked)
  } else r.info.guestBlockSkipped = '게스트가 남은 경기에 배정되지 않아 차단 확인 생략'
  check(r, 'guest-delete-unrelated', (await A.send('DELETE', `/api/roster/guests/${g2.id}`)).status === 204)

  // ── 교체(SCR-225) ──
  await page.locator('[data-cmp=CMP-041][data-recorded=false] button[aria-label$=교체]').first().click(); await page.waitForSelector('[data-testid=club-swap-sheet]')
  await shot(page, `${vp.n}-3-swap.png`)
  await page.locator('[data-testid=club-swap-sheet] [data-cmp=CMP-044] button:not([aria-disabled])').first().click(); await page.waitForTimeout(400)
  if (await page.locator('[role=alertdialog]').count()) await page.locator('[role=alertdialog] button', { hasText: '바꾸기' }).click()
  await page.waitForSelector('[data-testid=club-swap-sheet]', { state: 'detached', timeout: 5000 }).catch(() => {})
  check(r, 'swap-sheet-closed', (await page.locator('[data-testid=club-swap-sheet]').count()) === 0)
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'swap', v.games.some((g) => g.manual && g.changed) && v.modifiedAt !== null)

  // ── 중도 귀가(SCR-224 → SCR-226) ──
  await vis(page, 'button', { hasText: /^참가자 \d+명/ }).click(); await page.waitForSelector(panel)
  const leaveRow = page.locator(`${panel} ul[aria-label=회원] li`, { hasText: `E${RUN}`, has: page.locator('button', { hasText: '이후 대진에서 제외' }) }).first() // 개발용 관리자(전적 확인용)는 남김
  const leaverKey = await leaveRow.getAttribute('data-participant')
  await leaveRow.locator('button', { hasText: '이후 대진에서 제외' }).click(); await page.waitForSelector('[data-testid=substitute-sheet]')
  r.info.substituteState = await page.locator('[data-testid=substitute-sheet] [data-scr=SCR-226]').getAttribute('data-st')
  await shot(page, `${vp.n}-4-substitute.png`)
  await page.locator('[data-testid=substitute-sheet] button', { hasText: '반영' }).click()
  await page.waitForSelector('[data-testid=substitute-sheet]', { state: 'detached', timeout: 5000 }).catch(() => {})
  check(r, 'substitute-sheet-closed', (await page.locator('[data-testid=substitute-sheet]').count()) === 0)
  v = await A.get(`/api/club-matches/${id}`)
  const leftRow = v.rows.find((x) => x.key === leaverKey)
  check(r, 'leave', leftRow?.left === true && !v.games.some((g) => !g.winner && [...g.team1, ...g.team2].some((p) => p.key === leaverKey)), { leaverKey })
  await page.locator(`${panel} button[aria-label=닫기]`).click().catch(() => {}); await page.waitForTimeout(400)

  // ── 동시 수정 충돌(운영진 두 명) ──
  const ctx2 = await browser.newContext(opts); const p2 = await ctx2.newPage(); await login(p2)
  await p2.goto(BASE + `/ops/club-matches/${id}`); await p2.waitForSelector('[data-cmp=CMP-041]')
  await page.goto(BASE + `/ops/club-matches/${id}`); await page.waitForSelector('[data-cmp=CMP-041]')
  const open = (v.games.filter((g) => !g.winner)).map((g) => g.no)
  await page.locator(`[role=group][aria-label="${open[0]}경기 결과"] button`, { hasText: '1팀 승' }).click(); await page.waitForTimeout(600)
  await p2.locator(`[role=group][aria-label="${open[1]}경기 결과"] button`, { hasText: '2팀 승' }).click()
  const conflict = await p2.locator('[role=alertdialog]', { hasText: '다른 운영진이 청백전을 변경했습니다' }).count().then(async (n) => n || (await p2.waitForSelector('[role=alertdialog]', { timeout: 4000 }).then(() => 1, () => 0)))
  await shot(p2, `${vp.n}-5-conflict.png`)
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'conflict-409', conflict > 0 && v.games.find((g) => g.no === open[1]).winner === null)
  await ctx2.close()

  // ── 나머지 기록 → 종료 → 종료 후 결과 수정(D-7) ──
  for (const g of v.games.filter((x) => !x.winner)) { await page.locator(`[role=group][aria-label="${g.no}경기 결과"] button`, { hasText: '2팀 승' }).click(); await page.waitForTimeout(450) }
  await vis(page, 'button', { hasText: '청백전 종료' }).click(); await page.locator('[role=alertdialog] button', { hasText: '종료' }).click(); await page.waitForTimeout(800)
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'finished', v.status === 'finished')
  if (g1Remaining) check(r, 'guest-delete-after-finish', (await A.send('DELETE', `/api/roster/guests/${g1.id}`)).status === 204)
  await page.locator('[role=group][aria-label="1경기 결과"] button', { hasText: '2팀 승' }).click(); await page.locator('[role=alertdialog] button', { hasText: '바꾸기' }).click(); await page.waitForTimeout(700)
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'result-edit-after-finish', v.games[0].winner === 2 && v.games[0].resultChanged && v.resultModifiedAt !== null)
  check(r, 'result-edited-badge', (await page.locator('article[aria-label="1경기"]', { hasText: '결과 수정됨' }).count()) === 1)
  if (g1Remaining) check(r, 'deleted-guest-in-history', v.games.some((g) => [...g.team1, ...g.team2].some((p) => p.name === '삭제된 게스트' && p.gender === null)))
  check(r, 'hscroll-finished', !(await hScroll(page)))
  await shot(page, `${vp.n}-6-finished.png`)

  // ── 회원 화면(SCR-111·112) ──
  await page.goto(BASE + '/club-matches'); await page.waitForSelector('[data-scr=SCR-111]:not([data-st=SCR-111-ST2])')
  check(r, 'member-list', (await page.locator('[data-scr=SCR-111] a', { hasText: `E2E ${RUN}` }).count()) >= 1)
  await page.goto(BASE + `/club-matches/${id}`); await page.waitForSelector('[data-scr=SCR-112]'); await page.waitForTimeout(400)
  const body = await page.locator('[data-scr=SCR-112]').textContent()
  check(r, 'member-banners', body.includes('대진이 수정되었습니다') && body.includes('경기 결과가 수정되었습니다'))
  check(r, 'member-no-ops-info', !body.includes('실력차') && !body.includes('규칙 완화'))
  const raw = JSON.stringify(await A.get(`/api/member/club-matches/${id}`))
  check(r, 'member-api-opaque', !raw.includes(me.id) && !raw.includes('member:') && !raw.includes('guest:') && !/"(score|gender|grade|version|gap|relaxations)"/.test(raw))
  check(r, 'hscroll-member', !(await hScroll(page)))
  await shot(page, `${vp.n}-7-member.png`)

  // ── 마이페이지 전적(SCR-121) ──
  const rec = await A.get('/api/me/record')
  await page.goto(BASE + '/me'); await page.waitForSelector('[data-scr=SCR-121]'); await page.waitForTimeout(400)
  const myText = await page.locator('[data-scr=SCR-121]').textContent()
  r.info.record = rec
  check(r, 'my-record', rec.games > 0 && myText.includes(String(rec.games)) && myText.includes(String(rec.wins)), { rec })
  await shot(page, `${vp.n}-8-mypage.png`)

  // ── CSRF(Vite 프록시 경유)·인증 ──
  const evil = await page.request.post(BASE + '/api/club-matches', { data: { method: 'individual', date: '2026-11-20', name: 'csrf' }, headers: { Origin: 'http://evil.example' } })
  check(r, 'csrf-foreign-origin-403', evil.status() === 403 && (await evil.json()).error.code === 'csrf_origin_mismatch')
  const anon = await browser.newContext(opts); const ap = await anon.newPage()
  const unauth = await ap.request.get(BASE + '/api/club-matches')
  check(r, 'api-401', unauth.status() === 401)
  await ap.goto(BASE + '/ops/club-matches'); await ap.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {})
  check(r, 'page-redirects-to-login', new URL(ap.url()).pathname === '/login')
  await anon.close()
  check(r, 'no-console-errors', errors.length === 0, errors)
  await ctx.close()
}
await browser.close()
reportBlocked(blocked)
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
console.log(fails.length ? `FAILED: ${fails.join(', ')}` : 'ALL CHECKS PASSED')
