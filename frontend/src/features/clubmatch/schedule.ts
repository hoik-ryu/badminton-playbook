// 청백전 대진·집계(Mock용 결정적 구현). 실제 생성은 백엔드 소관(C-19 '실시간 대진 엔진 재사용')이며 같은 규칙을 화면 개발용으로 구현합니다.
// 확정 규칙(기획 C-13–C-20, AC-043·072–076·078·079·082–084):
//  - 총 경기 수를 받아 전체 대진을 한 번에 생성. 선수별 경기 수 차이 최대 1(C-14, 자동·다시 생성에서 보장)
//  - 모두 같아질 수 없으면 가까운 균등안(같은 경기 수가 되는 총 경기 수) 2개 제안(AC-074)
//  - 모든 경기 2 대 2, 팀전은 청 2 대 백 2(AC-043). 같은 4명·같은 팀 구성 금지(C-05), 같은 파트너 반복 최소화
//  - 밸런스(C-02)·성별 조합(C-03)은 운영진이 켜고 끔. 레벨별 3구간·라운드 대기자 우선은 쓰지 않음(C-19)
//  - 팀 배정안: 점수 합과 성별 비율이 비슷한 청·백(AC-072)
//  - 개인전: 이긴 조 2명 각 1승, 누적 승수 순위, 동률 공동 순위, 사람별 경기 수 표시. 팀전: 청·백 승수, 같으면 무승부(C-16)
import { matchupKey, pairKey, rng } from '../session/lineup'

export type ClubMethod = 'individual' | 'team'
export type Team = 'blue' | 'white'
export type ClubRules = { balance: boolean; gender: boolean }
export type ClubPlayer = { key: string; gender: '남' | '여'; score: number; team: Team | null }
export type ClubGame = { no: number; team1: [string, string]; team2: [string, string]; winner: 1 | 2 | null; genderRelaxed: boolean; changed?: boolean }

const shuffle = <T,>(list: T[], r: () => number) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b

/** 경기 수 분포 미리보기(UXD-071): '12명 3경기, 2명 2경기' */
export function distribution(method: ClubMethod, counts: { all: number; blue: number; white: number }, totalGames: number) {
  const spread = (people: number, slots: number) => {
    if (people <= 0) return []
    const base = Math.floor(slots / people)
    const extra = slots % people
    return [
      { games: base + 1, people: extra },
      { games: base, people: people - extra },
    ].filter((x) => x.people > 0)
  }
  const parts = method === 'team' ? [...spread(counts.blue, 2 * totalGames), ...spread(counts.white, 2 * totalGames)] : spread(counts.all, 4 * totalGames)
  const merged = new Map<number, number>()
  for (const p of parts) merged.set(p.games, (merged.get(p.games) ?? 0) + p.people)
  const groups = [...merged.entries()].sort((a, b) => b[0] - a[0]).map(([games, people]) => ({ games, people }))
  return { groups, even: groups.length <= 1 }
}

/** 균등안(AC-074): 모두 같은 경기 수가 되는 가까운 총 경기 수 두 개(아래·위) */
export function evenProposals(method: ClubMethod, counts: { all: number; blue: number; white: number }, totalGames: number) {
  let step: number
  if (method === 'team') {
    if (counts.blue < 2 || counts.white < 2) return []
    step = lcm(counts.blue / gcd(counts.blue, 2), counts.white / gcd(counts.white, 2))
  } else {
    if (counts.all < 4) return []
    step = counts.all / gcd(counts.all, 4)
  }
  if (totalGames % step === 0) return []
  const lower = Math.floor(totalGames / step) * step
  const upper = lower + step
  const each = (g: number) => (method === 'team' ? { blue: (2 * g) / counts.blue, white: (2 * g) / counts.white } : { blue: (4 * g) / counts.all, white: (4 * g) / counts.all })
  return [lower, upper].filter((g) => g > 0).map((g) => ({ totalGames: g, each: each(g) }))
}

