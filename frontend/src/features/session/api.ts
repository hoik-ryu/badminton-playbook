import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { readDb, updateDb, type MockDb, type MockRound, type MockSession } from '../../lib/mock/db'
import type { Gender, Grade } from '../auth/types'
import { addToHistory, EMPTY_HISTORY, generateLineup, LineupError, matchupKey, pairKey, skillGap, type History, type Relaxation } from './lineup'

const dataSource = featureSource('session') // 백엔드 미구현: api 모드에서도 Mock

// 실시간 대진 세션(SCR-202–205, FLOW-004, US-008–013·021·022, C-01–C-06·C-10·C-24·C-25, AC-019–041·056·061–064·101–104).
// 운영진 이상만(서버가 최종 검사). 사람 키: 'member:<id>' | 'guest:<id>'
export type Method = 'level' | 'random'
export type Rules = { balance: boolean; gender: boolean; fairness: boolean; noRepeat: boolean }
export type Options = { method: Method; rules: Rules }
export const METHOD_LABEL: Record<Method, string> = { level: '레벨별', random: '무작위' }
/** 완화 배지 이름(UXD-007 예: '성별 완화') */
export const RELAX_LABEL: Record<Relaxation, string> = { gender: '성별 완화', balance: '밸런스 완화', noRepeat: '중복 회피 완화' }

/** 새 세션 기본 옵션 — 승인 명세에 기본값이 없어 SCR-204·202 레이아웃 그림(레벨별, 밸런스·성별·공평성 켜짐, 중복 회피 꺼짐)을 임시로 씀(미정 사항) */
export const DEFAULT_OPTIONS: Options = { method: 'level', rules: { balance: true, gender: true, fairness: true, noRepeat: false } }

export type SessionPerson = { key: string; id: string; kind: 'member' | 'guest'; name: string; gender: Gender; grade: Grade; score: number | null }
export type AttendanceRow = SessionPerson & { attending: boolean; excludedNext: boolean }
export type CourtView = { no: number; team1: SessionPerson[]; team2: SessionPerson[]; gap: number | null; relaxations: Relaxation[] }
export type RoundView = { no: number; status: MockRound['status']; courts: CourtView[]; waiting: (SessionPerson & { games: number })[] }

export type Phase = 'noSession' | 'closed' | 'ready' | 'review' | 'inProgress'
export type SessionView = {
  phase: Phase
  session: { id: string; date: string; status: 'open' | 'closed'; version: number; options: Options; isToday: boolean } | null
  attendance: AttendanceRow[]
  summary: { count: number; male: number; female: number; unscored: SessionPerson[] }
  /** 확정 전 대진(검토) 또는 진행 중 라운드 */
  current: RoundView | null
  /** 다음에 만들 라운드 번호 */
  nextRoundNo: number
  completed: RoundView[]
  /** 이전 날짜 미종료 세션(여러 개면 가장 오래된 하나 — 여러 개 처리 방식은 기획 미정) */
  stale: { id: string; date: string } | null
  courtCount: number
}

export const SESSION_ERRORS = {
  minPlayers: 'min_players',
  unscored: 'unscored_players',
  roundInProgress: 'round_in_progress',
  closed: 'session_closed',
  conflict: 'conflict',
} as const

/** KST 날짜 YYYY-MM-DD */
export const kstDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

const people = (db: MockDb): Map<string, SessionPerson> => {
  const m = new Map<string, SessionPerson>()
  for (const u of db.users) if (u.status === 'approved') m.set(`member:${u.id}`, { key: `member:${u.id}`, id: u.id, kind: 'member', name: u.name, gender: u.gender, grade: u.grade, score: u.score })
  for (const g of db.guests) m.set(`guest:${g.id}`, { key: `guest:${g.id}`, id: g.id, kind: 'guest', name: g.name, gender: g.gender, grade: g.grade, score: g.score })
  return m
}
const history = (s: MockSession): History => s.rounds.filter((r) => r.status === 'completed').reduce((h, r) => addToHistory(h, r), EMPTY_HISTORY)
const unknown = (key: string): SessionPerson => ({ key, id: key.split(':')[1] ?? key, kind: key.startsWith('guest') ? 'guest' : 'member', name: '삭제된 게스트', gender: '남', grade: '입문자', score: null })

