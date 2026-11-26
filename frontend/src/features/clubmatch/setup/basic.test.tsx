import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { read } from '../api'
import { bumpVersion, match, networkError, page, renderAt, seedDraft, st, waitSt, clickNext } from './testkit'

// SCR-241 기본정보 — UX Spec r9 02 SCR-241 상태 ST1·2·4·5·6·7·8·9·10, AC-122·123·070·132·134
const fail = vi.hoisted(() => ({ next: 0, hold: null as Promise<void> | null }))
vi.mock('../api', async (orig) => {
  const m = await orig<typeof import('../api')>()
  const { ApiError } = await import('../../../lib/api')
  const wrap = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A) => (fail.next-- > 0 ? Promise.reject(new ApiError(0, { code: 'network_error', message: 'x' })) : fn(...a))
  const held = async (id: string) => {
    if (fail.hold) await fail.hold
    return m.getClubMatchView(id)
  }
  return { ...m, getClubMatchView: held, saveBasic: wrap(m.saveBasic), createClubMatch: wrap(m.createClubMatch), deleteClubMatch: wrap(m.deleteClubMatch) }
})

describe('SCR-241 basic step', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    fail.next = 0
    fail.hold = null
  })

  it('[SCR-241-ST7, SCR-241-ST1] [AC-122] no method yet shows only step 1; picking a method switches 5 ↔ 4 steps immediately', async () => {
    renderAt('/club-matches/new')
    await waitSt('SCR-241-ST7')
    expect(screen.getByText('1 기본정보 · 방식을 고르면 단계가 정해집니다')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '팀전' }))
    expect(screen.getByRole('list', { name: '진행 단계 5개' })).toBeInTheDocument()
    expect(screen.getByText('1/5 기본정보')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '개인전' }))
    expect(screen.getByRole('list', { name: '진행 단계 4개' })).toBeInTheDocument()
    expect(screen.queryByText(/팀 구성/)).toBeNull() // 비활성 표시 없이 아예 없음
    fireEvent.click(screen.getByRole('radio', { name: '팀전' }))
    expect(screen.getByRole('list', { name: '진행 단계 5개' })).toBeInTheDocument()
    expect(st()).toBe('SCR-241-ST1')
  })

  it('[SCR-241-ST4] [AC-123] field errors: method, empty name, 31 characters with counter; not saved', async () => {
    renderAt('/club-matches/new')
    await waitSt('SCR-241-ST7')
    await clickNext()
    expect(await screen.findByText('방식을 골라 주세요')).toBeInTheDocument()
    expect(screen.getByText('이름을 입력해 주세요')).toBeInTheDocument()
    expect(st()).toBe('SCR-241-ST4')
    fireEvent.click(screen.getByRole('radio', { name: '팀전' }))
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '가'.repeat(31) } })
    expect(screen.getByText('31 / 30')).toBeInTheDocument()
    expect(screen.getByText('이름은 30자 이내로 입력해 주세요')).toBeInTheDocument()
    const before = read().clubMatches!.length
    await clickNext()
    await waitFor(() => expect(screen.getByRole('textbox', { name: '청백전 이름' })).toHaveFocus())
    expect(read().clubMatches!.length).toBe(before)
  })

  it('[SCR-241-ST2, SCR-241-ST4] save failure keeps input and retry creates once', async () => {
    const router = renderAt('/club-matches/new')
    await waitSt('SCR-241-ST7')
    fireEvent.click(screen.getByRole('radio', { name: '개인전' }))
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '실패 후 재시도' } })
    fail.next = 1
    await clickNext()
    expect(await screen.findByText('저장하지 못했습니다. 입력한 내용은 그대로입니다')).toBeInTheDocument()
    expect(st()).toBe('SCR-241-ST4')
    expect(screen.getByRole('textbox', { name: '청백전 이름' })).toHaveValue('실패 후 재시도')
    const before = read().clubMatches!.length
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(st()).toBe('SCR-241-ST2'))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/setup\/participants$/))
    expect(read().clubMatches!.length).toBe(before + 1)
  })

  it('[SCR-241-ST8] [AC-123] saved draft: name/date change keeps teams and games without a confirm', async () => {
    const id = await seedDraft({ method: 'team', games: 4, courtCount: 1 })
    const router = renderAt(`/club-matches/${id}/setup/basic`)
    await waitSt('SCR-241-ST8')
    expect(screen.getByRole('button', { name: '더보기: 청백전 삭제' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '바뀐 이름' } })
    fireEvent.change(screen.getByLabelText(/^날짜/), { target: { value: '2026-12-20' } })
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/participants`))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect([match(id).name, match(id).date, match(id).games.length]).toEqual(['바뀐 이름', '2026-12-20', 4])
    expect(Object.values(match(id).participants).every((p) => p.team !== null)).toBe(true)
  })

  it('[SCR-241-ST9] [AC-070, AC-132] method change with teams and games asks; cancel keeps, confirm discards', async () => {
    const id = await seedDraft({ method: 'team', games: 4, courtCount: 1 })
    renderAt(`/club-matches/${id}/setup/basic`)
    await waitSt('SCR-241-ST8')
    fireEvent.click(screen.getByRole('radio', { name: '개인전' }))
    expect(screen.getByRole('list', { name: '진행 단계 4개' })).toBeInTheDocument()
    await clickNext()
    const dlg = await screen.findByRole('alertdialog', { name: '방식을 바꾸면 만든 대진과 팀 배정이 초기화됩니다' })
    expect(st()).toBe('SCR-241-ST9')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.getByRole('radio', { name: '팀전' })).toHaveAttribute('aria-checked', 'true'))
    expect(match(id).method).toBe('team')
    fireEvent.click(screen.getByRole('radio', { name: '개인전' }))
    await clickNext()
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '바꾸기' }))
    await waitFor(() => expect(match(id).method).toBe('individual'))
    expect(match(id).games).toHaveLength(0)
    expect(Object.values(match(id).participants).every((p) => p.team === null)).toBe(true)
    expect(Object.keys(match(id).participants)).toHaveLength(8)
  })

  it('[SCR-241-ST10] [AC-134] delete asks first; cancel changes nothing, confirm removes and returns to the list', async () => {
    const id = await seedDraft({ method: 'individual', games: 2, courtCount: 1 })
    const router = renderAt(`/club-matches/${id}/setup/basic`)
    await waitSt('SCR-241-ST8')
    fireEvent.click(screen.getByRole('button', { name: '더보기: 청백전 삭제' }))
    let dlg = await screen.findByRole('alertdialog', { name: '청백전을 삭제할까요?' })
    expect(st()).toBe('SCR-241-ST10')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(match(id)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '더보기: 청백전 삭제' }))
    dlg = await screen.findByRole('alertdialog', { name: '청백전을 삭제할까요?' })
    fireEvent.click(within(dlg).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches'))
    expect(read().clubMatches!.some((m) => m.id === id)).toBe(false)
  })

  it('[SCR-241-ST6] [AC-133] another admin changed it first: conflict dialog, then the latest state', async () => {
    const id = await seedDraft({ method: 'individual', courtCount: 1 })
    renderAt(`/club-matches/${id}/setup/basic`)
    await waitSt('SCR-241-ST8')
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '내가 바꾼 이름' } })
    bumpVersion(id)
    await clickNext()
    expect(await screen.findByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })).toBeInTheDocument()
    expect(st()).toBe('SCR-241-ST6')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: '청백전 이름' })).toHaveValue('준비 중 테스트'))
    expect(match(id).name).toBe('준비 중 테스트')
  })

  it('[SCR-241-ST5] members: /club-matches/new is forbidden and setup addresses look like a missing match', async () => {
    const router = renderAt('/club-matches/new', 'member')
    await waitFor(() => expect(router.state.location.pathname).toBe('/forbidden'))
    expect(page()).toBeNull()
  })

  it('[SCR-241-ST2] re-entry shows loading first', async () => {
    const id = await seedDraft({ method: 'individual', courtCount: 1 })
    let release = () => undefined as void
    fail.hold = new Promise<void>((r) => (release = r))
    renderAt(`/club-matches/${id}/setup/basic`)
    await waitSt('SCR-241-ST2')
    expect(screen.getByLabelText('청백전을 불러오는 중')).toBeInTheDocument()
    fail.hold = null
    release()
    await waitSt('SCR-241-ST8')
    expect(networkError().status).toBe(0)
  })
})
