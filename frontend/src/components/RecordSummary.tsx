import type { MemberStatus } from '../features/roster/api'

// CMP-045 RecordSummary — 04: audience=self|ops(ops는 튜토리얼 통과 현황·권장 대상·지인 행 추가), 상태 랭크 있음·랭크 없음('랭크까지 n경기')·기록 없음.
// 접근성: 등급은 글자(S/A/B/C). (랭크 기준 '?' 버튼은 SCR-121·랭크 안내 시트와 함께 B5)
export function RecordSummary({ status, audience = 'ops' }: { status: MemberStatus; audience?: 'self' | 'ops' }) {
  const { rank, gamesToRank, record, tutorial } = status
  const recordText = record.games === 0 ? '기록 없음' : `${record.games}경기 ${record.wins}승 ${record.losses}패`
  const rankText = rank ? `랭크 ${rank}` : `랭크 없음${gamesToRank !== null ? ` · 남은 ${gamesToRank}경기` : ''}`
  return (
    <dl data-cmp="CMP-045" className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
      {audience === 'ops' && (
        <>
          <dt className="text-ink-muted">지인</dt>
          <dd className="m-0 text-ink">{status.referrer ?? '-'}</dd>
        </>
      )}
      <dt className="text-ink-muted">랭크</dt>
      <dd className="m-0 text-ink">
        {rankText} · {recordText}
      </dd>
      {audience === 'ops' && (
        <>
          <dt className="text-ink-muted">튜토리얼</dt>
          <dd className="m-0 text-ink">
            입문자 {tutorial.beginner}/{tutorial.total} · 왕초보 {tutorial.novice}/{tutorial.total}
            {status.recommended && <span className="font-bold"> · 권장 대상</span>}
          </dd>
        </>
      )}
    </dl>
  )
}
