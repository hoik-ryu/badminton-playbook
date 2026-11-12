import { Badge } from '../ui/badge'
import type { Person } from '../../mock/data'

// CMP-024 PersonRow — VD-007: UXD-074 단일 행 '이름 · 성별 · 급수 · 점수'(이름·점수 굵게), 점수 없음은 '미설정' 배지
// VD-008: 행 56(구분선 포함), VD-004: 고정폭 숫자
export function PersonRow({ p }: { p: Person }) {
  const scoreLabel = p.score == null ? '점수 미설정' : `${p.score}점`
  return (
    <li>
      <button type="button" aria-label={`${p.name}, ${p.gender}, ${p.grade}, ${scoreLabel}`} data-cmp="CMP-024" data-testid="person-row" className="flex h-14 w-full items-center border-b border-line px-4 text-left text-body">
        <span className="flex min-w-0 items-center whitespace-nowrap">
          <span className="font-bold text-ink" data-field="name">{p.name}</span>
          <span className="text-ink-muted" data-field="meta">&nbsp;·&nbsp;{p.gender}&nbsp;·&nbsp;{p.grade}&nbsp;·&nbsp;</span>
          {p.score == null ? (
            <Badge data-cmp="CMP-005" data-field="score" className="h-6 rounded-sm border-0 bg-warning-bg px-2 text-[length:var(--font-size-caption)] font-bold text-warning-fg">미설정</Badge>
          ) : (
            <span className="font-bold tabular-nums text-ink" data-field="score">{p.score}점</span>
          )}
        </span>
      </button>
    </li>
  )
}

export function GroupHeader({ label }: { label: string }) {
  return <div role="heading" aria-level={2} className="flex h-8 items-center bg-surface px-4 text-caption font-bold text-ink-muted">{label}</div>
}
