import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updateDb } from '../../../lib/mock/db'
import { read } from '../api'
import { bumpVersion, match, next, renderAt, SCORED, seedDraft, st, waitSt, clickNext } from './testkit'

// SCR-245 확정 — UX Spec r9 02 SCR-245 상태 ST1·2·4–8, AC-130·077
const fail = vi.hoisted(() => ({ next: 0 }))
vi.mock('../api', async (orig) => {
  const m = await orig<typeof import('../api')>()
  const { ApiError } = await import('../../../lib/api')
  const wrap = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => (...a: A) => (fail.next-- > 0 ? Promise.reject(new ApiError(0, { code: 'network_error', message: 'x' })) : fn(...a))
  return { ...m, confirmClub: wrap(m.confirmClub) }
})

describe('SCR-245 confirm step', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    fail.next = 0
  })

  it('[SCR-245-ST1, SCR-245-ST8, SCR-245-ST2] [AC-130] summary groups and checks pass; confirm asks then opens the detail', async () => {
    const id = await seedDraft({ method: 'team', keys: SCORED.slice(0, 8), games: 4 })
    const router = renderAt(`/club-matches/${id}/setup/confirm`)
    await waitSt('SCR-245-ST1')
    for (const t of ['기본정보', '참가자', '팀 구성', '대진']) expect(screen.getByRole('region', { name: t })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '팀 구성' })).toHaveTextContent('청팀 4명 · 백팀 4명')
    expect(screen.getByRole('region', { name: '확정 전 확인' })).toHaveTextContent('미배정 0명 · 팀당 2명 이상')
    expect(screen.getByText('확정하면 회원에게 공개됩니다')).toBeInTheDocument()
    await clickNext()
    const dlg = await screen.findByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' })
    expect(st()).toBe('SCR-245-ST8')
    fireEvent.click(within(dlg).getByRole('button', { name: '확정' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}`))
    expect(match(id).status).toBe('confirmed')
  })

  it('[SCR-245-ST1] [AC-130] edit links go to the step and coming back keeps everything', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    const router = renderAt(`/club-matches/${id}/setup/confirm`)
    await waitSt('SCR-245-ST1')
    fireEvent.click(screen.getByRole('button', { name: '참가자 수정' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/participants`))
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    await clickNext()
    await waitSt('SCR-245-ST1')
    expect(match(id).games).toHaveLength(4)
  })

  it('[SCR-245-ST7] failed checks disable confirm with the reason and a fix link', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    updateDb((db) => void (db.users.find((u) => u.id === 'u-member')!.score = null))
    const router = renderAt(`/club-matches/${id}/setup/confirm`)
    await waitSt('SCR-245-ST7')
    expect(screen.getByText(/점수 미설정 1명\(김가람\)/)).toBeInTheDocument()
    expect(screen.getByText('확인 필요:', { exact: false })).toBeInTheDocument()
    expect(next()).toBeDisabled()
    expect(screen.getByText('확인이 필요한 항목을 먼저 고쳐 주세요')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/participants`))
  })

  it('[SCR-245-ST4] confirm failure shows a notice and keeps the step', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/confirm`)
    await waitSt('SCR-245-ST1')
    fail.next = 1
    await clickNext()
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '확정' }))
    expect(await screen.findByText('확정하지 못했습니다. 다시 시도해 주세요')).toBeInTheDocument()
    expect(st()).toBe('SCR-245-ST4')
    expect(match(id).status).toBe('draft')
  })

  it('[SCR-245-ST6] [AC-133] stale confirm is rejected with the conflict dialog', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/confirm`)
    await waitSt('SCR-245-ST1')
    bumpVersion(id)
    await clickNext()
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '확정' }))
    expect(await screen.findByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })).toBeInTheDocument()
    expect(st()).toBe('SCR-245-ST6')
    expect(match(id).status).toBe('draft')
  })

  it('[SCR-245-ST5] members get not-found', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/confirm`, 'member')
    expect(await screen.findByText('청백전을 찾을 수 없습니다')).toBeInTheDocument()
  })
})
