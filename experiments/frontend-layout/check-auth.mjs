// 실제 API 모드 인증 브라우저 확인(390·1440): 운영진 로그인(펼침 폼·오류·성공·새로고침 유지) → 가입 승인(실제 DB) → 역할 관리
// → 로그아웃 → 회원 세션 권한 분리('?as=admin' 우회 불가) → 카카오 시작 주소. 실제 카카오 계정 인증은 수동 확인 대상.
// 준비: API 모드 Vite(BASE, 기본 http://localhost:5174) + 백엔드 + 마이그레이션된 DB(PSQL_ARGS로 접속)
// 사용: DEV_ADMIN_PASSWORD=... PSQL_ARGS="-h 127.0.0.1 -p 55433 -U app app" node experiments/frontend-layout/check-auth.mjs
// 비밀번호는 환경변수로만 받습니다(파일에 쓰지 않음).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5174'
const PASSWORD = process.env.DEV_ADMIN_PASSWORD
if (!PASSWORD) throw new Error('DEV_ADMIN_PASSWORD 환경변수가 필요합니다')
const PSQL = process.env.PSQL || '/opt/homebrew/opt/postgresql@17/bin/psql'
const psql = (sql) => execFileSync(PSQL, [...(process.env.PSQL_ARGS || '-h 127.0.0.1 -p 55433 -U app app').split(' '), '-Atc', sql]).toString().trim()
const OUT = path.join(here, 'results/auth'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ path: location.pathname, st: [...document.querySelectorAll('[data-scr]')].map((e) => `${e.dataset.scr}:${e.dataset.st}`).join(' '), hScroll: document.documentElement.scrollWidth > innerWidth })
const me = (page) => page.evaluate(() => fetch('/api/auth/me', { credentials: 'include' }).then(async (r) => ({ status: r.status, body: r.status === 200 ? await r.json() : null })))

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => m.type() === 'error' && !/401|Unauthorized|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }
  await page.goto(BASE + '/login'); await page.evaluate(() => localStorage.setItem('smapsh.introSeen.v1', '1'))

  // 1. 로그인 화면: 버튼 2개, 입력칸 없음
  await page.goto(BASE + '/login'); await page.waitForSelector('[data-scr=SCR-001]'); await page.waitForTimeout(400)
  await step('1-login', { buttons: await page.locator('.login__actions > button').allTextContents(), inputs: await page.locator('input').count() }); await shot(page, `${vp.n}-1-login.jpg`)
  // 2. 운영진 로그인하기 → 폼 펼침 → 틀린 비밀번호
  await page.locator('button', { hasText: '운영진 로그인하기' }).click(); await page.waitForSelector('form[aria-label="운영진 로그인"]')
  await page.fill('input[name=username]', 'super_admin'); await page.fill('input[name=password]', 'wrong-password')
  await page.locator('form button[type=submit]').click(); await page.waitForSelector('[data-cmp=CMP-023]')
  await step('2-wrong', { error: await page.locator('form [data-cmp=CMP-023]').textContent(), url: page.url().replace(BASE, '') }); await shot(page, `${vp.n}-2-wrong.jpg`)
  // 3. 올바른 계정 → /ops
  await page.fill('input[name=password]', PASSWORD); await page.locator('form button[type=submit]').click()
  await page.waitForURL(BASE + '/ops', { timeout: 8000 }); await page.waitForTimeout(500)
  const cookies = await ctx.cookies(); const sc = cookies.find((c) => c.name === 'smapsh_session')
  await step('3-ops', { me: (await me(page)).body, cookie: sc && { httpOnly: sc.httpOnly, sameSite: sc.sameSite, readableByJs: await page.evaluate(() => document.cookie.includes('smapsh_session')) } }); await shot(page, `${vp.n}-3-ops.jpg`)
  // 4. 새로고침 후 유지
  await page.reload(); await page.waitForTimeout(800); await step('4-reload', { me: (await me(page)).body?.role })

  // 5. 가입 승인(실제 DB): 카카오 가입 신청자 1명을 DB에 넣고 화면에서 승인
  const name = `신청${vp.n}-${Date.now() % 100000}`
  const uid = psql(`INSERT INTO users (id, name, gender, grade, role, status) VALUES (gen_random_uuid(), '${name}', '여', 'D조', 'member', 'pending') RETURNING id`).split('\n')[0]
  psql(`INSERT INTO user_identities (id, user_id, provider, provider_user_id) VALUES (gen_random_uuid(), '${uid}', 'kakao', 'fake-${vp.n}-${Date.now()}')`)
  await page.goto(BASE + '/ops/approvals'); await page.waitForSelector('ul[aria-label="승인 대기 신청"]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-4-approvals.jpg`)
  const row = page.locator('ul[aria-label="승인 대기 신청"] li', { hasText: name })
  await row.locator('button', { hasText: /^승인$/ }).filter({ visible: true }).first().click(); await page.waitForTimeout(900)
  await step('5-approved', { dbStatus: psql(`SELECT status || '/' || (decided_by_id IS NOT NULL) FROM users WHERE id='${uid}'`) })
  // 6. 역할 관리(슈퍼 관리자) — 승인된 신청자를 운영진으로 지정
  await page.goto(BASE + '/ops/roles'); await page.waitForSelector('[data-scr=SCR-232]'); await page.waitForTimeout(500); await shot(page, `${vp.n}-5-roles.jpg`)
  await step('6-roles', { listed: await page.locator('[data-scr=SCR-232]', { hasText: name }).count() })
  // 7. 로그아웃(개발 도구의 서버 세션 로그아웃) → 보호 화면은 로그인으로
  await page.goto(BASE + '/dev'); await page.locator('button', { hasText: '로그아웃(서버 세션)' }).click(); await page.waitForURL(/\/login/, { timeout: 5000 })
  await page.goto(BASE + '/ops'); await page.waitForTimeout(600)
  await step('7-logged-out', { me: (await me(page)).status, sessionRows: psql(`SELECT count(*) FROM auth_sessions s JOIN user_identities i ON i.user_id = s.user_id WHERE i.provider = 'dev'`) })

  // 8. 회원 세션(서버 권한 분리): 승인 회원 + 세션을 DB에 만들고 쿠키만 심음
  const token = `member-token-${vp.n}-${Date.now()}`
  const mid = psql(`INSERT INTO users (id, name, gender, grade, role, status) VALUES (gen_random_uuid(), '회원${vp.n}', '남', 'C조', 'member', 'approved') RETURNING id`).split('\n')[0]
  psql(`INSERT INTO auth_sessions (id, token_hash, user_id, expires_at) VALUES (gen_random_uuid(), encode(sha256('${token}'::bytea), 'hex'), '${mid}', now() + interval '1 day')`)
  await ctx.addCookies([{ name: 'smapsh_session', value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }])
  await page.goto(BASE + '/ops/approvals?as=admin'); await page.waitForTimeout(800)
  const apiAsAdmin = await page.evaluate(() => fetch('/api/approvals?as=admin', { credentials: 'include' }).then((x) => x.status))
  await step('8-member-blocked', { apiAsAdmin }); await shot(page, `${vp.n}-6-member-forbidden.jpg`)
  await page.goto(BASE + '/tutorial'); await page.waitForTimeout(600); await step('9-member-tutorial')
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }))

  // 10. 카카오로 시작하기 → 백엔드 → 카카오 인가 주소(실제 계정 인증은 수동)
  let kakaoUrl = null
  page.on('response', (res) => {
    if (res.url().includes('/api/auth/kakao/login') && res.status() === 302) kakaoUrl = new URL(res.headers()['location'])
  })
  await page.route('https://*.kakao.com/**', (route) => route.abort()) // 외부 카카오 페이지는 열지 않음
  await page.goto(BASE + '/login?next=%2Fops'); await page.locator('button', { hasText: '카카오로 시작하기' }).click(); await page.waitForTimeout(1500)
  r.steps['10-kakao-start'] = kakaoUrl && { host: kakaoUrl.host, redirect_uri: kakaoUrl.searchParams.get('redirect_uri'), hasState: (kakaoUrl.searchParams.get('state') || '').length >= 24, hasClientId: !!kakaoUrl.searchParams.get('client_id') }
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