/** 팀 배정안(AC-072): 성별마다 점수 높은 순으로 지그재그(ABBA) 배정 → 점수 합·성별 비율이 비슷한 청·백 */
export function proposeTeams(players: { key: string; gender: '남' | '여'; score: number | null }[]): Record<string, Team> {
  const out: Record<string, Team> = {}
  let blue = 0
  let white = 0
  let blueSum = 0
  let whiteSum = 0
  for (const g of ['남', '여'] as const) {
    const list = players.filter((p) => p.gender === g).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.key.localeCompare(b.key))
    for (const p of list) {
      // 인원이 적은 쪽, 같으면 점수 합이 작은 쪽
      const toBlue = blue < white || (blue === white && blueSum <= whiteSum)
      out[p.key] = toBlue ? 'blue' : 'white'
      if (toBlue) {
        blue++
        blueSum += p.score ?? 0
      } else {
        white++
        whiteSum += p.score ?? 0
      }
    }
  }
  return out
}

const genderBad = (t1: ClubPlayer[], t2: ClubPlayer[]) => {
  const males = [...t1, ...t2].filter((p) => p.gender === '남').length
  return males === 2 ? t1.filter((p) => p.gender === '남').length !== 1 || t2.filter((p) => p.gender === '남').length !== 1 : males === 1 || males === 3
}

/** 경기 수가 낮은 사람부터 k명(경기 수 차이 최대 1 유지): 문턱보다 적은 사람은 모두, 문턱과 같은 사람 중에서 시드로 고름 */
function pickLowest(pool: ClubPlayer[], k: number, counts: Map<string, number>, r: () => number) {
  const sorted = [...pool].sort((a, b) => (counts.get(a.key) ?? 0) - (counts.get(b.key) ?? 0))
  const threshold = counts.get(sorted[k - 1]!.key) ?? 0
  const must = sorted.filter((p) => (counts.get(p.key) ?? 0) < threshold)
  const tied = shuffle(sorted.filter((p) => (counts.get(p.key) ?? 0) === threshold), r)
  return [...must, ...tied.slice(0, k - must.length)]
}

/** pickLowest가 고를 수 있는 모든 조합(경기 수 차이 ≤1 유지): 문턱보다 적은 사람 전부 + 문턱과 같은 사람 중 조합(입력 순서 기준 사전순) */
export function feasibleSets(pool: ClubPlayer[], k: number, counts: Map<string, number>): ClubPlayer[][] {
  const sorted = [...pool].sort((a, b) => (counts.get(a.key) ?? 0) - (counts.get(b.key) ?? 0))
  const threshold = counts.get(sorted[k - 1]!.key) ?? 0
  const must = sorted.filter((p) => (counts.get(p.key) ?? 0) < threshold)
  const tied = sorted.filter((p) => (counts.get(p.key) ?? 0) === threshold)
  const need = k - must.length
  const out: ClubPlayer[][] = []
  const pick = (start: number, acc: ClubPlayer[]) => {
    if (acc.length === need) return void out.push([...must, ...acc])
    for (let i = start; i <= tied.length - (need - acc.length); i++) pick(i + 1, [...acc, tied[i]!])
  }
  pick(0, [])
  return out
}

/** 후보 전체(팀전: 청 조합 × 백 조합, 개인전: 4명 조합 × 분할 3가지) — 순서는 고정(재현성) */
export function allSplits(players: ClubPlayer[], method: ClubMethod, counts: Map<string, number>): [ClubPlayer[], ClubPlayer[]][] {
  if (method === 'team') {
    const blues = feasibleSets(players.filter((p) => p.team === 'blue'), 2, counts)
    const whites = feasibleSets(players.filter((p) => p.team === 'white'), 2, counts)
    return blues.flatMap((b) => whites.map((w) => [b, w] as [ClubPlayer[], ClubPlayer[]]))
  }
  return feasibleSets(players, 4, counts).flatMap((f) => [
    [[f[0]!, f[1]!], [f[2]!, f[3]!]],
    [[f[0]!, f[2]!], [f[1]!, f[3]!]],
    [[f[0]!, f[3]!], [f[1]!, f[2]!]],
  ] as [ClubPlayer[], ClubPlayer[]][])
}

