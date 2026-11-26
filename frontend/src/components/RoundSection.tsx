import { cn } from 'cn'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'

// CMP-059 RoundSection — UX Spec r11 04 CMP-059, DD r14 VD-079(카드로 감싸지 않는 라운드 구역)
// 머리글(높이 40 이상): 'n라운드' + caption(코트 사용·출전) + '휴식 y'(누르면 휴식자 칩) + 태그 + 접기(44).
// phase: edit(생성 편집) · readonly(확정 요약) · live(상세 진행, 진행 중 라운드는 왼쪽 세로 띠). 접힌 구역은 머리글만.
// 구역 사이 구분선은 형제 구역끼리만(첫 구역 위에는 없음)
export type RoundPhase = 'edit' | 'readonly' | 'live'

type Props = {
  id: string
  round: number
  phase: RoundPhase
  caption: string
  /** '휴식 y' 글자(없으면 표시 안 함) */
  restLabel?: string
  /** 펼쳤을 때 보일 휴식자 이름(없으면 '휴식 y'는 글자만) */
  restNames?: string[]
  restOpen?: boolean
  onRest?: () => void
  folded: boolean
  onFold: () => void
  /** caption 뒤 상태 배지(저장 전·빈 자리 있음 등) */
  tags?: ReactNode
  /** 제목 옆 배지(phase=live의 진행 중·완료·시작 전) */
  status?: ReactNode
  current?: boolean
  children?: ReactNode
}

export function RoundSection({ id, round, phase, caption, restLabel, restNames, restOpen, onRest, folded, onFold, tags, status, current, children }: Props) {
  const restId = `${id}-rest`
  return (
    <section data-cmp="CMP-059" data-phase={phase} aria-labelledby={id} className="flex flex-col gap-2 [&+&]:border-t [&+&]:border-line [&+&]:pt-1" data-testid="round-section">
      <div data-current={current || undefined} className={cn('flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1.5', current && 'border-l-[3px] border-action pl-2')}>
        <h3 id={id} className="m-0 inline-flex items-center gap-1.5 text-body font-bold">
          {round}라운드
          {status}
        </h3>
        <span className="inline-flex min-w-0 flex-1 flex-wrap items-center gap-x-1 text-caption text-ink-muted tabular-nums">
          {caption}
          {restLabel &&
            (onRest && restNames ? (
              <button
                type="button"
                aria-expanded={!!restOpen}
                aria-controls={restOpen ? restId : undefined}
                aria-label={`${round}라운드 ${restLabel}, 휴식자 ${restOpen ? '접기' : '보기'}`}
                onClick={onRest}
                className="relative inline-flex min-h-8 items-center gap-0.5 font-bold whitespace-nowrap text-ink-accent after:absolute after:-inset-x-1 after:-inset-y-1.5 after:content-[''] focus-visible:outline-2 focus-visible:outline-focus"
              >
                {restLabel}
                <ChevronDown aria-hidden className={cn('size-3 transition-transform', restOpen && 'rotate-180')} />
              </button>
            ) : (
              restLabel
            ))}
          {tags}
        </span>
        <button
          type="button"
          aria-expanded={!folded}
          aria-label={`${round}라운드 ${folded ? '펼치기' : '접기'}`}
          onClick={onFold}
          className="-my-0.5 -mr-2 ml-auto grid size-11 place-items-center text-ink-muted focus-visible:outline-2 focus-visible:outline-focus"
        >
          {folded ? <ChevronDown aria-hidden className="size-4.5" /> : <ChevronUp aria-hidden className="size-4.5" />}
        </button>
      </div>
      {restOpen && restNames && (
        <div id={restId} aria-label={`${round}라운드 휴식자`} className="-mt-1 flex flex-wrap gap-1.5">
          {restNames.length ? (
            restNames.map((n) => (
              <span key={n} className="inline-flex h-7 items-center rounded-full bg-surface px-2 text-caption">
                {n}
              </span>
            ))
          ) : (
            <span className="text-caption text-ink-muted">휴식자 없음</span>
          )}
        </div>
      )}
      {!folded && children}
    </section>
  )
}
