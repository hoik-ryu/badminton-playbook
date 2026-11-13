import { cn } from 'cn'

import { Badge } from '../../components/Badge'
import { RELAX_LABEL, type CourtView, type SessionPerson } from './api'
import type { Relaxation } from './lineup'

// CMP-041 GameCard(variant=session/ops) — 02 SCR-202, UXD-003·007, C-24:
// 코트 번호, '1팀 / 2팀'(글자 레이블), 선수 이름·성별·1–10 점수, 팀 점수 합, '실력차 N점' 또는 '실력차 계산 불가'.
// 완화된 규칙은 코트별 배지(누르면 설명), 확정 전에는 선수를 눌러 교체(SCR-205), 진행 중에는 '다음 라운드부터 제외' 표시.
// 체육관 밝은 조명: 카드 글자 최소 16px, 점수 숫자 굵게(02 SCR-202 메모)

type Props = { court: CourtView; onPlayer?: (p: SessionPerson) => void; onRelax?: (r: Relaxation) => void; excluded?: string[]; warnings?: Relaxation[] }

const teamSum = (t: SessionPerson[]) => (t.some((p) => p.score === null) ? null : t.reduce((a, p) => a + (p.score ?? 0), 0))

export function CourtCard({ court, onPlayer, onRelax, excluded = [] }: Props) {
  const team = (label: string, t: SessionPerson[]) => (
    <div className="flex items-center gap-2 py-1">
      <span className="w-9 shrink-0 text-caption font-bold text-ink-muted">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
        {t.map((p) => {
          const inner = (
            <>
              <span className="font-bold">{p.name}</span>
              <span className="text-ink-muted">
                ({p.gender}
                <span className="font-bold tabular-nums text-ink">{p.score ?? '-'}</span>)
              </span>
              {excluded.includes(p.key) && <Badge tone="neutral" className="ml-1">다음 라운드부터 제외</Badge>}
            </>
          )
          return onPlayer ? (
            <button key={p.key} type="button" onClick={() => onPlayer(p)} aria-label={`${p.name}(${p.gender}${p.score ?? '점수 없음'}) 교체`} className="-mx-1 inline-flex min-h-11 items-center gap-0.5 rounded-sm px-1 text-body text-ink underline decoration-line-strong decoration-dotted underline-offset-4">
              {inner}
            </button>
          ) : (
            <span key={p.key} className="inline-flex min-h-8 items-center gap-0.5 text-body text-ink">
              {inner}
            </span>
          )
        })}
      </div>
      <span className="shrink-0 text-body font-bold tabular-nums text-ink">={teamSum(t) ?? '-'}</span>
    </div>
  )
  return (
    <article data-cmp="CMP-041" data-court={court.no} aria-label={`코트 ${court.no}`} className="flex flex-col rounded-md border border-line bg-page px-4 py-3">
      <header className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <h3 className="m-0 text-body font-bold text-ink">코트 {court.no}</h3>
        <span className={cn('text-body tabular-nums', court.gap === null ? 'text-ink-muted' : 'font-bold text-ink')}>{court.gap === null ? '실력차 계산 불가' : `실력차 ${court.gap}점`}</span>
      </header>
      <div className="pt-1">
        {team('1팀', court.team1)}
        {team('2팀', court.team2)}
      </div>
      {court.relaxations.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {court.relaxations.map((r) => (
            <button key={r} type="button" onClick={() => onRelax?.(r)} className="relative inline-flex before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-['']" aria-label={`${RELAX_LABEL[r]}, 설명 보기`}>
              <Badge tone="warning">{RELAX_LABEL[r]}</Badge>
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
