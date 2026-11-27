import { beforeEach, describe, expect, it } from 'vitest'
import { readDb, updateDb, type MockClubGame } from '../../lib/mock/db'
import { addClubGame, CLUB_ERRORS, confirmClub, createClubMatch, deleteClubGame, excludeWithSubstitutes, finishClub, generateClub, getClubMatchView, moveClubGame, nextRound, recordResult, saveBasic, saveParticipants, setSettings, swapClub, undoRound, type ClubMatchView } from './api'
import * as clubApi from './api'
import { getPublicClubMatch } from './memberApi'

// (B15, C-36–C-38) 라운드·코트 운영: Mock 어댑터가 서버(backend tests/modules/test_clubmatch_rounds.py)와
// 같은 규칙·오류 코드인지 확인합니다. 생성 엔진의 FE·BE 일치는 rounds.golden.test.ts(골든)가 맡습니다.
const RULES = { balance: true, gender: true }
// 점수·성별 있는 승인 회원(Mock 샘플)
const P = ['u-member', 'u-admin', 'u-super', 'm-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-8', 'm-10'].map((x) => `member:${x}`)
const failure = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e as { code: string; status: number; details: Record<string, unknown> }
  }
  return { code: 'ok', status: 200, details: {} }
}
const code = async (p: Promise<unknown>) => (await failure(p)).code
const keysOf = (g: ClubMatchView['games'][number]) => [...g.team1, ...g.team2].map((p) => p.key)
const layout = (v: ClubMatchView) => v.games.map((g) => `${g.no}:${g.round}-${g.court}`)

async function roundMatch(people = P.slice(0, 9), courtCount = 2) {
  const id = await createClubMatch({ method: 'individual', date: '2026-11-15', name: '라운드전', courtCount })
  return saveParticipants(id, 1, people)
}

/** 확정된 라운드 청백전을 직접 만듦(경기: [라운드, 코트, 네 명 번호]) */
function crafted(games: [number, number, number[]][], opts: { people?: string[]; status?: 'draft' | 'confirmed'; courtCount?: number; currentRound?: number } = {}) {
  readDb()
  const people = opts.people ?? P.slice(0, 8)
  const id = `cm-r${Math.random().toString(36).slice(2, 8)}`
  updateDb((db) => {
    db.clubMatches ??= []
    const list: MockClubGame[] = games.map(([round, court, f], i) => ({ no: i + 1, round, court, team1: [people[f[0]!]!, people[f[1]!]!], team2: [people[f[2]!]!, people[f[3]!]!], winner: null, genderRelaxed: false }))
    const status = opts.status ?? 'confirmed'
    db.clubMatches.push({ id, name: '라운드', date: '2026-11-15', method: 'individual', status, participants: Object.fromEntries(people.map((k) => [k, { team: null, left: false }])), totalGames: list.length, rules: { balance: true, gender: false }, games: list, seed: 1, teamProposed: false, modifiedAt: null, resultModifiedAt: null, version: 1, courtCount: opts.courtCount ?? 2, plannedRounds: null, currentRound: status === 'confirmed' ? (opts.currentRound ?? 1) : null })
  })
  return id
}