function view(db: MockDb, s: MockSession | undefined): SessionView {
  const ps = people(db)
  const today = kstDate()
  const stale = db.sessions.filter((x) => x.status === 'open' && x.date < today).sort((a, b) => a.date.localeCompare(b.date))[0]
  const base = { courtCount: db.courtCount, stale: stale && stale.id !== s?.id ? { id: stale.id, date: stale.date } : null }
  if (!s) return { phase: 'noSession', session: null, attendance: [], summary: { count: 0, male: 0, female: 0, unscored: [] }, current: null, nextRoundNo: 1, completed: [], ...base }
  const h = history(s)
  const toPerson = (k: string) => ps.get(k) ?? unknown(k)
  const roundView = (r: MockRound): RoundView => ({
    no: r.no,
    status: r.status,
    courts: r.courts.map((c) => {
      const t1 = c.team1.map(toPerson)
      const t2 = c.team2.map(toPerson)
      return { no: c.no, team1: t1, team2: t2, gap: skillGap(t1.map((p) => p.score), t2.map((p) => p.score)), relaxations: c.relaxations }
    }),
    waiting: r.waiting.map((k) => ({ ...toPerson(k), games: h.games[k] ?? 0 })),
  })
  const attendance = [...ps.values()].map((p) => ({ ...p, attending: p.key in s.attendance, excludedNext: s.excludedNext.includes(p.key) }))
  const attending = attendance.filter((a) => a.attending)
  const current = s.rounds.find((r) => r.status !== 'completed')
  const phase: Phase = s.status === 'closed' ? 'closed' : current?.status === 'inProgress' ? 'inProgress' : current ? 'review' : 'ready'
  return {
    phase,
    session: { id: s.id, date: s.date, status: s.status, version: s.version, options: s.options, isToday: s.date === today },
    attendance,
    summary: { count: attending.length, male: attending.filter((a) => a.gender === '남').length, female: attending.filter((a) => a.gender === '여').length, unscored: attending.filter((a) => a.score === null) },
    current: current ? roundView(current) : null,
    nextRoundNo: s.rounds.filter((r) => r.status === 'completed').length + 1,
    completed: s.rounds.filter((r) => r.status === 'completed').map(roundView).reverse(),
    ...base,
  }
}

const err = (status: number, code: string, message: string) => new ApiError(status, { code, message })
const find = (db: MockDb, id: string) => {
  const s = db.sessions.find((x) => x.id === id)
  if (!s) throw err(404, 'not_found', '세션을 찾을 수 없습니다')
  return s
}
const openOnly = (s: MockSession) => {
  if (s.status === 'closed') throw err(409, SESSION_ERRORS.closed, '오늘 세션은 종료되었습니다')
}

/** 세션 화면 데이터: id가 없으면 오늘(KST) 세션 */
export async function getSessionView(id?: string): Promise<SessionView> {
  if (dataSource === 'api') return api.get<SessionView>(id ? `/api/sessions/${encodeURIComponent(id)}` : '/api/sessions/today')
  const db = readDb()
  const s = id ? db.sessions.find((x) => x.id === id) : db.sessions.find((x) => x.date === kstDate())
  return mockDelay(view(db, s), 200)
}

/** '오늘 운동 시작'(AC-019, AC-103): 오늘 세션이 있으면 그 세션을 엶. 종료된 오늘 세션이 있으면 거부(AC-104) */
export async function startToday(): Promise<SessionView> {
  if (dataSource === 'api') return api.post<SessionView>('/api/sessions/today')
  await mockDelay(null, 200)
  return updateDb((db) => {
    const today = kstDate()
    let s = db.sessions.find((x) => x.date === today)
    if (s?.status === 'closed') throw err(409, SESSION_ERRORS.closed, '오늘 세션은 종료되었습니다')
    if (!s) {
      s = { id: `s-${today}`, date: today, status: 'open', attendance: {}, checkSeq: 0, excludedNext: [], options: structuredClone(DEFAULT_OPTIONS), rounds: [], version: 1 }
      db.sessions.push(s)
    }
    return view(db, s)
  })
}

