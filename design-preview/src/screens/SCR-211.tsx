import { AppNav } from '../components/smapsh/AppNav'
import { GuestAddButton } from '../components/smapsh/GuestAddButton'
import { NoticeBox } from '../components/smapsh/NoticeBox'
import { PageHeader } from '../components/smapsh/PageHeader'
import { GroupHeader, PersonRow } from '../components/smapsh/PersonRow'
import { RosterControls } from '../components/smapsh/RosterControls'
import { SearchField } from '../components/smapsh/SearchField'
import { roster } from '../mock/data'

// SCR-211 명단 / SCR-211-ST1 기본 / mobile — UX Spec r1(02 SCR-211) + Design Direction r1
// 정보 순서: 헤더 → 카카오 안내 한 줄(UXD-014) → 이름 검색 → 필터 칩 → 비활성 포함 → 회원(이름순) → '게스트' → 게스트
export function Scr211({ stateId }: { stateId: string }) {
  const active = roster.members.filter((m) => !m.inactive)
  const unset = active.filter((m) => m.score == null).length
  const tutorial = active.filter((m) => m.score == null || m.score <= 3).length // C-23 권장 기준(샘플: 모두 미통과 가정)
  return (
    <div className="smapsh min-h-full" data-scr="SCR-211" data-st={stateId} data-platform="mobile">
      <PageHeader title="명단" />
      <main>
        <div className="flex flex-col gap-3 px-4 pt-2 pb-1">
          <NoticeBox>카카오 가입·승인으로 회원이 등록됩니다</NoticeBox>
          <SearchField placeholder="이름 검색" />
          <RosterControls unset={unset} tutorial={tutorial} />
        </div>
        <ul aria-label="회원" data-testid="members">{active.map((p) => <PersonRow key={p.name} p={p} />)}</ul>
        <GroupHeader label="게스트" />
        <ul aria-label="게스트" data-testid="guests">{roster.guests.map((p) => <PersonRow key={p.name} p={p} />)}</ul>
        {/* 스크롤 안전 영역(VD-020): 탭 56 + 안전 영역 + 16 + 떠 있는 버튼 48 + 16 */}
        <div aria-hidden data-testid="scroll-safe-area" className="h-[calc(136px+var(--safe-bottom))]" />
      </main>
      <GuestAddButton label="게스트 추가" />
      <AppNav active="ops" />
    </div>
  )
}
