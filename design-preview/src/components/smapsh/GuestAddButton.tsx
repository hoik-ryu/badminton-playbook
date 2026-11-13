import { Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { FixedInColumn } from './Layout'

// CMP-001 Button primary lg(48). (r2) UXD-026·D3: PC·모바일 모두 오른쪽 아래 떠 있는 주 버튼.
// VD-020: 하단 탭(56) + 안전 영역 위 16, 600px 열의 오른쪽 안쪽 16(열 바깥 화면 가장자리가 아님)
export function GuestAddButton({ label }: { label: string }) {
  return (
    <FixedInColumn bottom="calc(56px + var(--safe-bottom) + 16px)" z="z-20">
      <div className="flex justify-end px-4">
        <Button data-cmp="CMP-001" data-testid="fab" className="h-12 gap-1.5 rounded-md px-4 text-[length:var(--font-size-body)] font-bold text-primary-foreground shadow-card [&_svg:not([class*='size-'])]:size-5">
          <Plus aria-hidden />
          {label}
        </Button>
      </div>
    </FixedInColumn>
  )
}
