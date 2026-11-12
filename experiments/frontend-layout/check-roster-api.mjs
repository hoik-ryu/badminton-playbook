// I1 명단 실제 API 브라우저 확인(390·1440): 운영진 로그인 → 명단(DB) → 게스트 추가 → 회원 직접 추가 → 점수·급수 수정
// → 동시 수정 충돌(그사이 DB에서 바꿈) → 회원 본인 프로필 변경이 명단에 반영 → 게스트 소프트 삭제 → 회원은 명단 접근 불가
// 준비: API 모드 Vite(BASE, 기본 http://localhost:5174) + 백엔드 (APP_ENV=e2e) + 마이그레이션된 임시 DB(PSQL_ARGS, 기본 smapsh_e2e)
// 사용: DEV_ADMIN_PASSWORD=... node experiments/frontend-layout/check-roster-api.mjs (비밀번호는 환경변수로만)
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
assertTestPsqlArgs(process.env.PSQL_ARGS || '-h 127.0.0.1 -p 55433 -U app smapsh_e2e')
const psql = (sql) => execFileSync(process.env.PSQL || '/opt/homebrew/opt/postgresql@17/bin/psql', [...(process.env.PSQL_ARGS || '-h 127.0.0.1 -p 55433 -U app smapsh_e2e').split(' '), '-Atc', sql]).toString().trim().split('\n')[0]
const OUT = path.join(here, 'results/roster-api'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ path: location.pathname, st: [...document.querySelectorAll('[data-scr]')].map((e) => `${e.dataset.scr}:${e.dataset.st}`).join(' '), hScroll: document.documentElement.scrollWidth > innerWidth })
const vis = (page, sel, opts) => page.locator(sel, opts).filter({ visible: true }).first()
const sheet = '[data-cmp=CMP-021], [data-cmp=CMP-024]' // 모바일 하단 시트 / PC 옆 패널

