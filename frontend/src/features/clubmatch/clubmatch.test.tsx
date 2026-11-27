import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { getClubMatchView, listClubMatches } from './api'
import { clickNext } from './setup/testkit'

// B4 Mock 흐름: 목록(SCR-111) · (B11) 생성 페이지(SCR-241–245, 이전 222·확정 전 223) · 상세 운영 기능 영역(SCR-112) · 참가자(224) · 교체(225) · 대체 선수(226)
// (4단계) 최종 주소 /club-matches…로 엶. 이전 /ops/club-matches… 리다이렉트·권한은 routes/clubmatchRoutes.test.tsx
function renderAt(path: string, persona: PersonaKey = 'admin') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const match = (id: string) => readDb().clubMatches!.find((m) => m.id === id)!

describe('B4 club matches (mock)', () => {
  beforeEach(() => window.localStorage.clear())

  // (4단계) 이전 SCR-221 목록은 SCR-111 통합 목록(/club-matches)으로 바뀜. 운영진은 준비 중까지 봄(UXD-086·087)
  it('[SCR-241-ST7, SCR-242-ST1, SCR-243-ST7] [AC-042] creation starts at basic info, needs a method, is kept apart from sessions; participants show count·gender and teams show per-team counts', async () => {
    const router = renderAt('/club-matches')
    fireEvent.click(await screen.findByRole('button', { name: '새 청백전' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches/new'))
    expect(document.querySelector('[data-scr=SCR-241]')).not.toBeNull()
    expect(screen.queryByRole('checkbox', { name: /^김가람,/ })).toBeNull() // 참가자 선정은 다음 단계(r9)
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '분리 확인 청백전' } })
    await clickNext()
    expect(await screen.findByText('방식을 골라 주세요')).toBeInTheDocument() // 방식을 고르지 않으면 만들어지지 않음
    expect(router.state.location.pathname).toBe('/club-matches/new')
    const before = (await listClubMatches()).length
    fireEvent.click(screen.getByRole('radio', { name: '팀전' }))
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/club-matches\/cm-.*\/setup\/participants$/))
    const id = router.state.location.pathname.split('/')[2]!
    // 청백전 목록에만 있고 일반 운동 세션에는 없음
    expect((await listClubMatches()).map((m) => m.id)).toContain(id)
    expect((await listClubMatches()).length).toBe(before + 1)
    expect(JSON.stringify(readDb().sessions ?? [])).not.toContain(id)
    expect(readDb().session ?? null).not.toBe(id)
    // 참가 인원·성별 분포
    for (const n of ['김가람', '박다온', '권초록', '오아라']) fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${n},`) }))
    expect(document.querySelector('.su-summary')!.textContent).toMatch(/선택 4명\s*· 남 2 여 2/)
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/teams`))
    // 팀전: 팀별 인원
    expect((await screen.findAllByRole('heading', { name: '청팀 2명' })).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { name: '백팀 2명' }).length).toBeGreaterThan(0)
  })

  it('SCR-111 (운영진) / AC-042: live, planned(pending) and past sections with status and result', async () => {
    renderAt('/club-matches')
    const live = await screen.findByTestId('cm-section-live')
    const ids = (el: HTMLElement) => [...el.querySelectorAll('a[data-match]')].map((a) => a.getAttribute('data-match'))
    expect(ids(live)).toEqual(['cm-1'])
    expect(ids(screen.getByTestId('cm-section-planned'))).toEqual(['cm-2'])
    expect(ids(screen.getByTestId('cm-section-past'))).toEqual(['cm-3'])
    expect(live.querySelector('a[data-match=cm-1]')).toHaveTextContent(/청팀\d+:백팀\d+/)
    expect(screen.getByTestId('cm-section-planned')).toHaveTextContent('준비 중')
    expect(screen.getByTestId('cm-section-past')).toHaveTextContent(/1위/)
  })

  // (B11 대체) 만들기·참가자·대진 생성·확정은 생성 페이지(SCR-241–245)로 옮김(UX Spec r9). 확정 이후(결과·종료)는 SCR-112 그대로
  it('생성 페이지 SCR-241→242→244→245 → SCR-112 / AC-042·071·073·077·081·085: create, pick participants, generate, confirm, record, finish', async () => {
    const router = renderAt('/club-matches')
    fireEvent.click(await screen.findByRole('button', { name: '새 청백전' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches/new'))
    await clickNext()
    expect(await screen.findByText('이름을 입력해 주세요')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '개인전' }))
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '테스트 청백전' } })
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/club-matches\/cm-.*\/setup\/participants$/))
    const id = router.state.location.pathname.split('/')[2]!
    // (B16) 라운드 기반: 12명·코트 4 → 라운드당 3경기(1라운드에 3경기)
    for (const n of ['김가람', '박다온', '정마루', '권초록', '오아라', '한바다', '신자람', '윤새벽', '정마음', '김민결', '남보람', '유하람']) fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${n},`) }))
    // 점수 미설정자를 고르면 다음 불가(AC-071·126)
    fireEvent.click(screen.getByRole('checkbox', { name: /^서이든,/ }))
    expect(screen.getByTestId('su-next')).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /^서이든,/ }))
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    expect(Object.keys(match(id).participants)).toHaveLength(12)
    // 총 경기 수 3 → 대진 생성(설정과 함께 저장). (B16) 라운드 기반: 기준 1라운드 = 3경기
    fireEvent.change(await screen.findByRole('textbox', { name: '자동 생성 기준 라운드 수' }), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('su-generate'))
    await waitFor(() => expect(match(id).games).toHaveLength(3))
    expect(match(id).totalGames).toBe(3)
    expect(screen.queryByRole('group', { name: '1경기 결과' })).toBeNull() // 확정 전 결과 버튼 없음(AC-081)
    await clickNext()
    await clickNext()
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' })).getByRole('button', { name: '확정' }))
    await waitFor(() => expect(match(id).status).toBe('confirmed'))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}`))
    // 종료는 미기록이 있으면 비활성 + 사유. (B17, r14 SCR-112-ST23) 라운드 기반은 'n경기 남음' 대신 '처리되지 않은 경기 n개'
    expect(await screen.findByRole('button', { name: '청백전 종료' })).toBeDisabled()
    expect(screen.getByText('처리되지 않은 경기 3개')).toBeInTheDocument()
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

  // (B11 대체) 확정 전 대진 검토·교체는 생성 페이지 대진 설정 단계(SCR-244)에서 기존 SCR-225 시트로
  it('SCR-225 / AC-064: swap a player in a draft schedule; same-game candidates are disabled with a reason', async () => {
    renderAt('/club-matches/cm-2/setup/games')
    fireEvent.click(await screen.findByTestId('su-generate'))
    await waitFor(() => expect(match('cm-2').games.length).toBeGreaterThan(0))
    const before = JSON.stringify(match('cm-2').games[0])
    const card = (await screen.findAllByRole('listitem')).find((li) => li.classList.contains('su-game') && li.textContent?.startsWith('1경기'))!
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
    renderAt('/club-matches/cm-1')
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

  // (B11 대체) 방식 변경은 생성 페이지 기본정보, 배정안은 팀 구성 단계 첫 진입(UX Spec r9 SCR-241·243)
  it('AC-070 / AC-072: switching to team mode resets teams and fills an algorithm proposal', async () => {
    const router = renderAt('/club-matches/cm-2/setup/basic')
    fireEvent.click(await screen.findByRole('radio', { name: '팀전' }))
    await clickNext()
    await waitFor(() => expect(match('cm-2').method).toBe('team'), { timeout: 3000 })
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches/cm-2/setup/participants'), { timeout: 3000 })
    await waitFor(() => expect(document.querySelector('.su[data-scr="SCR-242"]')).toBeTruthy()) // 경로가 바뀐 뒤 화면이 그려질 때까지
    await clickNext()
    expect(await screen.findByText('알고리즘 배정안을 채웠습니다. 아직 저장 전입니다', undefined, { timeout: 3000 })).toBeInTheDocument()
    await clickNext()
    await waitFor(() => expect(Object.values(match('cm-2').participants).every((p) => p.team !== null)).toBe(true), { timeout: 3000 })
  })

  // (B11 대체) 확정은 생성 페이지 확정 단계(SCR-245-ST6)
  it('SCR-245-ST6 / AC-080: a stale confirm is rejected with the conflict dialog', async () => {
    renderAt('/club-matches/cm-2/setup/games')
    fireEvent.click(await screen.findByTestId('su-generate'))
    await waitFor(() => expect(match('cm-2').games.length).toBeGreaterThan(0))
    await clickNext()
    await screen.findByRole('region', { name: '확정 전 확인' })
    updateDb((db) => void db.clubMatches!.find((m) => m.id === 'cm-2')!.version++) // 다른 운영진이 먼저 변경
    await clickNext()
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
