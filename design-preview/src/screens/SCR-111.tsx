import type { CSSProperties, ReactNode } from 'react'
import { Activity, ChevronRight, Clock, ListChecks, Medal, Plus, Trophy } from 'lucide-react'
import { AppNav } from '../components/smapsh/AppNav'
import { Screen, ScrollSafeArea } from '../components/smapsh/Layout'
import { PageHeader } from '../components/smapsh/PageHeader'
import { StateBlock } from '../components/smapsh/StateBlock'
import { clubMatchBoard, type ClubMatchItem } from '../mock/data'
import { previewHref } from '../previewLinks'

// SCR-111 청백전 목록(회원·운영진 공통) — UX Spec r6(02 SCR-111, UXD-085–089) + Design Direction r8(VD-049–058, 채택 EXP-V08-A)
// 순서: 제목 → 소개 배너(CMP-051) → (운영진) '새 청백전' → 진행 중 → 예정된(진행 예정·준비 중) → 지난 → 하단 탭(VD-056·057)
// 회원에게는 '새 청백전'과 준비 중 항목이 없고(AC-069, UXD-086·089) 그 자리를 두지 않음(02 '회원에게는 간격만')
// 간격(VD-051): 좌우 16, 섹션 사이 24, 카드 사이 12, 섹션 제목 → 첫 카드 8, 제목 → 배너 8, 배너 → '새 청백전' 12
// 보기 항목: 'SCR-111-ST1-OPS'(운영진 ST1)는 07 6장 SCR-111-ST1의 역할별 확인용이며 manifest에는 02 상태 ID만 적습니다.
const BASE = import.meta.env.BASE_URL

export function Scr111({ stateId }: { stateId: string }) {
  const ops = stateId.endsWith('-OPS')
  const st = stateId.replace(/-OPS$/, '')
  const items = clubMatchBoard.filter((m) => ops || m.status !== 'pending')
  const live = items.filter((m) => m.status === 'live')
  const planned = items.filter((m) => m.status === 'upcoming' || m.status === 'pending')
  const past = items.filter((m) => m.status === 'ended')
  return (
    <Screen scr="SCR-111" st={stateId} platform="mobile">
      <div className="cm" style={{ '--cm-hero-img': `url(${BASE}assets/AST-079.png)`, '--cm-laurel-img': `url(${BASE}assets/AST-070.png)` } as CSSProperties}>
        <PageHeader title="청백전" leading="none" trailing="none" />
        <main className="flex flex-col gap-6 pt-2" data-testid="cm-list">
          <div className="flex flex-col gap-3 px-4">
            <Hero />
            {ops && (
              <button type="button" className="cm-create" data-cmp="CMP-001" data-variant="primary" data-testid="cm-create">
                <Plus aria-hidden className="size-[18px]" />새 청백전
              </button>
            )}
          </div>
          {st === 'SCR-111-ST4' ? (
            <div className="px-4">
              <StateBlock kind="error" message="청백전 목록을 불러오지 못했습니다" action="다시 시도" />
            </div>
          ) : st === 'SCR-111-ST3' ? (
            <>
              <div className="px-4">
                <StateBlock kind="empty" message="아직 공개된 청백전이 없습니다" />
              </div>
              <ListSection icon={<Clock aria-hidden className="size-[22px]" />} title="지난 청백전" items={past} />
            </>
          ) : (
            <>
              {live.length > 0 && <ListSection icon={<Activity aria-hidden className="size-[22px]" />} title="진행 중인 청백전" count={live.length} items={live} />}
              {planned.length > 0 && <ListSection icon={<Clock aria-hidden className="size-[22px]" />} title="예정된 청백전" items={planned} />}
              {past.length > 0 && <ListSection icon={<Clock aria-hidden className="size-[22px]" />} title="지난 청백전" items={past} />}
            </>
          )}
          {/* VD-057: 목록 끝 여백 = 탭 56 + 안전 영역 + 16 */}
          <ScrollSafeArea withBar={false} />
        </main>
      </div>
      <AppNav active="match" role={ops ? 'admin' : 'member'} />
    </Screen>
  )
}

