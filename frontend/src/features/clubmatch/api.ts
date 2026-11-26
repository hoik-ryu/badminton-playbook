import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { readDb, updateDb, type MockClubGame, type MockClubMatch, type MockDb } from '../../lib/mock/db'
import type { Gender, Grade } from '../auth/types'
import { matchupKey } from '../session/lineup'
import { displayStatusOf, individualResult, teamResult, todayKst, type ClubMatchResult, type DisplayStatus } from './display'
import { MAX_COURTS, defaultRounds, distribution, evenProposals, gameCounts, gap, generateClubGames, generateRoundGames, individualStandings, markGeneratedRepeats, maxRounds, perRound, proposeTeams, refreshAfterSwap, roundPreview, substituteDecision, teamScore, type ClubMethod, type ClubRules, type Relaxation, type RoundPreview, type Team } from './schedule'

const dataSource = featureSource('clubmatch') // I3-d4: api 모드에서 실제 서버(backend/app/modules/clubmatch/router.py)

// 청백전 운영(SCR-221–226, FLOW-005, US-014·015·022, C-13–C-20, AC-042–047·057·058·070–085). 운영진 이상만(서버가 최종 검사).
// 사람 키: 'member:<id>' | 'guest:<id>'. 모든 변경은 화면이 본 version을 보내고(다르면 409 conflict, C-19·U9) 최신 상세를 돌려받음
// Mock은 서버(backend/app/modules/clubmatch/router.py)와 같은 정책: P-1 종료 후 되돌리기 금지 · P-2 같은 결과 무변경 · P-3 no_games ·
// P-4 교체 중복 same_matchup · P-4-b 중도 귀가 불가피 중복 예외 · P-5 비활성·삭제 대상 제외 · P-6 재퇴장 409 · P-7 원자적 · U4 순위 · U10·P-10 결과 수정 표시
export type { ClubMethod, ClubRules, Relaxation, RoundPreview, Team }
export type ClubStatus = MockClubMatch['status']
/** 삭제된(비식별화된) 게스트는 성별·급수·점수 없음(C안) */
export type Person = { key: string; id: string; kind: 'member' | 'guest'; name: string; gender: Gender | null; grade: Grade | null; score: number | null }

export const CLUB_ERRORS = {
  conflict: 'conflict',
  unscored: 'unscored_players',
  minPlayers: 'min_players',
  inGames: 'in_games',
  notRecorded: 'not_all_recorded',
  locked: 'locked',
  noGames: 'no_games',
  notEligible: 'not_eligible',
  sameMatchup: 'same_matchup',
  noSubstitute: 'no_substitute',
  /** (B10) 대진·팀 배정이 버려지는 변경: 확인(discard) 후 다시 요청. details = { games: 버려질 경기 수, teams: 팀 배정 초기화 } */
  confirmRequired: 'confirm_required',
  /** (B10) 팀전 미배정 참가자 있음. details = { keys } */
  unassigned: 'unassigned',
  /** (B10) 참가자가 아닌 사람에게 팀 지정. details = { keys } */
  notParticipant: 'not_participant',
  /** (B13, C-19 r11 항상 막는 규칙) 같은 경기 같은 선수 · 팀전 팀 소속 위반 · 2 대 2 아님 */
  duplicatePlayer: 'duplicate_player',
  teamViolation: 'team_violation',
  notTwoVsTwo: 'not_two_vs_two',
  /** (B13) 경기는 200개까지(총 경기 수 제약과 같음) */
  maxGames: 'max_games',
  /** (B13) 팀전은 같은 경기 맞교환 없음 */
  exchangeNotAllowed: 'exchange_not_allowed',
  // ── (B15, C-36–C-38) 라운드·코트 운영. 서버 router.py와 같은 코드 ──
  /** 같은 라운드에 이미 출전하는 사람. details = { keys, round } 또는 공통 검사 { rounds } */
  roundConflict: 'round_conflict',
  /** 라운드에 빈 코트가 없음 */
  courtFull: 'court_full',
  /** 없는 라운드·라운드 수 범위 밖·라운드 정보 없는 청백전 */
  invalidRound: 'invalid_round',
  /** 아직 시작하지 않은 라운드의 결과 기록. details = { round, currentRound } */
  roundNotStarted: 'round_not_started',
  /** 진행 라운드에 처리되지 않은 경기가 있어 다음 라운드를 시작할 수 없음. details = { games, currentRound } */
  roundIncomplete: 'round_incomplete',
  /** 지난 라운드 결과를 미기록으로 되돌리기. details = { round, currentRound } */
  roundLocked: 'round_locked',
  /** 진행 라운드에 결과·취소가 있어 시작 취소 불가 */
  roundHasResults: 'round_has_results',
  /** 취소된 경기의 결과 기록·교체 */
  gameCancelled: 'game_cancelled',
  /** 대체할 수 있는 선수가 있는 경기의 취소(또는 라운드 정보 없는 청백전). details = { games } */
  cancelNotAllowed: 'cancel_not_allowed',
} as const
export const METHOD_LABEL: Record<ClubMethod, string> = { individual: '개인전', team: '팀전' }
export const STATUS_LABEL: Record<ClubStatus, string> = { draft: '대진 미확정', confirmed: '진행 중', finished: '종료' }
export const TEAM_LABEL: Record<Team, string> = { blue: '청', white: '백' }

const err = (status: number, code: string, message: string, details?: unknown) => new ApiError(status, { code, message, details })

export function people(db: MockDb): Map<string, Person> {
  const m = new Map<string, Person>()
  for (const u of db.users) if (u.status === 'approved') m.set(`member:${u.id}`, { key: `member:${u.id}`, id: u.id, kind: 'member', name: u.name, gender: u.gender, grade: u.grade, score: u.score })
  for (const g of db.guests) m.set(`guest:${g.id}`, { key: `guest:${g.id}`, id: g.id, kind: 'guest', name: g.name, gender: g.gender, grade: g.grade, score: g.score })
  return m
}

const DELETED_GUEST = '삭제된 게스트'
const deletedGuest = (key: string): Person => ({ key, id: key.slice('guest:'.length), kind: 'guest', name: DELETED_GUEST, gender: null, grade: null, score: null })

/** 참가한 사람은 비활성 회원·삭제된 게스트여도 기록에 남음(U5·U6). 삭제된 게스트는 이름·성별·급수·점수 없음 */
function personOf(db: MockDb, key: string): Person {
  const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
  if (kind === 'member') {
    const u = db.users.find((x) => x.id === id)
    if (u) return { key, id, kind: 'member', name: u.name, gender: u.gender, grade: u.grade, score: u.score }
  }
  const g = kind === 'guest' ? db.guests.find((x) => x.id === id) : undefined
  return g ? { key, id, kind: 'guest', name: g.name, gender: g.gender, grade: g.grade, score: g.score } : deletedGuest(key)
}
/** 새 참가·교체·대체 대상(U6·P-5): 승인 회원·삭제 안 된 게스트 */
const isAvailable = (db: MockDb, key: string) => (key.startsWith('member:') ? db.users.some((u) => `member:${u.id}` === key && u.status === 'approved') : db.guests.some((g) => `guest:${g.id}` === key))

// ── 샘플(가상 인물) — 처음 읽을 때 한 번 만듦 ──
function ensureSeed(db: MockDb) {
  if (db.clubMatches) return
  const ps = people(db)
  const scored = (keys: string[]) => keys.map((k) => ps.get(k)).filter((p): p is Person => !!p && p.score !== null && p.gender !== null)
  const mk = (id: string, name: string, date: string, method: ClubMethod, keys: string[], totalGames: number, status: ClubStatus, recorded: number, seed: number): MockClubMatch => {
    const list = scored(keys)
    const teams = method === 'team' ? proposeTeams(list.map((p) => ({ key: p.key, gender: p.gender!, score: p.score }))) : {}
    const participants = Object.fromEntries(keys.map((k) => [k, { team: (teams[k] ?? null) as Team | null, left: false }]))
    const games: MockClubGame[] = status === 'draft' ? [] : markGeneratedRepeats(generateClubGames({ players: list.map((p) => ({ key: p.key, gender: p.gender!, score: p.score!, team: teams[p.key] ?? null })), totalGames, method, rules: { balance: true, gender: true }, seed }))
    games.forEach((g, i) => (g.winner = i < recorded ? ((((i * 7 + seed) % 3) % 2) + 1 as 1 | 2) : null))
    return { id, name, date, method, status, participants, totalGames, rules: { balance: true, gender: true }, games, seed: status === 'draft' ? null : seed, teamProposed: method === 'team', modifiedAt: null, resultModifiedAt: null, version: 1 }
  }
  const m = (ids: string[]) => ids.map((x) => `member:${x}`)
  db.clubMatches = [
    mk('cm-1', '가을 청백전', '2026-11-08', 'team', [...m(['u-member', 'u-admin', 'u-super', 'm-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-8', 'm-10']), 'guest:g-4', 'guest:g-1'], 9, 'confirmed', 5, 17),
    mk('cm-2', '연말 청백전', '2026-11-15', 'individual', [...m(['u-member', 'm-1', 'm-3', 'm-8']), 'guest:g-5'], 8, 'draft', 0, 23),
    mk('cm-3', '시월 개인전', '2026-10-25', 'individual', m(['u-member', 'u-admin', 'm-1', 'm-2', 'm-3', 'm-6', 'm-8', 'm-10']), 6, 'finished', 6, 31),
  ]
}

