import { describe, expect, it } from 'vitest'

import { matchupKey } from '../session/lineup'
import { distribution, evenProposals, gameCounts, generateClubGames, individualStandings, proposeTeams, teamScore, type ClubGame, type ClubPlayer } from './schedule'

// 청백전 인수 조건(AC-043·072–076·082–084)을 엔진 단위로 확인합니다.
const ps = (n: number, team?: (i: number) => 'blue' | 'white'): ClubPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ key: `p${i}`, gender: i % 2 ? '여' : '남', score: (i % 9) + 1, team: team ? team(i) : null }))

describe('club match schedule (mock, C-14–C-19)', () => {
  it('AC-073: 16 participants, 16 games → everyone plays 4 and nobody twice in a game', () => {
    const games = generateClubGames({ players: ps(16), totalGames: 16, method: 'individual', rules: { balance: true, gender: false }, seed: 1 })
    expect(games).toHaveLength(16)
    const c = gameCounts(games)
    expect([...c.values()].every((v) => v === 4)).toBe(true)
    for (const g of games) expect(new Set([...g.team1, ...g.team2]).size).toBe(4)
  })

  it('AC-074: 14 participants, 10 games → proposals 7 (2 each) and 14 (4 each); keeping 10 gives 12×3 and 2×2', () => {
    const counts = { all: 14, blue: 0, white: 0 }
    expect(evenProposals('individual', counts, 10).map((p) => [p.totalGames, p.each.blue])).toEqual([[7, 2], [14, 4]])
    expect(distribution('individual', counts, 10).groups).toEqual([{ games: 3, people: 12 }, { games: 2, people: 2 }])
    const c = gameCounts(generateClubGames({ players: ps(14), totalGames: 10, method: 'individual', rules: { balance: false, gender: false }, seed: 2 }))
    expect(Math.max(...c.values()) - Math.min(...c.values())).toBeLessThanOrEqual(1)
  })

  it('AC-043: team match games are always blue 2 vs white 2', () => {
    const players = ps(12, (i) => (i < 6 ? 'blue' : 'white'))
    const team = new Map(players.map((p) => [p.key, p.team]))
    for (const g of generateClubGames({ players, totalGames: 9, method: 'team', rules: { balance: true, gender: true }, seed: 3 })) {
      expect(g.team1.every((k) => team.get(k) === 'blue')).toBe(true)
      expect(g.team2.every((k) => team.get(k) === 'white')).toBe(true)
    }
  })

  it('AC-075: no repeated same-4-same-teams game in the whole schedule', () => {
    const games = generateClubGames({ players: ps(8), totalGames: 14, method: 'individual', rules: { balance: false, gender: false }, seed: 4 })
    const keys = games.map((g) => matchupKey(g.team1, g.team2))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('AC-076: same input and seed → same schedule', () => {
    const args = { players: ps(10), totalGames: 8, method: 'individual' as const, rules: { balance: true, gender: true } }
    expect(generateClubGames({ ...args, seed: 9 })).toEqual(generateClubGames({ ...args, seed: 9 }))
  })

  it('AC-072: team proposal splits 16 into 8 vs 8 with similar score sums and gender ratio', () => {
    const players = ps(16).map((p) => ({ ...p, score: p.score as number | null }))
    const t = proposeTeams(players)
    const blue = players.filter((p) => t[p.key] === 'blue')
    const white = players.filter((p) => t[p.key] === 'white')
    expect(blue).toHaveLength(8)
    const sum = (l: typeof players) => l.reduce((a, p) => a + (p.score ?? 0), 0)
    expect(Math.abs(sum(blue) - sum(white))).toBeLessThanOrEqual(4)
    expect(Math.abs(blue.filter((p) => p.gender === '남').length - white.filter((p) => p.gender === '남').length)).toBeLessThanOrEqual(1)
  })

  it('AC-082 / AC-084: individual ties share a rank; team wins decide the winner or a draw', () => {
    const g = (no: number, t1: [string, string], t2: [string, string], winner: 1 | 2 | null): ClubGame => ({ no, team1: t1, team2: t2, winner, genderRelaxed: false })
    const games = [g(1, ['철수', '영희'], ['민수', '지수'], 1), g(2, ['철수', '민수'], ['영희', '지수'], 1)]
    const st = individualStandings(games, ['철수', '영희', '민수', '지수'])
    expect(st.map((s) => [s.key, s.wins, s.rank])).toEqual([['철수', 2, 1], ['민수', 1, 2], ['영희', 1, 2], ['지수', 0, 4]])
    expect(teamScore([g(1, ['a', 'b'], ['c', 'd'], 1), g(2, ['a', 'b'], ['c', 'd'], 2)])).toEqual({ blue: 1, white: 1 })
  })
})
