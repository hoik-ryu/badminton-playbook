import { Link } from 'react-router'

import { Button } from '../components/Button'
import { StateView } from '../components/StateView'

// SCR-005 페이지 없음 / SCR-005-ST1(/*). '처음 화면으로' → 로그인 상태면 SCR-101, 아니면 SCR-001('/'의 첫 화면 결정에 맡김)
export function NotFoundPage() {
  return (
    <section data-scr="SCR-005" data-st="SCR-005-ST1" className="flex flex-1 flex-col justify-center">
      <StateView
        kind="notFound"
        title="페이지를 찾을 수 없습니다"
        action={
          <Button asChild fullWidth>
            <Link to="/">처음 화면으로</Link>
          </Button>
        }
      />
    </section>
  )
}