/** 참석 체크·해제(AC-019·020·021): 즉시 저장. 진행 중 경기 선수를 빼면 '다음 라운드부터 제외' */
export async function setAttendance(sessionId: string, key: string, attending: boolean): Promise<void> {
  if (dataSource === 'api') {
    await api.put(`/api/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(key)}`, { attending })
    return
  }
  await mockDelay(null, 150)
  updateDb((db) => {
    const s = find(db, sessionId)
    openOnly(s)
    if (attending) {
      s.attendance[key] ??= ++s.checkSeq
      s.excludedNext = s.excludedNext.filter((k) => k !== key)
    } else {
      delete s.attendance[key]
      const playing = s.rounds.find((r) => r.status === 'inProgress')?.courts.some((c) => [...c.team1, ...c.team2].includes(key))
      if (playing && !s.excludedNext.includes(key)) s.excludedNext.push(key)
    }
  })
}

/** 대진 옵션(AC-022·023): 즉시 저장, 다음 생성부터 반영, 같은 세션 다음 라운드에도 유지 */
export async function setOptions(sessionId: string, options: Options): Promise<void> {
  if (dataSource === 'api') {
    await api.put(`/api/sessions/${encodeURIComponent(sessionId)}/options`, options)
    return
  }
  await mockDelay(null, 150)
  updateDb((db) => {
    const s = find(db, sessionId)
    openOnly(s)
    s.options = structuredClone(options)
  })
}

/** 대진 생성·다시 생성(AC-024–036): 다시 생성은 새 시드, 세션 이력은 그대로 */
export async function generateRound(sessionId: string): Promise<void> {
  if (dataSource === 'api') {
    await api.post(`/api/sessions/${encodeURIComponent(sessionId)}/rounds`)
    return
  }
  await mockDelay(null, 500)
  updateDb((db) => {
    const s = find(db, sessionId)
    openOnly(s)
    if (s.rounds.some((r) => r.status === 'inProgress')) throw err(409, SESSION_ERRORS.roundInProgress, '현재 라운드를 먼저 완료하세요')
    const ps = people(db)
    const attendees = Object.entries(s.attendance)
      .map(([key, order]) => ({ p: ps.get(key), order }))
      .filter((x): x is { p: NonNullable<typeof x.p>; order: number } => !!x.p)
    if (attendees.length < 4) throw err(422, SESSION_ERRORS.minPlayers, '최소 4명이 필요합니다')
    if (attendees.some((x) => x.p.score === null)) throw err(422, SESSION_ERRORS.unscored, '점수 미설정 참석자가 있습니다')
    const seed = Math.floor(Math.random() * 2 ** 31)
    let lineup
    try {
      lineup = generateLineup({ players: attendees.map((x) => ({ key: x.p.key, gender: x.p.gender, score: x.p.score!, checkOrder: x.order })), courts: db.courtCount, method: s.options.method, rules: s.options.rules, history: history(s), seed })
    } catch (e) {
      if (e instanceof LineupError) throw err(422, SESSION_ERRORS.minPlayers, '최소 4명이 필요합니다')
      throw e
    }
    const no = s.rounds.filter((r) => r.status === 'completed').length + 1
    s.rounds = s.rounds.filter((r) => r.status !== 'draft')
    s.rounds.push({ no, seed, status: 'draft', courts: lineup.courts, waiting: lineup.waiting })
    s.version++
  })
}

/** 확정(AC-037, AC-056): 화면이 본 버전과 다르면 충돌(C-10) */
export async function confirmRound(sessionId: string, version: number): Promise<void> {
  if (dataSource === 'api') {
    await api.post(`/api/sessions/${encodeURIComponent(sessionId)}/rounds/confirm`, { version })
    return
  }
  await mockDelay(null, 300)
  updateDb((db) => {
    const s = find(db, sessionId)
    openOnly(s)
    const draft = s.rounds.find((r) => r.status === 'draft')
    if (!draft || s.version !== version) throw err(409, SESSION_ERRORS.conflict, '다른 운영진이 대진을 변경했습니다')
    draft.status = 'inProgress'
    s.version++
  })
}

