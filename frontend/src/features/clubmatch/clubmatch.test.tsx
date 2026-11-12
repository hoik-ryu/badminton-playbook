import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { getClubMatchView, listClubMatches } from './api'

// B4 Mock 흐름: 목록(SCR-221) · 만들기(222) · 운영 상세(223) · 참가자·팀(224) · 교체(225) · 대체 선수(226)
function renderAt(path: string, persona: PersonaKey = 'admin') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const match = (id: string) => readDb().clubMatches!.find((m) => m.id === id)!

describe('B4 club matches (mock)', () => {
  beforeEach(() => window.localStorage.clear())

  it('SCR-221 / AC-042: latest first with method and status badges, team score and final result', async () => {
    renderAt('/ops/club-matches')
    const list = await screen.findByRole('list', { name: '청백전' })
    const items = within(list).getAllByRole('link')
    expect(items.map((a) => a.getAttribute('data-match'))).toEqual(['cm-2', 'cm-1', 'cm-3'])
    expect(items[0]).toHaveTextContent('대진 미확정')
    expect(items[1]).toHaveTextContent(/진행 중.*청 \d+ : 백 \d+/)
    expect(items[2]).toHaveTextContent(/종료.*1위/)
  })

  it('SCR-222→223→224 / AC-042·071·073·077·081·085: create, pick participants, generate, confirm, record, finish', async () => {
    const router = renderAt('/ops/club-matches')
    fireEvent.click(await screen.findByRole('button', { name: '만들기' }))
    const sheet = await screen.findByTestId('create-sheet')
    fireEvent.click(within(sheet).getByRole('button', { name: '만들기' }))
    expect(await within(sheet).findByText('이름을 입력해 주세요')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('radio', { name: '개인전' }))
    fireEvent.change(within(sheet).getByLabelText('이름'), { target: { value: '테스트 청백전' } })
    fireEvent.click(within(sheet).getByRole('button', { name: '만들기' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/ops\/club-matches\/cm-/))
    const id = router.state.location.pathname.split('/').pop()!
    // 참가자 없음 → 패널 자동(UXD-038)
    const panel = await screen.findByTestId('participants-sheet')
    for (const n of ['김가람', '박다온', '정마루', '권초록']) fireEvent.click(within(panel).getByRole('checkbox', { name: new RegExp(`^${n},`) }))
    await waitFor(() => expect(Object.keys(match(id).participants)).toHaveLength(4))
    fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByTestId('participants-sheet')).toBeNull())
    // 총 경기 수 3 → 대진 생성
    fireEvent.change(await screen.findByLabelText('총 경기 수'), { target: { value: '3' } })
    await waitFor(() => expect(match(id).totalGames).toBe(3))
    fireEvent.click(screen.getByRole('button', { name: '대진 생성' }))
    await waitFor(() => expect(match(id).games).toHaveLength(3))
    expect(screen.queryByRole('group', { name: '1경기 결과' })).toBeNull() // 확정 전 결과 버튼 없음(AC-081)
    fireEvent.click(screen.getByRole('button', { name: '확정' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' })).getByRole('button', { name: '확정' }))
    await waitFor(() => expect(match(id).status).toBe('confirmed'))
    // 종료는 미기록이 있으면 비활성 + 'n경기 남음'
    expect(await screen.findByRole('button', { name: '청백전 종료' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3경기 남음' })).toBeInTheDocument()
    for (const no of [1, 2, 3]) {
      fireEvent.click(within(await screen.findByRole('group', { name: `${no}경기 결과` })).getByRole('button', { name: '1팀 승' }))
      await waitFor(() => expect(match(id).games.find((g) => g.no === no)!.winner).toBe(1))
    }
    // 기록된 결과를 바꿀 때만 확인 창(UXD-032·036)
    fireEvent.click(within(screen.getByRole('group', { name: '1경기 결과' })).getByRole('button', { name: '2팀 승' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '바꾸기' }))
    await waitFor(() => expect(match(id).games[0]!.winner).toBe(2))
    fireEvent.click(await screen.findByRole('button', { name: '청백전 종료' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '청백전을 종료할까요?' })).getByRole('button', { name: '종료' }))
    await waitFor(() => expect(match(id).status).toBe('finished'))
    expect(await screen.findByRole('region', { name: '최종 순위' })).toBeInTheDocument()
  })

  it('SCR-225 / AC-064: swap a player in a draft schedule; same-game candidates are disabled with a reason', async () => {
    renderAt('/ops/club-matches/cm-2')
    fireEvent.click(await screen.findByRole('button', { name: '대진 생성' }))
    await waitFor(() => expect(match('cm-2').games.length).toBeGreaterThan(0))
    const before = JSON.stringify(match('cm-2').games[0])
    const card = await screen.findByRole('article', { name: '1경기' })
    // 5명뿐이라 시드에 따라 후보가 '같은 4명·같은 팀 구성'으로 막힐 수 있음 → 바꿀 수 있는 선수를 찾을 때까지 차례로 시도
    let picked = false
    let sawSameGame = false
    for (const btn of within(card).getAllByRole('button', { name: /1경기 .* 교체/ })) {
      fireEvent.click(btn)
      const sheet = await screen.findByTestId('club-swap-sheet')
      sawSameGame ||= within(sheet).queryAllByText('같은 경기에 이미 있습니다').length > 0
      const enabled = within(sheet).getAllByRole('button').filter((b) => !b.hasAttribute('aria-disabled') && b.getAttribute('aria-label') !== '닫기')
      if (enabled.length) {
        fireEvent.click(enabled[0]!)
        picked = true
        break
      }
      fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }))
      await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
    }
    expect(sawSameGame).toBe(true)
    expect(picked).toBe(true)
    const warn = screen.queryByRole('alertdialog')
    if (warn) fireEvent.click(within(warn).getByRole('button', { name: '바꾸기' }))
    await waitFor(() => expect(JSON.stringify(match('cm-2').games[0])).not.toBe(before))
  })

  it('SCR-224→226 / AC-078: leave mid-way, substitutes recommended and applied together', async () => {
    renderAt('/ops/club-matches/cm-1')
    const v = await getClubMatchView('cm-1')
    const leaver = v.rows.find((r) => r.participating && r.inUnrecorded > 0 && r.kind === 'member')!
    fireEvent.click(await screen.findByRole('button', { name: /참가자 \d+명/ }))
    const panel = await screen.findByTestId('participants-sheet')
    expect(within(panel).getByText('대진 확정 후에는 같은 팀 안에서 선수 교체만 할 수 있습니다')).toBeInTheDocument()
    const row = panel.querySelector(`[data-participant="${leaver.key}"]`) as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '이후 대진에서 제외' }))
    const sub = await screen.findByTestId('substitute-sheet')
    expect(within(sub).getByText(new RegExp(`남은 경기 ${leaver.inUnrecorded}개`))).toBeInTheDocument()
    fireEvent.click(within(sub).getByRole('button', { name: '반영' }))
    await waitFor(() => expect(match('cm-1').participants[leaver.key]!.left).toBe(true))
    const m = match('cm-1')
    expect(m.games.filter((g) => !g.winner && [...g.team1, ...g.team2].includes(leaver.key))).toHaveLength(0)
    expect(m.games.filter((g) => g.winner && [...g.team1, ...g.team2].includes(leaver.key)).length).toBeGreaterThan(0) // 기존 경기·결과는 그대로
    expect(m.modifiedAt).not.toBeNull() // 회원 화면 '대진이 수정되었습니다'(B5)
    await waitFor(() => expect(screen.queryByTestId('substitute-sheet')).toBeNull()) // 반영 후 시트가 닫힘. jsdom에서는 I3-d4 결함(ST3로 남음)이 재현되지 않아 실제 확인은 브라우저 회귀(B4·check-clubmatch-api)
    expect(screen.queryByRole('alertdialog')).toBeNull() // '제외가 취소됩니다' 확인 창도 뜨지 않음
  })

  it('AC-070 / AC-072: switching to team mode resets teams and fills an algorithm proposal', async () => {
    renderAt('/ops/club-matches/cm-2')
    fireEvent.click(await screen.findByRole('radio', { name: '팀전' }))
    await waitFor(() => expect(match('cm-2').method).toBe('team'))
    fireEvent.click(await screen.findByRole('button', { name: /참가자 \d+명/ }))
    expect(await screen.findByText('알고리즘 배정안을 채웠습니다')).toBeInTheDocument()
    await waitFor(() => expect(Object.values(match('cm-2').participants).every((p) => p.team !== null)).toBe(true))
  })

  it('SCR-223-ST6 / AC-080: a stale confirm is rejected with the conflict dialog', async () => {
    renderAt('/ops/club-matches/cm-2')
    fireEvent.click(await screen.findByRole('button', { name: '대진 생성' }))
    await waitFor(() => expect(match('cm-2').games.length).toBeGreaterThan(0))
    await screen.findByRole('button', { name: '확정' })
    updateDb((db) => void db.clubMatches!.find((m) => m.id === 'cm-2')!.version++) // 다른 운영진이 먼저 변경
    fireEvent.click(screen.getByRole('button', { name: '확정' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' })).getByRole('button', { name: '확정' }))
    expect(await screen.findByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })).toBeInTheDocument()
    expect(match('cm-2').status).toBe('draft')
  })

  it('SCR-221-ST5: members cannot open club match management', async () => {
    const router = renderAt('/ops/club-matches', 'member')
    await waitFor(() => expect(router.state.location.pathname).toBe('/forbidden'))
    expect((await listClubMatches()).length).toBe(3)
  })
})
