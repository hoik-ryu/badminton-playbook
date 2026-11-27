import { ChevronsRight, Flag, LoaderCircle, Undo2 } from 'lucide-react'

// CMP-060 RoundProgressCard — UX Spec r11 04 CMP-060, DD r14 VD-083·086, Preview r10 조정안(Rounds.tsx RoundProgressCard)
// 머리 줄: 'n라운드 진행 중' + 오른쪽 '처리 a/b · 취소 c'(남은 경기가 있으면 누르면 첫 경기로) 또는 '라운드 시작 취소'(2라운드 이상·결과·취소 없음)
// 진행 막대 → '다음 라운드 시작'(남은 경기가 있으면 비활성 + '· 남은 경기 n', 화면 읽기 '처리되지 않은 경기 n개').
// 마지막 라운드는 버튼 대신 "마지막 라운드입니다 · 모두 처리하면 청백전을 종료할 수 있습니다". 높이 ≤ 140, 누름 영역 44
type Props = {
  round: number
  /** 처리된 경기(결과 기록 또는 취소) */
  done: number
  total: number
  cancelled: number
  last: boolean
  canUndo: boolean
  busy?: boolean
  onNext: () => void
  onUndo: () => void
  onJump: () => void
}

export function RoundProgressCard({ round, done, total, cancelled, last, canUndo, busy = false, onNext, onUndo, onJump }: Props) {
  const left = total - done
  const count = `처리 ${done}/${total}${cancelled ? ` · 취소 ${cancelled}` : ''}`
  const side = 'inline-flex min-h-11 items-center gap-1 text-caption whitespace-nowrap text-ink-muted tabular-nums focus-visible:outline-2 focus-visible:outline-focus'
  return (
    <section data-cmp="CMP-060" aria-labelledby="rprog-h" data-testid="round-progress" className="flex flex-col gap-2 rounded-md border border-line bg-page p-3">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
        <h2 id="rprog-h" className="m-0 text-title font-bold text-ink">
          {round}라운드 진행 중
        </h2>
        {canUndo ? (
          <button type="button" className={side} onClick={onUndo} disabled={busy} data-testid="undo-round">
            <Undo2 aria-hidden className="size-3.5" />
            라운드 시작 취소
          </button>
        ) : left > 0 ? (
          <button type="button" className={`${side} underline underline-offset-3`} onClick={onJump} aria-label={`${count}, 처리되지 않은 경기 ${left}개로 이동`} data-testid="round-count">
            {count}
          </button>
        ) : (
          <span className={side} data-testid="round-count">
            {count}
          </span>
        )}
      </div>
      <div aria-hidden className="h-1 overflow-hidden rounded-full bg-surface">
        <i className="block h-full bg-action" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      {last ? (
        <p className="m-0 flex items-center gap-1.5 text-caption text-ink-muted" data-testid="last-round">
          <Flag aria-hidden className="size-3.5 shrink-0" />
          마지막 라운드입니다 · 모두 처리하면 청백전을 종료할 수 있습니다
        </p>
      ) : (
        <button
          type="button"
          disabled={left > 0 || busy}
          aria-describedby={left > 0 ? 'rprog-why' : undefined}
          aria-busy={busy || undefined}
          onClick={onNext}
          data-testid="next-round"
          className="flex h-11 items-center justify-center gap-1.5 rounded-md bg-action text-body font-bold text-on-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-disabled"
        >
          {busy ? <LoaderCircle aria-hidden className="size-4.5 animate-spin" /> : <ChevronsRight aria-hidden className="size-4.5" />}
          다음 라운드 시작
          {left > 0 && (
            <>
              <small aria-hidden className="text-caption font-normal">
                · 남은 경기 {left}
              </small>
              <span id="rprog-why" className="sr-only">
                처리되지 않은 경기 {left}개
              </span>
            </>
          )}
        </button>
      )}
    </section>
  )
}
