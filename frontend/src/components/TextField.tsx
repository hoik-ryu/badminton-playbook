import { cn } from 'cn'
import { Minus, Plus } from 'lucide-react'
import { forwardRef, useId, type ComponentProps } from 'react'

// CMP-006 TextField — 04: type=text|search|date|number, 상태 기본·포커스·오류(아래 오류 문구)·비활성.
// 접근성: 보이는 레이블, 오류 aria-invalid + aria-describedby, 글자 16px(모바일 확대 방지). 높이 48, 반경 radius.md
// (r11 04, DD r14 VD-077) `stepper` 변형: 숫자 입력칸 양 끝 −/＋(누름 영역 44, 끝값에서 비활성). 직접 입력도 받고 범위 밖이면 부모가 오류를 넘김.
// 높이 52, 폭 200(좁은 화면은 100%), 값 오른쪽 정렬 + 단위
export type StepperOptions = {
  min: number
  max: number
  /** 값 뒤 단위(예: '면', '라운드') */
  unit?: string
  /** −/＋ 버튼의 화면 읽기 레이블 */
  decLabel: string
  incLabel: string
  /** −/＋를 눌렀을 때 다음 값(범위 안으로 맞춘 값) */
  onStep: (next: number) => void
}
type Props = Omit<ComponentProps<'input'>, 'id'> & {
  label: string
  error?: string
  hint?: string
  optional?: boolean
  id?: string
  /** 레이블을 화면 낭독기에만(검색칸처럼 자리 글자로 뜻이 보일 때) */
  hideLabel?: boolean
  /** 숫자 스테퍼 변형(04 CMP-006 `stepper`) */
  stepper?: StepperOptions
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField({ label, error, hint, optional, id, className, hideLabel, stepper, ...props }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  const labelEl = (
    <label htmlFor={inputId} className={cn('text-body font-bold text-ink', hideLabel && 'sr-only')}>
      {label}
      {optional && <span className="ml-1 font-normal text-ink-muted">(선택)</span>}
    </label>
  )
  const notes = (
    <>
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
    </>
  )

  if (stepper) {
    const n = Number(props.value)
    const valid = props.value !== '' && Number.isFinite(n)
    const step = (d: 1 | -1) => {
      const base = valid ? n : d > 0 ? stepper.min - 1 : stepper.max + 1
      stepper.onStep(Math.min(stepper.max, Math.max(stepper.min, base + d)))
    }
    return (
      <div data-cmp="CMP-006" data-variant="stepper" className={cn('flex flex-col gap-1.5', className)}>
        {labelEl}
        <div
          data-error={error ? true : undefined}
          className={cn(
            'flex h-13 w-50 max-w-full items-center gap-1 rounded-md border bg-page px-1 focus-within:border-strong',
            error ? 'border-danger-fg' : 'border-line',
          )}
        >
          <button type="button" aria-label={stepper.decLabel} disabled={props.disabled || (valid && n <= stepper.min)} onClick={() => step(-1)} className="grid size-11 shrink-0 place-items-center rounded-sm text-ink-accent focus-visible:outline-2 focus-visible:outline-focus disabled:text-ink-disabled">
            <Minus aria-hidden className="size-4.5" />
          </button>
          <input
            ref={ref}
            id={inputId}
            inputMode="numeric"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="w-0 min-w-8 flex-1 border-0 bg-transparent text-right text-title font-bold text-ink tabular-nums outline-none disabled:text-ink-disabled"
            {...props}
          />
          {stepper.unit && <span className="shrink-0 pr-0.5 text-body text-ink-muted">{stepper.unit}</span>}
          <button type="button" aria-label={stepper.incLabel} disabled={props.disabled || (valid && n >= stepper.max)} onClick={() => step(1)} className="grid size-11 shrink-0 place-items-center rounded-sm text-ink-accent focus-visible:outline-2 focus-visible:outline-focus disabled:text-ink-disabled">
            <Plus aria-hidden className="size-4.5" />
          </button>
        </div>
        {notes}
      </div>
    )
  }

  return (
    <div data-cmp="CMP-006" className={cn('flex flex-col gap-1.5', className)}>
      {labelEl}
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
      {notes}
    </div>
  )
})
