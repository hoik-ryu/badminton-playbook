import { cn } from 'cn'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

// CMP-023 NoticeBox — 04: tone=info|warning|danger|success, action(오른쪽 버튼·화살표), dismissible.
// 접근성: 오류(danger)는 role="alert", 그 밖은 role="status". 아이콘 + 글자
const TONE = {
  info: { box: 'bg-info-bg', icon: 'text-ink', Icon: Info },
  warning: { box: 'bg-warning-bg', icon: 'text-warning-fg', Icon: TriangleAlert },
  danger: { box: 'bg-danger-bg', icon: 'text-danger-fg', Icon: CircleAlert },
  success: { box: 'bg-success-bg', icon: 'text-success-fg', Icon: CircleCheck },
} as const

export function NoticeBox({ tone = 'info', children, action, dismissible = false, className }: { tone?: keyof typeof TONE; children: ReactNode; action?: ReactNode; dismissible?: boolean; className?: string }) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  const { box, icon, Icon } = TONE[tone]
  return (
    <div data-cmp="CMP-023" role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex min-h-12 items-center gap-2 rounded-md px-3 py-2 text-body text-ink', box, className)}>
      <Icon aria-hidden className={cn('size-5 shrink-0', icon)} />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {dismissible && (
        <button type="button" aria-label="안내 닫기" onClick={() => setOpen(false)} className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted">
          <X aria-hidden className="size-5" />
        </button>
      )}
    </div>
  )
}
