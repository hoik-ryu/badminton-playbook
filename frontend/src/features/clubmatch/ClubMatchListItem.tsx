import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Badge } from '../../components/Badge'
import { METHOD_LABEL, STATUS_LABEL, type ClubMethod, type ClubStatus } from './api'

// CMP-043 ClubMatchListItem — 04: audience=member|ops(member는 '대진 미확정' 항목 자체가 없음 — 데이터에서 걸러짐).
// 날짜·이름·방식 배지·상태 배지 + 요약(진행 중) 또는 최종 결과(종료). 항목 전체가 하나의 링크, 배지는 글자
const mmdd = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`

type Props = { to: string; id: string; name: string; date: string; method: ClubMethod; status: ClubStatus; summary?: ReactNode; trailing?: ReactNode }

export function ClubMatchListItem({ to, id, name, date, method, status, summary, trailing }: Props) {
  return (
    <li>
      <Link to={to} data-cmp="CMP-043" data-match={id} className="flex items-center gap-3 rounded-md border border-line bg-page px-4 py-3 text-ink no-underline shadow-card active:bg-surface">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="m-0 truncate text-body">
            <span className="tabular-nums text-ink-muted">{mmdd(date)}</span> <span className="font-bold">{name}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{METHOD_LABEL[method]}</Badge>
            <Badge tone={status === 'draft' ? 'warning' : status === 'confirmed' ? 'info' : 'success'}>{STATUS_LABEL[status]}</Badge>
            {summary}
          </div>
        </div>
        {trailing}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
      </Link>
    </li>
  )
}
