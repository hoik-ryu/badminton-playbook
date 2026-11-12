// B6 브라우저 확인(Mock, 390·1440): 튜토리얼 홈(SCR-101) → 스테이지 플레이(SCR-102: 선택·결과·정답 보기·다시 도전) → 결과(SCR-103: 저장·틀린 상황 다시 보기)
// → 나가기 확인 → 움직임 줄이기 → 운영진 명단에 통과 현황. 스테이지 시작 시간·애니메이션 프레임(헤드리스 Chromium 참고값)도 잼
// 사용: BASE=http://localhost:5175 node experiments/frontend-layout/check-b6.mjs (Mock 모드 Vite)
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(here, 'results/b6'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ path: location.pathname, st: [...document.querySelectorAll('[data-scr]')].map((e) => `${e.dataset.scr}:${e.dataset.st}`).join(' '), hScroll: document.documentElement.scrollWidth > innerWidth, vScrollPlay: document.querySelector('[data-scr=SCR-102]') ? document.documentElement.scrollHeight > innerHeight + 1 : null, nav: !!document.querySelector('nav[aria-label="주 메뉴"]') })
const db = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('smapsh.mock.db.v1')))
const choices = (page) => page.locator('[role=group][aria-label="움직임 고르기"] button')
const waitChoose = (page) => page.waitForSelector('[data-scr=SCR-102][data-phase=choose]', { timeout: 5000 })
const waitResult = (page) => page.waitForSelector('[data-scr=SCR-102][data-phase=result]', { timeout: 5000 })

