import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '../../lib/api'
import { readDb, updateDb, type MockClubGame } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona } from '../auth/devPersona'
import { deleteGuest } from '../roster/api'
import {
  applyTeamProposal,
  candidatesFor,
  confirmClub,
  createClubMatch,
  excludeWithSubstitutes,
  finishClub,
  generateClub,
  getClubMatchView,
  recordResult,
  setParticipating,
  setSettings,
  setTeam,
  swapClub,
  type GameView,
} from './api'
import { ClubGameCard } from './ClubGameCard'
import { getPublicClubMatch, listPublicClubMatches } from './memberApi'
import { ParticipantsPanel } from './ParticipantsPanel'
import { SubstituteSheet } from './SubstituteSheet'

// I3-d3: Mock이 서버(I3-a~d2)와 같은 계약·정책으로 동작하는지(P-1~P-10, U2·U4·U10, C안, S-1)
const code = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    return isApiError(e) ? `${e.status} ${e.code}` : String(e)
  }
}
const M = (id: string) => `member:${id}`
const G = (id: string) => `guest:${id}`

/** 대진을 직접 넣은 Mock 청백전(people: 사람 키, games: 사람 번호 4개씩) */
function crafted(people: string[], games: number[][], status: 'draft' | 'confirmed' = 'confirmed', method: 'individual' | 'team' = 'individual') {
  readDb()
  const id = `cm-t${Math.random().toString(36).slice(2, 8)}`
  updateDb((db) => {
    db.clubMatches ??= []
    const g: MockClubGame[] = games.map((f, i) => ({ no: i + 1, team1: [people[f[0]!]!, people[f[1]!]!], team2: [people[f[2]!]!, people[f[3]!]!], winner: null, genderRelaxed: false }))
    db.clubMatches.push({ id, name: '정책', date: '2026-11-20', method, status, participants: Object.fromEntries(people.map((k) => [k, { team: null, left: false }])), totalGames: games.length, rules: { balance: true, gender: false }, games: g, seed: 1, teamProposed: false, modifiedAt: null, resultModifiedAt: null, version: 1 })
  })
  return id
}
const P6 = ['m-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-8'].map(M)

