// (r13) 청백전 대진 편집기(SCR-244)·선수 선택 시트(SCR-225) 프리뷰용 가짜 데이터와 화면 재현 규칙 — 모두 가상 인물
// 제품 규칙(C-14·C-19·C-35)을 '화면이 어떻게 보이는지' 재현할 만큼만 옮긴 것입니다. 실제 판정은 서버·제품 코드가 합니다.
import { person, proposeTeams, SELECTED_16, sum, type Team } from './setup'

export type Slot = string | null
export type EGame = {
  key: number
  /** 팀전: t1 = 청팀, t2 = 백팀 / 개인전: t1 = 1팀, t2 = 2팀 */
  t1: [Slot, Slot]
  t2: [Slot, Slot]
  /** 규칙 완화 사유(자동 생성 '성별 조합', 확정 전 편집 '운영진 수동 변경') */
  relax?: 'gender' | 'manual'
}
export type Target = { key: number; side: 0 | 1; idx: 0 | 1 }
export type Kind = 'team' | 'individual'

export type Dataset = { kind: Kind; ids: string[]; teams: Record<string, Team> | null; games: EGame[]; base: number }

const pick = (ids: string[], idx: number[]): [string, string, string, string] => idx.map((i) => ids[i]) as [string, string, string, string]

/** 팀전 16명(청 8 · 백 8) 8경기 — 기존 r12 미리보기와 같은 고정 대진 */
function teamGames16(): EGame[] {
  const teams = proposeTeams(SELECTED_16)
  const b = SELECTED_16.filter((k) => teams[k] === 'blue')
  const w = SELECTED_16.filter((k) => teams[k] === 'white')
  const pairs = (xs: string[]) => [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7]].map(([i, j]) => [xs[i], xs[j]] as [string, string])
  const pb = pairs(b), pw = pairs(w)
  return pb.map((t1, i) => ({ key: i + 1, t1, t2: pw[(i + 1) % 8], relax: i === 6 ? 'gender' : undefined }))
}

