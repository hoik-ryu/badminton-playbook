import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updateDb } from '../../../lib/mock/db'
import { routes } from '../../../routes/router'
import { setPersona } from '../../auth/devPersona'
import { addClubGame, confirmClub, getClubMatchView, read } from '../api'
import { bumpVersion, match, renderAt, SCORED, seedDraft, st, waitSt } from './testkit'

// (r13, B14) SCR-244 공통 대진 편집기 · SCR-225 선수 선택·교체 시트 · SCR-245 요약
// UX Spec r10 02 SCR-244 ST1–ST17, SCR-225 ST1·ST3·ST4·ST7–ST12, AC-136–139·141·142(+AC-130·143)
const ctl = vi.hoisted(() => ({ fail: 0, hold: null as null | Promise<void> }))
vi.mock('../api', async (orig) => {
  const m = await orig<typeof import('../api')>()
  const { ApiError } = await import('../../../lib/api')
  const wrap =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      if (ctl.hold) await ctl.hold
      if (ctl.fail-- > 0) throw new ApiError(0, { code: 'network_error', message: 'x' })
      return fn(...a)
    }
  return { ...m, addClubGame: wrap(m.addClubGame), deleteClubGame: wrap(m.deleteClubGame), exchangeClubGame: wrap(m.exchangeClubGame), swapClub: wrap(m.swapClub), discardClubGames: wrap(m.discardClubGames) }
})

const sheet = () => screen.getByTestId('club-swap-sheet')
const sheetSt = () => sheet().querySelector('[data-scr="SCR-225"]')!.getAttribute('data-st')
const cards = () => [...document.querySelectorAll('li.su-game')] as HTMLElement[]
const reason = () => document.getElementById('su-reason')?.textContent ?? screen.queryByTestId('step-reason')?.textContent ?? ''
/** 시트에서 고를 수 있는 첫 행 */
const firstOk = () => within(sheet()).getAllByRole('button').find((b) => b.classList.contains('su-pick') && !b.hasAttribute('aria-disabled'))!
async function fillPartial(no: number) {
  if (screen.queryByTestId('club-swap-sheet')) {
    // '경기 추가' 직후 첫 빈 자리 시트가 열려 있음(UXD-101)
    fireEvent.click(firstOk())
    await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
  }
  for (;;) {
    const empty = screen.queryAllByRole('button', { name: new RegExp(`^${no}경기 .* 빈 자리 선택$`) })[0]
    if (!empty) break
    fireEvent.click(empty)
    fireEvent.click(firstOk())
    await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
  }
}
function holdOn() {
  let release!: () => void
  ctl.hold = new Promise<void>((r) => (release = r))
  return () => {
    ctl.hold = null
    release()
  }
}