describe('I3-d Mock ↔ API contract and policies', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setPersona('admin')
  })

  it('C-19·U9: every change needs the version the screen saw and returns the latest view', async () => {
    const id = await createClubMatch({ method: 'individual', date: '2026-11-20', name: '버전' })
    let v = await getClubMatchView(id)
    expect(await code(setSettings(id, v.version + 1, { totalGames: 4, rules: v.rules }))).toBe('409 conflict')
    v = await setSettings(id, v.version, { totalGames: 4, rules: v.rules })
    expect(v.totalGames).toBe(4)
    for (const k of P6.slice(0, 4)) v = await setParticipating(id, v.version, k, true)
    expect(v.summary.count).toBe(4)
    expect(await code(setParticipating(id, 1, P6[4]!, true))).toBe('409 conflict')
    expect(await code(generateClub(id, v.version - 1))).toBe('409 conflict')
    const g = await generateClub(id, v.version)
    expect(g.games).toHaveLength(4)
    expect(g.version).toBe(v.version + 1)
    const team = await createClubMatch({ method: 'team', date: '2026-11-20', name: '팀' })
    let t = await getClubMatchView(team)
    t = await setTeam(team, t.version, P6[0]!, 'blue')
    expect(await code(applyTeamProposal(team, t.version - 1))).toBe('409 conflict')
    expect((await applyTeamProposal(team, t.version)).teamProposed).toBe(true)
  })

  it('U6·P-5: inactive members cannot join; inactive/deleted rows stay with available=false', async () => {
    const id = await createClubMatch({ method: 'individual', date: '2026-11-20', name: '자격' })
    const v = await getClubMatchView(id)
    expect(await code(setParticipating(id, v.version, M('u-inactive'), true))).toBe('422 not_eligible')
    const done = crafted([...P6.slice(0, 4), G('g-2')], [[0, 1, 2, 3], [0, 1, 2, 4]])
    let w = await recordResult(done, 1, 1, 1)
    w = await recordResult(done, w.version, 2, 1)
    expect((await finishClub(done, w.version)).status).toBe('finished')
    await deleteGuest('g-2')
    const after = await getClubMatchView(done)
    const row = after.rows.find((r) => r.key === G('g-2'))!
    expect([row.name, row.gender, row.grade, row.score, row.available, row.participating]).toEqual(['삭제된 게스트', null, null, null, false, true])
    expect(after.games[1]!.gap).toBeNull()
  })

  it('P-3: confirming without games → 409 no_games', async () => {
    const id = await createClubMatch({ method: 'individual', date: '2026-11-20', name: '빈' })
    expect(await code(confirmClub(id, (await getClubMatchView(id)).version))).toBe('409 no_games')
  })

  it('U2·P-1·P-2·U10·P-10: revert in progress, idempotent repeat, no revert after finish, result edits marked separately', async () => {
    const id = crafted(P6.slice(0, 4), [[0, 1, 2, 3], [0, 2, 1, 3]])
    let v = await recordResult(id, 1, 1, 1)
    const same = await recordResult(id, v.version, 1, 1)
    expect(same.version).toBe(v.version) // P-2
    v = await recordResult(id, v.version, 1, null) // U2 되돌리기
    expect(v.games[0]!.winner).toBeNull()
    expect(v.standings.every((s) => s.wins === 0)).toBe(true)
    v = await recordResult(id, v.version, 1, 2)
    v = await recordResult(id, v.version, 2, 1)
    v = await finishClub(id, v.version)
    expect(await code(recordResult(id, v.version, 1, null))).toBe('409 locked') // P-1
    v = await recordResult(id, v.version, 1, 1)
    expect(v.games.map((g) => [g.changed, g.resultChanged])).toEqual([[false, true], [false, false]])
    expect(v.modifiedAt).toBeNull()
    expect(v.resultModifiedAt).not.toBeNull()
    const member = await getPublicClubMatch(id, 'm-1')
    expect(member.resultModifiedAt).not.toBeNull()
    expect(member.games[0]!.resultChanged).toBe(true)
  })

  it('P-4: a swap that repeats another game (same 4, same teams) → 409 same_matchup, nothing changes', async () => {
    const id = crafted(P6, [[0, 1, 2, 3], [0, 1, 2, 4]])
    expect(await code(swapClub(id, 1, 2, P6[4]!, P6[3]!))).toBe('409 same_matchup')
    expect(await code(swapClub(id, 1, 1, P6[3]!, P6[4]!))).toBe('409 same_matchup')
    const v = await getClubMatchView(id)
    expect(v.version).toBe(1)
    const opts = candidatesFor(v, 2, P6[4]!)
    expect(opts.find((c) => c.person.key === P6[3])).toMatchObject({ sameMatchup: true, disabledReason: '같은 4명·같은 팀 구성이 됩니다' })
    const ok = await swapClub(id, 1, 2, P6[4]!, P6[5]!)
    expect(ok.games[1]).toMatchObject({ manual: true, changed: true, repeatedMatchup: false })
    expect(ok.modifiedAt).not.toBeNull()
  })

  it('P-4-b: unavoidable duplicate allowed with reason, avoidable one rejected, no substitute → 422', async () => {
    const five = P6.slice(0, 5)
    const forced = crafted(five, [[0, 1, 2, 3], [0, 1, 2, 4]])
    let v = await recordResult(forced, 1, 1, 1)
    v = await excludeWithSubstitutes(forced, v.version, five[4]!, [{ gameNo: 2, to: five[3]! }])
    expect(v.games[1]).toMatchObject({ repeatedMatchup: true, relaxations: [{ rule: 'matchup', reason: 'substitute_exhausted' }] })
    expect(v.rows.find((r) => r.key === five[4])!.left).toBe(true)

    const avoid = crafted(P6, [[0, 1, 2, 3], [0, 1, 2, 4]])
    expect(await code(excludeWithSubstitutes(avoid, 1, P6[4]!, [{ gameNo: 2, to: P6[3]! }]))).toBe('409 same_matchup')
    expect((await getClubMatchView(avoid)).version).toBe(1) // 원자적(P-7)
    expect(await code(excludeWithSubstitutes(avoid, 1, P6[4]!, [{ gameNo: 2, to: P6[5]! }]))).toBe('ok')
    expect(await code(excludeWithSubstitutes(avoid, 2, P6[4]!, []))).toBe('409 conflict') // P-6 재퇴장

    const four = crafted(P6.slice(0, 4), [[0, 1, 2, 3], [0, 1, 2, 3]])
    const w = await recordResult(four, 1, 1, 1)
    expect(await code(excludeWithSubstitutes(four, w.version, P6[3]!, [{ gameNo: 2, to: P6[0]! }]))).toBe('422 no_substitute')
  })

  it('S-1·AC-066: member responses use per-match keys, never internal ids or ops fields', async () => {
    const list = JSON.stringify(await listPublicClubMatches())
    const one = await getPublicClubMatch('cm-1', 'u-member')
    const json = JSON.stringify(one)
    expect(json).not.toMatch(/member:|guest:|"u-member"|"m-1"/)
    for (const key of ['"score"', '"gap"', '"grade"', '"gender"', '"relaxations"', '"repeatedMatchup"', '"manual"', '"version"', '"rules"', '"seed"']) {
      expect(json).not.toContain(key)
      expect(list).not.toContain(key)
    }
    const keys = one.games.flatMap((g) => [...g.team1, ...g.team2]).map((p) => p.key)
    expect(keys.every((k) => k.startsWith('p:cm-1-'))).toBe(true)
    const other = await getPublicClubMatch('cm-3', 'u-member')
    const mine = (m: typeof one) => m.standings.find((s) => s.me)!.key
    expect(mine(one)).not.toBe(mine(other))
  })
})

