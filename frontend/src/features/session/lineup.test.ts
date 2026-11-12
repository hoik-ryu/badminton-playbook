import { describe, expect, it } from 'vitest'

import { addToHistory, EMPTY_HISTORY, generateLineup, LineupError, matchupKey, pairKey, skillGap, type History, type Player, type Rules } from './lineup'

// 기획 인수 조건(AC-024–033, AC-040, AC-061)을 생성기 단위로 확인합니다.
const ALL_OFF: Rules = { balance: false, gender: false, fairness: false, noRepeat: false }
const ALL_ON: Rules = { balance: true, gender: true, fairness: true, noRepeat: true }
const people = (n: number, gender: (i: number) => '남' | '여' = (i) => (i % 2 ? '여' : '남'), score: (i: number) => number = (i) => (i % 10) + 1): Player[] =>
  Array.from({ length: n }, (_, i) => ({ key: `p${i}`, gender: gender(i), score: score(i), checkOrder: i }))
const keysOf = (l: { courts: { team1: string[]; team2: string[] }[] }) => l.courts.flatMap((c) => [...c.team1, ...c.team2])

describe('live lineup generator (mock, C-01–C-06)', () => {
  it('AC-024: 18 attendees fill 4 courts, 2 wait, nobody plays twice', () => {
    const l = generateLineup({ players: people(18), courts: 4, method: 'random', rules: ALL_ON, history: EMPTY_HISTORY, seed: 1 })
    expect(l.courts).toHaveLength(4)
    expect(l.waiting).toHaveLength(2)
    expect(new Set(keysOf(l)).size).toBe(16)
  })

  it('AC-025 / AC-026: 15 → 3 courts and 3 waiting; fewer than 4 → not generated', () => {
    const l = generateLineup({ players: people(15), courts: 4, method: 'random', rules: ALL_ON, history: EMPTY_HISTORY, seed: 2 })
    expect(l.courts).toHaveLength(3)
    expect(l.waiting).toHaveLength(3)
    expect(() => generateLineup({ players: people(3), courts: 4, method: 'random', rules: ALL_ON, history: EMPTY_HISTORY, seed: 2 })).toThrow(LineupError)
  })

  it('AC-027: last round waiting players are assigned first (fairness on)', () => {
    const ps = people(18)
    const r1 = generateLineup({ players: ps, courts: 4, method: 'random', rules: { ...ALL_OFF, fairness: true }, history: EMPTY_HISTORY, seed: 3 })
    const h = addToHistory(EMPTY_HISTORY, r1)
    const r2 = generateLineup({ players: ps, courts: 4, method: 'random', rules: { ...ALL_OFF, fairness: true }, history: h, seed: 4 })
    for (const w of r1.waiting) expect(keysOf(r2)).toContain(w)
  })

  it('AC-028: same input and seed give the same result; a new seed can differ', () => {
    const args = { players: people(18), courts: 4, method: 'random' as const, rules: ALL_ON, history: EMPTY_HISTORY }
    expect(generateLineup({ ...args, seed: 7 })).toEqual(generateLineup({ ...args, seed: 7 }))
  })

  it('AC-029: men 10 / women 6 with the gender rule → 3 mixed doubles and 1 men doubles, no imbalance', () => {
    const ps = people(16, (i) => (i < 10 ? '남' : '여'))
    const l = generateLineup({ players: ps, courts: 4, method: 'random', rules: { ...ALL_OFF, gender: true }, history: EMPTY_HISTORY, seed: 5 })
    const g = new Map(ps.map((p) => [p.key, p.gender]))
    const kinds = l.courts.map((c) => {
      const t1 = c.team1.map((k) => g.get(k)).sort().join('')
      const t2 = c.team2.map((k) => g.get(k)).sort().join('')
      return t1 === '남여' && t2 === '남여' ? 'mixed' : t1 === '남남' && t2 === '남남' ? 'men' : t1 === '여여' && t2 === '여여' ? 'women' : 'bad'
    })
    expect(kinds.filter((k) => k === 'mixed')).toHaveLength(3)
    expect(kinds.filter((k) => k === 'men')).toHaveLength(1)
    expect(l.courts.every((c) => c.relaxations.length === 0)).toBe(true)
  })

  it('AC-061: unavoidable imbalance (men 1, women 3) is marked as gender relaxation', () => {
    const ps = people(4, (i) => (i === 0 ? '남' : '여'))
    const l = generateLineup({ players: ps, courts: 4, method: 'random', rules: { ...ALL_OFF, gender: true }, history: EMPTY_HISTORY, seed: 6 })
    expect(l.courts[0]!.relaxations).toContain('gender')
  })

  it('AC-030: balance splits 9,7,5,3 into (9+3) vs (7+5)', () => {
    const scores = [9, 7, 5, 3]
    const ps = people(4, () => '남', (i) => scores[i]!)
    const l = generateLineup({ players: ps, courts: 4, method: 'random', rules: { ...ALL_OFF, balance: true }, history: EMPTY_HISTORY, seed: 8 })
    const s = new Map(ps.map((p) => [p.key, p.score]))
    const sums = [l.courts[0]!.team1, l.courts[0]!.team2].map((t) => t.reduce((a, k) => a + s.get(k)!, 0))
    expect(Math.abs(sums[0]! - sums[1]!)).toBe(0)
  })

  it('AC-031: level method groups within bands and fills from the adjacent band', () => {
    const scores = [10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 3, 2, 1] // 상 5, 중 7, 하 4
    const ps = people(16, () => '남', (i) => scores[i]!)
    const l = generateLineup({ players: ps, courts: 4, method: 'level', rules: ALL_OFF, history: EMPTY_HISTORY, seed: 9 })
    const s = new Map(ps.map((p) => [p.key, p.score]))
    const groups = l.courts.map((c) => [...c.team1, ...c.team2].map((k) => s.get(k)!).sort((a, b) => b - a))
    expect(groups).toContainEqual([4, 3, 2, 1]) // 하 4명
    expect(groups).toContainEqual([10, 9, 9, 8]) // 상 4명
    expect(groups).toContainEqual([8, 7, 7, 6]) // 남은 상 1명 + 중 최고점 3명
    expect(groups).toContainEqual([6, 5, 5, 5]) // 중 나머지 4명
  })

  it('P2: level + gender rule — gender structure first, then closest scores; no gender relaxation when feasible', () => {
    // 남 8(점수 10..3), 여 8(점수 10..3) → 혼복 4경기, 각 경기 점수 차이가 작게
    const ps = people(16, (i) => (i < 8 ? '남' : '여'), (i) => 10 - (i % 8))
    const l = generateLineup({ players: ps, courts: 4, method: 'level', rules: { ...ALL_OFF, gender: true }, history: EMPTY_HISTORY, seed: 11 })
    const s = new Map(ps.map((p) => [p.key, p.score]))
    expect(l.courts.every((c) => c.relaxations.length === 0)).toBe(true)
    for (const c of l.courts) {
      const sc = [...c.team1, ...c.team2].map((k) => s.get(k)!)
      expect(Math.max(...sc) - Math.min(...sc)).toBeLessThanOrEqual(1) // 같은 레벨끼리(10·9 / 8·7 / 6·5 / 4·3)
    }
  })

  it('AC-032 / C-05: 20 attendees, 5 rounds — no repeated matchup and no repeated partner', () => {
    const ps = people(20)
    let h: History = EMPTY_HISTORY
    const partners: string[] = []
    const matchups: string[] = []
    for (let round = 0; round < 5; round++) {
      const l = generateLineup({ players: ps, courts: 4, method: 'random', rules: { ...ALL_OFF, noRepeat: true }, history: h, seed: 100 + round })
      for (const c of l.courts) {
        partners.push(pairKey(...c.team1), pairKey(...c.team2))
        matchups.push(matchupKey(c.team1, c.team2))
      }
      h = addToHistory(h, l)
    }
    expect(new Set(partners).size).toBe(partners.length)
    expect(new Set(matchups).size).toBe(matchups.length)
  })

  it('AC-040: with fairness on, game counts differ by at most 1 after 4 rounds of 18', () => {
    const ps = people(18)
    let h: History = EMPTY_HISTORY
    for (let round = 0; round < 4; round++) h = addToHistory(h, generateLineup({ players: ps, courts: 4, method: 'random', rules: ALL_ON, history: h, seed: 200 + round }))
    const counts = ps.map((p) => h.games[p.key] ?? 0)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('C-24: skill gap is the absolute difference; any unset score → not computable', () => {
    expect(skillGap([7, 5], [6, 4])).toBe(2)
    expect(skillGap([7, null], [6, 4])).toBeNull()
  })
})
