import { cn } from 'cn'
import { forwardRef, useId, type ComponentProps } from 'react'

// CMP-006 TextField — 04: type=text|search|date|number, 상태 기본·포커스·오류(아래 오류 문구)·비활성.
// 접근성: 보이는 레이블, 오류 aria-invalid + aria-describedby, 글자 16px(모바일 확대 방지). 높이 48, 반경 radius.md
type Props = Omit<ComponentProps<'input'>, 'id'> & { label: string; error?: string; hint?: string; optional?: boolean; id?: string; /** 레이블을 화면 낭독기에만(검색칸처럼 자리 글자로 뜻이 보일 때) */ hideLabel?: boolean }

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField({ label, error, hint, optional, id, className, hideLabel, ...props }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div data-cmp="CMP-006" className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className={cn('text-body font-bold text-ink', hideLabel && 'sr-only')}>
        {label}
        {optional && <span className="ml-1 font-normal text-ink-muted">(선택)</span>}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 w-full rounded-md border bg-page px-3 text-body text-ink outline-none placeholder:text-ink-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:bg-surface disabled:text-ink-disabled',
          error ? 'border-danger-fg' : 'border-line-strong',
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="m-0 text-caption text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="m-0 text-caption font-bold text-danger-fg">
          {error}
        </p>
      )}
    </div>
  )
})
