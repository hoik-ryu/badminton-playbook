import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { confirmClub, createClubMatch, excludeWithSubstitutes, generateClub, getClubMatchView, nextRound, read, recordResult, saveParticipants, saveTeams, type ClubMatchView, type ClubMethod } from './api'
import { bumpVersion, halves, SCORED } from './setup/testkit'

// (B17, r14) SCR-112 라운드 진행(운영)·취소 경기(회원)·SCR-226 중도 귀가·SCR-225 확정 후 교체 — UX Spec r12 02 SCR-112 ST16–ST24,
// SCR-226 ST1·ST4·ST8, SCR-225 ST7·ST13, DD r15 VD-079·080·083·084, AC-154–159·161–163. Mock(서버 router.py와 같은 라운드 규칙)
const ctl = vi.hoisted(() => ({ failCode: null as null | { code: string; message: string; details?: unknown }, on: '' }))
vi.mock('./api', async (orig) => {
  const m = await orig<typeof import('./api')>()
  const { ApiError } = await import('../../lib/api')
  const wrap =
    <A extends unknown[], R>(name: string, fn: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      if (ctl.failCode && ctl.on === name) {
        const e = ctl.failCode
        ctl.failCode = null
        throw new ApiError(e.code === 'conflict' ? 409 : 422, e)
      }
      return fn(...a)
    }
  return { ...m, recordResult: wrap('recordResult', m.recordResult), undoRound: wrap('undoRound', m.undoRound), excludeWithSubstitutes: wrap('excludeWithSubstitutes', m.excludeWithSubstitutes) }
})
const failNext = (on: string, code: string, message: string, details?: unknown) => Object.assign(ctl, { on, failCode: { code, message, details } })

const NAME: Record<string, string> = Object.fromEntries(['김가람', '박다온', '정마루', '권초록', '오아라', '한바다', '신자람', '윤새벽', '정마음', '김민결'].map((n, i) => [SCORED[i]!, n]))

/** 확정된 라운드 기반 청백전(참가자 → 팀전 팀 → 기준 라운드 수로 생성 → 확정 = 1라운드 진행 중) */
async function liveMatch(opts: { method: ClubMethod; keys: string[]; courts: number; rounds: number }) {
  const id = await createClubMatch({ method: opts.method, date: '2026-11-15', name: '라운드 진행', courtCount: opts.courts })
  let v = await saveParticipants(id, 1, opts.keys)
  if (opts.method === 'team') v = await saveTeams(id, v.version, halves(opts.keys))
  v = await generateClub(id, v.version, { rounds: opts.rounds, rules: { balance: true, gender: true } })
  await confirmClub(id, v.version)
  return id
}
const latest = (id: string) => getClubMatchView(id)
/** 진행 라운드의 결과 없는 경기를 모두 1팀(청) 승으로 */
async function finishRound(id: string) {
  let v = await latest(id)
  for (const g of v.games.filter((x) => x.round === v.currentRound && !x.winner && !x.cancelled)) v = await recordResult(id, v.version, g.no, 1)
  return v
}
function renderAt(path: string, persona: PersonaKey = 'admin', state?: unknown) {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: path, state }] })
  const r = render(<RouterProvider router={router} />)
  return { router, ...r }
}
const ops = () => screen.getByTestId('ops-area')
const opsSt = () => ops().getAttribute('data-st')
const progress = () => screen.getByTestId('round-progress')
const section = (round: number) => screen.getAllByTestId('round-section').find((s) => within(s).queryByRole('heading', { name: new RegExp(`^${round}라운드`) }))!
const card = (no: number) => document.querySelector(`[data-cmp=CMP-041][data-game="${no}"]:not([data-audience])`) as HTMLElement
const toastText = () => document.querySelector('[data-cmp=CMP-029]')?.textContent ?? ''
const sub = () => screen.getByTestId('substitute-sheet')

