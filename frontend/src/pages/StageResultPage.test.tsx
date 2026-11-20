import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setPersona } from '../features/auth/devPersona'
import * as tutorialApi from '../features/tutorial/api'
import starter2 from '../features/tutorial/mock/content/starter-2-v1.json'
import { ApiError } from '../lib/api'
import { readDb, updateDb } from '../lib/mock/db'
import { routes } from '../routes/router'

// SCR-103 스테이지 결과(6단계, 서버 저장) — Mock 모드(서버와 같은 규칙의 mock/server.ts·progress.ts). 서버 계약은 backend 테스트·apiMode.test.tsx
// AC-092(70% 통과·미통과), AC-094(저장 멱등·최고 점수 유지·최초 통과 시각), AC-120(진행률 반영), 저장 중·저장 실패(ST2·ST4), 새로고침 복구,
// 틀린 상황 다시 보기(새 판정 없음), 다시 하기·다음 스테이지·목록
type Content = { situations: { answer: number; allow: number[] }[] }
const cell = (c: Content, n: number, k: 'c' | 'a' | 'w') => {
  const s = c.situations[n - 1]!
  return k === 'c' ? s.answer : k === 'a' ? s.allow[0]! : [1, 2, 3, 4, 5, 6].find((x) => x !== s.answer && !s.allow.includes(x))!
}
/** API 함수로 회차를 진행(판정까지만, 저장은 결과 화면이 함) */
async function playRun(stageId: string, plan: ('c' | 'a' | 'w')[]) {
  const { runId } = await tutorialApi.startTutorialRun(stageId)
  let score = 0
  const wrong: { no: number; kind: 'allow' | 'wrong' }[] = []
  for (const [i, k] of plan.entries()) {
    const j = await tutorialApi.judgeTutorialSituation(runId, i + 1, cell(starter2, i + 1, k))
    score += j.points
    if (j.firstVerdict !== 'correct') wrong.push({ no: i + 1, kind: j.firstVerdict === 'allow' ? 'allow' : 'wrong' })
  }
  return { runId, stageId, score, total: plan.length, wrong }
}
function renderResult(run: Awaited<ReturnType<typeof playRun>>, withState = true) {
  const path = `/tutorial/stages/${run.stageId}/result?run=${run.runId}`
  const router = createMemoryRouter(routes, { initialEntries: [withState ? { pathname: `/tutorial/stages/${run.stageId}/result`, search: `?run=${run.runId}`, state: { run } } : path] })
  render(<RouterProvider router={router} />)
  return router
}
const scr = () => document.querySelector('[data-scr=SCR-103]')!
const saved = () => waitFor(() => expect(scr()).toHaveAttribute('data-save', 'saved'))
const progressOf = (id: string) => readDb().tutorialProgress?.['u-member']?.[id]