/** 개인전 16명 9경기(4명은 3경기, 12명은 2경기). 같은 4명 반복 없음 */
function individualGames16(): EGame[] {
  const ids = SELECTED_16
  const groups = [
    [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
    [0, 3, 6, 9], [12, 15, 2, 5], [8, 11, 14, 1], [4, 7, 10, 13],
    [0, 1, 2, 10], // 1경기와 세 명이 같은 경기(같은 대진 반복 후보 재현)
  ]
  return groups.map((g, i) => {
    const [a, b, c, d] = pick(ids, g)
    return { key: i + 1, t1: [a, b], t2: [c, d], relax: i === 5 ? 'gender' : undefined }
  })
}

/** 개인전 4명뿐인 청백전 1경기(AC-139 예: A 7점 · B 5점 대 C 6점 · D 3점) */
export const IND4 = ['p02', 'p04', 'p06', 'p12']

export function dataset(name: 'team16' | 'ind16' | 'ind4' | 'team4' | 'confirmed'): Dataset {
  if (name === 'confirmed') {
    // SCR-112 '가을 청백전'(확정, 팀전 청 7 · 백 7): 1·2경기는 결과 있음, 3경기부터 결과 없음. 5경기는 3경기의 윤새벽 자리를 김가람으로 바꾸면 같은 대진
    const blue = ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07'], white = ['c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17']
    const teams = Object.fromEntries([...blue.map((b) => [b, 'blue']), ...white.map((w) => [w, 'white'])]) as Record<string, Team>
    const games: EGame[] = [
      { key: 1, t1: ['c01', 'c02'], t2: ['c11', 'c12'] },
      { key: 2, t1: ['c03', 'c04'], t2: ['c13', 'c14'] },
      { key: 3, t1: ['c05', 'c06'], t2: ['c15', 'c16'], relax: 'gender' },
      { key: 4, t1: ['c07', 'c02'], t2: ['c17', 'c13'] },
      { key: 5, t1: ['c06', 'c01'], t2: ['c15', 'c16'] },
      { key: 6, t1: ['c05', 'c07'], t2: ['c11', 'c14'] },
    ]
    return { kind: 'team', ids: [...blue, ...white], teams, games, base: 6 }
  }
  if (name === 'team16') return { kind: 'team', ids: SELECTED_16, teams: proposeTeams(SELECTED_16), games: teamGames16(), base: 8 }
  if (name === 'ind16') return { kind: 'individual', ids: SELECTED_16, teams: null, games: individualGames16(), base: 9 }
  if (name === 'ind4') return { kind: 'individual', ids: IND4, teams: null, games: [{ key: 1, t1: ['p02', 'p04'], t2: ['p06', 'p12'] }], base: 1 }
  // 팀당 2명(최소 인원) 팀전 — 같은 팀 교체 후보가 없는 경우
  const ids = ['p01', 'p03', 'p02', 'p04']
  return { kind: 'team', ids, teams: { p01: 'blue', p03: 'blue', p02: 'white', p04: 'white' }, games: [{ key: 1, t1: ['p01', 'p03'], t2: ['p02', 'p04'] }], base: 1 }
}

export const filled = (g: EGame) => [...g.t1, ...g.t2].filter((x): x is string => !!x)
export const complete = (g: EGame) => filled(g).length === 4
export const empties = (g: EGame) => 4 - filled(g).length
export const gap = (g: EGame) => (complete(g) ? Math.abs(sum(g.t1 as string[]) - sum(g.t2 as string[])) : null)

/** 사람별 경기 수(저장된 = 완성된 경기만, 미완성 경기는 화면 상태라 세지 않음) */
export function counts(ds: Dataset, games: EGame[]) {
  const c: Record<string, number> = Object.fromEntries(ds.ids.map((id) => [id, 0]))
  for (const g of games) if (complete(g)) for (const id of filled(g)) c[id] = (c[id] ?? 0) + 1
  return c
}
const spread = (c: Record<string, number>) => {
  const v = Object.values(c)
  return v.length ? Math.max(...v) - Math.min(...v) : 0
}
/** 같은 대진: 같은 4명이 같은 두 조로 */
const matchKey = (g: EGame) => [[...g.t1].sort().join('+'), [...g.t2].sort().join('+')].sort().join(' vs ')
export const sameMatch = (a: EGame, b: EGame) => complete(a) && complete(b) && matchKey(a) === matchKey(b)
export function repeats(games: EGame[], g: EGame) {
  if (!complete(g)) return false
  const k = matchKey(g)
  return games.some((o) => o.key !== g.key && complete(o) && matchKey(o) === k)
}

export const at = (g: EGame, t: Target): Slot => (t.side === 0 ? g.t1 : g.t2)[t.idx]
export function put(g: EGame, t: Target, id: Slot): EGame {
  const side = [...(t.side === 0 ? g.t1 : g.t2)] as [Slot, Slot]
  side[t.idx] = id
  return t.side === 0 ? { ...g, t1: side } : { ...g, t2: side }
}
/** 같은 경기 맞교환: 대상 자리와 상대 조의 그 사람 자리를 바꿈 */
export function swap(g: EGame, t: Target, other: string): EGame {
  const me = at(g, t)
  const os = t.side === 0 ? 1 : 0
  const oSide = os === 0 ? g.t1 : g.t2
  const oi = oSide.indexOf(other) as 0 | 1
  return put(put(g, t, other), { key: g.key, side: os as 0 | 1, idx: oi }, me)
}

export type Cand = {
  id: string
  section: 'swap' | 'replace'
  state: 'ok' | 'warn' | 'off'
  games: number
  gap: number | null
  warns: string[]
  reason?: string
  next: EGame
}

/** 후보 목록(UXD-102): 구역·상태·경기 수·변경 후 실력차. confirmed = 확정 후 교체(SCR-112에서 엶) */
export function candidates(ds: Dataset, games: EGame[], t: Target, confirmed = false): Cand[] {
  const g = games.find((x) => x.key === t.key)!
  const me = at(g, t)
  const cnt = counts(ds, games)
  const before = spread(cnt)
  const inGame = new Set(filled(g))
  const opp = (t.side === 0 ? g.t2 : g.t1).filter((x): x is string => !!x)
  const out: Cand[] = []
  const judge = (id: string, section: Cand['section'], next: EGame): Cand => {
    const after = games.map((x) => (x.key === g.key ? next : x))
    const c2 = counts(ds, after)
    const warns: string[] = []
    const rep = repeats(after, next)
    if (rep && confirmed) return { id, section, state: 'off', games: cnt[id] ?? 0, gap: gap(next), warns, reason: '다른 경기와 같은 대진이 됩니다', next }
    if (rep) warns.push('같은 대진 반복')
    const s2 = spread(c2)
    if (s2 >= 2 && s2 > before) warns.push(`경기 수 차이 ${s2}`)
    return { id, section, state: warns.length ? 'warn' : 'ok', games: cnt[id] ?? 0, gap: gap(next), warns, next }
  }
  // ① 같은 경기 맞교환(개인전·확정 전·선수 자리)
  if (ds.kind === 'individual' && !confirmed && me) for (const o of opp) out.push(judge(o, 'swap', swap(g, t, o)))
  // ② 다른 참가자와 교체 / 선수 선택(팀전은 그 자리 팀만)
  const team = ds.teams ? (t.side === 0 ? 'blue' : 'white') : null
  const pool = ds.ids.filter((id) => id !== me && (!team || ds.teams![id] === team))
  for (const id of pool) {
    if (out.some((c) => c.id === id)) continue
    if (inGame.has(id)) {
      out.push({ id, section: 'replace', state: 'off', games: cnt[id] ?? 0, gap: null, warns: [], reason: '같은 경기에 이미 있습니다', next: g })
      continue
    }
    out.push(judge(id, 'replace', put(g, t, id)))
  }
  // 정렬: 구역마다 경기 수 적은 순 → 이름순(UXD-040), 선택 불가는 맨 아래
  const rank = (c: Cand) => (c.state === 'off' ? 1 : 0)
  return out.sort((a, b) => (a.section === b.section ? 0 : a.section === 'swap' ? -1 : 1) || rank(a) - rank(b) || a.games - b.games || person(a.id).name.localeCompare(person(b.id).name, 'ko'))
}

/** 자동 생성 재현: 시드마다 같은 경기 구성을 돌려 다른 대진처럼 보이게 함(프리뷰 전용) */
export function regenerate(ds: Dataset, seed: number, count: number): EGame[] {
  const src = dataset(ds.kind === 'team' ? (ds.ids.length > 4 ? 'team16' : 'team4') : ds.ids.length > 4 ? 'ind16' : 'ind4').games
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const a = src[(i + seed) % src.length]
    return { ...a, key: i + 1, relax: a.relax === 'gender' ? 'gender' : undefined }
  })
}
