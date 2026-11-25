import { ChevronRight, TriangleAlert, Users } from 'lucide-react'
import type { ReactNode } from 'react'

// CMP-028 StickySummary — 04, Design Direction r12 VD-064·065, Preview r8.
// - kind=teamBalance: 목록을 내려도 보이는 팀 현황 묶음(위쪽 sticky)
// - kind=selection: 선택 요약 줄 '선택 n명 · 남 a 여 b ›'(목록 아래·행동 바 위, 누르면 선택 확인 시트)
// - kind=warning: 경고 줄 '점수 미설정 n명 · 점수 매기기'
export function StickySummary(
  props:
    | { kind: 'teamBalance'; children: ReactNode }
    | { kind: 'selection'; count: number; male: number; female: number; onOpen: () => void }
    | { kind: 'warning'; text: string; action: string; onAction: () => void },
) {
  if (props.kind === 'teamBalance')
    return (
      <div className="su-sticky" data-testid="su-fixed-top" data-cmp="CMP-028" data-kind="teamBalance">
        {props.children}
      </div>
    )
  if (props.kind === 'warning')
    return (
      <button type="button" className="su-warnline" data-cmp="CMP-028" data-kind="warning" onClick={props.onAction} aria-label={`${props.text}, ${props.action}`}>
        <TriangleAlert aria-hidden />
        {props.text}
        <b>{props.action}</b>
      </button>
    )
  return (
    <button type="button" className="su-summary" data-cmp="CMP-028" data-kind="selection" aria-live="polite" onClick={props.onOpen} aria-label={`선택 ${props.count}명, 남 ${props.male} 여 ${props.female}. 선택한 참가자 확인`}>
      <Users aria-hidden />
      선택 {props.count}명 <em>· 남 {props.male} 여 {props.female}</em>
      <span className="su-more">
        확인 <ChevronRight aria-hidden className="size-4" />
      </span>
    </button>
  )
}
