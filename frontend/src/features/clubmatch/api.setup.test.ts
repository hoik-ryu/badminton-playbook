import { beforeEach, describe, expect, it } from 'vitest'
import { readDb, updateDb } from '../../lib/mock/db'
import { CLUB_ERRORS, confirmClub, createClubMatch, deleteClubMatch, generateClub, getClubMatchView, listClubMatches, saveBasic, saveParticipants, saveTeams, setParticipating, setSettings, type ClubMatchView } from './api'

// (B10) Mock 어댑터가 서버(backend test_clubmatch_setup.py)와 같은 규칙인지: 확인 필요·무변경·원자성·자격·미배정·삭제
// 화면은 출처를 모르고 같은 분기를 쓰므로 Mock 모드(VITE_DATA_SOURCE=mock)도 같은 결과여야 합니다.
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
const halves = (keys: string[]) => Object.fromEntries(keys.map((k, i) => [k, i % 2 ? 'white' : 'blue'] as const))
const participating = (v: ClubMatchView) => v.rows.filter((r) => r.participating)

async function teamReady() {
  const id = await createClubMatch({ method: 'team', date: '2026-12-13', name: '팀전' })
  let v = await saveParticipants(id, 1, M)
  v = await saveTeams(id, v.version, halves(M))
  v = await generateClub(id, v.version, { totalGames: 4, rules: RULES })
  return v
}

