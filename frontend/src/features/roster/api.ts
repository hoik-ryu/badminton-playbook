import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { newMockMember, readDb, updateDb, type GuestInvolvement, type MockGuest, type MockUser } from '../../lib/mock/db'
import type { Gender, Grade } from '../auth/types'
import { clubRecordOf, guestClubInvolvement, removeGuestFromClubMatches } from '../clubmatch/api'
import { rankFor } from '../me/rank'
import { passedCountsOf } from '../tutorial/api'
import { discardGuestFromSessions, guestSessionInvolvement } from '../session/api'

const dataSource = featureSource('roster') // api 모드: backend/app/modules/roster(I1)

// 명단·점수(SCR-211–214, FLOW-003, AC-010·012–016·097–100·105–107). 운영진 이상만(서버가 최종 검사, NFR-005).
// 회원과 게스트는 따로 다룹니다(게스트는 카카오 계정·가입 레코드 없음).
export type PersonKind = 'member' | 'guest'

export type RosterPerson = {
  id: string
  kind: PersonKind
  name: string
  gender: Gender
  grade: Grade
  score: number | null
  /** 튜토리얼 권장 대상(C-23: 점수 3 이하 또는 미설정인 승인 회원) 중 서버 판정 '미통과' — 회원만. 실제 API는 기준 보류(D3)로 항상 false */
  tutorialRecommendedUnpassed: boolean
  /** 동시 수정 감지 토큰(서버가 줌, Mock은 없음). 저장할 때 그대로 돌려보냄 */
  version?: string
}

export type Roster = { members: RosterPerson[]; guests: RosterPerson[] }

/** 회원 현황(SCR-212 CMP-045 audience=ops) */
export type MemberStatus = {
  referrer: string | null
  rank: 'S' | 'A' | 'B' | 'C' | null
  gamesToRank: number | null
  record: { games: number; wins: number; losses: number }
  tutorial: { beginner: number; novice: number; total: number }
  recommended: boolean
}

export type GuestDeleteInfo = GuestInvolvement

export type PersonInput = { name: string; gender: Gender; grade: Grade; score: number | null }

/** 서버 거부 코드 */
export const INVALID_SCORE = 'invalid_score'
export const GUEST_DELETE_BLOCKED = 'guest_delete_blocked'
/** 그사이 다른 운영진(또는 회원 본인)이 먼저 바꿈(409) */
export const ROSTER_CONFLICT = 'conflict'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ko')
const isRecommended = (u: MockUser) => u.status === 'approved' && (u.score === null || u.score <= 3)
const memberRow = (u: MockUser): RosterPerson => ({ id: u.id, kind: 'member', name: u.name, gender: u.gender, grade: u.grade, score: u.score, tutorialRecommendedUnpassed: isRecommended(u) && u.tutorialUnpassed })
const guestRow = (g: MockGuest): RosterPerson => ({ id: g.id, kind: 'guest', name: g.name, gender: g.gender, grade: g.grade, score: g.score, tutorialRecommendedUnpassed: false })

const checkScore = (score: number | null) => {
  if (score !== null && !(Number.isInteger(score) && score >= 1 && score <= 10)) throw new ApiError(422, { code: INVALID_SCORE, message: '점수는 1–10 중에서 골라 주세요' })
}

/** 명단: 승인된 회원(이름순) + 게스트(이름순). 비활성 회원은 US-020(후순위)에서 '비활성 포함'과 함께 다룸 */
export async function listRoster(): Promise<Roster> {
  if (dataSource === 'api') return api.get<Roster>('/api/roster')
  const db = readDb()
  return mockDelay({
    members: db.users.filter((u) => u.status === 'approved').map(memberRow).sort(byName),
    guests: db.guests.map(guestRow).sort(byName),
  })
}

export async function getMemberStatus(id: string): Promise<MemberStatus> {
  if (dataSource === 'api') return api.get<MemberStatus>(`/api/roster/members/${encodeURIComponent(id)}/status`)
  const u = readDb().users.find((x) => x.id === id)
  if (!u) throw new ApiError(404, { code: 'not_found', message: '회원을 찾을 수 없습니다' })
  // 랭크(C-07·C-17): 샘플 기본 전적 + 청백전 기록. 최소 10경기, 승률 70/55/40% → S/A/B/C
  const db = readDb()
  const club = clubRecordOf(db, id)
  const wins = u.record.wins + club.wins
  const games = u.record.games + club.wins + club.losses
  const { rank, gamesToRank } = rankFor(games, wins)
  return mockDelay({ referrer: u.referrer, rank, gamesToRank, record: { games, wins, losses: games - wins }, tutorial: { ...passedCountsOf(db, id), total: 3 }, recommended: isRecommended(u) }, 300)
}

export async function getGuestDeleteInfo(id: string): Promise<GuestDeleteInfo> {
  if (dataSource === 'api') return api.get<GuestDeleteInfo>(`/api/roster/guests/${encodeURIComponent(id)}/delete-info`)
  const db = readDb()
  const g = db.guests.find((x) => x.id === id)
  if (!g) throw new ApiError(404, { code: 'not_found', message: '게스트를 찾을 수 없습니다' })
  // 실시간 대진(B3)·청백전(B4) 데이터로 판정(C-26)
  return mockDelay(guestSessionInvolvement(db, id) ?? guestClubInvolvement(db, id) ?? { kind: 'none' }, 0)
}

