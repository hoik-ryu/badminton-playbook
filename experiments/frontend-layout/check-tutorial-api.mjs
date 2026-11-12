// I2 튜토리얼 진행 실제 API 브라우저 확인(390·1440): 운영진 로그인 → 스테이지 플레이 → 결과 저장(DB)
// → 새로고침 유지 → 로그아웃·재로그인 유지 → 다른 기기(새 브라우저)에서도 유지 → 낮은 점수 재플레이에도 최고 점수 유지 → 운영진 명단 통과 수
// 준비: API 모드 Vite(BASE, 기본 http://localhost:5174) + 백엔드 (APP_ENV=e2e) + 마이그레이션된 임시 DB(PSQL_ARGS, 기본 smapsh_e2e)
// 사용: DEV_ADMIN_PASSWORD=... node experiments/frontend-layout/check-tutorial-api.mjs (비밀번호는 환경변수로만)
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
const psql = (sql) => execFileSync(process.env.PSQL || '/opt/homebrew/opt/postgresql@17/bin/psql', [...(process.env.PSQL_ARGS || '-h 127.0.0.1 -p 55433 -U app smapsh_e2e').split(' '), '-Atc', sql]).toString().trim()
const OUT = path.join(here, 'results/tutorial-api'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ path: location.pathname, st: [...document.querySelectorAll('[data-scr]')].map((e) => `${e.dataset.scr}:${e.dataset.st}`).join(' '), hScroll: document.documentElement.scrollWidth > innerWidth })
const devId = () => psql("select user_id from user_identities where provider='dev'")
const dbRow = (stage) => psql(`select passed||'/'||best||'/'||(first_passed_at is not null) from tutorial_progress where user_id='${devId()}' and stage_id='${stage}'`)

async function login(ctx) {
  const page = await ctx.newPage()
  await page.goto(BASE + '/login'); await page.evaluate(() => localStorage.setItem('smapsh.introSeen.v1', '1'))
  await page.goto(BASE + '/login'); await page.locator('button', { hasText: '운영진 로그인하기' }).click()
  await page.fill('input[name=username]', 'super_admin'); await page.fill('input[name=password]', PASSWORD); await page.locator('form button[type=submit]').click(); await page.waitForURL(BASE + '/ops')
  return page
}
// mode=best: 정답이 나올 때까지 다시 도전(재도전한 상황은 0점) / mode=allWrongish: 매번 마지막 버튼(점수 낮게)
async function playStage(page, stageId, mode) {
  await page.goto(`${BASE}/tutorial/stages/${stageId}`)
  for (let i = 0; i < 5; i++) {
    await page.waitForSelector('[data-scr=SCR-102][data-phase=choose]', { timeout: 8000 })
    if (mode === 'allWrongish') {
      await page.locator('[role=group][aria-label="움직임 고르기"] button').last().click()
    } else {
      for (let b = 0; b < 4; b++) {
        await page.locator('[role=group][aria-label="움직임 고르기"] button').nth(b).click()
        await page.waitForSelector('[data-scr=SCR-102][data-phase=result]')
        if ((await page.locator('[data-verdict]').getAttribute('data-verdict')) === 'correct') break
        await page.locator('button', { hasText: '다시 도전' }).click(); await page.waitForSelector('[data-scr=SCR-102][data-phase=choose]')
      }
    }
    await page.waitForSelector('[data-scr=SCR-102][data-phase=result]')
    await page.locator('button', { hasText: i === 4 ? '결과 보기' : '다음 상황' }).click()
  }
  await page.waitForSelector('[data-scr=SCR-103]'); await page.waitForSelector('text=기록을 저장했습니다', { timeout: 8000 })
  return (await page.locator('[aria-label="이번 결과"]').textContent()).replace(/\s+/g, ' ')
}

const browser = await chromium.launch(); const report = {}
const blocked = guardBrowser(browser, BASE) // BASE 밖 API 요청 차단
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  psql(`delete from tutorial_progress where user_id=(select user_id from user_identities where provider='dev')`) // 이 확인용 계정 기록만 초기화(임시 DB)
  const stage = vp.m ? 'beginner-1' : 'novice-2'
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  let page = await login(ctx); await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }

  // 1. 처음: 기록 없음
  await page.goto(BASE + '/tutorial'); await page.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  await step('1-empty')
  // 2. 플레이(모두 정답 찾기 — 재도전한 상황은 0점) → 결과 저장
  const result1 = await playStage(page, stage, 'best')
  await step('2-saved', { result: result1, db: dbRow(stage) }); await shot(page, `${vp.n}-1-result.jpg`)
  // 3. 새로고침 후 홈 반영
  await page.goto(BASE + '/tutorial'); await page.reload(); await page.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  const card = async () => page.locator(`a[href="/tutorial/stages/${stage}"]`).getAttribute('aria-label')
  await step('3-after-reload', { card: await card() }); await shot(page, `${vp.n}-2-home.jpg`)
  // 4. 낮은 점수로 다시 → 최고 점수·통과 유지
  const result2 = await playStage(page, stage, 'allWrongish')
  await step('4-lower-score', { result: result2, db: dbRow(stage) })
  // 5. 로그아웃 → 재로그인 → 유지
  await page.goto(BASE + '/me'); await page.locator('button', { hasText: /^로그아웃$/ }).click(); await page.waitForURL(/\/login/)
  await page.close(); page = await login(ctx); await page.goto(BASE + '/tutorial'); await page.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  await step('5-relogin', { card: await card() })
  // 6. 다른 기기(새 브라우저 컨텍스트, 저장소 비어 있음)
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } }); const op = await login(other)
  await op.goto(BASE + '/tutorial'); await op.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  r.steps['6-other-device'] = { card: await op.locator(`a[href="/tutorial/stages/${stage}"]`).getAttribute('aria-label'), localProgressInStorage: await op.evaluate(() => (localStorage.getItem('smapsh.mock.db.v1') ?? '').includes('tutorialProgress')) }
  await other.close()
  // 7. 운영진 명단 회원 현황(같은 계정의 통과 수)
  const status = await page.evaluate((id) => fetch(`/api/roster/members/${id}/status`, { credentials: 'include' }).then((x) => x.json()), devId())
  await step('7-roster-status', { tutorial: status.tutorial })
  await ctx.close()
}
await browser.close()
reportBlocked(blocked)
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
