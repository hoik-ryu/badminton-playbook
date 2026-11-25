import { ArrowRight, Check, ChevronLeft, Info, MoreVertical } from 'lucide-react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { FixedInColumn, Screen } from './Layout'
import { initial, meta, type SetupPerson } from '../../mock/setup'

// 청백전 생성 페이지 공통 틀(SCR-241–245) — UX Spec r9 02 '생성 페이지 공통', 04 3.3 / Design Direction r12 VD-059–063·068–070
// 머리글(뒤로·로고·오른쪽 자리) → 히어로(라벨·제목·설명 + AST-046 셔틀콕 + CSS 코트 빛) → 카드(진행 표시 + 단계 내용) → 하단 이전·다음(탭바 숨김)
const BASE = import.meta.env.BASE_URL

export type Method = 'team' | 'individual'
export const STEPS: Record<Method, { key: string; name: string; scr: string }[]> = {
  team: [
    { key: 'basic', name: '기본정보', scr: 'SCR-241' },
    { key: 'participants', name: '참가자 설정', scr: 'SCR-242' },
    { key: 'teams', name: '팀 구성', scr: 'SCR-243' },
    { key: 'games', name: '대진 설정', scr: 'SCR-244' },
    { key: 'confirm', name: '확정', scr: 'SCR-245' },
  ],
  individual: [
    { key: 'basic', name: '기본정보', scr: 'SCR-241' },
    { key: 'participants', name: '참가자 설정', scr: 'SCR-242' },
    { key: 'games', name: '대진 설정', scr: 'SCR-244' },
    { key: 'confirm', name: '확정', scr: 'SCR-245' },
  ],
}

/** 프리뷰 안 단계 이동 주소(제품 라우트 아님). 개인전 보기는 상태 ID 끝에 -IND */
export const stepHref = (scr: string, method: Method, st = `${scr}-ST1`) => `#${scr}/${st}${method === 'individual' ? '-IND' : ''}/mobile`

