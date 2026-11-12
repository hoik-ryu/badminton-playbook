import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useRouteLoaderData } from 'react-router'

import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { StateView } from '../components/StateView'
import { isAdmin } from '../features/auth/types'
import { METHOD_LABEL, STATUS_LABEL } from '../features/clubmatch/api'
import { CLUB_NOT_FOUND, getPublicClubMatch, type MemberGame, type PublicClubMatch } from '../features/clubmatch/memberApi'
import { MemberGameCard } from '../features/clubmatch/MemberGameCard'
import { StandingsCard } from '../features/clubmatch/StandingsCard'
import { isApiError } from '../lib/api'
import type { ShellData } from '../routes/guards'

// SCR-112 청백전 상세(회원, /club-matches/:matchId). US-023·016, FLOW-008-S2·S3, FLOW-005-S5, AC-068·083·084·087·088, UXD-037·045·047·049·072
// - 순서: (운영진) '관리 화면으로' → (ST7) '대진이 수정되었습니다(시각)' → (P-10) '경기 결과가 수정되었습니다(시각)' → (ST8) 최종 결과 카드 → 다음 경기(결과 없는 내 경기 중 가장 앞, 종료면 없음)
//   → 내 경기(나머지: 결과 전 순서대로, 기록된 경기는 승/패와 함께 아래) → 팀 승수 / 순위 요약(눌러 펼치기) → 전체 대진(펼치기)
// - 1–10 점수·팀 점수 합·실력차·다른 회원의 랭크·급수 없음(AC-017·066·068). 내 이름 굵게 + '나', 팀은 글자 함께
// - ST3 참가하지 않음 "이번 청백전에는 참가하지 않았어요" / ST5 미확정·없음 "청백전을 찾을 수 없습니다"(존재 여부를 드러내지 않음, AC-069)
const mmdd = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'notFound' } | { kind: 'ok'; match: PublicClubMatch }

function myGames(games: MemberGame[]) {
  const mine = games.filter((g) => g.mySide !== null)
  const pending = mine.filter((g) => !g.winner)
  const done = mine.filter((g) => g.winner)
  return { next: pending[0] ?? null, rest: [...pending.slice(1), ...done] }
}

export function MemberClubMatchPage() {
  const { matchId = '' } = useParams()
  const data = useRouteLoaderData('member') as ShellData | undefined
  const me = data?.me ?? null
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  const refresh = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      setLoad({ kind: 'ok', match: await getPublicClubMatch(matchId, me?.id ?? null) })
    } catch (e) {
      setLoad(isApiError(e) && (e.code === CLUB_NOT_FOUND || e.status === 404) ? { kind: 'notFound' } : { kind: 'error' })
    }
  }, [matchId, me?.id])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const m = load.kind === 'ok' ? load.match : null
  const finished = m?.status === 'finished'
  const st = load.kind === 'loading' ? 'SCR-112-ST2' : load.kind === 'error' ? 'SCR-112-ST4' : load.kind === 'notFound' ? 'SCR-112-ST5' : finished ? 'SCR-112-ST8' : m?.modifiedAt ? 'SCR-112-ST7' : !m?.participating ? 'SCR-112-ST3' : 'SCR-112-ST1'
  const { next, rest } = m ? myGames(m.games) : { next: null, rest: [] }
  const shownNext = finished ? null : next
  const restGames = finished && next ? [next, ...rest].sort((a, b) => Number(!!a.winner) - Number(!!b.winner) || a.no - b.no) : rest

  return (
    <section data-scr="SCR-112" data-st={st} className="flex w-full max-w-[600px] flex-1 flex-col">
      <PageHeader
        title={m ? `${m.name} ${mmdd(m.date)}` : '청백전'}
        leading="back"
        backTo="/club-matches"
        badge={
          m ? (
            <span className="flex gap-1">
              <Badge tone="neutral">{METHOD_LABEL[m.method]}</Badge>
              <Badge tone={finished ? 'success' : 'info'}>{STATUS_LABEL[m.status]}</Badge>
            </span>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4 px-4 pb-6">
        {load.kind === 'loading' && <StateView kind="loading" rows={4} label="청백전을 불러오는 중" />}
        {load.kind === 'error' && <StateView kind="error" title="청백전을 불러오지 못했습니다" description="연결이 불안정합니다. 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} />}
        {load.kind === 'notFound' && (
          <StateView
            kind="notFound"
            title="청백전을 찾을 수 없습니다"
            action={
              <Button asChild variant="secondary" fullWidth>
                <Link to="/club-matches">청백전 목록으로</Link>
              </Button>
            }
          />
        )}
        {m && (
          <>
            {me && isAdmin(me) && (
              <Link to={`/ops/club-matches/${m.id}`} className="flex h-11 items-center self-start text-body font-bold text-action no-underline">
                관리 화면으로 ›
              </Link>
            )}
            {m.modifiedAt && <NoticeBox tone="info">대진이 수정되었습니다({hhmm(m.modifiedAt)})</NoticeBox>}
            {m.resultModifiedAt && <NoticeBox tone="info">경기 결과가 수정되었습니다({hhmm(m.resultModifiedAt)})</NoticeBox>}
            {finished && <StandingsCard view={m} final />}

            {shownNext && (
              <section aria-labelledby="next-title" className="flex flex-col gap-2">
                <h2 id="next-title" className="m-0 text-body font-bold text-ink">
                  다음 경기
                </h2>
                <MemberGameCard game={shownNext} method={m.method} emphasis />
              </section>
            )}

            <section aria-labelledby="mine-title" className="flex flex-col gap-2">
              <h2 id="mine-title" className="m-0 text-body font-bold text-ink">
                내 경기
              </h2>
              {!m.participating ? (
                <p className="m-0 rounded-md bg-surface px-4 py-3 text-body text-ink-muted">이번 청백전에는 참가하지 않았어요</p>
              ) : restGames.length === 0 ? (
                <p className="m-0 text-body text-ink-muted">다른 내 경기는 없습니다</p>
              ) : (
                restGames.map((g) => <MemberGameCard key={g.no} game={g} method={m.method} />)
              )}
            </section>

            {!finished && <StandingsCard view={m} />}

            <details className="group rounded-md border border-line px-4 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-body font-bold text-ink">전체 대진 · {m.games.length}경기</summary>
              <div className="flex flex-col gap-3 pt-1 pb-2">
                {m.games.map((g) => (
                  <MemberGameCard key={g.no} game={g} method={m.method} />
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  )
}
