import type React from 'react'
import { useState } from 'react'
import { ChevronLeft, Ellipsis, Trash2 } from 'lucide-react'

// CMP-026 PageHeader. 흰 헤더(CR-004 거절). (r2) h1 = font.size.heading·bold(04 3.1, VD-023)
// 변형(04): leading=none|back, trailing=none|menu. 기본값 back·menu(SCR-211). 탭 첫 화면(SCR-201)은 none·none.
export type MenuItem = { label: string; danger?: boolean; onSelect?: () => void }

/** (CP-001, VD-068) 더보기 메뉴 목록: 기존 메뉴 표현(테두리·그림자·항목 44) + 위험 항목은 danger 글자와 Trash2 18 */
export function MoreMenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <ul role="menu" data-testid="more-menu" className="absolute top-12 right-1 z-30 m-0 min-w-44 list-none rounded-md border border-line bg-page p-1 shadow-sheet">
      {items.map((it) => (
        <li key={it.label} role="none">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose()
              it.onSelect?.()
            }}
            className={`flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-body hover:bg-surface ${it.danger ? 'text-danger-fg' : 'text-ink'}`}
          >
            {it.danger && <Trash2 aria-hidden className="size-[18px]" />}
            {it.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function PageHeader({ title, leading = 'back', trailing = 'menu', badge, menu, menuOpen = false }: { title: string; leading?: 'none' | 'back'; trailing?: 'none' | 'menu'; badge?: React.ReactNode; /** (CP-001) 더보기 메뉴 항목 */ menu?: MenuItem[]; menuOpen?: boolean }) {
  const [open, setOpen] = useState(menuOpen)
  return (
    <header data-cmp="CMP-026" data-testid="page-header" className={`relative flex h-14 items-center gap-1 bg-page ${leading === 'none' ? 'pr-1 pl-4' : 'px-1'}`}>
      {leading === 'back' && (
        <button type="button" aria-label="뒤로" className="flex size-11 items-center justify-center rounded-md text-ink">
          <ChevronLeft aria-hidden className="size-6" />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-heading font-bold text-ink">{title}</h1>
      {badge}
      {trailing === 'menu' && (
        <button type="button" aria-label="더보기" aria-haspopup={menu ? 'menu' : undefined} aria-expanded={menu ? open : undefined} onClick={() => menu && setOpen((o) => !o)} className="flex size-11 items-center justify-center rounded-md text-ink">
          <Ellipsis aria-hidden className="size-6" />
        </button>
      )}
      {trailing === 'menu' && menu && open && <MoreMenuList items={menu} onClose={() => setOpen(false)} />}
    </header>
  )
}
