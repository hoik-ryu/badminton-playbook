import { cn } from 'cn'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { FilterChip } from '../components/FilterChip'
import { NoticeBox } from '../components/NoticeBox'
import { OverflowMenu } from '../components/OverflowMenu'
import { PageHeader } from '../components/PageHeader'
import { useSheetRoute } from '../components/sheetHooks'
import { StateView } from '../components/StateView'
import { TextField } from '../components/TextField'
import { listRoster, type Roster, type RosterPerson } from '../features/roster/api'
import { AddPersonSheet } from '../features/roster/AddPersonSheet'
import { EditPerson } from '../features/roster/EditPerson'

// SCR-211 명단(/ops/roster). US-005·006·007·026, FLOW-003-S1·S7, AC-010·012·097, UXD-014·024·025·026·073·074. design-preview/src/screens/SCR-211.tsx를 실제 화면으로 옮김
// 정보 순서: 헤더(뒤로·더보기) → 카카오 안내 한 줄(UXD-014) → 이름 검색 → 필터 칩 → 회원(이름순) → '게스트' 머리글 → 게스트
// - 행: '이름 · 성별 · 급수 · 점수'(UXD-074, VD-007), 점수 미설정은 '미설정' 배지(UXD-025), 행 56(VD-008), 고정폭 숫자(VD-004)
// - 필터 칩 두 개는 하나만 켜짐(UXD-073), 0명이면 숨김. 검색은 부분 일치
// - '게스트 추가': 모바일 오른쪽 아래 떠 있는 버튼(UXD-026, VD-020 탭 위 16), PC 헤더 줄 오른쪽(더보기 옆). 더보기 메뉴는 '회원 직접 추가' 한 항목
// - 행 누르기 → SCR-212(모바일 하단 시트 / PC 옆 패널 400). '비활성 포함' 토글과 비활성 회원 표시는 US-020(후순위)에서
// - ST1 목록 / ST2 행 스켈레톤 / ST3 명단 없음·조건 결과 없음(조건 해제) / ST4 블록 오류 + 다시 시도 / ST5 회원 → SCR-004(가드)
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; roster: Roster }
type Chip = 'unset' | 'tutorial' | null

