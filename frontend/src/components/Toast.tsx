import { cn } from 'cn'
import { CircleCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ToastContext, type ToastTone } from './toastContext'

// CMP-029 Toast — 04: tone=success|neutral, 표시 3초 후 사라짐. 접근성: role="status", 행동 버튼을 넣지 않음.
// 위치: 화면 위쪽(헤더 아래) — 하단 탭·하단 고정 버튼·떠 있는 버튼과 겹치지 않게. PC는 가운데 열 안(.app-fixed-bar)
type ToastItem = { id: number; message: string; tone: ToastTone }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null)
  const seq = useRef(0)
  const show = useCallback((message: string, tone: ToastItem['tone'] = 'success') => setItem({ id: ++seq.current, message, tone }), [])
  useEffect(() => {
    if (!item) return
    const t = setTimeout(() => setItem(null), 3000)
    return () => clearTimeout(t)
  }, [item])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="app-fixed-bar pointer-events-none top-[calc(64px+env(safe-area-inset-top,0px))] z-40 flex justify-center px-4">
        {item && (
          <div key={item.id} data-cmp="CMP-029" className={cn('flex min-h-12 items-center gap-2 rounded-md px-4 py-2 text-body shadow-sheet', 'bg-ink text-page')}>
            {item.tone === 'success' && <CircleCheck aria-hidden className="size-5 shrink-0" />}
            {item.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
