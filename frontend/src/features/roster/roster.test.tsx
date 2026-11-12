import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { ScoreEntrySheet } from './ScoreEntrySheet'
import type { RosterPerson } from './api'

// B2 Mock 흐름: 명단(SCR-211) · 편집(SCR-212) · 사람 추가(SCR-213) · 점수 입력(SCR-214) · 역할 관리(SCR-232)
function renderAt(path: string, persona: PersonaKey = 'admin') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const rowOf = async (name: string) => screen.findByRole('button', { name: new RegExp(`^${name}, `) })

describe('B2 roster and scores (mock)', () => {
  beforeEach(() => window.localStorage.clear())

  it('SCR-211 / UXD-074: members by name, then guests; unset badge; chips are exclusive (UXD-073)', async () => {
    renderAt('/ops/roster')
    const members = await screen.findByRole('list', { name: '회원' })
    const names = within(members).getAllByRole('button').map((b) => b.getAttribute('aria-label')!.split(',')[0])
    expect(names).toEqual([...names].sort((a, b) => a!.localeCompare(b!, 'ko')))
    expect(within(screen.getByRole('list', { name: '게스트' })).getAllByRole('button')).toHaveLength(5)
    expect(screen.getByText('카카오 가입·승인으로 회원이 등록됩니다')).toBeInTheDocument()

    const unset = screen.getByRole('button', { name: /^점수 미설정 \d+명$/ })
    const tutorial = screen.getByRole('button', { name: /^튜토리얼 권장 · 미통과 \d+명$/ })
    fireEvent.click(unset)
    expect(unset).toHaveAttribute('aria-pressed', 'true')
    for (const b of within(screen.getByRole('list', { name: '회원' })).getAllByRole('button')) expect(b.getAttribute('aria-label')).toContain('점수 미설정')
    fireEvent.click(tutorial)
    expect(unset).toHaveAttribute('aria-pressed', 'false')
    expect(tutorial).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('list', { name: '게스트' })).toBeNull() // 권장 대상은 회원만

    fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없는이름' } })
    fireEvent.click(await screen.findByRole('button', { name: '조건 해제' }))
    expect(await screen.findByRole('list', { name: '게스트' })).toBeInTheDocument()
  })

  it('SCR-212 / AC-010 / AC-016: edit a member score with status, save with toast; discard confirm on close', async () => {
    renderAt('/ops/roster')
    fireEvent.click(await rowOf('서이든'))
    const sheet = await screen.findByTestId('edit-sheet')
    expect(await within(sheet).findByText(/입문자 0\/3/)).toBeInTheDocument() // 회원 현황(AC-100)
    expect(within(sheet).getByText(/권장 대상/)).toBeInTheDocument()

    fireEvent.click(within(sheet).getByRole('radio', { name: '4' }))
    fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }))
    const discard = await screen.findByRole('alertdialog', { name: '변경 내용을 버릴까요?' })
    fireEvent.click(within(discard).getByRole('button', { name: '계속 편집' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    fireEvent.click(within(screen.getByTestId('edit-sheet')).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument()
    await waitFor(() => expect(readDb().users.find((u) => u.name === '서이든')?.score).toBe(4))
    await waitFor(() => expect(screen.queryByTestId('edit-sheet')).toBeNull())
  })

  it('SCR-212 ST7–ST11 / AC-013·014·105–107: guest delete branches', async () => {
    // 실제 데이터로 분기: 진바람(g-3)은 진행 중 라운드 출전, 문솔빛(g-2)은 확정 전 대진, 하솔(g-4)은 샘플 '가을 청백전'(확정) 미기록 경기
    updateDb((db) => {
      const base = { attendance: {}, checkSeq: 0, excludedNext: [], options: { method: 'random' as const, rules: { balance: true, gender: true, fairness: true, noRepeat: false } }, version: 1 }
      db.sessions.push({ ...base, id: 's-a', date: '2026-11-01', status: 'open', rounds: [{ no: 1, seed: 1, status: 'inProgress', courts: [{ no: 1, team1: ['guest:g-3', 'member:m-1'], team2: ['member:m-2', 'member:m-3'], relaxations: [] }], waiting: [] }] })
      db.sessions.push({ ...base, id: 's-b', date: '2026-11-02', status: 'open', rounds: [{ no: 1, seed: 2, status: 'draft', courts: [{ no: 1, team1: ['guest:g-2', 'member:m-5'], team2: ['member:m-6', 'member:m-8'], relaxations: [] }], waiting: [] }] })
    })
    renderAt('/ops/roster')
    // ① 진행 중 라운드 출전 → 비활성
    fireEvent.click(await rowOf('진바람'))
    let sheet = await screen.findByTestId('edit-sheet')
    expect(await within(sheet).findByText('라운드가 끝난 뒤 삭제하세요')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: '게스트 삭제' })).toBeDisabled()
    expect(within(sheet).queryByText('현황')).toBeNull() // 게스트는 현황 없음(AC-015)
    fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByTestId('edit-sheet')).toBeNull())

    // ② 확정된 청백전 미기록 경기 → 비활성 + '청백전으로'
    fireEvent.click(await rowOf('하솔'))
    sheet = await screen.findByTestId('edit-sheet')
    expect(await within(sheet).findByText(/'가을 청백전'의 남은 경기 \d+개에 포함되어 있습니다/)).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: '청백전으로' })).toHaveAttribute('href', '/ops/club-matches/cm-1')
    fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByTestId('edit-sheet')).toBeNull())

    // ③ 확정 전 대진 포함 → 폐기 확인 후 삭제
    fireEvent.click(await rowOf('문솔빛'))
    sheet = await screen.findByTestId('edit-sheet')
    fireEvent.click(await within(sheet).findByRole('button', { name: '게스트 삭제' }))
    const dialog = await screen.findByRole('alertdialog', { name: "문솔빛을 삭제하면 '오늘 운동'의 확정하지 않은 대진이 폐기됩니다. 삭제할까요?" })
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('문솔빛 게스트를 삭제했습니다')).toBeInTheDocument()
    await waitFor(() => expect(readDb().guests.some((g) => g.name === '문솔빛')).toBe(false))
  })

  it('SCR-213 / AC-012 / AC-010: add a guest with validation and add a member directly', async () => {
    renderAt('/ops/roster')
    fireEvent.click(await screen.findByTestId('fab'))
    let sheet = await screen.findByTestId('add-sheet')
    fireEvent.click(within(sheet).getByRole('button', { name: '추가' }))
    expect(await within(sheet).findByText('이름을 입력해 주세요')).toBeInTheDocument()
    expect(within(sheet).getByText('급수를 골라 주세요')).toBeInTheDocument()
    fireEvent.change(within(sheet).getByLabelText('이름'), { target: { value: '새손님' } })
    fireEvent.click(within(sheet).getByRole('radio', { name: '여' }))
    fireEvent.click(within(sheet).getByRole('radio', { name: 'D조' }))
    fireEvent.click(within(sheet).getByRole('button', { name: '추가' }))
    expect(await rowOf('새손님')).toBeInTheDocument()
    expect(readDb().guests.find((g) => g.name === '새손님')).toMatchObject({ gender: '여', grade: 'D조', score: null })
    expect(readDb().users.some((u) => u.name === '새손님')).toBe(false) // 게스트는 가입 레코드 없음

    fireEvent.keyDown(screen.getByRole('button', { name: '더보기' }), { key: 'Enter' }) // Radix 메뉴는 jsdom에서 키보드로 엶
    fireEvent.click(await screen.findByRole('menuitem', { name: '회원 직접 추가' }))
    sheet = await screen.findByTestId('add-sheet')
    expect(within(sheet).getByText('카카오로 가입하지 않는 회원만 직접 추가하세요')).toBeInTheDocument()
    fireEvent.change(within(sheet).getByLabelText('이름'), { target: { value: '직접회원' } })
    fireEvent.click(within(sheet).getByRole('radio', { name: '남' }))
    fireEvent.click(within(sheet).getByRole('radio', { name: 'A조' }))
    fireEvent.click(within(sheet).getByRole('radio', { name: '8' }))
    fireEvent.change(within(sheet).getByLabelText(/누구의 지인/), { target: { value: '김가람' } })
    fireEvent.click(within(sheet).getByRole('button', { name: '추가' }))
    expect(await rowOf('직접회원')).toBeInTheDocument()
    expect(readDb().users.find((u) => u.name === '직접회원')).toMatchObject({ kakaoId: null, status: 'approved', score: 8, referrer: '김가람' })
  })

  it('SCR-214 / AC-016 / AC-071: each score saves at once, shows done, and the sheet closes when all are done', async () => {
    const people: RosterPerson[] = [
      { id: 'm-4', kind: 'member', name: '서이든', gender: '남', grade: '입문자', score: null, tutorialRecommendedUnpassed: true },
      { id: 'g-3', kind: 'guest', name: '진바람', gender: '남', grade: 'D조', score: null, tutorialRecommendedUnpassed: false },
    ]
    readDb()
    const onAllDone = vi.fn()
    const router = createMemoryRouter([{ path: '/', element: <ScoreEntrySheet people={people} onClose={() => {}} onAllDone={onAllDone} /> }])
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('점수 미설정 2명')).toBeInTheDocument()
    const first = screen.getAllByRole('radiogroup')[0]!
    fireEvent.click(within(first).getByRole('radio', { name: '6' }))
    expect(await screen.findByText('완료 · 6점')).toBeInTheDocument()
    expect(screen.getByText('점수 미설정 1명')).toBeInTheDocument()
    fireEvent.click(within(screen.getAllByRole('radiogroup')[1]!).getByRole('radio', { name: '3' }))
    await waitFor(() => expect(onAllDone).toHaveBeenCalled(), { timeout: 2000 })
    expect(readDb().users.find((u) => u.id === 'm-4')?.score).toBe(6)
    expect(readDb().guests.find((g) => g.id === 'g-3')?.score).toBe(3)
  })

  it('SCR-232 / AC-008 / AC-009: super admins appoint and dismiss admins; admins cannot enter', async () => {
    renderAt('/ops/roles', 'superAdmin')
    const membersList = await screen.findByRole('list', { name: '회원' })
    const row = within(membersList).getAllByRole('listitem').find((li) => li.textContent?.includes('한바다'))!
    fireEvent.click(within(row).getByRole('button', { name: '운영진 지정' }))
    const dialog = await screen.findByRole('alertdialog', { name: '한바다 님을 운영진으로 지정할까요?' })
    fireEvent.click(within(dialog).getByRole('button', { name: '지정' }))
    expect(await screen.findByText('한바다 님을 운영진으로 지정했습니다')).toBeInTheDocument()
    const staff = await screen.findByRole('list', { name: '슈퍼 관리자 · 운영진' })
    await waitFor(() => expect(staff).toHaveTextContent('한바다'))
    expect(within(staff).getAllByRole('listitem').find((li) => li.textContent?.includes('정마루'))!.querySelector('button')).toBeNull() // 슈퍼 관리자 행은 행동 없음
    expect(readDb().users.find((u) => u.name === '한바다')?.role).toBe('admin')

    fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없음' } })
    expect(await screen.findByText("'없음'과 일치하는 회원이 없습니다")).toBeInTheDocument()
  })
})
