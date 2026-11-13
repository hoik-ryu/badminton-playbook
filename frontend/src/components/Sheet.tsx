import { cn } from 'cn'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useRef, type ReactNode } from 'react'

// CMP-021 Sheet — 04 r2: presentation=bottom만(PC·모바일 공통, 600px 열 아래쪽에서 열림), height=content|70%|full, stacked.
// (r2, 사용자 결정 D2) r1의 PC 옆 패널(side)·가운데 대화상자(dialog)는 없앴습니다. VD-025: radius.sheet, elevation.sheet,
// 배경 color.bg.page, 손잡이 color.border.default, 하단 고정 버튼은 안전 영역 위. 딤 bg-ink/40은 토큰 밖 임시 구현값(07 VD-025).
// 접근성: 열리면 제목으로 포커스, 포커스 가둠(모달 시트), Esc·뒤로 가기로 맨 위 시트 하나만 닫기, 닫히면 연 버튼으로 포커스 복귀.
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
  height?: 'content' | '70%' | 'full'
  testId?: string
}

/** 모달 하단 시트(PC·모바일 공통, 너비 = 600px 열) */
export function Sheet({ open, onRequestClose, title, titleBadge, children, footer, height = 'content', testId }: SheetProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onRequestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          data-cmp="CMP-021"
          data-presentation="bottom"
          data-testid={testId}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            titleRef.current?.focus()
          }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[var(--size-content-member)] flex-col rounded-t-sheet bg-page shadow-sheet outline-none',
            height === 'full' ? 'h-[90dvh]' : height === '70%' ? 'h-[70dvh] max-h-[90dvh]' : 'max-h-[90dvh]',
          )}
        >
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line" />
          <SheetHeader title={title} badge={titleBadge} titleRef={titleRef} onClose={onRequestClose} />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer && <div className="shrink-0 border-t border-line px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SheetHeader({ title, badge, titleRef, onClose }: { title: ReactNode; badge?: ReactNode; titleRef: React.RefObject<HTMLHeadingElement | null>; onClose: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 pr-1 pl-4">
      <Dialog.Title ref={titleRef} tabIndex={-1} className="m-0 flex min-w-0 flex-1 items-center gap-2 text-title font-bold text-ink outline-none">
        <span className="truncate">{title}</span>
        {badge}
      </Dialog.Title>
      <button type="button" aria-label="닫기" onClick={onClose} className="flex size-11 items-center justify-center rounded-md text-ink">
        <X aria-hidden className="size-6" />
      </button>
    </div>
  )
}
