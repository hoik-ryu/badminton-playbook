import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

// CMP-005 Badge — 04: tone=neutral|info|warning|danger|success|teamBlue|teamWhite, shape=label|count. 항상 글자 포함(WCAG 1.4.1)
// 반경 radius.sm(6), 글자 caption 13 굵게
const badgeVariants = cva('inline-flex h-6 shrink-0 items-center justify-center rounded-sm px-2 text-caption leading-none font-bold whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-surface text-ink-muted',
      info: 'bg-info-bg text-ink',
      warning: 'bg-warning-bg text-warning-fg',
      danger: 'bg-danger-bg text-danger-fg',
      success: 'bg-success-bg text-success-fg',
      teamBlue: 'bg-blue-team-bg text-blue-team-fg',
      teamWhite: 'border border-line-strong bg-white-team-bg text-white-team-fg',
    },
    shape: { label: '', count: 'min-w-6 px-1.5 tabular-nums' },
  },
  defaultVariants: { tone: 'neutral', shape: 'label' },
})

export function Badge({ className, tone, shape, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-cmp="CMP-005" className={cn(badgeVariants({ tone, shape }), className)} {...props} />
}
