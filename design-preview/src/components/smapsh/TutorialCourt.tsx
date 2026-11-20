import { Check, Waves, X as XIcon } from 'lucide-react'

// CMP-046 TutorialCourt — 프리뷰 정적 그림(제품 코드 아님). 좌표계는 기존 코트 그림 그대로(0–61 × 0–134, 네트 y=67, 표시 범위 -5 -5 71 144).
// UXD-077 r6 · CMP-046 r5: 상황 재생(mode=playing) 중에는 학습용 격자·번호를 그리지 않고, 선택 대기부터 내 편 반 코트(y 67–134)에만 표시.
// 상대 편 반 코트에는 격자·번호·누름 영역을 두지 않음. 칸 정의·번호 매핑은 UXD-077 좌표표 그대로.
// VD-026 격자(흰 70% 점선 0.35단위), VD-027 번호(5.4단위, 바닥색 불투명 원 7단위, 라인 회피 위치), VD-028 선택 강조,
// VD-029 판정(상태 bg 90% + 오른쪽 위 아이콘 + 선 모양), VD-030 셔틀 방향 고리(바닥색 외곽선), VD-031 동선(바닥색 외곽선)
export type Grid = 6 | 9
export type CourtMode = 'playing' | 'choose' | 'result' | 'replay'
type Pt = readonly [number, number]

const ROWS = [67, 89.33, 111.67, 134]
const COLS: Record<Grid, number[]> = { 6: [0, 30.5, 61], 9: [0, 20.33, 40.67, 61] }
const ROW_NAME = ['앞', '가운데', '뒤']
const COL_NAME: Record<Grid, string[]> = { 6: ['왼쪽', '오른쪽'], 9: ['왼쪽', '가운데', '오른쪽'] }

export type Cell = { no: number; x0: number; x1: number; y0: number; y1: number; cx: number; cy: number; label: string }
export function cells(n: Grid): Cell[] {
  const xs = COLS[n]
  const out: Cell[] = []
  let k = 1
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < xs.length - 1; c++) {
      out.push({ no: k, x0: xs[c], x1: xs[c + 1], y0: ROWS[r], y1: ROWS[r + 1], cx: (xs[c] + xs[c + 1]) / 2, cy: (ROWS[r] + ROWS[r + 1]) / 2, label: `${k}번 칸, 내 편 ${ROW_NAME[r]} 줄 ${COL_NAME[n][c]}` })
      k++
    }
  return out
}

const X = (x: number) => `${((x + 5) / 71) * 100}%`
const Y = (y: number) => `${((y + 5) / 144) * 100}%`
const W = (w: number) => `${(w / 71) * 100}%`
const H = (h: number) => `${(h / 144) * 100}%`
const U = (n: number) => `calc(${n} * var(--cu))`
const box = (x: number, y: number, w: number, h: number) => ({ left: X(x), top: Y(y), width: W(w), height: H(h) })

export type Mark = { cell: number; kind: 'ok' | 'allow' | 'bad' | 'select' | 'selectWait'; mine?: boolean }

