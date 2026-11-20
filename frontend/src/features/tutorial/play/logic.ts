// SCR-102 진행 규칙(렌더링과 분리, NFR-009·AC-096). 판정 자체는 서버가 함(D-T2) — 여기서는 서버 응답을 해석만 합니다.
import { ApiError } from '../../../lib/api'
import type { Judgement, Verdict } from '../api'

/** 상황별 서버 응답(첫 판정·점수) 기록. 키 = 상황 번호(1..n) */
export type RunLedger = Record<number, { firstVerdict: Verdict; points: number }>

/** 서버가 준 상황 점수만 더함(첫 시도 정답 1점, 재도전 0점 — 클라이언트가 점수를 만들지 않음) */
export const scoreOf = (ledger: RunLedger) => Object.values(ledger).reduce((n, r) => n + r.points, 0)

/** 같은 상황의 응답이 여러 번 와도(재도전·재전송) 첫 판정·점수는 서버 값 그대로 */
export const record = (ledger: RunLedger, j: Judgement): RunLedger => ({ ...ledger, [j.situation]: { firstVerdict: j.firstVerdict, points: j.points } })

/** SCR-103에 넘길 틀린 상황(첫 판정 기준) */
export const wrongOf = (ledger: RunLedger): { no: number; kind: 'allow' | 'wrong' }[] =>
  Object.entries(ledger)
    .map(([no, r]) => ({ no: Number(no), kind: r.firstVerdict }))
    .filter((r) => r.kind !== 'correct')
    .sort((a, b) => a.no - b.no)
    .map((r) => ({ no: r.no, kind: r.kind === 'allow' ? ('allow' as const) : ('wrong' as const) }))

/** 판정 제목(02 SCR-102 ST7–ST9, 입문자 ST11 '정답'·'오답') */
export function judgeTitle(j: Judgement, guided: boolean): string {
  if (j.verdict === 'correct') return guided ? '정답' : j.points === 1 ? '득점! +1점' : '득점(재도전 · 0점)'
  if (j.verdict === 'allow') return '랠리 계속'
  return guided ? '오답' : '실점'
}

/** 판정 이유: 서버 해설 + 재도전 정답이면 0점 안내 */
export function judgeReason(j: Judgement): string {
  return j.verdict === 'correct' && j.points === 0 ? `${j.reason} 다시 도전해 맞힌 상황은 0점이에요.` : j.reason
}

/** 정답 움직임 보기(ST10) 문구 */
export function replayText(j: Judgement, guided: boolean): string {
  return guided ? `나는 ${j.answer}번으로 움직여요.` : `나는 ${j.answer}번으로, 파트너는 ${j.correctMove.partnerCell}번으로 움직여요.`
}

/** 오류 → 회복 방법. 어떤 경우에도 점수를 만들거나 진행 기록을 바꾸지 않음
 * - retry: 같은 요청을 다시(서버 멱등 — 판정·회차 시작 모두 안전)
 * - restart: 회차가 없거나 만료·완료·콘텐츠 변경 → 처음부터 새 회차
 * - login: 인증 만료·계정 제한
 * - notFound: 준비 중인 스테이지 */
export type Recovery = 'retry' | 'restart' | 'login' | 'notFound'
export function recoveryOf(err: unknown): Recovery {
  if (!(err instanceof ApiError)) return 'retry'
  if (err.code === 'unauthenticated' || err.code === 'account_restricted' || err.status === 401) return 'login'
  if (err.code === 'stage_not_found') return 'notFound'
  if (['run_not_found', 'run_expired', 'run_completed', 'content_changed', 'out_of_order'].includes(err.code)) return 'restart'
  return 'retry'
}

export const RECOVERY_TEXT: Record<Exclude<Recovery, 'notFound'>, string> = {
  retry: '서버에 연결하지 못했어요. 같은 선택으로 다시 보내도 점수는 바뀌지 않아요.',
  restart: '이번 진행을 이어 갈 수 없어요. 처음부터 다시 해 주세요.',
  login: '로그인이 만료되었어요. 다시 로그인해 주세요.',
}
