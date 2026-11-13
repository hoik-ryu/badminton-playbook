import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { COLUMN } from './Layout'

// CMP-021 Sheet — 04 r2: presentation=bottom만(PC·모바일 공통, side·dialog 없음). height=content|70%|full, stacked.
// VD-025: 600px 열 너비, 위쪽 모서리 radius.sheet, 그림자 elevation.sheet, 배경 color.bg.page,
//   손잡이 color.border.default·높이 space.1, 하단 버튼 영역 위쪽 구분선 + 안전 영역 위(VD-020).
//   딤은 color.text.primary 40%(임시 구현값, 토큰 밖 값으로 07에 기록). 중첩(stacked)은 같은 모양을 재사용하고 딤은 한 겹만.
// 프리뷰는 정적 렌더라 열림 상태만 그립니다(닫기 순서·포커스 복원은 04 3.2 규칙, 제품 구현에서 검증).
const HEIGHT = { content: 'max-h-[90%]', '70%': 'h-[70%]', full: 'h-[90%]' } as const

export function Sheet({
  title,
  titleBadge,
  height = 'content',
  stacked = false,
  dim = true,
  footer,
  children,
  testId,
}: {
  title: string
  titleBadge?: ReactNode
  height?: keyof typeof HEIGHT
  stacked?: boolean
  dim?: boolean
  footer?: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <>
      {dim && <div aria-hidden data-testid="sheet-dim" className={`fixed inset-0 ${stacked ? 'z-40' : 'z-30'} bg-ink/40`} />}
      <div className={`pointer-events-none fixed inset-x-0 bottom-0 ${stacked ? 'z-50' : 'z-40'} flex h-full items-end`}>
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-cmp="CMP-021"
          data-presentation="bottom"
          data-stacked={stacked ? 'true' : undefined}
          data-testid={testId ?? 'sheet'}
          className={`${COLUMN} pointer-events-auto flex ${HEIGHT[height]} flex-col rounded-t-(--radius-sheet) bg-page shadow-sheet`}
        >
          <span aria-hidden className="mx-auto mt-2 h-1 w-8 shrink-0 rounded-full bg-line" />
          <header className="flex items-center gap-2 py-1 pr-1 pl-4">
            <h2 className="flex min-w-0 flex-1 items-center gap-2 truncate text-title font-bold text-ink">
              {title}
              {titleBadge}
            </h2>
            <button type="button" aria-label="닫기" className="flex size-11 items-center justify-center rounded-md text-ink">
              <X aria-hidden className="size-6" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer && <div className="flex shrink-0 border-t border-line px-4 pt-3 pb-[calc(12px+var(--safe-bottom))]">{footer}</div>}
        </section>
      </div>
    </>
  )
}
