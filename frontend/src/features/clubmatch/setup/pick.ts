import { matchupKey } from '../../session/lineup'
import type { ClubMatchView, ParticipantRow, Team } from '../api'
import { gap } from '../schedule'

// SCR-225 선수 선택·교체 시트의 후보 판정(UX Spec r10 02 SCR-225, UXD-102·040, C-19 r11·C-35) — 화면 재현 규칙
// 서버(router.py _check_lineup·swap·exchange)가 최종 판정하고, 여기서는 화면에 구역·상태·경기 수·실력차를 미리 보여 줍니다.
// - 구역: '같은 경기 맞교환'(개인전·확정 전·선수 자리) · '다른 참가자와 교체'(빈 자리면 '선수 선택')
// - 상태: 선택 가능 / 경고(확정 전 같은 대진 반복·경기 수 차이 2 이상, 고를 수 있음) / 선택 불가(같은 경기에 이미 있음, 확정 후 같은 대진)
// - 팀전은 그 자리 팀(1팀 = 청, 2팀 = 백)의 참가자만, 제외(귀가)·비활성 회원·삭제된 게스트는 후보에 없음(P-5)
// - (r14, C-36·SCR-225-ST13) 라운드 기반: 같은 라운드의 다른 경기에 출전하는 사람은 선택 불가('이 라운드에 이미 출전 · n경기 코트 m').
//   취소된 경기는 출전으로 세지 않음(C-37). 그 라운드 휴식자는 기존 정렬 안의 선택 가능 행

export type Slot = string | null
/** 화면의 경기 한 줄: 저장된 경기(saved) 또는 화면에만 있는 미완성 경기. (r14) round·court: 라운드 기반 청백전(없으면 null), cancelled: 취소된 경기 */
export type Lineup = { id: string; no: number; t1: [Slot, Slot]; t2: [Slot, Slot]; saved: boolean; winner?: 1 | 2 | null; round?: number | null; court?: number | null; cancelled?: boolean }
export type PickTarget = { id: string; side: 0 | 1; idx: 0 | 1 }
export type PickCandidate = {
  row: ParticipantRow
  section: 'swap' | 'replace'
  state: 'ok' | 'warn' | 'off'
  games: number
  gapAfter: number | null
  /** 화면 배지: '같은 대진 반복' · '경기 수 차이 2' */
  warns: string[]
  sameMatchup: boolean
  diffAfter: number
  reason?: string
  next: Lineup
}

/** 자리의 팀 이름: 팀전 청팀·백팀, 개인전 1팀·2팀(C-24) */
export const teamLabelOf = (v: Pick<ClubMatchView, 'method'>, side: 0 | 1) => (v.method === 'team' ? (side === 0 ? '청팀' : '백팀') : side === 0 ? '1팀' : '2팀')

export const SAME_GAME_REASON = '같은 경기에 이미 있습니다'
export const CONFIRMED_REPEAT_REASON = '다른 경기와 같은 대진이 됩니다'
export const REPEAT_BADGE = '같은 대진 반복'
/** (r14) 같은 라운드 출전 사유 */
export const roundBusyReason = (o: Pick<Lineup, 'no' | 'court'>) => `이 라운드에 이미 출전 · ${o.no}경기 코트 ${o.court}`

export const seats = (l: Lineup) => [...l.t1, ...l.t2]
export const filled = (l: Lineup) => seats(l).filter((k): k is string => !!k)
export const isComplete = (l: Lineup) => filled(l).length === 4
export const slotOf = (l: Lineup, side: 0 | 1, idx: 0 | 1): Slot => (side === 0 ? l.t1 : l.t2)[idx]
/** 같은 4명·같은 조(경기 대진 비교 키) */
export const lineupKey = (l: Lineup) => matchupKey(l.t1 as string[], l.t2 as string[])
const keyOf = lineupKey

export function put(l: Lineup, side: 0 | 1, idx: 0 | 1, key: Slot): Lineup {
  const s = [...(side === 0 ? l.t1 : l.t2)] as [Slot, Slot]
  s[idx] = key
  return side === 0 ? { ...l, t1: s } : { ...l, t2: s }
}

/** 같은 경기 맞교환: 대상 자리 ↔ 상대 조의 그 사람 자리 */
export function exchange(l: Lineup, t: PickTarget, other: string): Lineup {
  const me = slotOf(l, t.side, t.idx)
  const os = (t.side === 0 ? 1 : 0) as 0 | 1
  const oi = (os === 0 ? l.t1 : l.t2).indexOf(other) as 0 | 1
  return put(put(l, t.side, t.idx, other), os, oi, me)
}

/** 저장된 경기만 센 사람별 경기 수(미완성 경기는 화면 상태라 세지 않음) */
export function gameCounts(rows: ParticipantRow[], lineups: Lineup[]) {
  const c = new Map<string, number>(rows.filter((r) => r.participating).map((r) => [r.key, 0]))
  for (const l of lineups) if (l.saved && isComplete(l)) for (const k of filled(l)) c.set(k, (c.get(k) ?? 0) + 1)
  return c
}
const spread = (c: Map<string, number>) => {
  const v = [...c.values()]
  return v.length ? Math.max(...v) - Math.min(...v) : 0
}

export function lineupsOf(v: ClubMatchView): Lineup[] {
  return v.games.map((g) => ({ id: `g${g.no}`, no: g.no, t1: [g.team1[0]?.key ?? null, g.team1[1]?.key ?? null], t2: [g.team2[0]?.key ?? null, g.team2[1]?.key ?? null], saved: true, winner: g.winner, round: g.round ?? null, court: g.court ?? null, cancelled: !!g.cancelled }))
}

