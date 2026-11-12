import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { matchupKey, rng } from '../session/lineup'
import { generateClubGames, type ClubMethod, type ClubPlayer, type ClubRules } from './schedule'

// D1·I3-b: 대진 생성(generateClubGames)과 난수(mulberry32)를 서버(backend/app/modules/clubmatch/schedule.py)도 똑같이 냅니다.
// 이 테스트가 TS 결과를 골든 파일로 고정하고, 백엔드 테스트(tests/modules/test_clubmatch_generate.py)가 같은 파일과 비교합니다.
// 알고리즘을 의도적으로 바꿀 때만 UPDATE_GOLDEN=1 pnpm exec vitest run generate.golden 으로 다시 쓰고 서버도 같이 고칩니다.
const goldenPath = path.resolve(__dirname, '../../../../backend/tests/golden/clubmatch_generate.json')

// 경계 시드: 0, 1, 2^31-1(Mock 최대), 2^31, 2^32-1(>>>0 경계), 2^32(0으로 감김), 덧셈 상수 근처
const RNG_SEEDS = [0, 1, 42, 2 ** 31 - 1, 2 ** 31, 2 ** 32 - 1, 2 ** 32, 0x6d2b79f5, 0x92d4860b, 123456789]
const RULES: ClubRules[] = [
  { balance: true, gender: true },
  { balance: true, gender: false },
  { balance: false, gender: true },
  { balance: false, gender: false },
]

type Case = { name: string; method: ClubMethod; totalGames: number; rules: ClubRules; seed: number; players: ClubPlayer[] }

/** 고정 LCG(입력 만들기용, 엔진 난수와 별개) */
function lcg(seed: number) {
  let s = seed
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
}

function people(n: number, opts: { women?: number; score?: (i: number) => number; teams?: [number, number]; order?: 'asc' | 'mixed' } = {}): ClubPlayer[] {
  const women = opts.women ?? Math.floor(n / 2)
  return Array.from({ length: n }, (_, i) => {
    const idx = opts.order === 'mixed' ? (i * 7) % n : i
    const team = opts.teams ? (i < opts.teams[0] ? 'blue' : 'white') : null
    return { key: `${i % 4 === 3 ? 'guest' : 'member'}:p${String(idx).padStart(2, '0')}`, gender: i % n < women ? '여' : '남', score: opts.score ? opts.score(i) : (i % 10) + 1, team }
  })
}

function cases(): Case[] {
  const out: Case[] = []
  const add = (name: string, method: ClubMethod, totalGames: number, players: ClubPlayer[], seeds = [1, 2 ** 31 - 1, 987654321], rules = RULES) => {
    for (const seed of seeds) for (const r of rules) out.push({ name, method, totalGames, rules: r, seed, players })
  }
  // 개인전: 인원·경기 수 경계
  add('ind-4x1', 'individual', 1, people(4))
  add('ind-4x10 (조합 소진: 4명 3가지 분할뿐)', 'individual', 10, people(4))
  add('ind-5x5', 'individual', 5, people(5))
  add('ind-6x8 남만', 'individual', 8, people(6, { women: 0 }))
  add('ind-7x9 여만', 'individual', 9, people(7, { women: 7 }))
  add('ind-9x12 여1', 'individual', 12, people(9, { women: 1 }))
  add('ind-12x16', 'individual', 16, people(12, { order: 'mixed' }))
  add('ind-16x16 같은 점수', 'individual', 16, people(16, { score: () => 5 }))
  add('ind-20x20', 'individual', 20, people(20, { order: 'mixed' }))
  add('ind-20x20 점수 극단', 'individual', 20, people(20, { score: (i) => (i % 2 ? 1 : 10) }))
  add('ind-8x40 (긴 대진)', 'individual', 40, people(8))
  // 팀전: 팀 크기 경계
  add('team-2v2x5 (조합 1가지)', 'team', 5, people(4, { teams: [2, 2] }))
  add('team-2v3x6', 'team', 6, people(5, { teams: [2, 3] }))
  add('team-3v5x8', 'team', 8, people(8, { teams: [3, 5] }))
  add('team-5v5x10', 'team', 10, people(10, { teams: [5, 5], order: 'mixed' }))
  add('team-2v10x12', 'team', 12, people(12, { teams: [2, 10] }))
  add('team-10v10x20', 'team', 20, people(20, { teams: [10, 10] }))
  add('team-6v6x12 남만', 'team', 12, people(12, { teams: [6, 6], women: 0 }))
  // 무작위 입력(성별·점수·인원·팀) + 시드 여러 개
  const r = lcg(20261112)
  for (let c = 0; c < 24; c++) {
    const n = 4 + Math.floor(r() * 17)
    const team = r() < 0.4 && n >= 4
    const blue = team ? 2 + Math.floor(r() * (n - 3)) : 0
    const players = people(n, { women: Math.floor(r() * (n + 1)), score: () => 1 + Math.floor(r() * 10), teams: team ? [blue, n - blue] : undefined })
    const rule = RULES[Math.floor(r() * 4)]!
    add(`rand-${c}`, team ? 'team' : 'individual', 1 + Math.floor(r() * 24), players, [Math.floor(r() * 2 ** 31)], [rule])
  }
  return out
}

/** 생성 결과 + 같은 4명·같은 팀 반복 여부(U7, 앞선 경기 기준) */
function compute() {
  const generate = cases().map((c) => {
    const games = generateClubGames({ players: c.players, totalGames: c.totalGames, method: c.method, rules: c.rules, seed: c.seed })
    const seen = new Set<string>()
    const rows = games.map((g) => {
      const k = matchupKey([...g.team1], [...g.team2])
      const repeated = seen.has(k)
      seen.add(k)
      return [...g.team1, ...g.team2, g.genderRelaxed ? 1 : 0, repeated ? 1 : 0]
    })
    return { ...c, games: rows }
  })
  const rngRows = RNG_SEEDS.map((seed) => {
    const next = rng(seed)
    return { seed, values: Array.from({ length: 12 }, () => next()) }
  })
  return { rng: rngRows, generate }
}

describe('club match generation golden (FE ↔ BE, D1·I3-b)', () => {
  it('matches the shared golden file', () => {
    const actual = compute()
    if (process.env.UPDATE_GOLDEN === '1') {
      fs.mkdirSync(path.dirname(goldenPath), { recursive: true })
      fs.writeFileSync(goldenPath, JSON.stringify(actual) + '\n')
    }
    expect(JSON.parse(fs.readFileSync(goldenPath, 'utf8'))).toEqual(actual)
  })

  it('ASM-026: 20 people × 20 games under 2s even when the gender fallback search runs every game', () => {
    let worst = 0
    for (const women of [0, 1, 3, 10, 19])
      for (const method of ['individual', 'team'] as const)
        for (const seed of [1, 7, 2 ** 31 - 1]) {
          const players = people(20, { women, teams: method === 'team' ? [10, 10] : undefined })
          const t = performance.now()
          generateClubGames({ players, totalGames: 20, method, rules: RULES[0]!, seed })
          worst = Math.max(worst, performance.now() - t)
        }
    expect(worst).toBeLessThan(2000)
  })

  it('is reproducible: same input and seed → same games, different seed → different games', () => {
    const input = { players: people(12), totalGames: 12, method: 'individual' as const, rules: RULES[0]!, seed: 7 }
    expect(generateClubGames(input)).toEqual(generateClubGames(input))
    expect(generateClubGames({ ...input, seed: 8 })).not.toEqual(generateClubGames(input))
  })
})