export function TutorialCourt({
  grid, mode, label, me, partner, opponents, shuttle, marks = [], ring, routes, onCellsLabel = true, onCell, onSkip, selected, slow,
}: {
  grid: Grid
  mode: CourtMode
  label: string
  me: Pt
  partner: Pt
  opponents: Pt[]
  shuttle?: Pt
  marks?: Mark[]
  ring?: Pt
  routes?: { from: Pt; to: Pt; partner?: boolean }[]
  onCellsLabel?: boolean
  /** 흐름 모드: 칸 누르기(선택 대기에서만). 없으면 정적 보기 */
  onCell?: (no: number) => void
  /** 흐름 모드: 상황 재생 중 코트를 누르면 결과(멈춤)까지 건너뜀 */
  onSkip?: () => void
  selected?: number
  slow?: boolean
}) {
  const gridOn = mode !== 'playing'
  const cs = cells(grid)
  const byNo = Object.fromEntries(cs.map((c) => [c.no, c]))
  return (
    <div className="tc-box">
      <div onClick={mode === 'playing' ? onSkip : undefined} className="tc" data-cmp="CMP-046" data-mode={mode} data-slow={slow ? 'true' : undefined} data-grid={gridOn ? `grid-${grid === 6 ? '2x3' : '3x3'}` : 'none'} role={mode === 'choose' ? 'group' : 'img'} aria-label={label}>
        {/* 실제 코트 라인·네트(늘 그림) */}
        <span className="tc-l tc-rect" style={box(0, 0, 61, 134)} />
        {[4.6, 56.4].map((x) => <span key={x} className="tc-l tc-v" style={box(x, 0, 0, 134)} />)}
        {[7.6, 126.4, 47.2, 86.8].map((y) => <span key={y} className="tc-l tc-h" style={box(0, y, 61, 0)} />)}
        <span className="tc-l tc-v" style={box(30.5, 0, 0, 47.2)} />
        <span className="tc-l tc-v" style={box(30.5, 86.8, 0, 47.2)} />
        <span className="tc-net" style={box(-3, 67, 67, 0)} />
        {/* 학습용 격자(내 편 반 코트만, 선택 대기부터) */}
        {gridOn && (
          <>
            {COLS[grid].slice(1, -1).map((x) => <span key={x} className="tc-gv" style={box(x, 67, 0, 67)} />)}
            {ROWS.slice(1, -1).map((y) => <span key={y} className="tc-gh" style={box(0, y, 61, 0)} />)}
          </>
        )}
        {marks.map((m) => {
          const c = byNo[m.cell]
          const Icon = m.kind === 'ok' ? Check : m.kind === 'allow' ? Waves : m.kind === 'bad' ? XIcon : null
          return (
            <span key={`${m.cell}-${m.kind}`} className={`tc-mk tc-mk-${m.kind}${m.mine ? ' tc-mine' : ''}`} style={box(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0)}>
              {Icon && <Icon aria-hidden className="tc-mk-ic" />}
            </span>
          )
        })}
        {ring && <span className="tc-ring" style={{ left: X(ring[0]), top: Y(ring[1]) }} />}
        {routes?.map((r, i) => {
          const dx = r.to[0] - r.from[0], dy = r.to[1] - r.from[1]
          return <span key={i} className={`tc-rt${r.partner ? ' tc-rt-p' : ''}`} style={{ left: X(r.from[0]), top: Y(r.from[1]), width: U(Math.hypot(dx, dy)), transform: `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}deg)` }}><i /></span>
        })}
        {opponents.map((p, i) => <Player key={i} at={p} kind="opp" text="상대" />)}
        <Player at={partner} kind="me" text="파트너" />
        <Player at={me} kind="me" text="나" self />
        {shuttle && <span className="tc-sh" style={{ left: X(shuttle[0]), top: Y(shuttle[1]) }} />}
        {gridOn && cs.map((c) => (
          // 번호 위치(UXD-077 r6): 기본 칸 원점 x+0.8·y+0.8, 왼쪽 끝 열 x+5.4(단식 사이드라인 안쪽), 첫 줄 y+1.4(네트 아래)
          <span key={c.no} className="tc-num" style={{ left: X(c.x0 + (c.x0 === 0 ? 5.4 : 0.8)), top: Y(c.y0 + (c.y0 === 67 ? 1.4 : 0.8)) }}>{c.no}</span>
        ))}
        {mode === 'choose' && onCellsLabel && cs.map((c) => (
          <button key={c.no} type="button" className="tc-hit" aria-label={c.label} aria-pressed={selected === c.no} onClick={onCell ? () => onCell(c.no) : undefined} style={box(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0)} />
        ))}
      </div>
    </div>
  )
}

function Player({ at, kind, text, self = false }: { at: Pt; kind: 'me' | 'opp'; text: string; self?: boolean }) {
  return (
    <span className={`tc-pl tc-pl-${kind}${self ? ' tc-self' : ''}`} style={{ left: X(at[0]), top: Y(at[1]) }}>
      {self && <i className="tc-ring-me" />}
      <b />
      <em>{text}</em>
    </span>
  )
}
