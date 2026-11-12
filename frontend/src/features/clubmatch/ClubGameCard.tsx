import { cn } from 'cn'
import { Check } from 'lucide-react'

import { Badge } from '../../components/Badge'
import type { ClubMethod, GameView, Person, Relaxation } from './api'
import { teamBandClass, teamLabelClass, teamLabels, teamShort } from './teamStyle'

// CMP-041 GameCard(variant=clubMatch) — 02 SCR-223, UXD-003·032·036, C-24:
// 경기 순서, 팀(개인전 1팀/2팀, 팀전 청팀/백팀 — 글자 + 팀 색 띠, 백팀은 테두리형), 선수 이름(점수), '실력차 N점', '성별 규칙 완화'.
// 결과 버튼(확정 후): 두 팀 버튼을 같은 크기로 나란히, 기록되면 이긴 쪽에 '승' 강조. 확정 전에는 결과 버튼 없음(AC-081)
// I3-d: 결과 선택 아래 '미기록으로 되돌리기'(진행 중 + 기록된 경기만, U2·P-1), 같은 대진 반복·성별 완화 사유(U7·P-4-b), 종료 후 '결과 수정됨'(U10·P-10)
type Props = {
  game: GameView
  method: ClubMethod
  showResult: boolean
  onPlayer?: (p: Person) => void
  onResult?: (winner: 1 | 2) => void
  onRevert?: () => void
  busy?: boolean
}

// D-10(사용자 결정 2026-11-12): 서버 Relaxation.reason 코드별 문구. 코드는 서버 schemas.Relaxation과 같음(새 코드 추가 금지)
const COMMON_REASON = { substitute_exhausted: '대체 후보 소진', manual: '운영진 수동 변경', higher_priority: '중복 대진 방지 우선', search_limit: '자동 탐색 한계' } as const
const MATCHUP_REASON: Record<Relaxation['reason'], string> = { ...COMMON_REASON, exhausted: '가능한 조합 소진' }
const GENDER_REASON: Record<Relaxation['reason'], string> = { ...COMMON_REASON, exhausted: '가능한 성별 조합 없음' }
const reasonText = (game: GameView, rule: Relaxation['rule'], labels: typeof MATCHUP_REASON) => {
  const r = game.relaxations.find((x) => x.rule === rule)
  const text = r ? labels[r.reason] : undefined
  return text ? ` · ${text}` : ''
}

export function ClubGameCard({ game, method, showResult, onPlayer, onResult, onRevert, busy }: Props) {
  const labels = teamLabels(method)
  const short = teamShort(method)
  const team = (i: 0 | 1, t: Person[]) => (
    <div className={cn('flex items-center gap-2 rounded-sm px-2 py-1', teamBandClass(method, i))}>
      <span className={cn('w-10 shrink-0 text-caption font-bold', teamLabelClass(method, i))}>{labels[i]}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-3">
        {t.map((p) =>
          onPlayer ? (
            <button key={p.key} type="button" onClick={() => onPlayer(p)} aria-label={`${game.no}경기 ${p.name} 교체`} className="inline-flex min-h-11 items-center text-body text-ink underline decoration-line-strong decoration-dotted underline-offset-4">
              <span className="font-bold">{p.name}</span>
              <span className="text-ink-muted">(<span className="font-bold tabular-nums text-ink">{p.score ?? '-'}</span>)</span>
            </button>
          ) : (
            <span key={p.key} className="inline-flex min-h-8 items-center text-body text-ink">
              <span className="font-bold">{p.name}</span>
              <span className="text-ink-muted">(<span className="font-bold tabular-nums text-ink">{p.score ?? '-'}</span>)</span>
            </span>
          ),
        )}
      </div>
    </div>
  )
  return (
    <article data-cmp="CMP-041" data-game={game.no} data-recorded={game.winner ? 'true' : 'false'} aria-label={`${game.no}경기`} className="flex flex-col gap-2 rounded-md border border-line bg-page px-4 py-3 shadow-card">
      <header className="flex items-center justify-between gap-2">
        <h3 className="m-0 flex items-center gap-2 text-body font-bold text-ink">
          {game.no}경기
          {game.changed && <Badge tone="info">변경됨</Badge>}
          {game.resultChanged && <Badge tone="info">결과 수정됨</Badge>}
        </h3>
        <span className={cn('text-body tabular-nums', game.gap === null ? 'text-ink-muted' : 'font-bold text-ink')}>{game.gap === null ? '실력차 계산 불가' : `실력차 ${game.gap}점`}</span>
      </header>
      {team(0, game.team1)}
      {team(1, game.team2)}
      {(game.genderRelaxed || game.repeatedMatchup) && (
        <div className="flex flex-wrap gap-1">
          {game.repeatedMatchup && <Badge tone="warning">같은 대진 반복{reasonText(game, 'matchup', MATCHUP_REASON)}</Badge>}
          {game.genderRelaxed && <Badge tone="warning">성별 규칙 완화{reasonText(game, 'gender', GENDER_REASON)}</Badge>}
        </div>
      )}
      {showResult && (
        <div role="group" aria-label={`${game.no}경기 결과`} className="grid grid-cols-2 gap-2 pt-1">
          {([1, 2] as const).map((w) => {
            const on = game.winner === w
            return (
              <button
                key={w}
                type="button"
                disabled={busy}
                aria-pressed={on}
                onClick={() => onResult?.(w)}
                className={cn('flex h-11 items-center justify-center gap-1 rounded-md border text-body', on ? 'border-action bg-action font-bold text-on-action' : 'border-line-strong bg-page text-ink')}
              >
                {on && <Check aria-hidden className="size-4" />}
                {short[w - 1]} 승
              </button>
            )
          })}
        </div>
      )}
      {showResult && onRevert && game.winner && (
        <button type="button" disabled={busy} onClick={onRevert} className="flex min-h-11 items-center self-start text-body text-ink-muted underline underline-offset-4">
          미기록으로 되돌리기
        </button>
      )}
    </article>
  )
}
