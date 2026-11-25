import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readDb, updateDb } from '../../lib/mock/db'
import { addClubGame, CLUB_ERRORS, confirmClub, createClubMatch, deleteClubGame, discardClubGames, exchangeClubGame, generateClub, getClubMatchView, saveParticipants, saveTeams, swapClub, type ClubMatchView } from './api'

// (B13) 확정 전 공통 편집(C-35): Mock 어댑터가 서버(backend test_clubmatch_edit.py)와 같은 규칙·오류 코드인지,
// api 모드는 서버 계약(경로·메서드·본문)과 같은지 확인합니다. 화면은 출처를 모르고 같은 분기를 씁니다.
const RULES = { balance: true, gender: true }
const M = ['m-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-8'].map((x) => `member:${x}`) // 점수 있는 승인 회원(Mock 샘플)
const code = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return (e as { code: string }).code
  }
  return 'ok'
}
const keysOf = (g: ClubMatchView['games'][number]) => [...g.team1, ...g.team2].map((p) => p.key)
const matchup = (g: ClubMatchView['games'][number]) => g.relaxations.filter((r) => r.rule === 'matchup').map((r) => r.reason)

async function individual(keys = M) {
  const id = await createClubMatch({ method: 'individual', date: '2026-12-13', name: '개인전' })
  return saveParticipants(id, 1, keys)
}
async function teamReady() {
  const id = await createClubMatch({ method: 'team', date: '2026-12-13', name: '팀전' })
  let v = await saveParticipants(id, 1, M)
  v = await saveTeams(id, v.version, Object.fromEntries(M.map((k, i) => [k, i % 2 ? 'white' : 'blue'] as const)))
  return generateClub(id, v.version, { totalGames: 4, rules: RULES })
}
const setStatus = (id: string, status: 'draft' | 'confirmed') =>
  updateDb((db) => {
    db.clubMatches!.find((m) => m.id === id)!.status = status
  })

