import { Ellipsis } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'

// 더보기(⋯) 메뉴 — CMP-026 trailing=menu의 메뉴 내용. 항목은 화면 명세가 정한 것만(SCR-211: '회원 직접 추가' 한 항목, UXD-026)
export function OverflowMenu({ items }: { items: { label: string; onSelect: () => void; disabled?: boolean; reason?: string }[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label="더보기" className="flex size-11 items-center justify-center rounded-md text-ink">
          <Ellipsis aria-hidden className="size-6" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-44 rounded-md border border-line bg-page p-1 shadow-sheet">
          {items.map((it) => (
            <DropdownMenu.Item key={it.label} onSelect={it.onSelect} disabled={it.disabled} className="flex min-h-11 cursor-pointer flex-col justify-center rounded-sm px-3 py-1 text-body text-ink outline-none data-disabled:cursor-not-allowed data-disabled:text-ink-disabled data-highlighted:bg-surface">
              {it.label}
              {it.disabled && it.reason && <span className="text-caption text-ink-muted">{it.reason}</span>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
