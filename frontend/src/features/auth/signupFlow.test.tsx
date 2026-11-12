import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona } from './devPersona'

// B1 Mock 흐름: 카카오(가짜) → 가입(SCR-002) → 승인 대기(SCR-003) → 운영진 승인·거절(SCR-231) → 회원 진입
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const landsOn = (router: ReturnType<typeof renderAt>, path: string) => waitFor(() => expect(router.state.location.pathname).toBe(path))

describe('B1 signup and approval flow (mock)', () => {
  beforeEach(() => window.localStorage.clear())

  it('AC-001: a new Kakao user signs up, validates required fields, and waits for approval', async () => {
    const router = renderAt('/login')
    fireEvent.click(await screen.findByRole('button', { name: '카카오로 시작하기' }))
    await landsOn(router, '/signup')

    fireEvent.click(await screen.findByRole('button', { name: '가입 신청' }))
    expect(await screen.findByText('이름을 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByText('성별을 골라 주세요')).toBeInTheDocument()
    expect(screen.getByText('급수를 골라 주세요')).toBeInTheDocument()
    expect(screen.getByLabelText('이름')).toHaveFocus() // 첫 오류 칸으로 포커스

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: ' 테스트회원 ' } })
    fireEvent.click(screen.getByRole('radio', { name: '여' }))
    fireEvent.click(screen.getByRole('radio', { name: 'C조' }))
    fireEvent.click(screen.getByRole('button', { name: '가입 신청' }))
    await landsOn(router, '/account-status')
    expect(await screen.findByText('가입 신청이 접수되었습니다')).toBeInTheDocument()
    const created = readDb().users.find((u) => u.name === '테스트회원')
    expect(created).toMatchObject({ status: 'pending', gender: '여', grade: 'C조', referrer: null })
  })

  it('AC-002: an already registered Kakao account does not create a new account', async () => {
    updateDb((db) => void (db.kakaoId = 'kakao-u-member'))
    const router = renderAt('/login')
    fireEvent.click(await screen.findByRole('button', { name: '카카오로 시작하기' }))
    await landsOn(router, '/tutorial')
    expect(readDb().users.filter((u) => u.kakaoId === 'kakao-u-member')).toHaveLength(1)
  })

  it('UXD-019: shows the failure notice and the other-browser hint after two failures', async () => {
    updateDb((db) => void (db.failNextKakao = true))
    const router = renderAt('/login')
    fireEvent.click(await screen.findByRole('button', { name: '카카오로 시작하기' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('카카오 로그인이 완료되지 않았습니다')
    expect(screen.queryByText(/다른 브라우저로 열기/)).toBeNull()
    updateDb((db) => void (db.failNextKakao = true))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText(/다른 브라우저로 열기/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('AC-006 / AC-007 / UXD-012: admins approve, bulk approve and reject; approved users get in', async () => {
    setPersona('admin')
    renderAt('/ops/approvals')
    const list = await screen.findByRole('list', { name: '승인 대기 신청' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map((r) => r.getAttribute('data-applicant'))).toEqual(['a-1', 'a-2', 'a-3', 'u-pending']) // 신청 순서
    expect(within(rows[1]!).getAllByText('명단에 같은 이름이 있습니다').length).toBeGreaterThan(0) // UXD-014

    // 개별 승인
    fireEvent.click(within(rows[0]!).getAllByRole('button', { name: '승인' })[0]!)
    expect(await screen.findByText('이하늘 님을 승인했습니다')).toBeInTheDocument()
    await waitFor(() => expect(readDb().users.find((u) => u.id === 'a-1')?.status).toBe('approved'))

    // 거절(확인 창)
    const row3 = await waitFor(() => within(screen.getByRole('list', { name: '승인 대기 신청' })).getAllByRole('listitem').find((r) => r.getAttribute('data-applicant') === 'a-3')!)
    fireEvent.click(within(row3).getAllByRole('button', { name: '거절' })[0]!)
    const dialog = await screen.findByRole('alertdialog', { name: '문새길 님의 가입을 거절할까요?' })
    fireEvent.click(within(dialog).getByRole('button', { name: '거절' }))
    await waitFor(() => expect(readDb().users.find((u) => u.id === 'a-3')?.status).toBe('rejected'))

    // 일괄 승인(확인 창 없음)
    fireEvent.click(await screen.findByRole('checkbox', { name: '전체 선택' }))
    fireEvent.click(screen.getAllByRole('button', { name: '선택한 2명 승인' })[0]!)
    expect(await screen.findByText('2명을 승인했습니다')).toBeInTheDocument()
    expect(await screen.findByText('승인을 기다리는 신청이 없습니다')).toBeInTheDocument()
  })

  it('FLOW-001-S3a: a pending user rechecks status after approval and enters the member home', async () => {
    setPersona('pending')
    const router = renderAt('/tutorial')
    await landsOn(router, '/account-status')
    fireEvent.click(await screen.findByRole('button', { name: '상태 다시 확인' }))
    expect(await screen.findByText('아직 상태가 바뀌지 않았습니다')).toBeInTheDocument()
    updateDb((db) => void (db.users.find((u) => u.id === 'u-pending')!.status = 'approved'))
    fireEvent.click(screen.getByRole('button', { name: '상태 다시 확인' }))
    await landsOn(router, '/tutorial')
  })

  it('AC-007 / AC-005: rejected users see a neutral message and can log out', async () => {
    setPersona('rejected')
    const router = renderAt('/account-status')
    expect(await screen.findByRole('heading', { name: '가입이 승인되지 않았습니다' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    await landsOn(router, '/login')
    expect(readDb().session).toBeNull()
  })

  it('SCR-002: leaving the signup form asks for confirmation and discards the Kakao-only state', async () => {
    const router = renderAt('/login')
    fireEvent.click(await screen.findByRole('button', { name: '카카오로 시작하기' }))
    await landsOn(router, '/signup')
    fireEvent.click(await screen.findByRole('button', { name: '뒤로' }))
    const dialog = await screen.findByRole('alertdialog', { name: '가입 신청을 그만둘까요?' })
    fireEvent.click(within(dialog).getByRole('button', { name: '그만두기' }))
    await landsOn(router, '/login')
    expect(readDb().signupTicket).toBeNull()
  })
})
