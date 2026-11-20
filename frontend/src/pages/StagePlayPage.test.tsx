import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type Location } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setPersona } from '../features/auth/devPersona'
import * as tutorialApi from '../features/tutorial/api'
import intro1 from '../features/tutorial/mock/content/intro-1-v1.json'
import basic1 from '../features/tutorial/mock/content/basic-1-v1.json'
import starter2 from '../features/tutorial/mock/content/starter-2-v1.json'
import { expireRun } from '../features/tutorial/mock/server'
import { ApiError } from '../lib/api'
import { routes } from '../routes/router'

// SCR-102 스테이지 플레이(5단계, 서버 판정) — Mock 모드(서버와 같은 규칙의 mock/server.ts). api 모드 계약은 features/auth/apiMode.test.tsx
// AC-090(번호 칸 선택 → 이동·판정), AC-091(정답·허용·오답과 다시 도전), AC-092(첫 시도 정답만 1점·재도전 0점), AC-112(입문자 안내형),
// AC-114(파트너 자동 이동), AC-115(확정 뒤 한 번만 판정·확인 단계), AC-119(개편 전 ID), 중복 요청·네트워크 오류·만료·인증 만료·나가기
type Content = { situations: { answer: number; allow: number[] }[] }
const answerOf = (c: Content, n: number) => c.situations[n - 1]!.answer
const allowOf = (c: Content, n: number) => c.situations[n - 1]!.allow[0]!
const wrongOf = (c: Content, n: number, cells: number) => Array.from({ length: cells }, (_, k) => k + 1).find((x) => x !== answerOf(c, n) && !c.situations[n - 1]!.allow.includes(x))!