/** 전체 대진 생성(C-14·C-19) */
export function generateClubGames(input: { players: ClubPlayer[]; totalGames: number; method: ClubMethod; rules: ClubRules; seed: number }): ClubGame[] {
  const { players, totalGames, method, rules, seed } = input
  const r = rng(seed)
  const counts = new Map<string, number>()
  const partners = new Map<string, number>()
  const matchups = new Set<string>()
  const games: ClubGame[] = []
  const blues = players.filter((p) => p.team === 'blue')
  const whites = players.filter((p) => p.team === 'white')

  for (let no = 1; no <= totalGames; no++) {
    let best: { t1: ClubPlayer[]; t2: ClubPlayer[]; cost: number; bad: boolean } | null = null
    const costOf = (t1: ClubPlayer[], t2: ClubPlayer[]) => {
      const same = matchups.has(matchupKey(t1.map((p) => p.key), t2.map((p) => p.key)))
      const rep = (partners.get(pairKey(t1[0]!.key, t1[1]!.key)) ?? 0) + (partners.get(pairKey(t2[0]!.key, t2[1]!.key)) ?? 0)
      const bad = genderBad(t1, t2)
      const diff = Math.abs(t1[0]!.score + t1[1]!.score - t2[0]!.score - t2[1]!.score)
      // 우선순위: 같은 4명·같은 팀(금지) > 파트너 반복(최소화) > 성별 조합(켰을 때) > 밸런스(켰을 때)
      return { cost: (same ? 1e12 : 0) + rep * 1e9 + (rules.gender && bad ? 1e6 : 0) + (rules.balance ? diff * 1e3 : 0), bad }
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      const splits: [ClubPlayer[], ClubPlayer[]][] = []
      if (method === 'team') {
        splits.push([pickLowest(blues, 2, counts, r), pickLowest(whites, 2, counts, r)])
      } else {
        const four = pickLowest(players, 4, counts, r)
        splits.push([[four[0]!, four[1]!], [four[2]!, four[3]!]], [[four[0]!, four[2]!], [four[1]!, four[3]!]], [[four[0]!, four[3]!], [four[1]!, four[2]!]])
      }
      for (const [t1, t2] of splits) {
        const { cost, bad } = costOf(t1, t2)
        if (!best || cost < best.cost) best = { t1, t2, cost, bad }
      }
      if (best && best.cost === 0) break
    }
    // 성별 탐색 보강(I3-c): 성별 규칙을 켰는데 60회 무작위 탐색 결과가 성별을 어기면, 경기 수 규칙을 지키는 모든 후보를
    // 고정 순서로 훑어 비용이 더 낮은 것(우선순위 그대로)으로 바꿉니다. 난수를 더 쓰지 않아 같은 시드 → 같은 결과.
    if (rules.gender && best!.bad) {
      for (const [t1, t2] of allSplits(players, method, counts)) {
        const { cost, bad } = costOf(t1, t2)
        if (cost < best!.cost) best = { t1, t2, cost, bad }
      }
    }
    const { t1, t2, bad } = best!
    for (const p of [...t1, ...t2]) counts.set(p.key, (counts.get(p.key) ?? 0) + 1)
    partners.set(pairKey(t1[0]!.key, t1[1]!.key), (partners.get(pairKey(t1[0]!.key, t1[1]!.key)) ?? 0) + 1)
    partners.set(pairKey(t2[0]!.key, t2[1]!.key), (partners.get(pairKey(t2[0]!.key, t2[1]!.key)) ?? 0) + 1)
    matchups.add(matchupKey(t1.map((p) => p.key), t2.map((p) => p.key)))
    games.push({ no, team1: [t1[0]!.key, t1[1]!.key], team2: [t2[0]!.key, t2[1]!.key], winner: null, genderRelaxed: rules.gender && bad })
  }
  return games
}

/** 사람별 경기 수 */
export function gameCounts(games: ClubGame[]) {
  const c = new Map<string, number>()
  for (const g of games) for (const k of [...g.team1, ...g.team2]) c.set(k, (c.get(k) ?? 0) + 1)
  return c
}

/** 개인전 순위(C-16, AC-082·083): 누적 승수, 동률 공동 순위(1, 2, 2, 4…) */
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0) // 서버(Python 문자열 비교)와 같은 순서