const sideTeam = (side: 0 | 1): Team => (side === 0 ? 'blue' : 'white')

/** 후보 목록: 구역(맞교환 먼저) → 선택 가능·경고 → 선택 불가, 구역 안은 경기 수 적은 순 → 이름순(UXD-040) */
export function pickCandidates(v: ClubMatchView, lineups: Lineup[], t: PickTarget, confirmed = v.status !== 'draft'): PickCandidate[] {
  const l = lineups.find((x) => x.id === t.id)
  if (!l) return []
  const me = slotOf(l, t.side, t.idx)
  const rows = new Map(v.rows.map((r) => [r.key, r]))
  const score = (k: Slot) => (k ? (rows.get(k)?.score ?? null) : null)
  const counts = gameCounts(v.rows, lineups)
  const before = spread(counts)
  const inGame = new Set(filled(l))
  const others = lineups.filter((x) => x.id !== l.id && isComplete(x) && x.saved && !x.cancelled).map(keyOf)
  const sameRound = l.round != null ? lineups.filter((x) => x.id !== l.id && x.round === l.round && !x.cancelled) : []
  const judge = (row: ParticipantRow, section: PickCandidate['section'], next: Lineup): PickCandidate => {
    const done = isComplete(next)
    // 바꾼 뒤 사람별 경기 수: 저장된 경기의 교체는 나가는 사람 -1·들어오는 사람 +1(맞교환은 변화 없음),
    // 미완성 경기는 네 자리가 차서 저장될 때만 네 명 모두 +1
    const after = new Map(counts)
    if (l.saved && section === 'replace' && me) {
      after.set(me, (after.get(me) ?? 0) - 1)
      after.set(row.key, (after.get(row.key) ?? 0) + 1)
    } else if (!l.saved && done) for (const k of filled(next)) after.set(k, (after.get(k) ?? 0) + 1)
    const diffAfter = spread(after)
    const repeat = done && others.includes(keyOf(next))
    const gapAfter = done ? gap(next.t1.map(score), next.t2.map(score)) : null
    const base = { row, section, games: counts.get(row.key) ?? 0, gapAfter, diffAfter, sameMatchup: repeat, next }
    if (repeat && confirmed) return { ...base, state: 'off', warns: [], reason: CONFIRMED_REPEAT_REASON }
    const warns = [...(repeat ? [REPEAT_BADGE] : []), ...(diffAfter >= 2 && diffAfter > before ? [`경기 수 차이 ${diffAfter}`] : [])]
    return { ...base, state: warns.length ? 'warn' : 'ok', warns }
  }
  const out: PickCandidate[] = []
  // ① 같은 경기 맞교환(개인전·확정 전·선수 자리)
  if (v.method === 'individual' && !confirmed && me) {
    for (const k of (t.side === 0 ? l.t2 : l.t1).filter((x): x is string => !!x)) {
      const row = rows.get(k)
      if (row) out.push(judge(row, 'swap', exchange(l, t, k)))
    }
  }
  // ② 다른 참가자와 교체 / 선수 선택
  const team = v.method === 'team' ? sideTeam(t.side) : null
  for (const row of v.rows) {
    if (!row.participating || row.left || !row.available || row.key === me) continue
    if (team && row.team !== team) continue
    if (out.some((c) => c.row.key === row.key)) continue
    if (inGame.has(row.key)) {
      out.push({ row, section: 'replace', state: 'off', games: counts.get(row.key) ?? 0, gapAfter: null, diffAfter: 0, sameMatchup: false, warns: [], reason: SAME_GAME_REASON, next: l })
      continue
    }
    const busy = sameRound.find((x) => filled(x).includes(row.key))
    if (busy) {
      out.push({ row, section: 'replace', state: 'off', games: counts.get(row.key) ?? 0, gapAfter: null, diffAfter: 0, sameMatchup: false, warns: [], reason: roundBusyReason(busy), next: l })
      continue
    }
    out.push(judge(row, 'replace', put(l, t.side, t.idx, row.key)))
  }
  const rank = (c: PickCandidate) => (c.state === 'off' ? 1 : 0)
  return out.sort((a, b) => (a.section === b.section ? 0 : a.section === 'swap' ? -1 : 1) || rank(a) - rank(b) || a.games - b.games || a.row.name.localeCompare(b.row.name, 'ko'))
}

export type MoveOption = { round: number; free: number; reason?: string }

/** (r14, SCR-244-ST20) 옮길 수 있는 라운드 판정(서버 move_game과 같은 규칙): 저장된 경기 기준 빈 코트, 그 라운드 출전자와 겹침 */
export function moveOptions(view: ClubMatchView, saved: Lineup[], target: Lineup, courts: number): MoveOption[] {
  const names = new Map(view.rows.map((r) => [r.key, r.name]))
  const people = filled(target)
  const rounds = [...new Set(saved.map((l) => l.round ?? 1))].filter((r) => r !== target.round).sort((a, b) => a - b)
  return rounds.map((round) => {
    const inRound = saved.filter((l) => l.round === round)
    const overlap = inRound.filter((l) => isComplete(l) && !l.cancelled).flatMap(filled).filter((k) => people.includes(k))
    const free = courts - inRound.length
    return { round, free, reason: free <= 0 ? '빈 코트 없음' : overlap.length ? `출전 겹침: ${overlap.map((k) => names.get(k) ?? '선수').join(', ')}` : undefined }
  })
}
