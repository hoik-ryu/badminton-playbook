import { useCallback, useEffect, useState } from 'react'

import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { StateView } from '../components/StateView'
import { ClubMatchListItem } from '../features/clubmatch/ClubMatchListItem'
import { listPublicClubMatches, type PublicClubMatchItem } from '../features/clubmatch/memberApi'

// SCR-111 청백전 목록(회원, /club-matches). US-023, FLOW-008-S1·S1a, AC-069·087·089, UXD-044·046·047·075
// - 확정·공개된 청백전만 최신순(미확정은 날짜·이름도 없음). CMP-043 audience=member
// - 진행 중: 팀전 '청 x : 백 y', 개인전 '경기 n · 참가 m명', '미기록 n'(0이면 숨김) / 종료: 최종 결과
// - ST3: 진행 중인 청백전이 없으면 "아직 공개된 청백전이 없습니다" + 아래에 '지난 청백전'(종료된 것, 있으면) — 임시 해석(b5-policy-open-items Q1)
// - 새로고침: 실시간 갱신 없음. 화면을 다시 열거나 브라우저 새로고침(당겨서 새로고침 포함)으로 다시 불러옴(UXD-049)
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; items: PublicClubMatchItem[] }

function summaryOf(m: PublicClubMatchItem) {
  if (m.status === 'finished') return m.resultText ? <span className="text-body font-bold">{m.resultText}</span> : null
  const main = m.method === 'team' && m.team ? `청 ${m.team.blue} : 백 ${m.team.white}` : `경기 ${m.games} · 참가 ${m.participants}명`
  return (
    <span className="text-body tabular-nums">
      <span className="font-bold">{main}</span>
      {m.unrecorded > 0 && <span className="text-ink-muted"> · 미기록 {m.unrecorded}</span>}
    </span>
  )
}

function MatchList({ items, label }: { items: PublicClubMatchItem[]; label: string }) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((m) => (
        <ClubMatchListItem key={m.id} to={`/club-matches/${m.id}`} id={m.id} name={m.name} date={m.date} method={m.method} status={m.status} summary={summaryOf(m)} />
      ))}
    </ul>
  )
}

export function MemberClubMatchesPage() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const refresh = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      setLoad({ kind: 'ok', items: await listPublicClubMatches() })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const ongoing = load.kind === 'ok' ? load.items.filter((m) => m.status === 'confirmed') : []
  const past = load.kind === 'ok' ? load.items.filter((m) => m.status === 'finished') : []
  const st = load.kind === 'loading' ? 'SCR-111-ST2' : load.kind === 'error' ? 'SCR-111-ST4' : ongoing.length === 0 ? 'SCR-111-ST3' : 'SCR-111-ST1'
  return (
    <section data-scr="SCR-111" data-st={st} className="flex w-full max-w-[600px] flex-1 flex-col">
      <PageHeader title="청백전" />
      <div className="flex flex-col gap-3 px-4 pb-6">
        {load.kind === 'loading' && <StateView kind="loading" rows={3} label="청백전을 불러오는 중" />}
        {load.kind === 'error' && <StateView kind="error" title="청백전을 불러오지 못했습니다" description="연결이 불안정합니다. 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} />}
        {load.kind === 'ok' && ongoing.length > 0 && <MatchList items={load.items} label="청백전" />}
        {load.kind === 'ok' && ongoing.length === 0 && (
          <>
            <StateView kind="empty" title="아직 공개된 청백전이 없습니다" description="대진이 확정되면 여기에 나옵니다" />
            {past.length > 0 && (
              <>
                <h2 className="m-0 mt-2 text-body font-bold text-ink">지난 청백전</h2>
                <MatchList items={past} label="지난 청백전" />
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