/** 청백전 샘플이 있는 Mock 저장소(회원 조회 memberApi.ts와 공유) */
export function read() {
  const db = readDb()
  if (!db.clubMatches) {
    updateDb((d) => ensureSeed(d))
    return readDb()
  }
  return db
}
const find = (db: MockDb, id: string) => {
  ensureSeed(db)
  const m = db.clubMatches!.find((x) => x.id === id)
  if (!m) throw err(404, 'not_found', '청백전을 찾을 수 없습니다')
  return m
}
const checkVersion = (m: MockClubMatch, version: number) => {
  if (m.version !== version) throw err(409, CLUB_ERRORS.conflict, '다른 운영진이 청백전을 변경했습니다', { version: m.version })
}

// ── 목록(SCR-221) ──
export type ClubMatchListItem = {
  id: string; name: string; date: string; method: ClubMethod; status: ClubStatus; unrecorded: number; team: { blue: number; white: number } | null; winnerText: string | null
  /** (SCR-111 r6, 하위 호환 추가) 선정된 참가 인원 */
  participants: number
  /** (SCR-111 r6) 경기 수(대진 생성 전 0) */
  games: number
  /** (SCR-111 r6) 표시 상태(UXD-087, 서버가 KST로 계산). DB 상태 status와 다름 */
  displayStatus: DisplayStatus
  /** (SCR-111 r6) 종료 결과 구조(UXD-088). 종료 전 null */
  result: ClubMatchResult | null
}

export async function listClubMatches(): Promise<ClubMatchListItem[]> {
  if (dataSource === 'api') return api.get<ClubMatchListItem[]>('/api/club-matches')
  const db = read()
  const ps = people(db)
  const today = todayKst()
  const items = db.clubMatches!.map((m): ClubMatchListItem => {
    const live = liveGames(m)
    const ts = teamScore(live)
    let winnerText: string | null = null
    let topNames: string[] = []
    if (m.status === 'finished') {
      if (m.method === 'team') winnerText = ts.blue === ts.white ? `무승부 (${ts.blue} : ${ts.white})` : `${ts.blue > ts.white ? '청팀' : '백팀'} 승리 (${ts.blue} : ${ts.white})`
      else {
        const name = (k: string) => ps.get(k)?.name ?? personOf(db, k).name
        const keys = Object.keys(m.participants).filter((k) => gameCounts(live).has(k) || !m.participants[k]!.left)
        const top = individualStandings(live, keys, name).filter((r) => r.rank === 1)
        winnerText = top.length ? `1위 ${top.map((t) => name(t.key)).join(', ')}` : null
        topNames = top.map((t) => name(t.key))
      }
    }
    const unrecorded = live.filter((g) => !g.winner).length
    const result = m.status !== 'finished' ? null : m.method === 'team' ? teamResult(ts.blue, ts.white) : individualResult(topNames)
    return {
      id: m.id, name: m.name, date: m.date, method: m.method, status: m.status, unrecorded, team: m.method === 'team' && m.status !== 'draft' ? ts : null, winnerText,
      participants: Object.values(m.participants).filter((p) => !p.left).length, games: m.games.length,
      displayStatus: displayStatusOf(m.status, m.date, m.games.length - unrecorded, today), result,
    }
  })
  return mockDelay(items.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)))
}

// ── 이름 규칙(AC-123): 앞뒤 공백 제외 1–30자. 서버(schemas._clean_name)와 같은 문구 ──
export const NAME_MAX = 30
export const NAME_ERRORS = { empty: '이름을 입력해 주세요', tooLong: '이름은 30자 이내로 입력해 주세요' } as const
/** 화면 검증·Mock 공용. 문제가 없으면 null */
export function nameProblem(name: string): string | null {
  const v = name.trim()
  if (!v) return NAME_ERRORS.empty
  if (v.length > NAME_MAX) return NAME_ERRORS.tooLong
  return null
}
/** 서버 검증 오류(422 validation_error, FastAPI errors 목록)에서 이름 칸 오류 문구를 꺼냄. 없으면 null */
export function nameErrorOf(e: unknown): string | null {
  if (!(e instanceof ApiError) || e.code !== 'validation_error' || !Array.isArray(e.details)) return null
  for (const d of e.details as { loc?: unknown[]; msg?: string }[]) {
    if (Array.isArray(d.loc) && d.loc.includes('name')) {
      const msg = String(d.msg ?? '').replace(/^Value error, /, '')
      return Object.values(NAME_ERRORS).find((m) => msg.includes(m)) ?? NAME_ERRORS.tooLong
    }
  }
  return null
}
const checkName = (name: string) => {
  const problem = nameProblem(name)
  if (problem) throw err(422, 'validation_error', 'Request validation failed', [{ type: 'value_error', loc: ['body', 'name'], msg: `Value error, ${problem}` }])
}

// ── 만들기(SCR-241 기본정보 첫 '다음', 이전 SCR-222) ──
/** (B15, C-36) courtCount를 보내면 라운드 기반, 빼면 라운드 정보 없는 청백전(기존 요청과 같음) */
export async function createClubMatch(input: { method: ClubMethod; date: string; name: string; courtCount?: number }): Promise<string> {
  if (dataSource === 'api') return (await api.post<{ id: string }>('/api/club-matches', input)).id
  await mockDelay(null, 300)
  checkName(input.name)
  checkCourts(input.courtCount)
  const id = `cm-${Date.now().toString(36)}`
  updateDb((db) => {
    ensureSeed(db)
    db.clubMatches!.push({ id, name: input.name.trim(), date: input.date, method: input.method, status: 'draft', participants: {}, totalGames: 8, rules: { balance: true, gender: true }, games: [], seed: null, teamProposed: false, modifiedAt: null, resultModifiedAt: null, version: 1, courtCount: input.courtCount ?? null, plannedRounds: null, currentRound: null })
  })
  return id
}

// ── 상세(SCR-223) ──
export type GameView = {
  no: number
  team1: Person[]
  team2: Person[]
  winner: 1 | 2 | null
  gap: number | null
  genderRelaxed: boolean
  /** 앞선 경기와 같은 4명·같은 팀(U7) */
  repeatedMatchup: boolean
  /** 규칙 완화 사유(U7·C-03·P-4-b) */
  relaxations: Relaxation[]
  /** 운영진이 선수를 직접 바꾼 경기 */
  manual: boolean
  /** 확정 후 대진 수정(교체·중도 귀가, C-15) */
  changed: boolean
  /** 종료 후 결과 수정(U10·P-10) */
  resultChanged: boolean
  /** (B15, C-36) 라운드·코트(라운드 정보 없는 청백전은 null) */
  round: number | null
  court: number | null
  /** (B15, C-37) 취소된 경기(중도 귀가로 대체 불가). 순위·승수·경기 수·미기록에서 빠짐 */
  cancelled: { at: string; reason: string } | null
}
/** available: 새 참가·교체·대체 대상이 될 수 있음(승인 회원·삭제 안 된 게스트, U6·P-5) */
export type ParticipantRow = Person & { participating: boolean; team: Team | null; games: number; left: boolean; inUnrecorded: number; available: boolean }
export type ClubMatchView = {
  id: string
  name: string
  date: string
  method: ClubMethod
  status: ClubStatus
  version: number
  totalGames: number
  rules: ClubRules
  teamProposed: boolean
  /** 확정 후 대진 수정 시각(C-15) */
  modifiedAt: string | null
  /** 종료 후 결과 수정 시각(U10·P-10) */
  resultModifiedAt: string | null
  rows: ParticipantRow[]
  summary: { count: number; male: number; female: number; blue: { n: number; male: number }; white: { n: number; male: number }; unscored: Person[] }
  preview: {
    groups: { games: number; people: number }[]
    even: boolean
    proposals: { totalGames: number; each: { blue: number; white: number } }[]
    /** (B15, AC-145) 라운드 기반 청백전만: 라운드당 경기 수·예상 경기 수·1인 경기 수·출전·휴식·균등안 */
    rounds?: RoundPreview
  }
  games: GameView[]
  standings: { key: string; name: string; guest: boolean; wins: number; games: number; rank: number; tied: boolean }[]
  team: { blue: number; white: number }
  unrecorded: number
  /** (B15, C-36) 코트 수. null = 라운드 정보 없는 기존 청백전(D11) */
  courtCount: number | null
  /** (B15) 자동 생성 기준 라운드 수 */
  plannedRounds: number | null
  /** (B15, C-37) 진행 중인 라운드(확정 후) */
  currentRound: number | null
  /** (B15) 현재 대진의 라운드 수 */
  roundCount: number
}

