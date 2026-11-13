import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

// CMP-030 ListItem — 04: trailing=chevron|badge|control, 상태 기본·눌림. 행 전체가 하나의 링크, 높이 48px(구분선 포함).
// (r2) 메뉴·남은 경기 목록은 Flat 행(04 3.1 카드와 Flat 구분, VD-024). r1 구현의 variant=card는 04 계약에 없어 없앴습니다.
type Props = { label: string; to: string; ariaLabel?: string; badge?: ReactNode }

export function ListItem({ label, to, ariaLabel, badge }: Props) {
  return (
    <li className="list-none">
      <Link
        to={to}
        aria-label={ariaLabel}
        data-cmp="CMP-030"
        className="flex h-12 items-center gap-2 border-b border-line pr-3 pl-4 text-body text-ink no-underline active:bg-surface"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badge}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
      </Link>
    </li>
  )
}
