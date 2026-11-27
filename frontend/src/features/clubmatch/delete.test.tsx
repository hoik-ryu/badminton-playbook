import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { confirmClub, createClubMatch, excludeWithSubstitutes, generateClub, getClubMatchView, read, recordResult, saveParticipants } from './api'
import { SCORED } from './setup/testkit'

// (CP-001) 청백전 삭제 범위 확대 — 기획 r15 C-32·AC-134·AC-166, UX Spec SCR-241-ST10·SCR-112-ST25, UXD-114, VD-068 CP-001 항목.
// 준비 중(생성 페이지)과 진행 예정(상세, 운영진)에서만 머리글 더보기 메뉴 '청백전 삭제'(위험 톤) → 이름 있는 확인 창 → 목록 + 토스트.
// 진행 중·종료·운영 이력(경기 취소·중도 귀가)·회원에게는 메뉴 없음. 실패하면 화면 유지 + 안내. 날짜는 먼 미래·지난 날로 오늘과 관계없게.
const ctl = vi.hoisted(() => ({ failCode: null as null | { status: number; code: string; message: string } }))
vi.mock('./api', async (orig) => {
  const m = await orig<typeof import('./api')>()
  const { ApiError } = await import('../../lib/api')
  return {
    ...m,
    deleteClubMatch: async (...a: Parameters<typeof m.deleteClubMatch>) => {
      if (ctl.failCode) {
        const e = ctl.failCode
        ctl.failCode = null
        throw new ApiError(e.status, { code: e.code, message: e.message })
      }
      return m.deleteClubMatch(...a)
    },
  }
})

const FUTURE = '2099-12-31'
const PAST = '2026-11-15'
async function confirmedMatch(name: string, date: string, keys = SCORED.slice(0, 8)) {
  const id = await createClubMatch({ method: 'individual', date, name, courtCount: 2 })
  let v = await saveParticipants(id, 1, keys)
  v = await generateClub(id, v.version, { rounds: 2, rules: { balance: true, gender: true } })
  await confirmClub(id, v.version)
  return id
}
function renderAt(path: string, persona: PersonaKey = 'admin') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const exists = (id: string) => readDb().clubMatches!.some((m) => m.id === id)
const toastText = () => document.querySelector('[data-cmp=CMP-029]')?.textContent ?? ''
const openMore = async () => fireEvent.keyDown(await screen.findByRole('button', { name: '더보기' }), { key: 'Enter' }) // Radix 메뉴는 jsdom에서 키보드로 엶
const opsSt = () => screen.getByTestId('ops-area').getAttribute('data-st')

