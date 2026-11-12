import { Link } from 'react-router'

import { Button } from '../components/Button'
import { StateView } from '../components/StateView'

// SCR-004 권한 없음 / SCR-004-ST1(/forbidden). 회원의 /ops/*, 운영진의 /ops/roles 접근(AC-009, AC-011). '처음 화면으로' → SCR-101
export function ForbiddenPage() {
  return (
    <section data-scr="SCR-004" data-st="SCR-004-ST1" className="flex flex-1 flex-col justify-center">
      <StateView
        kind="forbidden"
        title="접근 권한이 없습니다"
        description="이 화면은 운영진만 볼 수 있습니다."
        action={
          <Button asChild fullWidth>
            <Link to="/tutorial">처음 화면으로</Link>
          </Button>
        }
      />
    </section>
  )
}