describe('I3-d3 revert UI (SCR-223)', () => {
  beforeEach(() => window.localStorage.clear())

  it("'미기록으로 되돌리기' under the result buttons → confirm → toast, only while in progress", async () => {
    setPersona('admin')
    const id = crafted(P6.slice(0, 4), [[0, 1, 2, 3]])
    updateDb((db) => {
      db.clubMatches!.find((m) => m.id === id)!.games[0]!.winner = 1
    })
    const router = createMemoryRouter(routes, { initialEntries: [`/ops/club-matches/${id}`] })
    render(<RouterProvider router={router} />)
    const card = await screen.findByRole('article', { name: '1경기' })
    fireEvent.click(within(card).getByRole('button', { name: '미기록으로 되돌리기' }))
    const dialog = await screen.findByRole('alertdialog', { name: '1경기 결과를 미기록으로 되돌릴까요?' })
    expect(dialog).toHaveTextContent('기록된 결과가 삭제되고 순위·승수가 다시 계산됩니다')
    fireEvent.click(within(dialog).getByRole('button', { name: '되돌리기' }))
    expect(await screen.findByText('경기 결과가 미기록으로 변경되었습니다.')).toBeInTheDocument()
    await waitFor(() => expect(readDb().clubMatches!.find((m) => m.id === id)!.games[0]!.winner).toBeNull())
    expect(within(await screen.findByRole('article', { name: '1경기' })).queryByRole('button', { name: '미기록으로 되돌리기' })).toBeNull() // 미기록이면 없음
  })

  it('finished matches have no revert button', async () => {
    setPersona('admin')
    const router = createMemoryRouter(routes, { initialEntries: ['/ops/club-matches/cm-3'] })
    render(<RouterProvider router={router} />)
    await screen.findByRole('article', { name: '1경기' })
    expect(screen.queryByRole('button', { name: '미기록으로 되돌리기' })).toBeNull()
  })
})