function view(db: MockDb, m: MockClubMatch): ClubMatchView {
  const ps = people(db)
  const get = (k: string) => ps.get(k) ?? personOf(db, k)
  const live = liveGames(m) // (B15, C-37) 취소된 경기는 순위·승수·경기 수·미기록에서 뺌
  const counts = gameCounts(live)
  const unrec = live.filter((g) => !g.winner)
  const keys = [...new Set([...ps.keys(), ...Object.keys(m.participants)])]
  const rows: ParticipantRow[] = keys.map((key) => {
    const p = get(key)
    const part = m.participants[key]
    return { ...p, participating: !!part, team: part?.team ?? null, games: counts.get(key) ?? 0, left: part?.left ?? false, inUnrecorded: unrec.filter((g) => [...g.team1, ...g.team2].includes(key)).length, available: !part || isAvailable(db, key) }
  })
  const inPlay = rows.filter((r) => r.participating && (m.method === 'individual' || r.team !== null))
  const blue = inPlay.filter((r) => r.team === 'blue')
  const white = inPlay.filter((r) => r.team === 'white')
  const counted = { all: inPlay.length, blue: blue.length, white: white.length }
  const dist = distribution(m.method, counted, Math.max(1, m.totalGames))
  const name = (k: string) => get(k).name
  const rounds = isRound(m) ? roundsPreview(m, counted) : undefined
  return {
    id: m.id,
    name: m.name,
    date: m.date,
    method: m.method,
    status: m.status,
    version: m.version,
    totalGames: m.totalGames,
    rules: m.rules,
    teamProposed: m.teamProposed,
    modifiedAt: m.modifiedAt,
    resultModifiedAt: m.resultModifiedAt ?? null,
    rows,
    summary: { count: inPlay.length, male: inPlay.filter((r) => r.gender === '남').length, female: inPlay.filter((r) => r.gender === '여').length, blue: { n: blue.length, male: blue.filter((r) => r.gender === '남').length }, white: { n: white.length, male: white.filter((r) => r.gender === '남').length }, unscored: inPlay.filter((r) => r.score === null) },
    preview: { ...dist, proposals: evenProposals(m.method, counted, Math.max(1, m.totalGames)), ...(rounds ? { rounds } : {}) },
    games: m.games.map((g) => {
      const t1 = g.team1.map(get)
      const t2 = g.team2.map(get)
      return { no: g.no, team1: t1, team2: t2, winner: g.winner, gap: gap(t1.map((p) => p.score), t2.map((p) => p.score)), genderRelaxed: g.genderRelaxed, repeatedMatchup: !!g.repeatedMatchup, relaxations: g.relaxations ?? [], manual: !!g.manual, changed: !!g.changed, resultChanged: !!g.resultChanged, round: g.round ?? null, court: g.court ?? null, cancelled: g.cancelled ?? null }
    }),
    standings: individualStandings(live, Object.keys(m.participants).filter((k) => counts.has(k) || !m.participants[k]!.left), name).map((s) => ({ ...s, name: get(s.key).name, guest: get(s.key).kind === 'guest' })),
    team: teamScore(live),
    unrecorded: unrec.length,
    courtCount: m.courtCount ?? null,
    plannedRounds: m.plannedRounds ?? null,
    currentRound: m.currentRound ?? null,
    roundCount: new Set(m.games.filter((g) => g.round != null).map((g) => g.round)).size,
  }
}

export async function getClubMatchView(id: string): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.get<ClubMatchView>(`/api/club-matches/${encodeURIComponent(id)}`)
  const db = read()
  return mockDelay(view(db, find(db, id)))
}

const base = (id: string) => `/api/club-matches/${encodeURIComponent(id)}`

/** 화면의 변경 요청 실행기: 직전 응답의 version으로 보내고 최신 상세를 돌려받음(SCR-223이 순서대로 실행) */
export type ClubRun = (work: (version: number) => Promise<ClubMatchView>) => Promise<ClubMatchView>

/** Mock 변경: 잠금(=저장소 갱신) 안에서 version 확인 → 변경 → 최신 상세 반환(서버 응답과 같은 형태) */
async function mutate(id: string, version: number, fn: (m: MockClubMatch, db: MockDb) => void | 'unchanged', ms = 250): Promise<ClubMatchView> {
  await mockDelay(null, ms)
  return updateDb((db) => {
    const m = find(db, id)
    checkVersion(m, version)
    if (fn(m, db) !== 'unchanged') {
      checkRounds(m) // (B15, C-38) 모든 변경 경로의 최종 상태를 같은 규칙으로(서버 _finish의 _check_rounds)
      m.version++
    }
    return view(db, m)
  })
}
const draftOnly = (m: MockClubMatch) => {
  if (m.status !== 'draft') throw err(409, CLUB_ERRORS.locked, '대진 확정 후에는 바꿀 수 없습니다')
}

// ── (B15, C-36–C-38) 라운드·코트 공통 규칙 — 서버 router.py(_is_round·_round_busy·_check_rounds·_normalize_rounds)와 같음 ──
/** 라운드 기반 청백전인가(코트 수가 있음). 없으면 라운드 정보 없는 기존 청백전(D11) */
const isRound = (m: MockClubMatch) => m.courtCount != null
/** 취소되지 않은 경기(C-37: 취소 경기는 출전·순위·승수·미기록에서 빠짐) */
const liveGames = (m: MockClubMatch) => m.games.filter((g) => !g.cancelled)
const playersOf = (g: MockClubGame) => [...g.team1, ...g.team2]
/** 그 라운드의 취소되지 않은 경기에 나오는 사람(skip 경기는 빼고) */
function roundBusy(m: MockClubMatch, rd: number | null | undefined, skip?: number): Set<string> {
  if (rd == null) return new Set()
  return new Set(m.games.filter((g) => g.round === rd && !g.cancelled && g.no !== skip).flatMap(playersOf))
}
const lastRound = (m: MockClubMatch) => Math.max(0, ...m.games.map((g) => g.round ?? 0))
function checkCourts(courtCount: number | undefined) {
  if (courtCount !== undefined && !(Number.isInteger(courtCount) && courtCount >= 1 && courtCount <= MAX_COURTS))
    throw err(422, 'validation_error', 'Request validation failed', [{ type: 'value_error', loc: ['body', 'courtCount'], msg: `코트 수는 1–${MAX_COURTS} 사이로 입력해 주세요` }])
}
function checkRoundsValue(rounds: number | undefined) {
  if (rounds !== undefined && !(Number.isInteger(rounds) && rounds >= 1 && rounds <= MAX_CLUB_GAMES))
    throw err(422, 'validation_error', 'Request validation failed', [{ type: 'value_error', loc: ['body', 'rounds'], msg: `라운드 수는 1–${MAX_CLUB_GAMES} 사이로 입력해 주세요` }])
}

/**
 * 공통 라운드 검사(C-38 r13): 모든 경기에 라운드·코트, 라운드 1..R 빈틈없음, 라운드마다 경기 수 ≤ 코트 수·코트 1..n,
 * 같은 라운드에 한 사람은 한 경기(취소 경기 제외), 경기 번호 = 라운드 → 코트 순 일련번호(D10)
 */
function checkRounds(m: MockClubMatch) {
  if (!isRound(m)) return
  if (m.games.some((g) => g.round == null || g.court == null)) throw err(422, CLUB_ERRORS.invalidRound, '라운드 정보가 없는 경기가 있습니다')
  const rounds = [...new Set(m.games.map((g) => g.round!))].sort((a, b) => a - b)
  if (rounds.some((rd, i) => rd !== i + 1)) throw err(422, CLUB_ERRORS.invalidRound, '라운드 번호가 맞지 않습니다', { rounds })
  for (const rd of rounds) {
    const courts = m.games.filter((g) => g.round === rd).map((g) => g.court!).sort((a, b) => a - b)
    if (courts.length > (m.courtCount ?? 0)) throw err(422, CLUB_ERRORS.courtFull, `${rd}라운드에 빈 코트가 없습니다`, { round: rd })
    if (courts.some((c, i) => c !== i + 1)) throw err(422, CLUB_ERRORS.invalidRound, '코트 번호가 맞지 않습니다', { round: rd })
  }
  const dups: Record<string, string[]> = {}
  for (const rd of rounds) {
    const seen = new Map<string, number>()
    for (const g of m.games) if (g.round === rd && !g.cancelled) for (const k of playersOf(g)) seen.set(k, (seen.get(k) ?? 0) + 1)
    const twice = [...seen].filter(([, n]) => n > 1).map(([k]) => k).sort()
    if (twice.length) dups[String(rd)] = twice
  }
  if (Object.keys(dups).length) throw err(422, CLUB_ERRORS.roundConflict, '같은 라운드에 이미 출전하는 사람이 있습니다', { rounds: dups })
  const ordered = [...m.games].sort((a, b) => a.round! - b.round! || a.court! - b.court!)
  if (ordered.some((g, i) => g.no !== i + 1)) throw err(422, CLUB_ERRORS.invalidRound, '경기 번호가 맞지 않습니다')
}

/** 빈 라운드를 지우고 뒤 라운드를 당김(D5), 라운드 안 코트를 1..n으로(D3), 번호를 라운드 → 코트 순으로(D10) */
function normalizeRounds(m: MockClubMatch) {
  const games = [...m.games].sort((a, b) => (a.round ?? 1) - (b.round ?? 1) || (a.court ?? 0) - (b.court ?? 0) || a.no - b.no)
  const roundMap = new Map<number, number>()
  const courtNext = new Map<number, number>()
  games.forEach((g, i) => {
    const old = g.round ?? 1
    if (!roundMap.has(old)) roundMap.set(old, roundMap.size + 1)
    const rd = roundMap.get(old)!
    courtNext.set(rd, (courtNext.get(rd) ?? 0) + 1)
    g.round = rd
    g.court = courtNext.get(rd)!
    g.no = i + 1
  })
  m.games = games
}

/** 생성 전 라운드 미리보기(AC-145): 서버 build_view의 preview.rounds와 같음 */
function roundsPreview(m: MockClubMatch, sizes: { all: number; blue: number; white: number }): RoundPreview {
  const courts = m.courtCount ?? 0
  const planned = m.plannedRounds ?? defaultRounds(m.method, sizes, perRound(m.method, sizes, courts))
  return roundPreview(m.method, sizes, courts, planned)
}

/** 방식 변경(AC-070, C-13): 확정 전만. 미확정 대진 버림, 참가자 유지, 팀 배정 초기화 */
export async function setMethod(id: string, version: number, method: ClubMethod): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.put<ClubMatchView>(`${base(id)}/method`, { method, version })
  return mutate(id, version, (m) => {
    draftOnly(m)
    m.method = method
    m.games = []
    m.seed = null
    m.teamProposed = false
    for (const p of Object.values(m.participants)) p.team = null
  })
}

