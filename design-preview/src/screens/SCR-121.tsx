import { ChevronRight, CircleHelp, LogOut } from 'lucide-react'
import { AppNav } from '../components/smapsh/AppNav'
import { ActionButton } from '../components/smapsh/Form'
import { Screen, ScrollSafeArea, Section } from '../components/smapsh/Layout'
import { PageHeader } from '../components/smapsh/PageHeader'
import { me } from '../mock/data'
import { previewHref } from '../previewLinks'

// SCR-121 마이페이지 — UX Spec r5(02 SCR-121) + Design Direction r5(VD-024 r3 카드 CMP-045, VD-038–042)
// 랭크(글자 S/A/B/C, 색은 보조) → 청백전 전적(+ '청백전 기록 보기' → SCR-111) → 프로필('프로필 수정' → SCR-122) → 로그아웃. 1–10 점수 없음(AC-017)
// 별도 '활동 내역' 화면은 02에 없어 만들지 않음. ST1 기본 / ST3 청백전 기록 없음(AC-055) / ST7 랭크 없음(AC-046)
export function Scr121({ stateId }: { stateId: string }) {
  const noRecord = stateId === 'SCR-121-ST3'
  const noRank = stateId === 'SCR-121-ST7'
  const r = noRank ? me.noRank : me.record
  return (
    <Screen scr="SCR-121" st={stateId} platform="mobile">
      <PageHeader title="마이페이지" leading="none" trailing="none" />
      <main className="flex flex-col gap-6 pt-2">
        <Section>
          <div data-cmp="CMP-045" data-testid="rank-card" className="flex items-center gap-3 rounded-md border border-line bg-page p-3">
            <span className="text-caption font-bold text-ink-muted">랭크</span>
            {noRecord || noRank ? (
              <span className="flex-1 text-body font-bold">
                랭크 없음 · 랭크까지 <span className="tabular-nums">{noRecord ? 10 : me.noRank.toRank}경기</span>
              </span>
            ) : (
              <span className="flex flex-1 items-baseline gap-3">
                <b className="text-display leading-none">{me.rank.grade}</b>
                <span className="text-body tabular-nums text-ink-muted">승률 {me.rank.winRate}%</span>
              </span>
            )}
            <button type="button" aria-label="랭크 기준 안내" className="flex size-11 items-center justify-center rounded-md text-ink-muted">
              <CircleHelp aria-hidden className="size-5" />
            </button>
          </div>
        </Section>

        <Section title="청백전 전적">
          {noRecord ? (
            <p data-cmp="CMP-027" data-variant="empty" className="rounded-md bg-surface px-3 py-4 text-body text-ink-muted">청백전 기록이 없습니다</p>
          ) : (
            <p className="text-body tabular-nums">
              {r.games}경기 {r.wins}승 {r.losses}패 <span className="text-ink-muted">· 승률 {r.winRate}%</span>
            </p>
          )}
          <a href={previewHref('SCR-111')} className="flex h-11 items-center justify-between border-b border-line text-body text-ink no-underline">
            청백전 기록 보기
            <ChevronRight aria-hidden className="size-5 text-ink-muted" />
          </a>
        </Section>

        <Section title="프로필">
          <p className="text-body">
            {me.name} · {me.gender} · 급수 {me.grade}
          </p>
          <div className="flex">
            <a href={previewHref('SCR-122')} data-cmp="CMP-001" data-variant="outline" className="flex h-11 items-center justify-center rounded-md border-[1.5px] border-ink-accent bg-page px-4 text-body font-bold text-ink-accent no-underline">
              프로필 수정
            </a>
          </div>
        </Section>

        <Section>
          <div className="flex">
            <ActionButton variant="secondary" grow={false}>
              <LogOut aria-hidden className="size-5" />
              로그아웃
            </ActionButton>
          </div>
        </Section>
        <ScrollSafeArea withBar={false} />
      </main>
      <AppNav active="my" />
    </Screen>
  )
}
