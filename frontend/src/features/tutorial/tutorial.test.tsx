import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { getMemberStatus } from '../roster/api'
import { stageById } from './content/stages'
import type { Verdict } from './engine/types'

// B6 튜토리얼(SCR-101·102·103) — Mock. 테스트 환경은 움직임 줄이기와 같이 애니메이션을 바로 결과 위치로 표시
function renderAt(path: string, persona: PersonaKey = 'member') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const progressOf = (userId: string) => readDb().tutorialProgress?.[userId] ?? {}
const clearProgress = () => updateDb((db) => void (db.tutorialProgress = { 'u-member': {} }))

/** 스테이지를 계획대로 플레이: c=첫 시도 정답, a=허용 후 다음, w=오답 후 다음, wc=오답 → 정답 보기 → 다시 도전 → 정답 */
async function play(stageId: string, plan: ('c' | 'a' | 'w' | 'wc')[]) {
  const stage = stageById(stageId)!
  const label = (i: number, v: Verdict) => stage.situations[i]!.choices.find((c) => c.verdict === v)!.label
  const choose = async (text: string) => {
    const group = await screen.findByRole('group', { name: '움직임 고르기' })
    const btn = within(group).getByRole('button', { name: text })
    await waitFor(() => expect(btn).not.toBeDisabled())
    fireEvent.click(btn)
  }
  for (const [i, step] of plan.entries()) {
    expect(await screen.findByText(stage.situations[i]!.prompt, { selector: 'p' })).toBeInTheDocument()
    const nextName = i === stage.situations.length - 1 ? '결과 보기' : '다음 상황'
    if (step === 'c') await choose(label(i, 'correct'))
    if (step === 'a') await choose(label(i, 'acceptable'))
    if (step === 'w' || step === 'wc') await choose(label(i, 'wrong'))
    if (step === 'wc') {
      fireEvent.click(await screen.findByRole('button', { name: '올바른 움직임 보기' }))
      fireEvent.click(await screen.findByRole('button', { name: '다시 도전' }))
      expect(await screen.findByText('재도전 · 0점')).toBeInTheDocument()
      await choose(label(i, 'correct'))
    }
    fireEvent.click(await screen.findByRole('button', { name: nextName }))
  }
}

describe('B6 tutorial home (SCR-101)', () => {
  beforeEach(() => window.localStorage.clear())

  it('SCR-101 / AC-093·067 / UXD-068: common notice, levels with progress, all stages open, coming soon folded', async () => {
    renderAt('/tutorial') // 김가람: 샘플 진행 입문자 3 · 왕초보 1 통과
    expect(await screen.findByText('처음이라면 입문자부터')).toBeInTheDocument()
    const beginner = await screen.findByRole('region', { name: '튜토리얼 난이도 · 입문자' })
    await waitFor(() => expect(beginner).toHaveTextContent('3/3 통과'))
    expect(screen.getByRole('region', { name: '튜토리얼 난이도 · 왕초보' })).toHaveTextContent('1/3 통과')
    const cards = document.querySelectorAll('a[data-cmp=CMP-047]')
    expect(cards).toHaveLength(6)
    expect(cards[0]).toHaveAttribute('href', '/tutorial/stages/beginner-1')
    expect(cards[0]).toHaveAccessibleName(/^스테이지 1, .*, 통과, 최고 점수 5점 중 5점$/)
    expect(cards[4]).toHaveAttribute('data-status', 'notPlayed') // 왕초보 2: 아직 안 함
    const folded = document.querySelector('details[data-status=comingSoon]')!
    expect(folded).not.toHaveAttribute('open')
    expect(folded).toHaveTextContent('준비 중 (초보, D조 이상)')
    expect(folded.querySelectorAll('a')).toHaveLength(0) // 누를 수 없음
    // 급수(C조)와 연결되지 않음
    expect(document.querySelector('[data-scr=SCR-101]')!.textContent).not.toContain('C조')
  })

  it('SCR-101-ST3: no records → all "-" and 0/3, no separate empty screen', async () => {
    clearProgress()
    renderAt('/tutorial')
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-101]')).toHaveAttribute('data-st', 'SCR-101-ST3'))
    expect(screen.getByRole('region', { name: '튜토리얼 난이도 · 입문자' })).toHaveTextContent('0/3 통과')
    expect([...document.querySelectorAll('a[data-cmp=CMP-047]')].every((a) => a.getAttribute('data-status') === 'notPlayed')).toBe(true)
  })

  it('SCR-101-ST4: progress load failure keeps the cards and offers retry', async () => {
    updateDb((db) => void (db.failNextTutorialLoad = true))
    renderAt('/tutorial')
    expect(await screen.findByText('진행 기록을 불러오지 못했습니다')).toBeInTheDocument()
    expect(document.querySelectorAll('a[data-cmp=CMP-047]')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.getByRole('region', { name: '튜토리얼 난이도 · 입문자' })).toHaveTextContent('3/3 통과'))
  })

  it('SCR-101-ST5 / AC-049: signed-out → login, pending → account status; admins also play their own tutorial', async () => {
    const r1 = renderAt('/tutorial/stages/beginner-1', 'guest')
    await waitFor(() => expect(r1.state.location.pathname).toBe('/login'))
    expect(r1.state.location.search).toBe('?next=%2Ftutorial%2Fstages%2Fbeginner-1')
  })

  it('SCR-101-ST5: pending account is sent to account status', async () => {
    const r = renderAt('/tutorial', 'pending')
    await waitFor(() => expect(r.state.location.pathname).toBe('/account-status'))
  })

  it('operators see the same member tutorial home with their own progress', async () => {
    renderAt('/tutorial', 'admin') // 박다온: 입문자 3 · 왕초보 3
    await waitFor(() => expect(screen.getByRole('region', { name: '튜토리얼 난이도 · 왕초보' })).toHaveTextContent('3/3 통과'))
  })
})

