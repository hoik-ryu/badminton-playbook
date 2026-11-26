import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../../../components/Toast'
import { updateDb, type MockClubGame } from '../../../lib/mock/db'
import { addClubGame, createClubMatch, generateClub, getClubMatchView, read, saveParticipants, saveTeams, type ClubMatchView, type ClubMethod } from '../api'
import { GamesStep } from './GamesStep'
import { halves, match, renderAt, SCORED, seedDraft, st, waitSt } from './testkit'
import { useSetup } from './useSetup'

// (B16, r14) 청백전 생성 페이지 라운드·코트 — UX Spec r11 02 SCR-241 ST11·ST12, SCR-244 ST18–ST24, SCR-245 ST9, SCR-225 ST13,
// DD r14 VD-077–082, AC-144–AC-153. Mock(서버 router.py와 같은 라운드 규칙)으로 실제 라우터에 띄웁니다.
const ctl = vi.hoisted(() => ({ fail: 0, failCode: null as null | { code: string; message: string } }))
vi.mock('../api', async (orig) => {
  const m = await orig<typeof import('../api')>()
  const { ApiError } = await import('../../../lib/api')
  const wrap =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      if (ctl.failCode) {
        const e = ctl.failCode
        ctl.failCode = null
        throw new ApiError(422, e)
      }
      if (ctl.fail-- > 0) throw new ApiError(0, { code: 'network_error', message: 'x' })
      return fn(...a)
    }
  return { ...m, deleteClubGame: wrap(m.deleteClubGame), moveClubGame: wrap(m.moveClubGame), confirmClub: wrap(m.confirmClub) }
})

/** 라운드 기반 준비 중 청백전(참가자 → 팀전 팀 → 선택: 기준 라운드 수로 생성) */
async function roundDraft(opts: { method: ClubMethod; keys: string[]; courts: number; rounds?: number }) {
  const id = await createClubMatch({ method: opts.method, date: '2026-12-13', name: '라운드 테스트', courtCount: opts.courts })
  let v = await saveParticipants(id, 1, opts.keys)
  if (opts.method === 'team') v = await saveTeams(id, v.version, halves(opts.keys))
  if (opts.rounds) await generateClub(id, v.version, { rounds: opts.rounds, rules: { balance: true, gender: true } })
  return id
}
const NAME: Record<string, string> = Object.fromEntries(['김가람', '박다온', '정마루', '권초록', '오아라', '한바다', '신자람', '윤새벽', '정마음', '김민결'].map((n, i) => [SCORED[i]!, n]))
const cards = () => [...document.querySelectorAll('li.su-game')] as HTMLElement[]
const sections = () => screen.queryAllByTestId('round-section')
const stepper = (name: string) => screen.getByRole('textbox', { name })
const sheet = () => screen.getByTestId('club-swap-sheet')
const reason = () => document.getElementById('su-reason')?.textContent ?? screen.queryByTestId('step-reason')?.textContent ?? ''

/** 라우터 밖 상태(서버가 막아 화면 이동으로는 닿지 않는 보기)를 그리는 틀: 생성 페이지 상태 훅 + 대진 설정 단계 */
function renderGames(view: ClubMatchView) {
  function Harness() {
    const c = useSetup(view)
    return createElement(GamesStep, { c, frame: { steps: null, current: 'games', onStep: () => undefined, onExit: () => undefined }, go: () => undefined })
  }
  const router = createMemoryRouter([{ path: '/', element: createElement(ToastProvider, null, createElement(Harness)) }])
  render(createElement(RouterProvider, { router }))
}

