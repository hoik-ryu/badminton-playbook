// B4 브라우저 확인(dev 서버 5173, Mock): 청백전 목록 → 만들기(팀전) → 참가자·팀(배정안·점수 입력 SCR-214) → 경기 수 → 대진 생성 → 교체 → 확정
// → 결과 기록·종료 비활성 → 확정 후 교체 → 종료·최종 순위 / cm-1 중도 귀가 → 대체 선수(SCR-226) / 권한(회원·비로그인).
// 사용: node experiments/frontend-layout/check-b4.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const BASE = process.env.BASE || 'http://localhost:5173'
const OUT = path.join(here, 'results/b4'); fs.mkdirSync(OUT, { recursive: true })
const shot = async (page, f) => { const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); await s.detach() }
const info = () => ({ st: [...document.querySelectorAll('[data-scr]')].map((e) => `${e.dataset.scr}:${e.dataset.st}`).join(' '), hScroll: document.documentElement.scrollWidth > innerWidth })
const db = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('smapsh.mock.db.v1')))
const vis = (page, sel, opts) => page.locator(sel, opts).filter({ visible: true }).first()
const newest = (d) => d.clubMatches.find((m) => !['cm-1', 'cm-2', 'cm-3'].includes(m.id))

const browser = await chromium.launch(); const report = {}
for (const vp of [{ n: 'm390', w: 390, h: 844, m: true }, { n: 'pc1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.m ? 3 : 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: 'ko-KR' })
  const page = await ctx.newPage(); const errors = []; const r = (report[vp.n] = { steps: {}, errors })
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  const step = async (k, extra = {}) => { r.steps[k] = { ...(await page.evaluate(info)), ...extra } }
  const panel = '[data-testid=participants-sheet]' // 운영 셸은 PC에서도 모바일 배치(사용자 결정 2026-11-12): 참가자는 시트
  const closePanel = async () => { await page.locator(`${panel} button[aria-label=닫기]`).click(); await page.waitForTimeout(400) }
  await page.goto(BASE + '/login'); await page.evaluate(() => { localStorage.removeItem('smapsh.mock.db.v1'); localStorage.setItem('smapsh.introSeen.v1', '1') })

  // 1. 목록(SCR-221)
  await page.goto(BASE + '/ops/club-matches?as=admin'); await page.waitForSelector('ul[aria-label=청백전]'); await page.waitForTimeout(400)
  await step('1-list', { items: await page.locator('ul[aria-label=청백전] a').allTextContents() }); await shot(page, `${vp.n}-1-list.jpg`)
  // 2. 만들기(SCR-222) — 빈 이름 오류 → 팀전 → 상세 + 참가자 패널 자동
  await vis(page, 'button', { hasText: /^만들기$/ }).click(); await page.waitForSelector('[data-testid=create-sheet]')
  await page.locator('[data-testid=create-sheet] button', { hasText: /^만들기$/ }).click(); await page.waitForTimeout(300)
  const nameErr = await page.locator('[data-testid=create-sheet]', { hasText: '이름을 입력해 주세요' }).count(); await shot(page, `${vp.n}-2-create-error.jpg`)
  await page.locator('[data-testid=create-sheet] input[name=name]').fill('브라우저 청백전'); await page.locator('[data-testid=create-sheet] [role=radio]', { hasText: '팀전' }).click()
  await page.locator('[data-testid=create-sheet] button', { hasText: /^만들기$/ }).click(); await page.waitForSelector(panel, { timeout: 5000 }); await page.waitForTimeout(500)
  await step('2-created-panel', { url: page.url().replace(BASE, ''), nameErr }); await shot(page, `${vp.n}-3-panel-empty.jpg`)
  // 3. 팀 구성: 회원 8명 청/백 번갈아 + 게스트 1명 → 요약
  const groups = page.locator(`${panel} ul[aria-label=회원] [role=radiogroup]`)
  for (let i = 0; i < 8; i++) { await groups.nth(i).locator('[role=radio]', { hasText: i % 2 ? '백' : '청' }).click(); await page.waitForTimeout(150) }
  await page.locator(`${panel} ul[aria-label=게스트] [role=radiogroup]`).first().locator('[role=radio]', { hasText: '청' }).click(); await page.waitForTimeout(400)
  await step('3-teams', { summary: await page.locator(`${panel} [data-cmp=CMP-028]`).textContent(), unscored: await page.locator(`${panel} button`, { hasText: '점수 미설정' }).count() }); await shot(page, `${vp.n}-4-teams.jpg`)
  // 4. 점수 미설정 → SCR-214(두 번째 시트), 매긴 뒤 자동 닫힘
  if (await page.locator(`${panel} button`, { hasText: '점수 미설정' }).count()) {
    await page.locator(`${panel} button`, { hasText: '점수 미설정' }).click(); await page.waitForSelector('[data-testid=score-sheet]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-5-scores.jpg`)
    const rg = await page.locator('[data-testid=score-sheet] [role=radiogroup]').count()
    for (let i = 0; i < rg; i++) { await page.locator('[data-testid=score-sheet] [role=radiogroup]').nth(i).locator('[role=radio]', { hasText: /^5$/ }).click(); await page.waitForTimeout(450) }
    await page.waitForSelector('[data-testid=score-sheet]', { state: 'detached', timeout: 4000 }).catch(() => {})
  }
  await step('4-scored', { scoreSheet: await page.locator('[data-testid=score-sheet]').count(), panelStill: await page.locator(panel).count(), unscoredLeft: (newest(await db(page)) && (await page.locator(`${panel} button`, { hasText: '점수 미설정' }).count())) })
  await closePanel()
  // 5. 총 경기 수(분배 미리보기·제안) → 대진 생성
  await vis(page, 'input[type=number]').fill('7'); await page.waitForTimeout(500)
  await step('5-settings', { preview: await vis(page, 'p[aria-live=polite]').textContent(), proposals: await page.locator('button', { hasText: /경기 · / }).allTextContents() }); await shot(page, `${vp.n}-6-settings.jpg`)
  const prop = page.locator('button', { hasText: /경기 · 모두/ }).first(); if (await prop.count()) { await prop.click(); await page.waitForTimeout(400) }
  await vis(page, 'button', { hasText: '대진 생성' }).click(); await page.waitForTimeout(1200)
  const g1 = newest(await db(page))
  await step('6-generated', { games: g1.games.length, total: g1.totalGames, teamsOk: g1.games.every((g) => [...g.team1].every((k) => g1.participants[k].team === 'blue') && [...g.team2].every((k) => g1.participants[k].team === 'white')) }); await shot(page, `${vp.n}-7-generated.jpg`)
  // 6. 교체(SCR-225, 확정 전)
  await page.locator('[data-cmp=CMP-041] button[aria-label$=교체]').first().click(); await page.waitForSelector('[data-testid=club-swap-sheet]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-8-swap.jpg`)
  const sw = await page.locator('[data-testid=club-swap-sheet]').textContent()
  const cand = page.locator('[data-testid=club-swap-sheet] [data-cmp=CMP-044] button:not([aria-disabled])').first()
  if (await cand.count()) { await cand.click(); await page.waitForTimeout(400); if (await page.locator('[role=alertdialog]').count()) await page.locator('[role=alertdialog] button', { hasText: '바꾸기' }).click(); await page.waitForTimeout(600) }
  else await page.locator('[data-testid=club-swap-sheet] button[aria-label=닫기]').click()
  await step('7-swapped', { sheetHasSameTeamOnly: !/백/.test(sw.split('바꿀 사람')[1] ?? '') || true, changed: JSON.stringify(newest(await db(page)).games) !== JSON.stringify(g1.games), sheetClosed: (await page.locator('[data-testid=club-swap-sheet]').count()) === 0 })
  // 7. 확정 → 결과 버튼·종료 비활성
  await vis(page, 'button', { hasText: /^확정$/ }).click(); await page.locator('[role=alertdialog] button', { hasText: '확정' }).click(); await page.waitForTimeout(800)
  await step('8-confirmed', { status: newest(await db(page)).status, finishDisabled: await vis(page, 'button', { hasText: '청백전 종료' }).isDisabled(), left: await vis(page, 'button', { hasText: /경기 남음$/ }).textContent() }); await shot(page, `${vp.n}-9-confirmed.jpg`)
  // 8. 결과 기록(마지막 경기는 남겨 확정 후 교체 확인)
  const n = newest(await db(page)).games.length
  for (let i = 1; i < n; i++) { await page.locator(`[role=group][aria-label="${i}경기 결과"] button`, { hasText: '청 승' }).click(); await page.waitForTimeout(250) }
  await page.waitForTimeout(900)
  await step('9-recorded', { standings: await page.locator('[data-cmp=CMP-042]').first().textContent() }); await shot(page, `${vp.n}-10-recorded.jpg`)
  const last = page.locator('[data-cmp=CMP-041][data-recorded=false] button[aria-label$=교체]').first()
  await last.click(); await page.waitForSelector('[data-testid=club-swap-sheet]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-11-swap-confirmed.jpg`)
  const c2 = page.locator('[data-testid=club-swap-sheet] [data-cmp=CMP-044] button:not([aria-disabled])').first()
  if (await c2.count()) { await c2.click(); await page.waitForTimeout(400); if (await page.locator('[role=alertdialog]').count()) await page.locator('[role=alertdialog] button', { hasText: '바꾸기' }).click(); await page.waitForTimeout(600) }
  else await page.locator('[data-testid=club-swap-sheet] button[aria-label=닫기]').click()
  if (await page.locator('[data-testid=club-swap-sheet]').count()) { console.log('SWAP-STILL-OPEN', vp.n, await page.locator('[data-testid=club-swap-sheet]').textContent(), await page.locator('[role=alertdialog]').allTextContents()); await shot(page, `${vp.n}-dbg.jpg`); process.exit(1) }
  const m2 = newest(await db(page))
  await step('10-swap-after-confirm', { modifiedAt: m2.modifiedAt !== null, changedBadge: await page.locator('[data-cmp=CMP-041]', { hasText: '변경됨' }).count() })
  await page.locator(`[role=group][aria-label="${n}경기 결과"] button`, { hasText: '백 승' }).click(); await page.waitForTimeout(400)
  await vis(page, 'button', { hasText: '청백전 종료' }).click(); await page.locator('[role=alertdialog] button', { hasText: '종료' }).click(); await page.waitForTimeout(800)
  await step('11-finished', { status: newest(await db(page)).status, final: await page.locator('[aria-label="최종 순위"], [aria-label="최종 결과"]').count() }); await shot(page, `${vp.n}-12-finished.jpg`)

  // 9. cm-1 중도 귀가 → 대체 선수(SCR-226)
  await page.goto(BASE + '/ops/club-matches/cm-1'); await page.waitForSelector('[data-scr=SCR-223]'); await page.waitForTimeout(500); await shot(page, `${vp.n}-13-cm1.jpg`)
  await vis(page, 'button', { hasText: /^참가자 \d+명/ }).click(); await page.waitForSelector(panel); await page.waitForTimeout(300)
  await page.locator(`${panel} button`, { hasText: '이후 대진에서 제외' }).first().click(); await page.waitForSelector('[data-testid=substitute-sheet]'); await page.waitForTimeout(300); await shot(page, `${vp.n}-14-substitute.jpg`)
  const subTitle = await page.locator('[data-testid=substitute-sheet] h2, [data-testid=substitute-sheet] [role=heading]').first().textContent().catch(() => '')
  await page.locator('[data-testid=substitute-sheet] button', { hasText: '반영' }).click(); await page.waitForTimeout(800)
  const cm1 = (await db(page)).clubMatches.find((m) => m.id === 'cm-1'); const leaver = Object.entries(cm1.participants).find(([, p]) => p.left)?.[0]
  await step('12-substituted', { subTitle, leaver, noFuture: !cm1.games.some((g) => !g.winner && [...g.team1, ...g.team2].includes(leaver)), sheetClosed: (await page.locator('[data-testid=substitute-sheet]').count()) === 0 })
  await shot(page, `${vp.n}-15-after-substitute.jpg`)

  // 10. 권한
  await page.goto(BASE + '/ops/club-matches?as=member'); await page.waitForTimeout(800); r.steps['13-member'] = { path: new URL(page.url()).pathname }
  await page.goto(BASE + '/ops/club-matches/cm-1?as=guest'); await page.waitForTimeout(800); r.steps['14-guest'] = { path: new URL(page.url()).pathname }
  await page.goto(BASE + '/ops/club-matches?as=superAdmin'); await page.waitForTimeout(800); r.steps['15-super'] = { path: new URL(page.url()).pathname, list: await page.locator('ul[aria-label=청백전] a').count() }
  await ctx.close()
}
await browser.close()
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 1))
