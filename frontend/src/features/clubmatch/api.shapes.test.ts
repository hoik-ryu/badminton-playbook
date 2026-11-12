import fs from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '../../lib/api'
import { readDb, updateDb, type MockClubGame } from '../../lib/mock/db'
import type { MyRecord } from '../me/api'
import type { MemberStatus } from '../roster/api'
import { CLUB_ERRORS, confirmClub, createClubMatch, excludeWithSubstitutes, finishClub, generateClub, getClubMatchView, recordResult, setParticipating, swapClub, type ClubMatchListItem, type ClubMatchView, type GameView, type ParticipantRow, type Person, type Relaxation } from './api'
import type { MemberGame, MemberPlayer, MemberStanding, PublicClubMatch, PublicClubMatchItem } from './memberApi'

// I3-d4 계약: 실제 서버 응답의 키 구조(백엔드 test_clubmatch_api_contract.py가 만든 골든)를 FE 타입과 대조합니다.
// spec<T>()는 T의 키를 빠짐없이·더하지 않고 적어야 컴파일됩니다(타입이 바뀌면 여기서 먼저 깨짐) → 실행 시 골든과 같아야 함.
const golden = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../backend/tests/golden/clubmatch_api_shapes.json'), 'utf8')) as {
  responses: Record<string, unknown>
  errors: Record<string, { status: number; details: unknown }>
}

type Spec = true | readonly [Spec] | { readonly [k: string]: Spec }
const spec = <T,>(s: { [K in keyof Required<T>]: Spec }) => s
const list = (s: Spec) => [s] as const

const person = spec<Person>({ key: true, id: true, kind: true, name: true, gender: true, grade: true, score: true })
const relaxation = spec<Relaxation>({ rule: true, reason: true })
const game = spec<GameView>({ no: true, team1: list(person), team2: list(person), winner: true, gap: true, genderRelaxed: true, repeatedMatchup: true, relaxations: list(relaxation), manual: true, changed: true, resultChanged: true })
const row = spec<ParticipantRow>({ ...person, participating: true, team: true, games: true, left: true, inUnrecorded: true, available: true })
const teamWins = { blue: true, white: true } as const
const view = spec<ClubMatchView>({
  id: true,
  name: true,
  date: true,
  method: true,
  status: true,
  version: true,
  totalGames: true,
  rules: spec<ClubMatchView['rules']>({ balance: true, gender: true }),
  teamProposed: true,
  modifiedAt: true,
  resultModifiedAt: true,
  rows: list(row),
  summary: spec<ClubMatchView['summary']>({ count: true, male: true, female: true, blue: { n: true, male: true }, white: { n: true, male: true }, unscored: list(person) }),
  preview: spec<ClubMatchView['preview']>({ groups: list({ games: true, people: true }), even: true, proposals: list({ totalGames: true, each: teamWins }) }),
  games: list(game),
  standings: list(spec<ClubMatchView['standings'][number]>({ key: true, name: true, guest: true, wins: true, games: true, rank: true, tied: true })),
  team: teamWins,
  unrecorded: true,
})
const listItem = spec<ClubMatchListItem>({ id: true, name: true, date: true, method: true, status: true, unrecorded: true, team: teamWins, winnerText: true })
const memberPlayer = spec<MemberPlayer>({ key: true, name: true, guest: true, me: true })
const memberGame = spec<MemberGame>({ no: true, team1: list(memberPlayer), team2: list(memberPlayer), winner: true, changed: true, resultChanged: true, mySide: true })
const memberStanding = spec<MemberStanding>({ key: true, name: true, guest: true, me: true, wins: true, games: true, rank: true, tied: true })
const publicMatch = spec<PublicClubMatch>({ id: true, name: true, date: true, method: true, status: true, modifiedAt: true, resultModifiedAt: true, games: list(memberGame), standings: list(memberStanding), team: teamWins, unrecorded: true, participating: true })
const publicItem = spec<PublicClubMatchItem>({ id: true, name: true, date: true, method: true, status: true, team: teamWins, games: true, participants: true, unrecorded: true, resultText: true })
const myRecord = spec<MyRecord>({ rank: true, gamesToRank: true, games: true, wins: true, losses: true, rate: true })
const memberStatus = spec<MemberStatus>({ referrer: true, rank: true, gamesToRank: true, record: { games: true, wins: true, losses: true }, tutorial: { beginner: true, novice: true, total: true }, recommended: true })

/** 골든과 같은 형식(키 정렬)으로 */
function norm(s: Spec): unknown {
  if (s === true) return true
  if (Array.isArray(s)) return [norm(s[0] as Spec)]
  return Object.fromEntries(Object.keys(s).sort().map((k) => [k, norm((s as Record<string, Spec>)[k]!)]))
}

