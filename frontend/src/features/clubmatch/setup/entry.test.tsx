import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { read } from '../api'
import { renderAt, SCORED, seedDraft, st, waitSt } from './testkit'

// 진입·재진입(touches SCR-111·112) — AC-131, AC-042(만들기는 생성 페이지에서만), UXD-085 r8·099
describe('club match setup entry and re-entry', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
  })

  it('[SCR-111-ST1] [AC-131] admin list: new opens the setup page; a pending card opens the computed step', async () => {
    const router = renderAt('/club-matches')
    const pending = (await screen.findByText('연말 청백전')).closest('a')!
    expect(pending).toHaveAttribute('href', '/club-matches/cm-2/setup')
    expect(document.querySelector('[data-scr="SCR-111"]')).toHaveAttribute('data-st', 'SCR-111-ST1')
    fireEvent.click(screen.getByRole('button', { name: '새 청백전' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches/new'))
    await waitSt('SCR-241-ST7')
  })

  it('[SCR-112-ST5] [AC-131] admin opening a pending detail address goes to the setup page; members still see not-found', async () => {
    const id = await seedDraft({ method: 'team', keys: SCORED.slice(0, 8) })
    const router = renderAt(`/club-matches/${id}`)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`)) // 참가자·팀 충족 → 대진 설정
    await waitSt('SCR-244-ST1')
    const m = renderAt(`/club-matches/${id}`, 'member')
    expect(await screen.findAllByText('청백전을 찾을 수 없습니다')).toBeTruthy()
    expect(m.state.location.pathname).toBe(`/club-matches/${id}`)
    expect(document.querySelector('[data-scr="SCR-112"][data-st="SCR-112-ST5"]')).toBeTruthy()
  })

  it('[SCR-112-ST13] [AC-065, AC-070] a confirmed match is not reopened in setup: the setup address goes to the detail', async () => {
    const router = renderAt('/club-matches/cm-1/setup/basic')
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches/cm-1'))
    expect(await screen.findByTestId('ops-area')).toHaveAttribute('data-st', 'SCR-112-ST13')
    expect(screen.queryByRole('radiogroup', { name: '방식' })).toBeNull() // 확정 후 방식 변경 없음(AC-070)
  })

  it('[AC-131] resume computes the first unmet step; unreachable addresses go there; individual has no teams step', async () => {
    const a = await seedDraft({ method: 'individual', keys: [] })
    let r = renderAt(`/club-matches/${a}/setup`)
    await waitFor(() => expect(r.state.location.pathname).toBe(`/club-matches/${a}/setup/participants`))
    r = renderAt(`/club-matches/${a}/setup/confirm`)
    await waitFor(() => expect(r.state.location.pathname).toBe(`/club-matches/${a}/setup/participants`))
    const b = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 2 })
    r = renderAt(`/club-matches/${b}/setup/teams`)
    await waitFor(() => expect(r.state.location.pathname).toBe(`/club-matches/${b}/setup/games`))
    r = renderAt(`/club-matches/${b}/setup`)
    await waitFor(() => expect(r.state.location.pathname).toBe(`/club-matches/${b}/setup/confirm`))
    expect(st()).not.toBeNull()
  })
})