/** 개인전 순위(C-16, AC-082): 누적 승수, 동률은 공동 순위 1·2·2·4(U3). 같은 승수 안 표시 순서: 승률 → 이름 → 키(U4, 서버 standings와 같음) */
export function individualStandings(games: ClubGame[], participants: string[], names: (key: string) => string = () => '') {
  const wins = new Map<string, number>(participants.map((k) => [k, 0]))
  const counts = gameCounts(games)
  for (const g of games) {
    if (!g.winner) continue
    for (const k of g.winner === 1 ? g.team1 : g.team2) wins.set(k, (wins.get(k) ?? 0) + 1)
  }
  const rate = (w: number, n: number) => (n ? w / n : 0)
  const rows = [...wins.entries()]
    .map(([key, w]) => ({ key, wins: w, games: counts.get(key) ?? 0 }))
    .sort((a, b) => b.wins - a.wins || rate(b.wins, b.games) - rate(a.wins, a.games) || byCode(names(a.key), names(b.key)) || byCode(a.key, b.key))
  return rows.map((row) => ({ ...row, rank: rows.filter((x) => x.wins > row.wins).length + 1, tied: rows.filter((x) => x.wins === row.wins).length > 1 }))
}

/** 팀전 승수(C-16, AC-084) */
export function teamScore(games: ClubGame[]) {
  return { blue: games.filter((g) => g.winner === 1).length, white: games.filter((g) => g.winner === 2).length }
}

/** 실력차(C-24) */
export const gap = (t1: (number | null)[], t2: (number | null)[]) => ([...t1, ...t2].some((s) => s === null) ? null : Math.abs((t1[0] ?? 0) + (t1[1] ?? 0) - (t2[0] ?? 0) - (t2[1] ?? 0)))

// ── 규칙 완화 사유(U7)·교체 뒤 재계산(I3-c·I3-d P-4) — 서버 schedule.py relaxations·refresh_after_swap과 같은 규칙 ──
export type RelaxationReason = 'exhausted' | 'higher_priority' | 'search_limit' | 'manual' | 'substitute_exhausted'
export type Relaxation = { rule: 'matchup' | 'gender'; reason: RelaxationReason }
export type GameState = { no: number; team1: [string, string]; team2: [string, string]; manual: boolean; genderRelaxed: boolean; repeatedMatchup: boolean; relaxations: Relaxation[] }

/** 생성 직후 같은 대진 반복 표시(앞선 경기와 같은 4명·같은 팀). 생성 엔진의 반복은 모두 조합 소진(U7, 서버 골든·무작위 검증) */
export function markGeneratedRepeats<T extends ClubGame>(games: T[]): (T & { repeatedMatchup: boolean; relaxations: Relaxation[]; manual: boolean })[] {
  const seen = new Set<string>()
  return games.map((g) => {
    const k = matchupKey([...g.team1], [...g.team2])
    const repeated = seen.has(k)
    seen.add(k)
    return { ...g, repeatedMatchup: repeated, relaxations: repeated ? [{ rule: 'matchup', reason: 'exhausted' }] : [], manual: false }
  })
}

/** 교체·중도 귀가 뒤 반복·성별 완화·사유 다시 계산(제자리 수정). forced = 중도 귀가에서 불가피하다고 확인된 대진 키(P-4-b) */
export function refreshAfterSwap(games: GameState[], genders: (key: string) => '남' | '여' | null, genderRule: boolean, forced: Set<string> = new Set()) {
  const seen = new Set<string>()
  for (const g of [...games].sort((a, b) => a.no - b.no)) {
    const key = matchupKey([...g.team1], [...g.team2])
    const repeated = seen.has(key)
    seen.add(key)
    const oldMatch = g.relaxations.filter((x) => x.rule === 'matchup')
    const oldGender = g.relaxations.filter((x) => x.rule === 'gender')
    const next: Relaxation[] = []
    if (repeated) {
      if (forced.has(key)) next.push({ rule: 'matchup', reason: 'substitute_exhausted' })
      else if (g.repeatedMatchup && oldMatch.length) next.push(...oldMatch)
      else next.push({ rule: 'matchup', reason: 'manual' })
    }
    if (g.manual) {
      const male = (k: string) => genders(k) === '남'
      const males = [...g.team1, ...g.team2].filter(male).length
      const bad = males === 2 ? g.team1.filter(male).length !== 1 || g.team2.filter(male).length !== 1 : males === 1 || males === 3
      g.genderRelaxed = genderRule && bad
      if (g.genderRelaxed) next.push({ rule: 'gender', reason: 'manual' })
    } else next.push(...oldGender)
    g.repeatedMatchup = repeated
    g.relaxations = next
  }
}

type Seats = [[string, string], [string, string]]
const subIn = ([t1, t2]: Seats, from: string, to: string): Seats => [t1.map((k) => (k === from ? to : k)) as [string, string], t2.map((k) => (k === from ? to : k)) as [string, string]]

