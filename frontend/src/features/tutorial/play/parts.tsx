// SCR-102 화면 부품 — design-preview/src/screens/SCR-102.tsx(Preview r3 승인, DD r6 VD-044)의 상단 바·단계·질문·재생·판정·버튼을 옮김.
// 바뀐 점: 상황 수를 받도록(5 고정 → total). 모양·크기·색은 Preview와 같음
import { ArrowRight, Check, ChevronRight, Play, Search, Waves, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

// 상단 바(CMP-026 close): 경기장 위 어두운 띠 + 흰 글자. 상황 진행 n/5·점수, 재도전 표시
export function TopBar({ course, step, goal, index, total = 5, score, retry, onExit }: { course: string; step: number; goal: string; index: number; total?: number; score: number; retry?: boolean; onExit?: () => void }) {
  return (
    <header data-cmp="CMP-026" data-variant="close" className="relative z-[1] flex items-center gap-1.5 pr-3 pl-1 text-on-action">
      <button type="button" onClick={onExit} className="flex h-11 shrink-0 items-center gap-0.5 rounded-md px-2 text-caption font-bold">
        <X aria-hidden className="size-5" />
        나가기
      </button>
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-body font-bold tracking-tight">{course} · {step}단계</span>
        <span className="truncate text-caption opacity-90">{goal}</span>
      </span>
      {retry && <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-caption font-bold whitespace-nowrap text-warning-fg">재도전 · 0점</span>}
      <span className="pl-pill inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-bold whitespace-nowrap tabular-nums">
        <span>상황 {index}/{total}</span>
        <span aria-hidden className="h-3 w-px bg-current opacity-50" />
        <span>{score}점</span>
      </span>
    </header>
  )
}

// 상황 진행 5단계(장식, 숫자 '상황 n/5'를 헤더에 늘 함께 표시)
export function Steps({ index, total = 5 }: { index: number; total?: number }) {
  return (
    <ol aria-hidden className="relative z-[1] mx-auto flex w-full max-w-[280px] items-center px-6 pb-2">
      {Array.from({ length: total }, (_, k) => k + 1).map((n) => (
        <li key={n} className="flex flex-1 items-center last:flex-none">
          <span className={`grid size-[22px] shrink-0 place-items-center rounded-full text-caption leading-none font-bold tabular-nums ${n < index ? 'bg-action text-on-action' : n === index ? 'bg-page text-ink-accent ring-2 ring-mint' : 'pl-step-next'}`}>
            {n < index ? <Check className="size-3.5" strokeWidth={3} /> : n}
          </span>
          {n < total && <span className={`mx-1 h-[3px] flex-1 rounded-full ${n < index ? 'bg-action' : 'pl-step-line'}`} />}
        </li>
      ))}
    </ol>
  )
}

export function Question({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint-subtle text-ink-accent"><Search aria-hidden className="size-5" /></span>
      <div className="grid gap-0.5">
        {hint && <p className="text-caption font-bold text-ink-accent">{hint}</p>}
        <p className="text-title font-bold tracking-tight">{text}</p>
      </div>
    </div>
  )
}

// 상황 재생 중 아래 시트: 재생 진행 + 건너뛰기 안내(02에 표시 정보 정의 없음 → 상태 안내만, 보고 대상)
export function Playback({ ms = 1100 }: { ms?: number }) {
  const [go, setGo] = useState(false)
  useEffect(() => { const t = window.setTimeout(() => setGo(true), 30); return () => window.clearTimeout(t) }, [])
  return (
    <div role="status" className="grid gap-2 pt-1">
      <p className="flex items-center gap-2 text-body font-bold"><Play aria-hidden className="size-5 fill-current text-action" />상황 재생 중</p>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface"><i className="block h-full rounded-full bg-action transition-[width] ease-linear motion-reduce:transition-none" style={{ width: go ? '100%' : '0%', transitionDuration: `${ms}ms` }} /></span>
      <p className="text-caption text-ink-muted">코트를 누르면 건너뛸 수 있어요</p>
    </div>
  )
}

export const TONE = {
  ok: { Icon: Check, title: 'text-success-fg', bg: 'bg-success-bg' },
  allow: { Icon: Waves, title: 'text-warning-fg', bg: 'bg-warning-bg' },
  bad: { Icon: X, title: 'text-danger-fg', bg: 'bg-danger-bg' },
} as const

export function Judge({ kind, title, reason, onRetry, onNext, nextLabel = '다음 상황' }: { kind: keyof typeof TONE; title: string; reason: string; onRetry?: () => void; onNext?: () => void; nextLabel?: string }) {
  const t = TONE[kind]
  const trail = onRetry || onNext
  return (
    <div role="status" className="grid gap-0.5">
      <div className={`flex items-center gap-2 text-title font-bold ${t.title}`}>
        <span className={`grid size-8 place-items-center rounded-full ${t.bg}`}>
          <t.Icon aria-hidden className="size-5" strokeWidth={2.6} />
        </span>
        <span className="flex-1">{title}</span>
        {trail && (
          <span className="-my-2 -mr-2 flex">
            {onRetry && <TextBtn onClick={onRetry}>다시 도전</TextBtn>}
            {onNext && <TextBtn onClick={onNext} icon={<ArrowRight aria-hidden className="size-4" />}>{nextLabel}</TextBtn>}
          </span>
        )}
      </div>
      <p className="max-h-[2.8em] overflow-y-auto text-caption leading-snug text-ink-muted">{reason}</p>
    </div>
  )
}

const btnBase = 'flex h-14 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 font-bold whitespace-nowrap'
export function Cta({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} data-cmp="CMP-001" data-variant="primary-lg" className={`${btnBase} pl-cta bg-action text-heading tracking-tight text-on-action`}>{children}<ChevronRight aria-hidden className="size-6" /></button>
}
export function Outline({ children, icon, onClick }: { children: ReactNode; icon?: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} data-cmp="CMP-001" data-variant="outline" className={`${btnBase} border-[1.5px] border-ink-accent bg-page text-body text-ink-accent`}>{icon}{children}</button>
}
export function Chip({ children, icon, pressed, onClick }: { children: ReactNode; icon: ReactNode; pressed?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={pressed} data-cmp="CMP-001" data-variant="chip" className={`${btnBase} text-caption text-ink-accent ${pressed ? 'border-[1.5px] border-ink-accent bg-mint-subtle' : 'bg-mint-subtle'}`}>{icon}{children}</button>
}
function TextBtn({ children, icon, onClick }: { children: ReactNode; icon?: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} data-cmp="CMP-001" data-variant="text" className="flex h-11 items-center gap-0.5 rounded-md px-2 text-caption font-bold text-ink-accent">{children}{icon}</button>
}