describe('SCR-244 common game editor (r13)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    ctl.fail = 0
    ctl.hold = null
  })

  it('[SCR-244-ST1, SCR-244-ST10] [AC-136] no games → auto is preselected; manual starts from an empty schedule without confirm', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST1')
    expect(screen.getByRole('radio', { name: '자동 생성' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: '직접 구성' }))
    await waitSt('SCR-244-ST10')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('경기가 없습니다')).toBeInTheDocument()
    expect(screen.queryByTestId('su-generate')).toBeNull()
    expect(reason()).toContain('대진이 없습니다. 경기를 추가하거나 자동 생성해 주세요')
    expect(screen.getByTestId('su-next')).toBeDisabled()
  })

  it('[SCR-244-ST11, SCR-225-ST9, SCR-244-ST7] [AC-137, AC-136] add opens the first empty slot; incomplete stays on screen; four filled saves', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST1')
    fireEvent.click(screen.getByRole('radio', { name: '직접 구성' }))
    fireEvent.click(await screen.findByRole('button', { name: '경기 추가' }))
    expect(sheetSt()).toBe('SCR-225-ST9')
    expect(within(sheet()).getByRole('heading', { name: '선수 선택' })).toBeInTheDocument()
    expect(within(sheet()).getAllByText('실력차 계산 불가').length).toBeGreaterThan(0)
    fireEvent.click(firstOk())
    await waitSt('SCR-244-ST11')
    expect(match(id).games).toHaveLength(0) // 미완성 경기는 저장하지 않음
    expect(cards()[0]).toHaveTextContent('빈 자리 3')
    expect(reason()).toContain('1경기에 빈 자리가 있습니다')
    // 같은 경기에 이미 있는 사람은 선택 불가
    fireEvent.click(screen.getAllByRole('button', { name: /^1경기 .* 빈 자리 선택$/ })[0]!)
    expect(within(sheet()).getAllByText('같은 경기에 이미 있습니다').length).toBe(1)
    fireEvent.click(within(sheet()).getByRole('button', { name: '닫기' }))
    await fillPartial(1)
    await waitFor(() => expect(match(id).games).toHaveLength(1))
    expect([match(id).totalGames, match(id).games[0]!.manual]).toEqual([1, true])
    await waitSt('SCR-244-ST7')
    expect(screen.getByRole('region', { name: '대진 요약' })).toHaveTextContent('1경기')
  })

  it('[SCR-244-ST16, SCR-244-ST12, SCR-244-ST7] [AC-138] deleting a complete game asks; cancel keeps; confirm saves with a card spinner and recalculates', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST1')
    fireEvent.click(screen.getByTestId('su-generate'))
    await waitSt('SCR-244-ST7')
    const third = JSON.stringify(match(id).games[3]!.team1)
    fireEvent.click(screen.getByRole('button', { name: '3경기 삭제' }))
    let dlg = await screen.findByRole('alertdialog', { name: '3경기를 삭제할까요?' })
    expect(st()).toBe('SCR-244-ST16')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(match(id).games).toHaveLength(8)
    const release = holdOn()
    fireEvent.click(screen.getByRole('button', { name: '3경기 삭제' }))
    dlg = await screen.findByRole('alertdialog', { name: '3경기를 삭제할까요?' })
    fireEvent.click(within(dlg).getByRole('button', { name: '삭제' }))
    await waitSt('SCR-244-ST12')
    expect(screen.getByRole('status', { name: '3경기 저장 중' })).toBeInTheDocument()
    release()
    await waitFor(() => expect(match(id).games).toHaveLength(7))
    expect([match(id).totalGames, JSON.stringify(match(id).games[2]!.team1)]).toEqual([7, third])
    await waitSt('SCR-244-ST7')
    expect(screen.getByText('기준 8경기에서 편집됨')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '대진 요약' })).toHaveTextContent('7경기')
  })

  it('[SCR-244-ST10] [AC-138] deleting the last game leaves 0 games with manual selected; baseline kept; next blocked', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 4), games: 1 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    fireEvent.click(screen.getByRole('button', { name: '1경기 삭제' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    await waitSt('SCR-244-ST10')
    expect([match(id).games.length, match(id).totalGames]).toEqual([0, 1])
    expect(screen.getByRole('radio', { name: '직접 구성' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('su-next')).toBeDisabled()
  })

  it('[SCR-244-ST13] [AC-141] a failed delete keeps the card and offers retry', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    ctl.fail = 1
    fireEvent.click(screen.getByRole('button', { name: '2경기 삭제' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('2경기를 삭제하지 못했습니다. 대진은 그대로입니다')).toBeInTheDocument()
    expect(st()).toBe('SCR-244-ST13')
    expect([cards().length, match(id).games.length]).toEqual([4, 4])
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(match(id).games).toHaveLength(3))
  })

  it('[SCR-244-ST6] [AC-141] conflict while editing shows the dialog, redraws the latest schedule and keeps incomplete games', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    fireEvent.click(screen.getByRole('button', { name: '경기 추가' }))
    fireEvent.click(firstOk())
    await waitSt('SCR-244-ST11')
    // 다른 운영진이 먼저 1경기를 지움(version도 올라감)
    updateDb((db) => {
      const m = db.clubMatches!.find((x) => x.id === id)!
      m.games = m.games.slice(1).map((g, i) => ({ ...g, no: i + 1 }))
    })
    bumpVersion(id)
    fireEvent.click(screen.getByRole('button', { name: '2경기 삭제' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '2경기를 삭제할까요?' })).getByRole('button', { name: '삭제' }))
    const dlg = await screen.findByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })
    expect(st()).toBe('SCR-244-ST6')
    fireEvent.click(within(dlg).getByRole('button', { name: '확인' }))
    await waitFor(() => expect(cards()).toHaveLength(4)) // 최신 3경기 + 미완성 1경기
    expect(cards()[3]).toHaveTextContent('4경기')
    expect(cards()[3]).toHaveTextContent('빈 자리 3')
  })

  it('[SCR-244-ST14] [AC-142] regenerate after an edit asks; cancel keeps the edited schedule; confirm rebuilds from the baseline', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8) })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST1')
    fireEvent.click(screen.getByTestId('su-generate'))
    await waitSt('SCR-244-ST7')
    const seed = match(id).seed
    fireEvent.click(screen.getByRole('button', { name: '다시 생성' })) // 편집 없음: 확인 없이
    await waitFor(() => expect(match(id).seed).not.toBe(seed))
    fireEvent.click(screen.getByRole('button', { name: '경기 추가' }))
    await fillPartial(9)
    await waitFor(() => expect(match(id).games).toHaveLength(9))
    fireEvent.click(screen.getByRole('button', { name: '다시 생성' }))
    let dlg = await screen.findByRole('alertdialog', { name: '편집한 대진이 사라집니다' })
    expect(st()).toBe('SCR-244-ST14')
    expect(dlg).toHaveTextContent('총 경기 수 8으로 새로 만듭니다')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(match(id).games).toHaveLength(9)
    fireEvent.click(screen.getByRole('button', { name: '다시 생성' }))
    dlg = await screen.findByRole('alertdialog', { name: '편집한 대진이 사라집니다' })
    fireEvent.click(within(dlg).getByRole('button', { name: '다시 생성' }))
    await waitFor(() => expect(match(id).games).toHaveLength(8))
    expect([match(id).totalGames, match(id).games.some((g) => g.manual)]).toEqual([8, false])
  })

  it('[SCR-244-ST15] [AC-136] switching to manual with games asks; cancel keeps; confirm empties the schedule', async () => {
    const id = await seedDraft({ method: 'team', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    expect(screen.getByRole('radio', { name: '자동 생성' })).toHaveAttribute('aria-checked', 'false') // 다시 들어오면 방식 선택 없음
    expect(screen.getByRole('radio', { name: '직접 구성' })).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('radio', { name: '직접 구성' }))
    let dlg = await screen.findByRole('alertdialog', { name: '대진이 초기화됩니다' })
    expect(st()).toBe('SCR-244-ST15')
    expect(dlg).toHaveTextContent('빈 대진에서 직접 구성합니다')
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(match(id).games).toHaveLength(4)
    fireEvent.click(screen.getByRole('radio', { name: '직접 구성' }))
    dlg = await screen.findByRole('alertdialog', { name: '대진이 초기화됩니다' })
    fireEvent.click(within(dlg).getByRole('button', { name: '바꾸기' }))
    await waitSt('SCR-244-ST10')
    expect([match(id).games.length, match(id).totalGames]).toEqual([0, 4])
  })

  it('[SCR-244-ST17] [AC-141] leaving with an incomplete game asks, including the browser back button', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 2 })
    setPersona('admin')
    const router = createMemoryRouter(routes, { initialEntries: ['/club-matches', `/club-matches/${id}/setup/games`], initialIndex: 1 })
    render(createElement(RouterProvider, { router }))
    await waitSt('SCR-244-ST7')
    fireEvent.click(screen.getByRole('button', { name: '경기 추가' }))
    fireEvent.click(firstOk())
    await waitSt('SCR-244-ST11')
    await act(async () => {
      await router.navigate(-1)
    })
    let dlg = await screen.findByRole('alertdialog', { name: '완성하지 않은 경기가 있습니다' })
    expect(dlg).toHaveTextContent('나가면 사라집니다')
    fireEvent.click(within(dlg).getByRole('button', { name: '계속 편집' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`)
    fireEvent.click(screen.getByRole('button', { name: '나가기(청백전 목록)' }))
    dlg = await screen.findByRole('alertdialog', { name: '완성하지 않은 경기가 있습니다' })
    fireEvent.click(within(dlg).getByRole('button', { name: '나가기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches'))
    // 새로고침·창 닫기는 브라우저 기본 확인(beforeunload)
  })

  it('[SCR-244-ST11] [AC-141] the progress bar cannot jump to confirm while an incomplete game remains', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 2 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    fireEvent.click(screen.getByRole('button', { name: '경기 추가' }))
    fireEvent.click(firstOk())
    await waitSt('SCR-244-ST11')
    const confirmStep = screen.queryByRole('button', { name: /4단계 확정/ }) ?? screen.queryByRole('link', { name: /4단계 확정/ })
    if (confirmStep) fireEvent.click(confirmStep)
    expect(st()).toBe('SCR-244-ST11')
  })
})

describe('SCR-225 pick sheet (r13)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    ctl.fail = 0
    ctl.hold = null
  })

  it('[SCR-225-ST1, SCR-225-ST12] [AC-139] individual: same-game exchange and replace are separate; exchange saves with a row spinner', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 4), games: 1 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    const g = match(id).games[0]!
    fireEvent.click(screen.getAllByRole('button', { name: /^1경기 1팀 .* 교체$/ })[0]!)
    expect(sheetSt()).toBe('SCR-225-ST1')
    expect(within(sheet()).getByTestId('pick-head')).toHaveTextContent('1경기 출전')
    const swapSec = within(sheet()).getByRole('region', { name: '같은 경기 맞교환' })
    expect(within(swapSec).getAllByRole('button')).toHaveLength(2)
    expect(within(sheet()).getByText('다른 참가자가 없습니다')).toBeInTheDocument() // 4명뿐: 교체 후보 없음(맞교환은 가능)
    const release = holdOn()
    fireEvent.click(within(swapSec).getAllByRole('button')[0]!)
    await waitFor(() => expect(sheetSt()).toBe('SCR-225-ST12'))
    release()
    await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
    const after = match(id).games[0]!
    expect(after.team1[0]).not.toBe(g.team1[0])
    expect(after.team2).toContain(g.team1[0])
    expect(after.manual).toBe(true)
  })

  it('[SCR-225-ST3] team with two per team: nobody can replace', async () => {
    const id = await seedDraft({ method: 'team', keys: SCORED.slice(0, 4), games: 1 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    fireEvent.click(screen.getAllByRole('button', { name: /^1경기 청팀 .* 교체$/ })[0]!)
    expect(sheetSt()).toBe('SCR-225-ST3')
    expect(within(sheet()).getByText('바꿀 수 있는 사람이 없습니다')).toBeInTheDocument()
    expect(within(sheet()).queryByText('같은 경기 맞교환')).toBeNull() // 팀전은 맞교환 없음
  })

  it('[SCR-225-ST4] [AC-141] a failed save keeps the sheet open with retry', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 2 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    const before = JSON.stringify(match(id).games)
    fireEvent.click(screen.getAllByRole('button', { name: /^1경기 .* 교체$/ })[0]!)
    ctl.fail = 1
    fireEvent.click(firstOk())
    expect(await within(sheet()).findByText('변경을 저장하지 못했습니다. 연결이 불안정합니다')).toBeInTheDocument()
    expect(sheetSt()).toBe('SCR-225-ST4')
    expect(JSON.stringify(match(id).games)).toBe(before)
    fireEvent.click(within(sheet()).getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
    expect(JSON.stringify(match(id).games)).not.toBe(before)
  })

  it('[SCR-225-ST10, SCR-225-ST11, SCR-225-ST8] [AC-079] team: warnings are badges, same-game people are disabled, a count gap of 2 asks first', async () => {
    const id = await seedDraft({ method: 'team', keys: SCORED.slice(0, 8), games: 4 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    fireEvent.click(screen.getAllByRole('button', { name: /^1경기 청팀 .* 교체$/ })[0]!)
    const warnRow = within(sheet()).getAllByRole('button').find((b) => b.getAttribute('data-state') === 'warn')!
    expect(warnRow).toHaveTextContent('경기 수 차이 2')
    const off = within(sheet()).getAllByRole('button').filter((b) => b.getAttribute('data-state') === 'off')
    expect(off.length).toBe(1)
    expect(off[0]).toHaveAttribute('aria-disabled', 'true')
    expect(off[0]).toHaveTextContent('같은 경기에 이미 있습니다')
    fireEvent.click(warnRow)
    const dlg = await screen.findByRole('alertdialog', { name: '경기 수 차이가 2가 됩니다. 그래도 바꿀까요?' })
    fireEvent.click(within(dlg).getByRole('button', { name: '바꾸기' }))
    await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
    expect(match(id).games[0]!.manual).toBe(true)
  })

  it('[SCR-225-ST10] [AC-140, AC-137] before confirm a same-matchup candidate is a warning; picking marks both games', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 6) })
    const [a, b, c, d, e] = SCORED
    let v = await getClubMatchView(id)
    v = await addClubGame(id, v.version, [a!, b!], [c!, d!])
    await addClubGame(id, v.version, [a!, b!], [c!, e!])
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    const name = (await getClubMatchView(id)).rows.find((r) => r.key === e)!.name
    fireEvent.click(screen.getByRole('button', { name: `2경기 2팀 ${name} 교체` }))
    const repeat = within(sheet()).getAllByRole('button').find((b) => b.textContent?.includes('같은 대진 반복'))!
    expect(repeat).toHaveAttribute('data-state', 'warn')
    fireEvent.click(repeat)
    await waitFor(() => expect(screen.getAllByText('규칙 완화: 운영진 수동 변경')).toHaveLength(2))
    await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
    expect(await screen.findByRole('region', { name: '대진 요약' })).toHaveTextContent('수동 변경 2')
  })

  it('[SCR-225-ST7] [AC-143, AC-077] after confirm the sheet only replaces; no exchange, add or delete', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 8), games: 4 })
    const v = await getClubMatchView(id)
    await confirmClub(id, v.version)
    renderAt(`/club-matches/${id}`)
    const p = (await getClubMatchView(id)).games[0]!.team1[0]!
    fireEvent.click(await screen.findByRole('button', { name: `1경기 ${p.name} 교체` }))
    await waitFor(() => expect(sheetSt()).toBe('SCR-225-ST7'))
    expect(within(sheet()).queryByText('같은 경기 맞교환')).toBeNull()
    expect(within(sheet()).getByRole('heading', { name: '다른 참가자와 교체' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '경기 추가' })).toBeNull()
    expect(screen.queryByRole('button', { name: /경기 삭제$/ })).toBeNull()
  })
})

describe('SCR-245 summary (r13)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
  })

  it('[SCR-245-ST1] [AC-130] the schedule summary shows the actual count and manual changes', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 6), games: 2 })
    const [a, b, c, d] = SCORED
    let v = await getClubMatchView(id)
    v = await addClubGame(id, v.version, [a!, b!], [c!, d!])
    await addClubGame(id, v.version, [b!, a!], [d!, c!])
    renderAt(`/club-matches/${id}/setup/confirm`)
    await waitSt('SCR-245-ST1')
    const games = screen.getByRole('region', { name: '대진' })
    expect(games).toHaveTextContent('4경기')
    expect(games).toHaveTextContent('수동 변경 2경기')
  })
})
