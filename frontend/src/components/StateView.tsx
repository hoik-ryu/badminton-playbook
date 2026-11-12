import { cn } from 'cn'
import { CircleAlert, Inbox, Lock, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'

// CMP-027 StateView — 04: kind=loading|empty|error|forbidden|notFound, action(다시 시도·만들기·돌아가기).
// 접근성: 로딩은 aria-busy(스켈레톤), 빈·오류 문구는 원인 + 다음 행동
const ICON = { empty: Inbox, error: CircleAlert, forbidden: Lock, notFound: SearchX } as const

type Props =
  | { kind: 'loading'; rows?: number; label?: string; className?: string }
  | { kind: keyof typeof ICON; title: string; description?: ReactNode; action?: ReactNode; className?: string }

export function StateView(props: Props) {
  if (props.kind === 'loading') {
    return (
      <div data-cmp="CMP-027" data-kind="loading" aria-busy="true" aria-label={props.label ?? '불러오는 중'} className={cn('flex flex-col gap-3 p-4', props.className)}>
        {Array.from({ length: props.rows ?? 3 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
        ))}
      </div>
    )
  }
  const Icon = ICON[props.kind]
  return (
    <div data-cmp="CMP-027" data-kind={props.kind} role={props.kind === 'error' ? 'alert' : undefined} className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', props.className)}>
      <Icon aria-hidden className={cn('size-10', props.kind === 'error' ? 'text-danger-fg' : 'text-ink-muted')} />
      <p className="m-0 text-title font-bold text-ink">{props.title}</p>
      {props.description && <p className="m-0 text-body text-ink-muted">{props.description}</p>}
      {props.action && <div className="mt-2 w-full max-w-80">{props.action}</div>}
    </div>
  )
}