describe('club match delete (CP-001)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    ctl.failCode = null
  })

  it('[SCR-112-ST15, SCR-112-ST25] [AC-166] admins delete an upcoming match from the detail menu: named confirm, cancel keeps it, confirm goes to the list with a toast', async () => {
    const id = await confirmedMatch('12월 번개 청백전', FUTURE)
    const router = renderAt(`/club-matches/${id}`)
    expect(await screen.findByTestId('detail-badges')).toHaveTextContent('진행 예정')
    await openMore()
    const item = await screen.findByRole('menuitem', { name: '청백전 삭제' })
    expect(item).toHaveAttribute('data-tone', 'danger')
    fireEvent.click(item)
    const dlg = await screen.findByRole('alertdialog', { name: "'12월 번개 청백전'을 삭제할까요?" })
    expect(within(dlg).getByText('참가자와 대진도 함께 지워지고 되돌릴 수 없습니다')).toBeInTheDocument()
    expect(opsSt()).toBe('SCR-112-ST25')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(exists(id)).toBe(true)
    await openMore()
    fireEvent.click(await screen.findByRole('menuitem', { name: '청백전 삭제' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches'))
    expect(exists(id)).toBe(false)
    await waitFor(() => expect(toastText()).toContain('청백전을 삭제했습니다'))
  })

  it('[SCR-112-ST4] [AC-166] a failed or refused delete keeps the screen and explains why', async () => {
    const id = await confirmedMatch('실패 청백전', FUTURE)
    const router = renderAt(`/club-matches/${id}`)
    await openMore()
    fireEvent.click(await screen.findByRole('menuitem', { name: '청백전 삭제' }))
    ctl.failCode = { status: 0, code: 'network_error', message: 'x' }
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('청백전을 삭제하지 못했습니다. 다시 시도해 주세요')).toBeInTheDocument()
    expect(opsSt()).toBe('SCR-112-ST4')
    expect(router.state.location.pathname).toBe(`/club-matches/${id}`)
    await openMore()
    fireEvent.click(await screen.findByRole('menuitem', { name: '청백전 삭제' }))
    ctl.failCode = { status: 409, code: 'locked', message: '경기 결과나 운영 기록이 있는 청백전은 삭제할 수 없습니다' }
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('경기 결과나 운영 기록이 있는 청백전은 삭제할 수 없습니다')).toBeInTheDocument()
    expect(exists(id)).toBe(true)
  })

  it('[SCR-112] (2026-11-27) upcoming: results cannot be recorded before the match date — locked cards and a dated notice', async () => {
    const id = await confirmedMatch('예정 기록 막기', FUTURE)
    renderAt(`/club-matches/${id}`)
    await screen.findByTestId('ops-area')
    expect(screen.getByText('12월 31일 (목)부터 결과를 기록할 수 있습니다')).toBeInTheDocument()
    const games = (await getClubMatchView(id)).games.length
    expect(screen.getAllByTestId('locked-result')).toHaveLength(games)
    expect(screen.queryByRole('button', { name: /승$/ })).toBeNull()
  })

  it('[SCR-112-ST15] [AC-166] (2026-11-27) live and history matches show the delete menu and delete; finished and members do not', async () => {
    const { deleteClubMatch } = await import('./api')
    // 진행 중(날짜 지남) + 결과 기록: 운영진 메뉴 있음, 확인 창에 결과·전적 안내
    const live = await confirmedMatch('지난 청백전', PAST)
    let v = await getClubMatchView(live)
    v = await recordResult(live, v.version, 1, 1)
    renderAt(`/club-matches/${live}`)
    await openMore()
    fireEvent.click(await screen.findByRole('menuitem', { name: '청백전 삭제' }))
    expect(await screen.findByText('참가자·대진·기록된 결과가 함께 지워지고 전적에서도 빠집니다. 되돌릴 수 없습니다')).toBeInTheDocument()
    cleanup()
    // 진행 예정이지만 중도 귀가로 경기 취소(이력)도 삭제
    const hist = await confirmedMatch('이력 청백전', FUTURE)
    let h = await getClubMatchView(hist)
    const leaver = h.games[0]!.team1[0]!.key
    h = await excludeWithSubstitutes(hist, h.version, leaver, [], h.games.filter((g) => [...g.team1, ...g.team2].some((p) => p.key === leaver)).map((g) => g.no))
    for (const [mid, ver] of [
      [live, v.version],
      [hist, h.version],
    ] as const) {
      await deleteClubMatch(mid, ver)
      expect(exists(mid)).toBe(false)
    }
    // 종료: 메뉴 없음, Mock도 거부
    const done = await confirmedMatch('종료 청백전', PAST)
    updateDb((db) => void (db.clubMatches!.find((m) => m.id === done)!.status = 'finished'))
    renderAt(`/club-matches/${done}`)
    await screen.findByTestId('ops-area')
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull()
    await expect(deleteClubMatch(done, (await getClubMatchView(done)).version)).rejects.toMatchObject({ code: 'locked' })
    expect(exists(done)).toBe(true)
    cleanup()
    // 회원에게는 메뉴 없음
    const up = await confirmedMatch('회원 청백전', FUTURE)
    renderAt(`/club-matches/${up}`, 'member')
    await screen.findAllByTestId('public-area')
    expect(screen.queryAllByRole('button', { name: '더보기' })).toHaveLength(0)
  })

  it('[SCR-241-ST10, SCR-241-ST8] [AC-134] the setup page menu deletes a pending match with a named confirm and a toast', async () => {
    const id = await createClubMatch({ method: 'individual', date: FUTURE, name: '준비 중 청백전', courtCount: 2 })
    const router = renderAt(`/club-matches/${id}/setup/basic`)
    await openMore()
    const item = await screen.findByRole('menuitem', { name: '청백전 삭제' })
    expect(item).toHaveAttribute('data-tone', 'danger')
    fireEvent.click(item)
    const dlg = await screen.findByRole('alertdialog', { name: "'준비 중 청백전'을 삭제할까요?" })
    fireEvent.click(within(dlg).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches'))
    expect(exists(id)).toBe(false)
    await waitFor(() => expect(toastText()).toContain('청백전을 삭제했습니다'))
  })
})
