import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { read } from '../api'
import { bumpVersion, match, next, renderAt, SCORED, seedDraft, st, waitSt } from './testkit'

// SCR-244 대진 설정 · (touches) SCR-225 선수 교체 — UX Spec r9 02 SCR-244 상태 ST1·2·4–9, AC-065·073·074·129·132
const fail = vi.hoisted(() => ({ next: 0 }))
vi.mock('../api', async (orig) => {
  const m = await orig<typeof import('../api')>()
  const { ApiError } = await import('../../../lib/api')
  const wrap = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A) => (fail.next-- > 0 ? Promise.reject(new ApiError(0, { code: 'network_error', message: 'x' })) : fn(...a))
  return { ...m, generateClub: wrap(m.generateClub), setSettings: wrap(m.setSettings) }
})

const count = () => screen.getByRole('textbox', { name: '총 경기 수' })

describe('SCR-244 games step', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    fail.next = 0
  })

  it('[SCR-244-ST1, SCR-244-ST2, SCR-244-ST7] [AC-129, AC-073] generate saves settings with games; review shows summary, per-person counts and preview', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST1')
    expect(screen.getByText(/모두/)).toHaveTextContent('모두 4경기씩 합니다')
    expect(screen.getByTestId('su-next')).toBeDisabled()
    expect(screen.getByText('대진을 먼저 만들어 주세요')).toBeInTheDocument()
    fireEvent.change(count(), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('switch', { name: /밸런스 맞추기/ }))
    fireEvent.click(screen.getByTestId('su-generate'))
    await waitSt('SCR-244-ST2')
    await waitSt('SCR-244-ST7')
    expect([match(id).totalGames, match(id).rules.balance, match(id).games.length]).toEqual([6, false, 6])
    expect(screen.getByRole('region', { name: '사람별 경기 수' })).toHaveTextContent('김가람 3')
    expect(screen.getAllByRole('listitem').filter((li) => li.classList.contains('su-game'))).toHaveLength(6)
    expect(screen.getAllByRole('button', { name: /^1경기 .* 교체$/ })).toHaveLength(4)
    const seed = match(id).seed
    fireEvent.click(screen.getByRole('button', { name: '다시 생성' }))
    await waitFor(() => expect(match(id).seed).not.toBe(seed))
    expect(screen.getByTestId('su-next')).toBeEnabled()
  })

  it('[SCR-244-ST9] [AC-074] uneven distribution suggests even totals; keep input hides them', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 7) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST9')
    const proposals = screen.getByRole('group', { name: '균등안' })
    expect(within(proposals).getByRole('button', { name: /^7경기 \(1인 4경기\)$/ })).toBeInTheDocument()
    expect(within(proposals).getByRole('button', { name: /^14경기 \(1인 8경기\)$/ })).toBeInTheDocument()
    fireEvent.click(within(proposals).getByRole('button', { name: /^7경기/ }))
    await waitSt('SCR-244-ST1')
    expect(count()).toHaveValue('7')
    fireEvent.change(count(), { target: { value: '8' } })
    await waitSt('SCR-244-ST9')
    fireEvent.click(screen.getByRole('button', { name: '입력값 유지' }))
    expect(screen.queryByRole('group', { name: '균등안' })).toBeNull()
  })

  it('[SCR-244-ST8] [AC-132] with games, changing rules or count asks; cancel keeps; confirm saves and discards at once', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    fireEvent.click(screen.getByRole('switch', { name: /성별 조합 맞추기/ }))
    let dlg = await screen.findByRole('alertdialog', { name: '대진이 초기화됩니다' })
    expect(st()).toBe('SCR-244-ST8')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('switch', { name: /성별 조합 맞추기/ })).toBeChecked()
    expect(match(id).games).toHaveLength(4)
    fireEvent.change(count(), { target: { value: '10' } })
    fireEvent.blur(count())
    dlg = await screen.findByRole('alertdialog', { name: '대진이 초기화됩니다' })
    fireEvent.click(within(dlg).getByRole('button', { name: '바꾸기' }))
    await waitFor(() => expect(match(id).games).toHaveLength(0))
    expect(match(id).totalGames).toBe(10)
    await waitSt('SCR-244-ST1') // 8명 × 10경기 = 모두 5경기(대진 없음)
  })

  it('[SCR-244-ST4] generation refused by the server shows its message; network failure keeps settings with retry', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST1')
    fail.next = 1
    fireEvent.click(screen.getByTestId('su-generate'))
    expect(await screen.findByText('대진을 만들지 못했습니다. 설정은 그대로입니다')).toBeInTheDocument()
    expect(st()).toBe('SCR-244-ST4')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitSt('SCR-244-ST7')
    expect(match(id).games.length).toBeGreaterThan(0)
  })

  it('[SCR-244-ST4] invalid count is a field error', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST1')
    fireEvent.change(count(), { target: { value: '0' } })
    expect(await screen.findByText('경기 수를 1 이상으로 입력해 주세요')).toBeInTheDocument()
    expect(st()).toBe('SCR-244-ST4')
    expect(screen.getByTestId('su-generate')).toBeDisabled()
  })

  it('[SCR-244-ST6] [AC-133] conflict on generate shows the dialog', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST1')
    bumpVersion(id)
    fireEvent.click(screen.getByTestId('su-generate'))
    expect(await screen.findByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })).toBeInTheDocument()
    expect(st()).toBe('SCR-244-ST6')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('[SCR-225-ST1, SCR-244-ST7] [AC-065] team review shows gap and team lines; tapping a player opens the existing swap sheet', async () => {
    const id = await seedDraft({ method: 'team', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    expect(screen.getAllByText(/^실력차/).length).toBe(4)
    expect(document.querySelectorAll('.su-tl[data-team="blue"]').length).toBe(4)
    fireEvent.click(screen.getAllByRole('button', { name: /^1경기 .* 교체$/ })[0]!)
    const sheet = await screen.findByTestId('club-swap-sheet')
    expect(sheet.querySelector('[data-scr="SCR-225"]')).toHaveAttribute('data-st', 'SCR-225-ST1')
    fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
  })

  it('[SCR-244-ST5] members get not-found', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`, 'member')
    expect(await screen.findByText('청백전을 찾을 수 없습니다')).toBeInTheDocument()
    expect(next).toBeTruthy()
  })
})
