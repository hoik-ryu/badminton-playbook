import { ChevronRight, Undo2 } from 'lucide-react'
import { AppNav } from '../components/smapsh/AppNav'
import { ActionButton, Segmented } from '../components/smapsh/Form'
import { Badge, GameCard, TeamLine } from '../components/smapsh/GameCard'
import { ActionBar, Screen, ScrollSafeArea, Section } from '../components/smapsh/Layout'
import { PageHeader } from '../components/smapsh/PageHeader'
import { clubMatch } from '../mock/data'

// SCR-223 청백전 운영 상세 — UX Spec r2(02 SCR-223, X4·X6) + Design Direction r2
// ST7 대진 검토 / ST8 확정(결과 입력). PC·모바일 같은 한 열: 경기 카드는 한 열(VD-024), 참가자·팀 구성은 '참가자 n명' 버튼으로 여는
// 하단 시트(SCR-224), 팀 승수 요약은 경기 목록 위(CMP-042 카드). 주요 행동은 하단 고정 바. r1의 PC 2열·옆 패널 없음
export function Scr223({ stateId }: { stateId: string }) {
  const live = stateId === 'SCR-223-ST8'
  const m = clubMatch
  return (
    <Screen scr="SCR-223" st={stateId} platform="responsive">
      <PageHeader title={`${m.name} ${m.date}`} badge={<Badge tone={live ? 'success' : 'warning'}>{live ? '확정됨 · 회원 공개' : '대진 미확정'}</Badge>} trailing="none" />
      <main className="flex flex-col gap-6 pt-2">
        <Section>
          {!live && <Segmented options={['개인전', '팀전']} value="팀전" />}
          <button type="button" data-testid="open-participants" className="flex h-11 items-center justify-between rounded-md border border-line-strong bg-page px-3 text-body text-ink">
            <span className="tabular-nums">
              참가자 {m.participants.total}명 · 청 {m.participants.blue} 백 {m.participants.white}
            </span>
            <ChevronRight aria-hidden className="size-5 text-ink-muted" />
          </button>
        </Section>

        {!live && (
          <Section title="대진 설정">
            <p className="text-body tabular-nums text-ink">총 {m.totalGames}경기 · 밸런스 켜짐 · 성별 조합 켜짐</p>
            <p className="text-body tabular-nums text-ink-muted">{m.preview}</p>
          </Section>
        )}

        {live && (
          <Section title="결과 요약">
            {/* CMP-042 StandingsCard — 카드 대상(VD-024) */}
            <div data-cmp="CMP-042" data-testid="standings-card" className="flex items-center justify-between rounded-md border border-line bg-page p-3">
              <span className="text-display font-bold tabular-nums text-ink">
                청 {m.wins.blue} : 백 {m.wins.white}
              </span>
              <span className="text-body tabular-nums text-ink-muted">미기록 {m.unrecorded}경기</span>
            </div>
          </Section>
        )}

        <Section title={`경기 1–${m.totalGames}`}>
          <div className="flex flex-col gap-3" data-testid="cards">
            {m.games.map((g) => (
              <GameCard key={g.no} title={`${g.no}경기`} meta={`실력차 ${g.diff}점`} badges={g.relax && <Badge tone="warning">{g.relax}</Badge>}>
                <TeamLine
                  label="청팀"
                  team="blue"
                  players={g.blue}
                  trailing={live && <ResultButton team="청" won={g.result === 'blue'} />}
                />
                <TeamLine
                  label="백팀"
                  team="white"
                  players={g.white}
                  trailing={live && <ResultButton team="백" won={g.result === 'white'} />}
                />
                {live && g.result && (
                  // X4: 진행 중·결과가 기록된 경기만, 결과 버튼 아래(AC-109)
                  <button type="button" data-testid="undo-result" className="flex h-11 items-center gap-1 self-start text-body text-ink-muted">
                    <Undo2 aria-hidden className="size-4" />
                    미기록으로 되돌리기
                  </button>
                )}
              </GameCard>
            ))}
          </div>
        </Section>
        <ScrollSafeArea withBar />
      </main>
      <ActionBar>
        {live ? (
          <ActionButton disabled>청백전 종료 · {m.unrecorded}경기 남음</ActionButton>
        ) : (
          <>
            <ActionButton variant="secondary">다시 생성</ActionButton>
            <ActionButton>확정</ActionButton>
          </>
        )}
      </ActionBar>
      <AppNav active="ops" />
    </Screen>
  )
}

function ResultButton({ team, won }: { team: '청' | '백'; won: boolean }) {
  return (
    <button type="button" aria-pressed={won} className={`h-11 shrink-0 rounded-md border px-3 text-body font-bold ${won ? 'border-action bg-action text-on-action' : 'border-line-strong bg-page text-ink'}`}>
      {team} 승
    </button>
  )
}