describe('club match API shapes: server responses ↔ FE types (I3-d4)', () => {
  it.each([
    ['ClubMatchView', view],
    ['ClubMatchListItem[]', [listItem] as const],
    ['PublicClubMatch', publicMatch],
    ['PublicClubMatchItem[]', [publicItem] as const],
    ['MyRecord', myRecord],
    ['MemberStatus', memberStatus],
  ] as const)('%s keys are exactly the FE type keys', (name, s) => {
    expect(golden.responses[name]).toEqual(norm(s as Spec))
  })

  it('every server error code the screens branch on is known to the FE', () => {
    const known = new Set<string>([...Object.values(CLUB_ERRORS), 'not_found', 'club_match_not_found', 'unauthenticated', 'forbidden', 'csrf_origin_mismatch'])
    for (const code of Object.keys(golden.errors)) expect(known, code).toContain(code)
    expect(golden.errors.unauthenticated!.status).toBe(401)
    expect(golden.errors.forbidden!.status).toBe(403)
    expect(golden.errors.csrf_origin_mismatch!.status).toBe(403)
  })
})

// Mock 오류(같은 코드)의 상태·details 키가 서버와 같은지 — 화면은 출처를 모르고 같은 분기를 씀
describe('Mock error details follow the server contract', () => {
  beforeEach(() => window.localStorage.clear())

  const caught = async (p: Promise<unknown>) => {
    try {
      await p
    } catch (e) {
      if (isApiError(e)) return e
    }
    throw new Error('expected ApiError')
  }
  const keysOf = (d: unknown) => (d && typeof d === 'object' ? Object.keys(d).sort() : [])
  const goldenKeys = (code: string) => keysOf(golden.errors[code]!.details)
  function crafted(people: string[], games: number[][]) {
    readDb()
    const id = `cm-s${Math.random().toString(36).slice(2, 8)}`
    updateDb((db) => {
      db.clubMatches ??= []
      const g: MockClubGame[] = games.map((f, i) => ({ no: i + 1, team1: [people[f[0]!]!, people[f[1]!]!], team2: [people[f[2]!]!, people[f[3]!]!], winner: null, genderRelaxed: false }))
      db.clubMatches.push({ id, name: '계약', date: '2026-11-20', method: 'individual', status: 'confirmed', participants: Object.fromEntries(people.map((k) => [k, { team: null, left: false }])), totalGames: games.length, rules: { balance: true, gender: false }, games: g, seed: 1, teamProposed: false, modifiedAt: null, resultModifiedAt: null, version: 1 })
    })
    return id
  }
  const P = ['m-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-8'].map((x) => `member:${x}`)

  it('status and details keys match the golden for each code', async () => {
    const check = (e: { status: number; code: string; details?: unknown }) => {
      expect(e.status, e.code).toBe(golden.errors[e.code]!.status)
      for (const k of keysOf(e.details)) expect(goldenKeys(e.code), `${e.code}.${k}`).toContain(k)
    }
    const empty = await createClubMatch({ method: 'individual', date: '2026-11-20', name: '빈' })
    check(await caught(confirmClub(empty, 1))) // no_games
    check(await caught(confirmClub(empty, 9))) // conflict {version}
    let v = await setParticipating(empty, 1, 'member:m-4', true) // 점수 미설정
    check(await caught(generateClub(empty, v.version))) // unscored_players {keys}
    v = await setParticipating(empty, v.version, 'member:m-4', false)
    v = await setParticipating(empty, v.version, 'member:m-1', true)
    check(await caught(generateClub(empty, v.version))) // min_players {...}
    check(await caught(setParticipating(empty, v.version, 'member:u-inactive', true))) // not_eligible
    const a = crafted(P, [[0, 1, 2, 3], [0, 1, 2, 4]])
    check(await caught(swapClub(a, 1, 2, P[4]!, P[3]!))) // same_matchup {games, with}
    check(await caught(excludeWithSubstitutes(a, 1, P[4]!, [{ gameNo: 2, to: P[3]! }]))) // same_matchup {games}
    check(await caught(excludeWithSubstitutes(a, 1, P[4]!, []))) // conflict {version, games}
    check(await caught(finishClub(a, 1))) // not_all_recorded {remaining}
    const n = crafted(P.slice(0, 4), [[0, 1, 2, 3], [0, 1, 2, 3]])
    const w = await recordResult(n, 1, 1, 1)
    check(await caught(excludeWithSubstitutes(n, w.version, P[3]!, [{ gameNo: 2, to: P[0]! }]))) // no_substitute {games}
    check(await caught(getClubMatchView('nope'))) // not_found
  })
})