/** (B10, C-33) 버려질 대진·팀 배정이 있으면 확인(discard)이 있어야 함 — 서버 _confirm_or_fail과 같음 */
const confirmOrFail = (m: MockClubMatch, discard: boolean, teams = false) => {
  if ((m.games.length || teams) && !discard) throw err(409, CLUB_ERRORS.confirmRequired, '만든 대진이나 팀 배정이 바뀝니다. 확인 후 다시 요청해 주세요', { games: m.games.length, teams })
}
/** 폐기 확인은 true일 때만 보냄(서버 기본 false — 기존 요청 본문과 같음) */
const confirmed = (discard: boolean) => (discard ? { discard: true } : {})
const dropGames = (m: MockClubMatch) => {
  m.games = []
  m.seed = null
}

/**
 * 대진 설정(총 경기 수·규칙 2개, 확정 전). (B10) 값이 같으면 무변경(version 유지), 바뀌고 대진이 있으면 discard 필요
 * (B15, C-14 r12) 라운드 기반은 totalGames 대신 rounds(자동 생성 기준 라운드 수)
 */
export async function setSettings(id: string, version: number, settings: { totalGames?: number; rounds?: number; rules: ClubRules }, discard = false): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.put<ClubMatchView>(`${base(id)}/settings`, { ...settings, version, ...confirmed(discard) })
  checkRoundsValue(settings.rounds)
  return mutate(id, version, (m) => {
    draftOnly(m)
    if (isRound(m)) {
      const rounds = settings.rounds ?? m.plannedRounds ?? null
      if (rounds === (m.plannedRounds ?? null) && m.rules.balance === settings.rules.balance && m.rules.gender === settings.rules.gender) return 'unchanged'
      confirmOrFail(m, discard)
      dropGames(m)
      m.plannedRounds = rounds
      m.rules = { ...settings.rules }
      return
    }
    if (settings.totalGames === undefined) throw err(422, 'validation_error', '총 경기 수를 입력해 주세요')
    if (m.totalGames === settings.totalGames && m.rules.balance === settings.rules.balance && m.rules.gender === settings.rules.gender) return 'unchanged'
    confirmOrFail(m, discard)
    dropGames(m)
    m.totalGames = settings.totalGames
    m.rules = { ...settings.rules }
  }, 120)
}

/** (B10) 기본정보 저장(AC-123·070·132): 이름·날짜만 바뀌면 팀·대진 유지. 방식이 바뀌면 대진 폐기 + 팀 초기화(팀·대진이 있으면 discard 필요) */
/** (B15, C-36·AC-144) courtCount가 바뀌면 대진이 있을 때 확인(discard) 후 폐기. 라운드 정보 없는 준비 중 청백전도 이렇게 라운드 기반이 됨(AC-163) */
export async function saveBasic(id: string, version: number, input: { name: string; date: string; method: ClubMethod; courtCount?: number }, discard = false): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.put<ClubMatchView>(`${base(id)}/basic`, { ...input, version, ...confirmed(discard) })
  await mockDelay(null, 150)
  checkName(input.name)
  checkCourts(input.courtCount)
  return mutate(id, version, (m) => {
    draftOnly(m)
    const name = input.name.trim()
    const court = input.courtCount ?? m.courtCount ?? null
    if (name === m.name && input.date === m.date && input.method === m.method && court === (m.courtCount ?? null)) return 'unchanged'
    if (court !== (m.courtCount ?? null) && input.method === m.method) {
      confirmOrFail(m, discard)
      dropGames(m)
      m.plannedRounds = null
    }
    if (input.method !== m.method) {
      confirmOrFail(m, discard, Object.values(m.participants).some((p) => p.team))
      dropGames(m)
      m.teamProposed = false
      for (const p of Object.values(m.participants)) p.team = null
      m.method = input.method
      m.plannedRounds = null
    }
    m.name = name
    m.date = input.date
    m.courtCount = court
  }, 0)
}

/** (B10) 참가자 일괄 저장(AC-125·128·132): 최종 목록으로 교체. 남는 사람 팀 유지·추가는 미배정(목록 순서)·빠진 사람 삭제. 같으면 무변경 */
export async function saveParticipants(id: string, version: number, keys: string[], discard = false): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.put<ClubMatchView>(`${base(id)}/participants`, { keys, version, ...confirmed(discard) })
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    const want = [...new Set(keys)]
    const current = Object.keys(m.participants)
    if (want.length === current.length && want.every((k) => k in m.participants)) return 'unchanged'
    const added = want.filter((k) => !(k in m.participants))
    const bad = added.filter((k) => !isAvailable(db, k))
    if (bad.length) throw err(422, CLUB_ERRORS.notEligible, '참가할 수 없는 사람이 있습니다', { keys: bad })
    confirmOrFail(m, discard)
    dropGames(m)
    const keep = new Set(want)
    const next: MockClubMatch['participants'] = {}
    for (const k of current) if (keep.has(k)) next[k] = m.participants[k]!
    for (const k of added) next[k] = { team: null, left: false }
    m.participants = next
  }, 200)
}

/** (B10) 팀 배정 일괄 저장(AC-127·128·135): 모든 참가자 청·백, 팀마다 2명 이상. 바뀌고 대진이 있으면 discard 필요. 같으면 무변경 */
export async function saveTeams(id: string, version: number, assignments: Record<string, Team>, discard = false): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.put<ClubMatchView>(`${base(id)}/teams`, { assignments, version, ...confirmed(discard) })
  return mutate(id, version, (m) => {
    draftOnly(m)
    if (m.method !== 'team') throw err(409, CLUB_ERRORS.locked, '팀전에서만 팀을 정할 수 있습니다')
    const strangers = Object.keys(assignments).filter((k) => !(k in m.participants))
    if (strangers.length) throw err(422, CLUB_ERRORS.notParticipant, '참가자가 아닌 사람이 있습니다', { keys: strangers })
    const missing = Object.keys(m.participants).filter((k) => !(k in assignments))
    if (missing.length) throw err(422, CLUB_ERRORS.unassigned, `미배정 ${missing.length}명의 팀을 골라 주세요`, { keys: missing })
    const blue = Object.values(assignments).filter((t) => t === 'blue').length
    const white = Object.values(assignments).length - blue
    if (blue < 2 || white < 2) throw err(422, CLUB_ERRORS.minPlayers, `${blue < 2 ? '청팀' : '백팀'}이 2명 이상이어야 합니다`, { minTotal: 4, minPerTeam: 2, count: blue + white, blue, white })
    if (Object.entries(assignments).every(([k, t]) => m.participants[k]!.team === t)) return 'unchanged'
    confirmOrFail(m, discard)
    dropGames(m)
    for (const [k, t] of Object.entries(assignments)) m.participants[k]!.team = t
    m.teamProposed = true
  }, 200)
}

/** (B10) 준비 중 청백전 삭제(AC-134): 참가자·대진 함께. 확정한 청백전은 409 locked. 이미 없으면 404(재시도 = 이미 삭제됨) */
export async function deleteClubMatch(id: string, version: number): Promise<void> {
  if (dataSource === 'api') {
    await api.delete<void>(`${base(id)}?version=${version}`)
    return
  }
  await mockDelay(null, 200)
  updateDb((db) => {
    const m = find(db, id)
    checkVersion(m, version)
    if (m.status !== 'draft') throw err(409, CLUB_ERRORS.locked, '확정한 청백전은 삭제할 수 없습니다')
    db.clubMatches = db.clubMatches!.filter((x) => x.id !== id)
  })
}

function addParticipant(db: MockDb, m: MockClubMatch, key: string, team: Team | null) {
  if (!isAvailable(db, key)) throw err(422, CLUB_ERRORS.notEligible, '참가할 수 없는 사람입니다')
  m.participants[key] = { team, left: false }
}

/** 개인전 참가 체크(UXD-038·039): 이미 경기에 들어간 사람은 해제 불가 */
export async function setParticipating(id: string, version: number, key: string, on: boolean, discard = false): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.put<ClubMatchView>(`${base(id)}/participants/${encodeURIComponent(key)}`, { participating: on, version, ...confirmed(discard) })
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    // (B10) 같으면 무변경, 자격 검사 → 대진이 있으면 확인(discard) 후 대진 폐기
    if (on === !!m.participants[key]) return 'unchanged'
    if (on && !isAvailable(db, key)) throw err(422, CLUB_ERRORS.notEligible, '참가할 수 없는 사람입니다')
    confirmOrFail(m, discard)
    dropGames(m)
    if (on) {
      if (!m.participants[key]) addParticipant(db, m, key, null)
    } else if (m.participants[key]) {
      if (m.games.some((g) => [...g.team1, ...g.team2].includes(key))) throw err(409, CLUB_ERRORS.inGames, '경기에 출전한 선수는 참가를 해제할 수 없습니다')
      delete m.participants[key]
    }
  }, 120)
}

/** 팀전 청/백/불참(UXD-070): 만든 대진이 있으면 버림(화면이 확인 후 다시 생성) */
export async function setTeam(id: string, version: number, key: string, team: Team | null): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.put<ClubMatchView>(`${base(id)}/teams/${encodeURIComponent(key)}`, { team, version })
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    m.games = []
    m.seed = null
    if (team === null) delete m.participants[key]
    else if (!m.participants[key]) addParticipant(db, m, key, team)
    else m.participants[key]!.team = team
  }, 120)
}