describe('club match live rounds (B17)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
    ctl.failCode = null
  })

  it('[SCR-112-ST16, SCR-112-ST20] [AC-154] confirm starts round 1: toast, progress card, later rounds locked, and a reload keeps the round', async () => {
    const id = await liveMatch({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 3 })
    const { unmount } = renderAt(`/club-matches/${id}`, 'admin', { confirmed: true })
    expect(await screen.findByTestId('round-progress')).toHaveTextContent('1라운드 진행 중')
    await waitFor(() => expect(toastText()).toContain('1라운드를 시작했습니다'))
    expect(opsSt()).toBe('SCR-112-ST18')
    expect(section(1).querySelector('h3')).toHaveTextContent('진행 중')
    expect(section(2).querySelector('h3')).toHaveTextContent('시작 전')
    // 시작 전 라운드: 대진은 보이고 결과 버튼 대신 '시작 전'(서버에 보내지 않음)
    const future = card(3)
    expect(within(future).getByText('코트 1')).toBeInTheDocument()
    expect(within(future).getByLabelText('시작 전, 결과를 기록할 수 없음')).toBeInTheDocument()
    expect(within(future).queryByRole('group', { name: '3경기 결과' })).toBeNull()
    expect(within(card(1)).getByRole('group', { name: '1경기 결과' })).toBeInTheDocument()
    unmount()
    // 새로고침(다시 열기): 서버 저장 진행 라운드 그대로, 토스트 없음
    renderAt(`/club-matches/${id}`)
    expect(await screen.findByTestId('round-progress')).toHaveTextContent('1라운드 진행 중')
    // 서버가 시작 전 라운드 결과를 거부하면(round_not_started) 안내 상자 — 다른 화면의 오래된 상태에서 올 수 있음
    failNext('recordResult', 'round_not_started', '아직 시작하지 않은 라운드입니다', { round: 2, currentRound: 1 })
    fireEvent.click(within(within(card(1)).getByRole('group', { name: '1경기 결과' })).getByRole('button', { name: '1팀 승' }))
    expect(await screen.findByText('아직 시작하지 않은 라운드입니다')).toBeInTheDocument()
    expect(opsSt()).toBe('SCR-112-ST20')
    expect((await latest(id)).games[0]!.winner).toBeNull()
  })

  it('[SCR-112-ST17, SCR-112-ST18] [AC-155] next round only when every game of the round is processed; no automatic move; toast and the old round folds', async () => {
    const id = await liveMatch({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 3 })
    const v = await latest(id)
    await recordResult(id, v.version, 1, 1)
    renderAt(`/club-matches/${id}`)
    await screen.findByTestId('round-progress')
    const next = within(progress()).getByTestId('next-round')
    expect(next).toBeDisabled()
    expect(next).toHaveAccessibleDescription('처리되지 않은 경기 1개')
    expect(within(progress()).getByRole('button', { name: '처리 1/2, 처리되지 않은 경기 1개로 이동' })).toBeInTheDocument()
    expect(opsSt()).toBe('SCR-112-ST18')
    // 마지막 경기 기록 → 활성, 자동으로 넘어가지 않음
    fireEvent.click(within(within(card(2)).getByRole('group', { name: '2경기 결과' })).getByRole('button', { name: '2팀 승' }))
    await waitFor(() => expect(within(progress()).getByTestId('next-round')).toBeEnabled())
    expect(opsSt()).toBe('SCR-112-ST17')
    expect((await latest(id)).currentRound).toBe(1)
    fireEvent.click(within(progress()).getByTestId('next-round'))
    await waitFor(() => expect(progress()).toHaveTextContent('2라운드 진행 중'))
    await waitFor(() => expect(toastText()).toContain('2라운드를 시작했습니다'))
    expect((await latest(id)).currentRound).toBe(2)
    // 지난 라운드는 '완료'로 접힘
    expect(section(1).querySelector('h3')).toHaveTextContent('완료')
    expect(within(section(1)).getByRole('button', { name: '1라운드 펼치기' })).toBeInTheDocument()
    expect(card(1)).toBeNull()
  })

  it('[SCR-112-ST6] [AC-155] another admin changed it first: starting the next round shows the conflict dialog and keeps the round', async () => {
    const id = await liveMatch({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 2 })
    await finishRound(id)
    renderAt(`/club-matches/${id}`)
    await waitFor(() => expect(within(screen.getByTestId('round-progress')).getByTestId('next-round')).toBeEnabled())
    bumpVersion(id)
    fireEvent.click(within(progress()).getByTestId('next-round'))
    expect(await screen.findByRole('alertdialog', { name: '다른 운영진이 청백전을 변경했습니다' })).toBeInTheDocument()
    expect(readDb().clubMatches!.find((m) => m.id === id)!.currentRound).toBe(1)
  })

  it('[SCR-112-ST19] [AC-156] cancel a round start only while it has no result or cancellation; server refusal shows a notice', async () => {
    const id = await liveMatch({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 3 })
    const v = await finishRound(id)
    await nextRound(id, v.version)
    renderAt(`/club-matches/${id}`)
    fireEvent.click(await screen.findByTestId('undo-round'))
    const dlg = await screen.findByRole('alertdialog', { name: '2라운드 시작을 취소하고 1라운드로 돌아갈까요?' })
    expect(within(dlg).getByText('1라운드 경기를 다시 고치거나 미기록으로 되돌릴 수 있습니다')).toBeInTheDocument()
    expect(opsSt()).toBe('SCR-112-ST19')
    fireEvent.click(within(dlg).getByRole('button', { name: '시작 취소' }))
    await waitFor(() => expect(progress()).toHaveTextContent('1라운드 진행 중'))
    await waitFor(() => expect(toastText()).toContain('2라운드 시작을 취소했습니다'))
    expect((await latest(id)).currentRound).toBe(1)
    // 다시 시작 → 결과가 하나라도 있으면 '라운드 시작 취소' 없음
    fireEvent.click(within(progress()).getByTestId('next-round'))
    await waitFor(() => expect(progress()).toHaveTextContent('2라운드 진행 중'))
    expect(within(progress()).getByTestId('undo-round')).toBeInTheDocument()
    // 서버가 round_has_results로 거부(다른 운영진이 그사이 결과 기록)하면 안내 상자
    failNext('undoRound', 'round_has_results', '이 라운드에 결과나 취소가 있어 시작을 취소할 수 없습니다')
    fireEvent.click(within(progress()).getByTestId('undo-round'))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '시작 취소' }))
    expect(await screen.findByText('이 라운드에 결과나 취소가 있어 시작을 취소할 수 없습니다')).toBeInTheDocument()
    fireEvent.click(within(within(card(3)).getByRole('group', { name: '3경기 결과' })).getByRole('button', { name: '1팀 승' }))
    await waitFor(() => expect(within(progress()).queryByTestId('undo-round')).toBeNull())
  })

  it('[SCR-112-ST16, SCR-112-ST21] [AC-157] past round: change the winner only, no revert; a refused revert explains why', async () => {
    const id = await liveMatch({ method: 'team', keys: SCORED.slice(0, 8), courts: 2, rounds: 2 })
    const v = await finishRound(id)
    await nextRound(id, v.version)
    renderAt(`/club-matches/${id}`)
    await screen.findByTestId('round-progress')
    fireEvent.click(within(section(1)).getByRole('button', { name: '1라운드 펼치기' }))
    const past = card(1)
    expect(within(past).getByRole('group', { name: '1경기 결과' })).toBeInTheDocument()
    expect(within(past).queryByRole('button', { name: '미기록으로 되돌리기' })).toBeNull()
    fireEvent.click(within(within(past).getByRole('group', { name: '1경기 결과' })).getByRole('button', { name: '백 승' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: "1경기 결과를 '백 승'으로 바꿀까요?" })).getByRole('button', { name: '바꾸기' }))
    await waitFor(async () => expect((await latest(id)).games.find((g) => g.no === 1)!.winner).toBe(2))
    // 진행 라운드 카드에는 되돌리기가 있음. 서버가 round_locked로 거부하면(그사이 다음 라운드 시작) 사유 + 시작 취소 안내
    fireEvent.click(within(within(card(3)).getByRole('group', { name: '3경기 결과' })).getByRole('button', { name: '청 승' }))
    await waitFor(() => expect(within(card(3)).getByRole('button', { name: '미기록으로 되돌리기' })).toBeInTheDocument())
    failNext('recordResult', 'round_locked', '지난 라운드의 결과는 미기록으로 되돌릴 수 없습니다', { round: 2, currentRound: 3 })
    fireEvent.click(within(card(3)).getByRole('button', { name: '미기록으로 되돌리기' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '3경기 결과를 미기록으로 되돌릴까요?' })).getByRole('button', { name: '되돌리기' }))
    expect(await screen.findByText(/^지난 라운드의 결과는 미기록으로 되돌릴 수 없습니다/)).toBeInTheDocument()
    expect(opsSt()).toBe('SCR-112-ST21')
  })

  it('[SCR-112-ST23, SCR-112-ST16] [AC-161] finish only on the last round with nothing left; the reason is shown', async () => {
    const id = await liveMatch({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 2 })
    renderAt(`/club-matches/${id}`)
    await screen.findByTestId('round-progress')
    expect(screen.getByRole('button', { name: '청백전 종료' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '청백전 종료' })).toHaveAccessibleDescription('마지막 라운드를 시작해야 종료할 수 있습니다')
    for (const no of [1, 2]) {
      fireEvent.click(within(within(card(no)).getByRole('group', { name: `${no}경기 결과` })).getByRole('button', { name: '1팀 승' }))
      await waitFor(() => expect(within(card(no)).getByRole('button', { name: '미기록으로 되돌리기' })).toBeInTheDocument())
    }
    fireEvent.click(within(progress()).getByTestId('next-round'))
    await waitFor(() => expect(progress()).toHaveTextContent('2라운드 진행 중'))
    expect(within(progress()).getByTestId('last-round')).toHaveTextContent('마지막 라운드입니다 · 모두 처리하면 청백전을 종료할 수 있습니다')
    expect(screen.getByRole('button', { name: '청백전 종료' })).toHaveAccessibleDescription('처리되지 않은 경기 2개')
    expect(opsSt()).toBe('SCR-112-ST23')
    for (const no of [3, 4]) {
      fireEvent.click(within(within(card(no)).getByRole('group', { name: `${no}경기 결과` })).getByRole('button', { name: '2팀 승' }))
      await waitFor(async () => expect((await latest(id)).games.find((g) => g.no === no)!.winner).toBe(2))
    }
    await waitFor(() => expect(screen.getByRole('button', { name: '청백전 종료' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '청백전 종료' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '청백전을 종료할까요?' })).getByRole('button', { name: '종료' }))
    await waitFor(async () => expect((await latest(id)).status).toBe('finished'))
  })

  it('[SCR-225-ST13, SCR-225-ST7] [AC-158] after confirm, swap candidates exclude players of the same round; the round resting player can come in', async () => {
    const keys = SCORED.slice(0, 9)
    const id = await liveMatch({ method: 'individual', keys, courts: 2, rounds: 2 })
    const v = await latest(id)
    const g1 = v.games.find((g) => g.no === 1)!
    const g2 = v.games.find((g) => g.no === 2)!
    const rest = keys.find((k) => ![...g1.team1, ...g1.team2, ...g2.team1, ...g2.team2].some((p) => p.key === k))!
    renderAt(`/club-matches/${id}`)
    await screen.findByTestId('round-progress')
    const target = g1.team1[0]!
    fireEvent.click(within(card(1)).getByRole('button', { name: `1경기 ${target.name} 교체` }))
    const sheet = await screen.findByTestId('club-swap-sheet')
    expect(sheet).toHaveTextContent('1라운드 코트 1')
    const other = g2.team1[0]!
    expect(within(sheet).getByRole('button', { name: new RegExp(`^${other.name}, 선택할 수 없음: 이 라운드에 이미 출전 · 2경기 코트 2`) })).toHaveAttribute('aria-disabled', 'true')
    const ok = within(sheet).getByRole('button', { name: new RegExp(`^${NAME[rest]},`) })
    expect(ok).not.toHaveAttribute('aria-disabled')
    fireEvent.click(ok)
    const ask = screen.queryByRole('alertdialog')
    if (ask) fireEvent.click(within(ask).getByRole('button', { name: '바꾸기' }))
    await waitFor(async () => expect((await latest(id)).games.find((g) => g.no === 1)!.team1.some((p) => p.key === rest)).toBe(true))
  })

  it('[SCR-226-ST1] [AC-159] leave: rows show round and court; candidates are only people resting in that round', async () => {
    const keys = SCORED.slice(0, 9)
    const id = await liveMatch({ method: 'individual', keys, courts: 2, rounds: 3 })
    const v = await latest(id)
    const leaver = v.games.find((g) => g.no === 1)!.team1[0]!
    renderAt(`/club-matches/${id}`)
    fireEvent.click(await screen.findByTestId('open-participants'))
    const panel = await screen.findByTestId('participants-sheet')
    const row = within(panel).getAllByRole('listitem').find((li) => li.getAttribute('data-participant') === leaver.key)!
    fireEvent.click(within(row).getByRole('button', { name: '이후 대진에서 제외' }))
    await screen.findByTestId('substitute-sheet')
    expect(sub().querySelector('[data-scr=SCR-226]')).toHaveAttribute('data-st', 'SCR-226-ST1')
    const remaining = v.games.filter((g) => !g.winner && [...g.team1, ...g.team2].some((p) => p.key === leaver.key))
    for (const g of remaining) {
      const busy = new Set(v.games.filter((x) => x.round === g.round && x.no !== g.no).flatMap((x) => [...x.team1, ...x.team2].map((p) => p.key)))
      const rowBtn = within(sub()).getByRole('button', { name: new RegExp(`^${g.no}경기, ${g.round}라운드 코트 ${g.court}, 대체: `) })
      fireEvent.click(rowBtn)
      const list = within(sub()).getAllByRole('button', { pressed: false }).concat(within(sub()).queryAllByRole('button', { pressed: true }))
      const names = list.map((b) => b.textContent ?? '')
      for (const k of busy) expect(names.some((t) => t.startsWith(NAME[k]!))).toBe(false)
      fireEvent.click(rowBtn)
    }
    fireEvent.click(within(sub()).getByRole('button', { name: '반영' }))
    await waitFor(() => expect(screen.queryByTestId('substitute-sheet')).toBeNull())
    const after = await latest(id)
    expect(after.rows.find((r) => r.key === leaver.key)!.left).toBe(true)
    expect(after.games.some((g) => g.cancelled)).toBe(false)
  })

  it('[SCR-226-ST8, SCR-226-ST4] [AC-159] no one to substitute: the cancel check is required; a server refusal keeps the sheet and a retry works', async () => {
    const id = await liveMatch({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 2 })
    const v = await latest(id)
    const leaver = v.games.find((g) => g.no === 1)!.team1[0]!
    renderAt(`/club-matches/${id}`)
    fireEvent.click(await screen.findByTestId('open-participants'))
    const panel = await screen.findByTestId('participants-sheet')
    fireEvent.click(within(within(panel).getAllByRole('listitem').find((li) => li.getAttribute('data-participant') === leaver.key)!).getByRole('button', { name: '이후 대진에서 제외' }))
    await screen.findByTestId('substitute-sheet')
    expect(sub().querySelector('[data-scr=SCR-226]')).toHaveAttribute('data-st', 'SCR-226-ST8')
    expect(sub()).toHaveTextContent('대체할 사람이 없음 — 이 라운드 참가자가 모두 출전 중')
    const apply = within(sub()).getByRole('button', { name: '반영' })
    expect(apply).toBeDisabled()
    expect(apply).toHaveAccessibleDescription('대체할 사람이 없는 경기를 취소할지 확인해 주세요')
    const boxes = within(sub()).getAllByRole('checkbox', { name: /경기 취소, 대체할 사람이 없음$/ })
    expect(boxes).toHaveLength(2)
    for (const b of boxes) fireEvent.click(b)
    expect(apply).toBeEnabled()
    // 서버 거절(round_conflict): 시트는 열린 채 안내, 선택 유지 → 다시 '반영'
    failNext('excludeWithSubstitutes', 'round_conflict', '같은 라운드에 같은 사람을 두 번 넣을 수 없습니다')
    fireEvent.click(apply)
    expect(await within(sub()).findByText('같은 라운드에 같은 사람을 두 번 넣을 수 없습니다')).toBeInTheDocument()
    expect(sub().querySelector('[data-scr=SCR-226]')).toHaveAttribute('data-st', 'SCR-226-ST4')
    expect((await latest(id)).rows.find((r) => r.key === leaver.key)!.left).toBe(false)
    expect(within(sub()).getByRole('button', { name: '반영' })).toBeEnabled()
    fireEvent.click(within(sub()).getByRole('button', { name: '반영' }))
    await waitFor(() => expect(screen.queryByTestId('substitute-sheet')).toBeNull())
    const after = await latest(id)
    expect(after.games.filter((g) => g.cancelled).map((g) => g.no).sort()).toEqual(v.games.filter((g) => [...g.team1, ...g.team2].some((p) => p.key === leaver.key)).map((g) => g.no).sort())
  })

  it('[SCR-112-ST22, SCR-112-ST1, SCR-121-ST1] [AC-162, AC-160] cancelled games: admins see the reason, members see a cancel badge; out of next game; records unchanged', async () => {
    // 8명·코트 2 → 모두 출전. 김가람(u-member)이 나오는 1라운드 경기의 다른 사람이 귀가 → 대체 불가 → 취소
    const id = await liveMatch({ method: 'individual', keys: SCORED.slice(0, 8), courts: 2, rounds: 2 })
    let v: ClubMatchView = await latest(id)
    const meKey = 'member:u-member'
    const myFirst = v.games.filter((g) => g.round === 1).find((g) => [...g.team1, ...g.team2].some((p) => p.key === meKey))!
    const leaver = [...myFirst.team1, ...myFirst.team2].find((p) => p.key !== meKey && p.key !== 'member:u-admin')!
    const gone = v.games.filter((g) => [...g.team1, ...g.team2].some((p) => p.key === leaver.key)).map((g) => g.no)
    // 취소 전 마이페이지 전적
    const me0 = renderAt('/me', 'member')
    const before = (await screen.findByRole('region', { name: '청백전 전적' })).textContent
    me0.unmount()
    v = await excludeWithSubstitutes(id, v.version, leaver.key, [], gone)
    expect(v.games.find((g) => g.no === myFirst.no)!.cancelled).not.toBeNull()
    // 운영진: 흐림 + '취소 · 중도 귀가', 결과·교체 없음, 진행 카드는 취소를 처리로 셈
    const { unmount } = renderAt(`/club-matches/${id}`)
    await screen.findByTestId('round-progress')
    const c = card(myFirst.no)
    expect(c).toHaveAttribute('data-cancelled', 'true')
    expect(within(c).getByText('취소 · 중도 귀가')).toBeInTheDocument()
    expect(within(c).queryByRole('group', { name: `${myFirst.no}경기 결과` })).toBeNull()
    expect(within(c).queryByRole('button', { name: /교체$/ })).toBeNull()
    expect(progress()).toHaveTextContent('취소 1')
    expect(within(c).queryByRole('button', { name: /복원/ })).toBeNull() // (r12) 복원 없음
    unmount()
    // 회원(김가람): '취소' 배지, '다음 경기'에서 빠짐, 승·패 없음
    const { unmount: un2 } = renderAt(`/club-matches/${id}`, 'member')
    const pub = await screen.findByTestId('public-area')
    expect(document.querySelector('[data-scr=SCR-112]')).toHaveAttribute('data-st', 'SCR-112-ST7')
    const mine = pub.querySelector(`[data-audience=member][data-game="${myFirst.no}"]`) as HTMLElement
    expect(mine).toHaveAttribute('data-cancelled', 'true')
    expect(within(mine).getByText('취소')).toBeInTheDocument()
    expect(mine).not.toHaveTextContent('중도 귀가')
    const nextSec = within(pub).queryByRole('region', { name: '다음 경기' })
    if (nextSec) expect(nextSec.querySelector(`[data-game="${myFirst.no}"]`)).toBeNull()
    un2()
    // 마이페이지 전적: 취소 경기는 결과가 없어 전적에 들어가지 않음(서버·Mock 집계 그대로)
    renderAt('/me', 'member')
    const rec = await screen.findByRole('region', { name: '청백전 전적' })
    expect(rec.textContent).toBe(before)
  })

  it('[SCR-112-ST24] [AC-163] a confirmed match without rounds keeps the existing screen', async () => {
    renderAt('/club-matches/cm-1')
    const area = await screen.findByTestId('ops-area')
    expect(area).toHaveAttribute('data-st', 'SCR-112-ST13')
    expect(screen.queryByTestId('round-progress')).toBeNull()
    expect(screen.queryByTestId('round-section')).toBeNull()
    expect(screen.getByRole('button', { name: /경기 남음$/ })).toBeInTheDocument()
    expect(within(area).getAllByRole('group', { name: /경기 결과$/ }).length).toBeGreaterThan(0)
  })
})
