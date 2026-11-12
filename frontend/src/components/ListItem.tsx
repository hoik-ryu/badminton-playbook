import { cn } from 'cn'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

// CMP-030 ListItem — 04: trailing=chevron|badge|control, 상태 기본·눌림. 행 전체가 하나의 링크, 높이 48px(구분선 포함).
// row: 빽빽한 목록의 행, card: 누르는 항목 카드(VD-020 표면 규칙). 화면 폭에 따라 모양을 바꾸지 않음(운영 셸도 600px 한 열, 2026-11-12)
type Props = { label: string; to: string; ariaLabel?: string; badge?: ReactNode; variant?: 'row' | 'card' }

const ROW = 'h-12 border-b border-line pr-3 pl-4'
const CARD = 'h-16 rounded-md border border-line bg-page px-4 shadow-card'

export function ListItem({ label, to, ariaLabel, badge, variant = 'row' }: Props) {
  return (
    <li className="list-none">
      <Link
        to={to}
        aria-label={ariaLabel}
        data-cmp="CMP-030"
        className={cn(
          'flex items-center gap-2 text-body text-ink no-underline active:bg-surface',
          variant === 'row' && ROW,
          variant === 'card' && CARD,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', variant === 'card' && 'font-bold')}>{label}</span>
        {badge}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
      </Link>
    </li>
  )
}