// ── I3-d4-a: 승인 명세 맞춤(D-9 ST7, D-10 문구, SCR-224 삭제된 게스트·비활성 회원) ──
describe('I3-d4-a spec alignment', () => {
  beforeEach(() => window.localStorage.clear())

  async function renderInRouter(node: () => React.ReactNode) {
    const router = createMemoryRouter([{ path: '/', element: <>{node()}</> }], { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
  }

  it('D-9: SCR-226-ST7 when only duplicate substitutes remain; no substitute at all stays ST4', async () => {
    const five = P6.slice(0, 5)
    const id = crafted(five, [[0, 1, 2, 3], [0, 1, 2, 4]])
    await recordResult(id, 1, 1, 1)
    const v = await getClubMatchView(id)
    await renderInRouter(() => <SubstituteSheet view={v} leaverKey={five[4]!} onClose={() => {}} onDone={() => {}} onConflict={() => {}} />)
    const sheet = await screen.findByTestId('substitute-sheet')
    expect(sheet.querySelector('[data-scr=SCR-226]')).toHaveAttribute('data-st', 'SCR-226-ST7')
    expect(within(sheet).getByText('2경기: 대체 후보 소진. 같은 4명·같은 팀 구성이 되는 후보만 고를 수 있습니다')).toBeInTheDocument()
    expect(within(sheet).getByText(/다른 후보가 없어 고를 수 있습니다/)).toBeInTheDocument() // 미리 고른 중복 후보 안내
    expect(within(sheet).getByRole('button', { name: '반영' })).toBeEnabled()
  })

  it('D-9: no valid substitute → ST4 with the error notice and 반영 disabled', async () => {
    const id = crafted(P6.slice(0, 4), [[0, 1, 2, 3], [0, 1, 2, 3]])
    await recordResult(id, 1, 1, 1)
    const v = await getClubMatchView(id)
    await renderInRouter(() => <SubstituteSheet view={v} leaverKey={P6[3]!} onClose={() => {}} onDone={() => {}} onConflict={() => {}} />)
    const sheet = await screen.findByTestId('substitute-sheet')
    expect(sheet.querySelector('[data-scr=SCR-226]')).toHaveAttribute('data-st', 'SCR-226-ST4')
    expect(within(sheet).getByText(/대체할 수 있는 선수가 없는 경기가 있어 중도 귀가를 처리할 수 없습니다/)).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: '반영' })).toBeDisabled()
  })

  it('D-10: relaxation badges use the decided wording per reason code', async () => {
    const base = (await getClubMatchView(crafted(P6.slice(0, 4), [[0, 1, 2, 3]]))).games[0]!
    const cases: [GameView['relaxations'], boolean, boolean, string[]][] = [
      [[{ rule: 'matchup', reason: 'substitute_exhausted' }], true, false, ['같은 대진 반복 · 대체 후보 소진']],
      [[{ rule: 'matchup', reason: 'exhausted' }, { rule: 'gender', reason: 'exhausted' }], true, true, ['같은 대진 반복 · 가능한 조합 소진', '성별 규칙 완화 · 가능한 성별 조합 없음']],
      [[{ rule: 'gender', reason: 'manual' }], false, true, ['성별 규칙 완화 · 운영진 수동 변경']],
      [[{ rule: 'gender', reason: 'higher_priority' }], false, true, ['성별 규칙 완화 · 중복 대진 방지 우선']],
      [[{ rule: 'matchup', reason: 'search_limit' }], true, false, ['같은 대진 반복 · 자동 탐색 한계']],
    ]
    for (const [relaxations, repeatedMatchup, genderRelaxed, texts] of cases) {
      const { unmount } = render(<ClubGameCard game={{ ...base, relaxations, repeatedMatchup, genderRelaxed }} method="individual" showResult={false} />)
      for (const t of texts) expect(screen.getByText(t)).toBeInTheDocument()
      unmount()
    }
  })

  it('SCR-224: deleted guests are not listed; inactive members with remaining games show guidance and the exclude action', async () => {
    const people = [...P6.slice(0, 3), M('u-inactive'), G('g-2')]
    const id = crafted(people, [[0, 1, 3, 4], [0, 1, 2, 3]])
    let v = await recordResult(id, 1, 1, 1)
    updateDb((db) => {
      db.guests = db.guests.filter((g) => g.id !== 'g-2') // 지난 경기에 뛴 뒤 삭제된 게스트(비식별화)
    })
    v = await getClubMatchView(id)
    expect(v.rows.find((r) => r.key === G('g-2'))).toMatchObject({ name: '삭제된 게스트', available: false, participating: true })
    const excluded: string[] = []
    await renderInRouter(() => <ParticipantsPanel view={v} run={(w) => w(v.version)} onChanged={() => {}} onConflict={() => {}} onScores={() => {}} onExclude={(k) => excluded.push(k)} />)
    expect(screen.queryByText('삭제된 게스트')).toBeNull() // 참가자 명단에서 빠짐(AC-107)
    const inactive = document.querySelector(`[data-participant="${M('u-inactive')}"]`) as HTMLElement
    expect(within(inactive).getAllByText('비활성')).toHaveLength(2) // 샘플 이름 '비활성' + 배지
    expect(within(inactive).getByText('남은 경기 1개 · 대체 선수를 정하세요')).toBeInTheDocument()
    fireEvent.click(within(inactive).getByRole('button', { name: '이후 대진에서 제외' }))
    expect(excluded).toEqual([M('u-inactive')])
    expect(v.games[0]!.team2.some((p) => p.name === '삭제된 게스트')).toBe(true) // 지난 경기에는 남음
  })
})
