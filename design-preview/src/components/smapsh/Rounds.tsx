import { Ban, ChevronDown, ChevronUp, ChevronsRight, Flag, Layers, LoaderCircle, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Sheet } from './Sheet'
import { complete, filled, roundsOf, type EGame } from '../../mock/editor'
import { person } from '../../mock/setup'

// (r14) 라운드·코트 공통 부품 — UX Spec r11 04 CMP-059·060 / DD r14 VD-079·081·083
// RoundHead: 카드로 감싸지 않는 높이 40 머리글(라운드 · 코트 사용 · 출전·휴식 · 접기). 휴식 글자를 누르면 휴식자 칩
// RoundMoveSheet: 라운드 이동 시트(빈 코트 없음·출전 겹침은 선택 불가 + 사유)
// RoundProgressCard: SCR-112 운영진 진행 라운드 카드(처리 a/b · 진행 막대 · '다음 라운드 시작' · '라운드 시작 취소')

export function RoundHead({
  id,
  round,
  caption,
  restLabel,
  restNames,
  restOpen,
  onRest,
  folded,
  onFold,
  tags,
  status,
  current,
}: {
  id: string
  round: number
  caption: string
  restLabel?: string
  restNames?: string[]
  restOpen?: boolean
  onRest?: () => void
  folded: boolean
  onFold: () => void
  tags?: ReactNode
  /** phase=live 상태 배지 */
  status?: ReactNode
  /** 진행 중 라운드(왼쪽 세로 띠) */
  current?: boolean
}) {
  return (
    <>
      <div className="su-rhead" data-current={current || undefined} data-testid="round-head">
        <h3 id={id} className="su-rtitle">
          {round}라운드
          {status}
        </h3>
        <span className="su-rcap">
          {caption}
          {restLabel &&
            (onRest ? (
              <button type="button" className="su-rest" aria-expanded={!!restOpen} onClick={onRest} aria-label={`${round}라운드 ${restLabel}, 휴식자 ${restOpen ? '접기' : '보기'}`}>
                {restLabel}
                <ChevronDown aria-hidden data-open={restOpen || undefined} />
              </button>
            ) : (
              restLabel
            ))}
          {tags}
        </span>
        <button type="button" className="su-rfold" aria-expanded={!folded} aria-label={`${round}라운드 ${folded ? '펼치기' : '접기'}`} onClick={onFold}>
          {folded ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
        </button>
      </div>
      {restOpen && restNames && (
        <div className="su-restnames" aria-label={`${round}라운드 휴식자`}>
          {restNames.length ? restNames.map((n) => <span key={n} className="su-cnt">{n}</span>) : <span className="su-dist">휴식자 없음</span>}
        </div>
      )}
    </>
  )
}

/** 라운드 이동 판정(VD-081): 빈 코트 없음 / 출전 겹침 */
export function moveOptions(games: EGame[], key: number, courts: number) {
  const g = games.find((x) => x.key === key)!
  const people = filled(g)
  return roundsOf(games)
    .filter((r) => r.round !== g.round)
    .map((r) => {
      const overlap = r.games.filter(complete).flatMap(filled).filter((id) => people.includes(id))
      const free = courts - r.games.length
      return { round: r.round, free, reason: free <= 0 ? '빈 코트 없음' : overlap.length ? `출전 겹침: ${overlap.map((id) => person(id).name).join(', ')}` : undefined }
    })
}

export function RoundMoveSheet({ games, gameKey, courts, busyRound, onPick, onClose }: { games: EGame[]; gameKey: number; courts: number; busyRound: number | null; onPick: (round: number) => void; onClose: () => void }) {
  const sorted = [...games].sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
  const no = sorted.findIndex((g) => g.key === gameKey) + 1
  const opts = moveOptions(games, gameKey, courts)
  return (
    <Sheet title={`${no}경기를 옮길 라운드`} testId="move-sheet" onClose={onClose}>
      <ul className="su-list" data-cmp="CMP-030">
        {opts.map((o) => {
          const off = !!o.reason
          const busy = busyRound === o.round
          return (
            <li key={o.round}>
              <button
                type="button"
                className="su-row su-pick"
                data-state={off ? 'off' : 'ok'}
                aria-disabled={off || busyRound !== null || undefined}
                aria-label={off ? `${o.round}라운드, 선택할 수 없음: ${o.reason}` : `${o.round}라운드, 빈 코트 ${o.free}`}
                onClick={() => !off && busyRound === null && onPick(o.round)}
              >
                <span className="su-avatar" aria-hidden style={{ background: 'transparent', border: 0 }}>
                  <Layers style={{ width: 20, height: 20, color: 'var(--color-text-secondary)' }} />
                </span>
                <span className="su-who">
                  <span className="su-name" data-bold="true">{o.round}라운드</span>
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
        })}
      </ul>
    </Sheet>
  )
}

/** CMP-029 토스트(성공 알림 3초) */
export function Toast({ text }: { text: string }) {
  return (
    <div className="su-toast" role="status" data-cmp="CMP-029" data-testid="toast">
      {text}
    </div>
  )
}

/** CMP-060 진행 라운드 카드(VD-083). (r10 Preview 조정) 높이 140 이하(VD-086)를 위해 '처리 a/b'(남은 경기가 있으면 누르면 첫 경기로)와
 *  '라운드 시작 취소'를 머리 줄 오른쪽에 두고, 시작 불가 사유는 버튼 글자와 화면 읽기용 설명으로 보여 줍니다 */
export function RoundProgressCard({
  round,
  done,
  total,
  cancelled,
  last,
  canUndo,
  busy,
  onNext,
  onUndo,
  onJump,
}: {
  round: number
  done: number
  total: number
  cancelled: number
  last: boolean
  canUndo: boolean
  busy?: boolean
  onNext: () => void
  onUndo: () => void
  onJump: () => void
}) {
  const left = total - done
  const count = `처리 ${done}/${total}${cancelled ? ` · 취소 ${cancelled}` : ''}`
  return (
    <section className="su-rprog" data-cmp="CMP-060" role="region" aria-labelledby="rprog-h" data-testid="round-progress">
      <div className="su-rprog-top">
        <h2 id="rprog-h">{round}라운드 진행 중</h2>
        {canUndo ? (
          <button type="button" className="su-rprog-undo" onClick={onUndo} data-testid="undo-round">
            <Undo2 aria-hidden />
            라운드 시작 취소
          </button>
        ) : left > 0 ? (
          <button type="button" className="su-rprog-count" onClick={onJump} aria-label={`${count}, 처리되지 않은 경기 ${left}개로 이동`}>
            {count}
          </button>
        ) : (
          <span className="su-rprog-count">{count}</span>
        )}
      </div>
      <div className="su-rprog-bar" aria-hidden>
        <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      {last ? (
        <p className="su-rprog-last">
          <Flag aria-hidden />
          마지막 라운드입니다 · 모두 처리하면 청백전을 종료할 수 있습니다
        </p>
      ) : (
        <button type="button" className="su-rprog-next" disabled={left > 0 || busy} aria-describedby={left > 0 ? 'rprog-why' : undefined} aria-busy={busy || undefined} onClick={onNext} data-testid="next-round">
          {busy ? <LoaderCircle aria-hidden className="su-spin" /> : <ChevronsRight aria-hidden />}
          다음 라운드 시작
          {left > 0 && <small id="rprog-why" aria-label={`처리되지 않은 경기 ${left}개`}>· 남은 경기 {left}</small>}
        </button>
      )}
    </section>
  )
}
