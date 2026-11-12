import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { isImplemented, previewHref } from '../../previewLinks'

// CMP-030 ListItem (trailing=chevron|badge). 04: 행 전체가 하나의 링크, 높이 48px(구분선 포함), 상태 기본·눌림.
// to: 이동 대상 화면 ID(02 진입/이탈). 프리뷰에서 아직 구현 전인 화면이면 data-preview-target="unimplemented"로 표시하고,
//     누르면 프리뷰 셸이 미구현 안내를 보여 줍니다(화면 디자인에는 가짜 요소를 넣지 않음).
export function ListItem({ label, to, ariaLabel, badge }: { label: string; to: string; ariaLabel?: string; badge?: ReactNode }) {
  return (
    <li>
      <a
        href={previewHref(to)}
        aria-label={ariaLabel}
        data-cmp="CMP-030"
        data-testid="list-item"
        data-to={to}
        data-preview-target={isImplemented(to) ? 'implemented' : 'unimplemented'}
        className="flex h-12 items-center gap-2 border-b border-line pr-3 pl-4 text-body text-ink no-underline active:bg-surface"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {badge}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
      </a>
    </li>
  )
}
