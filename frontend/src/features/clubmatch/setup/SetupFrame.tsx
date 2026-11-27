import { ChevronLeft, MoreVertical } from 'lucide-react'
import type { ReactNode } from 'react'

import { StepProgress, type StepItem } from '../../../components/StepProgress'
import { BrandLogo, SHUTTLE_URL } from './parts'
import { OverflowMenu } from '../../../components/OverflowMenu'

// 생성 페이지 공통 틀(SCR-241–245) — UX Spec r9 02 '생성 페이지 공통'·04 3.3, Design Direction r12 VD-059–063·068–070, Preview r8
// 머리글(뒤로 = 나가기 · 가운데 로고 · 오른쪽 더보기(만든 뒤 모든 단계, 2026-11-27)) → 히어로(라벨·제목·설명 + AST-046 + CSS 코트 빛) →
// 카드(진행 표시 CMP-053 + 단계 내용) → 하단 이전·다음(CMP-054, 탭바 숨김). 2단계부터 히어로를 줄임(VD-069·목록 밀도 목표)
type Props = {
  scr: string
  st: string
  method: string
  title: string
  desc: string
  compact?: boolean
  steps: StepItem[] | null
  current: string
  onStep?: (key: string) => void
  onExit: () => void
  /** (CP-001) 더보기 → '청백전 삭제'. 단계 화면은 frame.onMore를 그대로 넘김(만든 뒤 모든 단계) */
  onMore?: () => void
  /** 페이지가 넘기는 삭제 실패 안내(frame.moreNotice) */
  moreNotice?: ReactNode
  /** 카드 위쪽 안내 상자 자리(저장 실패 등) */
  notice?: ReactNode
  children: ReactNode
  bar?: ReactNode
  overlay?: ReactNode
}

export function SetupFrame({ scr, st, method, title, desc, compact = false, steps, current, onStep, onExit, onMore, moreNotice, notice, children, bar, overlay }: Props) {
  return (
    <div className="su cm-page flex w-full flex-1 flex-col" data-scr={scr} data-st={st} data-method={method}>
      <header className="su-head" data-part="SetupHeader">
        <button type="button" className="su-icon-btn" aria-label="나가기(청백전 목록)" onClick={onExit}>
          <ChevronLeft aria-hidden className="size-6" />
        </button>
        <BrandLogo />
        {onMore ? (
          // (CP-001, UXD-114·VD-068) 기존 아이콘 버튼 자리 그대로, 누르면 더보기 메뉴의 '청백전 삭제'(위험 톤)
          <OverflowMenu label="더보기" icon={<MoreVertical aria-hidden className="size-5" />} triggerClassName="su-icon-btn" items={[{ label: '청백전 삭제', tone: 'danger', onSelect: onMore }]} />
        ) : (
          <span aria-hidden />
        )}
      </header>
      <section className="su-hero" data-compact={compact} aria-labelledby={`${scr}-title`}>
        <div aria-hidden className="su-hero-court" />
        <img className="su-shuttle" src={SHUTTLE_URL} alt="" aria-hidden data-asset="AST-046" />
        <div className="su-hero-text">
          <span className="su-eyebrow">청백전 생성</span>
          <h1 id={`${scr}-title`} className="su-title" tabIndex={-1}>
            {title}
          </h1>
          <p className="su-desc">{desc}</p>
        </div>
      </section>
      <div className="su-card" data-testid="su-card">
        <StepProgress steps={steps} current={current} onSelect={onStep} />
        <div className="su-body">
          {moreNotice}
          {notice}
          {children}
        </div>
      </div>
      <div className="su-spacer" aria-hidden data-testid="scroll-safe-area" />
      {bar}
      {overlay}
    </div>
  )
}