/**
 * 중도 귀가 대체 판정(P-4-b, 서버 leave와 같은 규칙). 최종 대진(모든 대체 반영) 기준으로
 * - avoidable: 다른 경기와 같은 대진인데, 그 경기에 중복 없는 다른 후보가 있음 → 거부(same_matchup)
 * - forced: 모든 후보가 중복 → 예외 허용(사유 substitute_exhausted)
 */
export function substituteDecision(seats: Map<number, Seats>, leaver: string, picks: Map<number, string>, candidates: (no: number) => string[]) {
  const keyOf = (s: Seats) => matchupKey([...s[0]], [...s[1]])
  const final = new Map([...seats].map(([no, s]) => [no, picks.has(no) ? subIn(s, leaver, picks.get(no)!) : s]))
  const keys = new Map([...final].map(([no, s]) => [no, keyOf(s)]))
  const avoidable: number[] = []
  const forced = new Set<string>()
  for (const no of [...picks.keys()].sort((a, b) => a - b)) {
    const others = new Set([...keys].filter(([o]) => o !== no).map(([, k]) => k))
    if (!others.has(keys.get(no)!)) continue
    if (candidates(no).some((c) => !others.has(keyOf(subIn(seats.get(no)!, leaver, c))))) avoidable.push(no)
    else forced.add(keys.get(no)!)
  }
  return { avoidable, forced }
}

// ===== (B15) 라운드·코트 기반 생성(C-36, AC-145–147) — 백엔드 schedule.py generate_round_games와 같은 결과(골든) =====
// 라운드마다 ① 출전자를 먼저 고르고(경기 수 적은 → 직전 라운드 휴식 → 연속 휴식이 긴 → 시드로 섞은 순서)
// ② 그 사람들로만 조를 짭니다(같은 대진 금지 → 파트너 반복 → 성별 조합 → 밸런스). 난수 호출 순서도 서버와 같음.
export const MAX_COURTS = 8
export const MAX_GAMES = 200
export type RoundSizes = { all: number; blue: number; white: number }
export type RoundGame = { no: number; round: number; court: number; team1: [string, string]; team2: [string, string]; genderRelaxed: boolean; repeatedMatchup: boolean; relaxations: Relaxation[] }

/** 라운드당 최대 경기 수 k = min(코트, ⌊N÷4⌋, 팀전 ⌊청÷2⌋·⌊백÷2⌋) */
export function perRound(method: ClubMethod, sizes: RoundSizes, courts: number) {
  let k = Math.min(courts, Math.floor(sizes.all / 4))
  if (method === 'team') k = Math.min(k, Math.floor(sizes.blue / 2), Math.floor(sizes.white / 2))
  return Math.max(0, k)
}
export const maxRounds = (k: number) => (k > 0 ? Math.floor(MAX_GAMES / k) : 0)
/** 기본 라운드 수(C-36 r13): 개인전 ⌈N÷k⌉, 팀전 ⌈2×큰 팀÷k⌉, 상한 ⌊200÷k⌋ */
export function defaultRounds(method: ClubMethod, sizes: RoundSizes, k: number) {
  if (k <= 0) return 0
  const want = method === 'team' ? Math.ceil((2 * Math.max(sizes.blue, sizes.white)) / k) : Math.ceil(sizes.all / k)
  return Math.max(1, Math.min(want, maxRounds(k)))
}
type Range = { min: number; max: number }
export type RoundPreview = {
  perRound: number
  maxRounds: number
  defaultRounds: number
  games: number
  each: { all?: Range; blue?: Range; white?: Range }
  playing: { all?: number; blue?: number; white?: number }
  resting: { all?: number; blue?: number; white?: number }
  belowTarget: boolean
  proposals: { rounds: number; all?: number; blue?: number; white?: number }[]
}
/** 생성 전 미리보기(UXD-106, AC-145) — 서버 round_preview와 같은 값 */
export function roundPreview(method: ClubMethod, sizes: RoundSizes, courts: number, rounds: number): RoundPreview {
  const k = perRound(method, sizes, courts)
  const each = (n: number, per: number): Range => (n <= 0 ? { min: 0, max: 0 } : { min: Math.floor((rounds * per) / n), max: Math.ceil((rounds * per) / n) })
  const team = method === 'team'
  const avgOk = k > 0 && rounds * 4 * k >= 4 * sizes.all
  return {
    perRound: k,
    maxRounds: maxRounds(k),
    defaultRounds: defaultRounds(method, sizes, k),
    games: rounds * k,
    each: team ? { blue: each(sizes.blue, 2 * k), white: each(sizes.white, 2 * k) } : { all: each(sizes.all, 4 * k) },
    playing: team ? { blue: 2 * k, white: 2 * k } : { all: 4 * k },
    resting: team ? { blue: Math.max(0, sizes.blue - 2 * k), white: Math.max(0, sizes.white - 2 * k) } : { all: Math.max(0, sizes.all - 4 * k) },
    belowTarget: k > 0 && rounds === maxRounds(k) && !avgOk,
    proposals: evenRoundProposals(method, sizes, k, rounds),
  }
}
/** 균등안(C-14 r12): 모두 같은 경기 수가 되는 가까운 라운드 수(아래·위, 범위 안) */
export function evenRoundProposals(method: ClubMethod, sizes: RoundSizes, k: number, rounds: number) {
  if (k <= 0) return []
  const even = (r: number) => (method === 'team' ? (r * 2 * k) % sizes.blue === 0 && (r * 2 * k) % sizes.white === 0 : (r * 4 * k) % sizes.all === 0)
  if (even(rounds)) return []
  const top = maxRounds(k)
  let lower: number | null = null
  for (let r = rounds - 1; r > 0; r--) if (even(r)) { lower = r; break }
  let upper: number | null = null
  for (let r = rounds + 1; r <= top; r++) if (even(r)) { upper = r; break }
  return [lower, upper]
    .filter((r): r is number => r !== null)
    .map((r) => (method === 'team' ? { rounds: r, blue: (r * 2 * k) / sizes.blue, white: (r * 2 * k) / sizes.white } : { rounds: r, all: (r * 4 * k) / sizes.all }))
}

