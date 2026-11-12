// 마이페이지 로그아웃 브라우저 확인(실제 API 모드, 390·1440):
// 개발용 super_admin 로그인 → /me → 로그아웃 → /login, 서버 세션 삭제·쿠키 제거, 뒤로 가기·새로고침·/ops 직접 접근 차단
// 카카오 사용자(DB에 카카오 연결 회원 + 세션) 로그아웃도 동일, 이후 '카카오로 시작하기' → 새 인가 흐름(302 → kauth)
// 사용: DEV_ADMIN_PASSWORD=... node experiments/frontend-layout/check-logout.mjs (BASE 기본 http://localhost:5174)
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
const psql = (sql) => execFileSync(PSQL, [...(process.env.PSQL_ARGS || '-h 127.0.0.1 -p 55433 -U app app').split(' '), '-Atc', sql]).toString().trim().split('\n')[0]
const OUT = path.join(here, 'results/logout'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const where = (page) => new URL(page.url()).pathname
const meStatus = (page) => page.evaluate(() => fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.status))
const sessionCookie = async (ctx) => !!(await ctx.cookies()).find((c) => c.name === 'smapsh_session')

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { errors })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => m.type() === 'error' && !/401|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 200)))
  await page.goto(BASE + '/login'); await page.evaluate(() => localStorage.setItem('smapsh.introSeen.v1', '1'))

  // A. 개발용 super_admin
  await page.goto(BASE + '/login'); await page.locator('button', { hasText: '운영진 로그인하기' }).click()
  await page.fill('input[name=username]', 'super_admin'); await page.fill('input[name=password]', PASSWORD); await page.locator('form button[type=submit]').click()
  await page.waitForURL(BASE + '/ops')
  await page.locator('nav a', { hasText: '마이페이지' }).filter({ visible: true }).first().click(); await page.waitForURL(BASE + '/me'); await page.waitForTimeout(400)
  const devUid = psql(`SELECT user_id FROM user_identities WHERE provider='dev'`)
  const before = psql(`SELECT count(*) FROM auth_sessions WHERE user_id='${devUid}'`)
  r.devMe = { path: where(page), text: (await page.locator('[data-scr=SCR-121]').textContent()).slice(0, 60), cookie: await sessionCookie(ctx), sessionsBefore: before }
  await shot(page, `${vp.n}-1-mypage.jpg`)
  await page.locator('button', { hasText: /^로그아웃$/ }).click(); await page.waitForURL(/\/login/); await page.waitForTimeout(300)
  r.devLogout = { path: where(page), cookie: await sessionCookie(ctx), me: await meStatus(page), sessionsAfter: psql(`SELECT count(*) FROM auth_sessions WHERE user_id='${devUid}'`) }
  await shot(page, `${vp.n}-2-after-logout.jpg`)
  await page.goBack(); await page.waitForTimeout(800); r.back = where(page)
  await page.reload(); await page.waitForTimeout(800); r.reload = where(page)
  await page.goto(BASE + '/ops'); await page.waitForTimeout(800); r.opsDirect = page.url().replace(BASE, '')
  await page.goto(BASE + '/me'); await page.waitForTimeout(800); r.meDirect = where(page)

  // B. 카카오 사용자(카카오 연결 회원 + 서버 세션)
  const token = `kakao-session-${vp.n}-${Date.now()}`
  const uid = psql(`INSERT INTO users (id, name, gender, grade, role, status) VALUES (gen_random_uuid(), '카카오${vp.n}', '여', 'C조', 'member', 'approved') RETURNING id`)
  psql(`INSERT INTO user_identities (id, user_id, provider, provider_user_id) VALUES (gen_random_uuid(), '${uid}', 'kakao', 'k-${vp.n}-${Date.now()}')`)
  psql(`INSERT INTO auth_sessions (id, token_hash, user_id, expires_at) VALUES (gen_random_uuid(), encode(sha256('${token}'::bytea), 'hex'), '${uid}', now() + interval '1 day')`)
  await ctx.addCookies([{ name: 'smapsh_session', value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }])
  await page.goto(BASE + '/me'); await page.waitForTimeout(600)
  r.kakaoMe = where(page)
  await page.locator('button', { hasText: /^로그아웃$/ }).click(); await page.waitForURL(/\/login/); await page.waitForTimeout(300)
  r.kakaoLogout = { path: where(page), cookie: await sessionCookie(ctx), me: await meStatus(page), sessionsAfter: psql(`SELECT count(*) FROM auth_sessions WHERE user_id='${uid}'`) }
  await page.reload(); await page.waitForTimeout(600); r.kakaoReload = where(page)

  // C. 로그아웃 뒤 카카오로 시작하기 → 새 인가 흐름
  let start = null
  page.on('response', (res) => { if (res.url().includes('/api/auth/kakao/login') && res.status() === 302) start = new URL(res.headers().location) })
  await page.route('https://*.kakao.com/**', (route) => route.abort())
  await page.locator('button', { hasText: '카카오로 시작하기' }).click(); await page.waitForTimeout(1500)
  r.kakaoRestart = start && { host: start.host, hasState: (start.searchParams.get('state') || '').length >= 24 }
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
