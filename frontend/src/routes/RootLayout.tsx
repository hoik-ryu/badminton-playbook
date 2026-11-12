import { lazy, Suspense, useCallback, useState } from 'react'
import { Outlet } from 'react-router'

import { ToastProvider } from '../components/Toast'
import { initialIntroDecision } from '../features/intro/initialEntry'
import { markIntroSeen } from '../features/intro/introPolicy'
import type { IntroResult } from '../features/intro/IntroOverlay'
import './layouts/shells.css'

// 시네마틱 인트로는 재생할 때만 불러옵니다(최초 방문 1회, introPolicy.ts).
const IntroOverlay = lazy(() => import('../features/intro/IntroOverlay'))

// 앱 최상위: 인트로(Brand Experience) + 토스트. 셸(인증·회원·운영)은 하위 레이아웃 라우트가 정합니다.
export function RootLayout() {
  const [playIntro, setPlayIntro] = useState(initialIntroDecision.play)
  const onFinish = useCallback((result: IntroResult) => {
    if (result !== 'failed') markIntroSeen(safeStorage())
    setPlayIntro(false)
  }, [])
  return (
    <ToastProvider>
      <Outlet />
      {playIntro && (
        <Suspense fallback={null}>
          <IntroOverlay onFinish={onFinish} />
        </Suspense>
      )}
    </ToastProvider>
  )
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
