import { Plus } from 'lucide-react'
import { Button } from '../ui/button'

// CMP-001 Button primary lg(48). UXD-026: 모바일 오른쪽 아래 떠 있는 주 버튼(CR-002 거절로 승인 위치 유지)
// VD-020: 하단 탭(56) + 안전 영역 위 16
export function GuestAddButton({ label }: { label: string }) {
  return (
    <Button data-cmp="CMP-001" data-testid="fab" className="fixed right-4 bottom-[calc(56px+var(--safe-bottom)+16px)] z-20 h-12 gap-1.5 rounded-md px-4 text-[length:var(--font-size-body)] font-bold text-primary-foreground shadow-card [&_svg:not([class*='size-'])]:size-5">
      <Plus aria-hidden />
      {label}
    </Button>
  )
}
