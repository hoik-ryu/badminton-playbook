import { ChevronLeft, Ellipsis } from 'lucide-react'

// CMP-026 PageHeader. 승인 UX Spec r1: 흰 헤더(CR-004 거절)
// 변형(04): leading=none|back, trailing=none|menu. 기본값 back·menu(SCR-211). 탭 첫 화면(SCR-201)은 none·none.
export function PageHeader({ title, leading = 'back', trailing = 'menu' }: { title: string; leading?: 'none' | 'back'; trailing?: 'none' | 'menu' }) {
  return (
    <header data-cmp="CMP-026" data-testid="page-header" className={`flex h-14 items-center gap-1 bg-page ${leading === 'none' ? 'pr-1 pl-4' : 'px-1'}`}>
      {leading === 'back' && (
        <button type="button" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md text-ink">
          <ChevronLeft aria-hidden className="size-6" />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-title font-bold text-ink">{title}</h1>
      {trailing === 'menu' && (
        <button type="button" aria-label="더보기" className="flex size-11 items-center justify-center rounded-md text-ink">
          <Ellipsis aria-hidden className="size-6" />
        </button>
      )}
    </header>
  )
}