// CMP-051 ClubMatchHero(VD-052) — 이미지는 장식(aria-hidden, CSS 배경), 제목·설명만 읽힘
function Hero() {
  return (
    <div className="cm-hero" data-cmp="CMP-051" data-testid="cm-hero">
      <div className="cm-hero-art" data-asset="AST-079" aria-hidden />
      <div className="cm-hero-copy">
        <span className="cm-hero-badge">SMAPSH 청백전</span>
        <p className="cm-hero-title">우리 동호회의<br /><span className="cm-hero-accent">청팀</span> vs 백팀 대결</p>
        <p className="cm-hero-desc">팀을 나눠 실전처럼 경기하고<br className="cm-hero-br" /> 기록과 랭킹을 함께 쌓아요.</p>
      </div>
    </div>
  )
}

function ListSection({ icon, title, count, items }: { icon: ReactNode; title: string; count?: number; items: ClubMatchItem[] }) {
  return (
    <section className="flex flex-col gap-2 px-4">
      <h2 className="flex items-center gap-2 text-title font-bold text-ink">
        <span className="text-ink-accent">{icon}</span>
        {title}
        {count !== undefined && <span className="text-body font-normal text-ink-muted tabular-nums">{count}건</span>}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((m) => <li key={m.id}><MatchCard m={m} /></li>)}
      </ul>
    </section>
  )
}

const STATUS: Record<ClubMatchItem['status'], string> = { live: '진행 중', upcoming: '진행 예정', pending: '준비 중', ended: '종료' }

function MethodBadge({ method }: { method: ClubMatchItem['method'] }) {
  return <span className="cm-badge" data-cmp="CMP-005" data-tone={method === '팀전' ? 'teamBlue' : 'individual'}>{method}</span>
}

// CMP-043 ClubMatchListItem(VD-054) — 카드 전체가 하나의 링크(누름 영역 = 카드) → SCR-112
function MatchCard({ m }: { m: ClubMatchItem }) {
  const ended = m.status === 'ended'
  return (
    <a href={previewHref('SCR-112')} className="cm-card" data-cmp="CMP-043" data-status={m.status} data-testid={`cm-item-${m.status}`}>
      <span className="cm-top">
        <span className="cm-title">{m.name}{ended && <MethodBadge method={m.method} />}</span>
        <span className="cm-badges">
          {!ended && <MethodBadge method={m.method} />}
          <span className="cm-badge" data-cmp="CMP-005" data-tone={m.status}>{STATUS[m.status]}</span>
        </span>
      </span>
      <span className="cm-date">
        {m.date}
        {m.status === 'pending' && <span className="cm-ops-chip">운영진에게만 보임</span>}
      </span>
      {m.score && (
        <span className="cm-board" data-cmp="CMP-052" data-size="list">
          <span className="cm-laurel" data-asset="AST-070" data-side="l" aria-hidden />
          <span className="cm-cell" data-team="blue"><span className="cm-cell-name">청팀</span><span className="cm-cell-num">{m.score.blue}</span></span>
          <span className="cm-colon" aria-hidden>:</span>
          <span className="cm-cell" data-team="white"><span className="cm-cell-name">백팀</span><span className="cm-cell-num">{m.score.white}</span></span>
          <span className="cm-laurel" data-asset="AST-070" data-side="r" aria-hidden />
        </span>
      )}
      <span className="cm-foot">
        {m.status === 'live' && !!m.remaining && (
          <><ListChecks aria-hidden className="size-5 text-ink-accent" /><span>남은 경기 {m.remaining}개</span></>
        )}
        {m.summary && <span className="cm-sub tabular-nums">{m.summary}</span>}
        {m.result && (
          <>
            {m.result.kind === 'individual'
              ? <Medal aria-hidden className="size-[22px] text-[var(--color-award-gold)]" />
              : <Trophy aria-hidden className="size-[22px] text-[var(--color-award-gold)]" />}
            <span className="cm-win" data-team={m.result.kind === 'blueWin' ? 'blue' : undefined}>{m.result.text}</span>
            {m.result.final && <span className="cm-final tabular-nums">최종 <b>{m.result.final.blue} : {m.result.final.white}</b></span>}
          </>
        )}
        <ChevronRight aria-hidden className="cm-chev size-[18px]" />
      </span>
    </a>
  )
}