beforeEach(() => {
  window.localStorage.clear()
  setPersona('member')
  updateDb((db) => void (db.tutorialProgress = { 'u-member': {} }))
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SCR-103 stage result (product, server save)', () => {
  it('ST2 → ST1 / AC-092·094·120: shows the play result at once, saves {runId} only, then server values, best, progress', async () => {
    const complete = vi.spyOn(tutorialApi, 'completeTutorialRun')
    const run = await playRun('starter-2-v1', ['c', 'c', 'c', 'c', 'w'])
    renderResult(run)
    expect(await screen.findByText('기록 저장 중')).toBeInTheDocument() // 결과는 바로, 저장 중 표시는 작게
    expect(scr()).toHaveAttribute('data-st', 'SCR-103-ST2')
    expect(screen.getByTestId('score')).toHaveTextContent('4/ 5')
    expect(screen.queryByTestId('progress')).toBeNull() // 진행률은 저장 뒤
    await saved()
    expect(scr()).toHaveAttribute('data-st', 'SCR-103-ST1')
    expect(complete).toHaveBeenCalledWith('u-member', 'starter-2-v1', run.runId) // 점수는 보내지 않음
    expect(screen.getByTestId('score')).toHaveTextContent('통과')
    expect(screen.getByTestId('score')).toHaveTextContent('통과 기준: 5개 중 4개(70%)')
    expect(screen.getByTestId('best')).toHaveTextContent('최고 점수4 / 5최고 점수 갱신')
    await waitFor(() => expect(screen.getByTestId('progress')).toBeInTheDocument())
    expect(screen.getByRole('progressbar', { name: '왕초급 진행' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('progressbar', { name: '전체 진행' })).toHaveAttribute('aria-valuenow', '1')
    expect(progressOf('starter-2-v1')).toMatchObject({ passed: true, best: 4 })
    expect(progressOf('starter-2-v1')!.firstPassedAt).not.toBeNull()
    // 통과: '다음 스테이지'(같은 과정의 다음) 강조, '다시 하기'·'목록'
    const actions = screen.getByTestId('result-actions')
    expect(within(actions).getByRole('link', { name: '다음 스테이지' })).toHaveAttribute('href', '/tutorial/stages/starter-3-v1')
    expect(within(actions).getByRole('link', { name: '다시 하기' })).toHaveAttribute('href', '/tutorial/stages/starter-2-v1')
    expect(within(actions).getByRole('link', { name: '목록' })).toHaveAttribute('href', '/tutorial')
  })

  it('ST7: not passed → "통과까지 n점", 다시 하기 강조; a lower score keeps the best and first pass time', async () => {
    const first = await playRun('starter-2-v1', ['c', 'c', 'c', 'c', 'c'])
    renderResult(first)
    await saved()
    const firstPassedAt = progressOf('starter-2-v1')!.firstPassedAt
    cleanup()
    const low = await playRun('starter-2-v1', ['c', 'w', 'a', 'w', 'w'])
    renderResult(low)
    await saved()
    expect(scr()).toHaveAttribute('data-st', 'SCR-103-ST7')
    expect(screen.getByTestId('score')).toHaveTextContent('통과까지 3점 남았어요')
    expect(screen.getByTestId('best')).toHaveTextContent('5 / 5')
    expect(screen.getByTestId('best')).not.toHaveTextContent('최고 점수 갱신')
    expect(progressOf('starter-2-v1')).toEqual({ passed: true, best: 5, firstPassedAt }) // 나빠지지 않음
    expect(within(screen.getByTestId('result-actions')).getAllByRole('link')[0]).toHaveTextContent('다시 하기')
  })

  it('ST4: save failure is not shown as success; 다시 저장 retries the same {runId}; leaving before saving asks first', async () => {
    const run = await playRun('starter-2-v1', ['c', 'c', 'c', 'c', 'c'])
    updateDb((db) => void (db.failNextTutorialSave = true))
    const router = renderResult(run)
    await waitFor(() => expect(scr()).toHaveAttribute('data-st', 'SCR-103-ST4'))
    expect(screen.getByRole('alert')).toHaveTextContent('기록을 저장하지 못했습니다')
    expect(screen.queryByTestId('progress')).toBeNull()
    expect(screen.queryByTestId('best')).toBeNull() // 저장된 최고 점수처럼 보이지 않음
    expect(progressOf('starter-2-v1')).toBeUndefined()
    // 저장 전 나가기 → 확인 창
    fireEvent.click(within(screen.getByTestId('result-actions')).getByRole('link', { name: '목록' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('기록이 저장되지 않았습니다')
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(router.state.location.pathname).toBe('/tutorial/stages/starter-2-v1/result')
    fireEvent.click(screen.getByRole('button', { name: '다시 저장' }))
    await saved()
    expect(progressOf('starter-2-v1')).toMatchObject({ passed: true, best: 5 })
  })

  it('refresh / direct URL: restores the saved result from the run id; repeated completion is applied once', async () => {
    const run = await playRun('starter-2-v1', ['c', 'w', 'c', 'c', 'c'])
    renderResult(run)
    await saved()
    const after = progressOf('starter-2-v1')
    cleanup()
    // 새로고침: 이동 상태 없이 주소만 — 서버 회차로 복구
    renderResult(run, false) // 저장 응답 전에는 결과 자리 스켈레톤(저장 전 결과를 꾸며 보여 주지 않음)
    await saved()
    expect(screen.getByTestId('score')).toHaveTextContent('4/ 5')
    expect(screen.getByTestId('best')).not.toHaveTextContent('최고 점수 갱신') // 이전 기록을 모르면 갱신 표시 안 함
    expect(progressOf('starter-2-v1')).toEqual(after) // 두 번 반영되지 않음
    expect(screen.getByRole('button', { name: /상황 2/ })).toBeInTheDocument()
  })

  it('wrong situations replay the answer on the stadium court without any new judge request', async () => {
    const run = await playRun('starter-2-v1', ['c', 'w', 'a', 'c', 'c'])
    const judge = vi.spyOn(tutorialApi, 'judgeTutorialSituation')
    renderResult(run)
    await saved()
    const wrong = screen.getByRole('region', { name: '틀린 상황' })
    expect(wrong).toHaveTextContent('틀린 상황 2개')
    expect(within(wrong).getByRole('button', { name: /상황 2.*오답/ })).toBeInTheDocument()
    fireEvent.click(within(wrong).getByRole('button', { name: /상황 3.*허용/ }))
    const replay = await screen.findByTestId('replay')
    expect(replay.querySelector('[data-mode=replay]')).not.toBeNull()
    expect(replay.querySelectorAll('img[data-player]')).toHaveLength(4)
    expect(replay).toHaveTextContent(starter2.situations[2]!.explanation.correct)
    fireEvent.click(within(replay).getByRole('button', { name: /느리게 보기/ }))
    expect(within(replay).getByRole('button', { name: /느리게 보기/ })).toHaveAttribute('aria-pressed', 'true')
    expect(replay.querySelector('[data-slow=true]')).not.toBeNull()
    expect(judge).not.toHaveBeenCalled()
  })

  it('retention policy: a deleted run (refresh / old link) shows "더 이상 볼 수 없어요", not a save failure; stored best stays', async () => {
    updateDb((db) => void (db.tutorialProgress = { 'u-member': { 'starter-2-v1': { passed: true, best: 4, firstPassedAt: '2026-11-19T00:00:00Z' } } }))
    const router = createMemoryRouter(routes, { initialEntries: ['/tutorial/stages/starter-2-v1/result?run=00000000-0000-0000-0000-000000000000'] })
    render(<RouterProvider router={router} />)
    const gone = await screen.findByTestId('run-gone')
    expect(gone).toHaveTextContent('이 결과는 더 이상 볼 수 없어요')
    expect(gone).toHaveTextContent('저장된 최고 점수와 통과 기록은 튜토리얼 목록에서 볼 수 있어요')
    expect(screen.queryByRole('alert')).toBeNull() // 저장 실패로 보이지 않음
    expect(screen.queryByTestId('result-actions')).toBeNull()
    fireEvent.click(within(gone).getByRole('link', { name: '목록으로' })) // 나가기 확인 없이 이동
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial'))
    expect(progressOf('starter-2-v1')).toMatchObject({ passed: true, best: 4 })
  })

  it('a run replaced before saving (just played, 404) → "이번 결과를 저장할 수 없습니다" + 다시 하기', async () => {
    const run = await playRun('starter-2-v1', ['c', 'c', 'c', 'c', 'c'])
    vi.spyOn(tutorialApi, 'completeTutorialRun').mockRejectedValue(new ApiError(404, { code: 'run_not_found', message: 'x' }))
    renderResult(run)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('이번 결과를 저장할 수 없습니다')
    expect(within(alert).getByRole('link', { name: '다시 하기' })).toBeInTheDocument()
  })

  it.each([
    [new ApiError(410, { code: 'run_expired', message: 'x' }), '이번 결과를 저장할 수 없습니다', '다시 하기'],
    [new ApiError(401, { code: 'unauthenticated', message: 'x' }), '로그인이 만료되어', '다시 로그인'],
  ])('another member’s run / expired / auth: %s → no fake result', async (err, text, action) => {
    vi.spyOn(tutorialApi, 'completeTutorialRun').mockRejectedValue(err)
    const router = createMemoryRouter(routes, { initialEntries: ['/tutorial/stages/starter-2-v1/result?run=00000000-0000-0000-0000-000000000000'] })
    render(<RouterProvider router={router} />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(text)
    expect(within(alert).getByRole('link', { name: action })).toBeInTheDocument()
    expect(screen.queryByTestId('score')).toBeNull()
  })

  it('no run id in the URL → back to the stage (02 SCR-103)', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/tutorial/stages/starter-2-v1/result'] })
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/starter-2-v1'))
  })

  it('last stage (초급 3단계) passed → "목록으로" instead of 다음 스테이지', async () => {
    const { runId } = await tutorialApi.startTutorialRun('basic-3-v1')
    const b3 = (await import('../features/tutorial/mock/content/basic-3-v1.json')).default as Content
    for (let n = 1; n <= 5; n++) await tutorialApi.judgeTutorialSituation(runId, n, b3.situations[n - 1]!.answer)
    renderResult({ runId, stageId: 'basic-3-v1', score: 5, total: 5, wrong: [] })
    await saved()
    const actions = screen.getByTestId('result-actions')
    expect(within(actions).getAllByRole('link')[0]).toHaveTextContent('목록으로')
    expect(within(actions).queryByRole('link', { name: '다음 스테이지' })).toBeNull()
    expect(screen.queryByRole('region', { name: '틀린 상황' })).toBeNull() // 0개면 숨김
  })

  it('end to end: SCR-101 → play all 5 → SCR-103 saved → 목록 shows the new progress', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/tutorial'] })
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(document.querySelectorAll('a[data-cmp=CMP-047]')).toHaveLength(8))
    fireEvent.click(document.querySelectorAll('a[data-cmp=CMP-047]')[3]!) // 왕초급 2
    const phase = (p: string) => waitFor(() => expect(document.querySelector('[data-scr=SCR-102]')).toHaveAttribute('data-phase', p))
    for (let n = 1; n <= 5; n++) {
      await phase('choose')
      const hit = [...document.querySelectorAll('polygon.sc-hit')].find((x) => x.getAttribute('aria-label')!.startsWith(`${cell(starter2, n, n === 2 ? 'w' : 'c')}번 칸`))!
      fireEvent.click(hit)
      await phase('judged')
      fireEvent.click(within(screen.getByTestId('bottom-sheet')).getAllByRole('button', { name: n === 5 ? /결과 보기/ : /다음 상황/ })[0]!)
    }
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/starter-2-v1/result'))
    expect(router.state.location.search).toMatch(/^\?run=/)
    await saved()
    expect(screen.getByTestId('score')).toHaveTextContent('4/ 5')
    fireEvent.click(within(screen.getByTestId('result-actions')).getByRole('link', { name: '목록' }))
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-101]')).toHaveAttribute('data-st', 'SCR-101-ST1'))
    expect(document.querySelectorAll('a[data-cmp=CMP-047]')[3]).toHaveAttribute('data-variant', 'passed')
    expect(screen.getByTestId('intro-banner')).toHaveTextContent('1 / 8 완료')
  })
})