/** 팀 배정안(AC-072, UXD-030): 현재 참가자 전원을 점수 합·성별 비율이 비슷하게 청·백으로(서버와 같음) */
export async function applyTeamProposal(id: string, version: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/teams/propose`, { version })
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    if (m.method !== 'team') throw err(409, CLUB_ERRORS.locked, '팀전에서만 팀 배정안을 만들 수 있습니다')
    const list = Object.keys(m.participants).map((k) => personOf(db, k))
    const t = proposeTeams(list.filter((p) => p.gender !== null).map((p) => ({ key: p.key, gender: p.gender!, score: p.score })))
    for (const [k, team] of Object.entries(t)) m.participants[k]!.team = team
    m.games = []
    m.seed = null
    m.teamProposed = true
  }, 400)
}

/**
 * 대진 생성·다시 생성(AC-071·073·075·076): 점수 미설정 → (B10) 팀전 미배정 → 인원 부족 순서로 검사(U8).
 * (B10) settings를 함께 보내면 같은 요청에서 저장한 뒤 생성(C-32). 실패하면 설정도 저장되지 않음
 */
export async function generateClub(id: string, version: number, settings?: { totalGames?: number; rounds?: number; rules: ClubRules }, discard = false): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/games`, { version, ...settings, ...confirmed(discard) })
  checkRoundsValue(settings?.rounds)
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    const before = { totalGames: m.totalGames, rules: m.rules, plannedRounds: m.plannedRounds }
    if (settings) {
      if (settings.totalGames !== undefined && !isRound(m)) m.totalGames = settings.totalGames
      if (settings.rounds !== undefined && isRound(m)) m.plannedRounds = settings.rounds
      m.rules = { ...settings.rules }
    }
    const fail = (e: ApiError) => {
      Object.assign(m, before) // 원자성: 실패하면 설정도 그대로
      return e
    }
    const list = Object.entries(m.participants)
      .filter(([, v]) => m.method === 'individual' || v.team)
      .map(([k, v]) => ({ p: personOf(db, k), team: v.team }))
    const unscored = list.filter((x) => x.p.score === null).map((x) => x.p.key)
    if (unscored.length) throw fail(err(422, CLUB_ERRORS.unscored, '점수 미설정 참가자가 있습니다', { keys: unscored }))
    const unassigned = m.method === 'team' ? Object.entries(m.participants).filter(([k, v]) => !v.team && personOf(db, k).gender !== null).map(([k]) => k) : []
    if (unassigned.length) throw fail(err(422, CLUB_ERRORS.unassigned, `미배정 ${unassigned.length}명의 팀을 골라 주세요`, { keys: unassigned }))
    const blue = list.filter((x) => x.team === 'blue').length
    const white = list.filter((x) => x.team === 'white').length
    if (list.length < 4 || (m.method === 'team' && (blue < 2 || white < 2)))
      throw fail(err(422, CLUB_ERRORS.minPlayers, m.method === 'individual' ? '참가자가 4명 이상이어야 대진을 만들 수 있습니다' : '청·백 팀마다 2명 이상이어야 대진을 만들 수 있습니다', { minTotal: 4, minPerTeam: m.method === 'team' ? 2 : null, count: list.length, blue: m.method === 'team' ? blue : null, white: m.method === 'team' ? white : null }))
    // (B13, C-33·C-35) 운영진이 편집한 경기가 있으면 확인(discard) 후에만 다시 생성
    const edited = m.games.filter((g) => g.manual).length
    if (edited && !discard) throw fail(err(409, CLUB_ERRORS.confirmRequired, '편집한 대진이 사라집니다. 확인 후 다시 요청해 주세요', { games: m.games.length, edited }))
    if (isRound(m)) {
      // (B15, C-36·AC-146·147) 라운드마다 코트를 채움(D2). 서버 _generate_rounds와 같은 검사·같은 엔진
      const sizes = { all: list.length, blue, white }
      const k = perRound(m.method, sizes, m.courtCount ?? 0)
      if (k <= 0) throw fail(err(422, CLUB_ERRORS.invalidRound, '팀마다 2명 이상, 전체 4명 이상이어야 경기를 만들 수 있습니다', { perRound: 0 }))
      const rounds = m.plannedRounds ?? defaultRounds(m.method, sizes, k)
      const top = maxRounds(k)
      if (rounds < 1 || rounds > top) throw fail(err(422, CLUB_ERRORS.invalidRound, `라운드 수는 1–${top} 사이로 입력해 주세요`, { maxRounds: top, perRound: k }))
      m.seed = Math.floor(Math.random() * 2 ** 31)
      m.games = generateRoundGames({ players: list.map((x) => ({ key: x.p.key, gender: x.p.gender ?? '남', score: x.p.score!, team: x.team })), rounds, courts: m.courtCount ?? 0, method: m.method, rules: m.rules, seed: m.seed }).map((g) => ({ ...g, winner: null, manual: false }))
      m.plannedRounds = rounds
      m.totalGames = Math.max(1, m.games.length)
      return
    }
    m.seed = Math.floor(Math.random() * 2 ** 31)
    m.games = markGeneratedRepeats(generateClubGames({ players: list.map((x) => ({ key: x.p.key, gender: x.p.gender ?? '남', score: x.p.score!, team: x.team })), totalGames: m.totalGames, method: m.method, rules: m.rules, seed: m.seed }))
  }, 600)
}

/** 확정(AC-077): 회원 공개. 대진이 없으면 409 no_games(P-3) */
export async function confirmClub(id: string, version: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/confirm`, { version })
  return mutate(id, version, (m, db) => {
    if (m.status !== 'draft') throw err(409, CLUB_ERRORS.locked, '이미 확정된 청백전입니다')
    if (!m.games.length) throw err(409, CLUB_ERRORS.noGames, '대진을 먼저 만들어 주세요')
    // (B10, AC-130) 서버와 같은 재검증: 점수 미설정 → 팀전 미배정
    const entries = Object.entries(m.participants).filter(([k]) => personOf(db, k).gender !== null)
    const unscored = entries.filter(([k, v]) => (m.method === 'individual' || v.team) && personOf(db, k).score === null).map(([k]) => k)
    if (unscored.length) throw err(422, CLUB_ERRORS.unscored, '점수 미설정 참가자가 있습니다', { keys: unscored })
    const unassigned = m.method === 'team' ? entries.filter(([, v]) => !v.team).map(([k]) => k) : []
    if (unassigned.length) throw err(422, CLUB_ERRORS.unassigned, `미배정 ${unassigned.length}명의 팀을 골라 주세요`, { keys: unassigned })
    // (B13, C-19 r11) 모든 경기를 항상 막는 규칙으로 다시 검사
    for (const g of m.games) checkLineup(db, m, [...g.team1], [...g.team2], g.no)
    m.status = 'confirmed'
    if (isRound(m)) m.currentRound = 1 // (B15, C-37 Q-032 A1) 확정하면 1라운드가 진행 중
  })
}

/**
 * 결과 기록·수정·미기록으로 되돌리기(AC-044·081·085, C-20, U2): 확정 후만, 이긴 쪽만(null = 되돌리기)
 * - P-1 종료 후 되돌리기 금지(409 locked) · P-2 같은 값은 무변경(version 그대로)
 * - U10·P-10 종료 후 수정은 결과 수정 표시(resultChanged·resultModifiedAt). 대진 수정 표시(changed)와 따로
 */
export async function recordResult(id: string, version: number, gameNo: number, winner: 1 | 2 | null): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.put<ClubMatchView>(`${base(id)}/games/${gameNo}/result`, { winner, version })
  return mutate(id, version, (m) => {
    if (m.status === 'draft') throw err(409, CLUB_ERRORS.locked, '확정 후에 결과를 기록할 수 있습니다')
    const g = m.games.find((x) => x.no === gameNo)
    if (!g) throw err(404, 'not_found', '경기를 찾을 수 없습니다')
    if (g.cancelled) throw err(409, CLUB_ERRORS.gameCancelled, '취소된 경기는 결과를 기록할 수 없습니다')
    if (winner === null && m.status === 'finished') throw err(409, CLUB_ERRORS.locked, '종료된 청백전은 결과를 미기록으로 되돌릴 수 없습니다')
    if (isRound(m) && g.round != null) {
      // (B15, C-37·AC-153·165) 시작 전 라운드는 기록 불가, 지난 라운드는 수정만(미기록으로 되돌리기 불가)
      const current = m.currentRound ?? 1
      if (g.round > current) throw err(409, CLUB_ERRORS.roundNotStarted, '아직 시작하지 않은 라운드입니다', { round: g.round, currentRound: current })
      if (winner === null && g.round < current && g.winner !== null) throw err(409, CLUB_ERRORS.roundLocked, '지난 라운드의 결과는 미기록으로 되돌릴 수 없습니다', { round: g.round, currentRound: current })
    }
    if (g.winner === winner) return 'unchanged'
    g.winner = winner
    if (m.status === 'finished') {
      g.resultChanged = true
      m.resultModifiedAt = new Date().toISOString()
    }
  }, 150)
}

/** 종료(AC-085): 미기록 0일 때만 */
export async function finishClub(id: string, version: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/finish`, { version })
  return mutate(id, version, (m) => {
    if (m.status !== 'confirmed') throw err(409, CLUB_ERRORS.locked, '진행 중인 청백전만 종료할 수 있습니다')
    const remaining = liveGames(m).filter((g) => !g.winner).length // (B15, C-37) 취소된 경기는 처리된 경기
    if (isRound(m)) {
      const last = lastRound(m) || 1
      const current = m.currentRound ?? 1
      if (current < last) throw err(409, CLUB_ERRORS.notRecorded, '마지막 라운드를 시작해야 종료할 수 있습니다', { remaining, currentRound: m.currentRound ?? null, lastRound: last })
    }
    if (remaining) throw err(409, CLUB_ERRORS.notRecorded, '결과가 기록되지 않은 경기가 있습니다', { remaining })
    m.status = 'finished'
  })
}

