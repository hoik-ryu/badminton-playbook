import { AppNav } from '../components/smapsh/AppNav'
import { Badge } from '../components/smapsh/GameCard'
import { Screen, ScrollSafeArea, Section } from '../components/smapsh/Layout'
import { PageHeader } from '../components/smapsh/PageHeader'
import { StateBlock } from '../components/smapsh/StateBlock'
import { memberClubMatches } from '../mock/data'
import { previewHref } from '../previewLinks'

// SCR-111 청백전 목록(회원) — UX Spec r5(02 SCR-111) + Design Direction r5(VD-024 r3 카드: 그림자 없음, VD-038–042 공식 테마)
// 확정·공개된 청백전만 최신순(AC-069). 항목 전체가 하나의 터치 영역 → SCR-112. 배지는 글자 배지(CMP-005). 일정·참여 신청 기능 없음(02에 없음)
// ST1 기본 / ST3 빈 상태(공개된 청백전 없음 + 지난 청백전, AC-089·UXD-046) / ST4 오류
export function Scr111({ stateId }: { stateId: string }) {
  const list = memberClubMatches.list
  return (
    <Screen scr="SCR-111" st={stateId} platform="mobile">
      <PageHeader title="청백전" leading="none" trailing="none" />
      <main className="flex flex-col gap-6 pt-2">
        {stateId === 'SCR-111-ST4' ? (
          <Section>
            <StateBlock kind="error" message="청백전 목록을 불러오지 못했습니다" action="다시 시도" />
          </Section>
        ) : stateId === 'SCR-111-ST3' ? (
          <>
            <Section>
              <StateBlock kind="empty" message="아직 공개된 청백전이 없습니다" />
            </Section>
            <Section title="지난 청백전">
              <MatchList items={list.filter((m) => m.status === '종료')} />
            </Section>
          </>
        ) : (
          <Section>
            <MatchList items={list} />
          </Section>
        )}
        <ScrollSafeArea withBar={false} />
      </main>
      <AppNav active="match" />
    </Screen>
  )
}

function MatchList({ items }: { items: typeof memberClubMatches.list }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((m) => (
        <li key={m.id}>
          <a href={previewHref('SCR-112')} data-cmp="CMP-043" className="flex flex-col gap-1.5 rounded-md border border-line bg-page p-3 text-ink no-underline">
            <span className="text-body font-bold">
              <span className="tabular-nums">{m.date}</span> {m.name}
            </span>
            <span className="flex gap-1">
              <Badge tone="neutral">{m.type}</Badge>
              <Badge tone={m.status === '진행 중' ? 'success' : 'info'}>{m.status}</Badge>
            </span>
            <span className="text-body tabular-nums text-ink-muted">{m.summary}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