/** CMP-053 StepProgress(VD-060): 번호 원 + 선, 글자는 현재 단계 이름만. 방식 미선택이면 '1 기본정보'만 */
export function StepProgress({ method, current }: { method: Method | null; current: string }) {
  if (!method)
    return (
      <div className="su-steps" data-cmp="CMP-053" data-steps="unknown">
        <ol aria-label="진행 단계">
          <li>
            <span className="su-step" data-s="current" aria-current="step" aria-label="1단계 기본정보, 현재">
              <span>1</span>
            </span>
          </li>
        </ol>
        <span className="su-step-label">1 기본정보 · 방식을 고르면 단계가 정해집니다</span>
      </div>
    )
  const steps = STEPS[method]
  const idx = steps.findIndex((s) => s.key === current)
  return (
    <div className="su-steps" data-cmp="CMP-053" data-steps={steps.length}>
      <ol aria-label={`진행 단계 ${steps.length}개`}>
        {steps.map((s, i) => {
          const state = i < idx ? 'done' : i === idx ? 'current' : 'todo'
          const label = `${i + 1}단계 ${s.name}, ${state === 'done' ? '완료' : state === 'current' ? '현재' : '남음'}`
          return (
            <li key={s.key}>
              {i > 0 && <span aria-hidden className="su-step-line" data-done={i <= idx} />}
              {state === 'done' ? (
                <a className="su-step" data-s={state} href={stepHref(s.scr, method)} aria-label={label}>
                  <span>
                    <Check aria-hidden className="size-4" strokeWidth={3} />
                  </span>
                </a>
              ) : (
                <span className="su-step" data-s={state} aria-current={state === 'current' ? 'step' : undefined} aria-label={label}>
                  <span>{i + 1}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {/* 현재 원 아래에 두되 카드 밖으로 나가지 않게: 왼쪽 여백 p%와 자기 폭의 -p% 이동(처음은 왼쪽 정렬, 끝은 오른쪽 정렬) */}
      <span className="su-step-label" style={{ marginLeft: `${(idx / (steps.length - 1)) * 100}%`, transform: `translateX(-${(idx / (steps.length - 1)) * 100}%)` }}>
        {idx + 1}/{steps.length} {steps[idx]?.name}
      </span>
    </div>
  )
}

export function SetupScreen({
  scr,
  st,
  method,
  step,
  title,
  desc,
  compact = false,
  draft = false,
  card,
  after,
  bar,
  overlay,
  onExit,
}: {
  scr: string
  st: string
  method: Method | null
  step: string
  title: string
  desc: string
  compact?: boolean
  /** 저장된 준비 중 청백전: 머리글 오른쪽에 더보기(삭제) */
  draft?: boolean
  card: ReactNode
  after?: ReactNode
  bar: ReactNode
  overlay?: ReactNode
  /** (r13) 나가기를 가로채 이탈 확인을 띄울 때(SCR-244 미완성 경기, UXD-103). 없으면 목록 링크 */
  onExit?: () => void
}) {
  return (
    <Screen scr={scr} st={st} platform="responsive">
      <div className="su" data-method={method ?? 'none'}>
        <header className="su-head" data-cmp="CMP-026">
          {onExit ? (
            <button type="button" className="su-icon-btn" aria-label="나가기(청백전 목록)" onClick={onExit}>
              <ChevronLeft aria-hidden className="size-6" />
            </button>
          ) : (
            <a className="su-icon-btn" href="#SCR-111/SCR-111-ST1-OPS/mobile" aria-label="나가기(청백전 목록)">
              <ChevronLeft aria-hidden className="size-6" />
            </a>
          )}
          <div className="su-logo" aria-label="SMAPSH">
            <img src={`${BASE}brand/smapsh-symbol.svg`} alt="" aria-hidden />
            <span aria-hidden>SMAPSH</span>
          </div>
          {draft ? (
            <button type="button" className="su-icon-btn" aria-label="더보기: 청백전 삭제" data-testid="su-more">
              <MoreVertical aria-hidden className="size-5" />
            </button>
          ) : (
            <span aria-hidden />
          )}
        </header>
        <section className="su-hero" data-compact={compact} aria-labelledby={`${scr}-title`}>
          <div aria-hidden className="su-hero-court" />
          <img className="su-shuttle" src={`${BASE}assets/AST-046.png`} alt="" aria-hidden data-asset="AST-046" />
          <div className="su-hero-text">
            <span className="su-eyebrow">청백전 생성</span>
            <h1 id={`${scr}-title`} className="su-title">
              {title}
            </h1>
            <p className="su-desc">{desc}</p>
          </div>
        </section>
        <div className="su-card" data-testid="su-card">
          <StepProgress method={method} current={step} />
          <div className="su-body">{card}</div>
        </div>
        {after}
        <div className="su-spacer" aria-hidden data-testid="scroll-safe-area" />
      </div>
      {bar}
      {overlay}
    </Screen>
  )
}

/** CMP-054 StepActionBar(VD-063): 기존 민트 주 버튼 + 어두운 글자 + 화살표, 2단계부터 '이전' */
export function StepBar({ prev, next, nextLabel = '다음', nextIcon, disabledReason, quietReason, above, loading }: { prev?: string; next?: string; nextLabel?: string; nextIcon?: ReactNode; disabledReason?: string; /** 바로 위 경고 줄이 같은 사유를 보여 줄 때 사유 줄은 화면 읽기 전용으로(고정 영역 절약) */ quietReason?: boolean; above?: ReactNode; loading?: boolean }) {
  // 바 높이(요약 줄·경고 줄 포함)를 스크롤 끝 여백에 반영해 마지막 행이 가리지 않게 합니다(VD-020)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--su-bar-live', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <FixedInColumn bottom="0px" z="z-20" testId="action-bar">
      <div className="su-bar" data-cmp="CMP-054" ref={ref}>
        {above}
        {disabledReason && (
          <p className={quietReason ? 'sr-only' : 'su-reason'} id="su-reason">
            <Info aria-hidden />
            {disabledReason}
          </p>
        )}
        <div className="su-bar-row">
          {prev && (
            <a className="su-prev" href={prev} data-cmp="CMP-001" data-variant="secondary">
              <ChevronLeft aria-hidden className="size-5" />
              이전
            </a>
          )}
          {disabledReason || loading ? (
            <button type="button" className="su-next" disabled aria-describedby={disabledReason ? 'su-reason' : undefined} aria-busy={loading || undefined} data-cmp="CMP-001" data-variant="primary">
              {loading ? '저장 중…' : nextLabel}
            </button>
          ) : (
            <a className="su-next" href={next} data-cmp="CMP-001" data-variant="primary" data-testid="su-next">
              {nextIcon}
              {nextLabel}
              {!nextIcon && <ArrowRight aria-hidden />}
            </a>
          )}
        </div>
      </div>
    </FixedInColumn>
  )
}

export function SectionTitle({ icon, children, req, aside }: { icon: ReactNode; children: ReactNode; req?: boolean; aside?: ReactNode }) {
  return (
    <h2 className="su-sec-h">
      {icon}
      {children}
      {req && <span className="su-req" aria-label="필수">*</span>}
      {aside && <span className="su-aside">{aside}</span>}
    </h2>
  )
}

/** 경기 방식 섹션 아이콘: Lucide에 셔틀콕이 없어 브랜드 심볼 단색(VD-061·070) */
export function ShuttleIcon() {
  return <img src={`${BASE}brand/smapsh-symbol.svg`} alt="" aria-hidden />
}

/** CMP-057 Avatar(VD-076): 이니셜. size sm 24(경기 카드 자리) · 기본 32(목록 행) · md 40(시트 머리글) */
export function Avatar({ name, size }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span className="su-avatar" data-size={size} aria-hidden>
      {initial(name)}
    </span>
  )
}

export function PersonMeta({ p }: { p: SetupPerson }) {
  return (
    <span className="su-meta">
      {meta(p)}
      {p.score === null && (
        <span className="su-badge" data-tone="warning" data-cmp="CMP-005">
          점수 미설정
        </span>
      )}
      {p.guest && (
        <span className="su-badge" data-tone="neutral" data-cmp="CMP-005">
          게스트
        </span>
      )}
    </span>
  )
}

/** CMP-022 확인 창(VD-068) */
export function Dialog({ title, desc, cancel = '취소', ok, tone = 'primary', single = false, onCancel, onOk }: { title: string; desc?: string; cancel?: string; ok: string; tone?: 'primary' | 'danger'; /** (r13) 충돌 알림처럼 '확인' 하나만 */ single?: boolean; onCancel?: () => void; onOk?: () => void }) {
  return (
    <div className="su-dim">
      <div role="alertdialog" aria-modal="true" aria-labelledby="su-dlg-t" data-cmp="CMP-022" className="su-dialog">
        <h2 id="su-dlg-t">{title}</h2>
        {desc && <p>{desc}</p>}
        <div>
          {!single && (
            <button type="button" autoFocus onClick={onCancel}>
              {cancel}
            </button>
          )}
          <button type="button" data-kind={tone} autoFocus={single} onClick={onOk}>
            {ok}
          </button>
        </div>
      </div>
    </div>
  )
}
