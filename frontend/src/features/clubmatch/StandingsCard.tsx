import { useState } from 'react'

import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import type { ClubMatchView } from './api'

/** 운영 상세(ClubMatchView)와 회원 상세(PublicClubMatch)가 함께 쓰는 순위 데이터. me: 회원 화면에서 내 행 강조 */
export type StandingsData = Pick<ClubMatchView, 'method' | 'team' | 'unrecorded'> & { standings: (ClubMatchView['standings'][number] & { me?: boolean })[] }

// CMP-042 StandingsCard(audience=ops|member — 회원은 내 행 굵게 + '나', 같은 공개 정보만) — 02 SCR-223, C-16, AC-082·083·084, UXD-037·072:
// 팀전: 청·백 승수와 미기록 수 / 개인전: 순위(누적 승수, 공동 순위, 사람별 경기 수, '게스트'). 위 3명을 보여 주고 '전체 순위' 펼치기
// final: 종료 후 최종 결과 카드(팀전 승리 팀 또는 '무승부 (5 : 5)', 결정전 없음)
export function StandingsCard({ view, final = false }: { view: StandingsData; final?: boolean }) {
  const [all, setAll] = useState(false)
  if (view.method === 'team') {
    const { blue, white } = view.team
    const result = blue === white ? `무승부 (${blue} : ${white})` : `${blue > white ? '청팀' : '백팀'} 승리 (${blue} : ${white})`
    return (
      <section data-cmp="CMP-042" aria-label={final ? '최종 결과' : '팀 승수'} className="rounded-md border border-line bg-page px-4 py-3">
        {final && <p className="m-0 text-caption font-bold text-ink-muted">최종 결과</p>}
        <p className="m-0 text-title font-bold text-ink">{final ? result : `청 ${blue} : 백 ${white}`}</p>
        {!final && <p className="m-0 text-body text-ink-muted">미기록 {view.unrecorded}경기</p>}
      </section>
    )
  }
  const rows = all ? view.standings : view.standings.filter((r) => r.rank <= 3)
  return (
    <section data-cmp="CMP-042" aria-label={final ? '최종 순위' : '순위'} className="rounded-md border border-line bg-page px-4 py-3">
      <p className="m-0 mb-2 text-caption font-bold text-ink-muted">
        {final ? '최종 순위' : '순위'}
        {!final && ` · 미기록 ${view.unrecorded}경기`}
      </p>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {rows.map((r) => (
          <li key={r.key} data-me={r.me ? 'true' : undefined} className="flex items-center gap-2 text-body text-ink">
            <span className="w-16 shrink-0 font-bold tabular-nums">{r.tied ? `공동 ${r.rank}위` : `${r.rank}위`}</span>
            <span className={r.me ? 'min-w-0 flex-1 truncate font-bold' : 'min-w-0 flex-1 truncate'}>
              {r.name}
              {r.me && <Badge tone="info" className="ml-1">나</Badge>}
              {r.guest && <Badge tone="neutral" className="ml-1">게스트</Badge>}
            </span>
            <span className="tabular-nums">
              <span className="font-bold">{r.wins}승</span> · {r.games}경기
            </span>
          </li>
        ))}
      </ol>
      {view.standings.length > rows.length || all ? (
        <Button variant="text" size="md" className="mt-1 px-0" onClick={() => setAll((x) => !x)}>
          {all ? '접기' : '전체 순위'}
        </Button>
      ) : null}
    </section>
  )
}
