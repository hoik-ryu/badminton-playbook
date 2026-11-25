import { ArrowRight, ChevronLeft, Info } from 'lucide-react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

import { Button } from './Button'

// CMP-054 StepActionBar — 04 r8, Design Direction r12 VD-063, Preview r8.
// 열 안 하단 고정(.app-fixed-bar, 탭바 숨김 화면). 2단계부터 '이전'(보조). '다음'은 기존 큰 CTA 규칙(Main Mint + 어두운 글자) + 화살표.
// 다음 불가면 버튼 비활성 + 사유 한 줄(aria-describedby). above: 요약 줄·경고 줄(CMP-028)
// 바 높이를 --su-bar-live로 알려 스크롤 끝 여백(.su-spacer)이 마지막 행을 가리지 않게 합니다(VD-020)
type Props = {
  onPrev?: () => void
  onNext: () => void
  nextLabel?: string
  nextIcon?: ReactNode
  disabledReason?: string
  /** 바로 위 경고 줄이 같은 사유를 보여 줄 때 사유 줄은 화면 읽기 전용(고정 영역 절약) */
  quietReason?: boolean
  loading?: boolean
  disabled?: boolean
  above?: ReactNode
}

export function StepActionBar({ onPrev, onNext, nextLabel = '다음', nextIcon, disabledReason, quietReason, loading, disabled, above }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--su-bar-live', `${el.offsetHeight}px`)
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const blocked = !!disabledReason || !!disabled
  return (
    <div className="app-fixed-bar su-barwrap" data-testid="action-bar">
      <div className="su-bar" data-cmp="CMP-054" ref={ref}>
        {above}
        {disabledReason && (
          <p className={quietReason ? 'sr-only' : 'su-reason'} id="su-reason">
            <Info aria-hidden />
            {disabledReason}
          </p>
        )}
        <div className="su-bar-row">
          {onPrev && (
            <Button variant="secondary" className="su-prev" onClick={onPrev} disabled={loading}>
              <ChevronLeft aria-hidden />
              이전
            </Button>
          )}
          <Button
            className="su-next"
            data-testid="su-next"
            disabled={blocked}
            loading={loading}
            aria-describedby={disabledReason ? 'su-reason' : undefined}
            onClick={onNext}
          >
            {nextIcon}
            {nextLabel}
            {!nextIcon && <ArrowRight aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  )
}
