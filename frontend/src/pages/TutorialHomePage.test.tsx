import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readDb, updateDb } from '../lib/mock/db'
import { routes } from '../routes/router'
import { setPersona, type PersonaKey } from '../features/auth/devPersona'
import * as tutorialApi from '../features/tutorial/api'

// SCR-101 튜토리얼 목록(4단계, 서버 콘텐츠 연동) — Mock 모드. api 모드는 features/auth/apiMode.test.tsx
// AC-093(5단계 과정·8스테이지·준비 중), AC-120(과정 카드·진행률·완료 여부·예상 시간), AC-121(이어서 하기), AC-067(본인만),
// AC-118(개편 전 기록 합산 안 함·보존), 상태 ST2·ST3·ST4(목록/진행 실패)·ST7(사용자 결정 2026-11-20)
function renderAt(path: string, persona: PersonaKey = 'member') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const scr = () => document.querySelector('[data-scr=SCR-101]')!
const rows = () => [...document.querySelectorAll<HTMLAnchorElement>('a[data-cmp=CMP-047]')]
const ALL = ['intro-1-v1', 'intro-2-v1', 'starter-1-v1', 'starter-2-v1', 'starter-3-v1', 'basic-1-v1', 'basic-2-v1', 'basic-3-v1']
const rec = (passed: boolean, best: number) => ({ passed, best, firstPassedAt: passed ? '2026-11-20T00:00:00Z' : null })
const setProgress = (userId: string, map: Record<string, ReturnType<typeof rec>>) =>
  updateDb((db) => void (db.tutorialProgress = { ...(db.tutorialProgress ?? {}), [userId]: map }))

