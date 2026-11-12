// 실시간 대진 생성기(Mock용 결정적 구현). 실제 생성은 백엔드 소관(NFR-003, '결정적 알고리즘')이며 이 모듈은 같은 규칙을 화면 개발용으로 구현합니다.
// 확정 규칙(기획 C-01–C-06, FR-009·010, AC-024–033, C-24):
//  - 출전 인원: min(코트 수, ⌊참석/4⌋)×4. 4명 미만이면 생성 안 함(AC-026)
//  - 게임 수 공평성(C-04): 오늘 게임 수 적은 사람 → 직전 라운드 대기자 → 참석 체크 순서. 직전 대기자 우선은 FR-009(항상)
//  - 레벨별(C-01): 상 8–10·중 5–7·하 1–4 구간 안에서 4명씩, 모자라면 인접 구간의 가장 가까운 점수로 채움 / 무작위: 점수와 무관하게 4명씩
//  - 밸런스(C-02): 두 팀 점수 합 차이 최소 / 성별(C-03): 혼복 최대, 남는 인원 남복·여복, 그래도 안 되면 불균형 + '성별 완화'
//  - 중복 회피(C-05): 같은 날 파트너 반복 금지, 만난 상대 반복 최소화. 같은 4명·같은 팀 구성은 규칙과 무관하게 항상 금지
//  - 완화 순서(FR-010): 게임 수 공평성 > 중복 회피 > 성별 조합 > 밸런스(낮은 것부터 완화, AC-033)
//  - 같은 입력·같은 시드 → 같은 결과(C-06, AC-028)
// 레벨별 + 성별 조합(P2, 사용자 방향 2026-11-11): 성별 경기 구성(혼복·남복·여복, C-03)을 먼저 맞추고 그 안에서 점수 차이(레벨)가 가장 작은 묶음을 고름.
//   성별을 맞출 수 없으면 '성별 완화'. 점수 구간이 섞이는 것은 완화 배지로 표시하지 않음(생성 방식은 FR-010 완화 규칙이 아님).
// 그 밖의 미정 사항(상대 반복 최소화의 가중, 공평성 꺼짐 시 선발 순서 등)은 docs/workflow-proposals/b3-policy-open-items.md의 임시 처리.

export type Gender = '남' | '여'
export type Method = 'level' | 'random'
export type Rules = { balance: boolean; gender: boolean; fairness: boolean; noRepeat: boolean }
export type Relaxation = 'noRepeat' | 'gender' | 'balance'

export type Player = { key: string; gender: Gender; score: number; checkOrder: number }
export type History = {
  games: Record<string, number>
  lastWaiting: string[]
  /** 파트너였던 쌍 'a|b'(정렬) */
  partners: string[]
  /** 상대였던 쌍 'a|b' → 횟수 */
  opponents: Record<string, number>
  /** 같은 4명·같은 팀 구성 키 */
  matchups: string[]
}
export type Court = { no: number; team1: [string, string]; team2: [string, string]; relaxations: Relaxation[] }
export type Lineup = { courts: Court[]; waiting: string[] }

export const EMPTY_HISTORY: History = { games: {}, lastWaiting: [], partners: [], opponents: {}, matchups: [] }

export class LineupError extends Error {
  constructor(public code: 'min_players') {
    super(code)
  }
}

// ── 결정적 난수(mulberry32) ──
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const shuffle = <T,>(list: T[], r: () => number) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
export const matchupKey = (t1: string[], t2: string[]) => [pairKey(t1[0]!, t1[1]!), pairKey(t2[0]!, t2[1]!)].sort().join('#')

/** 출전자 선발(C-04, FR-009) */
export function selectPlayers(players: Player[], courts: number, rules: Rules, history: History, r: () => number) {
  const slots = Math.min(courts, Math.floor(players.length / 4)) * 4
  const waited = new Set(history.lastWaiting)
  let ordered: Player[]
  if (rules.fairness) {
    ordered = [...players].sort((a, b) => (history.games[a.key] ?? 0) - (history.games[b.key] ?? 0) || Number(waited.has(b.key)) - Number(waited.has(a.key)) || a.checkOrder - b.checkOrder)
  } else {
    // 공평성 꺼짐: 직전 라운드 대기자만 우선(FR-009), 나머지는 시드 순서(미정 사항 기록)
    const shuffled = shuffle(players, r)
    ordered = [...shuffled.filter((p) => waited.has(p.key)), ...shuffled.filter((p) => !waited.has(p.key))]
  }
  return { playing: ordered.slice(0, slots), waiting: ordered.slice(slots) }
}

/** 4명을 두 팀으로 나누는 3가지 */
const SPLITS: [[number, number], [number, number]][] = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
]