export function RosterPage() {
  const { sheet, open, close } = useSheetRoute()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [query, setQuery] = useState('')
  const [chip, setChip] = useState<Chip>(null)

  const refresh = useCallback(async () => {
    try {
      setLoad({ kind: 'ok', roster: await listRoster() })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const roster = useMemo<Roster>(() => (load.kind === 'ok' ? load.roster : { members: [], guests: [] }), [load])
  const all = useMemo(() => [...roster.members, ...roster.guests], [roster])
  const unsetCount = all.filter((p) => p.score === null).length
  const tutorialCount = roster.members.filter((p) => p.tutorialRecommendedUnpassed).length
  const match = (p: RosterPerson) =>
    (!query.trim() || p.name.includes(query.trim())) && (chip === 'unset' ? p.score === null : chip === 'tutorial' ? p.tutorialRecommendedUnpassed : true)
  const members = roster.members.filter(match)
  const guests = chip === 'tutorial' ? [] : roster.guests.filter(match)

  // 칩 숫자가 0이 되면 칩이 사라지므로 필터도 해제
  useEffect(() => {
    if ((chip === 'unset' && unsetCount === 0) || (chip === 'tutorial' && tutorialCount === 0)) setChip(null)
  }, [chip, unsetCount, tutorialCount])

  const editing = sheet?.startsWith('edit:') ? all.find((p) => `edit:${p.kind}:${p.id}` === sheet) ?? null : null
  const adding = sheet === 'add:guest' ? 'guest' : sheet === 'add:member' ? 'member' : null
  const openPerson = (p: RosterPerson) => open(`edit:${p.kind}:${p.id}`)

  const st = load.kind === 'loading' ? 'SCR-211-ST2' : load.kind === 'error' ? 'SCR-211-ST4' : all.length === 0 || members.length + guests.length === 0 ? 'SCR-211-ST3' : 'SCR-211-ST1'
  const menu = <OverflowMenu items={[{ label: '회원 직접 추가', onSelect: () => open('add:member') }]} />

  const row = (p: RosterPerson) => {
    const selected = editing?.id === p.id && editing.kind === p.kind
    const scoreLabel = p.score === null ? '점수 미설정' : `${p.score}점`
    return (
      <li key={`${p.kind}:${p.id}`}>
        <button
          type="button"
          data-cmp="CMP-024"
          data-person={`${p.kind}:${p.id}`}
          aria-label={`${p.name}, ${p.gender}, ${p.grade}, ${scoreLabel}`}
          aria-current={selected || undefined}
          onClick={() => openPerson(p)}
          className={cn('flex h-14 w-full items-center border-b border-line bg-transparent px-4 text-left text-body', selected && 'bg-surface')}
        >
          <span className="flex min-w-0 items-center whitespace-nowrap">
            <span className="truncate font-bold text-ink">{p.name}</span>
            <span className="text-ink-muted">&nbsp;·&nbsp;</span>
            <span className="text-ink-muted">{p.gender}</span>
            <span className="text-ink-muted">&nbsp;·&nbsp;</span>
            <span className="text-ink-muted">{p.grade}</span>
            <span className="text-ink-muted">&nbsp;·&nbsp;</span>
            {p.score === null ? (
              <Badge tone="warning">미설정</Badge>
            ) : (
              <span className="font-bold tabular-nums text-ink">{p.score}점</span>
            )}
          </span>
        </button>
      </li>
    )
  }

  const list = (
    <div data-scr="SCR-211" data-st={st} className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title="명단"
        leading="back"
        backTo="/ops"
        trailing={
          <div className="flex items-center gap-1">
            {menu}
          </div>
        }
      />
      <div className="flex flex-col gap-3 px-4 pt-2 pb-3">
        <NoticeBox tone="info">카카오 가입·승인으로 회원이 등록됩니다</NoticeBox>
        <TextField label="이름 검색" hideLabel type="search" placeholder="이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        {(unsetCount > 0 || tutorialCount > 0) && (
          <div role="group" aria-label="필터" className="flex flex-wrap gap-x-2 gap-y-3 py-1.5">
            <FilterChip label="점수 미설정" count={unsetCount} pressed={chip === 'unset'} onToggle={() => setChip(chip === 'unset' ? null : 'unset')} />
            <FilterChip label="튜토리얼 권장 · 미통과" count={tutorialCount} pressed={chip === 'tutorial'} onToggle={() => setChip(chip === 'tutorial' ? null : 'tutorial')} />
          </div>
        )}
      </div>
      {load.kind === 'loading' && <StateView kind="loading" rows={6} label="명단을 불러오는 중" />}
      {load.kind === 'error' && (
        <StateView
          kind="error"
          title="명단을 불러오지 못했습니다"
          description="네트워크 상태를 확인하고 다시 시도해 주세요"
          action={
            <Button variant="secondary" fullWidth onClick={() => { setLoad({ kind: 'loading' }); void refresh() }}>
              다시 시도
            </Button>
          }
        />
      )}
      {load.kind === 'ok' && all.length === 0 && (
        <StateView
          kind="empty"
          title="아직 회원이 없습니다"
          description="카카오로 가입한 사람을 승인하면 여기에 나타납니다"
          action={
            <Button fullWidth onClick={() => open('add:guest')}>
              게스트 추가
            </Button>
          }
        />
      )}
      {load.kind === 'ok' && all.length > 0 && members.length + guests.length === 0 && (
        <StateView
          kind="empty"
          title="조건에 맞는 사람이 없습니다"
          action={
            <Button variant="secondary" fullWidth onClick={() => { setQuery(''); setChip(null) }}>
              조건 해제
            </Button>
          }
        />
      )}
      {load.kind === 'ok' && members.length + guests.length > 0 && (
        <>
          <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_4rem_5rem_5rem] gap-3 border-y border-line px-4 py-2 text-caption font-bold text-ink-muted">
            <span>이름</span>
            <span>성별</span>
            <span>급수</span>
            <span>점수</span>
          </div>
          {members.length > 0 && (
            <ul aria-label="회원" className="m-0 list-none border-t border-line p-0">
              {members.map(row)}
            </ul>
          )}
          {guests.length > 0 && (
            <>
              <div role="heading" aria-level={2} className="flex h-8 items-center bg-surface px-4 text-caption font-bold text-ink-muted">
                게스트
              </div>
              <ul aria-label="게스트" className="m-0 list-none p-0">
                {guests.map(row)}
              </ul>
            </>
          )}
          {/* 스크롤 안전 영역(VD-020): 떠 있는 버튼 48 + 16 (탭 + 안전 영역 + 16은 셸 하단 여백) */}
          <div aria-hidden className="h-16" />
        </>
      )}
      {/* '게스트 추가'는 PC·모바일 모두 오른쪽 아래(UXD-026 r6, D3) */}
      {load.kind === 'ok' && (
        <Button className="app-fixed-end bottom-[calc(56px+env(safe-area-inset-bottom,0px)+16px)] z-20 shadow-card" onClick={() => open('add:guest')} data-testid="fab">
          <Plus aria-hidden />
          게스트 추가
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex min-w-0">
      {list}
      {editing && <EditPerson key={sheet ?? ''} person={editing} onClose={close} onChanged={() => void refresh()} />}
      {adding && <AddPersonSheet mode={adding} onClose={close} onAdded={() => void refresh()} />}
    </div>
  )
}
