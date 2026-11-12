import { cn } from 'cn'
import { Check } from 'lucide-react'

// CMP-004 FilterChip — 04: count(0이면 숨김), 상태 기본·켜짐·숨김. 접근성: aria-pressed, 숫자를 포함한 레이블.
// VD-010: 보이는 높이 32 · 누름 영역 44(위아래 6px 확장), 두 줄일 때 줄 간격 12, 반경 radius.md. design-preview RosterControls와 같은 모양
export function FilterChip({ label, count, pressed, onToggle }: { label: string; count: number; pressed: boolean; onToggle: () => void }) {
  if (count <= 0) return null
  return (
    <button
      type="button"
      data-cmp="CMP-004"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-3 text-body whitespace-nowrap before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[""]',
        pressed ? 'border-action bg-action font-bold text-on-action' : 'border-line-strong bg-page text-ink',
      )}
    >
      {pressed && <Check aria-hidden className="size-4" />}
      {label} <span className="tabular-nums">{count}명</span>
    </button>
  )
}
