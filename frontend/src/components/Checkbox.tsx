import { cn } from 'cn'
import { Check, Minus } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

// CMP-008 Checkbox — 04: rowMode(행 전체가 누름 영역), selectAll, 상태 선택·해제·비활성(사유 표시).
// 접근성: 실제 input type=checkbox(레이블 연결), 체크 아이콘 + 행 레이블, 행 높이 48px
type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  /** 화면 낭독기용 레이블(보이는 label이 여러 줄일 때) */
  ariaLabel?: string
  indeterminate?: boolean
  disabled?: boolean
  rowMode?: boolean
  className?: string
}

export function Checkbox({ checked, onChange, label, ariaLabel, indeterminate = false, disabled, rowMode = false, className }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label data-cmp="CMP-008" className={cn('flex min-h-12 cursor-pointer items-center gap-3', rowMode && 'w-full', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 m-0 size-6 cursor-[inherit] appearance-none rounded-sm border-2 border-line-strong bg-page checked:border-action checked:bg-action indeterminate:border-action indeterminate:bg-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        {indeterminate ? <Minus aria-hidden className="pointer-events-none relative size-4 text-on-action" /> : checked && <Check aria-hidden className="pointer-events-none relative size-4 text-on-action" />}
      </span>
      <span className="min-w-0 flex-1 text-body text-ink">{label}</span>
    </label>
  )
}