describe('club match edit mock adapter (B13)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    readDb()
  })

  it('[AC-137, AC-138] add and delete keep numbering and actual total; zero games keeps the baseline and blocks confirm', async () => {
    let v = await individual()
    v = await generateClub(v.id, v.version, { totalGames: 4, rules: RULES })
    v = await addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!, M[5]!])
    expect([v.games.map((g) => g.no), v.totalGames, v.games[4]!.manual]).toEqual([[1, 2, 3, 4, 5], 5, true])
    const fourth = keysOf(v.games[3]!)
    v = await deleteClubGame(v.id, v.version, 3)
    expect([v.games.map((g) => g.no), keysOf(v.games[2]!), v.totalGames]).toEqual([[1, 2, 3, 4], fourth, 4])
    for (let i = 0; i < 4; i++) v = await deleteClubGame(v.id, v.version, 1)
    expect([v.games.length, v.totalGames, v.rows.every((r) => r.games === 0)]).toEqual([0, 1, true])
    expect(await code(confirmClub(v.id, v.version))).toBe(CLUB_ERRORS.noGames)
    expect(await code(deleteClubGame(v.id, v.version, 1))).toBe('not_found')
  })

  it('[AC-140] draft repeats are allowed and both games are marked; always-blocked rules are rejected', async () => {
    let v = await individual()
    v = await addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!, M[3]!])
    v = await addClubGame(v.id, v.version, [M[1]!, M[0]!], [M[3]!, M[2]!])
    expect(v.games.map((g) => [g.repeatedMatchup, matchup(g)])).toEqual([[true, ['manual']], [true, ['manual']]])
    v = await swapClub(v.id, v.version, 2, M[3]!, M[4]!)
    expect(v.games.map((g) => [g.repeatedMatchup, matchup(g)])).toEqual([[false, []], [false, []]])
    v = await swapClub(v.id, v.version, 2, M[4]!, M[3]!) // 확정 전 교체로 다시 같은 대진 → 허용·표시
    expect(v.games.every((g) => g.repeatedMatchup && matchup(g)[0] === 'manual')).toBe(true)
    expect(await code(addClubGame(v.id, v.version, [M[0]!, M[0]!], [M[2]!, M[3]!]))).toBe(CLUB_ERRORS.duplicatePlayer)
    expect(await code(addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!] as unknown as [string, string]))).toBe(CLUB_ERRORS.notTwoVsTwo)
    expect(await code(addClubGame(v.id, v.version, [M[0]!, 'member:m-9'], [M[2]!, M[3]!]))).toBe(CLUB_ERRORS.notEligible)
    expect((await getClubMatchView(v.id)).version).toBe(v.version)
  })

  it('[AC-140] team lineup must be blue 2 vs white 2, also re-checked at confirm', async () => {
    const v = await teamReady()
    const blue = M.filter((_, i) => i % 2 === 0)
    const white = M.filter((_, i) => i % 2 === 1)
    expect(await code(addClubGame(v.id, v.version, [blue[0]!, white[0]!], [white[1]!, white[2]!]))).toBe(CLUB_ERRORS.teamViolation)
    const added = await addClubGame(v.id, v.version, [blue[0]!, blue[1]!], [white[0]!, white[1]!])
    updateDb((db) => {
      db.clubMatches!.find((m) => m.id === v.id)!.participants[blue[0]!]!.team = 'white'
    })
    expect(await code(confirmClub(v.id, added.version))).toBe(CLUB_ERRORS.teamViolation)
  })

  it('[AC-139] individual exchange swaps seats with the opponent pair; team mode and partners are rejected', async () => {
    let v = await individual(M.slice(0, 4))
    v = await addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!, M[3]!])
    v = await exchangeClubGame(v.id, v.version, 1, M[0]!, M[3]!)
    expect([v.games[0]!.team1.map((p) => p.key), v.games[0]!.team2.map((p) => p.key), v.games[0]!.manual]).toEqual([[M[3], M[1]], [M[2], M[0]], true])
    expect(await code(exchangeClubGame(v.id, v.version, 1, M[3]!, M[1]!))).toBe(CLUB_ERRORS.conflict)
    const t = await teamReady()
    const g = t.games[0]!
    expect(await code(exchangeClubGame(t.id, t.version, 1, g.team1[0]!.key, g.team2[0]!.key))).toBe(CLUB_ERRORS.exchangeNotAllowed)
  })

  it('[AC-142, AC-136] regenerate after edit needs confirm; discard all keeps the baseline', async () => {
    let v = await individual()
    v = await generateClub(v.id, v.version, { totalGames: 4, rules: RULES })
    v = await generateClub(v.id, v.version, { totalGames: 4, rules: RULES }) // 편집 없음: 확인 없이
    v = await addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!, M[3]!])
    expect(await code(generateClub(v.id, v.version, { totalGames: 4, rules: RULES }))).toBe(CLUB_ERRORS.confirmRequired)
    expect((await getClubMatchView(v.id)).games.length).toBe(5)
    const again = await generateClub(v.id, v.version, { totalGames: 4, rules: RULES }, true)
    expect([again.games.length, again.totalGames, again.games.some((g) => g.manual)]).toEqual([4, 4, false])
    const empty = await discardClubGames(again.id, again.version)
    expect([empty.games.length, empty.totalGames, empty.version]).toEqual([0, 4, again.version + 1])
  })

  it('[AC-143] after confirm: add, delete, exchange and discard are locked; same-matchup swap still rejected', async () => {
    let v = await individual()
    v = await addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!, M[3]!])
    v = await addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!, M[4]!])
    setStatus(v.id, 'confirmed')
    const locked = CLUB_ERRORS.locked
    expect(await code(addClubGame(v.id, v.version, [M[0]!, M[5]!], [M[2]!, M[3]!]))).toBe(locked)
    expect(await code(deleteClubGame(v.id, v.version, 2))).toBe(locked)
    expect(await code(exchangeClubGame(v.id, v.version, 1, M[0]!, M[2]!))).toBe(locked)
    expect(await code(discardClubGames(v.id, v.version))).toBe(locked)
    expect(await code(swapClub(v.id, v.version, 2, M[4]!, M[3]!))).toBe(CLUB_ERRORS.sameMatchup)
    expect((await getClubMatchView(v.id)).version).toBe(v.version)
  })

  it('[AC-141] stale version is a conflict and nothing changes', async () => {
    let v = await individual()
    v = await addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!, M[3]!])
    const other = await swapClub(v.id, v.version, 1, M[3]!, M[5]!)
    expect(await code(deleteClubGame(v.id, v.version, 1))).toBe(CLUB_ERRORS.conflict)
    expect(await code(addClubGame(v.id, v.version, [M[0]!, M[1]!], [M[2]!, M[4]!]))).toBe(CLUB_ERRORS.conflict)
    expect((await getClubMatchView(v.id)).version).toBe(other.version)
  })
})

describe('club match edit API contract (api mode, B13)', () => {
  type Call = { method: string; path: string; body: unknown }
  let calls: Call[] = []
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('../../lib/data/source', async (orig) => ({ ...(await orig<typeof import('../../lib/data/source')>()), featureSource: () => 'api' }))
    calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ method: init.method ?? 'GET', path: String(url).replace(/^https?:\/\/[^/]+/, ''), body: init.body ? JSON.parse(String(init.body)) : undefined })
        return new Response(JSON.stringify({ id: 'x', version: 8, games: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../../lib/data/source')
  })

  it('[AC-140, AC-143] edit requests use the server paths, methods and bodies with the seen version', async () => {
    const a = await import('./api')
    await a.addClubGame('m1', 3, ['member:a', 'member:b'], ['member:c', 'member:d'])
    await a.deleteClubGame('m1', 3, 2)
    await a.discardClubGames('m1', 3)
    await a.exchangeClubGame('m1', 3, 1, 'member:a', 'member:d')
    await a.generateClub('m1', 3, { totalGames: 6, rules: RULES }, true)
    await a.generateClub('m1', 3, { totalGames: 6, rules: RULES })
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/club-matches/m1/games/manual',
      'DELETE /api/club-matches/m1/games/2?version=3',
      'DELETE /api/club-matches/m1/games?version=3',
      'POST /api/club-matches/m1/games/1/exchange',
      'POST /api/club-matches/m1/games',
      'POST /api/club-matches/m1/games',
    ])
    expect(calls.map((c) => c.body)).toEqual([
      { team1: ['member:a', 'member:b'], team2: ['member:c', 'member:d'], version: 3 },
      undefined,
      undefined,
      { out: 'member:a', in: 'member:d', version: 3 },
      { version: 3, totalGames: 6, rules: RULES, discard: true },
      { version: 3, totalGames: 6, rules: RULES },
    ])
  })
})
