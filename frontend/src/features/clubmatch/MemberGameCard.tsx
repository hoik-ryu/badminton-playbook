import { cn } from 'cn'
import { Check } from 'lucide-react'

import { Badge } from '../../components/Badge'
import type { ClubMethod } from './api'
import type { MemberGame, MemberPlayer } from './memberApi'
import { teamBandClass, teamLabelClass, teamLabels } from './teamStyle'

// CMP-041 GameCard(clubMatch, audience=member) — 02 SCR-112, UXD-045·049, AC-087·088:
// 경기 순서, 팀(개인전 1팀/2팀, 팀전 청팀/백팀 — 글자 항상 표시), 이름(내 이름 굵게 + '나'), 이긴 팀 '승', 내 경기면 승/패와 강조.
// 1–10 점수·실력차·성별 규칙 완화·교체·결과 버튼 없음(AC-017·066). '변경됨'은 확정 후 대진이 수정된 경기(AC-088),
// '결과 수정됨'은 종료 후 결과가 수정된 경기(U10·P-10)
export function MemberGameCard({ game, method, emphasis = false }: { game: MemberGame; method: ClubMethod; emphasis?: boolean }) {
  const labels = teamLabels(method)
  const mine = game.mySide !== null
  const outcome = mine && game.winner ? (game.winner === game.mySide ? '승' : '패') : null
  const band = (i: 0 | 1, players: MemberPlayer[]) => {
    const won = game.winner === i + 1
    return (
      <div className={cn('flex items-center gap-2 rounded-sm px-2 py-1', teamBandClass(method, i))}>
        <span className={cn('w-10 shrink-0 text-caption font-bold', teamLabelClass(method, i))}>{labels[i]}</span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-3">
          {players.map((p) => (
            <span key={p.key} className={cn('inline-flex min-h-8 items-center gap-1 text-body text-ink', p.me && 'font-bold')}>
              {p.name}
              {p.me && <Badge tone="info">나</Badge>}
              {p.guest && <span className="text-caption text-ink-muted">(게스트)</span>}
            </span>
          ))}
        </div>
        {won && (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-caption font-bold text-ink">
            <Check aria-hidden className="size-4" />승
          </span>
        )}
      </div>
    )
  }
  return (
    <article
      data-cmp="CMP-041"
      data-audience="member"
      data-game={game.no}
      data-mine={mine ? 'true' : 'false'}
      data-recorded={game.winner ? 'true' : 'false'}
      aria-label={`${game.no}경기${mine ? ' · 내 경기' : ''}${outcome ? ` · ${outcome}` : ''}`}
      className={cn('flex flex-col gap-2 rounded-md border bg-page px-4 py-3', mine ? 'border-action' : 'border-line', emphasis && 'border-2')}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className={cn('m-0 flex items-center gap-2 font-bold text-ink', emphasis ? 'text-title' : 'text-body')}>
          {game.no}경기
          {mine && method === 'team' && game.mySide && <span className={cn('text-body', teamLabelClass(method, (game.mySide - 1) as 0 | 1))}>· {labels[game.mySide - 1]}</span>}
          {game.changed && <Badge tone="info">변경됨</Badge>}
          {game.resultChanged && <Badge tone="info">결과 수정됨</Badge>}
        </h3>
        {outcome ? <Badge tone={outcome === '승' ? 'success' : 'neutral'}>{outcome}</Badge> : !game.winner && <span className="text-caption text-ink-muted">결과 전</span>}
      </header>
      {band(0, game.team1)}
      {band(1, game.team2)}
    </article>
  )
}