describe('SCR-101 tutorial list (product, server content)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('ST2 → ST1 / AC-093·120·121: skeleton first, then courses with per-course progress, stage rows, continue card, coming soon', async () => {
    setProgress('u-member', { 'intro-1-v1': rec(true, 5), 'intro-2-v1': rec(true, 4), 'starter-1-v1': rec(true, 4), 'starter-2-v1': rec(false, 2) })
    // 목록 응답을 붙잡아 두고 스켈레톤을 확인한 뒤 풀어 줌
    const real = tutorialApi.getTutorialCourses
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    vi.spyOn(tutorialApi, 'getTutorialCourses').mockImplementation(async () => {
      await gate
      return real()
    })
    renderAt('/tutorial')
    expect(await screen.findByTestId('tutorial-skeleton')).toHaveAttribute('aria-busy', 'true') // 카드 배치를 유지한 스켈레톤
    expect(scr()).toHaveAttribute('data-st', 'SCR-101-ST2')
    expect(rows()).toHaveLength(0)
    release()
    await waitFor(() => expect(scr()).toHaveAttribute('data-st', 'SCR-101-ST1'))
    expect(screen.queryByTestId('tutorial-skeleton')).toBeNull()

    // 배너 + 전체 진행률(3/8)
    const banner = screen.getByTestId('intro-banner')
    expect(banner).toHaveTextContent('처음이라면 입문자부터')
    expect(within(banner).getByRole('progressbar', { name: '전체 진행률' })).toHaveAttribute('aria-valuenow', '3')
    expect(banner).toHaveTextContent('3 / 8 완료')

    // 과정 카드 3개(순서·설명·과정 진행률)
    const cards = [...document.querySelectorAll('section[data-cmp=CMP-048]')]
    expect(cards.map((c) => c.getAttribute('data-course'))).toEqual(['intro', 'starter', 'basic'])
    expect(screen.getByRole('region', { name: '입문자 과정' })).toHaveTextContent('처음 시작하는 분을 위한 코트와 번호')
    expect(screen.getByLabelText('2개 중 2개 통과')).toHaveTextContent('2 / 2')
    expect(screen.getByLabelText('3개 중 1개 통과')).toHaveTextContent('1 / 3')
    expect(screen.getByLabelText('3개 중 0개 통과')).toHaveTextContent('0 / 3')

    // 스테이지 행 8개: 모두 열림, 새 ID 링크, 상태·최고 점수·예상 시간
    expect(rows().map((a) => a.getAttribute('href'))).toEqual(ALL.map((id) => `/tutorial/stages/${id}`))
    expect(rows()[0]).toHaveAccessibleName('스테이지 1, 코트와 번호 익히기, 통과, 최고 점수 5점 중 5점, 약 2분')
    expect(rows()[3]).toHaveAccessibleName('스테이지 2, 담당 영역 나누기, 미완료, 최고 점수 5점 중 2점, 약 3분')
    expect(rows()[5]).toHaveAccessibleName('스테이지 1, 앞뒤 공격 대형, 아직 안 함, 약 4분')
    expect(rows().map((a) => a.dataset.variant)).toEqual(['passed', 'passed', 'passed', 'failed', 'notPlayed', 'notPlayed', 'notPlayed', 'notPlayed'])

    // 이어서 하기 = 과정 순서대로 아직 통과하지 않은 첫 스테이지(미완료 포함, ASM-038)
    const cont = document.querySelector('a[data-cmp=CMP-050]')!
    expect(cont).toHaveAttribute('href', '/tutorial/stages/starter-2-v1')
    expect(cont).toHaveTextContent('왕초급 · 담당 영역 나누기')
    expect(cont).toHaveTextContent('스테이지 2 · 약 3분 · 최고 2/5')

    // 중급·고급: 누를 수 없는 '준비 중'
    const soon = screen.getAllByRole('button', { name: /과정, 준비 중, 선택할 수 없음$/ })
    expect(soon.map((b) => b.getAttribute('aria-label'))).toEqual(['중급 과정, 준비 중, 선택할 수 없음', '고급 과정, 준비 중, 선택할 수 없음'])
    soon.forEach((b) => expect(b).toBeDisabled())
    // 급수(C조)와 연결되지 않음(AC-093)
    expect(scr().textContent).not.toContain('C조')
  })

  it('ST3: no records → 0/8, every row "아직 안 함", continue starts at 입문자 1', async () => {
    setProgress('u-member', {})
    renderAt('/tutorial')
    await waitFor(() => expect(scr()).toHaveAttribute('data-st', 'SCR-101-ST3'))
    expect(screen.getByTestId('intro-banner')).toHaveTextContent('0 / 8 완료')
    expect(rows().every((a) => a.dataset.variant === 'notPlayed')).toBe(true)
    expect(document.querySelector('a[data-cmp=CMP-050]')).toHaveAttribute('href', '/tutorial/stages/intro-1-v1')
  })

  it('ST7: all passed → continue card hidden, 8/8', async () => {
    setProgress('u-member', Object.fromEntries(ALL.map((id) => [id, rec(true, 5)])))
    renderAt('/tutorial')
    await waitFor(() => expect(scr()).toHaveAttribute('data-st', 'SCR-101-ST7'))
    expect(screen.getByTestId('intro-banner')).toHaveTextContent('8 / 8 완료')
    expect(document.querySelector('a[data-cmp=CMP-050]')).toBeNull()
  })

  it('ST4 (courses): list load failure shows a message and retry, then the list', async () => {
    updateDb((db) => void (db.failNextTutorialCoursesLoad = true))
    renderAt('/tutorial')
    await waitFor(() => expect(scr()).toHaveAttribute('data-error', 'courses'))
    expect(scr()).toHaveAttribute('data-st', 'SCR-101-ST4')
    expect(screen.getByRole('alert')).toHaveTextContent('튜토리얼 목록을 불러오지 못했습니다')
    expect(rows()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(rows()).toHaveLength(8))
    expect(scr()).not.toHaveAttribute('data-error')
  })

  it('ST4 (progress): cards stay and are playable, but no fake 0점·미통과; continue hidden; retry restores progress', async () => {
    setProgress('u-member', { 'intro-1-v1': rec(true, 5) })
    updateDb((db) => void (db.failNextTutorialLoad = true))
    const router = renderAt('/tutorial')
    await waitFor(() => expect(scr()).toHaveAttribute('data-error', 'progress'))
    expect(screen.getByRole('alert')).toHaveTextContent('진행 기록을 불러오지 못했습니다')
    expect(rows()).toHaveLength(8)
    expect(rows().every((a) => a.dataset.variant === 'unknown')).toBe(true)
    expect(rows()[0]).toHaveAccessibleName('스테이지 1, 코트와 번호 익히기, 약 2분') // 통과 여부·점수를 꾸며 넣지 않음
    expect(scr().textContent).not.toMatch(/아직 안 함|미완료|완료|최고 \d/)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(document.querySelector('a[data-cmp=CMP-050]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(scr()).toHaveAttribute('data-st', 'SCR-101-ST1'))
    expect(rows()[0]).toHaveAttribute('data-variant', 'passed')
    // 행은 실패 중에도 누를 수 있음 → 플레이 화면으로 이동
    fireEvent.click(rows()[2]!)
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/starter-1-v1'))
  })

  it('AC-118: old-ID records are kept but not counted', async () => {
    setProgress('u-member', { 'beginner-1': rec(true, 5), 'novice-1': rec(true, 5), 'intro-1-v1': rec(false, 3) })
    renderAt('/tutorial')
    await waitFor(() => expect(scr()).toHaveAttribute('data-st', 'SCR-101-ST1'))
    expect(screen.getByTestId('intro-banner')).toHaveTextContent('0 / 8 완료')
    expect(document.querySelector('a[href="/tutorial/stages/beginner-1"]')).toBeNull()
    expect(Object.keys(readDb().tutorialProgress!['u-member']!).sort()).toEqual(['beginner-1', 'intro-1-v1', 'novice-1'])
  })

  it('stage row and continue card navigate to the play screen', async () => {
    setProgress('u-member', {})
    const router = renderAt('/tutorial')
    await waitFor(() => expect(rows()).toHaveLength(8))
    fireEvent.click(rows()[6]!)
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/basic-2-v1'))
  })

  it('AC-067: operators see the same list with their own progress only', async () => {
    setProgress('u-member', { 'intro-1-v1': rec(true, 5) })
    setProgress('u-admin', Object.fromEntries(ALL.slice(0, 5).map((id) => [id, rec(true, 4)])))
    renderAt('/tutorial', 'admin')
    await waitFor(() => expect(scr()).toHaveAttribute('data-st', 'SCR-101-ST1'))
    expect(screen.getByTestId('intro-banner')).toHaveTextContent('5 / 8 완료')
    expect(document.querySelector('a[data-cmp=CMP-050]')).toHaveAttribute('href', '/tutorial/stages/basic-1-v1')
  })

  it('AC-049: signed-out users are sent to login', async () => {
    const router = renderAt('/tutorial', 'guest')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
