import { useEffect, useState } from 'react'
import { useRouteLoaderData } from 'react-router'

import { Badge } from '../components/Badge'
import { ListItem } from '../components/ListItem'
import { PageHeader } from '../components/PageHeader'
import { getPendingApprovalCount } from '../features/approval/api'
import type { ShellData } from '../routes/guards'

// SCR-201 운영 홈(/ops). US-002·003·004, FLOW-001-S4, AC-003, AC-011, UXD-001·015·066. design-preview/src/screens/SCR-201.tsx를 실제 화면으로 옮김
// 정보 순서(02): 오늘 운동(진행 중 배지) → 명단 → 청백전 관리 → 가입 승인(대기 건수, 0이면 숨김) → 역할 관리(슈퍼 관리자만)
// - ST1 기본 / ST2 로딩(메뉴는 바로, 배지 자리만 로딩) / ST4 오류(배지만 숨김) / ST5 회원 → SCR-004(가드)
// - 반응형: 모바일 목록, PC(≥1024) 메뉴 카드 2열 + 왼쪽 메뉴(운영 셸)
// - '진행 중' 배지는 오늘 세션 데이터(B3)가 생기면 연결. 지금은 세션 없음으로 표시하지 않음
type BadgeState = { kind: 'loading' } | { kind: 'ok'; count: number } | { kind: 'error' }

export function OpsHomePage() {
  const { me } = useRouteLoaderData('ops') as ShellData
  const [pending, setPending] = useState<BadgeState>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    getPendingApprovalCount().then(
      (count) => alive && setPending({ kind: 'ok', count }),
      () => alive && setPending({ kind: 'error' }),
    )
    return () => {
      alive = false
    }
  }, [])

  const approvalBadge =
    pending.kind === 'loading' ? (
      <span aria-hidden data-testid="badge-loading" className="h-6 w-8 animate-pulse rounded-sm bg-surface motion-reduce:animate-none" />
    ) : pending.kind === 'ok' && pending.count > 0 ? (
      <Badge tone="warning" shape="count" aria-hidden>
        {pending.count}
      </Badge>
    ) : null

  return (
    <section data-scr="SCR-201" data-st={pending.kind === 'loading' ? 'SCR-201-ST2' : pending.kind === 'error' ? 'SCR-201-ST4' : 'SCR-201-ST1'}>
      <PageHeader title="운영" />
      <ul aria-label="운영 메뉴" className="m-0 list-none border-t border-line p-0">
        <ListItem label="오늘 운동" to="/ops/session" />
        <ListItem label="명단" to="/ops/roster" />
        <ListItem label="청백전 관리" to="/ops/club-matches" />
        <ListItem
         
          label="가입 승인"
          to="/ops/approvals"
          ariaLabel={pending.kind === 'ok' && pending.count > 0 ? `가입 승인, 대기 ${pending.count}건` : undefined}
          badge={approvalBadge}
        />
        {me.role === 'superAdmin' && <ListItem label="역할 관리" to="/ops/roles" />}
      </ul>
    </section>
  )
}
