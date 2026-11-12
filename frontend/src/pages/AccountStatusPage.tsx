import { Ban, CircleX, Hourglass } from 'lucide-react'
import { useState } from 'react'
import { useLoaderData, useNavigate, useRevalidator } from 'react-router'

import { Button } from '../components/Button'
import { NoticeBox } from '../components/NoticeBox'
import { useToast } from '../components/toastContext'
import { getMe, logout } from '../features/auth/api'
import { isRestricted, type AccountStatus, type Me } from '../features/auth/types'

// SCR-003 계정 상태 안내(/account-status). US-001, US-003, US-020, FLOW-001-S3a·S4a, AC-001, AC-004, AC-007, AC-058, UXD-013
// - ST1 승인 대기 / ST7 거절(사유 단정 없음) / ST8 비활성. 중립 문장, 연락처 없음
// - '상태 다시 확인': 승인됨 → SCR-101, 그대로 → 토스트 "아직 상태가 바뀌지 않았습니다"(ST2 진행 표시, ST4 확인 실패 안내 상자 + 다시 시도)
// - 로그아웃 → SCR-001(AC-005). 상태 아이콘은 장식(aria-hidden)
const VIEW: Record<Exclude<AccountStatus, 'approved'>, { st: string; title: string; body?: string; Icon: typeof Hourglass }> = {
  pending: { st: 'SCR-003-ST1', title: '가입 신청이 접수되었습니다', body: '운영진 승인 후 이용할 수 있습니다', Icon: Hourglass },
  rejected: { st: 'SCR-003-ST7', title: '가입이 승인되지 않았습니다', Icon: CircleX },
  inactive: { st: 'SCR-003-ST8', title: '현재 이용할 수 없는 계정입니다', Icon: Ban },
}

export function AccountStatusPage() {
  const me = useLoaderData() as Me
  const navigate = useNavigate()
  const toast = useToast()
  const revalidator = useRevalidator()
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const view = VIEW[me.status as Exclude<AccountStatus, 'approved'>] ?? VIEW.pending

  const recheck = async () => {
    setChecking(true)
    setFailed(false)
    try {
      const latest = await getMe()
      if (!latest) return navigate('/login', { replace: true })
      if (!isRestricted(latest)) return navigate('/tutorial', { replace: true })
      if (latest.status !== me.status) revalidator.revalidate()
      else toast('아직 상태가 바뀌지 않았습니다', 'neutral')
    } catch {
      setFailed(true)
    } finally {
      setChecking(false)
    }
  }

  const signOut = async () => {
    setLeaving(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLeaving(false)
      setFailed(true)
    }
  }

  return (
    <section data-scr="SCR-003" data-st={failed ? 'SCR-003-ST4' : checking ? 'SCR-003-ST2' : view.st} className="flex flex-1 flex-col px-4 pt-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
      {failed && (
        <NoticeBox tone="danger" action={<Button variant="text" size="md" onClick={() => void recheck()}>다시 시도</Button>}>
          상태를 확인하지 못했습니다
        </NoticeBox>
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <view.Icon aria-hidden className="size-12 text-action" />
        <h1 className="m-0 text-heading font-bold text-ink">{view.title}</h1>
        {view.body && <p className="m-0 text-body text-ink-muted">{view.body}</p>}
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button fullWidth loading={checking} onClick={() => void recheck()}>
          상태 다시 확인
        </Button>
        <Button variant="text" size="md" loading={leaving} onClick={() => void signOut()}>
          로그아웃
        </Button>
      </div>
    </section>
  )
}