describe('club match setup rounds and courts (B16)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    ctl.fail = 0
    ctl.failCode = null
  })

  it('[SCR-241-ST1, SCR-241-ST4] [AC-144] new match: court stepper defaults to 4, stays in 1–8, and a typed value out of range is an error', async () => {
    const router = renderAt('/club-matches/new')
    await waitSt('SCR-241-ST7')
    fireEvent.click(screen.getByRole('radio', { name: '개인전' }))
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '코트 테스트' } })
    expect(stepper('사용 코트 수')).toHaveValue('4')
    expect(screen.getByText('한 라운드에 최대 4경기를 동시에 진행합니다')).toBeInTheDocument()
    await waitSt('SCR-241-ST1')
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: '코트 수 늘리기' }))
    expect(stepper('사용 코트 수')).toHaveValue('8')
    expect(screen.getByRole('button', { name: '코트 수 늘리기' })).toBeDisabled()
    fireEvent.change(stepper('사용 코트 수'), { target: { value: '9' } })
    fireEvent.click(screen.getByTestId('su-next'))
    expect(await screen.findByText('코트 수는 1–8 사이로 입력해 주세요')).toBeInTheDocument()
    expect(st()).toBe('SCR-241-ST4')
    fireEvent.change(stepper('사용 코트 수'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('su-next'))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/setup\/participants$/))
    expect(match(router.state.location.pathname.split('/')[2]!).courtCount).toBe(2)
  })

  it('[SCR-241-ST11] [AC-144] changing courts with games asks first; cancel restores the saved value, confirm saves and discards the schedule', async () => {
    const id = await seedDraft({ method: 'individual', games: 2, courtCount: 1 })
    renderAt(`/club-matches/${id}/setup/basic`)
    await waitSt('SCR-241-ST8')
    fireEvent.click(screen.getByRole('button', { name: '코트 수 늘리기' }))
    fireEvent.click(screen.getByTestId('su-next'))
    const dlg = await screen.findByRole('alertdialog', { name: '코트 수를 바꾸면 만든 대진이 초기화됩니다' })
    expect(st()).toBe('SCR-241-ST11')
    expect(within(dlg).getByText('대진 설정 단계에서 다시 만들어야 합니다')).toBeInTheDocument()
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(stepper('사용 코트 수')).toHaveValue('1'))
    expect([match(id).courtCount, match(id).games.length]).toEqual([1, 2])
    fireEvent.click(screen.getByRole('button', { name: '코트 수 늘리기' }))
    fireEvent.click(screen.getByTestId('su-next'))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '바꾸기' }))
    await waitFor(() => expect(match(id).courtCount).toBe(2))
    expect(match(id).games).toHaveLength(0)
  })

  it('[SCR-241-ST12] [AC-163, AC-144] a pending match without rounds fills 4 courts with a notice; next asks, then saves courts and drops the old schedule', async () => {
    const id = await seedDraft({ method: 'individual', games: 2 })
    expect(match(id).courtCount ?? null).toBeNull()
    renderAt(`/club-matches/${id}/setup/basic`)
    await waitSt('SCR-241-ST12')
    expect(screen.getByText('라운드 정보가 없는 청백전입니다. 코트 수를 정하면 기존 대진은 버리고 라운드로 다시 구성합니다')).toBeInTheDocument()
    expect(stepper('사용 코트 수')).toHaveValue('4')
    fireEvent.click(screen.getByTestId('su-next'))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '코트 수를 바꾸면 만든 대진이 초기화됩니다' })).getByRole('button', { name: '바꾸기' }))
    await waitFor(() => expect(match(id).courtCount).toBe(4))
    expect(match(id).games).toHaveLength(0)
  })

  it('[SCR-244-ST1, SCR-244-ST9] [AC-145] round preview: per-round games, expected games and per-person range, resting; even proposals and keep', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 9), courts: 2 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitFor(() => expect(screen.getByTestId('round-preview')).toBeInTheDocument())
    const plan = screen.getByTestId('round-preview')
    expect(stepper('자동 생성 기준 라운드 수')).toHaveValue('5') // ⌈9 ÷ 2⌉
    expect(plan).toHaveTextContent('라운드당 2경기 · 코트 2 · 참가 9명')
    expect(plan).toHaveTextContent('예상 10경기 · 1인 4–5경기')
    expect(plan).toHaveTextContent('라운드마다 출전 8명 · 휴식 1명')
    expect(screen.getByText('1–100라운드')).toBeInTheDocument()
    expect(st()).toBe('SCR-244-ST9')
    const even = screen.getByRole('group', { name: '균등안' })
    fireEvent.click(within(even).getByRole('button', { name: /^9라운드 · 모두 8경기/ }))
    await waitFor(() => expect(stepper('자동 생성 기준 라운드 수')).toHaveValue('9'))
    expect(screen.getByTestId('round-preview')).toHaveTextContent('예상 18경기 · 1인 8경기')
    expect(st()).toBe('SCR-244-ST1')
    fireEvent.click(screen.getByRole('button', { name: '라운드 수 줄이기' }))
    fireEvent.click(within(screen.getByRole('group', { name: '균등안' })).getByRole('button', { name: '입력값 유지' }))
    expect(screen.queryByRole('group', { name: '균등안' })).toBeNull()
  })

  it('[SCR-244-ST1] [AC-145] team preview shows each team per person and resting per team', async () => {
    const id = await roundDraft({ method: 'team', keys: SCORED.slice(0, 10), courts: 2 })
    renderAt(`/club-matches/${id}/setup/games`)
    const plan = await screen.findByTestId('round-preview')
    expect(stepper('자동 생성 기준 라운드 수')).toHaveValue('5') // ⌈2 × 5 ÷ 2⌉
    expect(plan).toHaveTextContent('청팀 1인 4경기')
    expect(plan).toHaveTextContent('백팀 1인 4경기')
    expect(plan).toHaveTextContent('청 4·백 4 출전 · 휴식 청 1·백 1')
  })

  it('[SCR-244-ST18] [AC-145] no game can be made (k = 0): warning, no default rounds, generate disabled', async () => {
    const id = await createClubMatch({ method: 'individual', date: '2026-12-13', name: 'k0', courtCount: 2 })
    await saveParticipants(id, 1, SCORED.slice(0, 3))
    renderGames(await getClubMatchView(id))
    expect(await screen.findByText('팀마다 2명 이상, 전체 4명 이상이어야 경기를 만들 수 있습니다')).toBeInTheDocument()
    expect(stepper('자동 생성 기준 라운드 수')).toHaveValue('')
    expect(screen.getByTestId('su-generate')).toBeDisabled()
    expect(document.querySelector('[data-scr="SCR-244"]')).toHaveAttribute('data-st', 'SCR-244-ST18')
  })

  it('[SCR-244-ST19] [AC-145] the 200-game cap keeps the average under 4: an info line, generation still allowed', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 4), courts: 1 })
    const v = await getClubMatchView(id)
    const base = v.rows.find((r) => r.participating)!
    const extra = Array.from({ length: 201 }, (_, i) => ({ ...base, key: `member:x${i}`, id: `x${i}`, name: `참가${i}` }))
    renderGames({ ...v, rows: [...v.rows, ...extra] })
    expect(await screen.findByText(/^200경기 제한으로 1인 평균 3경기입니다$/)).toBeInTheDocument()
    expect(stepper('자동 생성 기준 라운드 수')).toHaveValue('200')
    expect(screen.getByTestId('su-generate')).toBeEnabled()
    expect(document.querySelector('[data-scr="SCR-244"]')).toHaveAttribute('data-st', 'SCR-244-ST19')
  })

  it('[SCR-244-ST7, SCR-244-ST24] [AC-148] generated rounds: sections with courts, playing and resting, court label on cards, folding', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 9), courts: 2 })
    renderAt(`/club-matches/${id}/setup/games`)
    fireEvent.click(await screen.findByTestId('su-generate'))
    await waitSt('SCR-244-ST7')
    expect(match(id).games).toHaveLength(10)
    expect(sections()).toHaveLength(5)
    const s1 = sections()[0]!
    expect(within(s1).getByRole('heading', { name: '1라운드' })).toBeInTheDocument()
    expect(s1).toHaveTextContent('코트 2/2 · 출전 8 ·')
    fireEvent.click(within(s1).getByRole('button', { name: /^1라운드 휴식 1, 휴식자 보기$/ }))
    const rest = within(s1).getByLabelText('1라운드 휴식자')
    const resting = SCORED.slice(0, 9).filter((k) => !match(id).games.filter((g) => g.round === 1).flatMap((g) => [...g.team1, ...g.team2]).includes(k))
    expect(rest).toHaveTextContent(NAME[resting[0]!]!)
    expect(within(s1).getByRole('listitem', { name: '1라운드 코트 2, 2경기' })).toHaveTextContent('코트 2 · 2경기')
    expect(screen.getByText('5라운드 · 코트 2')).toBeInTheDocument()
    fireEvent.click(within(s1).getByRole('button', { name: '1라운드 접기' }))
    await waitSt('SCR-244-ST24')
    expect(cards()).toHaveLength(8)
    fireEvent.click(within(sections()[0]!).getByRole('button', { name: '1라운드 펼치기' }))
    expect(cards()).toHaveLength(10)
  })

  it('[SCR-244-ST8] [AC-145] changing rounds after generation asks to discard; cancel keeps the schedule and value', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 3 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    fireEvent.click(screen.getByRole('radio', { name: '자동 생성' }))
    fireEvent.click(await screen.findByRole('button', { name: '라운드 수 늘리기' }))
    const dlg = await screen.findByRole('alertdialog', { name: '대진이 초기화됩니다' })
    expect(st()).toBe('SCR-244-ST8')
    expect(within(dlg).getByText('라운드 수나 규칙을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다')).toBeInTheDocument()
    fireEvent.click(within(dlg).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(stepper('자동 생성 기준 라운드 수')).toHaveValue('3'))
    expect(match(id).games).toHaveLength(6)
  })

  it('[SCR-244-ST10, SCR-244-ST21, SCR-244-ST11, SCR-225-ST9] [AC-149] manual: add a round (saved-later section), the empty-seat sheet shows round and court; next is blocked', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2 })
    renderAt(`/club-matches/${id}/setup/games`)
    fireEvent.click(await screen.findByRole('radio', { name: '직접 구성' }))
    await waitSt('SCR-244-ST10')
    expect(screen.getByText('라운드를 추가하거나 자동 생성해 주세요')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '라운드 추가' }))
    expect(await screen.findByTestId('club-swap-sheet')).toBeInTheDocument()
    expect(within(sheet()).getByText('1경기 빈 자리')).toBeInTheDocument()
    expect(within(sheet()).getByText('1라운드 코트 1')).toBeInTheDocument()
    expect(sheet().querySelector('[data-scr="SCR-225"]')).toHaveAttribute('data-st', 'SCR-225-ST9')
    fireEvent.click(within(sheet()).getByRole('button', { name: '닫기' }))
    await waitSt('SCR-244-ST21')
    expect(within(sections()[0]!).getByText('저장 전')).toBeInTheDocument()
    expect(screen.getByTestId('su-next')).toBeDisabled()
    expect(reason()).toContain('1경기에 빈 자리가 있습니다')
  })

  it('[SCR-244-ST11, SCR-225-ST13] [AC-149, AC-150] adding to a round with a free court: players already in that round are not selectable, resting ones are', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 10), courts: 3, rounds: 2 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    const inR1 = match(id).games.filter((g) => g.round === 1)
    const busy = inR1[1]!.team1[0]
    const restKey = SCORED.slice(0, 10).find((k) => !inR1.flatMap((g) => [...g.team1, ...g.team2]).includes(k))!
    // 빈 코트에 경기 추가 → 첫 빈 자리 시트: 1라운드 다른 경기 출전자는 선택 불가 + 사유, 휴식자는 선택 가능
    fireEvent.click(within(sections()[0]!).getByRole('button', { name: '코트 3에 경기 추가' }))
    expect(await screen.findByTestId('club-swap-sheet')).toBeInTheDocument()
    expect(within(sheet()).getByRole('button', { name: new RegExp(`^${NAME[busy]}, 선택할 수 없음: 이 라운드에 이미 출전 · 2경기 코트 2$`) })).toHaveAttribute('aria-disabled', 'true')
    expect(within(sheet()).getByRole('button', { name: new RegExp(`^${NAME[restKey]},`) })).not.toHaveAttribute('aria-disabled')
    fireEvent.click(within(sheet()).getByRole('button', { name: '닫기' }))
    await waitSt('SCR-244-ST11')
    // 저장된 1라운드 코트 1 경기의 선수 자리: 같은 라운드 코트 2 출전자는 선택 불가(ST13)
    const me = inR1[0]!.team1[0]
    fireEvent.click(within(sections()[0]!).getByRole('button', { name: new RegExp(`^1경기 .* ${NAME[me]} 교체$`) }))
    await waitFor(() => expect(sheet().querySelector('[data-scr="SCR-225"]')).toHaveAttribute('data-st', 'SCR-225-ST13'))
    expect(within(sheet()).getByText('1라운드 코트 1 · 1경기', { exact: false })).toBeInTheDocument()
    expect(within(sheet()).getByRole('button', { name: new RegExp(`^${NAME[busy]}, 선택할 수 없음: 이 라운드에 이미 출전 · 2경기 코트 2$`) })).toHaveAttribute('aria-disabled', 'true')
  })

  it('[SCR-244-ST16, SCR-244-ST22] [AC-151] delete: courts pull up inside a round; an emptied round goes and later rounds move up (toast, aria-live)', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 3 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    // 2라운드 코트 1 삭제 → 2라운드 코트 정리
    fireEvent.click(within(sections()[1]!).getByRole('button', { name: '3경기 삭제' }))
    const dlg = await screen.findByRole('alertdialog', { name: '3경기를 삭제할까요?' })
    expect(st()).toBe('SCR-244-ST16')
    expect(within(dlg).getByText('삭제하면 코트·경기 번호와 경기 수가 다시 계산됩니다')).toBeInTheDocument()
    fireEvent.click(within(dlg).getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('2라운드 코트를 다시 정리했습니다')).toBeInTheDocument()
    await waitSt('SCR-244-ST22')
    expect(match(id).games.filter((g) => g.round === 2).map((g) => g.court)).toEqual([1])
    // 2라운드 마지막 경기 삭제 → 2라운드가 사라지고 3라운드가 2라운드로
    fireEvent.click(within(sections()[1]!).getByRole('button', { name: '3경기 삭제' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('2라운드가 비어 지웠습니다. 뒤 라운드 번호가 하나씩 당겨졌습니다')).toBeInTheDocument()
    await waitFor(() => expect(sections()).toHaveLength(2))
    expect([...new Set(match(id).games.map((g) => g.round))]).toEqual([1, 2])
    expect(screen.getByText(/전체 4경기/)).toBeInTheDocument()
  })

  it('[SCR-244-ST13] [AC-150, AC-141] a failed delete keeps the schedule and offers retry', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 2 })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    ctl.fail = 1
    fireEvent.click(within(sections()[0]!).getByRole('button', { name: '1경기 삭제' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('1경기를 삭제하지 못했습니다. 대진은 그대로입니다')).toBeInTheDocument()
    await waitSt('SCR-244-ST13')
    expect(match(id).games).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(match(id).games).toHaveLength(3))
  })

  it('[SCR-244-ST20, SCR-244-ST22] [AC-152] move sheet: full rounds and overlapping players are not selectable; a free round takes the game', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2 })
    const [a, b, c, d, e, f, g, h] = SCORED
    let v = await getClubMatchView(id)
    v = await addClubGame(id, v.version, [a!, b!], [c!, d!], 1)
    v = await addClubGame(id, v.version, [e!, f!], [g!, h!], 2)
    await addClubGame(id, v.version, [a!, c!], [b!, d!], 2)
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST7')
    // 2라운드 코트 2(가람·마루·다온·초록)는 1라운드와 출전이 겹침
    fireEvent.click(within(sections()[1]!).getByRole('button', { name: '3경기 다른 라운드로 이동' }))
    const ms = await screen.findByTestId('move-sheet')
    await waitSt('SCR-244-ST20')
    expect(within(ms).getByRole('button', { name: /^1라운드, 선택할 수 없음: 출전 겹침: / })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(ms).getByRole('button', { name: '닫기' }))
    // 2라운드 코트 1(오아라·한바다·신자람·윤새벽)은 1라운드로 옮길 수 있음
    fireEvent.click(within(sections()[1]!).getByRole('button', { name: '2경기 다른 라운드로 이동' }))
    fireEvent.click(within(await screen.findByTestId('move-sheet')).getByRole('button', { name: '1라운드, 빈 코트 1' }))
    expect(await screen.findByText('1라운드 코트 2로 옮겼습니다')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('move-sheet')).toBeNull())
    expect(match(id).games.filter((x) => x.round === 1)).toHaveLength(2)
    expect(match(id).games.filter((x) => x.round === 2)).toHaveLength(1)
    expect(st()).toBe('SCR-244-ST22')
  })

  it('[SCR-244-ST23] [AC-150] at 200 games: court add and round add are disabled with the reason', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 4), courts: 1 })
    const [a, b, c, d] = SCORED
    updateDb((db) => {
      const m = db.clubMatches!.find((x) => x.id === id)!
      m.games = Array.from({ length: 200 }, (_, i): MockClubGame => ({ no: i + 1, round: i + 1, court: 1, team1: [a!, b!], team2: [c!, d!], winner: null, genderRelaxed: false, manual: true }))
    })
    renderAt(`/club-matches/${id}/setup/games`)
    await waitSt('SCR-244-ST23')
    expect(screen.getByRole('button', { name: '라운드 추가' })).toBeDisabled()
    expect(screen.getByText('경기는 200개까지 만들 수 있습니다')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /에 경기 추가$/ })).toBeNull()
  })

  it('[SCR-245-ST1] [AC-153] confirm shows courts and rounds, a read-only round view, round checks and the round-1 notice', async () => {
    const id = await roundDraft({ method: 'team', keys: SCORED.slice(0, 10), courts: 2, rounds: 3 })
    const router = renderAt(`/club-matches/${id}/setup/confirm`)
    await waitSt('SCR-245-ST1')
    expect(screen.getByText('코트 2 · 3라운드')).toBeInTheDocument()
    expect(screen.getByText('라운드마다 청 4·백 4 출전 · 휴식 청 1·백 1')).toBeInTheDocument()
    expect(screen.getByText('같은 라운드 중복 출전 없음')).toBeInTheDocument()
    expect(screen.getByText('라운드마다 경기 수 ≤ 코트 수(2)')).toBeInTheDocument()
    expect(screen.getByText('확정하면 1라운드가 바로 시작됩니다')).toBeInTheDocument()
    expect(screen.queryByTestId('readonly-rounds')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '라운드별 대진 보기' }))
    const ro = screen.getByTestId('readonly-rounds')
    expect(within(ro).getAllByTestId('round-section')).toHaveLength(3)
    expect(within(ro).getByRole('listitem', { name: '1라운드 코트 2, 2경기' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('su-next'))
    const dlg = await screen.findByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' })
    expect(within(dlg).getByText(/확정하면 1라운드가 바로 시작됩니다/)).toBeInTheDocument()
    fireEvent.click(within(dlg).getByRole('button', { name: '확정' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}`))
    expect(match(id).currentRound).toBe(1)
  })

  it('[SCR-245-ST9] [AC-153] a server round re-check failure marks the round check failed with the reason and a fix link', async () => {
    const id = await roundDraft({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 2 })
    const router = renderAt(`/club-matches/${id}/setup/confirm`)
    await waitSt('SCR-245-ST1')
    ctl.failCode = { code: 'round_conflict', message: '같은 라운드에 이미 출전하는 사람이 있습니다' }
    fireEvent.click(screen.getByTestId('su-next'))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '확정' }))
    expect(await screen.findByText('같은 라운드에 이미 출전하는 사람이 있습니다 — 대진을 수정해 주세요')).toBeInTheDocument()
    await waitSt('SCR-245-ST9')
    expect(match(id).status).toBe('draft')
    const item = screen.getByText('같은 라운드에 이미 출전하는 사람이 있습니다 — 대진을 수정해 주세요').closest('li')!
    fireEvent.click(within(item).getByRole('button', { name: /수정/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    await act(async () => undefined)
  })
})
