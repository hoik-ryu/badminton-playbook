import { cn } from 'cn'
import { Ellipsis, Trash2 } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import type { ReactNode } from 'react'

// 더보기(⋯) 메뉴 — CMP-026 trailing=menu의 메뉴 내용. 항목은 화면 명세가 정한 것만(SCR-211: '회원 직접 추가' 한 항목, UXD-026)
// (CP-001, VD-068 CP-001 항목) tone=danger 항목: 글자 color.status.danger.fg + 왼쪽 Trash2 18(같은 색), 높이 44 이상('청백전 삭제').
// 트리거 모양은 기본(Ellipsis 24·누름 영역 44)이고, 화면이 기존 아이콘 버튼 자리를 유지해야 하면 icon·triggerClassName으로 바꿉니다.
type Item = { label: string; onSelect: () => void; disabled?: boolean; reason?: string; tone?: 'danger' }

export function OverflowMenu({ items, label = '더보기', icon, triggerClassName }: { items: Item[]; label?: string; icon?: ReactNode; triggerClassName?: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label={label} className={triggerClassName ?? 'flex size-11 items-center justify-center rounded-md text-ink'}>
          {icon ?? <Ellipsis aria-hidden className="size-6" />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-44 rounded-md border border-line bg-page p-1 shadow-sheet">
          {items.map((it) => (
            <DropdownMenu.Item
              key={it.label}
              onSelect={it.onSelect}
              disabled={it.disabled}
              data-tone={it.tone}
              className={cn(
                'flex min-h-11 cursor-pointer flex-col justify-center rounded-sm px-3 py-1 text-body outline-none data-disabled:cursor-not-allowed data-disabled:text-ink-disabled data-highlighted:bg-surface',
                it.tone === 'danger' ? 'text-danger-fg' : 'text-ink',
              )}
            >
              {it.tone === 'danger' ? (
                <span className="flex items-center gap-2">
                  <Trash2 aria-hidden className="size-4.5 shrink-0" />
                  {it.label}
                </span>
              ) : (
                it.label
              )}
              {it.disabled && it.reason && <span className="text-caption text-ink-muted">{it.reason}</span>}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