/** 라운드 완료(AC-038): 이력 누적, 다음 라운드부터 제외된 사람 정리 */
export async function completeRound(sessionId: string): Promise<void> {
  if (dataSource === 'api') {
    await api.post(`/api/sessions/${encodeURIComponent(sessionId)}/rounds/complete`)
    return
  }
  await mockDelay(null, 300)
  updateDb((db) => {
    const s = find(db, sessionId)
    const r = s.rounds.find((x) => x.status === 'inProgress')
    if (!r) throw err(409, SESSION_ERRORS.conflict, '이미 처리된 요청입니다')
    r.status = 'completed'
    s.excludedNext = []
    s.version++
  })
}

/** 세션 종료(AC-101·102·104): 진행 중 라운드가 있으면 거부, 확정 전 대진은 폐기 */
export async function closeSession(sessionId: string): Promise<void> {
  if (dataSource === 'api') {
    await api.post(`/api/sessions/${encodeURIComponent(sessionId)}/close`)
    return
  }
  await mockDelay(null, 300)
  updateDb((db) => {
    const s = find(db, sessionId)
    openOnly(s)
    if (s.rounds.some((r) => r.status === 'inProgress')) throw err(409, SESSION_ERRORS.roundInProgress, '진행 중인 라운드를 먼저 완료하세요')
    s.rounds = s.rounds.filter((r) => r.status !== 'draft')
    s.status = 'closed'
    s.version++
  })
}

export type SwapCandidate = { key: string; person: SessionPerson; from: 'waiting' | { court: number }; gapAfter: number | null; disabledReason: string | null; warnings: Relaxation[] }

/** 교체 후보(SCR-205, AC-064, UXD-008·009): 대기자 먼저, 다른 경기 선수. 같은 날 같은 경기가 되면 비활성, 규칙 위반은 경고 */
export function swapCandidates(v: SessionView, targetKey: string): SwapCandidate[] {
  if (!v.current || !v.session) return []
  const courts = v.current.courts
  const at = courts.find((c) => [...c.team1, ...c.team2].some((p) => p.key === targetKey))
  if (!at) return []
  const db = dataSource === 'mock' ? readDb() : null
  const s = db?.sessions.find((x) => x.id === v.session!.id)
  const h = s ? history(s) : EMPTY_HISTORY
  const matchups = new Set(h.matchups)
  const partners = new Set(h.partners)
  const rules = v.session.options.rules
  const target = [...at.team1, ...at.team2].find((p) => p.key === targetKey)!

  const replace = (team: SessionPerson[], from: string, to: SessionPerson) => team.map((p) => (p.key === from ? to : p))
  const check = (c: CourtView, out: string, inn: SessionPerson) => {
    const t1 = replace(c.team1, out, inn)
    const t2 = replace(c.team2, out, inn)
    const same = matchups.has(matchupKey(t1.map((p) => p.key), t2.map((p) => p.key)))
    const warn: Relaxation[] = []
    if (rules.noRepeat && [t1, t2].some((t) => partners.has(pairKey(t[0]!.key, t[1]!.key)))) warn.push('noRepeat')
    const males = [...t1, ...t2].filter((p) => p.gender === '남').length
    const genderBad = males === 2 ? t1.filter((p) => p.gender === '남').length !== 1 : males === 1 || males === 3
    if (rules.gender && genderBad) warn.push('gender')
    return { t1, t2, same, warn }
  }

  const out: SwapCandidate[] = []
  for (const w of v.current.waiting) {
    const r = check(at, targetKey, w)
    out.push({ key: w.key, person: w, from: 'waiting', gapAfter: skillGap(r.t1.map((p) => p.score), r.t2.map((p) => p.score)), disabledReason: r.same ? '같은 날 같은 경기가 됩니다' : null, warnings: r.warn })
  }
  for (const c of courts) {
    if (c.no === at.no) continue
    for (const p of [...c.team1, ...c.team2]) {
      const mine = check(at, targetKey, p)
      const theirs = check(c, p.key, target)
      const same = mine.same || theirs.same
      out.push({ key: p.key, person: p, from: { court: c.no }, gapAfter: skillGap(mine.t1.map((x) => x.score), mine.t2.map((x) => x.score)), disabledReason: same ? '같은 날 같은 경기가 됩니다' : null, warnings: [...new Set([...mine.warn, ...theirs.warn])] })
    }
  }
  return out
}

