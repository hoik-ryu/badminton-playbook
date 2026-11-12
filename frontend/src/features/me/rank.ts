// 랭크(C-07·C-17, AC-045·046): 청백전 누적(개인전·팀전 모든 경기) 10경기 이상, 승률 S 70%·A 55%·B 40% 이상, C 40% 미만
export type Rank = 'S' | 'A' | 'B' | 'C'
export const RANK_MIN_GAMES = 10

export function rankFor(games: number, wins: number): { rank: Rank | null; gamesToRank: number | null; rate: number | null } {
  const rate = games ? wins / games : null
  if (games < RANK_MIN_GAMES) return { rank: null, gamesToRank: RANK_MIN_GAMES - games, rate }
  const r = rate ?? 0
  return { rank: r >= 0.7 ? 'S' : r >= 0.55 ? 'A' : r >= 0.4 ? 'B' : 'C', gamesToRank: null, rate }
}
