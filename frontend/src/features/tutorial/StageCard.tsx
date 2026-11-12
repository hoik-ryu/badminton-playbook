import { cn } from 'cn'
import { Check, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '../../components/Badge'

// CMP-047 StageCard — 04: 스테이지 이름, 통과 표시, 최고 점수(n/5). status=notPlayed|passed|failed(comingSoon은 홈의 접힌 '준비 중' 섹션)
// 접근성: "스테이지 1, 통과, 최고 점수 5점 중 5점"처럼 읽히는 레이블. 통과는 체크 아이콘 + '통과' 글자(02 SCR-101)
export type StageCardStatus = 'notPlayed' | 'passed' | 'failed'
type Props = { to: string; no: number; title: string; status: StageCardStatus; best: number | null; total: number; progressUnknown?: boolean }

export function StageCard({ to, no, title, status, best, total, progressUnknown = false }: Props) {
  const statusText = progressUnknown ? '' : status === 'passed' ? '통과' : status === 'failed' ? '미통과' : '아직 안 함'
  const bestText = progressUnknown ? '' : best === null ? '' : `최고 점수 ${total}점 중 ${best}점`
  const label = [`스테이지 ${no}`, title, statusText, bestText].filter(Boolean).join(', ')
  return (
    <li className="list-none">
      <Link
        to={to}
        aria-label={label}
        data-cmp="CMP-047"
        data-status={progressUnknown ? 'unknown' : status}
        className={cn('flex min-h-16 items-center gap-3 rounded-md border bg-page px-4 py-3 text-ink no-underline shadow-card active:bg-surface', status === 'passed' && !progressUnknown ? 'border-action' : 'border-line')}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-bold">스테이지 {no}</span>
          <span className="truncate text-caption text-ink-muted">{title}</span>
        </div>
        {!progressUnknown && (
          <div className="flex shrink-0 items-center gap-2 text-body tabular-nums">
            {status === 'passed' && (
              <Badge tone="success">
                <Check aria-hidden className="size-4" />
                통과
              </Badge>
            )}
            <span className={best === null ? 'text-ink-muted' : 'font-bold'}>{best === null ? '-' : `${best}/${total}`}</span>
          </div>
        )}
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
      </Link>
    </li>
  )
}
