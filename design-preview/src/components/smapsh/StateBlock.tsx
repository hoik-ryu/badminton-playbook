import { AlertCircle, Inbox, RotateCw } from 'lucide-react'

// CMP-027 StateView(블록 단위 빈 상태·오류). 아이콘 + 원인 문구 + 다음 행동(04 CMP-027 접근성)
export function StateBlock({ kind, message, action }: { kind: 'empty' | 'error'; message: string; action?: string }) {
  const Icon = kind === 'error' ? AlertCircle : Inbox
  return (
    <div data-cmp="CMP-027" data-variant={kind} role={kind === 'error' ? 'alert' : 'status'} className="flex flex-col items-center gap-2 rounded-md bg-surface px-4 py-8 text-center">
      <Icon aria-hidden className={`size-6 ${kind === 'error' ? 'text-danger-fg' : 'text-ink-muted'}`} />
      <p className="text-body text-ink">{message}</p>
      {action && (
        <button type="button" className="flex h-11 items-center gap-1 rounded-md border-[1.5px] border-ink-accent bg-page px-4 text-body font-bold text-ink-accent">
          <RotateCw aria-hidden className="size-4" />
          {action}
        </button>
      )}
    </div>
  )
}