describe('B6 stage play and result (SCR-102·103)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearProgress()
  })

  it('AC-090·091·092: correct / wrong → answer → retry (0) / acceptable, then 3/5 not passed and saved', async () => {
    const router = renderAt('/tutorial/stages/beginner-1')
    expect(await screen.findByRole('img', { name: stageById('beginner-1')!.situations[0]!.prompt })).toBeInTheDocument() // 코트 대체 글자
    // 1: 정답 → 득점 + 이유, 1점
    const s = stageById('beginner-1')!
    const group = await screen.findByRole('group', { name: '움직임 고르기' })
    await waitFor(() => expect(within(group).getAllByRole('button')[0]).not.toBeDisabled())
    fireEvent.click(within(group).getByRole('button', { name: s.situations[0]!.choices.find((c) => c.verdict === 'correct')!.label }))
    const correct = await screen.findByText('득점')
    expect(correct.closest('[data-verdict]')).toHaveAttribute('data-verdict', 'correct')
    expect(document.querySelector('[data-scr=SCR-102]')).toHaveAttribute('data-st', 'SCR-102-ST7')
    expect(screen.queryByRole('button', { name: '다시 도전' })).toBeNull()
    expect(screen.getByText('1점')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다음 상황' }))
    // 2: 오답 → 실점, 올바른 움직임 보기(ST10: 다시 보기·느리게 보기) → 다시 도전 → 정답이어도 0점
    await play('beginner-1', [])
    const g2 = await screen.findByRole('group', { name: '움직임 고르기' })
    await waitFor(() => expect(within(g2).getAllByRole('button')[0]).not.toBeDisabled())
    fireEvent.click(within(g2).getByRole('button', { name: s.situations[1]!.choices.find((c) => c.verdict === 'wrong')!.label }))
    expect(await screen.findByText('실점')).toBeInTheDocument()
    expect(document.querySelector('[data-scr=SCR-102]')).toHaveAttribute('data-st', 'SCR-102-ST9')
    fireEvent.click(screen.getByRole('button', { name: '올바른 움직임 보기' }))
    expect(document.querySelector('[data-scr=SCR-102]')).toHaveAttribute('data-st', 'SCR-102-ST10')
    const slow = screen.getByRole('button', { name: '느리게 보기(0.5배속)' })
    fireEvent.click(slow)
    expect(slow).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '다시 보기' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 도전' }))
    expect(await screen.findByText('재도전 · 0점')).toBeInTheDocument()
    const g3 = await screen.findByRole('group', { name: '움직임 고르기' })
    await waitFor(() => expect(within(g3).getAllByRole('button')[0]).not.toBeDisabled())
    fireEvent.click(within(g3).getByRole('button', { name: s.situations[1]!.choices.find((c) => c.verdict === 'correct')!.label }))
    expect(await screen.findByText('득점')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다음 상황' }))
    expect(await screen.findByText('1점')).toBeInTheDocument() // 재도전 정답은 0점
    // 3: 허용 → 랠리 계속 + '더 좋은 움직임' + 최선 움직임 보기·다시 도전, 그냥 다음 상황(0점)
    const g4 = await screen.findByRole('group', { name: '움직임 고르기' })
    await waitFor(() => expect(within(g4).getAllByRole('button')[0]).not.toBeDisabled())
    fireEvent.click(within(g4).getByRole('button', { name: s.situations[2]!.choices.find((c) => c.verdict === 'acceptable')!.label }))
    expect(await screen.findByText('랠리 계속')).toBeInTheDocument()
    expect(screen.getByText(/괜찮은 선택이에요. 더 좋은 움직임은…/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '최선 움직임 보기' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다음 상황' }))
    // 4·5: 정답
    for (const i of [3, 4]) {
      const g = await screen.findByRole('group', { name: '움직임 고르기' })
      await waitFor(() => expect(within(g).getAllByRole('button')[0]).not.toBeDisabled())
      fireEvent.click(within(g).getByRole('button', { name: s.situations[i]!.choices.find((c) => c.verdict === 'correct')!.label }))
      fireEvent.click(await screen.findByRole('button', { name: i === 4 ? '결과 보기' : '다음 상황' }))
    }
    // 결과(SCR-103): 3/5 미통과, 통과까지 1점, 틀린 상황 2개
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/beginner-1/result'))
    const result = await screen.findByRole('region', { name: '이번 결과' })
    expect(result).toHaveTextContent('3 / 5')
    expect(result).toHaveTextContent('미통과')
    expect(result).toHaveTextContent('통과까지 1점 남았어요')
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-103]')).toHaveAttribute('data-st', 'SCR-103-ST7'))
    expect(within(screen.getByRole('region', { name: '틀린 상황' })).getAllByRole('button', { name: /상황 [23]/ })).toHaveLength(2)
    expect(progressOf('u-member')['beginner-1']).toEqual({ passed: false, best: 3, firstPassedAt: null })
  })

  it('AC-094: pass with 4 then replay with 3 → still passed, best 4, first pass time kept; home reflects it', async () => {
    const router = renderAt('/tutorial/stages/beginner-1')
    await play('beginner-1', ['c', 'c', 'c', 'c', 'w'])
    expect(await screen.findByText('통과')).toBeInTheDocument()
    await waitFor(() => expect(progressOf('u-member')['beginner-1']).toMatchObject({ passed: true, best: 4 }))
    const firstPassedAt = progressOf('u-member')['beginner-1']!.firstPassedAt
    expect(firstPassedAt).not.toBeNull()
    expect(screen.getByText('최고 점수 갱신')).toBeInTheDocument()
    // 다시 하기 → 3점
    fireEvent.click(screen.getByRole('button', { name: '다시 하기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/beginner-1'))
    await play('beginner-1', ['c', 'c', 'c', 'a', 'w'])
    expect(await screen.findByText('미통과')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('기록을 저장했습니다')).toBeInTheDocument())
    expect(progressOf('u-member')['beginner-1']).toEqual({ passed: true, best: 4, firstPassedAt })
    expect(screen.getByRole('region', { name: '이번 결과' })).toHaveTextContent('최고 점수 4/5')
    expect(Object.keys(progressOf('u-member')['beginner-1']!).sort()).toEqual(['best', 'firstPassedAt', 'passed']) // 상황별 기록 없음
    // 홈에 반영
    fireEvent.click(screen.getByRole('link', { name: '홈' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial'))
    await waitFor(() => expect(screen.getByRole('region', { name: '튜토리얼 난이도 · 입문자' })).toHaveTextContent('1/3 통과'))
    expect(document.querySelector('a[href="/tutorial/stages/beginner-1"]')).toHaveAccessibleName(/통과, 최고 점수 5점 중 4점/)
  })

  it("SCR-103: '다음 스테이지' goes to the next stage; the last stage shows '튜토리얼 홈으로'", async () => {
    const router = renderAt('/tutorial/stages/beginner-3')
    await play('beginner-3', ['c', 'c', 'c', 'c', 'c'])
    expect(await screen.findByRole('button', { name: '튜토리얼 홈으로' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '틀린 상황' })).toBeNull() // 0개면 목록 숨김
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-103]')).toHaveAttribute('data-st', 'SCR-103-ST1'))
    router.navigate('/tutorial/stages/novice-1')
    await play('novice-1', ['c', 'c', 'c', 'c', 'c'])
    fireEvent.click(await screen.findByRole('button', { name: '다음 스테이지' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/novice-2'))
  })

  it('SCR-102 exit: "나가기" and browser back ask first; leaving discards the run and keeps saved records', async () => {
    setPersona('member') // 라우터를 만들기 전에(첫 로드 권한 확인)
    const router = createMemoryRouter(routes, { initialEntries: ['/tutorial', '/tutorial/stages/novice-1'], initialIndex: 1 })
    render(<RouterProvider router={router} />)
    await play('novice-1', ['c'])
    fireEvent.click(screen.getByRole('button', { name: '나가기' }))
    const dialog = await screen.findByRole('alertdialog', { name: '지금 나가면 이번 진행은 저장되지 않습니다' })
    fireEvent.click(within(dialog).getByRole('button', { name: '계속하기' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(router.state.location.pathname).toBe('/tutorial/stages/novice-1')
    expect(screen.getByText('1점')).toBeInTheDocument() // 진행 그대로
    void router.navigate(-1) // 브라우저 뒤로 가기
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '나가기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial'))
    expect(progressOf('u-member')['novice-1']).toBeUndefined() // 저장 안 됨(이어하기 없음)
    // 다시 들어오면 처음부터
    void router.navigate('/tutorial/stages/novice-1')
    expect(await screen.findByText('0점')).toBeInTheDocument()
    expect(screen.getByText(/상황 1\/5/)).toBeInTheDocument()
  })

  it('SCR-102-ST5: coming-soon or unknown stages show "준비 중인 스테이지입니다"', async () => {
    renderAt('/tutorial/stages/intermediate-1')
    expect(await screen.findByText('준비 중인 스테이지입니다')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '튜토리얼 홈으로' })).toHaveAttribute('href', '/tutorial')
  })

  it('SCR-103 without a play result redirects to the stage', async () => {
    const router = renderAt('/tutorial/stages/beginner-2/result')
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/beginner-2'))
  })

  it("SCR-103-ST4: save failure → '다시 저장'; leaving before saving asks first; missed situation replays the answer", async () => {
    updateDb((db) => void (db.failNextTutorialSave = true))
    renderAt('/tutorial/stages/beginner-2')
    await play('beginner-2', ['c', 'c', 'c', 'w', 'c'])
    expect(await screen.findByText('기록을 저장하지 못했습니다')).toBeInTheDocument()
    expect(document.querySelector('[data-scr=SCR-103]')).toHaveAttribute('data-st', 'SCR-103-ST4')
    fireEvent.click(screen.getByRole('link', { name: '홈' }))
    const dialog = await screen.findByRole('alertdialog', { name: '기록이 저장되지 않았습니다' })
    fireEvent.click(within(dialog).getByRole('button', { name: '머무르기' }))
    fireEvent.click(screen.getByRole('button', { name: '다시 저장' }))
    await waitFor(() => expect(progressOf('u-member')['beginner-2']).toMatchObject({ passed: true, best: 4 }))
    // 틀린 상황 다시 보기
    fireEvent.click(screen.getByRole('button', { name: /상황 4/ }))
    expect(await screen.findByRole('img', { name: /정답 움직임/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '느리게 보기(0.5배속)' })).toBeInTheDocument()
  })

  it('C-23 / SCR-212: operators see the member’s passed counts from the same records', async () => {
    renderAt('/tutorial/stages/beginner-1')
    await play('beginner-1', ['c', 'c', 'c', 'c', 'c'])
    await waitFor(() => expect(progressOf('u-member')['beginner-1']?.passed).toBe(true))
    expect((await getMemberStatus('u-member')).tutorial).toMatchObject({ beginner: 1, novice: 0, total: 3 })
  })
})