/** 저장(SCR-212): 이름·성별·급수·점수. version은 목록에서 받은 값(그사이 바뀌었으면 409 conflict) */
export async function updatePerson(kind: PersonKind, id: string, input: PersonInput, version?: string): Promise<void> {
  if (dataSource === 'api') {
    await api.put(`/api/roster/${kind}s/${encodeURIComponent(id)}`, { ...input, version })
    return
  }
  await mockDelay(null, 400)
  checkScore(input.score)
  updateDb((db) => {
    const target = kind === 'member' ? db.users.find((u) => u.id === id) : db.guests.find((g) => g.id === id)
    if (!target) throw new ApiError(404, { code: 'not_found', message: '이미 삭제되었거나 찾을 수 없습니다' })
    Object.assign(target, { name: input.name.trim(), gender: input.gender, grade: input.grade, score: input.score })
  })
}

/** 점수만 즉시 저장(SCR-214). previous = 화면이 알던 이전 점수(그사이 바뀌었으면 409 conflict) */
export async function setScore(kind: PersonKind, id: string, score: number, previous: number | null = null): Promise<void> {
  if (dataSource === 'api') {
    await api.put(`/api/roster/${kind}s/${encodeURIComponent(id)}/score`, { score, previous })
    return
  }
  return setMockScore(kind, id, score)
}

/**
 * 아직 Mock인 기능(오늘 운동, I4 전)의 참석자 점수와 Mock 모드의 점수는 Mock 저장소에 저장.
 * 그 화면의 사람은 Mock 샘플이라 실제 명단 API로 보내면 찾을 수 없음 — 해당 배치를 DB로 옮기면 setScore로 바꿈
 */
export async function setMockScore(kind: PersonKind, id: string, score: number): Promise<void> {
  await mockDelay(null, 300)
  checkScore(score)
  updateDb((db) => {
    const target = kind === 'member' ? db.users.find((u) => u.id === id) : db.guests.find((g) => g.id === id)
    if (!target) throw new ApiError(404, { code: 'not_found', message: '찾을 수 없습니다' })
    target.score = score
  })
}

/** 게스트 추가(SCR-213-ST1, AC-012) */
export async function addGuest(input: PersonInput): Promise<RosterPerson> {
  if (dataSource === 'api') return api.post<RosterPerson>('/api/roster/guests', input)
  await mockDelay(null, 400)
  checkScore(input.score)
  const g: MockGuest = { id: `g-${Date.now().toString(36)}`, name: input.name.trim(), gender: input.gender, grade: input.grade, score: input.score, involvement: { kind: 'none' } }
  updateDb((db) => void db.guests.push(g))
  return guestRow(g)
}

/** 회원 직접 추가(SCR-213-ST7, AC-010, UXD-014): 카카오 없이 승인된 회원으로 등록 */
export async function addMember(input: PersonInput & { referrer?: string }): Promise<RosterPerson> {
  if (dataSource === 'api') return api.post<RosterPerson>('/api/roster/members', input)
  await mockDelay(null, 400)
  checkScore(input.score)
  const m = newMockMember({ kakaoId: null, name: input.name.trim(), gender: input.gender, grade: input.grade, referrer: input.referrer?.trim() || null, status: 'approved', score: input.score })
  updateDb((db) => void db.users.push(m))
  return memberRow(m)
}

/**
 * 게스트 삭제(SCR-212, C-26·UXD-022 r4, AC-013·014·105–107).
 * 진행 중 라운드·확정된 청백전 미기록 경기에 포함되면 서버가 거부. 확정 전 대진 폐기·청백전 참가자 제거는 삭제와 한 번에(실패하면 둘 다 그대로).
 */
export async function deleteGuest(id: string): Promise<void> {
  if (dataSource === 'api') {
    await api.delete(`/api/roster/guests/${encodeURIComponent(id)}`)
    return
  }
  await mockDelay(null, 400)
  updateDb((db) => {
    const g = db.guests.find((x) => x.id === id)
    if (!g) throw new ApiError(404, { code: 'not_found', message: '이미 삭제된 게스트입니다' })
    const involvement = guestSessionInvolvement(db, id) ?? guestClubInvolvement(db, id) ?? { kind: 'none' as const }
    if (involvement.kind === 'inRound' || involvement.kind === 'confirmedMatch') throw new ApiError(409, { code: GUEST_DELETE_BLOCKED, message: '삭제할 수 없는 상태입니다' })
    discardGuestFromSessions(db, id) // 확정 전 대진 폐기·참석 제거와 삭제를 한 번에(C-26)
    removeGuestFromClubMatches(db, id) // 확정 전 청백전 대진 폐기·참가자 제거도 함께
    db.guests = db.guests.filter((x) => x.id !== id) // 지난 라운드 기록에는 '삭제된 게스트'로 남음
  })
}

/** 점수 미설정인 사람(SCR-214 개발 확인용 — 실제로는 참석·참가자 중 미설정) */
export async function listUnscored(): Promise<RosterPerson[]> {
  const r = await listRoster()
  return [...r.members, ...r.guests].filter((p) => p.score === null)
}