type CourtEval = { team1: [Player, Player]; team2: [Player, Player]; samePartner: number; sameMatchup: boolean; genderBad: boolean; diff: number; minDiff: number; opp: number }

function evalCourt(four: Player[], rules: Rules, history: History, partners: Set<string>, matchups: Set<string>): CourtEval {
  const males = four.filter((p) => p.gender === '남').length
  let best: CourtEval | null = null
  let minDiff = Infinity
  for (const [[a, b], [c, d]] of SPLITS) {
    const t1 = [four[a]!, four[b]!] as [Player, Player]
    const t2 = [four[c]!, four[d]!] as [Player, Player]
    const diff = Math.abs(t1[0].score + t1[1].score - t2[0].score - t2[1].score)
    minDiff = Math.min(minDiff, diff)
    const samePartner = (partners.has(pairKey(t1[0].key, t1[1].key)) ? 1 : 0) + (partners.has(pairKey(t2[0].key, t2[1].key)) ? 1 : 0)
    const sameMatchup = matchups.has(matchupKey([t1[0].key, t1[1].key], [t2[0].key, t2[1].key]))
    // 성별 조합: 혼복(남2·여2)이면 각 팀 남1·여1, 남복·여복(4명 같은 성별)은 그대로 정상, 그 밖(남3·여1, 남1·여3)은 불균형
    const genderBad = males === 2 ? t1.filter((p) => p.gender === '남').length !== 1 : males === 1 || males === 3
    let opp = 0
    for (const x of t1) for (const y of t2) opp += history.opponents[pairKey(x.key, y.key)] ?? 0
    const cand: CourtEval = { team1: t1, team2: t2, samePartner, sameMatchup, genderBad, diff, minDiff: 0, opp }
    if (!best || courtCost(cand, rules) < courtCost(best, rules)) best = cand
  }
  return { ...best!, minDiff }
}

// 코트 안 팀 나누기 비용(사전식): 같은 경기(항상 금지) > 파트너 반복(중복 회피) > 성별 불균형(성별) > 실력차(밸런스) > 상대 반복
function courtCost(e: CourtEval, rules: Rules) {
  return (e.sameMatchup ? 1e12 : 0) + (rules.noRepeat ? e.samePartner * 1e9 : 0) + (rules.gender && e.genderBad ? 1e6 : 0) + (rules.balance ? e.diff * 1e3 : 0) + (rules.noRepeat ? e.opp : 0)
}

/** 코트 묶음(4명씩) 후보 만들기 */
/** 혼복 경기 수: 남은 인원이 남복·여복(4명 단위)으로 딱 맞는 최대값, 없으면 혼복 최대(나머지 불균형) */
function mixedCount(men: number, women: number, courts: number) {
  const max = Math.min(Math.floor(men / 2), Math.floor(women / 2), courts)
  for (let x = max; x >= 0; x--) if ((men - 2 * x) % 4 === 0 && (women - 2 * x) % 4 === 0) return x
  return max
}

function genderGroups(men: Player[], women: Player[], courts: number): Player[][] {
  const m = [...men]
  const w = [...women]
  const mixed = mixedCount(m.length, w.length, courts)
  const groups: Player[][] = []
  for (let i = 0; i < mixed; i++) groups.push([m.shift()!, m.shift()!, w.shift()!, w.shift()!])
  while (m.length >= 4) groups.push(m.splice(0, 4))
  while (w.length >= 4) groups.push(w.splice(0, 4))
  const rest = [...m, ...w]
  for (let i = 0; i < rest.length; i += 4) groups.push(rest.slice(i, i + 4))
  return groups
}

