import { Activity, ChevronRight, Clock, ListChecks, Medal, Trophy } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'

import { formatMatchDate, type ClubMatchResult, type DisplayStatus } from '../display'
import { CLUBMATCH_BANNER_URL, CLUBMATCH_LAUREL_URL } from './assets'
import { ClubMatchBadge, OpsOnlyChip } from './ClubMatchBadge'

// SCR-111 청백전 목록 화면 부품(UX Spec r6 02 SCR-111, DD r8 VD-049–058, Preview r5 design-preview/src/screens/SCR-111.tsx와 같은 구성).
// 스타일: src/styles/clubmatch.css(.cm 범위). 모두 ClubMatchScope 안에서 씁니다.

/** 목록 한 항목(회원 목록·운영진 목록 응답을 같은 모양으로 맞춘 화면용 값) */
export type ClubMatchEntry = {
  id: string
  name: string
  /** 'YYYY-MM-DD' */
  date: string
  method: 'individual' | 'team'
  /** 표시 상태(UXD-087, 서버 계산) */
  status: DisplayStatus
  /** 팀전 현재 승수(진행 중 점수판). 개인전·준비 중은 null */
  team: { blue: number; white: number } | null
  /** 남은(미기록) 경기 수 */
  remaining: number
  games: number
  participants: number
  result: ClubMatchResult | null
  /** 항목을 눌렀을 때 갈 곳 */
  to: string
}

const STATUS_LABEL: Record<DisplayStatus, string> = { live: '진행 중', upcoming: '진행 예정', pending: '준비 중', ended: '종료' }

/** CMP-051 ClubMatchHero(VD-052) — 이미지는 장식(aria-hidden, CSS 배경), 제목·설명만 읽힘. 이미지 실패 시 hero.bg 바탕 + 글자 */
export function ClubMatchHero() {
  return (
    <div className="cm-hero" data-cmp="CMP-051" data-testid="cm-hero" style={{ '--cm-hero-img': `url(${CLUBMATCH_BANNER_URL})` } as CSSProperties}>
      <div className="cm-hero-art" data-asset="AST-079" aria-hidden />
      <div className="cm-hero-copy">
        <span className="cm-hero-badge">SMAPSH 청백전</span>
        <p className="cm-hero-title">
          우리 동호회의
          <br />
          <span className="cm-hero-accent">청팀</span> vs 백팀 대결
        </p>
        <p className="cm-hero-desc">
          팀을 나눠 실전처럼 경기하고
          <br className="cm-hero-br" /> 기록과 랭킹을 함께 쌓아요.
        </p>
      </div>
    </div>
  )
}

/** 섹션(진행 중·예정된·지난): 아이콘 22 text.accent + 제목(h2) + 건수 */
export function ClubMatchSection({ kind, title, count, items }: { kind: 'live' | 'planned' | 'past'; title: string; count?: number; items: ClubMatchEntry[] }) {
  const Icon = kind === 'live' ? Activity : Clock
  return (
    <section className="flex flex-col gap-2 px-4" data-testid={`cm-section-${kind}`} aria-labelledby={`cm-h-${kind}`}>
      <h2 id={`cm-h-${kind}`} className="m-0 flex items-center gap-2 text-title font-bold text-ink">
        <Icon aria-hidden className="size-[22px] text-ink-accent" />
        {title}
        {count !== undefined && <span className="text-body font-normal text-ink-muted tabular-nums">{count}건</span>}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((m) => (
          <li key={m.id}>
            <ClubMatchCard m={m} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function MethodBadge({ method }: { method: ClubMatchEntry['method'] }) {
  return <ClubMatchBadge tone={method === 'team' ? 'teamBlue' : 'individual'}>{method === 'team' ? '팀전' : '개인전'}</ClubMatchBadge>
}

/** CMP-043 ClubMatchListItem(VD-054) — 카드 전체가 하나의 링크(누름 영역 = 카드) */
export function ClubMatchCard({ m }: { m: ClubMatchEntry }) {
  const ended = m.status === 'ended'
  let foot: ReactNode
  if (ended && m.result) {
    const Icon = m.result.method === 'team' ? Trophy : Medal
    foot = (
      <>
        <Icon aria-hidden className="cm-award size-[22px]" />
        <span className="cm-win" data-team={m.result.outcome === 'blue' ? 'blue' : undefined}>{m.result.text}</span>
        {m.result.final && (
          <span className="cm-final tabular-nums">
            최종 <b>{m.result.final.blue} : {m.result.final.white}</b>
          </span>
        )}
      </>
    )
  } else if (m.status === 'pending') {
    foot = <span className="cm-sub tabular-nums">참가 {m.participants}명 · 대진 미확정</span>
  } else if (m.status === 'upcoming' || (m.status === 'live' && m.method === 'individual')) {
    foot = (
      <>
        <span className="cm-sub tabular-nums">경기 {m.games} · 참가 {m.participants}명</span>
        {m.status === 'live' && m.remaining > 0 && <span className="tabular-nums">· 남은 경기 {m.remaining}개</span>}
      </>
    )
  } else if (m.status === 'live' && m.remaining > 0) {
    foot = (
      <>
        <ListChecks aria-hidden className="size-5 text-ink-accent" />
        <span className="tabular-nums">남은 경기 {m.remaining}개</span>
      </>
    )
  }
  return (
    <Link to={m.to} className="cm-card" data-cmp="CMP-043" data-status={m.status} data-match={m.id} data-testid={`cm-item-${m.status}`}>
      <span className="cm-top">
        <span className="cm-title">
          {m.name}
          {ended && <MethodBadge method={m.method} />}
        </span>
        <span className="cm-badges">
          {!ended && <MethodBadge method={m.method} />}
          <ClubMatchBadge tone={m.status}>{STATUS_LABEL[m.status]}</ClubMatchBadge>
        </span>
      </span>
      <span className="cm-date">
        {formatMatchDate(m.date)}
        {m.status === 'pending' && <OpsOnlyChip />}
      </span>
      {m.status === 'live' && m.method === 'team' && m.team && <TeamScoreboard blue={m.team.blue} white={m.team.white} />}
      <span className="cm-foot">
        {foot}
        <ChevronRight aria-hidden className="cm-chev size-[18px]" />
      </span>
    </Link>
  )
}

/** CMP-052 TeamScoreboard(size=list, VD-054·058) — 팀 이름 글자 포함, 월계수는 장식 */
export function TeamScoreboard({ blue, white }: { blue: number; white: number }) {
  return (
    <span className="cm-board" data-cmp="CMP-052" data-size="list" style={{ '--cm-laurel-img': `url(${CLUBMATCH_LAUREL_URL})` } as CSSProperties}>
      <span className="cm-laurel" data-asset="AST-070" data-side="l" aria-hidden />
      <span className="cm-cell" data-team="blue">
        <span className="cm-cell-name">청팀</span>
        <span className="cm-cell-num">{blue}</span>
      </span>
      <span className="cm-colon" aria-hidden>:</span>
      <span className="cm-cell" data-team="white">
        <span className="cm-cell-name">백팀</span>
        <span className="cm-cell-num">{white}</span>
      </span>
      <span className="cm-laurel" data-asset="AST-070" data-side="r" aria-hidden />
    </span>
  )
}
