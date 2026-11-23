import { ChevronDown, Info } from 'lucide-react'
import { AppNav } from '../components/smapsh/AppNav'
import { ClubMatchOps, ClubMatchOpsBar } from '../components/smapsh/ClubMatchOps'
import { Badge, GameCard, TeamLine } from '../components/smapsh/GameCard'
import { Screen, ScrollSafeArea, Section } from '../components/smapsh/Layout'
import { PageHeader } from '../components/smapsh/PageHeader'
import { memberClubMatches, type MemberGame } from '../mock/data'

// SCR-112 청백전 상세(회원·운영진 공통) — UX Spec r6(02 SCR-112, r6에서 SCR-223 통합, UXD-085) + Design Direction r8(VD-024 r3 카드, VD-038–042, VD-019·056 하단 탭)
// 실제 회원이 모여 진행하는 청백전의 대진·결과 화면. 회원에게는 1–10 점수·팀 점수 합·실력차를 보여 주지 않음(AC-066).
// 내 이름 굵게 + '나', 팀은 '청팀'·'백팀' 글자 함께. (r6) '관리 화면으로' 링크는 없앰(같은 화면에 운영 기능 영역, UXD-085)
// 공개 영역: ST1 진행 중 / ST3 내가 참가하지 않음 / ST7 대진 수정됨(배너 + '변경됨' 배지, AC-088) / ST8 종료(최종 결과 카드, 결과 수정 안내) — 회원 보기(3탭)
// 운영 기능 영역(운영진 보기, 4탭): ST12 준비 중 · 대진 검토(공개 영역 없음) / ST13 확정 · 결과 입력(공개 영역 위 + 운영 기능 영역 아래, 02 '운영진도 선수')
export function Scr112({ stateId }: { stateId: string }) {
  const d = memberClubMatches.detail
  const ended = stateId === 'SCR-112-ST8'
  const notJoined = stateId === 'SCR-112-ST3'
  const modified = stateId === 'SCR-112-ST7'
  const myGames = notJoined ? [] : d.games.filter((g) => g.mine)
  const next = !ended ? myGames.find((g) => !g.result) : undefined
  const review = stateId === 'SCR-112-ST12'
  const opsLive = stateId === 'SCR-112-ST13'
  const ops = review || opsLive
  return (
    <Screen scr="SCR-112" st={stateId} platform="mobile">
      <PageHeader title={d.name} trailing="none" badge={<span className="flex gap-1"><Badge tone="neutral">{d.type}</Badge><Badge tone={review ? 'warning' : ended ? 'info' : 'success'}>{review ? '준비 중' : ended ? '종료' : '진행 중'}</Badge></span>} />
      <main className="flex flex-col gap-6 pt-2">
        {!review && (<>
        {(modified || ended) && (<Section>
          {modified && <Notice>{`대진이 수정되었습니다(${d.modifiedAt})`}</Notice>}
          {ended && (
            <>
              <div data-cmp="CMP-042" data-testid="final-card" className="flex flex-col gap-1 rounded-md border border-line bg-page p-3">
                <span className="text-caption font-bold text-ink-muted">최종 결과</span>
                <span className="text-title font-bold">청팀 승리</span>
                <span className="text-display font-bold tabular-nums">
                  청 {d.final.blue} : 백 {d.final.white}
                </span>
              </div>
              <Notice>{`경기 결과가 수정되었습니다(${d.resultModifiedAt})`}</Notice>
            </>
          )}
        </Section>)}

        {next && (
          <Section title="다음 경기">
            <MyGame g={next} me={d.me} highlight changed={modified && next.changed} />
          </Section>
        )}

        <Section title="내 경기">
          {notJoined ? (
            <p data-cmp="CMP-027" data-variant="empty" className="rounded-md bg-surface px-3 py-4 text-body text-ink-muted">이번 청백전에는 참가하지 않았어요</p>
          ) : (
            <div className="flex flex-col gap-3">
              {myGames.filter((g) => g !== next).map((g) => <MyGame key={g.no} g={g} me={d.me} changed={modified && g.changed} />)}
            </div>
          )}
        </Section>

        <Section title="팀 승수">
          <button type="button" data-cmp="CMP-042" className="flex items-center justify-between rounded-md border border-line bg-page p-3 text-left">
            <span className="text-display font-bold tabular-nums">청 {ended ? d.final.blue : d.wins.blue} : 백 {ended ? d.final.white : d.wins.white}</span>
            {!ended && <span className="text-body tabular-nums text-ink-muted">미기록 {d.unrecorded}경기</span>}
          </button>
        </Section>

        <Section>
          <button type="button" aria-expanded="false" className="flex h-12 items-center justify-between border-b border-line text-title font-bold">
            전체 대진 <span className="text-body font-normal text-ink-muted tabular-nums">{d.games.length}경기 <ChevronDown aria-hidden className="inline size-5" /></span>
          </button>
        </Section>
        </>)}
        {ops && <ClubMatchOps mode={review ? 'review' : 'live'} />}
        <ScrollSafeArea withBar={ops} />
      </main>
      {ops && <ClubMatchOpsBar mode={review ? 'review' : 'live'} />}
      <AppNav active="match" role={ops ? 'admin' : 'member'} />
    </Screen>
  )
}

function Notice({ children }: { children: string }) {
  return (
    <div data-cmp="CMP-023" role="status" className="flex items-start gap-2 rounded-md bg-info-bg p-3 text-body text-ink">
      <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function MyGame({ g, me, highlight, changed }: { g: MemberGame; me: string; highlight?: boolean; changed?: boolean }) {
  const res = g.result ? (g.result === g.myTeam ? '승' : '패') : undefined
  const names = (xs: string[]) => xs.map((n) => (n === me ? `${n}(나)` : n))
  return (
    <GameCard
      title={`${g.no}번째 경기 · ${g.myTeam === 'blue' ? '청팀' : '백팀'}`}
      meta={res ? `결과 ${res}` : highlight ? '다음 경기' : '결과 전'}
      badges={changed ? <Badge tone="warning">변경됨</Badge> : undefined}
    >
      <TeamLine label="청팀" team="blue" showScore={false} players={names(g.blue).map((n) => ({ name: n, gender: '남', score: 0 }))} />
      <TeamLine label="백팀" team="white" showScore={false} players={names(g.white).map((n) => ({ name: n, gender: '남', score: 0 }))} />
    </GameCard>
  )
}
