import { Construction } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from './Button'
import { PageHeader } from './PageHeader'

// 아직 구현하지 않은 화면의 명확한 미구현 상태(사용자 지시: 버튼·메뉴는 실제 라우팅 또는 명확한 미구현 상태로 연결).
// 화면 ID와 구현 예정 배치를 보여 줍니다. 기능을 흉내 내지 않습니다.
export function PendingScreen({ scr, title, batch, header = true }: { scr: string; title: string; batch: string; header?: boolean }) {
  return (
    <div data-pending={scr} className="flex flex-1 flex-col">
      {header && <PageHeader title={title} />}
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <Construction aria-hidden className="size-10 text-ink-muted" />
        <p className="m-0 text-title font-bold text-ink">{title} 화면은 준비 중입니다</p>
        <p className="m-0 text-body text-ink-muted">
          {scr} · {batch} 배치에서 구현 예정
        </p>
        <Button asChild variant="secondary" size="md" className="mt-2">
          <Link to="/">처음 화면으로</Link>
        </Button>
      </div>
    </div>
  )
}
