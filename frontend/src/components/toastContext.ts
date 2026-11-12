import { createContext, useContext } from 'react'

// CMP-029 Toast 호출 함수(ToastProvider가 값을 채움). 사용: const toast = useToast(); toast('저장했습니다')
export type ToastTone = 'success' | 'neutral'
export const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {})
export const useToast = () => useContext(ToastContext)
