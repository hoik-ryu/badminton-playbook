import { cn } from 'cn'
import { Check } from 'lucide-react'
import { useId, useRef, type KeyboardEvent } from 'react'

// 라디오형 버튼 묶음 공통(방향키 이동, 선택 = 색 + 굵은 글자 + 체크)
//   CMP-002 SegmentedControl: 2–3개 중 하나(남·여 등), size md|sm(최소 44)
//   CMP-003 ChoiceGrid: 버튼 격자(급수 4열, 점수 5열), 칸 최소 44×44, 오류 문구는 그리드 아래
// 접근성: role="radiogroup" + 그룹 레이블, 선택된 칸만 탭 순서(roving tabindex), 오류는 aria-describedby
type Option<T extends string> = { value: T; label?: string }

type Props<T extends string> = {
  label: string
  options: readonly (T | Option<T>)[]
  value: T | null
  onChange: (value: T) => void
  /** 선택한 칸을 다시 누르면 선택 해제(점수 '미설정'으로 되돌리기, CMP-003 allowClear) */
  onClear?: () => void
  /** 칸마다 저장 중 표시(CMP-003 '저장 중(누른 칸만)') */
  busyValue?: T | null
  error?: string
  disabled?: boolean
  className?: string
}

function useRadioKeys<T extends string>(values: T[], value: T | null, onChange: (v: T) => void, columns: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const delta = { ArrowRight: 1, ArrowDown: columns, ArrowLeft: -1, ArrowUp: -columns }[e.key]
    if (delta === undefined) return
    e.preventDefault()
    const next = (index + delta + values.length) % values.length
    const v = values[next]
    if (v !== undefined) {
      onChange(v)
      refs.current[next]?.focus()
    }
  }
  const tabIndexOf = (i: number) => ((value === null ? i === 0 : values[i] === value) ? 0 : -1)
  return { refs, onKeyDown, tabIndexOf }
}

const norm = <T extends string>(o: T | Option<T>): Option<T> => (typeof o === 'string' ? { value: o } : o)

function Group<T extends string>({ label, options, value, onChange, onClear, busyValue, error, disabled, className, columns, cmp, cell, hideLabel }: Props<T> & { columns: number; cmp: string; cell: string; hideLabel?: boolean }) {
  const id = useId()
  const opts = options.map(norm)
  const { refs, onKeyDown, tabIndexOf } = useRadioKeys(
    opts.map((o) => o.value),
    value,
    onChange,
    columns,
  )
  return (
    <div data-cmp={cmp} className={cn('flex flex-col gap-1.5', className)}>
      <span id={`${id}-label`} className={cn('text-body font-bold text-ink', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {opts.map((o, i) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={tabIndexOf(i)}
              disabled={disabled}
              aria-busy={busyValue === o.value || undefined}
              onClick={() => (on && onClear ? onClear() : onChange(o.value))}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'flex min-h-11 items-center justify-center gap-1 rounded-md border px-1 text-body transition-colors duration-150 disabled:opacity-60',
                cell,
                on ? 'border-action bg-action font-bold text-on-action' : error ? 'border-danger-fg bg-page text-ink' : 'border-line-strong bg-page text-ink',
              )}
            >
              {on && <Check aria-hidden className="size-4 shrink-0" />}
              {busyValue === o.value && <span aria-hidden className="size-3 shrink-0 animate-pulse rounded-full bg-current motion-reduce:animate-none" />}
              <span className="truncate">{o.label ?? o.value}</span>
            </button>
          )
        })}
      </div>
      {error && (
        <p id={`${id}-error`} className="m-0 text-caption font-bold text-danger-fg">
          {error}
        </p>
      )}
    </div>
  )
}

export function SegmentedControl<T extends string>(props: Props<T> & { size?: 'md' | 'sm'; hideLabel?: boolean }) {
  return <Group {...props} columns={props.options.length} cmp="CMP-002" cell={props.size === 'sm' ? 'min-h-11' : 'min-h-12'} />
}

export function ChoiceGrid<T extends string>(props: Props<T> & { kind?: 'grade' | 'score'; hideLabel?: boolean }) {
  return <Group {...props} columns={props.kind === 'score' ? 5 : 4} cmp="CMP-003" cell="min-h-11" />
}
