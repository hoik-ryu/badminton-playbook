// I3-d4 청백전 실제 API 모드 E2E(SCR-111·112 통합 목록·상세 + 운영 시트 SCR-224–226, SCR-121 마이페이지, 명단 게스트 추가·삭제)
// (B12) 만들기~확정은 생성 페이지(SCR-241 기본정보 → 242 참가자 → 244 대진 → 245 확정, 개인전)로. 이전 만들기 시트(SCR-222)·상세 확정 전 영역(ST9–ST12)은 제거됨
// (청백전 4단계) 주소를 /club-matches…로 옮김. 이전 /ops/club-matches… 리다이렉트도 확인(legacy-redirect, page-redirects-to-login)
// 준비: API 모드 Vite(BASE, 기본 http://localhost:5174, API_PROXY_TARGET=별도 백엔드) + 백엔드(개발용 운영진 로그인 켬) + 마이그레이션된 임시 DB
// (5-B1) 실제 회원 세션(권한·공개 데이터), 360·390·1440, D-1 긴 이름·두 자리 점수 겹침, D-2 잘못된 주소 식별자(ST5)
// 사용: DEV_ADMIN_PASSWORD=... PSQL_ARGS="-h 127.0.0.1 -p 55433 -U app smapsh_e2e" OUT=<결과 폴더> node experiments/frontend-layout/check-clubmatch-api.mjs (비밀번호는 환경변수로만)
//   PSQL_ARGS: 회원 세션을 임시 DB에 직접 만듦(e2e-guard가 포트 5432·보호 DB 이름이면 중단)
// 영속 개발 DB(smapsh)에 쓰지 않도록 반드시 임시 DB에 연결된 백엔드로 실행하세요(테스트 데이터를 만듭니다).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { assertE2ETarget, assertTestPsqlArgs, guardBrowser, reportBlocked } from './e2e-guard.mjs'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5174'
const PASSWORD = process.env.DEV_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('DEV_ADMIN_PASSWORD 환경변수가 필요합니다')
// E2E 보호(e2e-guard.mjs): 프록시 대상이 APP_ENV=e2e 백엔드인지 브라우저를 띄우기 전에 확인
await assertE2ETarget(BASE)
const PSQL_ARGS = process.env.PSQL_ARGS
if (!PSQL_ARGS) throw new Error('PSQL_ARGS 환경변수가 필요합니다(임시 테스트 DB, 예: -h 127.0.0.1 -p 55433 -U app smapsh_e2e)')
assertTestPsqlArgs(PSQL_ARGS)
const PSQL = process.env.PSQL || 'psql'
const psql = (sql) => execFileSync(PSQL, [...PSQL_ARGS.split(' '), '-Atc', sql]).toString().trim()
const OUT = process.env.OUT || path.join(here, 'results/clubmatch-api'); fs.mkdirSync(OUT, { recursive: true })
const RUN = Date.now().toString(36).slice(-4)

