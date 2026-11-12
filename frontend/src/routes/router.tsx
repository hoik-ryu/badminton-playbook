import { createBrowserRouter, type RouteObject } from 'react-router'

import { DevHealthPage } from '../pages/DevHealthPage'
import { AccountStatusPage } from '../pages/AccountStatusPage'
import { ClubMatchesPage } from '../pages/ClubMatchesPage'
import { ClubMatchPage } from '../pages/ClubMatchPage'
import { ApprovalsPage } from '../pages/ApprovalsPage'
import { DevToolsPage } from '../pages/DevToolsPage'
import { ForbiddenPage } from '../pages/ForbiddenPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { OpsHomePage } from '../pages/OpsHomePage'
import { RolesPage } from '../pages/RolesPage'
import { RosterPage } from '../pages/RosterPage'
import { MemberClubMatchesPage } from '../pages/MemberClubMatchesPage'
import { MemberClubMatchPage } from '../pages/MemberClubMatchPage'
import { MyPage } from '../pages/MyPage'
import { SessionPage } from '../pages/SessionPage'
import { StagePlayPage } from '../pages/StagePlayPage'
import { StageResultPage } from '../pages/StageResultPage'
import { SignupPage } from '../pages/SignupPage'
import { TutorialHomePage } from '../pages/TutorialHomePage'
import {
  adminLoader,
  indexLoader,
  loginLoader,
  memberLoader,
  restrictedOnlyLoader,
  rootLoader,
  signedInLoader,
  signupLoader,
  superAdminLoader,
} from './guards'
import { AuthShell, MemberShell, OpsShell, type RouteHandle } from './layouts/Shells'
import { Empty } from './Empty'
import { RootLayout } from './RootLayout'

// 라우트는 UX Spec r1 01 IA 3장(화면·경로)을 따릅니다. B0–B6로 모든 화면을 연결했습니다(PendingScreen은 새 화면을 먼저 연결할 때 다시 씀).
// 시트·패널 화면(SCR-122, 203–205, 212–214, 222, 224–226)은 URL이 없고 부모 화면 안에서 열립니다(02 공통).
const hideNav: RouteHandle = { hideNav: true }

export const routes: RouteObject[] = [
  {
    id: 'root',
    path: '/',
    element: <RootLayout />,
    loader: rootLoader,
    HydrateFallback: Empty, // 첫 loader 동안 비워 둠(인트로·셸은 loader 뒤에 그림)
    children: [
      { index: true, loader: indexLoader, Component: Empty }, // 항상 리다이렉트
      {
        element: <AuthShell />,
        children: [
          { path: 'login', loader: loginLoader, element: <LoginPage /> },
          { path: 'signup', loader: signupLoader, element: <SignupPage /> },
          { path: 'account-status', loader: restrictedOnlyLoader, element: <AccountStatusPage /> },
          { path: 'forbidden', loader: signedInLoader, element: <ForbiddenPage /> },
        ],
      },
      {
        id: 'member',
        loader: memberLoader,
        element: <MemberShell />,
        children: [
          { path: 'tutorial', element: <TutorialHomePage /> },
          { path: 'tutorial/stages/:stageId', handle: hideNav, element: <StagePlayPage /> },
          { path: 'tutorial/stages/:stageId/result', handle: hideNav, element: <StageResultPage /> },
          { path: 'club-matches', element: <MemberClubMatchesPage /> },
          { path: 'club-matches/:matchId', element: <MemberClubMatchPage /> },
          { path: 'me', element: <MyPage /> },
        ],
      },
      {
        id: 'ops',
        path: 'ops',
        loader: adminLoader,
        element: <OpsShell />,
        children: [
          { index: true, element: <OpsHomePage /> },
          { path: 'session', element: <SessionPage /> },
          { path: 'roster', element: <RosterPage /> },
          { path: 'club-matches', element: <ClubMatchesPage /> },
          { path: 'club-matches/:matchId', element: <ClubMatchPage /> },
          { path: 'approvals', element: <ApprovalsPage /> },
          { path: 'roles', loader: superAdminLoader, element: <RolesPage /> },
        ],
      },
      // 개발용(서비스 화면 아님)
      { path: 'dev/health', element: <DevHealthPage /> },
      {
        element: <AuthShell />,
        children: [...(import.meta.env.DEV ? [{ path: 'dev', element: <DevToolsPage /> }] : []), { path: '*', element: <NotFoundPage /> }],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
