import { ChevronRight, Undo2 } from 'lucide-react'
import { ActionButton, Segmented } from './Form'
import { Badge, GameCard, TeamLine } from './GameCard'
import { ActionBar, Section } from './Layout'
import { clubMatch } from '../../mock/data'

// SCR-112 운영 기능 영역(운영진·슈퍼 관리자만) — UX Spec r6 02 SCR-112(r6에서 SCR-223 통합, UXD-085, 이관표 SCR-223-ST7 → ST12, ST8 → ST13)
// 회원에게는 이 영역과 버튼이 없습니다. 제목 '운영'을 둔 별도 영역으로 묶어 스크린리더가 공개 영역과 구분(02 모바일·접근성 메모)
// ST12 준비 중 · 대진 검토: 운영 표시 줄 '회원에게 공개 안 됨', 방식(확정 전만), 참가자 요약(SCR-224), 대진 설정, 미확정 경기 카드(교체 가능, 결과 버튼 없음), 하단 '다시 생성'·'확정'
// ST13 운영 · 확정(결과 입력): '회원 공개됨', 대진 설정은 접힌 요약 한 줄, 결과 버튼, 기록된 경기의 '미기록으로 되돌리기'(X4), 팀 승수, 하단 '청백전 종료'(미기록이 있으면 비활성 + 'n경기 남음')
// 실력차·점수는 운영 카드에만(AC-065, NFR-005). PC·모바일 같은 한 열(VD-024 카드, VD-020 하단 고정 바)
export function ClubMatchOps({ mode }: { mode: 'review' | 'live' }) {
  const live = mode === 'live'
  const m = clubMatch
  return (
      <section aria-labelledby="ops-h" data-testid="ops-area" className="flex flex-col gap-6 border-t-8 border-surface pt-4">
        <Section>
          <h2 id="ops-h" className="flex items-center gap-2 text-title font-bold text-ink">
            운영
            <span className="text-body font-normal text-ink-muted" data-testid="ops-visibility">· {live ? '회원 공개됨' : '회원에게 공개 안 됨'}</span>
          </h2>
          {!live && <Segmented options={['개인전', '팀전']} value="팀전" />}
          <button type="button" data-testid="open-participants" className="flex h-11 items-center justify-between rounded-md border border-line-strong bg-page px-3 text-body text-ink">
            <span className="tabular-nums">
              참가자 {m.participants.total}명 · 청 {m.participants.blue} 백 {m.participants.white}
            </span>
            <ChevronRight aria-hidden className="size-5 text-ink-muted" />
          </button>
          {/* 02: 대진 설정은 ST12·ST13에서 접힌 요약 한 줄 */}
          <p className="text-body tabular-nums text-ink-muted" data-testid="ops-settings">대진 설정 · 총 {m.totalGames}경기 · 밸런스 켜짐 · 성별 조합 켜짐</p>
          {!live && <p className="text-body tabular-nums text-ink-muted">{m.preview} — 순위표에 사람별 경기 수를 함께 표시합니다</p>}
        </Section>

        {live && (
          <Section title="결과 요약">
            <div data-cmp="CMP-042" data-testid="standings-card" className="flex items-center justify-between rounded-md border border-line bg-page p-3">
              <span className="text-display font-bold tabular-nums text-ink">청 {m.wins.blue} : 백 {m.wins.white}</span>
              <span className="text-body tabular-nums text-ink-muted">미기록 {m.unrecorded}경기</span>
            </div>
          </Section>
        )}

        <Section title={`경기 1–${m.totalGames}`}>
          <div className="flex flex-col gap-3" data-testid="cards">
            {m.games.map((g) => (
              <GameCard key={g.no} title={`${g.no}경기`} meta={`실력차 ${g.diff}점`} badges={g.relax && <Badge tone="warning">{g.relax}</Badge>}>
                <TeamLine label="청팀" team="blue" players={g.blue} trailing={live && <ResultButton team="청" won={g.result === 'blue'} />} />
                <TeamLine label="백팀" team="white" players={g.white} trailing={live && <ResultButton team="백" won={g.result === 'white'} />} />
                {live && g.result && (
                  <button type="button" data-testid="undo-result" className="flex h-11 items-center gap-1 self-start text-body text-ink-muted">
                    <Undo2 aria-hidden className="size-4" />
                    미기록으로 되돌리기
                  </button>
                )}
              </GameCard>
            ))}
          </div>
        </Section>
      </section>
  )
}

// 하단 고정 행동 바(탭바·안전 영역 위, VD-020) — main 밖에 둡니다. ST12 '다시 생성'·'확정' / ST13 '청백전 종료'(미기록이 있으면 비활성 + 'n경기 남음')
export function ClubMatchOpsBar({ mode }: { mode: 'review' | 'live' }) {
  const live = mode === 'live'
  const m = clubMatch
  return (
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
  )
}

function ResultButton({ team, won }: { team: '청' | '백'; won: boolean }) {
  return (
    <button type="button" aria-pressed={won} className={`h-11 shrink-0 rounded-md border px-3 text-body font-bold ${won ? 'border-2 border-ink-accent bg-mint-subtle text-ink-accent' : 'border-line-strong bg-page text-ink'}`}>
      {team} 승
    </button>
  )
}