describe('club match setup mock adapter (B10)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    readDb()
  })

  it('[AC-123] name rule and name/date change keeps teams and games', async () => {
    expect(await code(createClubMatch({ method: 'team', date: '2026-12-13', name: '가'.repeat(31) }))).toBe('validation_error')
    const v = await teamReady()
    const after = await saveBasic(v.id, v.version, { name: '  새 이름  ', date: '2026-12-14', method: 'team' })
    expect([after.name, after.date, after.games.length, after.version]).toEqual(['새 이름', '2026-12-14', 4, v.version + 1])
    const same = await saveBasic(v.id, after.version, { name: '새 이름', date: '2026-12-14', method: 'team' })
    expect(same.version).toBe(after.version)
  })

  it('[AC-070, AC-132] method change needs confirm, then discards games and teams', async () => {
    const v = await teamReady()
    expect(await code(saveBasic(v.id, v.version, { name: v.name, date: v.date, method: 'individual' }))).toBe(CLUB_ERRORS.confirmRequired)
    expect((await getClubMatchView(v.id)).version).toBe(v.version)
    const after = await saveBasic(v.id, v.version, { name: v.name, date: v.date, method: 'individual' }, true)
    expect([after.method, after.games.length, participating(after).every((r) => r.team === null), participating(after).length]).toEqual(['individual', 0, true, 6])
  })

  it('[AC-125, AC-128] participants replace keeps remaining teams, adds unassigned, unchanged list is a no-op', async () => {
    const id = await createClubMatch({ method: 'team', date: '2026-12-13', name: '팀전' })
    let v = await saveParticipants(id, 1, M.slice(0, 4))
    v = await saveTeams(id, v.version, halves(M.slice(0, 4)))
    v = await saveParticipants(id, v.version, [M[0]!, M[2]!, M[3]!, M[5]!, M[4]!])
    const team = Object.fromEntries(participating(v).map((r) => [r.key, r.team]))
    expect(team).toEqual({ [M[0]!]: 'blue', [M[2]!]: 'blue', [M[3]!]: 'white', [M[5]!]: null, [M[4]!]: null })
    const same = await saveParticipants(id, v.version, [M[4]!, M[0]!, M[2]!, M[3]!, M[5]!])
    expect(same.version).toBe(v.version)
  })

  it('[AC-124] ineligible people are rejected with their keys and nothing changes', async () => {
    const id = await createClubMatch({ method: 'individual', date: '2026-12-13', name: '개인전' })
    const e = (await saveParticipants(id, 1, [...M.slice(0, 3), 'member:u-inactive']).catch((x: unknown) => x)) as { code: string; details: { keys: string[] } }
    expect([e.code, e.details.keys]).toEqual([CLUB_ERRORS.notEligible, ['member:u-inactive']])
    expect(participating(await getClubMatchView(id))).toEqual([])
  })

  it('[AC-127, AC-135] teams replace validates unassigned, strangers and two per team; same assignment is a no-op', async () => {
    const id = await createClubMatch({ method: 'team', date: '2026-12-13', name: '팀전' })
    const v = await saveParticipants(id, 1, M)
    expect(await code(saveTeams(id, v.version, halves(M.slice(0, 5))))).toBe(CLUB_ERRORS.unassigned)
    expect(await code(saveTeams(id, v.version, { ...halves(M), 'member:m-9': 'blue' }))).toBe(CLUB_ERRORS.notParticipant)
    expect(await code(saveTeams(id, v.version, Object.fromEntries(M.map((k, i) => [k, i ? 'blue' : 'white'] as const))))).toBe(CLUB_ERRORS.minPlayers)
    const saved = await saveTeams(id, v.version, halves(M))
    expect((await saveTeams(id, saved.version, halves(M))).version).toBe(saved.version)
  })

  it('[AC-132] settings, participants and teams changes with games need confirm; same settings keep games', async () => {
    const v = await teamReady()
    expect((await setSettings(v.id, v.version, { totalGames: 4, rules: RULES })).games.length).toBe(4)
    expect(await code(setSettings(v.id, v.version, { totalGames: 6, rules: RULES }))).toBe(CLUB_ERRORS.confirmRequired)
    expect(await code(saveParticipants(v.id, v.version, M.slice(0, 5)))).toBe(CLUB_ERRORS.confirmRequired)
    expect(await code(saveTeams(v.id, v.version, { ...halves(M), [M[0]!]: 'white', [M[1]!]: 'blue' }))).toBe(CLUB_ERRORS.confirmRequired)
    expect(await code(setParticipating(v.id, v.version, M[0]!, false))).toBe(CLUB_ERRORS.confirmRequired)
    expect((await getClubMatchView(v.id)).games.length).toBe(4)
    const after = await setSettings(v.id, v.version, { totalGames: 6, rules: RULES }, true)
    expect([after.totalGames, after.games.length]).toEqual([6, 0])
  })

  it('[AC-071, AC-128] generate checks unscored then unassigned, and a failed request saves no settings', async () => {
    const id = await createClubMatch({ method: 'team', date: '2026-12-13', name: '팀전' })
    let v = await saveParticipants(id, 1, M.slice(0, 4))
    v = await saveTeams(id, v.version, halves(M.slice(0, 4)))
    v = await saveParticipants(id, v.version, M)
    expect(await code(generateClub(id, v.version, { totalGames: 9, rules: RULES }))).toBe(CLUB_ERRORS.unassigned)
    expect((await getClubMatchView(id)).totalGames).toBe(8)
    const solo = await createClubMatch({ method: 'individual', date: '2026-12-13', name: '개인전' })
    const s = await saveParticipants(solo, 1, [...M.slice(0, 3), 'member:m-4'])
    expect(await code(generateClub(solo, s.version, { totalGames: 4, rules: RULES }))).toBe(CLUB_ERRORS.unscored)
  })

  it('[AC-130] confirm revalidates unassigned on the server side', async () => {
    const v = await teamReady()
    updateDb((db) => {
      db.clubMatches!.find((m) => m.id === v.id)!.participants[M[0]!]!.team = null
    })
    expect(await code(confirmClub(v.id, v.version))).toBe(CLUB_ERRORS.unassigned)
  })

  it('[AC-134] draft delete removes it; confirmed ones are locked; stale version conflicts', async () => {
    const v = await teamReady()
    expect(await code(deleteClubMatch(v.id, v.version - 1))).toBe(CLUB_ERRORS.conflict)
    await deleteClubMatch(v.id, v.version)
    expect((await listClubMatches()).some((x) => x.id === v.id)).toBe(false)
    expect(await code(deleteClubMatch(v.id, v.version))).toBe('not_found')
    const w = await teamReady()
    const done = await confirmClub(w.id, w.version)
    expect(await code(deleteClubMatch(w.id, done.version))).toBe(CLUB_ERRORS.locked)
  })

  it('[AC-133] a rejected save changes nothing (atomic) and a repeated save does not double apply', async () => {
    const v = await teamReady()
    const before = JSON.stringify(readDb().clubMatches!.find((m) => m.id === v.id))
    expect(await code(saveParticipants(v.id, v.version, [...M, 'member:u-inactive'], true))).toBe(CLUB_ERRORS.notEligible)
    expect(JSON.stringify(readDb().clubMatches!.find((m) => m.id === v.id))).toBe(before)
    const after = await saveParticipants(v.id, v.version, M.slice(0, 5), true)
    expect(await code(saveParticipants(v.id, v.version, M.slice(0, 5), true))).toBe(CLUB_ERRORS.conflict)
    expect(participating(await getClubMatchView(v.id)).length).toBe(5)
    expect((await saveParticipants(v.id, after.version, M.slice(0, 5))).version).toBe(after.version)
  })
})

describe('save failure policy (B10, AC-133)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    readDb()
  })

  it('[AC-133] lost response is treated as applied; another admin change is a conflict; other errors retry', async () => {
    const { settleSaveFailure } = await import('./api')
    const v = await teamReady()
    const first = await saveParticipants(v.id, v.version, M.slice(0, 5), true)
    const lost = await saveParticipants(v.id, v.version, M.slice(0, 5), true).catch((e: unknown) => e)
    const same = (x: ClubMatchView) => participating(x).length === 5
    expect(await settleSaveFailure(v.id, lost, same)).toMatchObject({ kind: 'applied', view: { version: first.version } })
    await saveParticipants(v.id, first.version, M) // 다른 운영진이 먼저 바꿈
    const stale = await saveParticipants(v.id, first.version, M.slice(0, 4)).catch((e: unknown) => e)
    expect((await settleSaveFailure(v.id, stale, (x) => participating(x).length === 4)).kind).toBe('conflict')
    expect((await settleSaveFailure(v.id, new Error('network'), same)).kind).toBe('retry')
  })
})
