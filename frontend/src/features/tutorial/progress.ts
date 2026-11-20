// 진행 기록 규칙(SCR-103 저장 규칙, AC-094·C-22·C-23). Mock 어댑터가 서버와 같은 규칙으로 저장할 때 씀.
// api 모드에서는 서버가 계산(클라이언트 점수를 보내지 않음, D-T2). 옛 engine/logic.ts에서 옮김(6단계 정리)
export const PASS_NUMERATOR = 7
export const PASS_DENOMINATOR = 10
export const isPassed = (score: number, total: number) => score * PASS_DENOMINATOR >= total * PASS_NUMERATOR
/** 통과에 필요한 점수(5상황이면 4) */
export const passScore = (total: number) => Math.ceil((total * PASS_NUMERATOR) / PASS_DENOMINATOR)

export type StageProgress = { passed: boolean; best: number; firstPassedAt: string | null }

/** 저장 규칙(멱등): 통과 OR, 최고 점수 MAX, 최초 통과 시각은 비어 있고 이번에 통과했을 때만 */
export function mergeProgress(prev: StageProgress | undefined, result: { score: number; passed: boolean }, savedAt: string): StageProgress {
  const passed = (prev?.passed ?? false) || result.passed
  return { passed, best: Math.max(prev?.best ?? 0, result.score), firstPassedAt: prev?.firstPassedAt ?? (result.passed ? savedAt : null) }
}
