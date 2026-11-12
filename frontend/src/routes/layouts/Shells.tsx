import { Outlet, useLoaderData, useMatches } from 'react-router'

import { AppNav } from '../../components/AppNav'
import { WideLayoutContext } from '../../components/sheetHooks'
import type { ShellData } from '../guards'

export type RouteHandle = { hideNav?: boolean }

// 인증 셸(SCR-001–005): 한 열, 탭 없음. PC·태블릿은 가운데 600px 열
export function AuthShell() {
  return (
    <div className="app-column" data-shell="auth">
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

// 회원 셸(SCR-101·111·112·121): 하단 탭. 102·103은 탭바 숨김(handle.hideNav). PC도 600px 열 + 하단 탭(사용자 결정)
export function MemberShell() {
  const { me, opsBadge } = useLoaderData() as ShellData
  const hideNav = useMatches().some((m) => (m.handle as RouteHandle | undefined)?.hideNav)
  return (
    <div className="app-column" data-shell="member">
      <main className={hideNav ? 'app-main' : 'app-main has-nav'}>
        <Outlet />
      </main>
      {!hideNav && <AppNav role={me.role} opsBadge={opsBadge} />}
    </div>
  )
}

// 운영 셸(SCR-201–232): 회원 셸과 같은 600px 열 + 하단 탭. PC도 같음(왼쪽 메뉴 없음)
// 사용자 결정 2026-11-12: 04 1.5·UXD-066의 'PC 왼쪽 메뉴 240 + 가운데 최대 1200'과 다름(UX Spec r2 반영 예정)
export function OpsShell() {
  const { me, opsBadge } = useLoaderData() as ShellData
  return (
    <WideLayoutContext.Provider value={false}>
      <div className="app-column" data-shell="ops">
        <main className="app-main has-nav">
          <Outlet />
        </main>
        <AppNav role={me.role} opsBadge={opsBadge} />
      </div>
    </WideLayoutContext.Provider>
  )
}
