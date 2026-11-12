import { cn } from 'cn'
import { Switch as SwitchPrimitive } from 'radix-ui'
import { useId } from 'react'

// CMP-007 Switch — 04: withDescription(한 줄 설명), 상태 켜짐·꺼짐·비활성. 접근성: role="switch", 레이블 + 상태 읽기("밸런스, 켜짐").
// 줄 전체(최소 48)가 누름 영역. 켜짐은 color.action.primary, 꺼짐은 color.border.strong(비텍스트 대비 3:1 이상)
export function Switch({ label, description, checked, onCheckedChange, disabled }: { label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div data-cmp="CMP-007" className={cn('flex min-h-12 items-center gap-3 py-1', disabled && 'opacity-60')}>
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
        <span className="text-body text-ink">{label}</span>
        {description && (
          <span id={`${id}-d`} className="text-caption text-ink-muted">
            {description}
          </span>
        )}
      </label>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-describedby={description ? `${id}-d` : undefined}
        className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-line-strong transition-colors duration-150 before:absolute before:-inset-2 before:content-[''] data-[state=checked]:bg-action disabled:cursor-not-allowed"
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-1 rounded-full bg-page shadow-card transition-transform duration-150 data-[state=checked]:translate-x-6" />
      </SwitchPrimitive.Root>
    </div>
  )
}
