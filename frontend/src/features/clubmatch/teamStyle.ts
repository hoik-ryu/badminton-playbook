import type { ClubMethod } from './schedule'

// 팀 띠 모양(CMP-041 clubMatch, 운영 SCR-223·회원 SCR-112 공통): 팀전 청팀(채움)·백팀(테두리), 개인전 1팀·2팀(띠 없음). 글자 + 색(색만으로 구분하지 않음)
export const teamLabels = (method: ClubMethod) => (method === 'team' ? (['청팀', '백팀'] as const) : (['1팀', '2팀'] as const))
export const teamShort = (method: ClubMethod) => (method === 'team' ? (['청', '백'] as const) : (['1팀', '2팀'] as const))

export function teamBandClass(method: ClubMethod, i: 0 | 1) {
  return method === 'team' ? (i === 0 ? 'bg-blue-team-bg' : 'border border-line-strong bg-white-team-bg') : ''
}

export function teamLabelClass(method: ClubMethod, i: 0 | 1) {
  return method === 'team' ? (i === 0 ? 'text-blue-team-fg' : 'text-white-team-fg') : 'text-ink-muted'
}
