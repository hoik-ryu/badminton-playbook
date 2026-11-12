import { cn } from 'cn'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useEffect, useRef, type ReactNode } from 'react'

import { useIsDesktop } from './sheetHooks'

// CMP-021 Sheet — 04: presentation=bottom|side|dialog(모바일 bottom, PC 패널은 side, PC 시트는 dialog), height=content|70%|full, stacked.
// 접근성: 열리면 제목으로 포커스, 포커스 가둠(모달 시트), Esc·뒤로 가기로 닫기, 닫히면 연 버튼으로 포커스 복귀. PC 옆 패널은 가두지 않음.
// URL은 바뀌지 않습니다(02 공통): 열림 상태를 history state({ sheet })에 두어 브라우저 뒤로 가기로 닫힙니다(useSheetRoute).

type SheetProps = {
  open: boolean
  /** 닫기 요청(✕·바깥·Esc). 바뀐 값이 있으면 부모가 확인 창을 띄움 */
  onRequestClose: () => void
  title: ReactNode
  titleBadge?: ReactNode
  children: ReactNode
  /** 아래 고정(저장·추가 버튼) */
  footer?: ReactNode
  /** PC 표시: dialog(가운데, 기본) 또는 bottom(가운데 너비 480 하단 시트, SCR-205·225) — 모바일은 항상 bottom */
  desktop?: 'dialog' | 'bottom'
  height?: 'content' | '70%' | 'full'
  testId?: string
}

/** 모달 시트(모바일 하단 시트, PC 가운데 dialog) */
export function Sheet({ open, onRequestClose, title, titleBadge, children, footer, height = 'content', testId, desktop = 'dialog' }: SheetProps) {
  const isDesktop = useIsDesktop() && desktop === 'dialog'
  const narrowBottom = useIsDesktop() && desktop === 'bottom'
  const titleRef = useRef<HTMLHeadingElement>(null)
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onRequestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          data-cmp="CMP-021"
          data-presentation={isDesktop ? 'dialog' : 'bottom'}
          data-testid={testId}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            titleRef.current?.focus()
          }}
          className={cn(
            'fixed z-50 flex flex-col bg-page shadow-sheet outline-none',
            isDesktop
              ? 'top-1/2 left-1/2 max-h-[85dvh] w-[min(calc(100%-32px),480px)] -translate-x-1/2 -translate-y-1/2 rounded-md'
              : cn('inset-x-0 bottom-0 mx-auto w-full rounded-t-sheet', narrowBottom ? 'max-w-[480px]' : 'max-w-[var(--app-column-max)]', height === 'full' ? 'h-[90dvh]' : height === '70%' ? 'h-[70dvh] max-h-[90dvh]' : 'max-h-[90dvh]'),
          )}
        >
          {!isDesktop && <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line" />}
          <SheetHeader title={title} badge={titleBadge} titleRef={titleRef} onClose={onRequestClose} TitleTag={Dialog.Title} />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer && <div className="shrink-0 border-t border-line px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** PC 옆 패널(가두지 않음, 너비 size.panel.side 400) */
export function SidePanel({ title, titleBadge, children, footer, onRequestClose, testId }: Omit<SheetProps, 'open' | 'desktop' | 'height'>) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => titleRef.current?.focus(), [title])
  return (
    <aside data-cmp="CMP-021" data-presentation="side" data-testid={testId} aria-label={typeof title === 'string' ? title : undefined} className="sticky top-0 flex h-dvh w-[var(--size-panel-side)] shrink-0 flex-col border-l border-line bg-page">
      <SheetHeader title={title} badge={titleBadge} titleRef={titleRef} onClose={onRequestClose} TitleTag="h2" />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      {footer && <div className="shrink-0 border-t border-line px-4 py-3">{footer}</div>}
    </aside>
  )
}

function SheetHeader({ title, badge, titleRef, onClose, TitleTag }: { title: ReactNode; badge?: ReactNode; titleRef: React.RefObject<HTMLHeadingElement | null>; onClose: () => void; TitleTag: typeof Dialog.Title | 'h2' }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 pr-1 pl-4">
      <TitleTag ref={titleRef} tabIndex={-1} className="m-0 flex min-w-0 flex-1 items-center gap-2 text-title font-bold text-ink outline-none">
        <span className="truncate">{title}</span>
        {badge}
      </TitleTag>
      <button type="button" aria-label="닫기" onClick={onClose} className="flex size-11 items-center justify-center rounded-md text-ink">
        <X aria-hidden className="size-6" />
      </button>
    </div>
  )
}
