import type { Situation, Stage, Verdict } from './types'

// 게임 로직(FR-025, C-22·C-23, AC-091·092·094·096) — 렌더링 없이 동작하는 순수 함수(NFR-009).
// - 한 상황의 점수는 첫 시도 정답일 때만 1점. 재도전으로 맞혀도 0점
// - 상황 수의 70% 이상이면 통과(5상황이면 4점)
// - 진행은 메모리에만 두고 스테이지를 마칠 때만 저장(이어하기 없음). 저장 항목은 통과 여부·최고 점수·최초 통과 시각 3개뿐
export const PASS_NUMERATOR = 7
export const PASS_DENOMINATOR = 10

export type Run = {
  stageId: string
  /** 현재 상황 번호(0부터). total이면 끝 */
  index: number
  /** 현재 상황에서 고른 횟수(0이면 첫 시도 전, 1 이상이면 재도전 중) */
  attempts: number
  /** 상황별 첫 시도 판정(아직이면 null) */
  first: (Verdict | null)[]
  /** 가장 최근 선택의 판정(결과 표시 중이 아니면 null) */
  last: Verdict | null
}

export function judge(situation: Situation, choiceId: string): Verdict {
  const c = situation.choices.find((x) => x.id === choiceId)
  if (!c) throw new Error(`unknown choice ${choiceId} in ${situation.id}`)
  return c.verdict
}

export function startRun(stage: Stage): Run {
  return { stageId: stage.id, index: 0, attempts: 0, first: stage.situations.map(() => null), last: null }
}

/** 움직임 선택. 첫 시도 판정만 점수에 남김 */
export function choose(run: Run, stage: Stage, choiceId: string): Run {
  if (run.last !== null) throw new Error('result is showing; retry or go next first')
  const situation = stage.situations[run.index]
  if (!situation) throw new Error('run is finished')
  const verdict = judge(situation, choiceId)
  const first = run.attempts === 0 ? run.first.map((v, i) => (i === run.index ? verdict : v)) : run.first
  return { ...run, attempts: run.attempts + 1, first, last: verdict }
}

/** '다시 도전': 같은 상황 처음부터(재도전 표시, 이 상황은 이미 0점이면 0점 그대로) */
export function retry(run: Run): Run {
  if (run.last === null || run.last === 'correct') throw new Error('retry is only after acceptable or wrong')
  return { ...run, last: null }
}

/** '다음 상황': 결과를 본 뒤에만. 재도전하지 않고 넘어가면 그 상황은 0점 */
export function next(run: Run): Run {
  if (run.last === null) throw new Error('choose first')
  return { ...run, index: run.index + 1, attempts: 0, last: null }
}

export const isRetrying = (run: Run) => run.attempts > 0 && run.last === null
export const isFinished = (run: Run, stage: Stage) => run.index >= stage.situations.length

/** 지금까지의 점수(첫 시도 정답 수) */
export const scoreOf = (run: Run) => run.first.filter((v) => v === 'correct').length

export const passScore = (total: number) => Math.ceil((total * PASS_NUMERATOR) / PASS_DENOMINATOR)
export const isPassed = (score: number, total: number) => score * PASS_DENOMINATOR >= total * PASS_NUMERATOR

export type StageResult = {
  stageId: string
  score: number
  total: number
  passed: boolean
  /** 틀린(허용·오답) 상황 id — 결과 화면에서만 쓰고 저장하지 않음(C-23, NFR-006) */
  missed: string[]
}

export function summarize(run: Run, stage: Stage): StageResult {
  const score = scoreOf(run)
  const total = stage.situations.length
  return { stageId: stage.id, score, total, passed: isPassed(score, total), missed: stage.situations.filter((_, i) => run.first[i] !== 'correct').map((s) => s.id) }
}

/** 회원 × 스테이지 기록(C-23: 이 3개만 저장) */
export type StageProgress = { passed: boolean; best: number; firstPassedAt: string | null }

/** 저장 규칙(멱등, SCR-103): 통과 OR, 최고 점수 MAX, 최초 통과 시각은 비어 있고 이번에 통과했을 때만 */
export function mergeProgress(prev: StageProgress | undefined, result: Pick<StageResult, 'score' | 'passed'>, savedAt: string): StageProgress {
  const passed = (prev?.passed ?? false) || result.passed
  return {
    passed,
    best: Math.max(prev?.best ?? 0, result.score),
    firstPassedAt: prev?.firstPassedAt ?? (result.passed ? savedAt : null),
  }
}
