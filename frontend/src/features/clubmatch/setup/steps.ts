import type { ClubMatchView, ClubMethod, ParticipantRow, Team } from '../api'

// 청백전 단계형 생성(SCR-241–245) 규칙 — 기획 r10 C-31–C-34, UX Spec r9(02 '생성 페이지 공통'·각 단계 '단계 이동·저장 조건')
// 화면과 무관한 계산만 둡니다(테스트하기 쉽게). 저장된 데이터(ClubMatchView) 기준으로 단계 완료·재진입 단계를 정합니다(C-32).

export type StepKey = 'basic' | 'participants' | 'teams' | 'games' | 'confirm'
export const STEP_NAMES: Record<StepKey, string> = { basic: '기본정보', participants: '참가자 설정', teams: '팀 구성', games: '대진 설정', confirm: '확정' }
export const STEP_SCR: Record<StepKey, string> = { basic: 'SCR-241', participants: 'SCR-242', teams: 'SCR-243', games: 'SCR-244', confirm: 'SCR-245' }

/** 방식에 따른 단계(AC-122): 팀전 5단계, 개인전 4단계(팀 구성 단계는 아예 없음) */
export function stepsFor(method: ClubMethod): StepKey[] {
  return method === 'team' ? ['basic', 'participants', 'teams', 'games', 'confirm'] : ['basic', 'participants', 'games', 'confirm']
}

export const MIN_PARTICIPANTS = 4
export const MIN_PER_TEAM = 2

export const isStepKey = (v: string | undefined): v is StepKey => !!v && v in STEP_NAMES

/** 참가 중인 행(이 청백전 참가자) */
export const participantsOf = (v: ClubMatchView) => v.rows.filter((r) => r.participating)

/** 참가자 단계 다음 조건(C-32·AC-126): 4명 이상, 모두 점수 있음 */
export function participantsProblem(rows: Pick<ParticipantRow, 'score'>[]): string | null {
  if (rows.length < MIN_PARTICIPANTS) return `참가자를 4명 이상 선택해 주세요 · 지금 ${rows.length}명`
  const unscored = rows.filter((r) => r.score === null).length
  if (unscored) return `점수 미설정 ${unscored}명의 점수를 매겨 주세요`
  return null
}

/** 팀 구성 단계 다음 조건(C-34·AC-128): 미배정 0명, 팀마다 2명 이상(인원 차이는 경고만) */
export function teamsProblem(teams: (Team | null)[]): string | null {
  const none = teams.filter((t) => t === null).length
  if (none) return `미배정 ${none}명의 팀을 골라 주세요`
  const blue = teams.filter((t) => t === 'blue').length
  const white = teams.length - blue
  if (blue < MIN_PER_TEAM) return '청팀이 2명 이상이어야 합니다'
  if (white < MIN_PER_TEAM) return '백팀이 2명 이상이어야 합니다'
  return null
}

/** 저장된 데이터로 본 단계 완료 여부(C-32 재진입 조건) */
export function completion(v: ClubMatchView): Record<StepKey, boolean> {
  const parts = participantsOf(v)
  const participants = participantsProblem(parts) === null
  const teams = v.method === 'individual' || teamsProblem(parts.map((r) => r.team)) === null
  const games = v.games.length > 0
  return { basic: true, participants, teams, games, confirm: participants && teams && games }
}

/** 재진입 단계(AC-131, C-32): 처음 충족되지 않은 단계, 모두 충족하면 확정 */
export function resumeStep(v: ClubMatchView): StepKey {
  const done = completion(v)
  for (const s of stepsFor(v.method)) if (s !== 'confirm' && !done[s]) return s
  return 'confirm'
}

/**
 * 진행 표시에서 갈 수 있는 단계: 앞 단계가 모두 완료된 단계까지(저장값 기준).
 * 대진이 있으면 모든 단계(확정 단계에서 검증 실패 항목과 '수정'을 보여 줌, SCR-245-ST7 — 예: 그사이 명단 점수가 지워짐)
 */
export function reachable(v: ClubMatchView): Set<StepKey> {
  const steps = stepsFor(v.method)
  if (v.games.length > 0) return new Set(steps)
  const done = completion(v)
  const out = new Set<StepKey>()
  for (const s of steps) {
    out.add(s)
    if (s !== 'confirm' && !done[s]) break
  }
  return out
}

export const setupPath = (id: string, step?: StepKey) => `/club-matches/${encodeURIComponent(id)}/setup${step ? `/${step}` : ''}`

/** 같은 키 집합인지(순서 무관) */
export const sameSet = (a: Iterable<string>, b: Iterable<string>) => {
  const x = new Set(a)
  const y = new Set(b)
  return x.size === y.size && [...x].every((k) => y.has(k))
}
