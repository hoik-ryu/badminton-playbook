import { AppNav } from '../components/smapsh/AppNav'
import { Screen } from '../components/smapsh/Layout'
import { ListItem } from '../components/smapsh/ListItem'
import { PageHeader } from '../components/smapsh/PageHeader'
import { opsHome } from '../mock/data'

// SCR-201 운영 홈 / SCR-201-ST1 기본 — UX Spec r2(02 SCR-201) + Design Direction r2(VD-001·002·003·019·020·021·022·023)
// (r2) PC·모바일 같은 메뉴 목록 한 열(600px)과 하단 탭. 메뉴 목록은 Flat(VD-024)
// 정보 순서(02 '정보와 우선순위'): 오늘 운동(진행 중 배지) → 명단 → 청백전 관리 → 가입 승인(대기 건수, 0이면 숨김) → 역할 관리(슈퍼 관리자만)
// 이동(02 진입/이탈): SCR-202, SCR-211, SCR-221, SCR-231, SCR-232. 탭 첫 화면이라 헤더에 뒤로 가기 없음(CMP-026 leading=none)
const badgeCls = 'flex h-6 shrink-0 items-center rounded-sm px-2 text-caption font-bold'

export function Scr201({ stateId }: { stateId: string }) {
  const { role, pendingApprovals, todaySessionInProgress } = opsHome
  return (
    <Screen scr="SCR-201" st={stateId} platform="responsive">
      <PageHeader title="운영" leading="none" trailing="none" />
      <main>
        <ul aria-label="운영 메뉴" data-testid="ops-menu" className="border-t border-line">
          <ListItem
            label="오늘 운동"
            to="SCR-202"
            ariaLabel={todaySessionInProgress ? '오늘 운동, 진행 중' : undefined}
            badge={todaySessionInProgress && <span aria-hidden data-cmp="CMP-005" className={`${badgeCls} bg-success-bg text-success-fg`}>진행 중</span>}
          />
          <ListItem label="명단" to="SCR-211" />
          <ListItem label="청백전 관리" to="SCR-221" />
          <ListItem
            label="가입 승인"
            to="SCR-231"
            ariaLabel={pendingApprovals > 0 ? `가입 승인, 대기 ${pendingApprovals}건` : undefined}
            badge={pendingApprovals > 0 && <span aria-hidden data-cmp="CMP-005" className={`${badgeCls} bg-warning-bg tabular-nums text-warning-fg`}>{pendingApprovals}</span>}
          />
          {role === 'superAdmin' && <ListItem label="역할 관리" to="SCR-232" />}
        </ul>
        {/* 스크롤 안전 영역(VD-020): 탭 56 + 안전 영역 + 16 */}
        <div aria-hidden data-testid="scroll-safe-area" className="h-[calc(72px+var(--safe-bottom))]" />
      </main>
      <AppNav active="ops" opsBadge={pendingApprovals} />
    </Screen>
  )
}
