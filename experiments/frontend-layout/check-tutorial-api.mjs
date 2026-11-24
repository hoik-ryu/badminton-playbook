// I2 튜토리얼 진행 실제 API 브라우저 확인(390·1440): 운영진 로그인 → 스테이지 플레이 → 결과 저장(DB)
// → 새로고침 유지 → 로그아웃·재로그인 유지 → 다른 기기(새 브라우저)에서도 유지 → 낮은 점수 재플레이에도 최고 점수 유지 → 운영진 명단 통과 수
// (2026-11-24 현행화) 11-20 튜토리얼 개편(서버 판정·경기장 칸 선택, 스테이지 id `<과정>-<순번>-v<버전>`, ASM-033)에 맞춤.
//   검증 목적·흐름(저장 → 새로고침·재로그인·다른 기기 유지 → 낮은 점수에도 최고 점수 유지 → 명단 현황)은 그대로이고, 각 단계에 합격 조건을 두어 실패하면 exit 1.
//   선택: 경기장 칸(.sc-hit, aria-label 'N번 칸, …')을 누름. 칸이 44px보다 작으면 '이 칸으로 이동'으로 확정(ST12). 판정은 서버(POST /runs/{id}/judge)
//   정답 칸: 서버 콘텐츠 원본(backend/app/modules/tutorial/content/<id>.json, 공개 API에는 없음 — 테스트가 저장소 파일을 읽음)
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
const CONTENT = path.resolve(here, '../../backend/app/modules/tutorial/content')
const situations = (stage) => JSON.parse(fs.readFileSync(path.join(CONTENT, `${stage}.json`), 'utf8')).situations
const fails = []
const expect = (r, name, ok, info) => { r.checks[name] = ok ? 'pass' : `FAIL ${JSON.stringify(info)}`; if (!ok) fails.push(`${r.vp}:${name}`) }
const devId = () => psql("select user_id from user_identities where provider='dev'")
const dbRow = (stage) => psql(`select passed||'/'||best||'/'||(first_passed_at is not null) from tutorial_progress where user_id='${devId()}' and stage_id='${stage}'`)

async function login(ctx) {
  const page = await ctx.newPage()
  await page.goto(BASE + '/login'); await page.evaluate(() => localStorage.setItem('smapsh.introSeen.v1', '1'))
  await page.goto(BASE + '/login'); await page.locator('button', { hasText: '운영진 로그인하기' }).click()
  await page.fill('input[name=username]', 'super_admin'); await page.fill('input[name=password]', PASSWORD); await page.locator('form button[type=submit]').click(); await page.waitForURL(BASE + '/ops')
  return page
}
// mode=best: 상황마다 정답 칸(첫 상황만 일부러 틀린 칸 → '다시 도전' → 정답, 재도전한 상황은 0점) / mode=allWrongish: 매번 틀린 칸(점수 낮게)
const wrongCell = (sit) => [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => n !== sit.answer && !(sit.allow ?? []).includes(n))
async function pickCell(page, no) {
  await page.locator(`.sc-hit[aria-label^="${no}번 칸,"]`).click()
  const move = page.locator('[data-testid=bottom-sheet] button', { hasText: '이 칸으로 이동' })
  if (await move.count()) await move.click() // 칸이 44px 미만인 화면의 확인 단계(ST12)
  await page.waitForSelector('[data-scr=SCR-102][data-phase=judged]', { timeout: 8000 })
}
async function playStage(page, stageId, mode) {
  const sits = situations(stageId)
  await page.goto(`${BASE}/tutorial/stages/${stageId}`)
  for (let i = 0; i < sits.length; i++) {
    await page.waitForSelector('[data-scr=SCR-102][data-phase=choose]', { timeout: 8000 }) // 재생(play) 뒤 선택 대기
    if (mode === 'allWrongish') {
      await pickCell(page, wrongCell(sits[i]))
    } else {
      if (i === 0) {
        await pickCell(page, wrongCell(sits[i]))
        await page.locator('[data-testid=bottom-sheet] button', { hasText: '다시 도전' }).click(); await page.waitForSelector('[data-scr=SCR-102][data-phase=choose]', { timeout: 8000 })
      }
      await pickCell(page, sits[i].answer)
      if (await page.locator('[data-testid=bottom-sheet] button', { hasText: '다시 도전' }).count()) throw new Error(`정답 칸 ${sits[i].answer}이 정답으로 판정되지 않음(상황 ${i + 1})`)
    }
    await page.locator('[data-testid=bottom-sheet] button', { hasText: i === sits.length - 1 ? '결과 보기' : '다음 상황' }).click()
  }
  await page.waitForSelector('[data-scr=SCR-103][data-save=saved]', { timeout: 8000 }) // 서버 저장 완료(ST1)
  return { text: (await page.locator('[aria-label="이번 결과"]').textContent()).replace(/\s+/g, ' '), total: sits.length }
}

