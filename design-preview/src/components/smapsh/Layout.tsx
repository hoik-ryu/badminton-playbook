import type { ReactNode } from 'react'

// 04 1.5·3.1 한 열 원칙(r2, D1) + VD-021: 모든 폭에서 가운데 정렬한 최대 600px(size.content.member) 한 열.
// 열 바깥은 color.bg.page(경계선 없음). 콘텐츠·메뉴·버튼은 열 안에만 둡니다.
export const COLUMN = 'mx-auto w-full max-w-(--size-content-member)'

export function Screen({ scr, st, platform, children }: { scr: string; st: string; platform: 'mobile' | 'responsive'; children: ReactNode }) {
  return (
    <div className="smapsh min-h-full bg-page" data-scr={scr} data-st={st} data-platform={platform}>
      <div className={COLUMN} data-testid="column">
        {children}
      </div>
    </div>
  )
}

// 열 안에 고정되는 하단 요소의 바깥 틀. 바깥 틀은 화면 전체 폭이지만 투명하고 누를 수 없으며, 안쪽만 600px 열에 맞춥니다.
// bottom: 아래에서 위로 안전 영역 → 하단 탭(56) → 고정 행동 바·떠 있는 버튼 순서(04 3.1, VD-020)
export function FixedInColumn({ bottom, z = 'z-10', children, testId }: { bottom: string; z?: string; children: ReactNode; testId?: string }) {
  return (
    <div className={`pointer-events-none fixed inset-x-0 ${z}`} style={{ bottom }} data-testid={testId}>
      <div className={`${COLUMN} pointer-events-auto`}>{children}</div>
    </div>
  )
}

// 하단 탭 위에 놓는 고정 행동 바(SCR-202, SCR-223). 위쪽 구분선 color.border.default, 좌우 여백 16(VD-021)
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <FixedInColumn bottom="calc(56px + var(--safe-bottom))" testId="action-bar">
      <div data-testid="action-bar-inner" className="flex gap-3 border-t border-line bg-page px-4 py-2">{children}</div>
    </FixedInColumn>
  )
}

// 스크롤 끝 여백(VD-020): 고정 요소 높이만큼 비워 마지막 행·카드가 가리지 않게 함
export function ScrollSafeArea({ withBar }: { withBar: boolean }) {
  return <div aria-hidden data-testid="scroll-safe-area" className={withBar ? 'h-[calc(136px+var(--safe-bottom))]' : 'h-[calc(72px+var(--safe-bottom))]'} />
}

// 섹션(VD-022 ① 섹션 사이 space.6, VD-023 h2 = font.size.title·bold, 제목 아래 space.2)
export function Section({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-4">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-title font-bold text-ink">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}