// 시나리오에서 정답 글자를 화면 밖에서 알 수 없으므로, 결과로 판정 확인: 첫 번째 시도 결과의 data-verdict 사용
async function pickBy(page, verdict) {
  // 버튼을 하나씩 눌러 보지 않고, 앱 번들의 시나리오와 같은 규칙(정답 1개)을 화면에서 찾기 위해 data 속성 없이 진행:
  // 정답을 찾을 때까지 '다시 도전'으로 반복(첫 시도가 아니면 0점이 되므로 점수 확인용 스테이지에는 쓰지 않음)
  for (let i = 0; i < 4; i++) {
    await waitChoose(page)
    await choices(page).nth(i).click(); await waitResult(page)
    const v = await page.locator('[data-verdict]').getAttribute('data-verdict')
    if (v === verdict) return i
    await page.locator('button', { hasText: '다시 도전' }).click()
  }
  return -1
}

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }
  await page.goto(BASE + '/login'); await page.evaluate(() => { localStorage.removeItem('smapsh.mock.db.v1'); localStorage.setItem('smapsh.introSeen.v1', '1') })

  // 1. 홈
  await page.goto(BASE + '/tutorial?as=member'); await page.waitForSelector('[data-scr=SCR-101][data-st=SCR-101-ST1]'); await page.waitForTimeout(300)
  await step('1-home', { sections: await page.locator('[data-level] header').allTextContents(), cards: await page.locator('a[data-cmp=CMP-047]').count() }); await shot(page, `${vp.n}-1-home.jpg`)
  await page.locator('details summary', { hasText: '준비 중' }).click(); await page.waitForTimeout(200); await page.locator('details').scrollIntoViewIfNeeded(); await shot(page, `${vp.n}-2-coming-soon.jpg`)

  // 2. 플레이 시작(시작 시간: 카드 누름 → 선택 가능)
  const t0 = Date.now()
  await page.locator('a[href="/tutorial/stages/novice-2"]').click(); await waitChoose(page)
  const startMs = Date.now() - t0
  await step('2-choose', { startMs, buttons: await choices(page).allTextContents(), courtBox: await page.locator('[data-cmp=CMP-046] svg').boundingBox() }); await shot(page, `${vp.n}-3-choose.jpg`)
  // 프레임 측정: 결과 애니메이션 동안 rAF 횟수
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const tick = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(tick); else res(n) }; requestAnimationFrame(tick); document.querySelectorAll('[role=group][aria-label="움직임 고르기"] button')[2].click() }))
  await waitResult(page)
  const v1 = await page.locator('[data-verdict]').getAttribute('data-verdict')
  await step('3-result', { verdict: v1, fpsHeadless: fps }); await shot(page, `${vp.n}-4-result.jpg`)
  if (v1 !== 'correct') {
    await page.locator('button', { hasText: /움직임 보기$/ }).click(); await page.waitForTimeout(250); await shot(page, `${vp.n}-5-answer-playing.jpg`)
    await page.waitForTimeout(1200)
    await page.locator('button', { hasText: '느리게 보기(0.5배속)' }).click(); await page.waitForTimeout(500)
    await step('4-answer', { slowPressed: await page.locator('button', { hasText: '느리게 보기' }).getAttribute('aria-pressed') }); await shot(page, `${vp.n}-6-answer-slow.jpg`)
    await page.waitForTimeout(2600)
    await page.locator('button', { hasText: '다시 도전' }).click(); await waitChoose(page)
    await step('5-retry', { header: await page.locator('header p').textContent() })
    await pickBy(page, 'correct')
  }
  // 나머지 상황: 정답을 찾을 때까지(점수와 무관하게 끝까지 진행)
  await page.locator('button', { hasText: '다음 상황' }).click()
  for (let i = 1; i < 5; i++) {
    await pickBy(page, 'correct')
    await page.locator('button', { hasText: i === 4 ? '결과 보기' : '다음 상황' }).click()
  }
  // 3. 결과
  await page.waitForSelector('[data-scr=SCR-103]'); await page.waitForSelector('text=기록을 저장했습니다', { timeout: 5000 })
  const saved = (await db(page)).tutorialProgress['u-member']['novice-2']
  await step('6-stage-result', { result: (await page.locator('[aria-label="이번 결과"]').textContent()).replace(/\s+/g, ' '), saved, nav: undefined }); await shot(page, `${vp.n}-7-stage-result.jpg`)
  const missed = page.locator('[aria-labelledby=missed-title] li button').first()
  if (await missed.count()) {
    await missed.click(); await page.waitForTimeout(1500); await shot(page, `${vp.n}-8-missed-replay.jpg`)
    // 재생이 끝나면 '다시 보기'가 다시 활성(끝없이 재생되지 않음)
    r.steps['6b-replay-ends'] = { replayEnabled: await page.locator('[aria-labelledby=missed-title] button', { hasText: '다시 보기' }).isEnabled() }
  }
  // 4. 홈 반영
  await page.locator('a', { hasText: '홈' }).click(); await page.waitForSelector('[data-scr=SCR-101]:not([data-st=SCR-101-ST2])')
  await step('7-home-after', { novice: await page.locator('[data-level=novice] header').textContent(), card: await page.locator('a[href="/tutorial/stages/novice-2"]').getAttribute('aria-label') })

  // 5. 나가기 확인 + 뒤로 가기
  await page.locator('a[href="/tutorial/stages/novice-3"]').click(); await waitChoose(page)
  await page.locator('button[aria-label=나가기]').click(); await page.waitForSelector('[role=alertdialog]'); await shot(page, `${vp.n}-9-exit-confirm.jpg`)
  const exitTitle = await page.locator('[role=alertdialog] h2').textContent()
  await page.locator('[role=alertdialog] button', { hasText: '계속하기' }).click(); await page.waitForTimeout(300)
  await page.goBack(); await page.waitForSelector('[role=alertdialog]', { timeout: 3000 })
  await page.locator('[role=alertdialog] button', { hasText: '나가기' }).click(); await page.waitForTimeout(600)
  await step('8-exit', { exitTitle, novice3Saved: !!(await db(page)).tutorialProgress['u-member']['novice-3'] })

  // 6. 움직임 줄이기: 선택하면 결과가 바로
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(BASE + '/tutorial/stages/beginner-2'); await waitChoose(page)
  const t1 = Date.now(); await choices(page).first().click(); await waitResult(page)
  await step('9-reduced-motion', { resultMs: Date.now() - t1 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  // 7. 운영진 명단의 통과 현황(같은 기록)
  await page.goto(BASE + '/ops/roster?as=admin'); await page.waitForSelector('[data-scr=SCR-211]'); await page.waitForTimeout(400)
  await page.locator('[data-scr=SCR-211] button, [data-scr=SCR-211] a', { hasText: '김가람' }).first().click(); await page.waitForTimeout(800)
  await step('10-ops-roster', { status: (await page.locator('[data-cmp=CMP-045]').first().textContent().catch(() => null)) })
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
