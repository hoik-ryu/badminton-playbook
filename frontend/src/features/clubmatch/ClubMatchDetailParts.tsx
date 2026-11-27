import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { PageHeader } from '../../components/PageHeader'
import { METHOD_LABEL, type ClubMethod } from './api'
import type { DisplayStatus } from './display'
import type { MemberGame, PublicClubMatch } from './memberApi'
import { CmBadge, CmMemberGameCard, CmNotice, CmRanking, CmSection, CmTeamFinal, CmTeamWins } from './ui/DetailCards'

// SCR-112 통합 상세(/club-matches/:matchId)의 공통 부품 — 회원·운영진이 같은 머리글과 공개 영역을 씁니다(UX Spec r6 UXD-085).
// 공개 영역 순서(02 SCR-112): (ST7) 대진 수정 안내 → (ST8) 최종 결과 카드 → (P-10) 결과 수정 안내 → 다음 경기 → 내 경기 → 팀 승수/순위 → 전체 대진
// 1–10 점수·팀 점수 합·실력차·다른 회원의 랭크·급수 없음(AC-017·066·068). 내 이름 굵게 + '나', 팀은 글자 함께
// (3.5단계) 표현은 Preview r5 SCR-112(섹션 space.6·제목 title, 카드 ui/DetailCards)에 맞춤
const mmdd = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })

const STATUS: Record<DisplayStatus, { label: string; tone: 'warning' | 'info' | 'success' | 'neutral' }> = {
  pending: { label: '준비 중', tone: 'warning' },
  upcoming: { label: '진행 예정', tone: 'neutral' },
  live: { label: '진행 중', tone: 'success' },
  ended: { label: '종료', tone: 'info' },
}

/** 머리글: 이름·날짜(UX Spec r6), 방식 배지, 상태 배지(UXD-087 '준비 중'·'진행 예정'·'진행 중'·'종료').
 * (CP-001, UXD-114) menu: 오른쪽 더보기 메뉴(운영진·진행 예정일 때만 화면이 넘김) */
export function ClubMatchDetailHeader({ match, menu }: { match: { name: string; date: string; method: ClubMethod; status: DisplayStatus } | null; menu?: ReactNode }) {
  return (
    <PageHeader
      title={match ? `${match.name} ${mmdd(match.date)}` : '청백전'}
      leading="back"
      backTo="/club-matches"
      trailing={menu ?? 'none'}
      badge={
        match ? (
          <span className="flex gap-1" data-testid="detail-badges">
            <CmBadge tone="neutral">{METHOD_LABEL[match.method]}</CmBadge>
            <CmBadge tone={STATUS[match.status].tone}>{STATUS[match.status].label}</CmBadge>
          </span>
        ) : undefined
      }
    />
  )
}

// (B17, AC-162·UXD-113) 취소된 경기는 '다음 경기'에서 빠지고, 내 경기 목록에서는 끝에 '취소'로 남음
function myGames(games: MemberGame[]) {
  const mine = games.filter((g) => g.mySide !== null)
  const pending = mine.filter((g) => !g.winner && !g.cancelled)
  const done = mine.filter((g) => g.winner && !g.cancelled)
  const cancelled = mine.filter((g) => g.cancelled)
  return { next: pending[0] ?? null, rest: [...pending.slice(1), ...done, ...cancelled] }
}

/** 공개 영역(회원 전체, 운영진은 확정 후 운영 기능 영역 위) */
export function ClubMatchPublicArea({ m }: { m: PublicClubMatch }) {
  const [allOpen, setAllOpen] = useState(false)
  const finished = m.status === 'finished'
  const { next, rest } = myGames(m.games)
  const shownNext = finished ? null : next
  const restGames = finished && next ? [next, ...rest].sort((a, b) => Number(!!a.winner) - Number(!!b.winner) || a.no - b.no) : rest
  const top = m.modifiedAt || m.resultModifiedAt || finished
  return (
    <div className="flex flex-col gap-6" data-testid="public-area">
      {top && (
        <CmSection>
          {m.modifiedAt && <CmNotice>대진이 수정되었습니다({hhmm(m.modifiedAt)})</CmNotice>}
          {finished && (m.method === 'team' ? <CmTeamFinal blue={m.team.blue} white={m.team.white} /> : <CmRanking view={m} final />)}
          {m.resultModifiedAt && <CmNotice>경기 결과가 수정되었습니다({hhmm(m.resultModifiedAt)})</CmNotice>}
        </CmSection>
      )}

      {shownNext && (
        <CmSection title="다음 경기">
          <CmMemberGameCard game={shownNext} method={m.method} next />
        </CmSection>
      )}

      <CmSection title="내 경기">
        {!m.participating ? (
          <p data-cmp-variant="CMP-027" data-variant="empty" className="m-0 rounded-md bg-surface px-3 py-4 text-body text-ink-muted">
            이번 청백전에는 참가하지 않았어요
          </p>
        ) : restGames.length === 0 ? (
          <p className="m-0 text-body text-ink-muted">다른 내 경기는 없습니다</p>
        ) : (
          <div className="flex flex-col gap-3">
            {restGames.map((g) => (
              <CmMemberGameCard key={g.no} game={g} method={m.method} />
            ))}
          </div>
        )}
      </CmSection>

      {m.method === 'team' ? (
        <CmSection title="팀 승수">
          <CmTeamWins blue={m.team.blue} white={m.team.white} unrecorded={finished ? undefined : m.unrecorded} />
        </CmSection>
      ) : (
        !finished && (
          <CmSection title="순위">
            <CmRanking view={m} />
          </CmSection>
        )
      )}

      <CmSection>
        <button type="button" aria-expanded={allOpen} aria-controls="all-games" onClick={() => setAllOpen((x) => !x)} className="flex h-12 items-center justify-between border-b border-line text-title font-bold text-ink">
          전체 대진
          <span className="flex items-center text-body font-normal tabular-nums text-ink-muted">
            {m.games.length}경기 <ChevronDown aria-hidden className={allOpen ? 'size-5 rotate-180' : 'size-5'} />
          </span>
        </button>
        {allOpen && (
          <div id="all-games" className="flex flex-col gap-3 pt-1">
            {m.games.map((g) => (
              <CmMemberGameCard key={g.no} game={g} method={m.method} />
            ))}
          </div>
        )}
      </CmSection>
    </div>
  )
}
