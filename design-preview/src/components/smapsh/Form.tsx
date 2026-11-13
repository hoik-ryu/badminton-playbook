import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

// 입력 부품(시트 안은 Flat, 04 3.1). 누름 영역 44 이상(size.touch.min), 글자 16(font.size.body)

// CMP-001 Button lg(48)
export function ActionButton({ children, variant = 'primary', disabled, grow = true, testId }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger-text'; disabled?: boolean; grow?: boolean; testId?: string }) {
  const base = 'flex h-12 items-center justify-center gap-1.5 rounded-md px-4 text-body font-bold'
  const cls =
    variant === 'primary'
      ? 'bg-action text-on-action disabled:bg-surface disabled:text-ink-disabled'
      : variant === 'secondary'
        ? 'border border-line-strong bg-page text-ink'
        : 'bg-transparent text-danger-fg'
  return (
    <button type="button" data-cmp="CMP-001" data-testid={testId} disabled={disabled} className={`${base} ${cls} ${grow ? 'flex-1' : ''}`}>
      {children}
    </button>
  )
}

// 필드 묶음: 레이블(h3급 = font.size.body·bold) → 입력, 제목 아래 space.2(VD-023)
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <span className="text-body font-bold text-ink">{label}</span>
      {children}
    </div>
  )
}

// CMP-006 TextField
export function TextField({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <input
      data-cmp="CMP-006"
      defaultValue={value}
      placeholder={placeholder}
      className="h-11 rounded-md border border-line-strong bg-page px-3 text-body text-ink placeholder:text-ink-muted"
    />
  )
}

// CMP-002 SegmentedControl
export function Segmented({ options, value }: { options: string[]; value?: string }) {
  return (
    <div data-cmp="CMP-002" role="radiogroup" className="flex h-11 rounded-md border border-line-strong p-0.5">
      {options.map((o) => {
        const on = o === value
        return (
          <button key={o} type="button" role="radio" aria-checked={on} className={`flex flex-1 items-center justify-center gap-1 rounded-sm text-body ${on ? 'bg-action font-bold text-on-action' : 'text-ink'}`}>
            {on && <Check aria-hidden className="size-4" />}
            {o}
          </button>
        )
      })}
    </div>
  )
}

// CMP-003 ChoiceGrid: kind=grade(4열)·score(5열), 칸 최소 44×44
export function ChoiceGrid({ options, value, cols }: { options: (string | number)[]; value?: string | number | null; cols: 4 | 5 }) {
  return (
    <div data-cmp="CMP-003" role="radiogroup" className={`grid gap-2 ${cols === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
      {options.map((o) => {
        const on = o === value
        return (
          <button key={o} type="button" role="radio" aria-checked={on} className={`h-11 rounded-md border text-body tabular-nums ${on ? 'border-action bg-action font-bold text-on-action' : 'border-line-strong bg-page text-ink'}`}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export const GRADES = ['자강조', 'A조', 'B조', 'C조', 'D조', '초심', '왕초심', '입문자']
export const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
