import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

// CMP-021 Sheet 보조 훅. URL은 바뀌지 않고 열림 상태를 history state({ sheet })에 둡니다(02 공통: 뒤로 가기로 닫힘).

/** PC(≥1024, 04 breakpoint.desktop) 여부 */
export function useIsDesktop() {
  const query = '(min-width: 1024px)'
  const get = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [desktop, setDesktop] = useState(get)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}

/**
 * 넓은 PC 배치(옆 패널·2열 등)를 쓸 수 있는 셸인지. 운영 셸은 회원 셸처럼 PC에서도 모바일 폭 한 열 + 하단 탭이라 false
 * (사용자 결정 2026-11-12, 04 1.5·UXD-066과 다름 → docs/workflow-proposals/frontend-implementation-deviations.md)
 */
export const WideLayoutContext = createContext(true)

/** 화면 배치용 PC 여부(넓은 배치를 허용하는 셸에서만 true). 시트를 PC에서 가운데 창으로 띄우는 판단은 useIsDesktop 그대로 */
export function useWideLayout() {
  const desktop = useIsDesktop()
  return useContext(WideLayoutContext) && desktop
}

/** 시트 열림 상태 = history state.sheet. 열기는 같은 주소로 push(이미 열린 시트에서 대상만 바꾸면 replace, 시트 위 시트는 stack으로 push), 닫기는 뒤로 가기 */
export function useSheetRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const sheet = (location.state as { sheet?: string } | null)?.sheet ?? null
  const open = (id: string, opts?: { stack?: boolean }) => navigate(location.pathname + location.search, { state: { sheet: id }, replace: sheet !== null && !opts?.stack })
  const close = () => {
    // 새로고침 등으로 첫 기록에 시트 상태가 남은 경우 뒤로 가면 화면을 떠나므로 교체로 닫음
    if (location.key === 'default') navigate(location.pathname + location.search, { replace: true, state: null })
    else navigate(-1)
  }
  return { sheet, open, close }
}
