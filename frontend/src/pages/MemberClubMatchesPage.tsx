import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useRouteLoaderData } from 'react-router'

import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { StateView } from '../components/StateView'
import { listClubMatches } from '../features/clubmatch/api'
import { listPublicClubMatches } from '../features/clubmatch/memberApi'
import { ClubMatchScope } from '../features/clubmatch/ui/ClubMatchBadge'
import { ClubMatchHero, ClubMatchSection, type ClubMatchEntry } from '../features/clubmatch/ui/ClubMatchList'
import type { ShellData } from '../routes/guards'

// SCR-111 청백전 목록(/club-matches, 회원·운영진 공통) — UX Spec r6(02 SCR-111, UXD-085–089), DD r8(VD-049–058), Preview r5
// 순서: 제목 → 소개 배너(CMP-051) → (운영진·슈퍼 관리자) '새 청백전' → 진행 중(건수) → 예정된(진행 예정·준비 중) → 지난 → 하단 탭
// - 회원: 회원 목록 API(/api/member/club-matches, 확정된 청백전만). 준비 중 데이터·'새 청백전'은 아예 없음(AC-069, UXD-086·089)
// - 운영진: 운영 목록 API(/api/club-matches, 권한은 서버 AdminUser). 준비 중 카드 + '운영진에게만 보임'(→ 생성 페이지), '새 청백전' → 생성 페이지 SCR-241(UX Spec r9)
// - 표시 상태(진행 중·진행 예정·준비 중·종료)와 결과 문구는 서버가 계산한 값(UXD-087·088). DB 상태값과 다름
// - 항목은 통합 상세 SCR-112(/club-matches/:id)로 엶. 운영진에게는 그 화면에 운영 기능 영역이 더해짐(3단계)
// - 새로고침: 실시간 갱신 없음. 다시 열거나 브라우저 새로고침(당겨서 새로고침 포함)으로 다시 불러옴(UXD-049)
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; items: ClubMatchEntry[] }

async function loadEntries(admin: boolean): Promise<ClubMatchEntry[]> {
  if (admin) {
    const items = await listClubMatches()
    // (UX Spec r9) 준비 중 항목은 생성 페이지(저장된 데이터로 계산한 단계, AC-131)
    return items.map((m) => ({ id: m.id, name: m.name, date: m.date, method: m.method, status: m.displayStatus, team: m.team, remaining: m.unrecorded, games: m.games, participants: m.participants, result: m.result, to: m.status === 'draft' ? `/club-matches/${m.id}/setup` : `/club-matches/${m.id}` }))
  }
  const items = await listPublicClubMatches()
  return items.map((m) => ({ id: m.id, name: m.name, date: m.date, method: m.method, status: m.displayStatus, team: m.team, remaining: m.unrecorded, games: m.games, participants: m.participants, result: m.result, to: `/club-matches/${m.id}` }))
}

export function MemberClubMatchesPage() {
  const shell = useRouteLoaderData('member') as ShellData | undefined
  const admin = shell?.me.role === 'admin' || shell?.me.role === 'superAdmin'
  const navigate = useNavigate()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const refresh = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      setLoad({ kind: 'ok', items: await loadEntries(admin) })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [admin])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const items = load.kind === 'ok' ? load.items : []
  const live = items.filter((m) => m.status === 'live')
  const planned = items.filter((m) => m.status === 'upcoming' || (admin && m.status === 'pending'))
  const past = items.filter((m) => m.status === 'ended')
  const memberEmpty = !admin && load.kind === 'ok' && live.length === 0 && planned.length === 0
  const adminEmpty = admin && load.kind === 'ok' && items.length === 0
  const st = load.kind === 'loading' ? 'SCR-111-ST2' : load.kind === 'error' ? 'SCR-111-ST4' : adminEmpty ? 'SCR-111-ST7' : memberEmpty ? 'SCR-111-ST3' : 'SCR-111-ST1'

  return (
    <ClubMatchScope data-scr="SCR-111" data-st={st} data-role={admin ? 'admin' : 'member'} className="cm-page flex w-full max-w-[600px] flex-1 flex-col">
      <PageHeader title="청백전" />
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex flex-col gap-3 px-4">
          <ClubMatchHero />
          {admin && (
            <button type="button" className="cm-create" data-cmp="CMP-001" data-variant="primary" data-testid="cm-create" onClick={() => navigate('/club-matches/new')}>
              <Plus aria-hidden className="size-[18px]" />새 청백전
            </button>
          )}
        </div>
        {load.kind === 'loading' && <StateView kind="loading" rows={3} label="청백전을 불러오는 중" className="px-4 py-0" />}
        {load.kind === 'error' && (
          <div className="px-4">
            <StateView kind="error" title="청백전 목록을 불러오지 못했습니다" description="연결이 불안정합니다. 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} />
          </div>
        )}
        {adminEmpty && (
          <div className="px-4">
            <StateView kind="empty" title="아직 청백전이 없습니다" description="'새 청백전'으로 첫 청백전을 만들어 보세요" />
          </div>
        )}
        {memberEmpty && (
          <div className="px-4">
            <StateView kind="empty" title="아직 공개된 청백전이 없습니다" description="대진이 확정되면 여기에 나옵니다" />
          </div>
        )}
        {load.kind === 'ok' && !memberEmpty && live.length > 0 && <ClubMatchSection kind="live" title="진행 중인 청백전" count={live.length} items={live} />}
        {load.kind === 'ok' && !memberEmpty && planned.length > 0 && <ClubMatchSection kind="planned" title="예정된 청백전" items={planned} />}
        {load.kind === 'ok' && past.length > 0 && <ClubMatchSection kind="past" title="지난 청백전" items={past} />}
      </div>
    </ClubMatchScope>
  )
}
