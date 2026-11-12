import { AppNav } from "@/components/smapsh/AppNav";
import { PageHeader } from "@/components/smapsh/PageHeader";
import { GroupHeader, PersonRow } from "@/components/smapsh/PersonRow";
import { RosterControls } from "@/components/smapsh/RosterControls";
import { guests, members } from "@/mock/roster";

// SCR-211 명단 / ST1 기본 / mobile (C안 실험). 안내 배너(UXD-014 한 줄) 제거 — 실험 허용 항목
export function Scr211Roster() {
  const active = members.filter(m => !m.inactive);
  const unset = active.filter(m => m.score == null).length;
  const tutorial = active.filter(m => m.score == null || m.score <= 3).length; // C-23 권장 기준(샘플: 모두 미통과 가정)
  return (
    <div data-scr="SCR-211" data-st="ST1" data-platform="mobile" data-experimental="C안: 안내 배너 제거" className="min-h-dvh bg-bg-page">
      <PageHeader title="명단" action="게스트 추가" />
      <main>
        <RosterControls unset={unset} tutorial={tutorial} />
        <ul aria-label="회원" data-testid="members">{active.map(p => <PersonRow key={p.name} p={p} />)}</ul>
        <GroupHeader label="게스트" />
        <ul aria-label="게스트" data-testid="guests">{guests.map(p => <PersonRow key={p.name} p={p} />)}</ul>
        {/* 스크롤 안전 영역: 탭 64 + 기기 안전 영역 + 16 */}
        <div aria-hidden data-testid="scroll-safe-area" className="h-[calc(64px+var(--safe-bottom)+16px)]" />
      </main>
      <AppNav active="ops" />
    </div>
  );
}