describe('club match rounds mock adapter (B15)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    readDb()
  })

  it('[AC-144, AC-145] court count makes a round match; preview shows per-round games, default rounds and resting', async () => {
    const v = await roundMatch()
    expect(v.courtCount).toBe(2)
    expect(v.plannedRounds).toBeNull()
    expect(v.preview.rounds).toMatchObject({ perRound: 2, defaultRounds: 5, games: 10, playing: { all: 8 }, resting: { all: 1 } })
    const s = await setSettings(v.id, v.version, { rounds: 3, rules: RULES })
    expect(s.plannedRounds).toBe(3)
    expect(s.preview.rounds).toMatchObject({ games: 6 })
    // 같은 값은 무변경(version 그대로)
    expect((await setSettings(v.id, s.version, { rounds: 3, rules: RULES })).version).toBe(s.version)
    expect(await code(setSettings(v.id, s.version, { rounds: 0, rules: RULES }))).toBe('validation_error')
  })

  it('[AC-146, AC-147] generation fills each round up to the court count without anyone playing twice in a round', async () => {
    const v = await roundMatch()
    const g = await generateClub(v.id, v.version, { rounds: 4, rules: RULES })
    expect(g.games).toHaveLength(8)
    expect(g.plannedRounds).toBe(4)
    expect(g.totalGames).toBe(8)
    expect(g.roundCount).toBe(4)
    expect(layout(g)).toEqual(['1:1-1', '2:1-2', '3:2-1', '4:2-2', '5:3-1', '6:3-2', '7:4-1', '8:4-2'])
    for (let rd = 1; rd <= 4; rd++) {
      const keys = g.games.filter((x) => x.round === rd).flatMap(keysOf)
      expect(new Set(keys).size).toBe(keys.length)
    }
    expect(await code(generateClub(v.id, g.version, { rounds: 101, rules: RULES }))).toBe(CLUB_ERRORS.invalidRound) // 최대 ⌊200/2⌋
  })

  it('[AC-149, AC-150] manual add needs an existing round with a free court or the next round, and no one twice in a round', async () => {
    const id = crafted([[1, 1, [0, 1, 2, 3]]], { status: 'draft' })
    const add = (round: number | undefined, f: number[]) => addClubGame(id, 1, [P[f[0]!]!, P[f[1]!]!], [P[f[2]!]!, P[f[3]!]!], round)
    expect(await code(add(undefined, [4, 5, 6, 7]))).toBe(CLUB_ERRORS.invalidRound)
    expect(await code(add(3, [4, 5, 6, 7]))).toBe(CLUB_ERRORS.invalidRound)
    const busy = await failure(add(1, [0, 5, 6, 7]))
    expect(busy).toMatchObject({ code: CLUB_ERRORS.roundConflict, status: 422, details: { keys: [P[0]], round: 1 } })
    const v = await add(1, [4, 5, 6, 7])
    expect(layout(v)).toEqual(['1:1-1', '2:1-2'])
    expect(await code(addClubGame(id, v.version, [P[0]!, P[1]!], [P[4]!, P[5]!], 1))).toBe(CLUB_ERRORS.courtFull)
    const next = await addClubGame(id, v.version, [P[0]!, P[1]!], [P[4]!, P[5]!], 2)
    expect(layout(next)).toEqual(['1:1-1', '2:1-2', '3:2-1'])
  })

  it('[AC-152, AC-138] move checks free court and round conflicts; delete and move close gaps and drop empty rounds', async () => {
    const id = crafted([[1, 1, [0, 1, 2, 3]], [1, 2, [4, 5, 6, 7]], [2, 1, [0, 4, 1, 5]], [3, 1, [2, 6, 3, 7]]], { status: 'draft' })
    expect(await code(moveClubGame(id, 1, 4, 1))).toBe(CLUB_ERRORS.courtFull)
    expect(await code(moveClubGame(id, 1, 4, 4))).toBe(CLUB_ERRORS.invalidRound)
    const d = await deleteClubGame(id, 1, 2) // 1라운드 2코트 삭제 → 번호 당김
    expect(layout(d)).toEqual(['1:1-1', '2:2-1', '3:3-1'])
    expect(await code(moveClubGame(id, d.version, 2, 1))).toBe(CLUB_ERRORS.roundConflict) // 0·1번이 1라운드에 있음
    const m = await moveClubGame(id, d.version, 3, 2) // 3라운드 경기를 2라운드로 → 3라운드 삭제
    expect(layout(m)).toEqual(['1:1-1', '2:2-1', '3:2-2'])
    expect(m.roundCount).toBe(2)
    expect(m.games[2]!.manual).toBe(true)
  })

  it('[AC-153, AC-155, AC-156, AC-157] rounds advance only by hand after every game is processed; undo only before any result', async () => {
    const id = crafted([[1, 1, [0, 1, 2, 3]], [1, 2, [4, 5, 6, 7]], [2, 1, [0, 4, 1, 5]]], { status: 'draft' })
    let v = await confirmClub(id, 1)
    expect(v.currentRound).toBe(1)
    expect(await failure(recordResult(id, v.version, 3, 1))).toMatchObject({ code: CLUB_ERRORS.roundNotStarted, status: 409, details: { round: 2, currentRound: 1 } })
    expect(await failure(nextRound(id, v.version))).toMatchObject({ code: CLUB_ERRORS.roundIncomplete, details: { games: [1, 2], currentRound: 1 } })
    expect(await code(undoRound(id, v.version))).toBe(CLUB_ERRORS.invalidRound)
    v = await recordResult(id, v.version, 1, 1)
    v = await recordResult(id, v.version, 2, 2)
    expect(v.currentRound).toBe(1) // 자동으로 넘어가지 않음
    expect(await failure(finishClub(id, v.version))).toMatchObject({ code: CLUB_ERRORS.notRecorded, details: { currentRound: 1, lastRound: 2 } })
    v = await nextRound(id, v.version)
    expect(v.currentRound).toBe(2)
    expect(await code(nextRound(id, v.version))).toBe(CLUB_ERRORS.invalidRound) // 마지막 라운드
    expect(await code(recordResult(id, v.version, 1, null))).toBe(CLUB_ERRORS.roundLocked)
    expect((await recordResult(id, v.version, 1, 2)).games[0]!.winner).toBe(2) // 지난 라운드는 수정만
    v = await getClubMatchView(id)
    v = await undoRound(id, v.version)
    expect(v.currentRound).toBe(1)
    v = await nextRound(id, v.version)
    v = await recordResult(id, v.version, 3, 1)
    expect(await code(undoRound(id, v.version))).toBe(CLUB_ERRORS.roundHasResults)
    expect((await finishClub(id, v.version)).status).toBe('finished')
  })

  it('[AC-150, AC-158] swap after confirm rejects someone already playing in the same round', async () => {
    const id = crafted([[1, 1, [0, 1, 2, 3]], [1, 2, [4, 5, 6, 7]], [2, 1, [0, 4, 1, 5]]])
    expect(await failure(swapClub(id, 1, 1, P[1]!, P[4]!))).toMatchObject({ code: CLUB_ERRORS.roundConflict, status: 422, details: { keys: [P[4]], round: 1 } })
    const v = await swapClub(id, 1, 3, P[1]!, P[2]!)
    expect(keysOf(v.games[2]!)).toContain(P[2])
  })

  it('[AC-159, AC-160, AC-161] leave cancels only games without substitutes; cancelled games leave counts and block results', async () => {
    const id = crafted([[1, 1, [0, 1, 2, 3]], [1, 2, [4, 5, 6, 7]], [2, 1, [0, 1, 2, 4]]])
    // 1번 경기: 1라운드에 남는 사람이 없음 → 취소 확인 필요
    expect(await failure(excludeWithSubstitutes(id, 1, P[0]!, [{ gameNo: 3, to: P[3]! }]))).toMatchObject({ code: CLUB_ERRORS.noSubstitute, details: { games: [1] } })
    expect(await failure(excludeWithSubstitutes(id, 1, P[0]!, [], [1, 3]))).toMatchObject({ code: CLUB_ERRORS.cancelNotAllowed, details: { games: [3] } })
    expect(await code(excludeWithSubstitutes(id, 1, P[0]!, [{ gameNo: 3, to: P[5]! }, { gameNo: 3, to: P[6]! }], [1]))).toBe(CLUB_ERRORS.conflict)
    let v = await excludeWithSubstitutes(id, 1, P[0]!, [{ gameNo: 3, to: P[3]! }], [1])
    expect(v.games[0]!.cancelled).toMatchObject({ reason: 'left' })
    expect(v.games[0]!.changed).toBe(true)
    expect(v.unrecorded).toBe(2)
    expect(v.rows.find((r) => r.key === P[1])!.games).toBe(1) // 취소 경기는 경기 수에서 빠짐
    expect(keysOf(v.games[2]!)).toContain(P[3])
    expect(await code(recordResult(id, v.version, 1, 1))).toBe(CLUB_ERRORS.gameCancelled)
    expect(await code(swapClub(id, v.version, 1, P[1]!, P[5]!))).toBe(CLUB_ERRORS.gameCancelled)
    v = await recordResult(id, v.version, 2, 1)
    v = await nextRound(id, v.version) // 취소 경기는 처리된 경기
    v = await recordResult(id, v.version, 3, 1)
    expect((await finishClub(id, v.version)).status).toBe('finished')
    expect(readDb().clubMatches!.find((m) => m.id === id)!.events).toEqual([expect.objectContaining({ gameNo: 1, action: 'cancel', reason: 'left' })])
  })

  it('[AC-159] the same person cannot fill two games of one round in one leave request', async () => {
    const id = crafted([[1, 1, [0, 1, 2, 3]], [1, 2, [0, 4, 5, 6]]], { courtCount: 2, people: P.slice(0, 8) })
    // 두 경기 모두 같은 라운드: 7번 한 사람을 두 번 넣으면 round_conflict
    expect(await code(excludeWithSubstitutes(id, 1, P[0]!, [{ gameNo: 1, to: P[7]! }, { gameNo: 2, to: P[7]! }]))).toBe(CLUB_ERRORS.roundConflict)
  })

  it('[AC-160] cancelled games cannot be restored: no restore API or restore error codes (B18)', () => {
    expect('restoreClubGame' in clubApi).toBe(false)
    expect(Object.values(CLUB_ERRORS)).not.toContain('restore_not_allowed')
    expect(Object.values(CLUB_ERRORS)).not.toContain('restore_blocked')
  })

  it('[AC-162] member view shows round, court and cancelled only, and skips cancelled games in counts', async () => {
    const id = crafted([[1, 1, [0, 1, 2, 3]], [1, 2, [4, 5, 6, 7]], [2, 1, [0, 1, 2, 4]]])
    await excludeWithSubstitutes(id, 1, P[0]!, [{ gameNo: 3, to: P[3]! }], [1])
    const m = await getPublicClubMatch(id, 'u-admin')
    expect(m.currentRound).toBe(1)
    expect(m.games.map((g) => [g.round, g.court, g.cancelled])).toEqual([[1, 1, true], [1, 2, false], [2, 1, false]])
    expect(m.unrecorded).toBe(2)
    expect(Object.keys(m.games[0]!).sort()).toEqual(['cancelled', 'changed', 'court', 'mySide', 'no', 'resultChanged', 'round', 'team1', 'team2', 'winner'])
  })

  it('[AC-163] matches without round info keep the old rules; a draft can become round-based by setting courts', async () => {
    const id = await createClubMatch({ method: 'individual', date: '2026-12-20', name: '기존' })
    let v = await saveParticipants(id, 1, P.slice(0, 8))
    expect(v.courtCount).toBeNull()
    expect(v.preview.rounds).toBeUndefined()
    v = await generateClub(id, v.version, { totalGames: 4, rules: RULES })
    expect(v.games.every((g) => g.round === null && g.court === null)).toBe(true)
    expect(await code(setSettings(id, v.version, { rounds: 3, rules: RULES }))).toBe('validation_error')
    expect(await code(saveBasic(id, v.version, { name: '기존', date: '2026-12-20', method: 'individual', courtCount: 2 }))).toBe(CLUB_ERRORS.confirmRequired)
    v = await saveBasic(id, v.version, { name: '기존', date: '2026-12-20', method: 'individual', courtCount: 2 }, true)
    expect(v.courtCount).toBe(2)
    expect(v.games).toHaveLength(0)
    expect(v.preview.rounds?.perRound).toBe(2)
    // 확정된 기존 청백전: 취소 없음
    const legacy = crafted([[1, 1, [0, 1, 2, 3]]], { courtCount: 2 })
    updateDb((db) => {
      const m = db.clubMatches!.find((x) => x.id === legacy)!
      m.courtCount = null
      m.games.forEach((g) => Object.assign(g, { round: null, court: null }))
    })
    expect(await code(excludeWithSubstitutes(legacy, 1, P[0]!, [], [1]))).toBe(CLUB_ERRORS.cancelNotAllowed)
  })
})
