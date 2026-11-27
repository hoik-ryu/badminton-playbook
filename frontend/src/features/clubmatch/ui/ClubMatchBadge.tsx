import type { ComponentProps, ReactNode } from 'react'

// 청백전 영역 전용 UI 기반(1단계) — 공통 components/Badge(CMP-005 일반 톤, 사각 24px)는 바꾸지 않고, 청백전 화면에서만 쓰는 표현을 따로 둡니다.
// 스타일: src/styles/clubmatch.css(.cm 범위 안에서만 적용)

/** 청백전 화면 루트. 이 안에서만 청백전 배지·카드·배너 스타일이 적용됩니다(VD-049·053, 색은 앱 전체 토큰) */
export function ClubMatchScope({ className, ...props }: ComponentProps<'div'>) {
  return <div className={className ? `cm ${className}` : 'cm'} {...props} />
}

/** VD-053 톤: 상태(진행 중·진행 예정·준비 중·종료)와 방식(팀전·개인전). 표시 상태는 UXD-087 계산 결과이며 DB 상태값과 다릅니다 */
export type ClubMatchBadgeTone = 'live' | 'upcoming' | 'pending' | 'ended' | 'teamBlue' | 'individual'

/** CMP-005 청백전 배지 — 알약 22px, 항상 글자를 포함(색만으로 구분하지 않음). .cm 안에서 써야 합니다 */
export function ClubMatchBadge({ tone, children }: { tone: ClubMatchBadgeTone; children: ReactNode }) {
  return (
    <span className="cm-badge" data-cmp-variant="CMP-005" data-tone={tone}>
      {children}
    </span>
  )
}

/** '운영진에게만 보임' 칩(준비 중 카드, VD-053) */
export function OpsOnlyChip() {
  return <span className="cm-ops-chip">운영진에게만 보임</span>
}