let boxSize = { width: 0, height: 0 }
beforeEach(() => {
  window.localStorage.clear()
  setPersona('member')
  boxSize = { width: 0, height: 0 } // 기본: 크기 측정 없음 → 단일 터치
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
  const real = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.classList.contains('sc-box') ? ({ ...boxSize, x: 0, y: 0, top: 0, left: 0, right: boxSize.width, bottom: boxSize.height, toJSON() {} } as DOMRect) : real.call(this)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const seen: Location[] = []
  router.subscribe((s) => seen.push(s.location))
  render(<RouterProvider router={router} />)
  return { router, seen }
}
const scr = () => document.querySelector('[data-scr=SCR-102]')!
const phase = (p: string) => waitFor(() => expect(scr()).toHaveAttribute('data-phase', p))
const pick = (n: number) => {
  const hit = [...document.querySelectorAll('polygon.sc-hit')].find((x) => x.getAttribute('aria-label')!.startsWith(`${n}번 칸`))!
  fireEvent.click(hit)
}
const sheet = () => screen.getByTestId('bottom-sheet')
const scoreText = () => scr().querySelector('header')!.textContent!

describe('SCR-102 stadium game (product, server judging)', () => {
  it('AC-090·091·092: first-try correct +1, wrong → answer replay → retry correct 0점, allow 0점; result summary goes to SCR-103', async () => {
    const judge = vi.spyOn(tutorialApi, 'judgeTutorialSituation')
    const { seen } = renderAt('/tutorial/stages/starter-2-v1')
    await phase('choose')
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST1')
    expect(document.querySelectorAll('polygon.sc-hit')).toHaveLength(6) // 6칸, 내 편만

    // 상황 1: 첫 시도 정답 → +1
    pick(answerOf(starter2, 1))
    await phase('judged')
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST7')
    expect(sheet()).toHaveTextContent('득점! +1점')
    expect(scoreText()).toContain('상황 1/5')
    expect(scoreText()).toContain('1점')
    fireEvent.click(within(sheet()).getByRole('button', { name: /다음 상황/ }))

    // 상황 2: 오답 → 올바른 움직임 보기 → 다시 도전 → 정답(0점)
    await phase('choose')
    pick(wrongOf(starter2, 2, 6))
    await phase('judged')
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST9')
    expect(sheet()).toHaveTextContent('실점')
    fireEvent.click(within(sheet()).getByRole('button', { name: /올바른 움직임 보기/ }))
    await phase('replay')
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST10')
    expect(within(sheet()).getByRole('button', { name: /느리게 보기/ })).toBeInTheDocument()
    fireEvent.click(within(sheet()).getAllByRole('button', { name: '다시 도전' })[0]!)
    await phase('choose')
    expect(scoreText()).toContain('재도전 · 0점')
    pick(answerOf(starter2, 2))
    await phase('judged')
    expect(sheet()).toHaveTextContent('득점(재도전 · 0점)')
    expect(sheet()).toHaveTextContent('다시 도전해 맞힌 상황은 0점이에요')
    expect(scoreText()).toContain('1점') // 점수 그대로
    fireEvent.click(within(sheet()).getByRole('button', { name: /다음 상황/ }))

    // 상황 3: 허용 → 랠리 계속(0점)
    await phase('choose')
    pick(allowOf(starter2, 3))
    await phase('judged')
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST8')
    expect(sheet()).toHaveTextContent('랠리 계속')
    expect(within(sheet()).getByRole('button', { name: /최선 위치 보기/ })).toBeInTheDocument()
    fireEvent.click(within(sheet()).getAllByRole('button', { name: /다음 상황/ })[0]!)

    // 상황 4·5: 정답
    for (const n of [4, 5]) {
      await phase('choose')
      pick(answerOf(starter2, n))
      await phase('judged')
      fireEvent.click(within(sheet()).getByRole('button', { name: n === 5 ? /결과 보기/ : /다음 상황/ }))
    }
    // 서버 응답의 점수로 3점, 틀린 상황 2(오답)·3(허용) → SCR-103 이동 상태
    await waitFor(() => expect(seen.some((l) => l.pathname === '/tutorial/stages/starter-2-v1/result')).toBe(true))
    const run = (seen.find((l) => l.pathname.endsWith('/result'))!.state as { run: tutorialApi.RunStart & { score: number; total: number; wrong: unknown[] } }).run
    expect(run).toMatchObject({ stageId: 'starter-2-v1', score: 3, total: 5, wrong: [{ no: 2, kind: 'wrong' }, { no: 3, kind: 'allow' }] })
    expect(judge.mock.calls.map((c) => c[1])).toEqual([1, 2, 2, 3, 4, 5]) // 상황 번호만 순서대로
  })

  it('last situation: wrong or allow still offers 다시 도전·올바른 움직임 보기, and the next button reads "결과 보기"', async () => {
    const { seen } = renderAt('/tutorial/stages/starter-2-v1')
    for (const n of [1, 2, 3, 4]) {
      await phase('choose')
      pick(answerOf(starter2, n))
      await phase('judged')
      fireEvent.click(within(sheet()).getByRole('button', { name: /다음 상황/ }))
    }
    await phase('choose')
    pick(wrongOf(starter2, 5, 6))
    await phase('judged')
    expect(within(sheet()).queryByRole('button', { name: /다음 상황/ })).toBeNull()
    expect(within(sheet()).getByRole('button', { name: '다시 도전' })).toBeInTheDocument()
    fireEvent.click(within(sheet()).getByRole('button', { name: /올바른 움직임 보기/ }))
    await phase('replay')
    expect(within(sheet()).getByRole('button', { name: /결과 보기/ })).toBeInTheDocument()
    fireEvent.click(within(sheet()).getByRole('button', { name: '다시 도전' })) // 재도전은 그대로 가능
    await phase('choose')
    pick(answerOf(starter2, 5))
    await phase('judged')
    fireEvent.click(within(sheet()).getByRole('button', { name: /결과 보기/ }))
    await waitFor(() => expect(seen.some((l) => l.pathname.endsWith('/result'))).toBe(true))
  })

  it('AC-112 / ST11: guided course has no playback or shuttle; 정답·오답 only', async () => {
    renderAt('/tutorial/stages/intro-1-v1')
    await phase('choose')
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST11')
    expect(sheet()).toHaveTextContent('코트 위 숫자는 내 편 자리 번호예요')
    expect(document.querySelector('img[data-shuttle]')).toBeNull()
    pick(wrongOf(intro1, 1, 6))
    await phase('judged')
    expect(sheet()).toHaveTextContent('오답')
    fireEvent.click(within(sheet()).getAllByRole('button', { name: '다시 도전' })[0]!)
    await phase('choose')
    pick(answerOf(intro1, 1))
    await phase('judged')
    expect(sheet()).toHaveTextContent('정답')
    expect(scoreText()).toContain('0점')
  })

  it('AC-115 / ST12: small cells → choose first, change, then confirm once with the last pick (9칸)', async () => {
    boxSize = { width: 360, height: 180 } // 칸이 44px보다 작음 → 확인 단계
    const judge = vi.spyOn(tutorialApi, 'judgeTutorialSituation')
    renderAt('/tutorial/stages/basic-1-v1')
    await phase('choose')
    await waitFor(() => expect(scr()).toHaveAttribute('data-confirm-mode', 'true'))
    expect(document.querySelectorAll('polygon.sc-hit')).toHaveLength(9)
    pick(1)
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST12')
    expect(sheet()).toHaveTextContent('1번 칸을 골랐어요')
    pick(answerOf(basic1, 1))
    expect(sheet()).toHaveTextContent(`${answerOf(basic1, 1)}번 칸을 골랐어요`)
    expect(judge).not.toHaveBeenCalled() // 고르기만으로는 판정하지 않음
    fireEvent.click(within(sheet()).getByRole('button', { name: /이 칸으로 이동/ }))
    await phase('judged')
    expect(judge).toHaveBeenCalledTimes(1)
    expect(judge.mock.calls[0]!.slice(1)).toEqual([1, answerOf(basic1, 1)])
  })

  it('duplicate input during a pending judge sends one request; inputs are locked while judging', async () => {
    let release!: () => void
    const real = tutorialApi.judgeTutorialSituation
    const judge = vi.spyOn(tutorialApi, 'judgeTutorialSituation').mockImplementation(async (...a) => {
      await new Promise<void>((r) => (release = r))
      return real(...a)
    })
    renderAt('/tutorial/stages/starter-2-v1')
    await phase('choose')
    pick(answerOf(starter2, 1))
    pick(answerOf(starter2, 1))
    pick(wrongOf(starter2, 1, 6))
    await phase('moving')
    expect(document.querySelectorAll('polygon.sc-hit')).toHaveLength(0) // 판정 중 누름 영역 없음
    expect(sheet()).toHaveTextContent('이동하는 중')
    release()
    await phase('judged')
    expect(judge).toHaveBeenCalledTimes(1)
    expect(scoreText()).toContain('1점')
  })

  it('network error while judging → safe resend of the same choice; score comes only from the server', async () => {
    const real = tutorialApi.judgeTutorialSituation
    const judge = vi
      .spyOn(tutorialApi, 'judgeTutorialSituation')
      .mockRejectedValueOnce(new ApiError(0, { code: 'network_error', message: '네트워크 오류' }))
      .mockImplementation(real)
    renderAt('/tutorial/stages/starter-2-v1')
    await phase('choose')
    pick(answerOf(starter2, 1))
    await phase('judgeError')
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST4')
    expect(screen.getByRole('alert')).toHaveTextContent('판정을 받지 못했어요')
    expect(scoreText()).toContain('0점') // 오류로 점수를 만들지 않음
    fireEvent.click(within(sheet()).getByRole('button', { name: /다시 보내기/ }))
    await phase('judged')
    expect(judge.mock.calls.map((c) => c.slice(1))).toEqual([[1, answerOf(starter2, 1)], [1, answerOf(starter2, 1)]])
    expect(scoreText()).toContain('1점')
  })

  it('run expired (410) → "처음부터 다시 하기" starts a new run from situation 1 with score 0', async () => {
    const startRun = vi.spyOn(tutorialApi, 'startTutorialRun')
    renderAt('/tutorial/stages/starter-2-v1')
    await phase('choose')
    pick(answerOf(starter2, 1))
    await phase('judged')
    fireEvent.click(within(sheet()).getByRole('button', { name: /다음 상황/ }))
    await phase('choose')
    const runId = (await startRun.mock.results[0]!.value as tutorialApi.RunStart).runId
    expireRun(runId)
    pick(answerOf(starter2, 2))
    await phase('judgeError')
    expect(screen.getByRole('alert')).toHaveTextContent('처음부터 다시 해 주세요')
    fireEvent.click(within(sheet()).getByRole('button', { name: /처음부터 다시 하기/ }))
    await phase('choose')
    expect(startRun).toHaveBeenCalledTimes(2)
    expect(scoreText()).toContain('상황 1/5')
    expect(scoreText()).toContain('0점')
  })

  it('content changed (409) → restart; auth expired (401) → login', async () => {
    const real = tutorialApi.judgeTutorialSituation
    vi.spyOn(tutorialApi, 'judgeTutorialSituation')
      .mockRejectedValueOnce(new ApiError(409, { code: 'content_changed', message: '바뀜' }))
      .mockRejectedValueOnce(new ApiError(401, { code: 'unauthenticated', message: '로그인이 필요합니다' }))
      .mockImplementation(real)
    const { seen } = renderAt('/tutorial/stages/starter-2-v1')
    await phase('choose')
    pick(answerOf(starter2, 1))
    await phase('judgeError')
    expect(within(sheet()).getByRole('button', { name: /처음부터 다시 하기/ })).toBeInTheDocument()
    fireEvent.click(within(sheet()).getByRole('button', { name: /처음부터 다시 하기/ }))
    await phase('choose')
    pick(answerOf(starter2, 1))
    await phase('judgeError')
    expect(screen.getByRole('alert')).toHaveTextContent('로그인이 만료되었어요')
    // 로그인 화면으로(돌아올 곳 = 이 스테이지). Mock 세션은 실제로는 유효해 이동 결과 대신 링크 주소로 확인
    expect(within(sheet()).getByRole('link', { name: '다시 로그인' })).toHaveAttribute('href', '/login?next=%2Ftutorial%2Fstages%2Fstarter-2-v1')
    expect(seen.length).toBeGreaterThan(0)
  })

  it('ST4: content or run-start failure → message and retry', async () => {
    const realStage = tutorialApi.getTutorialStage
    vi.spyOn(tutorialApi, 'getTutorialStage').mockRejectedValueOnce(new ApiError(0, { code: 'network_error', message: 'x' })).mockImplementation(realStage)
    const realRun = tutorialApi.startTutorialRun
    vi.spyOn(tutorialApi, 'startTutorialRun').mockRejectedValueOnce(new ApiError(503, { code: 'http_503', message: 'x' })).mockImplementation(realRun)
    renderAt('/tutorial/stages/starter-2-v1')
    await waitFor(() => expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST4'))
    expect(screen.getByRole('alert')).toHaveTextContent('스테이지를 불러오지 못했습니다')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' })) // 콘텐츠 성공, 회차 시작 실패
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('스테이지를 불러오지 못했습니다'))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await phase('choose')
  })

  it('auth expired on entry → login link', async () => {
    vi.spyOn(tutorialApi, 'getTutorialStage').mockRejectedValue(new ApiError(401, { code: 'unauthenticated', message: '로그인이 필요합니다' }))
    renderAt('/tutorial/stages/starter-2-v1')
    expect(await screen.findByText('로그인이 만료되었어요')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '다시 로그인' })).toHaveAttribute('href', '/login?next=%2Ftutorial%2Fstages%2Fstarter-2-v1')
  })

  it.each(['beginner-1', 'mid-1-v1', 'nope'])('AC-119 / ST5: %s → "준비 중인 스테이지입니다"', async (id) => {
    renderAt(`/tutorial/stages/${id}`)
    expect(await screen.findByText('준비 중인 스테이지입니다')).toBeInTheDocument()
    expect(scr()).toHaveAttribute('data-st', 'SCR-102-ST5')
  })

  it('public stage content has no answer data (D-T2)', async () => {
    const st = await tutorialApi.getTutorialStage('starter-2-v1')
    const keys = JSON.stringify(st)
    for (const k of ['answer', 'allow', 'landing', 'partnerCell', 'explanation', 'targets']) expect(keys).not.toContain(`"${k}"`)
    expect(st.situations[0]!.shuttle).toEqual({ from: [43, 38], stop: [47, 82] })
  })

  it('exit asks first; leaving discards the run; re-entry starts a new run', async () => {
    const startRun = vi.spyOn(tutorialApi, 'startTutorialRun')
    const { router } = renderAt('/tutorial/stages/starter-2-v1')
    await phase('choose')
    fireEvent.click(screen.getByRole('button', { name: /나가기/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('지금 나가면 이번 진행은 저장되지 않습니다')
    fireEvent.click(within(dialog).getByRole('button', { name: '나가기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial'))
    await router.navigate('/tutorial/stages/starter-2-v1')
    await phase('choose')
    expect(startRun).toHaveBeenCalledTimes(2)
  })

  it('SCR-101 → stage row → the stadium game starts', async () => {
    const { router } = renderAt('/tutorial')
    await waitFor(() => expect(document.querySelectorAll('a[data-cmp=CMP-047]')).toHaveLength(8))
    fireEvent.click(document.querySelectorAll('a[data-cmp=CMP-047]')[3]!)
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/starter-2-v1'))
    await phase('choose')
    expect(document.querySelectorAll('img[data-player]')).toHaveLength(4)
  })
})
