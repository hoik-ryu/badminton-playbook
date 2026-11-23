import { Check, Info, LoaderCircle, Undo2 } from 'lucide-react'
import { Fragment, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react'

import type { ClubMatchView, ClubMethod, GameView, Person, Relaxation } from '../api'
import type { MemberGame, MemberPlayer } from '../memberApi'
import { teamLabels, teamShort } from '../teamStyle'

// SCR-112 통합 상세 전용 표현 부품(3.5단계 시각 정합) — Preview r5(design-preview/src/components/smapsh/GameCard.tsx·Form.tsx·ClubMatchOps.tsx,
// screens/SCR-112.tsx)의 마크업·클래스를 그대로 옮겼습니다. 공통 components/(Badge·Button·SegmentedControl·NoticeBox)와
// (5-B2) 이전 SCR-223·SCR-112 회원 카드(ClubGameCard·MemberGameCard·StandingsCard)는 쓰는 곳이 없어 지웠습니다.
// 접근 가능한 이름(경기 article·결과 group·교체 버튼·'n팀 승'·'미기록으로 되돌리기'·'방식' radiogroup·region 이름)은 기존 화면과 같게 유지합니다.

// 클래스 이어 붙이기. 공통 cx(tailwind-merge)은 사용자 정의 글자 크기(text-caption·text-heading)와 글자색(text-ink-* 등)을 같은 묶음으로 보고
// 크기를 지우므로(Preview 13px 레이블 → 16px, 22px 주 버튼 → 16px), 이 파일에서는 병합 없이 그대로 잇습니다.
const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

/** VD-022·023 섹션: 좌우 space.4, 제목(title·bold) 아래 space.2 */
export function CmSection({ title, children, className, ...props }: { title?: ReactNode; children: ReactNode } & Omit<ComponentProps<'section'>, 'title'>) {
  const id = useId()
  return (
    <section aria-labelledby={title ? id : undefined} className={cx('flex flex-col gap-2 px-4', className)} {...props}>
      {title && (
        <h2 id={id} className="m-0 text-title font-bold text-ink">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

/** CMP-005 Badge(Preview 표현: neutral은 테두리형) */
export function CmBadge({ tone, children }: { tone: 'warning' | 'success' | 'info' | 'neutral'; children: ReactNode }) {
  const cls = tone === 'warning' ? 'bg-warning-bg text-warning-fg' : tone === 'success' ? 'bg-success-bg text-success-fg' : tone === 'info' ? 'bg-info-bg text-ink' : 'border border-line-strong bg-page text-ink'
  return (
    <span data-cmp="CMP-005" className={cx('inline-flex h-6 shrink-0 items-center rounded-sm px-2 text-caption leading-none font-bold whitespace-nowrap', cls)}>
      {children}
    </span>
  )
}

/** CMP-023 안내(Preview Notice: info, 아이콘 위 정렬, 안 여백 space.3) */
export function CmNotice({ children }: { children: ReactNode }) {
  return (
    <div data-cmp="CMP-023" role="status" className="flex items-start gap-2 rounded-md bg-info-bg p-3 text-body text-ink">
      <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/** 팀 줄(Preview TeamLine): 청팀 왼쪽 띠 + 채움, 백팀 왼쪽 띠(테두리 강조색) + 흰 면, 개인전은 띠 없이 면 */
export function CmTeamLine({ label, team, children, trailing }: { label: string; team?: 'blue' | 'white'; children: ReactNode; trailing?: ReactNode }) {
  const band = team === 'blue' ? 'border-l-4 border-blue-team-fg bg-blue-team-bg' : team === 'white' ? 'border-l-4 border-line-strong bg-page' : 'bg-surface'
  return (
    <div className={cx('flex min-h-11 items-center gap-2 rounded-sm px-2', band)}>
      <span className={cx('w-10 shrink-0 text-caption font-bold', team === 'blue' ? 'text-blue-team-fg' : 'text-ink')}>{label}</span>
      {/* 이름 칸: 사람 단위로 다음 줄로 넘기고(flex-wrap), 한 사람이 칸보다 길면 그 사람 안에서만 줄바꿈(NameItem). min-w-0으로 팀 합·결과 버튼 자리를 침범하지 않음 */}
      <span data-names className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 text-body text-ink">
        {children}
      </span>
      {trailing}
    </div>
  )
}

/** CMP-041 GameCard(Preview): 테두리 1px + radius.md, 안 여백 space.3, 머리(제목·보조 글) → 배지 줄 → 팀 줄 */
export function CmGameCard({ title, meta, badges, children, ...props }: { title: ReactNode; meta?: ReactNode; badges?: ReactNode; children: ReactNode } & Omit<ComponentProps<'article'>, 'title'>) {
  return (
    <article data-cmp="CMP-041" className="flex flex-col gap-1 rounded-md border border-line bg-page p-3" {...props}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-body font-bold text-ink">{title}</h3>
        {meta && <span className="shrink-0 text-caption tabular-nums text-ink-muted">{meta}</span>}
      </div>
      {badges && <div className="flex flex-wrap gap-1">{badges}</div>}
      <div className="flex flex-col gap-1">{children}</div>
    </article>
  )
}

const teamOf = (method: ClubMethod, i: 0 | 1) => (method === 'team' ? (i === 0 ? 'blue' : 'white') : undefined)
/**
 * 이름 목록(5-B1 D-1): 사람마다 하나의 줄바꿈 단위(flex 항목, min-w-0·max-w-full)로 두고, 이름 뒤 꼬리((성별점수)·(나)·(게스트))와
 * 구분점 ' ·'는 줄바꿈 없는 묶음으로 이름 끝에 붙입니다 → 구분점만 홀로 줄에 남지 않음. 이름이 칸보다 길 때만 글자 단위로 줄바꿈(overflow-wrap:anywhere).
 * 보이는 모양(글자 크기·색·' · ' 간격)은 Preview r5 TeamLine과 같습니다.
 */
const NAME_ITEM = 'min-w-0 max-w-full text-left [overflow-wrap:anywhere]'
const joinNames = <T,>(xs: T[], key: (x: T) => string, render: (x: T, tail: (extra?: ReactNode) => ReactNode) => ReactNode) =>
  xs.map((x, i) => (
    <Fragment key={key(x)}>
      {render(x, (extra) => (
        <span className="whitespace-nowrap">
          {extra}
          {i < xs.length - 1 && <span className="text-ink">{'\u00a0·'}</span>}
        </span>
      ))}
    </Fragment>
  ))

// ── 회원(공개 영역) 경기 카드 ──
// 02 SCR-112: 내 이름 굵게 + '나', 팀 글자 항상 함께. 1–10 점수·팀 합·실력차 없음(AC-017·066)
function memberName(p: MemberPlayer, tail: (extra?: ReactNode) => ReactNode) {
  return (
    <span className={NAME_ITEM}>
      <span className={p.me ? 'font-bold' : undefined}>{p.name}</span>
      {tail(
        <>
          {p.me && (
            <>
              (<span>나</span>)
            </>
          )}
          {p.guest && <span className="text-caption text-ink-muted">(게스트)</span>}
        </>,
      )}
    </span>
  )
}

export function CmMemberGameCard({ game, method, next = false }: { game: MemberGame; method: ClubMethod; next?: boolean }) {
  const labels = teamLabels(method)
  const mine = game.mySide !== null
  const outcome = mine && game.winner ? (game.winner === game.mySide ? '승' : '패') : null
  const meta = outcome ? `결과 ${outcome}` : game.winner ? `${labels[game.winner - 1]} 승` : next ? '다음 경기' : '결과 전'
  const title = mine ? (
    <>
      {game.no}번째 경기<span> · {labels[(game.mySide as 1 | 2) - 1]}</span>
    </>
  ) : (
    `${game.no}경기`
  )
  const badges =
    game.changed || game.resultChanged ? (
      <>
        {game.changed && <CmBadge tone="warning">변경됨</CmBadge>}
        {game.resultChanged && <CmBadge tone="info">결과 수정됨</CmBadge>}
      </>
    ) : undefined
  return (
    <CmGameCard
      data-audience="member"
      data-game={game.no}
      data-mine={mine ? 'true' : 'false'}
      data-recorded={game.winner ? 'true' : 'false'}
      aria-label={`${game.no}경기${mine ? ' · 내 경기' : ''}${outcome ? ` · ${outcome}` : ''}`}
      title={title}
      meta={meta}
      badges={badges}
    >
      {([0, 1] as const).map((i) => (
        <CmTeamLine key={i} label={labels[i]} team={teamOf(method, i)}>
          {joinNames(i === 0 ? game.team1 : game.team2, (p) => p.key, memberName)}
        </CmTeamLine>
      ))}
    </CmGameCard>
  )
}

// ── 운영 경기 카드 ──
// D-10(사용자 결정 2026-11-12): 서버 Relaxation.reason 코드별 문구(이전 ClubGameCard에서 옮김)
const COMMON_REASON = { substitute_exhausted: '대체 후보 소진', manual: '운영진 수동 변경', higher_priority: '중복 대진 방지 우선', search_limit: '자동 탐색 한계' } as const
const MATCHUP_REASON: Record<Relaxation['reason'], string> = { ...COMMON_REASON, exhausted: '가능한 조합 소진' }
const GENDER_REASON: Record<Relaxation['reason'], string> = { ...COMMON_REASON, exhausted: '가능한 성별 조합 없음' }
const reasonText = (game: GameView, rule: Relaxation['rule'], labels: typeof MATCHUP_REASON) => {
  const r = game.relaxations.find((x) => x.rule === rule)
  const text = r ? labels[r.reason] : undefined
  return text ? ` · ${text}` : ''
}

type OpsCardProps = {
  game: GameView
  method: ClubMethod
  showResult: boolean
  onPlayer?: (p: Person) => void
  onResult?: (winner: 1 | 2) => void
  onRevert?: () => void
  busy?: boolean
}

/** 운영 경기 카드(Preview ClubMatchOps): 이름(성별점수) · =팀 합, 줄 끝 결과 버튼, 아래 '미기록으로 되돌리기' */
export function CmOpsGameCard({ game, method, showResult, onPlayer, onResult, onRevert, busy }: OpsCardProps) {
  const labels = teamLabels(method)
  const short = teamShort(method)
  const person = (p: Person, tail: (extra?: ReactNode) => ReactNode) => {
    const body = (
      <>
        {p.name}
        {tail(
          <span className="text-ink-muted tabular-nums">
            ({p.gender ?? ''}
            {p.score ?? '-'})
          </span>,
        )}
      </>
    )
    // 교체 버튼: 누름 영역 높이 44 유지, 이름이 길면 버튼 안에서 줄바꿈(버튼 폭은 이름 칸을 넘지 않음)
    return onPlayer ? (
      <button type="button" onClick={() => onPlayer(p)} aria-label={`${game.no}경기 ${p.name} 교체`} className={`min-h-11 text-body text-ink ${NAME_ITEM}`}>
        {body}
      </button>
    ) : (
      <span className={NAME_ITEM}>{body}</span>
    )
  }
  const sum = (t: Person[]) => (t.some((p) => p.score === null) ? '-' : t.reduce((s, p) => s + (p.score ?? 0), 0))
  const resultButton = (w: 1 | 2) => {
    const on = game.winner === w
    return (
      <button
        type="button"
        disabled={busy}
        aria-pressed={on}
        onClick={() => onResult?.(w)}
        className={cx('h-11 shrink-0 rounded-md border px-3 text-body font-bold disabled:cursor-not-allowed', on ? 'border-2 border-ink-accent bg-mint-subtle text-ink-accent' : 'border-line-strong bg-page text-ink')}
      >
        {short[w - 1]} 승
      </button>
    )
  }
  const badges =
    game.changed || game.resultChanged || game.repeatedMatchup || game.genderRelaxed ? (
      <>
        {game.changed && <CmBadge tone="info">변경됨</CmBadge>}
        {game.resultChanged && <CmBadge tone="info">결과 수정됨</CmBadge>}
        {game.repeatedMatchup && <CmBadge tone="warning">같은 대진 반복{reasonText(game, 'matchup', MATCHUP_REASON)}</CmBadge>}
        {game.genderRelaxed && <CmBadge tone="warning">성별 규칙 완화{reasonText(game, 'gender', GENDER_REASON)}</CmBadge>}
      </>
    ) : undefined
  const lines = ([0, 1] as const).map((i) => {
    const t = i === 0 ? game.team1 : game.team2
    return (
      <CmTeamLine
        key={i}
        label={labels[i]}
        team={teamOf(method, i)}
        trailing={
          <>
            <span className="shrink-0 font-bold tabular-nums text-ink">={sum(t)}</span>
            {showResult && resultButton((i + 1) as 1 | 2)}
          </>
        }
      >
        {joinNames(t, (p) => p.key, person)}
      </CmTeamLine>
    )
  })
  return (
    <CmGameCard data-game={game.no} data-recorded={game.winner ? 'true' : 'false'} aria-label={`${game.no}경기`} title={`${game.no}경기`} meta={game.gap === null ? '실력차 계산 불가' : `실력차 ${game.gap}점`} badges={badges}>
      {showResult ? (
        <div role="group" aria-label={`${game.no}경기 결과`} className="flex flex-col gap-1">
          {lines}
        </div>
      ) : (
        lines
      )}
      {showResult && onRevert && game.winner && (
        <button type="button" disabled={busy} onClick={onRevert} className="flex h-11 items-center gap-1 self-start text-body text-ink-muted">
          <Undo2 aria-hidden className="size-4" />
          미기록으로 되돌리기
        </button>
      )}
    </CmGameCard>
  )
}

/** 운영 상세(ClubMatchView)와 회원 상세(PublicClubMatch)가 함께 쓰는 순위 데이터. me: 회원 화면에서 내 행 강조(이전 StandingsCard에서 옮김) */
export type StandingsData = Pick<ClubMatchView, 'method' | 'team' | 'unrecorded'> & { standings: (ClubMatchView['standings'][number] & { me?: boolean })[] }

// ── 결과 카드(CMP-042) ──
/** 팀 승수(Preview: 큰 숫자 display + 미기록 수). ended면 미기록 줄 없음 */
export function CmTeamWins({ blue, white, unrecorded }: { blue: number; white: number; unrecorded?: number }) {
  return (
    <div data-cmp="CMP-042" className="flex items-center justify-between rounded-md border border-line bg-page p-3">
      <span className="text-display font-bold tabular-nums text-ink">
        청 {blue} : 백 {white}
      </span>
      {unrecorded !== undefined && <span className="text-body tabular-nums text-ink-muted">미기록 {unrecorded}경기</span>}
    </div>
  )
}

/** 팀전 최종 결과 카드(Preview final-card): '최종 결과' → 승리 팀(또는 무승부) → 승수 */
export function CmTeamFinal({ blue, white }: { blue: number; white: number }) {
  return (
    <section data-cmp="CMP-042" aria-label="최종 결과" className="flex flex-col gap-1 rounded-md border border-line bg-page p-3">
      <span className="text-caption font-bold text-ink-muted">최종 결과</span>
      <span className="text-title font-bold text-ink">{blue === white ? '무승부' : `${blue > white ? '청팀' : '백팀'} 승리`}</span>
      <span className="text-display font-bold tabular-nums text-ink">
        청 {blue} : 백 {white}
      </span>
    </section>
  )
}

/** 개인전 순위 카드(Preview 표본 없음 — 같은 카드 표현으로 맞춤). final이면 region '최종 순위' */
export function CmRanking({ view, final = false }: { view: StandingsData; final?: boolean }) {
  const [all, setAll] = useState(false)
  const rows = all ? view.standings : view.standings.filter((r) => r.rank <= 3)
  const Tag = final ? 'section' : 'div'
  return (
    <Tag data-cmp="CMP-042" aria-label={final ? '최종 순위' : undefined} className="flex flex-col gap-1 rounded-md border border-line bg-page p-3">
      <span className="text-caption font-bold text-ink-muted">{final ? '최종 순위' : `미기록 ${view.unrecorded}경기`}</span>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {rows.map((r) => (
          <li key={r.key} data-me={r.me ? 'true' : undefined} className="flex min-h-8 items-center gap-2 text-body text-ink">
            <span className="w-16 shrink-0 font-bold tabular-nums">{r.tied ? `공동 ${r.rank}위` : `${r.rank}위`}</span>
            <span className={cx('min-w-0 flex-1 truncate', r.me && 'font-bold')}>
              {r.name}
              {r.me && <span className="font-normal">(나)</span>}
              {r.guest && <span className="text-caption font-normal text-ink-muted">(게스트)</span>}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-bold">{r.wins}승</span> · {r.games}경기
            </span>
          </li>
        ))}
      </ol>
      {view.standings.length > rows.length || all ? (
        <button type="button" onClick={() => setAll((x) => !x)} className="flex h-11 items-center self-start text-body font-bold text-ink-accent">
          {all ? '접기' : '전체 순위'}
        </button>
      ) : null}
    </Tag>
  )
}

// ── 입력·행동 ──
/** CMP-002 Segmented(Preview): 높이 44, 선택 칸 accent.subtle + 체크. 그룹 이름은 화면 읽기용(aria-label) */
export function CmSegmented<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (d === undefined) return
    e.preventDefault()
    const n = (i + d + options.length) % options.length
    const o = options[n]
    if (o) {
      onChange(o.value)
      refs.current[n]?.focus()
    }
  }
  return (
    <div data-cmp="CMP-002" role="radiogroup" aria-label={label} className="flex h-11 rounded-md border border-line-strong p-0.5">
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(o.value)}
            className={cx('flex flex-1 items-center justify-center gap-1 rounded-sm text-body', on ? 'bg-mint-subtle font-bold text-ink-accent' : 'text-ink')}
          >
            {on && <Check aria-hidden className="size-4" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** 하단 행동 바 버튼(Preview ActionButton): 높이 48, 주 버튼 글자 heading, 비활성은 면 + body */
export function CmActionButton({ variant = 'primary', loading = false, disabled, className, children, ...props }: { variant?: 'primary' | 'secondary'; loading?: boolean } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-cmp="CMP-001"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'flex h-12 flex-1 items-center justify-center gap-1.5 rounded-md px-4 text-body font-bold whitespace-nowrap disabled:cursor-not-allowed',
        variant === 'primary' ? 'bg-action text-heading text-on-action disabled:bg-surface disabled:text-body disabled:text-ink-disabled' : 'border border-line-strong bg-page text-ink disabled:border-line disabled:text-ink-disabled',
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  )
}
