import { Ban, Layers, LoaderCircle } from 'lucide-react'

import { NoticeBox } from '../../../components/NoticeBox'
import { Sheet } from '../../../components/Sheet'
import type { MoveOption } from './pick'

// SCR-244-ST20 라운드 이동 시트 — UX Spec r11 02 SCR-244 ST20, UXD-108, DD r14 VD-081, Preview r11(Rounds.tsx RoundMoveSheet)
// 하단 시트(CMP-021 height=content) 제목 "n경기를 옮길 라운드", 다른 라운드 목록: 'n라운드 · 빈 코트 a'.
// 선택 불가 행은 흐리게 + 사유('빈 코트 없음' / '출전 겹침: 이름, 이름'), 포커스 가능. 지금 라운드는 목록에 없음.
// 누르면 그 행 진행 표시·다른 행 잠금(저장 중), 실패하면 시트 안 안내 상자(공통 NoticeBox danger) + '다시 시도'(대진 그대로). 충돌은 부모가 시트를 닫고 ST6.
// 행은 원장 POL-003 결정대로 생성 페이지 전용 행(CMP-030 표현, 선수 선택 시트 행 표현 재사용)

type Props = {
  no: number
  options: MoveOption[]
  busyRound: number | null
  error?: string | null
  onRetry?: () => void
  onPick: (round: number) => void
  onClose: () => void
}

export function RoundMoveSheet({ no, options, busyRound, error, onRetry, onPick, onClose }: Props) {
  return (
    <Sheet open title={`${no}경기를 옮길 라운드`} onRequestClose={onClose} testId="move-sheet">
      <div data-scr="SCR-244" data-st="SCR-244-ST20" className="su-pickwrap">
        {error && (
          <NoticeBox
            tone="danger"
            action={
              onRetry && (
                <button type="button" className="su-link" onClick={onRetry}>
                  다시 시도
                </button>
              )
            }
          >
            {error}
          </NoticeBox>
        )}
        {options.length === 0 && <p className="su-dist m-0">옮길 수 있는 다른 라운드가 없습니다</p>}
        <ul className="su-list" aria-label="옮길 라운드">
          {options.map((o) => (
            <RoundMoveRow key={o.round} o={o} busy={busyRound === o.round} locked={busyRound !== null} onPick={onPick} />
          ))}
        </ul>
      </div>
    </Sheet>
  )
}

/** 라운드 행(생성 페이지 전용, POL-003): 선택 가능 / 선택 불가(흐림·사유·포커스 가능) / 저장 중 */
function RoundMoveRow({ o, busy, locked, onPick }: { o: MoveOption; busy: boolean; locked: boolean; onPick: (round: number) => void }) {
  const off = !!o.reason
  return (
    <li>
      <button
        type="button"
        className="su-row su-pick"
        data-state={off ? 'off' : 'ok'}
        data-busy={busy || undefined}
        aria-disabled={off || locked || undefined}
        aria-label={off ? `${o.round}라운드, 선택할 수 없음: ${o.reason}` : `${o.round}라운드, 빈 코트 ${o.free}`}
        onClick={() => !off && !locked && onPick(o.round)}
        data-testid="move-row"
      >
        <span className="su-avatar" aria-hidden style={{ background: 'transparent', border: 0 }}>
          <Layers style={{ width: 20, height: 20, color: 'var(--color-text-secondary)' }} />
        </span>
        <span className="su-who">
          <span className="su-name" data-bold="true">
            {o.round}라운드
          </span>
          {off ? (
            <span className="su-meta su-off-reason">
              <Ban aria-hidden />
              {o.reason}
            </span>
          ) : (
            <span className="su-meta">빈 코트 {o.free}</span>
          )}
        </span>
        {busy && (
          <span className="su-num" aria-hidden>
            <LoaderCircle className="su-spin" />
          </span>
        )}
      </button>
    </li>
  )
}