// ── (B10, AC-133) 저장 실패 뒤 처리(재시도 정책) ──
export type SaveOutcome = { kind: 'applied'; view: ClubMatchView } | { kind: 'conflict'; view: ClubMatchView } | { kind: 'retry'; error: unknown }
/**
 * 저장이 실패했을 때 무엇을 할지 정합니다(생성 페이지 공통).
 * - 409 conflict: 최신 상세를 다시 받아, 보내려던 결과가 이미 반영돼 있으면(앞선 요청이 저장됐지만 응답만 잃음) applied,
 *   아니면 conflict(다른 운영진이 바꿈 → 충돌 안내 후 최신 상태로 다시 그림)
 * - 그 밖(네트워크 등): retry — 화면 입력을 그대로 두고 같은 version으로 다시 시도. 새 API는 전체 교체라 같은 요청을 다시 보내도 결과가 같음(멱등)
 */
export async function settleSaveFailure(id: string, error: unknown, applied: (latest: ClubMatchView) => boolean): Promise<SaveOutcome> {
  if (!(error instanceof ApiError) || error.code !== CLUB_ERRORS.conflict) return { kind: 'retry', error }
  const latest = await getClubMatchView(id)
  return applied(latest) ? { kind: 'applied', view: latest } : { kind: 'conflict', view: latest }
}

// ── 선수 교체(SCR-225)·대체 선수(SCR-226) ──
/** sameMatchup: 다른 경기와 같은 4명·같은 팀 구성이 됨(P-4). 중도 귀가에서 다른 후보가 모두 그렇다면 고를 수 있음(P-4-b) */
export type Candidate = { person: Person; team: Team | null; games: number; gapAfter: number | null; disabledReason: string | null; diffAfter: number; inGame: boolean; sameMatchup: boolean }
export const SAME_MATCHUP_REASON = '같은 4명·같은 팀 구성이 됩니다'

/**
 * 후보: 경기 수 적은 순(같으면 이름순). 팀전은 같은 팀만(UXD-043). 제외(귀가)·비활성 회원·삭제된 게스트는 빠짐(P-5)
 * 비활성 사유: 같은 경기 중복, 같은 4명·같은 팀 구성(C-19·P-4). otherKeys = 비교할 다른 경기 대진(중도 귀가는 다른 대체를 반영한 값)
 */
export function candidatesFor(v: ClubMatchView, gameNo: number, targetKey: string, opts: { exclude?: string[]; extraCounts?: Map<string, number>; otherKeys?: Set<string> } = {}): Candidate[] {
  const game = v.games.find((g) => g.no === gameNo)
  if (!game) return []
  const targetRow = v.rows.find((r) => r.key === targetKey)
  const counts = new Map(v.rows.map((r) => [r.key, r.games + (opts.extraCounts?.get(r.key) ?? 0)]))
  const otherKeys = opts.otherKeys ?? new Set(v.games.filter((g) => g.no !== gameNo).map((g) => matchupKey(g.team1.map((p) => p.key), g.team2.map((p) => p.key))))
  const pool = v.rows.filter((r) => r.participating && !r.left && r.available && r.key !== targetKey && !opts.exclude?.includes(r.key) && (v.method === 'individual' || r.team === targetRow?.team))
  return pool
    .map((c) => {
      const inGame = [...game.team1, ...game.team2].some((p) => p.key === c.key)
      const sub = (t: Person[]) => t.map((p) => (p.key === targetKey ? c : p))
      const t1 = sub(game.team1)
      const t2 = sub(game.team2)
      const same = otherKeys.has(matchupKey(t1.map((p) => p.key), t2.map((p) => p.key)))
      const after = new Map(counts)
      after.set(targetKey, (after.get(targetKey) ?? 0) - 1)
      after.set(c.key, (after.get(c.key) ?? 0) + 1)
      const vals = [...after.entries()].filter(([k]) => v.rows.find((r) => r.key === k)?.participating).map(([, n]) => n)
      return {
        person: c,
        team: c.team,
        games: counts.get(c.key) ?? 0,
        gapAfter: gap(t1.map((p) => p.score), t2.map((p) => p.score)),
        disabledReason: inGame ? '같은 경기에 이미 있습니다' : same ? SAME_MATCHUP_REASON : null,
        diffAfter: Math.max(...vals) - Math.min(...vals),
        inGame,
        sameMatchup: !inGame && same,
      }
    })
    .sort((a, b) => a.games - b.games || a.person.name.localeCompare(b.person.name, 'ko'))
}

const keyOfGame = (g: MockClubGame) => matchupKey([...g.team1], [...g.team2])

/** 교체·대체로 들어갈 수 있는 사람(P-5): 이 청백전 참가자, 제외 안 됨, 승인 회원·삭제 안 된 게스트, 팀전은 같은 팀 */
function playable(db: MockDb, m: MockClubMatch, key: string, team: Team | null) {
  const part = m.participants[key]
  return !!part && !part.left && isAvailable(db, key) && (m.method === 'individual' || part.team === team)
}

/** 대체로 들어갈 수 있는 사람: 이 청백전 참가자, 제외 안 됨, 승인 회원·삭제 안 된 게스트(서버 _active_participant) */
function activeOrFail(db: MockDb, m: MockClubMatch, key: string) {
  const part = m.participants[key]
  if (!part || part.left || !isAvailable(db, key)) throw err(422, CLUB_ERRORS.notEligible, '이 청백전에서 뛸 수 있는 선수가 아닙니다')
}

function replaceIn(db: MockDb, m: MockClubMatch, gameNo: number, from: string, to: string) {
  const g = m.games.find((x) => x.no === gameNo)
  if (!g) throw err(404, 'not_found', '경기를 찾을 수 없습니다')
  if (g.winner) throw err(409, CLUB_ERRORS.locked, '결과가 기록된 경기는 바꿀 수 없습니다')
  if (![...g.team1, ...g.team2].includes(from) || [...g.team1, ...g.team2].includes(to)) throw err(409, CLUB_ERRORS.conflict, '대진이 바뀌었습니다', { version: m.version })
  const part = m.participants[to]
  if (!part || part.left || !isAvailable(db, to)) throw err(422, CLUB_ERRORS.notEligible, '이 청백전에서 뛸 수 있는 선수가 아닙니다')
  if (m.method === 'team' && m.participants[from]?.team !== part.team) throw err(422, CLUB_ERRORS.notEligible, '팀전은 같은 팀 선수로만 바꿀 수 있습니다')
  g.team1 = g.team1.map((k) => (k === from ? to : k)) as [string, string]
  g.team2 = g.team2.map((k) => (k === from ? to : k)) as [string, string]
  g.manual = true
  if (m.status !== 'draft') g.changed = true
}

function refreshFlags(db: MockDb, m: MockClubMatch, forced: Set<string> = new Set()) {
  const games = liveGames(m) // (B15) 취소된 경기는 같은 대진·성별 판정에서 뺌(서버 _refresh_flags와 같음)
  const states = games.map((g) => ({ no: g.no, team1: g.team1, team2: g.team2, manual: !!g.manual, genderRelaxed: g.genderRelaxed, repeatedMatchup: !!g.repeatedMatchup, relaxations: g.relaxations ?? [] }))
  refreshAfterSwap(states, (k) => personOf(db, k).gender, m.rules.gender, forced)
  games.forEach((g, i) => Object.assign(g, { genderRelaxed: states[i]!.genderRelaxed, repeatedMatchup: states[i]!.repeatedMatchup, relaxations: states[i]!.relaxations }))
}

