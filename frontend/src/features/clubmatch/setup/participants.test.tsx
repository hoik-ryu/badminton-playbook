import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readDb } from '../../../lib/mock/db'
import { read } from '../api'
import { bumpVersion, match, renderAt, seedDraft, st, waitSt, clickNext } from './testkit'

// SCR-242 참가자 설정 · SCR-246 선택한 참가자 시트 · (touches) SCR-214 점수 시트 — AC-124·125·126·128·132·133
const fail = vi.hoisted(() => ({ next: 0 }))
vi.mock('../api', async (orig) => {
  const m = await orig<typeof import('../api')>()
  const { ApiError } = await import('../../../lib/api')
  const wrap = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A) => (fail.next-- > 0 ? Promise.reject(new ApiError(0, { code: 'network_error', message: 'x' })) : fn(...a))
  return { ...m, saveParticipants: wrap(m.saveParticipants) }
})

const row = (name: string) => screen.getByRole('checkbox', { name: new RegExp(`^${name},`) })
const head = () => document.querySelector('.su-listhead b')?.textContent ?? ''
const summary = () => screen.getByRole('button', { name: /^선택 \d+명/ })

describe('SCR-242 participants step', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    fail.next = 0
  })

  it('[SCR-242-ST1, SCR-242-ST2] [AC-124] list shows members then guests with name·gender·grade·score, unscored badge, guest badge', async () => {
    const id = await seedDraft({ method: 'individual', keys: [] })
    renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST2')
    await waitSt('SCR-242-ST1')
    expect(head()).toMatch(/^전체 회원 \(\d+\)$/)
    expect(row('서이든')).toHaveTextContent('점수 미설정')
    expect(within(screen.getByRole('list', { name: '게스트' })).getAllByText('게스트').length).toBeGreaterThan(0)
    expect(screen.queryByRole('checkbox', { name: /^비활성,/ })).toBeNull() // 비활성 회원은 고를 수 없음
    expect(screen.getByTestId('su-next')).toBeDisabled()
    expect(screen.getByText('참가자를 4명 이상 선택해 주세요 · 지금 0명')).toBeInTheDocument()
  })

  it('[SCR-242-ST3, SCR-246-ST1, SCR-246-ST3] [AC-124, AC-125] search·filters keep selection; bulk applies to visible only; sheet removes', async () => {
    const id = await seedDraft({ method: 'individual', keys: [] })
    renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST1')
    expect(head()).toMatch(/^전체 회원/)
    fireEvent.click(summary())
    expect(await screen.findByText('아직 선택한 사람이 없습니다')).toBeInTheDocument()
    expect(document.querySelector('[data-scr="SCR-246"]')).toHaveAttribute('data-st', 'SCR-246-ST3')
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    for (const n of ['김가람', '박다온', '정마루']) fireEvent.click(row(n))
    fireEvent.click(screen.getByRole('button', { name: '여' }))
    expect(head()).toMatch(/^검색 결과/)
    const bulk = screen.getByRole('checkbox', { name: /표시된 \d+명 모두 선택/ })
    const visible = Number(bulk.textContent!.match(/표시된 (\d+)명/)![1])
    fireEvent.click(bulk)
    expect(summary()).toHaveTextContent(`선택 ${3 + visible}명`)
    expect(summary()).toHaveTextContent('남 3')
    fireEvent.click(screen.getByRole('checkbox', { name: /표시된 \d+명 모두 해제/ }))
    expect(summary()).toHaveTextContent('선택 3명')
    fireEvent.change(screen.getByRole('searchbox', { name: '이름으로 검색' }), { target: { value: '홍길동' } })
    expect(await screen.findByText("'홍길동'과 일치하는 사람이 없습니다")).toBeInTheDocument()
    expect(st()).toBe('SCR-242-ST3')
    fireEvent.click(screen.getByRole('button', { name: '검색·필터 지우기' }))
    expect(head()).toMatch(/^전체 회원/)
    fireEvent.click(summary())
    const sheet = await screen.findByTestId('selected-sheet')
    expect(within(sheet).getByRole('heading', { name: /선택한 참가자 3명/ })).toBeInTheDocument()
    expect(document.querySelector('[data-scr="SCR-246"]')).toHaveAttribute('data-st', 'SCR-246-ST1')
    fireEvent.click(within(sheet).getByRole('button', { name: '김가람 선택 해제' }))
    await waitFor(() => expect(within(sheet).getByRole('heading', { name: /선택한 참가자 2명/ })).toBeInTheDocument())
    expect(match(id).participants).toEqual({}) // 시트는 저장하지 않음
  })

  it('[SCR-242-ST7, SCR-214-ST1] [AC-126] unscored selected people block next; scoring sheet explains the roster scope', async () => {
    const id = await seedDraft({ method: 'individual', keys: [] })
    renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST1')
    for (const n of ['김가람', '박다온', '정마루', '서이든']) fireEvent.click(row(n))
    await waitSt('SCR-242-ST7')
    expect(screen.getByTestId('su-next')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '점수 미설정 1명, 점수 매기기' }))
    const sheet = await screen.findByTestId('score-sheet')
    expect(within(sheet).getByText('명단 점수로 저장되어 다른 청백전과 대진에도 쓰입니다')).toBeInTheDocument()
    expect(document.querySelector('[data-scr="SCR-214"]')).toHaveAttribute('data-st', 'SCR-214-ST1')
    fireEvent.click(within(sheet).getByRole('radio', { name: '7' }))
    await waitFor(() => expect(readDb().users.find((u) => u.id === 'm-4')!.score).toBe(7)) // 명단 공통 점수
    await waitFor(() => expect(screen.queryByTestId('score-sheet')).toBeNull())
    await waitSt('SCR-242-ST9')
    expect(screen.getByTestId('su-next')).toBeEnabled()
  })

  it('[SCR-242-ST8, SCR-242-ST9] [AC-125, AC-128] next saves the list once; nothing saved before; teams of remaining people kept', async () => {
    const id = await seedDraft({ method: 'team', keys: ['u-member', 'u-admin', 'u-super', 'm-1'].map((x) => `member:${x}`) })
    const router = renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST8')
    fireEvent.click(row('한바다'))
    fireEvent.click(row('정마음'))
    fireEvent.click(row('김가람'))
    await waitSt('SCR-242-ST9')
    expect(Object.keys(match(id).participants)).toHaveLength(4) // 아직 저장 안 됨
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/teams`))
    const p = match(id).participants
    expect(Object.keys(p).sort()).toEqual(['member:m-1', 'member:m-3', 'member:m-8', 'member:u-admin', 'member:u-super'].sort())
    expect([p['member:u-admin']!.team, p['member:m-3']!.team]).toEqual(['white', null])
  })

  it('[SCR-242-ST10] [AC-132] with games, the first change asks; cancel reverts; confirm discards on next', async () => {
    const id = await seedDraft({ method: 'individual', games: 3 })
    const router = renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST8')
    fireEvent.click(row('김민결'))
    const dlg = await screen.findByRole('alertdialog', { name: '대진이 초기화됩니다' })
    expect(st()).toBe('SCR-242-ST10')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(row('김민결')).toHaveAttribute('aria-checked', 'false'))
    fireEvent.click(row('김민결'))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '바꾸기' }))
    await waitFor(() => expect(row('김민결')).toHaveAttribute('aria-checked', 'true'))
    expect(match(id).games).toHaveLength(3) // 확인만으로는 저장 안 됨
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    expect(match(id).games).toHaveLength(0)
    expect(Object.keys(match(id).participants)).toHaveLength(9)
  })

  it('[SCR-242-ST4] [AC-133] save failure keeps selection; retry saves once', async () => {
    const id = await seedDraft({ method: 'individual', keys: [] })
    const router = renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST1')
    for (const n of ['김가람', '박다온', '정마루', '권초록']) fireEvent.click(row(n))
    fail.next = 1
    await clickNext()
    expect(await screen.findByText('저장하지 못했습니다. 입력한 내용은 그대로입니다')).toBeInTheDocument()
    expect(st()).toBe('SCR-242-ST4')
    expect(summary()).toHaveTextContent('선택 4명')
    expect(match(id).participants).toEqual({})
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    expect(Object.keys(match(id).participants)).toHaveLength(4)
  })

  it('[SCR-242-ST4] a selected person who lost eligibility is shown with the reason', async () => {
    const id = await seedDraft({ method: 'individual', keys: ['u-member', 'u-admin', 'u-super', 'm-1', 'm-2'].map((x) => `member:${x}`) })
    readDb()
    const { updateDb } = await import('../../../lib/mock/db')
    updateDb((db) => void (db.users.find((u) => u.id === 'm-2')!.status = 'inactive'))
    renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST4')
    expect(row('오아라')).toHaveTextContent('참가할 수 없는 사람입니다')
  })

  it('[SCR-242-ST6] [AC-133] conflict: dialog, then the latest selection is shown', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCOREDish() })
    renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST8')
    fireEvent.click(row('김민결'))
    bumpVersion(id)
    await clickNext()
    expect(await screen.findByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })).toBeInTheDocument()
    expect(st()).toBe('SCR-242-ST6')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(row('김민결')).toHaveAttribute('aria-checked', 'false'))
  })

  it('[SCR-242-ST5] members get the same not-found as a missing match', async () => {
    const id = await seedDraft({ method: 'individual' })
    renderAt(`/club-matches/${id}/setup/participants`, 'member')
    expect(await screen.findByText('청백전을 찾을 수 없습니다')).toBeInTheDocument()
    expect(document.querySelector('[data-scr="SCR-112"]')).toHaveAttribute('data-st', 'SCR-112-ST5')
    expect(document.body).not.toHaveTextContent('준비 중 테스트')
  })
})

function SCOREDish() {
  return ['u-member', 'u-admin', 'u-super', 'm-1', 'm-2'].map((x) => `member:${x}`)
}
