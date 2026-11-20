import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { getMemberStatus } from '../roster/api'

// B6 튜토리얼(SCR-101·102·103) — Mock. 테스트 환경은 움직임 줄이기와 같이 애니메이션을 바로 결과 위치로 표시
function renderAt(path: string, persona: PersonaKey = 'member') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const progressOf = (userId: string) => readDb().tutorialProgress?.[userId] ?? {}
const clearProgress = () => updateDb((db) => void (db.tutorialProgress = { 'u-member': {} }))


// (2026-11-20, 4단계) SCR-101 화면 테스트는 새 화면과 함께 pages/TutorialHomePage.test.tsx로 옮김. 여기에는 접근 규칙만 남김
describe('B6 tutorial home (SCR-101) access', () => {
  beforeEach(() => window.localStorage.clear())

  it('SCR-101-ST5 / AC-049: signed-out → login, pending → account status; admins also play their own tutorial', async () => {
    const r1 = renderAt('/tutorial/stages/beginner-1', 'guest')
    await waitFor(() => expect(r1.state.location.pathname).toBe('/login'))
    expect(r1.state.location.search).toBe('?next=%2Ftutorial%2Fstages%2Fbeginner-1')
  })

  it('SCR-101-ST5: pending account is sent to account status', async () => {
    const r = renderAt('/tutorial', 'pending')
    await waitFor(() => expect(r.state.location.pathname).toBe('/account-status'))
  })

})

// (2026-11-20, 5단계) 옛 선택지 방식 SCR-102를 거치는 플레이·결과 테스트는 새 경기장 게임 테스트(pages/StagePlayPage.test.tsx)로 대체.
// 옛 SCR-103 흐름 테스트는 6단계에서 새 결과 화면과 함께 다시 작성
describe('B6 stage play and result (SCR-102·103)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearProgress()
  })

  it('SCR-102-ST5: coming-soon or unknown stages show "준비 중인 스테이지입니다"', async () => {
    renderAt('/tutorial/stages/intermediate-1')
    expect(await screen.findByText('준비 중인 스테이지입니다')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '튜토리얼 홈으로' })).toHaveAttribute('href', '/tutorial')
  })

  it('SCR-103 without a play result redirects to the stage', async () => {
    const router = renderAt('/tutorial/stages/starter-2-v1/result')
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial/stages/starter-2-v1'))
  })

  it('C-23 / AC-100·118 / SCR-212: operator counts use the new courses; an old-ID record is kept but not counted', async () => {
    updateDb((db) => void (db.tutorialProgress = { 'u-member': { 'beginner-1': { passed: true, best: 5, firstPassedAt: '2026-11-12T00:00:00Z' } } }))
    expect((await getMemberStatus('u-member')).tutorial).toEqual([
      { course: 'intro', name: '입문자', passed: 0, total: 2 },
      { course: 'starter', name: '왕초급', passed: 0, total: 3 },
      { course: 'basic', name: '초급', passed: 0, total: 3 },
    ])
    expect(progressOf('u-member')['beginner-1']?.passed).toBe(true) // 기록은 남음(C-28)
    updateDb((db) => void (db.tutorialProgress!['u-member']!['intro-1-v1'] = { passed: true, best: 4, firstPassedAt: '2026-11-19T00:00:00Z' }))
    expect((await getMemberStatus('u-member')).tutorial[0]).toEqual({ course: 'intro', name: '입문자', passed: 1, total: 2 })
  })
})
