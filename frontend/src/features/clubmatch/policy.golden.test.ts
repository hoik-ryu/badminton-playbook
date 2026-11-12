import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { matchupKey } from '../session/lineup'
import { individualStandings, refreshAfterSwap, substituteDecision, type ClubGame, type GameState, type Relaxation } from './schedule'

// I3-d: Mock(FE)과 서버(backend/app/modules/clubmatch/schedule.py)가 같은 정책 판정을 내는지 골든 파일로 고정합니다.
// - 순위 정렬 U4(승수 → 승률 → 이름 → 키)·공동 순위 U3
// - 교체·중도 귀가 뒤 반복·완화 사유 재계산(P-4·P-4-b)
// - 중도 귀가 대체 판정(P-4-b: 피할 수 있는 중복 → 거부, 불가피한 중복 → 예외)
// 백엔드 tests/modules/test_clubmatch_policy_golden.py가 같은 파일과 비교합니다.
// 규칙을 의도적으로 바꿀 때만 UPDATE_GOLDEN=1 pnpm exec vitest run policy.golden 으로 다시 쓰고 서버도 같이 고칩니다.
const goldenPath = path.resolve(__dirname, '../../../../backend/tests/golden/clubmatch_policy.json')

function lcg(seed: number) {
  let s = seed
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
}
const NAMES = ['가람', '나래', '다솜', '라온', '마루', '바다', '사랑', '아라', '가람', '나래'] // 이름 동률 포함
type Seats = [[string, string], [string, string]]

function sample<T>(r: () => number, list: T[], k: number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a.slice(0, k)
}

function compute() {
  const r = lcg(20261112)
  // 순위(U3·U4)
  const standings = Array.from({ length: 60 }, () => {
    const n = 4 + Math.floor(r() * 7)
    const keys = Array.from({ length: n }, (_, i) => `p${i}`)
    const names = Object.fromEntries(keys.map((k, i) => [k, NAMES[(i * 3 + Math.floor(r() * 3)) % NAMES.length]!]))
    const games: ClubGame[] = Array.from({ length: 1 + Math.floor(r() * 10) }, (_, no) => {
      const four = sample(r, keys, 4)
      const w = r()
      return { no: no + 1, team1: [four[0]!, four[1]!], team2: [four[2]!, four[3]!], winner: w < 0.2 ? null : w < 0.6 ? 1 : 2, genderRelaxed: false }
    })
    const participants = keys.filter(() => r() < 0.9)
    return { games: games.map((g) => [...g.team1, ...g.team2, g.winner]), participants, names, out: individualStandings(games, participants, (k) => names[k] ?? '') }
  })
  // 재계산(P-4·P-4-b)
  const reasons: Relaxation['reason'][] = ['exhausted', 'higher_priority', 'search_limit', 'manual', 'substitute_exhausted']
  const refresh = Array.from({ length: 60 }, () => {
    const n = 5 + Math.floor(r() * 3)
    const keys = Array.from({ length: n }, (_, i) => `p${i}`)
    const genders = Object.fromEntries(keys.map((k) => [k, r() < 0.1 ? null : r() < 0.5 ? '남' : '여'] as const))
    const states: GameState[] = Array.from({ length: 2 + Math.floor(r() * 5) }, (_, no) => {
      const four = r() < 0.3 && no > 0 ? null : sample(r, keys, 4)
      const t = four ?? sample(r, keys.slice(0, 4), 4) // 같은 4명이 되기 쉽게
      const rel: Relaxation[] = []
      if (r() < 0.4) rel.push({ rule: 'matchup', reason: reasons[Math.floor(r() * reasons.length)]! })
      if (r() < 0.4) rel.push({ rule: 'gender', reason: reasons[Math.floor(r() * 4)]! })
      return { no: no + 1, team1: [t[0]!, t[1]!], team2: [t[2]!, t[3]!], manual: r() < 0.4, genderRelaxed: r() < 0.3, repeatedMatchup: r() < 0.4, relaxations: rel }
    })
    const input = structuredClone(states)
    const rule = r() < 0.7
    // forced: 중도 귀가에서 불가피하다고 확인된 대진 키(마지막 경기 대진, 30%)
    const last = states[states.length - 1]!
    const forcedKeys = new Set(r() < 0.3 ? [matchupKey([...last.team1], [...last.team2])] : [])
    refreshAfterSwap(states, (k) => genders[k] ?? null, rule, forcedKeys)
    return { input, genders, rule, forced: [...forcedKeys], out: states }
  })
  // 중도 귀가 대체 판정(P-4-b)
  const substitute = Array.from({ length: 120 }, () => {
    const n = 5 + Math.floor(r() * 3)
    const keys = Array.from({ length: n }, (_, i) => `p${i}`)
    const leaver = keys[0]!
    const seats = new Map<number, Seats>()
    const count = 2 + Math.floor(r() * 4)
    for (let no = 1; no <= count; no++) {
      const others = sample(r, keys.slice(1), r() < 0.5 ? 3 : 4)
      const four = others.length === 3 ? sample(r, [leaver, ...others], 4) : others
      seats.set(no, [[four[0]!, four[1]!], [four[2]!, four[3]!]])
    }
    const remaining = [...seats].filter(([, s]) => s.flat().includes(leaver)).map(([no]) => no)
    const cands = (no: number) => keys.filter((k) => k !== leaver && !seats.get(no)!.flat().includes(k))
    const picks = new Map(remaining.map((no) => [no, cands(no)[Math.floor(r() * cands(no).length)]!]))
    const d = substituteDecision(seats, leaver, picks, cands)
    return {
      seats: [...seats].map(([no, s]) => [no, s]),
      leaver,
      picks: [...picks],
      candidates: Object.fromEntries(remaining.map((no) => [no, cands(no)])),
      out: { avoidable: d.avoidable, forced: [...d.forced].sort() },
    }
  })
  return { standings, refresh, substitute }
}

describe('club match policy golden (FE Mock ↔ BE, I3-d)', () => {
  it('matches the shared golden file', () => {
    const actual = JSON.parse(JSON.stringify(compute()))
    if (process.env.UPDATE_GOLDEN === '1') {
      fs.mkdirSync(path.dirname(goldenPath), { recursive: true })
      fs.writeFileSync(goldenPath, JSON.stringify(actual) + '\n')
    }
    expect(JSON.parse(fs.readFileSync(goldenPath, 'utf8'))).toEqual(actual)
  })

  it('covers every decision kind', () => {
    const { substitute, refresh } = compute()
    expect(substitute.some((c) => c.out.avoidable.length)).toBe(true)
    expect(substitute.some((c) => c.out.forced.length)).toBe(true)
    expect(substitute.some((c) => !c.out.avoidable.length && !c.out.forced.length)).toBe(true)
    const reasons = new Set(refresh.flatMap((c) => c.out.flatMap((g) => g.relaxations.map((x) => `${x.rule}:${x.reason}`))))
    for (const r of ['matchup:substitute_exhausted', 'matchup:manual', 'gender:manual']) expect(reasons).toContain(r)
  })
})