const shot = (page, f) => page.screenshot({ path: path.join(OUT, f) })
const hScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
const vis = (page, sel, opts) => page.locator(sel, opts).filter({ visible: true }).first()
// D-1: 운영 경기 카드 팀 줄에서 이름 글자가 팀 합(=n)·결과 버튼 자리와 겹치는지(겹친 줄의 글자 목록, 없으면 [])
const nameOverlaps = (page) => page.evaluate(() => {
  const bad = []
  for (const line of document.querySelectorAll('[data-testid=ops-area] [data-cmp=CMP-041] div.min-h-11')) {
    const names = line.children[1]; const nr = names.getBoundingClientRect()
    const textRight = Math.max(nr.left, ...[...names.querySelectorAll('span,button')].map((x) => x.getBoundingClientRect().right))
    for (const el of [...line.children].slice(2)) for (const c of [el, ...el.querySelectorAll('*')]) { const b = c.getBoundingClientRect(); if (b.width && b.left < textRight - 0.5 && b.bottom > nr.top && b.top < nr.bottom) bad.push(line.textContent.slice(0, 50)) }
  }
  return [...new Set(bad)]
})
// D-1: 구분점(' ·')이 줄 맨 앞에 홀로 놓이지 않음(구분점 글자의 왼쪽이 이름 칸 왼쪽과 같으면 줄 맨 앞)
const lonelySeparators = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid=ops-area] [data-names]')].flatMap((col) => {
  const left = col.getBoundingClientRect().left
  return [...col.querySelectorAll('span')].filter((x) => x.textContent === '\u00a0·' && Math.abs(x.getBoundingClientRect().left - left) < 2).map(() => col.textContent.slice(0, 40))
}))
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
for (const vp of [{ n: 'm360', w: 360, h: 640, m: true }, { n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const opts = { viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 2 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' }
  const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errors = []
  const r = (report[vp.n] = { vp: vp.n, checks: {}, info: {}, errors })
  page.on('console', (m) => m.type() === 'error' && !EXPECTED_HTTP.test(m.text()) && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const panel = '[data-testid=participants-sheet]' // 운영 셸은 PC에서도 모바일 배치(사용자 결정 2026-11-12)
  const A = api(page)
  await login(page)

  // ── 준비(명단 API): 회원 5명(D-1 긴 이름·두 자리 점수) + 점수 미설정 1명 + 게스트 2명, 개발용 관리자도 참가(전적 확인) ──
  const me = await A.get('/api/auth/me')
  await A.send('PUT', `/api/roster/members/${me.id}/score`, { score: 6, previous: (await A.get(`/api/roster`)).members.find((x) => x.id === me.id)?.score ?? null })
  const names = ['김수한무거북이와두루', '할머니댁강아지복실', '오렌지주스한잔해요', '가나다라마바사아자차', '청백전최장이름선수'].map((x) => `E${RUN}${vp.n}${x}`)
  for (const [i, name] of names.entries()) check(r, `setup-member-${i}`, (await A.send('POST', '/api/roster/members', { name, gender: i % 2 ? '여' : '남', grade: 'C조', score: i < 3 ? 10 : 3 + i })).status === 201)
  const unscored = `E${RUN}${vp.n}미설정`
  await A.send('POST', '/api/roster/members', { name: unscored, gender: '남', grade: 'D조', score: null })
  const g1 = (await A.send('POST', '/api/roster/guests', { name: `E${RUN}${vp.n}손님`, gender: '여', grade: '초심', score: 4 })).body
  const g2 = (await A.send('POST', '/api/roster/guests', { name: `E${RUN}${vp.n}미참가`, gender: '남', grade: '초심', score: 5 })).body
  check(r, 'guest-add', !!g1?.id && !!g2?.id)

  // ── 생성 페이지(B12): 기본정보(SCR-241) → 참가자(SCR-242) + 점수(SCR-214) → 대진(SCR-244) → 확정(SCR-245) ──
  const waitSt = (id) => page.waitForSelector(`.su[data-st="${id}"]`, { timeout: 8000 })
  const next = async () => { await page.waitForSelector('[data-testid=su-next]:not([disabled])', { timeout: 8000 }); await page.locator('[data-testid=su-next]').click() }
  await page.goto(BASE + '/club-matches'); await page.waitForSelector('[data-scr=SCR-111]:not([data-st=SCR-111-ST2])')
  await page.locator('[data-testid=cm-create]').click(); await page.waitForURL(BASE + '/club-matches/new')
  await page.getByRole('radio', { name: '개인전' }).click()
  await page.getByRole('textbox', { name: '청백전 이름' }).fill(`E2E ${RUN}`)
  await next(); await page.waitForURL(/\/setup\/participants$/)
  const id = page.url().split('/')[4]; r.info.matchId = id
  check(r, 'created-draft', (await A.get(`/api/club-matches/${id}`)).status === 'draft')
  await waitSt('SCR-242-ST1')
  for (const n of [me.name, ...names, unscored, g1.name]) await page.getByRole('checkbox', { name: new RegExp(`^${n},`) }).click()
  await waitSt('SCR-242-ST7') // 점수 미설정 포함 → 다음 비활성
  check(r, 'next-blocked-unscored', await page.locator('[data-testid=su-next]').isDisabled())
  await shot(page, `${vp.n}-1-participants.png`)
  await page.getByRole('button', { name: /점수 미설정 1명, 점수 매기기/ }).click(); await page.waitForSelector('[data-testid=score-sheet]')
  await page.locator('[data-testid=score-sheet] [role=radio]', { hasText: /^5$/ }).first().click()
  await page.waitForSelector('[data-testid=score-sheet]', { state: 'detached', timeout: 8000 })
  check(r, 'score-entry-api', (await A.get('/api/roster')).members.find((x) => x.name === unscored)?.score === 5)
  await next(); await page.waitForURL(/\/setup\/games$/)
  let v = await A.get(`/api/club-matches/${id}`)
  check(r, 'participants', v.summary.count === 8 && v.summary.unscored.length === 0, { count: v.summary.count })
  await page.getByRole('textbox', { name: '총 경기 수' }).fill('6')
  await page.locator('[data-testid=su-generate]').click(); await waitSt('SCR-244-ST7')
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'generated', v.games.length === 6 && v.totalGames === 6, { games: v.games.length })
  check(r, 'hscroll-SCR-244', !(await hScroll(page)))
  await shot(page, `${vp.n}-1-games.png`)
  await next(); await page.waitForURL(/\/setup\/confirm$/); await waitSt('SCR-245-ST1')
  await next(); await page.locator('[role=alertdialog] button', { hasText: '확정' }).click()
  await page.waitForURL((u) => u.pathname === `/club-matches/${id}`); await page.waitForSelector('[data-testid=ops-area] [data-cmp=CMP-041]'); await page.waitForTimeout(400)
  v = await A.get(`/api/club-matches/${id}`)
  check(r, 'confirmed', v.status === 'confirmed'); check(r, 'hscroll-confirmed', !(await hScroll(page)))
  // D-1(ST13): 결과 버튼이 붙은 팀 줄에서도 긴 이름·두 자리 점수가 팀 합·결과 버튼을 침범하지 않음
  check(r, 'long-names-no-overlap-ST13', (await nameOverlaps(page)).length === 0, await nameOverlaps(page))
  check(r, 'no-lonely-separator-ST13', (await lonelySeparators(page)).length === 0, await lonelySeparators(page))
  await page.locator('[data-testid=ops-area] [data-cmp=CMP-041]').first().scrollIntoViewIfNeeded(); await shot(page, `${vp.n}-2-confirmed.png`)
  await page.screenshot({ path: path.join(OUT, `${vp.n}-2-confirmed-full.png`), fullPage: true })

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
  // 이전 운영 주소(북마크)는 운영진에게 통합 상세로 바꿔 보냄(쿼리 유지)
  await p2.goto(BASE + `/ops/club-matches/${id}?from=bookmark`); await p2.waitForURL((u) => u.pathname === `/club-matches/${id}`, { timeout: 5000 }).catch(() => {}) /* 경로 전체 일치: 앞부분 고정 안 된 정규식이 구 주소에도 맞던 문제 수정(5-B1) */
  check(r, 'legacy-redirect', new URL(p2.url()).pathname === `/club-matches/${id}` && new URL(p2.url()).search === '?from=bookmark', { url: p2.url() })
  await p2.waitForSelector('[data-testid=ops-area] [data-cmp=CMP-041]')
  await page.goto(BASE + `/club-matches/${id}`); await page.waitForSelector('[data-testid=ops-area] [data-cmp=CMP-041]')
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
  check(r, 'result-edited-badge', (await page.locator('[data-testid=ops-area] article[aria-label="1경기"]', { hasText: '결과 수정됨' }).count()) === 1)
  if (g1Remaining) check(r, 'deleted-guest-in-history', v.games.some((g) => [...g.team1, ...g.team2].some((p) => p.name === '삭제된 게스트' && p.gender === null)))
  check(r, 'hscroll-finished', !(await hScroll(page)))
  await shot(page, `${vp.n}-6-finished.png`)

  // ── 회원 화면(SCR-111·112) ──
  await page.goto(BASE + '/club-matches'); await page.waitForSelector('[data-scr=SCR-111]:not([data-st=SCR-111-ST2])')
  check(r, 'member-list', (await page.locator('[data-scr=SCR-111] a', { hasText: `E2E ${RUN}` }).count()) >= 1)
  await page.goto(BASE + `/club-matches/${id}`); await page.waitForSelector('[data-scr=SCR-112]'); await page.waitForTimeout(400)
  const body = await page.locator('[data-scr=SCR-112]').textContent()
  const pubBody = await page.locator('[data-testid=public-area]').textContent() // 운영진은 같은 화면 아래 운영 영역이 있으므로 공개 영역만 검사
  check(r, 'member-banners', body.includes('대진이 수정되었습니다') && body.includes('경기 결과가 수정되었습니다'))
  check(r, 'member-no-ops-info', !pubBody.includes('실력차') && !pubBody.includes('규칙 완화') && !/=\d/.test(pubBody))
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

  // ── D-2: 잘못된 주소 식별자 → 찾을 수 없음(ST5), 다른 오류(ST4) 아님 ──
  await page.goto(BASE + '/club-matches/not-a-uuid'); await page.waitForSelector('[data-scr=SCR-112]:not([data-st=SCR-112-ST2])')
  check(r, 'malformed-id-ST5', (await page.locator('[data-scr=SCR-112]').getAttribute('data-st')) === 'SCR-112-ST5' && (await page.locator('text=청백전을 찾을 수 없습니다').count()) > 0)

  // ── 실제 회원 세션(role=member): 권한·공개 데이터·화면 ──
  const pendingId = (await A.send('POST', '/api/club-matches', { method: 'individual', date: '2026-11-20', name: `E2E ${RUN} ${vp.n} 준비` })).body.id
  const token = `e2e-member-${vp.n}-${RUN}-${Date.now()}`
  const mid = psql(`INSERT INTO users (id, name, gender, grade, role, status) VALUES (gen_random_uuid(), 'E${RUN}${vp.n}회원', '여', 'C조', 'member', 'approved') RETURNING id`).split('\n')[0]
  psql(`INSERT INTO auth_sessions (id, token_hash, user_id, expires_at) VALUES (gen_random_uuid(), encode(sha256('${token}'::bytea), 'hex'), '${mid}', now() + interval '1 day')`)
  const mctx = await browser.newContext(opts); await mctx.addCookies([{ name: 'smapsh_session', value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }])
  const mp = await mctx.newPage(); const MB = api(mp)
  await mp.goto(BASE + '/login'); await mp.evaluate(() => localStorage.setItem('smapsh.introSeen.v1', '1'))
  check(r, 'member-session', (await MB.get('/api/auth/me')).role === 'member')
  const mPerm = { ops: (await mp.request.get(BASE + '/api/club-matches')).status(), opsDetail: (await mp.request.get(BASE + `/api/club-matches/${id}`)).status(), create: (await MB.send('POST', '/api/club-matches', { method: 'individual', date: '2026-11-20', name: 'x' })).status, pending: (await mp.request.get(BASE + `/api/member/club-matches/${pendingId}`)).status() }
  check(r, 'member-permissions', mPerm.ops === 403 && mPerm.opsDetail === 403 && mPerm.create === 403 && mPerm.pending === 404, mPerm)
  const mList = await MB.get('/api/member/club-matches'); const mDetail = await MB.get(`/api/member/club-matches/${id}`)
  const mRaw = JSON.stringify([mList, mDetail])
  check(r, 'member-public-data', mList.some((x) => x.id === id && x.displayStatus === 'ended' && x.result) && !mList.some((x) => x.id === pendingId) && mDetail.displayStatus === 'ended' && !/"(score|gender|grade|version|gap|relaxations|genderRelaxed|summary|rows)"/.test(mRaw) && !mRaw.includes('member:') && !mRaw.includes('guest:'))
  await mp.goto(BASE + '/club-matches'); await mp.waitForSelector('[data-scr=SCR-111]:not([data-st=SCR-111-ST2])')
  const mTabs = await mp.evaluate(() => [...document.querySelectorAll('nav[aria-label="주 메뉴"] a')].map((a) => [a.querySelector(':scope > span:last-child').textContent, a.getAttribute('aria-current') || '']))
  check(r, 'member-tabs-3', mTabs.length === 3 && mTabs[1][0] === '청백전' && mTabs[1][1] === 'page', mTabs)
  await mp.locator(`a[data-match="${id}"]`).click(); await mp.waitForURL((u) => u.pathname === `/club-matches/${id}`); await mp.waitForSelector('[data-scr=SCR-112] [data-testid=public-area]')
  const mBody = await mp.locator('[data-scr=SCR-112]').textContent()
  check(r, 'member-detail-public-only', (await mp.locator('[data-testid=ops-area]').count()) === 0 && !/실력차|규칙 완화|=\d/.test(mBody) && (await mp.locator('[data-scr=SCR-112]').getAttribute('data-st')) === 'SCR-112-ST8')
  check(r, 'hscroll-member-session', !(await hScroll(mp)))
  await shot(mp, `${vp.n}-9-member-session.png`)
  await mp.goto(BASE + `/club-matches/${pendingId}`); await mp.waitForSelector('[data-scr=SCR-112]:not([data-st=SCR-112-ST2])')
  check(r, 'member-pending-not-found', (await mp.locator('[data-scr=SCR-112]').getAttribute('data-st')) === 'SCR-112-ST5')
  for (const p of ['/ops/club-matches', `/ops/club-matches/${id}`]) { await mp.goto(BASE + p); await mp.waitForURL((u) => u.pathname === '/forbidden', { timeout: 5000 }).catch(() => {}); check(r, `member-legacy-forbidden${p.endsWith('matches') ? '' : '-detail'}`, new URL(mp.url()).pathname === '/forbidden', mp.url()) }
  await mctx.close()
  // (B12) 준비 중 청백전 재진입 → 계산된 단계(참가자 0명 → 참가자 설정) → 더보기 삭제(SCR-241-ST10)
  await page.goto(BASE + '/club-matches'); await page.locator(`a[data-match="${pendingId}"]`).click(); await page.waitForURL((u) => u.pathname === `/club-matches/${pendingId}/setup/participants`, { timeout: 8000 }).catch(() => {})
  check(r, 'resume-participants', new URL(page.url()).pathname === `/club-matches/${pendingId}/setup/participants`, page.url())
  await page.goto(BASE + `/club-matches/${pendingId}/setup/basic`); await page.getByRole('button', { name: '더보기: 청백전 삭제' }).click()
  await page.locator('[role=alertdialog] button', { hasText: '삭제' }).click(); await page.waitForURL(BASE + '/club-matches')
  check(r, 'delete-draft', (await page.request.get(BASE + `/api/club-matches/${pendingId}`)).status() === 404)
  const delConfirmed = await A.send('DELETE', `/api/club-matches/${id}?version=${(await A.get(`/api/club-matches/${id}`)).version}`)
  check(r, 'delete-confirmed-blocked', delConfirmed.status === 409 && delConfirmed.body.error.code === 'locked', delConfirmed)
  const aTabs = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="주 메뉴"] a')].length)
  check(r, 'admin-tabs-4', aTabs === 4, aTabs)

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
