import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import type { MockClubMatch, MockDb } from '../../lib/mock/db'
import { people, read, type ClubMethod } from './api'
import { gameCounts, individualStandings, teamScore } from './schedule'

const dataSource = featureSource('clubmatch') // I3-d4: api 모드에서 실제 서버(/api/member/club-matches, backend member.py)

// 회원용 청백전 조회(SCR-111·112, FLOW-008, US-023, FR-024, C-18). 회원·운영진·슈퍼 관리자 모두 같은 응답.
// - 확정된 청백전만(진행 중·종료). 확정 전·없는 청백전은 같은 404(존재 여부를 드러내지 않음, AC-069)
// - 응답에는 이름·경기·결과·승수만. 1–10 점수, 팀 점수 합, 실력차, 급수, 성별, 랭크, 규칙 완화 같은 운영 정보 없음(AC-017·066·068)
//   서버는 운영진과 다른 허용 목록 스키마(backend/app/modules/clubmatch/member_schemas.py)로 만듦
// - 사람 키(S-1): 'p:…' 청백전 범위 키. 내부 회원·게스트 id를 내보내지 않음(같은 사람도 청백전마다 다름)
// - '나'는 서버가 세션으로 판정(Mock은 로그인한 Mock 사용자 id)
export type PublicStatus = 'confirmed' | 'finished'
export type MemberPlayer = { key: string; name: string; guest: boolean; me: boolean }
/** changed = 확정 후 대진 수정(교체·중도 귀가), resultChanged = 종료 후 결과 수정(U10·P-10) */
export type MemberGame = { no: number; team1: MemberPlayer[]; team2: MemberPlayer[]; winner: 1 | 2 | null; changed: boolean; resultChanged: boolean; mySide: 1 | 2 | null }
export type MemberStanding = { key: string; name: string; guest: boolean; me: boolean; wins: number; games: number; rank: number; tied: boolean }
export type PublicClubMatch = {
  id: string
  name: string
  date: string
  method: ClubMethod
  status: PublicStatus
  /** 확정 후 대진이 수정된 시각(AC-088). 없으면 null */
  modifiedAt: string | null
  /** 종료 후 경기 결과가 수정된 시각(U10·P-10). 없으면 null */
  resultModifiedAt: string | null
  games: MemberGame[]
  standings: MemberStanding[]
  team: { blue: number; white: number }
  unrecorded: number
  participating: boolean
}
export type PublicClubMatchItem = {
  id: string
  name: string
  date: string
  method: ClubMethod
  status: PublicStatus
  team: { blue: number; white: number } | null
  games: number
  participants: number
  unrecorded: number
  /** 종료 결과(UXD-075): 팀전 '청팀 승리'·'백팀 승리'·'무승부', 개인전 '1위 이름' / '공동 1위 이름 외 n명' */
  resultText: string | null
}

export const CLUB_NOT_FOUND = 'club_match_not_found'
const notFound = () => new ApiError(404, { code: CLUB_NOT_FOUND, message: '청백전을 찾을 수 없습니다' })
const isPublic = (m: MockClubMatch): m is MockClubMatch & { status: PublicStatus } => m.status !== 'draft'

function nameOf(db: MockDb) {
  const ps = people(db)
  return (key: string) => {
    const p = ps.get(key)
    if (p) return { name: p.name, guest: p.kind === 'guest' }
    const u = key.startsWith('member:') ? db.users.find((x) => `member:${x.id}` === key) : undefined
    return u ? { name: u.name, guest: false } : { name: '삭제된 게스트', guest: true } // 비활성 회원은 이름 유지
  }
}

/** S-1: 청백전 범위 키(Mock은 참가 순서 번호, 서버는 참가자 행 id) */
const publicKeys = (m: MockClubMatch) => {
  const keys = new Map(Object.keys(m.participants).map((k, i) => [k, `p:${m.id}-${i + 1}`]))
  return (key: string) => keys.get(key) ?? `p:${m.id}-x${key.length}`
}

function standingKeys(m: MockClubMatch) {
  const counts = gameCounts(m.games)
  return Object.keys(m.participants).filter((k) => counts.has(k) || !m.participants[k]!.left)
}

function resultText(db: MockDb, m: MockClubMatch): string | null {
  if (m.status !== 'finished') return null
  if (m.method === 'team') {
    const t = teamScore(m.games)
    return t.blue === t.white ? '무승부' : t.blue > t.white ? '청팀 승리' : '백팀 승리'
  }
  const who = nameOf(db)
  const top = individualStandings(m.games, standingKeys(m), (k) => who(k).name).filter((r) => r.rank === 1)
  if (top.length === 0) return null
  const first = who(top[0]!.key).name
  return top.length === 1 ? `1위 ${first}` : `공동 1위 ${first} 외 ${top.length - 1}명`
}

/** SCR-111: 확정된 청백전 최신순(미확정은 날짜·이름도 없음, AC-069·089) */
export async function listPublicClubMatches(): Promise<PublicClubMatchItem[]> {
  if (dataSource === 'api') return api.get<PublicClubMatchItem[]>('/api/member/club-matches')
  const db = read()
  const items = db.clubMatches!.filter(isPublic).map((m): PublicClubMatchItem => {
    const counts = gameCounts(m.games)
    return {
      id: m.id,
      name: m.name,
      date: m.date,
      method: m.method,
      status: m.status,
      team: m.method === 'team' ? teamScore(m.games) : null,
      games: m.games.length,
      participants: [...counts.keys()].length,
      unrecorded: m.games.filter((g) => !g.winner).length,
      resultText: resultText(db, m),
    }
  })
  return mockDelay(items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)))
}

/** SCR-112: 확정된 청백전 하나. meId = 로그인한 사용자 id(Mock에서만 사용, 서버는 세션으로 판정) */
export async function getPublicClubMatch(id: string, meId: string | null): Promise<PublicClubMatch> {
  if (dataSource === 'api') return api.get<PublicClubMatch>(`/api/member/club-matches/${encodeURIComponent(id)}`)
  await mockDelay(null)
  const db = read()
  const m = db.clubMatches!.find((x) => x.id === id)
  if (!m || !isPublic(m)) throw notFound()
  const meKey = meId ? `member:${meId}` : null
  const who = nameOf(db)
  const pk = publicKeys(m)
  const player = (key: string): MemberPlayer => ({ key: pk(key), ...who(key), me: key === meKey })
  const games = m.games.map((g): MemberGame => ({
    no: g.no,
    team1: g.team1.map(player),
    team2: g.team2.map(player),
    winner: g.winner,
    changed: !!g.changed,
    resultChanged: !!g.resultChanged,
    mySide: meKey ? (g.team1.includes(meKey) ? 1 : g.team2.includes(meKey) ? 2 : null) : null,
  }))
  const standings = individualStandings(m.games, standingKeys(m), (k) => who(k).name).map((s) => ({ ...s, key: pk(s.key), ...who(s.key), me: s.key === meKey }))
  return {
    id: m.id,
    name: m.name,
    date: m.date,
    method: m.method,
    status: m.status,
    modifiedAt: m.modifiedAt,
    resultModifiedAt: m.resultModifiedAt ?? null,
    games,
    standings,
    team: teamScore(m.games),
    unrecorded: m.games.filter((g) => !g.winner).length,
    participating: games.some((g) => g.mySide !== null),
  }
}
