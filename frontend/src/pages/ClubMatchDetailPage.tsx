import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useRouteLoaderData } from 'react-router'

import { Button } from '../components/Button'
import { StateView } from '../components/StateView'
import { isAdmin } from '../features/auth/types'
import { ClubMatchDetailHeader, ClubMatchPublicArea } from '../features/clubmatch/ClubMatchDetailParts'
import { ClubMatchOps } from '../features/clubmatch/ClubMatchOps'
import { CLUB_NOT_FOUND, getPublicClubMatch, type PublicClubMatch } from '../features/clubmatch/memberApi'
import { displayStatusOfView, publicFromOps, publicStateId } from '../features/clubmatch/publicView'
import { ClubMatchScope } from '../features/clubmatch/ui/ClubMatchBadge'
import { isApiError } from '../lib/api'
import type { ShellData } from '../routes/guards'

// SCR-112 청백전 상세(/club-matches/:matchId, 회원·운영진 공통) — UX Spec r6(02 SCR-112, UXD-085–087), DD r8, Preview r5
// 같은 머리글(ClubMatchDetailHeader)과 같은 공개 영역(ClubMatchPublicArea)을 쓰고, 운영진·슈퍼 관리자에게만 운영 기능 영역(ClubMatchOps, ST9–ST14)을 더합니다.
// - 회원: 회원 API만 호출(/api/member/club-matches/:id). 준비 중·없는 청백전은 같은 404 → "청백전을 찾을 수 없습니다"(AC-069)
// - 운영진: 운영 API(/api/club-matches/:id, 서버 AdminUser 권한 검사) 한 번으로 운영 영역과 공개 영역을 함께 그림(publicFromOps).
//   준비 중이면 공개 영역 없이 운영 영역만, 확정 후에는 공개 영역 위 + 운영 영역 아래(02 '운영진도 선수', ASM-020)
// - 화면이 고르는 쪽(회원/운영진)은 표시 구성일 뿐이고, 권한은 서버가 판단합니다(운영 API 403·404 → ST5)
export function ClubMatchDetailPage() {
  const { matchId = '' } = useParams()
  const shell = useRouteLoaderData('member') as ShellData | undefined
  const me = shell?.me ?? null
  if (me && isAdmin(me)) {
    return (
      <ClubMatchOps
        key={matchId}
        matchId={matchId}
        header={(view, menu) => <ClubMatchDetailHeader match={view ? { name: view.name, date: view.date, method: view.method, status: displayStatusOfView(view) } : null} menu={menu} />}
        renderPublic={(view) => <ClubMatchPublicArea m={publicFromOps(view, me.id)} />}
      />
    )
  }
  return <MemberDetail key={matchId} matchId={matchId} meId={me?.id ?? null} />
}

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'notFound' } | { kind: 'ok'; match: PublicClubMatch }

function MemberDetail({ matchId, meId }: { matchId: string; meId: string | null }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const refresh = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      setLoad({ kind: 'ok', match: await getPublicClubMatch(matchId, meId) })
    } catch (e) {
      setLoad(isApiError(e) && (e.code === CLUB_NOT_FOUND || e.status === 404) ? { kind: 'notFound' } : { kind: 'error' })
    }
  }, [matchId, meId])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const m = load.kind === 'ok' ? load.match : null
  const st = load.kind === 'loading' ? 'SCR-112-ST2' : load.kind === 'error' ? 'SCR-112-ST4' : load.kind === 'notFound' ? 'SCR-112-ST5' : publicStateId(m!)
  return (
    <ClubMatchScope data-scr="SCR-112" data-st={st} data-role="member" className="cm-page flex w-full max-w-[600px] flex-1 flex-col">
      <ClubMatchDetailHeader match={m ? { name: m.name, date: m.date, method: m.method, status: m.displayStatus } : null} />
      {/* Preview r5 SCR-112: 섹션 사이 space.6, 각 섹션이 좌우 space.4를 가짐 */}
      <div className="flex flex-col gap-6 pt-2 pb-6">
        {load.kind === 'loading' && <StateView kind="loading" rows={4} label="청백전을 불러오는 중" className="px-4" />}
        {load.kind === 'error' && <div className="px-4"><StateView kind="error" title="청백전을 불러오지 못했습니다" description="연결이 불안정합니다. 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} /></div>}
        {load.kind === 'notFound' && (
          <div className="px-4">
          <StateView
            kind="notFound"
            title="청백전을 찾을 수 없습니다"
            action={
              <Button asChild variant="secondary" fullWidth>
                <Link to="/club-matches">청백전 목록으로</Link>
              </Button>
            }
          />
          </div>
        )}
        {m && <ClubMatchPublicArea m={m} />}
      </div>
    </ClubMatchScope>
  )
}