const combos = <T,>(list: T[], n: number): T[][] => {
  const out: T[][] = []
  const go = (start: number, acc: T[]) => {
    if (acc.length === n) return void out.push([...acc])
    for (let i = start; i <= list.length - (n - acc.length); i++) go(i + 1, [...acc, list[i]!])
  }
  go(0, [])
  return out
}

/** 라운드 기반 전체 대진(C-36, AC-146·147). 라운드마다 k경기, 같은 라운드 중복 출전 없음 */
export function generateRoundGames(input: { players: ClubPlayer[]; rounds: number; courts: number; method: ClubMethod; rules: ClubRules; seed: number }): RoundGame[] {
  const { players, rounds, courts, method, rules, seed } = input
  const blues = players.filter((p) => p.team === 'blue')
  const whites = players.filter((p) => p.team === 'white')
  const k = perRound(method, { all: players.length, blue: blues.length, white: whites.length }, courts)
  const r = rng(seed)
  const counts = new Map<string, number>()
  const partners = new Map<string, number>()
  const matchups = new Set<string>()
  let rested = new Set<string>()
  let streak = new Map<string, number>()
  const games: RoundGame[] = []
  let no = 0
  const same = (t1: ClubPlayer[], t2: ClubPlayer[]) => matchups.has(matchupKey(t1.map((p) => p.key), t2.map((p) => p.key)))
  const rep = (t1: ClubPlayer[], t2: ClubPlayer[]) => (partners.get(pairKey(t1[0]!.key, t1[1]!.key)) ?? 0) + (partners.get(pairKey(t2[0]!.key, t2[1]!.key)) ?? 0)
  const costOf = (t1: ClubPlayer[], t2: ClubPlayer[]) => {
    const s = same(t1, t2)
    const bad = genderBad(t1, t2)
    const diff = Math.abs(t1[0]!.score + t1[1]!.score - t2[0]!.score - t2[1]!.score)
    return { cost: (s ? 1e12 : 0) + rep(t1, t2) * 1e9 + (rules.gender && bad ? 1e6 : 0) + (rules.balance ? diff * 1e3 : 0), bad, same: s }
  }
  const choose = (pool: ClubPlayer[], n: number) => {
    const order = shuffle(pool, r)
    order.sort((a, b) => (counts.get(a.key) ?? 0) - (counts.get(b.key) ?? 0) || (rested.has(a.key) ? 0 : 1) - (rested.has(b.key) ? 0 : 1) || (streak.get(b.key) ?? 0) - (streak.get(a.key) ?? 0))
    return order.slice(0, n)
  }
  const splitsOf = (f: ClubPlayer[]): [ClubPlayer[], ClubPlayer[]][] => [
    [[f[0]!, f[1]!], [f[2]!, f[3]!]],
    [[f[0]!, f[2]!], [f[1]!, f[3]!]],
    [[f[0]!, f[3]!], [f[1]!, f[2]!]],
  ]
  for (let rd = 1; rd <= rounds && k > 0; rd++) {
    let rem: ClubPlayer[] = []
    let remB: ClubPlayer[] = []
    let remW: ClubPlayer[] = []
    if (method === 'team') {
      remB = choose(blues, 2 * k)
      remW = choose(whites, 2 * k)
    } else rem = choose(players, 4 * k)
    const playing = new Set([...rem, ...remB, ...remW].map((p) => p.key))
    for (let court = 1; court <= k; court++) {
      let best: { t1: ClubPlayer[]; t2: ClubPlayer[]; cost: number; bad: boolean; same: boolean } | null = null
      for (let attempt = 0; attempt < 60; attempt++) {
        const splits: [ClubPlayer[], ClubPlayer[]][] = method === 'team' ? [[shuffle(remB, r).slice(0, 2), shuffle(remW, r).slice(0, 2)]] : splitsOf(shuffle(rem, r).slice(0, 4))
        for (const [t1, t2] of splits) {
          const c = costOf(t1, t2)
          if (!best || c.cost < best.cost) best = { t1, t2, ...c }
        }
        if (best && best.cost === 0) break
      }
      let cands: [ClubPlayer[], ClubPlayer[]][] | null = null
      if (best!.same || (rules.gender && best!.bad)) {
        cands = method === 'team' ? combos(remB, 2).flatMap((b) => combos(remW, 2).map((w) => [b, w] as [ClubPlayer[], ClubPlayer[]])) : combos(rem, 4).flatMap(splitsOf)
        for (const [t1, t2] of cands) {
          const c = costOf(t1, t2)
          if (c.cost < best!.cost) best = { t1, t2, ...c }
        }
      }
      const { t1, t2, bad } = best!
      const isSame = best!.same
      const relaxations: Relaxation[] = []
      if (isSame || (rules.gender && bad)) {
        if (isSame) relaxations.push({ rule: 'matchup', reason: cands!.some(([a, b]) => !same(a, b)) ? 'search_limit' : 'exhausted' })
        if (rules.gender && bad) {
          const chosen: [number, number] = [isSame ? 1 : 0, rep(t1, t2)]
          const ok = cands!.filter(([a, b]) => !genderBad(a, b))
          const le = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])
          const reason: RelaxationReason = !ok.length ? 'exhausted' : ok.some(([a, b]) => le([same(a, b) ? 1 : 0, rep(a, b)], chosen)) ? 'search_limit' : 'higher_priority'
          relaxations.push({ rule: 'gender', reason })
        }
      }
      for (const p of [...t1, ...t2]) counts.set(p.key, (counts.get(p.key) ?? 0) + 1)
      partners.set(pairKey(t1[0]!.key, t1[1]!.key), (partners.get(pairKey(t1[0]!.key, t1[1]!.key)) ?? 0) + 1)
      partners.set(pairKey(t2[0]!.key, t2[1]!.key), (partners.get(pairKey(t2[0]!.key, t2[1]!.key)) ?? 0) + 1)
      matchups.add(matchupKey(t1.map((p) => p.key), t2.map((p) => p.key)))
      const used = new Set([...t1, ...t2].map((p) => p.key))
      rem = rem.filter((p) => !used.has(p.key))
      remB = remB.filter((p) => !used.has(p.key))
      remW = remW.filter((p) => !used.has(p.key))
      no++
      games.push({ no, round: rd, court, team1: [t1[0]!.key, t1[1]!.key], team2: [t2[0]!.key, t2[1]!.key], genderRelaxed: rules.gender && bad, repeatedMatchup: isSame, relaxations })
    }
    const everyone = players.map((p) => p.key)
    rested = new Set(everyone.filter((key) => !playing.has(key)))
    streak = new Map(everyone.map((key) => [key, rested.has(key) ? (streak.get(key) ?? 0) + 1 : 0]))
  }
  return games
}