function groupings(playing: Player[], method: Method, rules: Rules, r: () => number): Player[][] {
  if (method === 'level' && rules.gender) {
    // P2: 성별 구성을 먼저, 그 안에서 점수가 가까운 사람끼리. 혼복에 들어갈 남·여를 시드로 고르고(탐색), 각 성별 안은 점수순
    const desc = (a: Player, b: Player) => b.score - a.score
    const men = shuffle(playing.filter((p) => p.gender === '남'), r).sort(desc)
    const women = shuffle(playing.filter((p) => p.gender === '여'), r).sort(desc)
    const x = mixedCount(men.length, women.length, playing.length / 4)
    const split = (list: Player[], k: number) => {
      const chosen = new Set(shuffle(list.map((_, i) => i), r).slice(0, k))
      return { inMixed: list.filter((_, i) => chosen.has(i)), rest: list.filter((_, i) => !chosen.has(i)) }
    }
    const ms = split(men, 2 * x)
    const ws = split(women, 2 * x)
    return genderGroups([...ms.inMixed, ...ms.rest], [...ws.inMixed, ...ws.rest], playing.length / 4)
  }
  if (method === 'level') {
    // C-01: 점수 높은 순으로 같은 구간끼리 4명씩, 모자라면 인접 구간의 가장 가까운 점수로 채움(같은 점수 안 순서는 시드)
    const sorted = shuffle(playing, r).sort((a, b) => b.score - a.score)
    const groups: Player[][] = []
    for (let i = 0; i < sorted.length; i += 4) groups.push(sorted.slice(i, i + 4))
    return groups
  }
  const shuffled = shuffle(playing, r)
  if (!rules.gender) {
    const groups: Player[][] = []
    for (let i = 0; i < shuffled.length; i += 4) groups.push(shuffled.slice(i, i + 4))
    return groups
  }
  // C-03: 혼복을 가능한 한 많이(남2·여2), 남는 인원은 남복·여복(4명 같은 성별), 그래도 남으면 불균형
  return genderGroups(
    shuffled.filter((p) => p.gender === '남'),
    shuffled.filter((p) => p.gender === '여'),
    playing.length / 4,
  )
}

/** 레벨별: 묶음 안 점수 차이 합(작을수록 같은 레벨끼리) */
const levelSpread = (groups: Player[][]) => groups.reduce((sum, g) => sum + Math.max(...g.map((p) => p.score)) - Math.min(...g.map((p) => p.score)), 0)

const ITERATIONS = 300

/** 라운드 대진 생성 */
export function generateLineup(input: { players: Player[]; courts: number; method: Method; rules: Rules; history: History; seed: number }): Lineup {
  const { players, courts, method, rules, history, seed } = input
  if (players.length < 4) throw new LineupError('min_players')
  const r = rng(seed)
  const { playing, waiting } = selectPlayers(players, courts, rules, history, r)
  const partners = new Set(history.partners)
  const matchups = new Set(history.matchups)

  let best: { evals: CourtEval[]; cost: number } | null = null
  const tries = method === 'level' && !rules.gender ? 40 : ITERATIONS // 레벨별(성별 끔)은 묶음이 거의 고정(같은 점수 순서만 바뀜)
  for (let i = 0; i < tries; i++) {
    const groups = groupings(playing, method, rules, r)
    const evals = groups.map((g) => evalCourt(g, rules, history, partners, matchups))
    // 우선순위: 같은 경기 > 파트너 반복 > 성별 > (레벨별) 점수 차이 > 밸런스 > 상대 반복
    const cost = evals.reduce((s, e) => s + courtCost(e, rules), 0) + (method === 'level' ? levelSpread(groups) * 1e4 : 0)
    if (!best || cost < best.cost) best = { evals, cost }
    if (cost === 0) break
  }
  const result = best!.evals.map((e, i): Court => {
    const relaxations: Relaxation[] = []
    if (rules.noRepeat && e.samePartner > 0) relaxations.push('noRepeat')
    if (rules.gender && e.genderBad) relaxations.push('gender')
    if (rules.balance && e.diff > e.minDiff) relaxations.push('balance')
    return { no: i + 1, team1: [e.team1[0].key, e.team1[1].key], team2: [e.team2[0].key, e.team2[1].key], relaxations }
  })
  return { courts: result, waiting: waiting.map((p) => p.key) }
}

/** 라운드 완료 시 이력 누적(FR-012, AC-038) */
export function addToHistory(history: History, lineup: Lineup): History {
  const games = { ...history.games }
  const partners = new Set(history.partners)
  const opponents = { ...history.opponents }
  const matchups = new Set(history.matchups)
  for (const c of lineup.courts) {
    for (const k of [...c.team1, ...c.team2]) games[k] = (games[k] ?? 0) + 1
    partners.add(pairKey(...c.team1))
    partners.add(pairKey(...c.team2))
    for (const x of c.team1) for (const y of c.team2) opponents[pairKey(x, y)] = (opponents[pairKey(x, y)] ?? 0) + 1
    matchups.add(matchupKey(c.team1, c.team2))
  }
  return { games, lastWaiting: [...lineup.waiting], partners: [...partners], opponents, matchups: [...matchups] }
}

/** 실력차(C-24): 두 팀 1–10 점수 합 차이의 절댓값. 한 명이라도 점수가 없으면 null('실력차 계산 불가') */
export function skillGap(team1: (number | null)[], team2: (number | null)[]): number | null {
  if ([...team1, ...team2].some((s) => s === null)) return null
  const sum = (t: (number | null)[]) => t.reduce<number>((a, b) => a + (b ?? 0), 0)
  return Math.abs(sum(team1) - sum(team2))
}
