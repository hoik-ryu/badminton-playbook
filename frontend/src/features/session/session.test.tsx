import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { devCreateStaleSession } from './api'

// B3 Mock 흐름: 오늘 운동 시작 → 참석 체크(게스트 추가 자동 참석, 점수 입력 시트) → 대진 생성·다시 생성·확정 → 라운드 완료 → 세션 종료
function renderAt(path: string, persona: PersonaKey = 'admin') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const today = () => readDb().sessions.find((s) => s.status === 'open' || s.status === 'closed')
const checkByName = async (name: string) => {
  const sheet = await screen.findByTestId('attendance-sheet')
  fireEvent.click(within(sheet).getByRole('checkbox', { name: new RegExp(`^${name},`) }))
}

describe('B3 live session (mock)', () => {
  beforeEach(() => window.localStorage.clear())

  it('ST3 → start → attendance auto-opens; checking updates the count and gender split (AC-019)', async () => {
    renderAt('/ops/session')
    fireEvent.click(await screen.findByRole('button', { name: '오늘 운동 시작' }))
    const sheet = await screen.findByTestId('attendance-sheet')
    const summary = () => sheet.querySelector('[data-cmp=CMP-028]')!.textContent
    expect(summary()).toMatch(/참석 0명 · 남 0 여 0/)
    for (const n of ['김가람', '권초록', '박다온']) await checkByName(n)
    await waitFor(() => expect(summary()).toMatch(/참석 3명 · 남 2 여 1/))
    expect(Object.keys(today()!.attendance)).toHaveLength(3)
  })

  it('UXD-027 / UXD-023: a guest added from the attendance panel is checked at once; unscored people block generation until scored', async () => {
    renderAt('/ops/session')
    fireEvent.click(await screen.findByRole('button', { name: '오늘 운동 시작' }))
    const sheet = await screen.findByTestId('attendance-sheet')
    fireEvent.click(within(sheet).getByRole('button', { name: '+ 게스트 추가' }))
    const add = await screen.findByTestId('add-sheet')
    fireEvent.change(within(add).getByLabelText('이름'), { target: { value: '현장손님' } })
    fireEvent.click(within(add).getByRole('radio', { name: '남' }))
    fireEvent.click(within(add).getByRole('radio', { name: 'C조' }))
    fireEvent.click(within(add).getByRole('button', { name: '추가' }))
    await waitFor(() => expect(Object.keys(today()!.attendance).some((k) => k.startsWith('guest:'))).toBe(true))
    await waitFor(() => expect(screen.queryByTestId('add-sheet')).toBeNull())
    for (const n of ['김가람', '권초록', '박다온']) await checkByName(n)
    // 점수 미설정 1명(현장손님) → 생성 비활성, 점수 입력 시트
    fireEvent.click(await within(await screen.findByTestId('attendance-sheet')).findByText(/점수 미설정 1명/))
    const scores = await screen.findByTestId('score-sheet')
    fireEvent.click(within(scores).getByRole('radio', { name: '6' }))
    await waitFor(() => expect(readDb().guests.find((g) => g.name === '현장손님')?.score).toBe(6))
  })

  it('AC-024–026·036·037·038·101·102·104: generate, regenerate, confirm, complete, then close the session', async () => {
    updateDb((db) => {
      db.sessions.push({ id: 's-t', date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()), status: 'open', attendance: {}, checkSeq: 0, excludedNext: [], options: { method: 'random', rules: { balance: true, gender: true, fairness: true, noRepeat: true } }, rounds: [], version: 1 })
      const s = db.sessions[0]!
      db.users.filter((u) => u.status === 'approved' && u.score !== null).forEach((u, i) => (s.attendance[`member:${u.id}`] = i + 1))
      s.checkSeq = 99
    })
    renderAt('/ops/session')
    fireEvent.click(await screen.findByRole('button', { name: '대진 생성' }))
    await waitFor(() => expect(screen.getAllByRole('article').length).toBe(2)) // 승인 회원 중 점수 있는 10명 → 2코트, 2명 대기(AC-025)
    expect(screen.getByRole('region', { name: '대기자' }).textContent).toMatch(/대기자 2명/)
    const firstSeed = today()!.rounds[0]!.seed
    fireEvent.click(screen.getByRole('button', { name: '다시 생성' }))
    await waitFor(() => expect(today()!.rounds[0]!.seed).not.toBe(firstSeed))
    expect(today()!.rounds.filter((r) => r.status !== 'completed')).toHaveLength(1) // 이력 그대로(AC-036)

    fireEvent.click(await screen.findByRole('button', { name: '확정' }))
    const dlg = await screen.findByRole('alertdialog', { name: '1라운드 대진을 확정할까요?' })
    fireEvent.click(within(dlg).getByRole('button', { name: '확정' }))
    await waitFor(() => expect(today()!.rounds[0]!.status).toBe('inProgress'))
    expect(await screen.findByText('현재 라운드를 먼저 완료하세요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 생성' })).toBeNull() // AC-037

    fireEvent.click(screen.getByRole('button', { name: '라운드 완료' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '완료' }))
    await waitFor(() => expect(today()!.rounds[0]!.status).toBe('completed'))
    expect(await screen.findByText(/2라운드 · 생성 전/)).toBeInTheDocument()
    expect(await screen.findByText(/지난 라운드 대기자/)).toBeInTheDocument()

    // 세션 종료(더보기)
    fireEvent.keyDown(screen.getByRole('button', { name: '더보기' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: '세션 종료' }))
    const close = await screen.findByRole('alertdialog', { name: '오늘 세션을 종료할까요?' })
    expect(close.textContent).toContain('종료한 세션은 복구할 수 없고')
    fireEvent.click(within(close).getByRole('button', { name: '종료' }))
    expect(await screen.findByText('오늘 세션이 종료되었습니다. 오늘은 새 세션을 만들 수 없습니다')).toBeInTheDocument()
  })

  it('AC-026: fewer than 4 attendees → "최소 4명이 필요합니다"', async () => {
    renderAt('/ops/session')
    fireEvent.click(await screen.findByRole('button', { name: '오늘 운동 시작' }))
    for (const n of ['김가람', '권초록']) await checkByName(n)
    fireEvent.click(within(await screen.findByTestId('attendance-sheet')).getByRole('button', { name: '닫기' }))
    fireEvent.click(await screen.findByRole('button', { name: '대진 생성' }))
    expect(await screen.findByText('최소 4명이 필요합니다')).toBeInTheDocument()
  })

  it('SCR-202-ST10 / UXD-076: an earlier unfinished session shows a banner and can be continued', async () => {
    devCreateStaleSession()
    renderAt('/ops/session')
    expect(await screen.findByText(/종료되지 않은 .* 세션이 있습니다/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '이어서 열기' }))
    expect(await screen.findByRole('button', { name: '오늘 세션으로' })).toBeInTheDocument()
    expect(screen.getByText(/세션$/)).toBeInTheDocument() // 날짜 배지
  })

  it('SCR-202-ST5: members cannot open the session screen', async () => {
    const router = renderAt('/ops/session', 'member')
    await waitFor(() => expect(router.state.location.pathname).toBe('/forbidden'))
  })
})
