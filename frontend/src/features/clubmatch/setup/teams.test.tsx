import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { read } from '../api'
import { bumpVersion, match, renderAt, SCORED, seedDraft, st, waitSt, clickNext } from './testkit'

// SCR-243 팀 구성 — UX Spec r9 02 SCR-243(UXD-095 r9) 상태 ST1·2·4–14, AC-072·127·128·132·133·135
const fail = vi.hoisted(() => ({ next: 0 }))
vi.mock('../api', async (orig) => {
  const m = await orig<typeof import('../api')>()
  const { ApiError } = await import('../../../lib/api')
  const wrap = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A) => (fail.next-- > 0 ? Promise.reject(new ApiError(0, { code: 'network_error', message: 'x' })) : fn(...a))
  return { ...m, saveTeams: wrap(m.saveTeams) }
})

const teamCount = (t: '청팀' | '백팀') => Number(document.querySelector(`.su-team[data-team="${t === '청팀' ? 'blue' : 'white'}"] h4 small`)?.textContent?.replace('명', ''))
const moveBtn = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},.*누르면`) })
const EIGHT = SCORED.slice(0, 8)

describe('SCR-243 teams step', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    fail.next = 0
  })

  it('[SCR-243-ST7, SCR-243-ST2] [AC-127, AC-072] first entry with no saved teams fills the algorithm proposal (not saved yet), next saves all', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT, teams: 'none' })
    const router = renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST7')
    expect(screen.getByText('알고리즘 배정안을 채웠습니다. 아직 저장 전입니다')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '자동 배정' })).toHaveAttribute('aria-checked', 'true')
    expect([teamCount('청팀'), teamCount('백팀')]).toEqual([4, 4])
    expect(Object.values(match(id).participants).every((p) => p.team === null)).toBe(true)
    await clickNext()
    await waitSt('SCR-243-ST2')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    expect(Object.values(match(id).participants).every((p) => p.team !== null)).toBe(true)
  })

  it('[SCR-243-ST1] [AC-135] re-entry restores the saved assignment without re-running auto, no method selected', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT })
    renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST1')
    expect(screen.getByRole('radio', { name: '자동 배정' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByText(/알고리즘 배정안을 채웠습니다/)).toBeNull()
    expect(moveBtn('김가람')).toHaveAccessibleName(/청팀. 누르면 백팀으로 이동/)
  })

  it('[SCR-243-ST10] [AC-127] tapping moves to the other team with live text; undo reverts; uneven sizes only warn', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT })
    renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST1')
    fireEvent.click(moveBtn('김가람'))
    expect(screen.getByText('김가람, 백팀으로 이동')).toBeInTheDocument()
    expect(screen.getByText('김가람 → 백팀')).toBeInTheDocument()
    expect([teamCount('청팀'), teamCount('백팀')]).toEqual([3, 5])
    expect(await screen.findByText('두 팀 인원이 2명 이상 차이 납니다(청 3 · 백 5)')).toBeInTheDocument()
    expect(st()).toBe('SCR-243-ST10')
    expect(screen.getByTestId('su-next')).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
    expect([teamCount('청팀'), teamCount('백팀')]).toEqual([4, 4])
    fireEvent.click(moveBtn('김가람'))
    fireEvent.click(moveBtn('박다온'))
    fireEvent.click(screen.getByRole('button', { name: '저장된 배정으로 되돌리기' }))
    expect(moveBtn('김가람')).toHaveAccessibleName(/청팀. 누르면/)
    expect(moveBtn('박다온')).toHaveAccessibleName(/백팀. 누르면/)
  })

  it('[SCR-243-ST8] [AC-128] new participants are unassigned, kept teams stay; next blocked until picked', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT.slice(0, 6) })
    const { saveParticipants, getClubMatchView } = await import('../api')
    const v = await getClubMatchView(id)
    await saveParticipants(id, v.version, EIGHT)
    renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST8')
    expect(screen.getByText('미배정 2명 · 팀을 골라 주세요')).toBeInTheDocument()
    expect(screen.getByText('미배정 2명의 팀을 골라 주세요')).toBeInTheDocument()
    expect(screen.getByTestId('su-next')).toBeDisabled()
    const unassigned = screen.getByRole('list', { name: '미배정' })
    for (const b of within(unassigned).getAllByRole('button', { name: /백팀에 배정/ })) fireEvent.click(b)
    expect(screen.queryByRole('list', { name: '미배정' })).toBeNull()
    expect(screen.getByTestId('su-next')).toBeEnabled()
  })

  it('[SCR-243-ST9] [AC-128] a team with fewer than two blocks next (moving is still allowed)', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT.slice(0, 4) })
    renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST1')
    const blueRows = within(screen.getByRole('list', { name: '청팀' })).getAllByRole('button')
    fireEvent.click(blueRows[0]!)
    await waitSt('SCR-243-ST9')
    expect(screen.getByText('청팀이 2명 이상이어야 합니다')).toBeInTheDocument()
    expect(screen.getByTestId('su-next')).toBeDisabled()
  })

  it('[SCR-243-ST13, SCR-243-ST14, SCR-243-ST12] [AC-135] manual asks then unassigns everyone; auto asks then applies the proposal', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT })
    renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST1')
    fireEvent.click(screen.getByRole('radio', { name: '직접 구성' }))
    let dlg = await screen.findByRole('alertdialog', { name: '직접 구성으로 바꿀까요?' })
    expect(st()).toBe('SCR-243-ST13')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect([teamCount('청팀'), teamCount('백팀')]).toEqual([4, 4])
    fireEvent.click(screen.getByRole('radio', { name: '직접 구성' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '바꾸기' }))
    await waitSt('SCR-243-ST14')
    expect(screen.getByText('미배정 8명 · 팀을 골라 주세요')).toBeInTheDocument()
    expect(screen.getByTestId('su-next')).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: '자동 배정' }))
    await waitFor(() => expect([teamCount('청팀'), teamCount('백팀')]).toEqual([4, 4])) // 배정이 없으면 확인 없이
    fireEvent.click(moveBtn('김가람'))
    fireEvent.click(screen.getByRole('radio', { name: '자동 배정' }))
    dlg = await screen.findByRole('alertdialog', { name: '알고리즘 배정안으로 다시 나눌까요?' })
    expect(st()).toBe('SCR-243-ST12')
    fireEvent.click(within(dlg).getByRole('button', { name: '다시 나누기' }))
    await waitFor(() => expect([teamCount('청팀'), teamCount('백팀')]).toEqual([4, 4]))
  })

  it('[SCR-243-ST11] [AC-132] with games, the first team change asks; cancel keeps; confirm discards on next without regenerating', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT, games: 4 })
    const router = renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST1')
    fireEvent.click(moveBtn('김가람'))
    const dlg = await screen.findByRole('alertdialog', { name: '대진이 초기화됩니다' })
    expect(st()).toBe('SCR-243-ST11')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect([teamCount('청팀'), teamCount('백팀')]).toEqual([4, 4]))
    fireEvent.click(moveBtn('김가람'))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '바꾸기' }))
    fireEvent.click(moveBtn('박다온'))
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    expect(match(id).games).toHaveLength(0)
  })

  it('[SCR-243-ST4] [AC-133] save failure keeps the assignment; retry saves', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT })
    const router = renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST1')
    fireEvent.click(moveBtn('김가람'))
    fireEvent.click(moveBtn('박다온'))
    fail.next = 1
    await clickNext()
    expect(await screen.findByText('저장하지 못했습니다. 입력한 내용은 그대로입니다')).toBeInTheDocument()
    expect(st()).toBe('SCR-243-ST4')
    expect(match(id).participants['member:u-member']!.team).toBe('blue')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    expect(match(id).participants['member:u-member']!.team).toBe('white')
  })

  it('[SCR-243-ST6] [AC-133] conflict shows the dialog and redraws the latest assignment', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT })
    renderAt(`/club-matches/${id}/setup/teams`)
    await waitSt('SCR-243-ST1')
    fireEvent.click(moveBtn('김가람'))
    fireEvent.click(moveBtn('박다온'))
    bumpVersion(id)
    await clickNext()
    expect(await screen.findByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })).toBeInTheDocument()
    expect(st()).toBe('SCR-243-ST6')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(moveBtn('김가람')).toHaveAccessibleName(/청팀. 누르면/))
  })

  it('[SCR-243-ST5] members get not-found; individual matches skip the teams step', async () => {
    const id = await seedDraft({ method: 'team', keys: EIGHT })
    renderAt(`/club-matches/${id}/setup/teams`, 'member')
    expect(await screen.findByText('청백전을 찾을 수 없습니다')).toBeInTheDocument()
  })
})
