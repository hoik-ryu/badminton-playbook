import { cn } from 'cn'
import type { ReactNode } from 'react'

// CMP-024 PersonRow — 04: trailing=none|checkbox|segmented|scoreGrid|actions|chevron, meta(표시 항목 선택), group.
// 행 높이 48 이상. 한 줄 표기 '이름 · 성별 · 급수 · …'(UXD-074 형식), 이름 굵게. 회원 화면에는 쓰지 않음(점수·급수 노출 방지)
type Props = {
  name: string
  meta: (string | null | undefined | false)[]
  leading?: ReactNode
  /** 둘째 줄(신청일 등) */
  sub?: ReactNode
  /** 경고 줄(같은 이름 등) */
  warning?: ReactNode
  trailing?: ReactNode
  className?: string
}

export function PersonRow({ name, meta, leading, sub, warning, trailing, className }: Props) {
  const parts = meta.filter(Boolean) as string[]
  return (
    <div data-cmp="CMP-024" className={cn('flex min-h-12 items-start gap-3 py-2', className)}>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="m-0 text-body text-ink">
          <span className="font-bold">{name}</span>
          {parts.map((p) => (
            <span key={p} className="text-ink-muted">
              &nbsp;·&nbsp;{p}
            </span>
          ))}
        </p>
        {(sub || trailing) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption text-ink-muted">{sub}</span>
            {trailing}
          </div>
        )}
        {warning}
      </div>
    </div>
  )
}
