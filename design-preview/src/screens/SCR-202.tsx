import { ChevronRight, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { AppNav } from '../components/smapsh/AppNav'
import { ActionButton } from '../components/smapsh/Form'
import { Badge, GameCard, TeamLine } from '../components/smapsh/GameCard'
import { ActionBar, Screen, ScrollSafeArea, Section } from '../components/smapsh/Layout'
import { PageHeader } from '../components/smapsh/PageHeader'
import { session } from '../mock/data'

// SCR-202 오늘 운동(실시간 대진) — UX Spec r2(02 SCR-202) + Design Direction r2
// ST1 생성 전 / ST7 대진 검토. PC·모바일 같은 한 열: 코트 카드는 한 열로 쌓고(VD-024 카드), 참석·옵션은 하단 시트 버튼,
// 주요 행동은 하단 고정 바(탭바·안전 영역 위, VD-020). r1의 PC 2×2·옆 패널은 없음(D1·D2)
function SheetButton({ label, testId }: { label: string; testId: string }) {
  return (
    <button type="button" data-testid={testId} className="flex h-11 min-w-0 flex-1 items-center justify-between gap-1 rounded-md border border-line-strong bg-page px-3 text-body text-ink">
      <span className="truncate">{label}</span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
    </button>
  )
}

export function Scr202({ stateId, overlay, scr = 'SCR-202' }: { stateId: string; overlay?: ReactNode; scr?: string }) {
  const review = stateId === 'SCR-202-ST7'
  const { attendance, courts, waiting } = session
  return (
    <Screen scr={scr} st={stateId} platform="responsive">
      <PageHeader title={`오늘 운동 ${session.date}`} trailing="menu" />
      <main className="flex flex-col gap-6 pt-2">
        <Section>
          <p className="text-body text-ink-muted">
            {session.round}라운드 · {review ? '대진 검토' : '생성 전'}
          </p>
          <div className="flex gap-3">
            <SheetButton label={`참석 ${attendance.total}명`} testId="open-attendance" />
            <SheetButton label={`옵션: ${session.option}`} testId="open-options" />
          </div>
          {!review && attendance.unset > 0 && (
            <div data-cmp="CMP-023" role="status" className="flex items-center gap-2 rounded-md bg-warning-bg p-3 text-body text-warning-fg">
              <TriangleAlert aria-hidden className="size-5 shrink-0" />
              점수 미설정 {attendance.unset}명 · 점수를 매기면 대진을 만들 수 있습니다
            </div>
          )}
        </Section>

        {review && (
          <Section title="대진">
            <div data-cmp="CMP-023" role="status" className="flex items-center gap-2 rounded-md bg-warning-bg p-3 text-body text-warning-fg">
              <TriangleAlert aria-hidden className="size-5 shrink-0" />
              {session.relaxed}경기에서 규칙 완화
            </div>
            <div className="flex flex-col gap-3" data-testid="cards">
              {courts.map((c) => (
                <GameCard key={c.court} title={`코트 ${c.court}`} meta={`실력차 ${c.diff}점`} badges={c.relax && <Badge tone="warning">{c.relax}</Badge>}>
                  <TeamLine label="1팀" players={c.t1} />
                  <TeamLine label="2팀" players={c.t2} />
                </GameCard>
              ))}
            </div>
          </Section>
        )}

        {review && (
          <Section title={`대기자 ${waiting.length}명`}>
            {/* 반복 목록은 Flat(VD-024) */}
            <ul className="border-t border-line" data-testid="waiting">
              {waiting.map((w) => (
                <li key={w.name} className="flex h-12 items-center border-b border-line text-body text-ink">
                  {w.name}
                  <span className="text-ink-muted">&nbsp;· {w.gender} · 오늘 {w.games}게임</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section>
          <button type="button" className="flex h-12 items-center gap-1 text-body text-ink" aria-expanded="false">
            <ChevronRight aria-hidden className="size-5" />
            지난 라운드 ({session.pastRounds})
          </button>
        </Section>
        <ScrollSafeArea withBar />
      </main>
      <ActionBar>
        {review ? (
          <>
            <ActionButton variant="secondary">다시 생성</ActionButton>
            <ActionButton>확정</ActionButton>
          </>
        ) : (
          <ActionButton disabled={attendance.unset > 0}>대진 생성</ActionButton>
        )}
      </ActionBar>
      <AppNav active="ops" opsBadge={3} />
      {overlay}
    </Screen>
  )
}