/** 선수 교체(AC-064·077·079): 확정 전 전체, 확정 후 결과 없는 경기만. 확정 후 다른 경기와 같은 4명·같은 팀이면 409 same_matchup(P-4, r11: 확정 전은 허용·표시) */
export async function swapClub(id: string, version: number, gameNo: number, from: string, to: string): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/games/${gameNo}/swap`, { from, to, version })
  return mutate(id, version, (m, db) => {
    if (m.status === 'finished') throw err(409, CLUB_ERRORS.locked, '종료된 청백전은 선수를 바꿀 수 없습니다')
    const target = m.games.find((x) => x.no === gameNo)
    if (!target) throw err(404, 'not_found', '경기를 찾을 수 없습니다')
    if (target.cancelled) throw err(409, CLUB_ERRORS.gameCancelled, '취소된 경기는 선수를 바꿀 수 없습니다')
    if (!m.participants[from]) throw err(409, CLUB_ERRORS.conflict, '대진이 바뀌었습니다', { version: m.version })
    activeOrFail(db, m, to)
    // (B15, C-36·AC-150·158) 같은 라운드의 다른 경기에 나오는 사람으로는 바꿀 수 없음
    if (isRound(m) && roundBusy(m, target.round, target.no).has(to)) throw err(422, CLUB_ERRORS.roundConflict, '같은 라운드에 이미 출전하는 사람입니다', { keys: [to], round: target.round })
    replaceIn(db, m, gameNo, from, to)
    const g = m.games.find((x) => x.no === gameNo)!
    const twins = liveGames(m).filter((x) => x.no !== gameNo && keyOfGame(x) === keyOfGame(g)).map((x) => x.no)
    // (B13, AC-043 r11·AC-140) 같은 대진 거부는 확정 후 교체만. 확정 전은 허용하고 '운영진 수동 변경' 표시
    if (twins.length && m.status !== 'draft') throw err(409, CLUB_ERRORS.sameMatchup, '같은 4명·같은 팀 구성의 경기가 이미 있습니다', { games: [gameNo], with: twins })
    if (m.status === 'confirmed') m.modifiedAt = new Date().toISOString()
    refreshFlags(db, m)
    markDraftRepeats(m)
  })
}

// ── (B13) 확정 전 공통 편집: 경기 추가·삭제·맞교환·대진 폐기(C-35) — 서버 router.py와 같은 규칙·오류 코드 ──
export const MAX_CLUB_GAMES = 200

/** 항상 막는 규칙(C-19 r11): 2 대 2 → 같은 경기 같은 선수 → 참가 자격 → 팀전 팀 소속(서버 _check_lineup과 같은 순서) */
function checkLineup(db: MockDb, m: MockClubMatch, t1: string[], t2: string[], gameNo?: number) {
  const where = gameNo === undefined ? undefined : { games: [gameNo] }
  if (t1.length !== 2 || t2.length !== 2) throw err(422, CLUB_ERRORS.notTwoVsTwo, '경기는 2 대 2여야 합니다', where)
  const keys = [...t1, ...t2]
  if (new Set(keys).size !== 4) throw err(422, CLUB_ERRORS.duplicatePlayer, '같은 경기에 같은 선수가 두 번 들어갈 수 없습니다', where)
  const bad = keys.filter((k) => !m.participants[k] || m.participants[k]!.left || !isAvailable(db, k))
  if (bad.length) throw err(422, CLUB_ERRORS.notEligible, '이 청백전에서 뛸 수 있는 선수가 아닙니다', { keys: bad, ...where })
  if (m.method === 'team' && (t1.some((k) => m.participants[k]!.team !== 'blue') || t2.some((k) => m.participants[k]!.team !== 'white')))
    throw err(422, CLUB_ERRORS.teamViolation, '팀전은 청팀 2명 대 백팀 2명이어야 합니다', where)
}

/** (AC-140) 확정 전 같은 대진 묶음에 운영진 편집 경기가 있으면 해당 경기 모두 '운영진 수동 변경'(서버 _mark_draft_repeats와 같음) */
function markDraftRepeats(m: MockClubMatch) {
  if (m.status !== 'draft') return
  const groups = new Map<string, MockClubGame[]>()
  for (const g of m.games) groups.set(keyOfGame(g), [...(groups.get(keyOfGame(g)) ?? []), g])
  for (const games of groups.values()) {
    if (games.length < 2 || !games.some((g) => g.manual)) continue
    for (const g of games) {
      g.repeatedMatchup = true
      if (!(g.relaxations ?? []).some((x) => x.rule === 'matchup')) g.relaxations = [...(g.relaxations ?? []), { rule: 'matchup', reason: 'manual' }]
    }
  }
}

/** (C-14 r11) 대진이 있으면 실제 경기 수를 총 경기 수로. 0경기면 기준값 유지 */
const syncTotal = (m: MockClubMatch) => {
  // (B15, C-36 D3·D5·D10) 라운드 기반은 코트를 당기고 빈 라운드를 지우고 라운드 → 코트 순 번호
  if (isRound(m)) normalizeRounds(m)
  else m.games.forEach((g, i) => (g.no = i + 1))
  if (m.games.length) m.totalGames = m.games.length
}

/**
 * 완성 경기 추가(AC-137): 확정 전만, 목록 끝. 미완성 경기는 화면 상태라 저장하지 않음
 * (B15, C-36 D4·AC-149·150) 라운드 기반은 round 필수: 기존 라운드(빈 코트가 있을 때) 또는 마지막 + 1(라운드 추가)
 */
export async function addClubGame(id: string, version: number, team1: [string, string], team2: [string, string], round?: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/games/manual`, { team1, team2, version, ...(round === undefined ? {} : { round }) })
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    checkLineup(db, m, team1, team2)
    if (m.games.length >= MAX_CLUB_GAMES) throw err(422, CLUB_ERRORS.maxGames, `경기는 ${MAX_CLUB_GAMES}개까지 만들 수 있습니다`)
    let place: { round: number; court: number } | null = null
    if (isRound(m)) {
      const last = lastRound(m)
      if (round === undefined || round < 1 || round > last + 1) throw err(422, CLUB_ERRORS.invalidRound, '없는 라운드입니다', { lastRound: last })
      const inRound = m.games.filter((g) => g.round === round)
      if (inRound.length >= (m.courtCount ?? 0)) throw err(422, CLUB_ERRORS.courtFull, `${round}라운드에 빈 코트가 없습니다`)
      const busy = [...roundBusy(m, round)].filter((k) => [...team1, ...team2].includes(k)).sort()
      if (busy.length) throw err(422, CLUB_ERRORS.roundConflict, '같은 라운드에 이미 출전하는 사람이 있습니다', { keys: busy, round })
      place = { round, court: inRound.length + 1 }
    }
    m.games.push({ no: m.games.length + 1, team1: [...team1], team2: [...team2], winner: null, genderRelaxed: false, manual: true, relaxations: [], ...(place ?? {}) })
    syncTotal(m)
    refreshFlags(db, m)
    markDraftRepeats(m)
  }, 200)
}

/** 경기 삭제(AC-138): 확정 전만. 번호 재정렬, 총 경기 수 = 실제 경기 수(0경기면 기준값 유지) */
export async function deleteClubGame(id: string, version: number, gameNo: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.delete<ClubMatchView>(`${base(id)}/games/${gameNo}?version=${version}`)
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    if (!m.games.some((g) => g.no === gameNo)) throw err(404, 'not_found', '경기를 찾을 수 없습니다')
    m.games = m.games.filter((g) => g.no !== gameNo)
    syncTotal(m)
    refreshFlags(db, m)
    markDraftRepeats(m)
  }, 200)
}

/** 대진 전체 폐기(AC-136, '직접 구성' 전환): 확정 전만. 총 경기 수(기준값)는 그대로 */
export async function discardClubGames(id: string, version: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.delete<ClubMatchView>(`${base(id)}/games?version=${version}`)
  return mutate(id, version, (m) => {
    draftOnly(m)
    dropGames(m)
  }, 150)
}

/** 개인전 같은 경기 맞교환(AC-139): 확정 전만, 대상(out)과 상대 조(in)의 자리를 바꿈 */
export async function exchangeClubGame(id: string, version: number, gameNo: number, out: string, into: string): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/games/${gameNo}/exchange`, { out, in: into, version })
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    if (m.method !== 'individual') throw err(422, CLUB_ERRORS.exchangeNotAllowed, '팀전은 같은 경기 맞교환을 할 수 없습니다')
    const g = m.games.find((x) => x.no === gameNo)
    if (!g) throw err(404, 'not_found', '경기를 찾을 수 없습니다')
    const sideOf = (k: string) => (g.team1.includes(k) ? 1 : g.team2.includes(k) ? 2 : 0)
    const a = sideOf(out)
    const b = sideOf(into)
    if (!a || !b || a === b) throw err(409, CLUB_ERRORS.conflict, '대진이 바뀌었습니다', { version: m.version })
    const swapIn = (t: [string, string]) => t.map((k) => (k === out ? into : k === into ? out : k)) as [string, string]
    g.team1 = swapIn(g.team1)
    g.team2 = swapIn(g.team2)
    g.manual = true
    refreshFlags(db, m)
    markDraftRepeats(m)
  }, 200)
}

/** (B15, C-36 D6·AC-152) 확정 전 경기를 다른 기존 라운드로 옮김: 빈 코트(court_full)·같은 라운드 출전(round_conflict) 검사, 원래 라운드는 코트를 당기고 비면 지움 */
export async function moveClubGame(id: string, version: number, gameNo: number, round: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/games/${gameNo}/move`, { round, version })
  return mutate(id, version, (m, db) => {
    draftOnly(m)
    if (!isRound(m)) throw err(422, CLUB_ERRORS.invalidRound, '라운드 정보가 없는 청백전입니다')
    const g = m.games.find((x) => x.no === gameNo)
    if (!g) throw err(404, 'not_found', '경기를 찾을 수 없습니다')
    const rounds = new Set(m.games.map((x) => x.round))
    if (round === g.round || !rounds.has(round)) throw err(422, CLUB_ERRORS.invalidRound, '옮길 수 없는 라운드입니다', { round })
    const target = m.games.filter((x) => x.round === round)
    if (target.length >= (m.courtCount ?? 0)) throw err(422, CLUB_ERRORS.courtFull, `${round}라운드에 빈 코트가 없습니다`)
    const busy = [...roundBusy(m, round)].filter((k) => playersOf(g).includes(k)).sort()
    if (busy.length) throw err(422, CLUB_ERRORS.roundConflict, '옮길 라운드에 이미 출전하는 사람이 있습니다', { keys: busy, round })
    g.round = round
    g.court = target.length + 1
    g.manual = true
    normalizeRounds(m)
    refreshFlags(db, m)
    markDraftRepeats(m)
  }, 200)
}

const processed = (g: MockClubGame) => g.winner !== null || !!g.cancelled
const beginLive = (m: MockClubMatch) => {
  if (m.status !== 'confirmed') throw err(409, CLUB_ERRORS.locked, '진행 중인 청백전에서만 할 수 있습니다')
  if (!isRound(m)) throw err(422, CLUB_ERRORS.invalidRound, '라운드 정보가 없는 청백전입니다')
}

