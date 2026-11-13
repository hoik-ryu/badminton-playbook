import { useLocation, useNavigate } from 'react-router'

// Sheet(components/Sheet.tsx) 보조 훅. URL은 바뀌지 않고 열림 상태를 history state({ sheet })에 둡니다(02 공통: 뒤로 가기로 닫힘).
// (r2) PC 넓은 배치 판단(useIsDesktop·useWideLayout·WideLayoutContext)은 없앴습니다: 모든 셸이 PC·모바일 같은 600px 한 열(D1).

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
