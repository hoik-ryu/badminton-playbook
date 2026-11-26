import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { generateRoundGames, roundPreview, type ClubMethod, type ClubPlayer, type ClubRules } from './schedule'

// (B15, C-36·AC-145–147) 라운드 기반 생성·미리보기를 서버(backend/app/modules/clubmatch/schedule.py)도 똑같이 냅니다.
// 이 테스트가 TS 결과를 골든 파일로 고정하고, 백엔드 테스트(tests/modules/test_clubmatch_rounds_golden.py)가 같은 파일과 비교합니다.
// 알고리즘을 의도적으로 바꿀 때만 UPDATE_GOLDEN=1 pnpm exec vitest run rounds.golden 으로 다시 쓰고 서버도 같이 고칩니다.
const goldenPath = path.resolve(__dirname, '../../../../backend/tests/golden/clubmatch_rounds.json')

const RULES: ClubRules[] = [
  { balance: true, gender: true },
  { balance: false, gender: true },
  { balance: true, gender: false },
]

function people(n: number, teams?: [number, number], women = Math.floor(n / 2)): ClubPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `${i % 5 === 4 ? 'guest' : 'member'}:r${String((i * 7) % n).padStart(2, '0')}`,
    gender: i < women ? '여' : '남',
    score: ((i * 3) % 10) + 1,
    team: teams ? (i < teams[0] ? 'blue' : 'white') : null,
  }))
}

type GenCase = { name: string; method: ClubMethod; rounds: number; courts: number; rules: ClubRules; seed: number; players: ClubPlayer[] }

function genCases(): GenCase[] {
  const out: GenCase[] = []
  const shapes: [string, ClubMethod, number, [number, number] | undefined, number, number][] = [
    ['ind20c4', 'individual', 20, undefined, 4, 5],
    ['ind18c4', 'individual', 18, undefined, 4, 5],
    ['ind9c2', 'individual', 9, undefined, 2, 6],
    ['ind8c2', 'individual', 8, undefined, 2, 7],
    ['ind32c8', 'individual', 32, undefined, 8, 25],
    ['ind6c3', 'individual', 6, undefined, 3, 4],
    ['team18c4', 'team', 18, [9, 9], 4, 5],
    ['team16c4', 'team', 16, [9, 7], 4, 6],
    ['team8c2', 'team', 8, [4, 4], 2, 5],
    ['team10c1', 'team', 10, [6, 4], 1, 9],
  ]
  for (const [name, method, n, teams, courts, rounds] of shapes)
    for (const rules of RULES) for (const seed of [0, 7, 2 ** 31 - 1]) out.push({ name: `${name}-${+rules.balance}${+rules.gender}-${seed}`, method, rounds, courts, rules, seed, players: people(n, teams) })
  return out
}

function previewCases() {
  const out: { method: ClubMethod; sizes: { all: number; blue: number; white: number }; courts: number; rounds: number }[] = []
  for (const all of [4, 5, 8, 9, 13, 16, 18, 20, 24, 30]) for (const courts of [1, 2, 3, 4, 6, 8]) for (const rounds of [1, 3, 5, 7, 12, 50]) out.push({ method: 'individual', sizes: { all, blue: 0, white: 0 }, courts, rounds })
  for (const [b, w] of [[2, 2], [3, 5], [9, 7], [9, 9], [10, 4], [6, 6]] as const) for (const courts of [1, 2, 4, 8]) for (const rounds of [1, 4, 6, 9, 33]) out.push({ method: 'team', sizes: { all: b + w, blue: b, white: w }, courts, rounds })
  return out
}

describe('round generation golden (FE ↔ BE)', () => {
  it('writes or matches backend/tests/golden/clubmatch_rounds.json', () => {
    const data = {
      generate: genCases().map((c) => ({ ...c, games: generateRoundGames(c) })),
      preview: previewCases().map((c) => ({ ...c, preview: roundPreview(c.method, c.sizes, c.courts, c.rounds) })),
    }
    if (process.env.UPDATE_GOLDEN === '1') fs.writeFileSync(goldenPath, JSON.stringify(data) + '\n')
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'))
    expect(data).toEqual(golden)
  })
})
