import type { ReactNode } from 'react'

// CMP-041 GameCard — VD-024 카드 표현: 배경 color.bg.page + 테두리 1px color.border.default + radius.md, 그림자 없음.
// 카드 안 여백 space.3, 카드 안 구역 구분은 color.bg.surface. 팀은 글자 레이블 + 색 띠(04 3장 팀 표기, C-24)
export type Player = { name: string; gender: '남' | '여'; score: number }

export function TeamLine({ label, players, team, showScore = true, trailing }: { label: string; players: Player[]; team?: 'blue' | 'white'; showScore?: boolean; trailing?: ReactNode }) {
  const sum = players.reduce((s, p) => s + p.score, 0)
  const band = team === 'blue' ? 'border-l-4 border-(--color-team-blue-fg) bg-(--color-team-blue-bg)' : team === 'white' ? 'border-l-4 border-line-strong bg-page' : 'bg-surface'
  const labelCls = team === 'blue' ? 'text-(--color-team-blue-fg)' : 'text-ink'
  return (
    <div className={`flex min-h-11 items-center gap-2 rounded-sm px-2 ${band}`}>
      <span className={`w-10 shrink-0 text-caption font-bold ${labelCls}`}>{label}</span>
      <span className="min-w-0 flex-1 text-body text-ink">
        {players.map((p, i) => (
          <span key={p.name} className="whitespace-nowrap">
            {i > 0 && ' · '}
            {p.name}
            {showScore && <span className="text-ink-muted tabular-nums">({p.gender}{p.score})</span>}
          </span>
        ))}
      </span>
      {showScore && <span className="shrink-0 font-bold tabular-nums text-ink">={sum}</span>}
      {trailing}
    </div>
  )
}

export function GameCard({ title, meta, badges, children, testId }: { title: string; meta?: string; badges?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <article data-cmp="CMP-041" data-testid={testId ?? 'game-card'} className="flex flex-col gap-1 rounded-md border border-line bg-page p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-body font-bold text-ink">{title}</h3>
        {meta && <span className="text-caption tabular-nums text-ink-muted">{meta}</span>}
      </div>
      {badges && <div className="flex flex-wrap gap-1">{badges}</div>}
      <div className="flex flex-col gap-1">{children}</div>
    </article>
  )
}

// CMP-005 Badge(짧은 상태). 글자를 항상 포함
export function Badge({ tone, children }: { tone: 'warning' | 'success' | 'info' | 'neutral'; children: ReactNode }) {
  const cls = tone === 'warning' ? 'bg-warning-bg text-warning-fg' : tone === 'success' ? 'bg-success-bg text-success-fg' : tone === 'info' ? 'bg-info-bg text-ink' : 'border border-line-strong bg-page text-ink'
  return (
    <span data-cmp="CMP-005" className={`inline-flex h-6 items-center rounded-sm px-2 text-caption font-bold ${cls}`}>
      {children}
    </span>
  )
}