/** 맞바꾸기(SCR-205, AC-035): 확정 전 대진만. 위반은 코트 카드에 경고(완화 배지와 같은 방식, UXD-009) */
export async function swapPlayers(sessionId: string, version: number, a: string, b: string): Promise<void> {
  if (dataSource === 'api') {
    await api.post(`/api/sessions/${encodeURIComponent(sessionId)}/rounds/swap`, { version, a, b })
    return
  }
  await mockDelay(null, 200)
  updateDb((db) => {
    const s = find(db, sessionId)
    openOnly(s)
    const draft = s.rounds.find((r) => r.status === 'draft')
    if (!draft || s.version !== version) throw err(409, SESSION_ERRORS.conflict, '다른 운영진이 대진을 변경했습니다')
    const sw = (k: string) => (k === a ? b : k === b ? a : k)
    for (const c of draft.courts) {
      c.team1 = c.team1.map(sw) as [string, string]
      c.team2 = c.team2.map(sw) as [string, string]
    }
    draft.waiting = draft.waiting.map(sw)
    // 바뀐 코트의 규칙 위반 다시 표시
    const h = history(s)
    const partners = new Set(h.partners)
    const ps = people(db)
    for (const c of draft.courts) {
      if (![...c.team1, ...c.team2].some((k) => k === a || k === b)) continue
      const g = (k: string) => ps.get(k)?.gender
      const males = [...c.team1, ...c.team2].filter((k) => g(k) === '남').length
      const genderBad = males === 2 ? c.team1.filter((k) => g(k) === '남').length !== 1 : males === 1 || males === 3
      const relax = new Set<Relaxation>(c.relaxations.filter((x) => x === 'balance'))
      if (s.options.rules.noRepeat && (partners.has(pairKey(...c.team1)) || partners.has(pairKey(...c.team2)))) relax.add('noRepeat')
      if (s.options.rules.gender && genderBad) relax.add('gender')
      c.relaxations = [...relax]
    }
    s.version++
  })
}

/** 게스트 삭제 분기용(C-26): 오늘·이전 세션의 대진 포함 여부 */
export function guestSessionInvolvement(db: MockDb, guestId: string): { kind: 'inRound' } | { kind: 'draftLineup'; place: string } | null {
  const key = `guest:${guestId}`
  for (const s of db.sessions) {
    if (s.status === 'closed') continue
    for (const r of s.rounds) {
      const inIt = r.courts.some((c) => [...c.team1, ...c.team2].includes(key))
      if (inIt && r.status === 'inProgress') return { kind: 'inRound' }
      if (inIt && r.status === 'draft') return { kind: 'draftLineup', place: '오늘 운동' }
    }
  }
  return null
}

/** 게스트 삭제 시 확정 전 대진 폐기·참석 제거를 한 번에(C-26 원자적 처리) */
export function discardGuestFromSessions(db: MockDb, guestId: string) {
  const key = `guest:${guestId}`
  for (const s of db.sessions) {
    if (s.rounds.some((r) => r.status === 'draft' && r.courts.some((c) => [...c.team1, ...c.team2].includes(key)))) {
      s.rounds = s.rounds.filter((r) => r.status !== 'draft')
      s.version++
    }
    delete s.attendance[key]
  }
}

/** 개발 도구: 이전 날짜 미종료 세션 만들기(ST10 확인용) */
export function devCreateStaleSession() {
  updateDb((db) => {
    const y = kstDate(new Date(Date.now() - 2 * 86400000))
    if (db.sessions.some((s) => s.date === y)) return
    db.sessions.push({ id: `s-${y}`, date: y, status: 'open', attendance: {}, checkSeq: 0, excludedNext: [], options: structuredClone(DEFAULT_OPTIONS), rounds: [], version: 1 })
  })
}
