// 실제 환경(5173 API 모드 + 실제 DB) 카카오 경계 자동 확인 — 실제 카카오 계정 인증 없이 가능한 구간만.
// DB에 테스트 행을 넣지 않음(개발용 로그인·로그아웃 세션만 생김). 비밀값은 출력하지 않음.
// - 시작: 버튼 → /api/auth/kakao/login → 302 kauth(state·redirect_uri) → 카카오 로그인 페이지(KOE 오류 없음)
// - 카카오에서 뒤로 가기 → 로그인 버튼이 로딩에 멈추지 않는지(bfcache)
// - 취소(access_denied)·state 위조·잘못된 인가 코드(실제 카카오 토큰 교환 KOE320) → /login 실패 안내, 실패 횟수 2회째 다른 브라우저 안내
// - 무효 세션 쿠키 → 보호 화면 차단 / 개발용 운영진 로그인·로그아웃 유지
// 사용: DEV_ADMIN_PASSWORD=... node experiments/frontend-layout/check-kakao-live.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(here, 'results/kakao-live'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const where = (page) => { const u = new URL(page.url()); return u.origin === BASE ? u.pathname + u.search : `${u.host}${u.pathname}` }

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { errors })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/login'); await page.evaluate(() => { localStorage.setItem('smapsh.introSeen.v1', '1'); localStorage.removeItem('smapsh.kakaoFailCount') })

  // 1. 시작 → 실제 카카오 로그인 페이지
  let start = null
  page.on('response', (res) => { if (res.url().includes('/api/auth/kakao/login') && res.status() === 302) start = new URL(res.headers().location) })
  await page.goto(BASE + '/login?next=%2Fme'); await page.waitForTimeout(500)
  await page.locator('button', { hasText: '카카오로 시작하기' }).click()
  await page.waitForURL(/accounts\.kakao\.com|kauth\.kakao\.com/, { timeout: 15000 }); await page.waitForTimeout(1500)
  const html = await page.content()
  r.start = { authorizeHost: start?.host, redirectUri: start?.searchParams.get('redirect_uri'), state: (start?.searchParams.get('state') || '').length >= 24, kakaoPage: where(page), koe: (html.match(/KOE\d{3}/g) || []).join(',') || null }
  await shot(page, `${vp.n}-1-kakao-login-page.jpg`)
  // 2. 카카오 화면에서 뒤로 가기 → 로그인 버튼 상태
  await page.goBack(); await page.waitForTimeout(1200)
  const btn = page.locator('button', { hasText: '카카오로 시작하기' })
  r.backFromKakao = { path: where(page), busy: await btn.getAttribute('aria-busy'), disabled: await btn.isDisabled() }
  await shot(page, `${vp.n}-2-back-from-kakao.jpg`)

  // 3. 취소(access_denied) → 실패 안내 1회
  await page.goto(BASE + '/api/auth/kakao/callback?error=access_denied&error_description=User%20denied'); await page.waitForTimeout(800)
  r.cancel = { path: where(page), notice: await page.locator('[data-cmp=CMP-023]').first().textContent().catch(() => null) }
  await shot(page, `${vp.n}-3-cancel.jpg`)
  // 4. state 위조 → 실패(2회째: 다른 브라우저 안내)
  await page.goto(BASE + '/api/auth/kakao/callback?code=abc&state=forged'); await page.waitForTimeout(800)
  r.forgedState = { path: where(page), notice: await page.locator('[data-cmp=CMP-023]').first().textContent().catch(() => null) }
  // 5. 올바른 state + 잘못된 인가 코드 → 백엔드가 실제 카카오에 토큰 교환(KOE320) → 실패
  let st = null
  await page.route('https://*.kakao.com/**', (route) => route.abort())
  page.on('response', (res) => { if (res.url().includes('/api/auth/kakao/login') && res.status() === 302) st = new URL(res.headers().location).searchParams.get('state') })
  await page.goto(BASE + '/login'); await page.locator('button', { hasText: '카카오로 시작하기' }).click(); await page.waitForTimeout(1500)
  await page.unroute('https://*.kakao.com/**')
  await page.goto(`${BASE}/api/auth/kakao/callback?code=invalid-code-from-check&state=${st}`); await page.waitForTimeout(1500)
  r.badCode = { gotState: !!st, path: where(page), session: !!(await ctx.cookies()).find((c) => c.name === 'smapsh_session') }

  // 6. 무효 세션 쿠키 → 보호 화면 차단
  await ctx.addCookies([{ name: 'smapsh_session', value: 'invalid-session-token', url: BASE, httpOnly: true, sameSite: 'Lax' }])
  await page.goto(BASE + '/ops'); await page.waitForTimeout(800); r.invalidSessionOps = where(page)
  await page.goto(BASE + '/me'); await page.waitForTimeout(800); r.invalidSessionMe = where(page)
  await ctx.clearCookies()

  // 7. 개발용 운영진 로그인·로그아웃(유지 확인)
  if (process.env.DEV_ADMIN_PASSWORD) {
    await page.goto(BASE + '/login'); await page.locator('button', { hasText: '운영진 로그인하기' }).click()
    await page.fill('input[name=username]', 'super_admin'); await page.fill('input[name=password]', process.env.DEV_ADMIN_PASSWORD); await page.locator('form button[type=submit]').click()
    await page.waitForURL(BASE + '/ops', { timeout: 8000 }).catch(() => {})
    r.devLogin = where(page)
    await page.goto(BASE + '/ops/approvals'); await page.waitForTimeout(800); r.approvalsScreen = await page.locator('[data-scr=SCR-231]').getAttribute('data-st')
    await page.goto(BASE + '/me'); await page.locator('button', { hasText: /^로그아웃$/ }).click(); await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {})
    await page.goto(BASE + '/ops'); await page.waitForTimeout(800); r.afterLogout = where(page)
  }
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