const browser = await chromium.launch(); const report = {}
const blocked = guardBrowser(browser, BASE) // BASE 밖 API 요청 차단
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  psql(`delete from tutorial_progress where user_id=(select user_id from user_identities where provider='dev')`) // 이 확인용 계정 기록만 초기화(임시 DB)
  const stage = vp.m ? 'intro-1-v1' : 'starter-2-v1' // 개편 전 beginner-1(입문자)·novice-2(왕초급)에 해당
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  let page = await login(ctx); await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []; const r = (report[vp.n] = { vp: vp.n, steps: {}, checks: {}, errors })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }

  // 1. 처음: 기록 없음
  await page.goto(BASE + '/tutorial'); await page.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  await step('1-empty', { db: dbRow(stage) })
  expect(r, '1-no-record', r.steps['1-empty'].db === '', r.steps['1-empty'].db)
  // 2. 플레이(모두 정답 찾기 — 재도전한 상황은 0점) → 결과 저장
  const result1 = await playStage(page, stage, 'best')
  await step('2-saved', { result: result1.text, db: dbRow(stage) }); await shot(page, `${vp.n}-1-result.jpg`)
  const best1 = result1.total - 1 // 첫 상황만 재도전(0점)
  expect(r, '2-saved-passed-best', r.steps['2-saved'].db === `true/${best1}/true`, r.steps['2-saved'].db)
  // 3. 새로고침 후 홈 반영
  await page.goto(BASE + '/tutorial'); await page.reload(); await page.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  const card = async () => page.locator(`a[href="/tutorial/stages/${stage}"]`).getAttribute('aria-label')
  await step('3-after-reload', { card: await card() }); await shot(page, `${vp.n}-2-home.jpg`)
  expect(r, '3-home-shows-passed', /통과/.test(r.steps['3-after-reload'].card ?? ''), r.steps['3-after-reload'].card)
  // 4. 낮은 점수로 다시 → 최고 점수·통과 유지
  const result2 = await playStage(page, stage, 'allWrongish')
  await step('4-lower-score', { result: result2.text, db: dbRow(stage) })
  expect(r, '4-best-kept', r.steps['4-lower-score'].db === `true/${best1}/true` && new RegExp(`(^|\\D)0\\s*/\\s*${result2.total}(\\D|$)`).test(result2.text), r.steps['4-lower-score'])
  // 5. 로그아웃 → 재로그인 → 유지
  await page.goto(BASE + '/me'); await page.locator('button', { hasText: /^로그아웃$/ }).click(); await page.waitForURL(/\/login/)
  await page.close(); page = await login(ctx); await page.goto(BASE + '/tutorial'); await page.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  await step('5-relogin', { card: await card() })
  expect(r, '5-relogin-kept', r.steps['5-relogin'].card === r.steps['3-after-reload'].card, r.steps['5-relogin'].card)
  // 6. 다른 기기(새 브라우저 컨텍스트, 저장소 비어 있음)
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } }); const op = await login(other)
  await op.goto(BASE + '/tutorial'); await op.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  r.steps['6-other-device'] = { card: await op.locator(`a[href="/tutorial/stages/${stage}"]`).getAttribute('aria-label'), localProgressInStorage: await op.evaluate(() => (localStorage.getItem('smapsh.mock.db.v1') ?? '').includes('tutorialProgress')) }
  await other.close()
  expect(r, '6-other-device-kept', r.steps['6-other-device'].card === r.steps['3-after-reload'].card && !r.steps['6-other-device'].localProgressInStorage, r.steps['6-other-device'])
  // 7. 운영진 명단 회원 현황(같은 계정의 통과 수)
  const status = await page.evaluate((id) => fetch(`/api/roster/members/${id}/status`, { credentials: 'include' }).then((x) => x.json()), devId())
  await step('7-roster-status', { tutorial: status.tutorial })
  const course = vp.m ? 'intro' : 'starter'
  expect(r, '7-roster-pass-count', (status.tutorial ?? []).some((c) => c.course === course && c.passed === 1), status.tutorial)
  expect(r, 'no-page-errors', errors.length === 0, errors)
  await ctx.close()
}
await browser.close()
reportBlocked(blocked)
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
console.log(fails.length ? `FAILED: ${fails.join(', ')}` : 'ALL CHECKS PASSED')
process.exit(fails.length ? 1 : 0)
