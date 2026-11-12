import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { readDb, updateDb } from '../../lib/mock/db'
import type { Gender, Grade } from '../auth/types'
import { clubRecordOf, read as readClubDb } from '../clubmatch/api'
import { rankFor, type Rank } from './rank'

// 마이페이지(SCR-121·122, FLOW-007, US-019, AC-053–055·098). 본인 정보만(회원 권한 응답에 1–10 점수·지인·튜토리얼 권장 여부 없음, AC-017·066).
// - 프로필: api 모드는 실제 서버(GET·PUT /api/me/profile), Mock 모드는 Mock 저장소(운영진 명단과 같은 행 → AC-098)
// - 전적·랭크: api 모드는 GET /api/me/record(확정·종료 청백전 기록으로 서버가 계산, I3-d4), Mock 모드는 Mock 청백전 + 샘플 이전 전적
const profileSource = featureSource('profile')
const recordSource = featureSource('clubmatch')

export type Profile = { name: string; gender: Gender; grade: Grade }
export type MyRecord = { rank: Rank | null; gamesToRank: number | null; games: number; wins: number; losses: number; rate: number | null }

const unauthenticated = () => new ApiError(401, { code: 'unauthenticated', message: '로그인이 필요합니다' })

export async function getMyProfile(): Promise<Profile> {
  if (profileSource === 'api') return api.get<Profile>('/api/me/profile')
  const db = readDb()
  const u = db.users.find((x) => x.id === db.session)
  if (!u) throw unauthenticated()
  return mockDelay({ name: u.name, gender: u.gender, grade: u.grade })
}

/** 저장(AC-054·098): 이름·성별·급수. 운영진 명단에도 반영 */
export async function updateMyProfile(input: Profile): Promise<Profile> {
  const body = { ...input, name: input.name.trim() }
  if (profileSource === 'api') return api.put<Profile>('/api/me/profile', body)
  await mockDelay(null, 400)
  return updateDb((db) => {
    const u = db.users.find((x) => x.id === db.session)
    if (!u) throw unauthenticated()
    if (!body.name) throw new ApiError(422, { code: 'validation_error', message: '이름을 입력해 주세요' })
    Object.assign(u, body)
    return { name: u.name, gender: u.gender, grade: u.grade }
  })
}

/** 누적 전적·랭크(C-07·C-17): 개인전·팀전 모든 청백전 경기 합산. 게스트는 대상 아님(C-09) */
export async function getMyRecord(meId: string): Promise<MyRecord> {
  if (recordSource === 'api') return api.get<MyRecord>('/api/me/record')
  const db = readClubDb()
  const u = db.users.find((x) => x.id === meId)
  const base = u?.record ?? { games: 0, wins: 0, losses: 0 } // Mock 샘플의 이전 기록
  const club = clubRecordOf(db, meId)
  const wins = base.wins + club.wins
  const games = base.games + club.wins + club.losses
  return mockDelay({ ...rankFor(games, wins), games, wins, losses: games - wins })
}
