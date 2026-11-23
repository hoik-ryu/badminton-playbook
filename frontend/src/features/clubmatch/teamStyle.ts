import type { ClubMethod } from './schedule'

// 팀 글자(CMP-041 clubMatch): 팀전 청팀·백팀, 개인전 1팀·2팀. 띠 모양은 ui/DetailCards CmTeamLine(Preview r5)
// (5-B2) 이전 카드 전용 teamBandClass·teamLabelClass는 쓰는 곳이 없어 지웠습니다.
export const teamLabels = (method: ClubMethod) => (method === 'team' ? (['청팀', '백팀'] as const) : (['1팀', '2팀'] as const))
export const teamShort = (method: ClubMethod) => (method === 'team' ? (['청', '백'] as const) : (['1팀', '2팀'] as const))
