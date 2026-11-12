import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { distribution, evenProposals, proposeTeams, type ClubMethod } from './schedule'

// D1: 청백전 계산은 서버(backend/app/modules/clubmatch/schedule.py)도 같은 결과여야 합니다.
// 입력·결과를 골든 파일로 고정하고 양쪽 테스트가 같은 파일과 비교합니다(BE: tests/modules/test_clubmatch_golden.py).
// 계산 규칙을 의도적으로 바꿀 때만 UPDATE_GOLDEN=1 pnpm exec vitest run schedule.golden 으로 다시 쓰고, 서버도 같이 고칩니다.
const goldenPath = path.resolve(__dirname, '../../../../backend/tests/golden/clubmatch_schedule.json')

type Counts = { all: number; blue: number; white: number }
type Candidate = { key: string; gender: '남' | '여'; score: number | null }

function cases() {
  const counts: { method: ClubMethod; counts: Counts; totalGames: number }[] = []
  for (let all = 0; all <= 20; all++) for (const g of [1, 2, 3, 5, 7, 8, 10, 13, 16, 20]) counts.push({ method: 'individual', counts: { all, blue: 0, white: 0 }, totalGames: g })
  for (let blue = 0; blue <= 8; blue++)
    for (let white = 0; white <= 8; white++) for (const g of [1, 3, 5, 8, 12]) counts.push({ method: 'team', counts: { all: blue + white, blue, white }, totalGames: g })
  // 팀 배정안 입력: 고정 시드 LCG로 4–20명, 점수 없음(null) 포함, 회원·게스트 키 섞음
  let s = 20261112
  const next = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const teams: Candidate[][] = []
  for (let c = 0; c < 30; c++) {
    const n = 4 + Math.floor(next() * 17)
    teams.push(
      Array.from({ length: n }, (_, i) => ({
        key: `${next() < 0.25 ? 'guest' : 'member'}:p${String(i).padStart(2, '0')}`,
        gender: next() < 0.6 ? '남' : '여',
        score: next() < 0.15 ? null : 1 + Math.floor(next() * 10),
      })),
    )
  }
  return { counts, teams }
}

function compute() {
  const { counts, teams } = cases()
  return {
    distribution: counts.map((c) => ({ ...c, preview: distribution(c.method, c.counts, c.totalGames), proposals: evenProposals(c.method, c.counts, c.totalGames) })),
    proposeTeams: teams.map((players) => ({ players, teams: proposeTeams(players) })),
  }
}

describe('club match schedule golden (FE ↔ BE, D1)', () => {
  it('matches the shared golden file', () => {
    const actual = compute()
    if (process.env.UPDATE_GOLDEN === '1') {
      fs.mkdirSync(path.dirname(goldenPath), { recursive: true })
      fs.writeFileSync(goldenPath, JSON.stringify(actual, null, 1) + '\n')
    }
    expect(JSON.parse(fs.readFileSync(goldenPath, 'utf8'))).toEqual(actual)
  })
})
