import { cn } from 'cn'
import { ChevronLeft, Ellipsis, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

// CMP-026 PageHeader — 04: leading=none|back|close, trailing=none|menu|action, sticky. 화면 제목은 h1, 뒤로 가기 레이블 '뒤로'.
// 높이 56(design-preview SCR-211·201과 같음). 승인 UX Spec r1: 흰 헤더(CR-004 거절)
type Props = {
  title: string
  leading?: 'none' | 'back' | 'close'
  /** back·close의 이동 대상. 없으면 브라우저 뒤로 가기 */
  backTo?: string
  onClose?: () => void
  trailing?: 'none' | 'menu' | ReactNode
  onMenu?: () => void
  sticky?: boolean
  badge?: ReactNode
}

export function PageHeader({ title, leading = 'none', backTo, onClose, trailing = 'none', onMenu, sticky = false, badge }: Props) {
  const navigate = useNavigate()
  const back = () => (backTo ? navigate(backTo) : navigate(-1))
  return (
    <header data-cmp="CMP-026" className={cn('flex h-14 items-center gap-1 bg-page', leading === 'none' ? 'pr-1 pl-4' : 'px-1', sticky && 'sticky top-0 z-10')}>
      {leading === 'back' && (
        <button type="button" aria-label="뒤로" onClick={back} className="flex size-11 items-center justify-center rounded-md text-ink">
          <ChevronLeft aria-hidden className="size-6" />
        </button>
      )}
      {leading === 'close' && (
        <button type="button" aria-label="나가기" onClick={onClose ?? back} className="flex size-11 items-center justify-center rounded-md text-ink">
          <X aria-hidden className="size-6" />
        </button>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="m-0 min-w-0 truncate text-title font-bold text-ink">{title}</h1>
        {badge}
      </div>
      {trailing === 'menu' ? (
        <button type="button" aria-label="더보기" onClick={onMenu} className="flex size-11 items-center justify-center rounded-md text-ink">
          <Ellipsis aria-hidden className="size-6" />
        </button>
      ) : trailing === 'none' ? null : (
        trailing
      )}
    </header>
  )
}