const browser = await chromium.launch(); const report = {}
const blocked = guardBrowser(browser, BASE) // BASE 밖 API 요청 차단
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.on('console', (m) => m.type() === 'error' && !/40[19]|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }
  const tag = `${vp.n}-${Date.now() % 100000}`
  await page.goto(BASE + '/login'); await page.evaluate(() => localStorage.setItem('smapsh.introSeen.v1', '1'))
  await page.goto(BASE + '/login'); await page.locator('button', { hasText: '운영진 로그인하기' }).click()
  await page.fill('input[name=username]', 'super_admin'); await page.fill('input[name=password]', PASSWORD); await page.locator('form button[type=submit]').click(); await page.waitForURL(BASE + '/ops')

  // 1. 명단(DB)
  await page.goto(BASE + '/ops/roster'); await page.waitForSelector('[data-scr=SCR-211]:not([data-st=SCR-211-ST2])'); await page.waitForTimeout(300)
  await step('1-roster', { members: await page.locator('ul[aria-label=회원] li').count(), dbMembers: Number(psql("select count(*) from users where status='approved'")) }); await shot(page, `${vp.n}-1-roster.jpg`)
  // 2. 게스트 추가
  await vis(page, '[data-testid=fab]').click().catch(async () => { await vis(page, 'button', { hasText: /추가/ }).click() })
  await page.waitForSelector('[data-testid=add-sheet]')
  await page.fill('[data-testid=add-sheet] input[name=name]', `손님${tag}`); await page.locator('[data-testid=add-sheet] [role=radio]', { hasText: '여' }).click(); await page.locator('[data-testid=add-sheet] [role=radio]', { hasText: '입문자' }).click()
  await page.locator('[data-testid=add-sheet] [role=radio]', { hasText: /^4$/ }).click()
  await page.locator('[data-testid=add-sheet] button', { hasText: '추가' }).click(); await page.waitForTimeout(800)
  const guestId = psql(`select id from guests where name='손님${tag}'`)
  await step('2-guest-added', { dbScore: psql(`select score from guests where id='${guestId}'`), listed: await page.locator('ul[aria-label=게스트] li', { hasText: `손님${tag}` }).count() })
  // 3. 게스트 편집(급수·점수) → DB 반영
  await page.locator('ul[aria-label=게스트] li button', { hasText: `손님${tag}` }).first().click(); await page.waitForSelector(sheet)
  await vis(page, '[role=radio]', { hasText: '초심' }).click(); await vis(page, '[role=radio]', { hasText: /^6$/ }).click()
  await vis(page, 'button', { hasText: /^저장$/ }).click(); await page.waitForTimeout(900)
  await step('3-guest-edited', { db: psql(`select grade||'/'||score from guests where id='${guestId}'`) }); await shot(page, `${vp.n}-2-guest-edited.jpg`)
  if (vp.m) await page.waitForSelector('[data-cmp=CMP-021]', { state: 'detached', timeout: 3000 }).catch(() => {})
  // 4. 동시 수정 충돌: 편집을 연 뒤 DB에서 다른 운영진이 바꾼 것처럼 수정 → 저장
  await page.locator('ul[aria-label=게스트] li button', { hasText: `손님${tag}` }).first().click(); await page.waitForSelector(sheet); await page.waitForTimeout(300)
  psql(`update guests set grade='A조' where id='${guestId}'`)
  await vis(page, '[role=radio]', { hasText: '왕초심' }).click(); await vis(page, 'button', { hasText: /^저장$/ }).click(); await page.waitForTimeout(1200)
  await step('4-conflict', { notice: await vis(page, '[data-cmp=CMP-023]').textContent().catch(() => null), db: psql(`select grade from guests where id='${guestId}'`), formGrade: await vis(page, '[role=radio][aria-checked=true]', { hasText: /조|심|자/ }).textContent().catch(() => null) }); await shot(page, `${vp.n}-3-conflict.jpg`)
  if (vp.m) { await vis(page, 'button[aria-label=닫기]').click(); await page.waitForTimeout(400); if (await page.locator('[role=alertdialog]').count()) await page.locator('[role=alertdialog] button', { hasText: /버리기|닫기/ }).click(); await page.waitForTimeout(400) }
  // 5. 회원 본인 프로필 변경 → 명단 반영(회원 세션은 DB에 직접 만듦)
  const token = `roster-${tag}`
  const mid = psql(`INSERT INTO users (id, name, gender, grade, role, status) VALUES (gen_random_uuid(), '회원${tag}', '남', 'D조', 'member', 'approved') RETURNING id`)
  psql(`INSERT INTO auth_sessions (id, token_hash, user_id, expires_at) VALUES (gen_random_uuid(), encode(sha256('${token}'::bytea), 'hex'), '${mid}', now() + interval '1 day')`)
  const memberCtx = await browser.newContext(); await memberCtx.addCookies([{ name: 'smapsh_session', value: token, url: BASE, httpOnly: true, sameSite: 'Lax' }])
  const mp = await memberCtx.newPage(); await mp.goto(BASE + '/me')
  const put2 = await mp.evaluate((name) => fetch('/api/me/profile', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, gender: '남', grade: 'B조' }) }).then((x) => x.status), `회원${tag}`)
  const memberRoster = await mp.evaluate(() => fetch('/api/roster', { credentials: 'include' }).then((x) => x.status))
  await memberCtx.close()
  await page.goto(BASE + '/ops/roster'); await page.waitForSelector('[data-scr=SCR-211]:not([data-st=SCR-211-ST2])'); await page.waitForTimeout(300)
  await step('5-profile-reflected', { put: put2, memberRoster, row: await page.locator('ul[aria-label=회원] li', { hasText: `회원${tag}` }).textContent() })
  // 6. 게스트 소프트 삭제
  await page.locator('ul[aria-label=게스트] li button', { hasText: `손님${tag}` }).first().click(); await page.waitForSelector(sheet)
  await vis(page, 'button', { hasText: '게스트 삭제' }).click(); await page.waitForSelector('[role=alertdialog]'); await page.locator('[role=alertdialog] button', { hasText: '삭제' }).click(); await page.waitForTimeout(900)
  await step('6-guest-deleted', { listed: await page.locator('ul[aria-label=게스트] li', { hasText: `손님${tag}` }).count(), dbRowKept: psql(`select (deleted_at is not null)::text from guests where id='${guestId}'`) }); await shot(page, `${vp.n}-4-after-delete.jpg`)
  await ctx.close()
}
await browser.close()
reportBlocked(blocked)
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
