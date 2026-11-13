import { cn } from 'cn'
import { CircleUserRound, ClipboardList, GraduationCap, Swords, type LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'

import type { Role } from '../features/auth/types'

// CMP-025 AppNav — 04 r2: 하단 탭바(튜토리얼 / 청백전 / 마이페이지 / 운영), layout=bottom만(PC·모바일 공통, UXD-066 r6). r1의 PC 왼쪽 메뉴는 없앰.
// VD-019: Lucide 24px, 글자 레이블 유지, 현재 탭 = color.action.primary + 굵은 글자 + 위쪽 표시 막대. 탭 높이 56 + 안전 영역(VD-020).
// 접근성: nav + aria-current="page"(NavLink), 배지 수를 레이블에 포함.
type Tab = { to: string; label: string; Icon: LucideIcon; match: (path: string) => boolean }

const MEMBER_TABS: Tab[] = [
  { to: '/tutorial', label: '튜토리얼', Icon: GraduationCap, match: (p) => p.startsWith('/tutorial') },
  { to: '/club-matches', label: '청백전', Icon: Swords, match: (p) => p.startsWith('/club-matches') },
  { to: '/me', label: '마이페이지', Icon: CircleUserRound, match: (p) => p.startsWith('/me') },
]
const OPS_TAB: Tab = { to: '/ops', label: '운영', Icon: ClipboardList, match: (p) => p.startsWith('/ops') }

const isAdminRole = (role: Role) => role === 'admin' || role === 'superAdmin'

export function AppNav({ role, opsBadge, className }: { role: Role; opsBadge?: number; className?: string }) {
  const { pathname } = useLocation()
  const tabs = isAdminRole(role) ? [...MEMBER_TABS, OPS_TAB] : MEMBER_TABS
  const count = opsBadge && opsBadge > 0 ? opsBadge : 0

  return (
    <nav aria-label="주 메뉴" data-cmp="CMP-025" data-layout="bottom" className={cn('app-fixed-bar bottom-0 z-30 bg-page pb-[env(safe-area-inset-bottom,0px)]', className)}>
      <ul className="m-0 flex h-14 list-none border-t border-line p-0">
        {tabs.map(({ to, label, Icon, match }) => {
          const on = match(pathname)
          const badge = to === '/ops' ? count : 0
          return (
            <li key={to} className="relative flex-1">
              {on && <span aria-hidden className="absolute inset-x-0 top-0 mx-auto h-[3px] w-8 rounded-b-sm bg-action" />}
              <NavLink to={to} aria-current={on ? 'page' : undefined} aria-label={badge ? `${label}, 승인 대기 ${badge}건` : undefined}
                className={cn('flex h-full flex-col items-center justify-center gap-0.5 no-underline', on ? 'font-bold text-action' : 'text-ink-muted')}>
                <span className="relative">
                  <Icon aria-hidden className="size-6" />
                  {badge > 0 && <span aria-hidden data-cmp="CMP-005" className="absolute top-0 left-4 flex h-5 min-w-5 items-center justify-center rounded-sm bg-warning-bg px-1 text-caption leading-none font-bold tabular-nums text-warning-fg">{badge}</span>}
                </span>
                <span className="text-caption">{label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
