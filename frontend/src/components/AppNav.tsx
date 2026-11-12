import { cn } from 'cn'
import { CircleUserRound, ClipboardList, GraduationCap, Swords, type LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'

import type { Role } from '../features/auth/types'

// CMP-025 AppNav — 04: 하단 탭바(튜토리얼 / 청백전 / 마이페이지 / 운영)와 PC 왼쪽 메뉴(UXD-066), role에 따라 운영 탭·역할 관리 노출.
// VD-019: Lucide 24px, 글자 레이블 유지, 현재 탭 = color.action.primary + 굵은 글자 + 위쪽 표시 막대. 탭 높이 56 + 안전 영역(VD-020).
// 접근성: nav + aria-current="page"(NavLink), 배지 수를 레이블에 포함.
type Tab = { to: string; label: string; Icon: LucideIcon; match: (path: string) => boolean }

const MEMBER_TABS: Tab[] = [
  { to: '/tutorial', label: '튜토리얼', Icon: GraduationCap, match: (p) => p.startsWith('/tutorial') },
  { to: '/club-matches', label: '청백전', Icon: Swords, match: (p) => p.startsWith('/club-matches') },
  { to: '/me', label: '마이페이지', Icon: CircleUserRound, match: (p) => p.startsWith('/me') },
]
const OPS_TAB: Tab = { to: '/ops', label: '운영', Icon: ClipboardList, match: (p) => p.startsWith('/ops') }

// PC 왼쪽 메뉴의 '운영' 묶음(02 SCR-201 진입/이탈, 01 운영 화면)
const OPS_LINKS = [
  { to: '/ops/session', label: '오늘 운동' },
  { to: '/ops/roster', label: '명단' },
  { to: '/ops/club-matches', label: '청백전 관리' },
  { to: '/ops/approvals', label: '가입 승인', badge: true },
  { to: '/ops/roles', label: '역할 관리', superOnly: true },
] as const

const isAdminRole = (role: Role) => role === 'admin' || role === 'superAdmin'

export function AppNav({ role, layout = 'bottom', opsBadge, className }: { role: Role; layout?: 'bottom' | 'side'; opsBadge?: number; className?: string }) {
  const { pathname } = useLocation()
  const tabs = isAdminRole(role) ? [...MEMBER_TABS, OPS_TAB] : MEMBER_TABS
  const count = opsBadge && opsBadge > 0 ? opsBadge : 0

  if (layout === 'side') {
    return (
      <nav aria-label="주 메뉴" data-cmp="CMP-025" data-layout="side" className={cn('flex flex-col gap-1 p-3', className)}>
        {tabs.map(({ to, label, Icon, match }) => {
          const on = to === '/ops' ? pathname === '/ops' : match(pathname)
          return (
            <NavLink key={to} to={to} end={to === '/ops'} aria-current={on ? 'page' : undefined} aria-label={to === '/ops' && count ? `${label}, 승인 대기 ${count}건` : undefined}
              className={cn('flex h-11 items-center gap-3 rounded-md px-3 text-body no-underline', on ? 'bg-surface font-bold text-action' : 'text-ink')}>
              <Icon aria-hidden className="size-6 shrink-0" />
              <span className="flex-1">{to === '/ops' ? '운영 홈' : label}</span>
              {to === '/ops' && count > 0 && <span aria-hidden data-cmp="CMP-005" className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-warning-bg px-1 text-caption leading-none font-bold tabular-nums text-warning-fg">{count}</span>}
            </NavLink>
          )
        })}
        {isAdminRole(role) && (
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 border-t border-line p-0 pt-2" aria-label="운영 바로가기">
            {OPS_LINKS.filter((l) => !('superOnly' in l) || role === 'superAdmin').map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className={({ isActive }) => cn('flex h-11 items-center rounded-md pr-3 pl-12 text-body no-underline', isActive ? 'bg-surface font-bold text-action' : 'text-ink')}>
                  <span className="flex-1">{l.label}</span>
                  {'badge' in l && count > 0 && <span aria-label={`대기 ${count}건`} className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-warning-bg px-1 text-caption leading-none font-bold tabular-nums text-warning-fg">{count}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </nav>
    )
  }

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