/** (B15, C-37 D12·AC-155) 다음 라운드 시작: 진행 라운드의 모든 경기가 결과 기록 또는 취소일 때만. 자동으로 넘어가지 않음 */
export async function nextRound(id: string, version: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/rounds/next`, { version })
  return mutate(id, version, (m) => {
    beginLive(m)
    const current = m.currentRound ?? 1
    if (current >= (lastRound(m) || 1)) throw err(422, CLUB_ERRORS.invalidRound, '마지막 라운드입니다', { currentRound: current })
    const left = m.games.filter((g) => g.round === current && !processed(g)).map((g) => g.no).sort((a, b) => a - b)
    if (left.length) throw err(409, CLUB_ERRORS.roundIncomplete, `처리되지 않은 경기 ${left.length}개가 있습니다`, { games: left, currentRound: current })
    m.currentRound = current + 1
  }, 150)
}

/** (B15, C-37 Q-032 A2·AC-156) 라운드 시작 취소: 진행 라운드에 결과·취소가 없을 때만 이전 라운드로 */
export async function undoRound(id: string, version: number): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/rounds/undo`, { version })
  return mutate(id, version, (m) => {
    beginLive(m)
    const current = m.currentRound ?? 1
    if (current <= 1) throw err(422, CLUB_ERRORS.invalidRound, '1라운드는 시작을 취소할 수 없습니다')
    if (m.games.some((g) => g.round === current && processed(g))) throw err(409, CLUB_ERRORS.roundHasResults, '이 라운드에 결과나 취소가 있어 시작을 취소할 수 없습니다', { currentRound: current })
    m.currentRound = current - 1
  }, 150)
}

/**
 * 중도 귀가(AC-078): '이후 대진에서 제외'와 남은 경기 대체를 한 번에(P-7 원자적). P-4-b 불가피한 중복만 예외 허용
 * (B15, C-37·AC-159·160) 라운드 기반: 후보는 그 경기 라운드에 출전하지 않는 사람. 후보가 없는 경기는 cancel로 취소를 확인해야 함
 * (없으면 no_substitute). 후보가 있는 경기의 취소는 cancel_not_allowed. 같은 요청에서 같은 라운드에 같은 사람 두 번은 round_conflict
 */
export async function excludeWithSubstitutes(id: string, version: number, leaver: string, assignments: { gameNo: number; to: string }[], cancel: number[] = []): Promise<ClubMatchView> {
  if (dataSource === 'api') return api.post<ClubMatchView>(`${base(id)}/participants/${encodeURIComponent(leaver)}/leave`, { assignments, version, ...(cancel.length ? { cancel } : {}) })
  return mutate(id, version, (m, db) => {
    if (m.status !== 'confirmed') throw err(409, CLUB_ERRORS.locked, '확정 후에만 제외할 수 있습니다')
    const part = m.participants[leaver]
    if (!part) throw err(404, 'not_found', '참가자를 찾을 수 없습니다')
    if (part.left) throw err(409, CLUB_ERRORS.conflict, '이미 제외된 선수입니다', { version: m.version })
    const rounds = isRound(m)
    if (cancel.length && !rounds) throw err(422, CLUB_ERRORS.cancelNotAllowed, '이 청백전은 경기를 취소할 수 없습니다')
    // 요청 전 대진(스냅숏) 기준으로 후보를 판정(서버와 같음)
    const live = liveGames(m)
    const seats = new Map(live.map((g) => [g.no, [[...g.team1], [...g.team2]] as [[string, string], [string, string]]]))
    const roundOf = new Map(live.map((g) => [g.no, g.round ?? null]))
    const busyOf = new Map(live.map((g) => [g.no, rounds ? roundBusy(m, g.round, g.no) : new Set<string>()]))
    const remaining = live.filter((g) => !g.winner && playersOf(g).includes(leaver)).map((g) => g.no).sort((a, b) => a - b)
    const asked = [...assignments.map((a) => a.gameNo), ...cancel]
    const pool = Object.keys(m.participants).filter((k) => k !== leaver && playable(db, m, k, part.team))
    const candidates = (no: number) => pool.filter((k) => !seats.get(no)!.flat().includes(k) && !busyOf.get(no)!.has(k))
    let stuck = remaining.filter((no) => candidates(no).length === 0)
    const unasked = remaining.filter((no) => !asked.includes(no))
    if (new Set(asked).size !== asked.length || asked.some((no) => !remaining.includes(no)) || (unasked.length && !(rounds && unasked.every((no) => stuck.includes(no)))))
      throw err(409, CLUB_ERRORS.conflict, '남은 경기가 바뀌었습니다', { version: m.version, games: remaining })
    if (rounds) {
      const wrong = cancel.filter((no) => candidates(no).length)
      if (wrong.length) throw err(422, CLUB_ERRORS.cancelNotAllowed, '대체할 수 있는 선수가 있는 경기는 취소할 수 없습니다', { games: wrong })
      stuck = stuck.filter((no) => !cancel.includes(no))
    }
    if (stuck.length) throw err(422, CLUB_ERRORS.noSubstitute, rounds ? '대체할 사람이 없는 경기의 취소를 확인해 주세요' : '대체할 수 있는 선수가 없는 경기가 있어 중도 귀가를 처리할 수 없습니다', { games: stuck })
    if (rounds) {
      const perRoundPick = new Map<string, number>()
      for (const a of assignments) {
        const rk = `${roundOf.get(a.gameNo)}|${a.to}`
        perRoundPick.set(rk, (perRoundPick.get(rk) ?? 0) + 1)
      }
      const twice = [...new Set([...perRoundPick].filter(([, n]) => n > 1).map(([rk]) => rk.slice(rk.indexOf('|') + 1)))].sort()
      if (twice.length) throw err(422, CLUB_ERRORS.roundConflict, '같은 라운드에 같은 사람을 두 번 넣을 수 없습니다', { keys: twice })
    }
    for (const a of assignments) {
      if (a.to === leaver) throw err(422, CLUB_ERRORS.notEligible, '제외할 선수로는 대체할 수 없습니다')
      activeOrFail(db, m, a.to)
      if (rounds && !candidates(a.gameNo).includes(a.to)) throw err(422, CLUB_ERRORS.roundConflict, '같은 라운드에 이미 출전하는 사람입니다', { keys: [a.to], games: [a.gameNo] })
      replaceIn(db, m, a.gameNo, leaver, a.to)
    }
    // 최종 대진(모든 대체 반영)에서 같은 대진 판정. 취소할 경기는 뺌
    const liveSeats = new Map([...seats].filter(([no]) => !cancel.includes(no)))
    const { avoidable, forced } = substituteDecision(liveSeats, leaver, new Map(assignments.map((a) => [a.gameNo, a.to])), candidates)
    if (avoidable.length) throw err(409, CLUB_ERRORS.sameMatchup, '같은 4명·같은 팀 구성을 피할 수 있는 대체 선수가 있습니다', { games: [...avoidable].sort((a, b) => a - b) })
    const now = new Date().toISOString()
    for (const no of cancel) {
      const g = m.games.find((x) => x.no === no)!
      g.cancelled = { at: now, reason: CANCEL_LEFT }
      g.changed = true // 회원 화면 대진 수정 표시(C-37)
      m.events = [...(m.events ?? []), { gameNo: no, action: 'cancel', at: now, reason: CANCEL_LEFT, detail: {} }]
    }
    part.left = true
    if (assignments.length || cancel.length) {
      m.modifiedAt = now
      refreshFlags(db, m, forced)
    }
  })
}

/** 취소 사유: 중도 귀가(서버 LEFT) */
export const CANCEL_LEFT = 'left'

// ── 다른 기능과의 연결 ──

/** 게스트 삭제 분기(C-26, SCR-212 ST8·ST10·ST11): 확정된 미종료 청백전 미기록 경기 / 확정 전 대진 / 참가자로만 */
export function guestClubInvolvement(db: MockDb, guestId: string): { kind: 'confirmedMatch'; matchId: string; matchName: string; remaining: number } | { kind: 'draftLineup'; place: string } | { kind: 'participantOnly'; matchName: string } | null {
  ensureSeed(db)
  const key = `guest:${guestId}`
  for (const m of db.clubMatches!) {
    if (m.status !== 'confirmed') continue
    const remaining = m.games.filter((g) => !g.winner && [...g.team1, ...g.team2].includes(key)).length
    if (remaining > 0) return { kind: 'confirmedMatch', matchId: m.id, matchName: m.name, remaining }
  }
  for (const m of db.clubMatches!) if (m.status === 'draft' && m.games.some((g) => [...g.team1, ...g.team2].includes(key))) return { kind: 'draftLineup', place: m.name }
  for (const m of db.clubMatches!) if (m.status !== 'finished' && key in m.participants) return { kind: 'participantOnly', matchName: m.name }
  return null
}

/** 게스트 삭제 시 확정 전 청백전 대진 폐기·참가자 제거를 한 번에(C-26) */
export function removeGuestFromClubMatches(db: MockDb, guestId: string) {
  ensureSeed(db)
  const key = `guest:${guestId}`
  for (const m of db.clubMatches!) {
    if (m.status === 'finished') continue
    if (m.status === 'draft' && m.games.some((g) => [...g.team1, ...g.team2].includes(key))) {
      m.games = []
      m.seed = null
      m.version++
    }
    if (m.status === 'draft') delete m.participants[key]
  }
}

/** 회원 누적 전적(C-07·C-17): 샘플 기본 전적 + 청백전 기록(대체 선수는 실제로 뛴 사람, AC-078). 게스트는 랭크 없음 */
export function clubRecordOf(db: MockDb, memberId: string) {
  ensureSeed(db)
  const key = `member:${memberId}`
  let wins = 0
  let losses = 0
  for (const m of db.clubMatches!) {
    if (m.status === 'draft') continue
    for (const g of m.games) {
      if (!g.winner) continue
      const side = g.team1.includes(key) ? 1 : g.team2.includes(key) ? 2 : 0
      if (!side) continue
      if (side === g.winner) wins++
      else losses++
    }
  }
  return { wins, losses }
}
