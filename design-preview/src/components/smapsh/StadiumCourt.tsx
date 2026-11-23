import { Check, Waves, X as XIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cells, type CourtMode, type Grid, type Mark } from './TutorialCourt'
import { pctX, pctY, project, STADIUM, unitScale, type Pt } from './courtProjection'

// CMP-046 TutorialCourt — 경기장 이미지판(프리뷰 전용, 제품 코드 아님).
// 레이어(아래 → 위): 경기장 이미지(네트 포함, 다시 그리지 않음) → 학습 격자·강조·판정·셔틀 방향·동선(SVG, 원근 변환) →
//   그림자 → 선수 4명·셔틀콕(각각 독립 이미지 레이어) → 칸 번호(SVG) → 칸 누름 영역(SVG 다각형, 맨 위).
// 규칙(UXD-077 r6, CMP-046 r5): 상황 재생 중에는 격자·번호·누름 영역 없음, 선택 대기부터 내 편 반 코트(y 67–134)에만. 상대 편 격자 없음.
// 좌표는 기존 코트 단위(0–61 × 0–134) 그대로 받고 courtProjection.project로 이미지 위치를 계산합니다. 판정은 칸 번호로만(이 컴포넌트는 그리기만).
export type ShuttleState = { at: Pt; h: number }
export type Sprite = 'me' | 'partner' | 'oppM' | 'oppF'
type Facing = 'left' | 'right'
type Variant = { file: string; footX: number; aspect: number }
// 원본(game-images, 수정 안 함)과 좌우 반전본(public/game/player-*-flipped.png → 렌더용 *-flipped.webp). footX는 각 그림에서 다시 잰 발 위치.
// faces = 그 그림 속 선수가 보는 쪽(원본 육안 확인: 나·우리편 여자·상대편 남자는 오른쪽, 상대편 여자는 왼쪽)
const SPRITES: Record<Sprite, Record<Facing, Variant>> = {
  me: { right: { file: 'game/me.webp', footX: 0.4974, aspect: 399 / 420 }, left: { file: 'game/me-flipped.webp', footX: 0.5016, aspect: 399 / 420 } },
  partner: { right: { file: 'game/partner.webp', footX: 0.5829, aspect: 337 / 420 }, left: { file: 'game/partner-flipped.webp', footX: 0.4159, aspect: 337 / 420 } },
  oppM: { right: { file: 'game/oppM.webp', footX: 0.376, aspect: 351 / 420 }, left: { file: 'game/oppM-flipped.webp', footX: 0.6229, aspect: 351 / 420 } },
  oppF: { left: { file: 'game/oppF.webp', footX: 0.5553, aspect: 360 / 420 }, right: { file: 'game/oppF-flipped.webp', footX: 0.4435, aspect: 360 / 420 } },
}
/** 코트 가운데(x=30.5) 기준: 화면 왼쪽 선수는 오른쪽을, 오른쪽 선수는 왼쪽을 봄. 가운데 ±2.5단위는 직전 방향 유지(반복 뒤집힘 방지) */
const MID = 30.5, DEAD = 2.5
const facingFor = (x: number, prev?: Facing): Facing => (Math.abs(x - MID) < DEAD && prev ? prev : x < MID ? 'right' : 'left')
/** 번호 글자 크기(코트 단위)·바닥에 눕힌 느낌의 세로 눌림 비율 */
const NUM_UNITS = 4, NUM_SQUASH = 0.82
/** 선수 키(코트 단위). 실제 비율보다 조금 크게(그림 가독성) */
const PLAYER_UNITS = 12.5
/** 셔틀 높이(단위)를 화면 위쪽 오프셋으로 바꿀 때의 비율(카메라 시점 근사) */
const HEIGHT_K = 0.35
const BASE = import.meta.env.BASE_URL
const reduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export type CourtMetrics = { scale: number; minCellW: number; minCellH: number }

export function StadiumCourt({
  grid, mode, label, me, partner, opponents, shuttle, marks = [], ring, routes, onCell, onSkip, selected, slow, flyMs = 1100, onMetrics, interactive = true,
}: {
  grid: Grid
  mode: CourtMode
  label: string
  me: Pt
  partner: Pt
  opponents: Pt[]
  shuttle?: ShuttleState
  marks?: Mark[]
  ring?: Pt
  routes?: { from: Pt; to: Pt; partner?: boolean }[]
  onCell?: (no: number) => void
  onSkip?: () => void
  selected?: number
  slow?: boolean
  /** 셔틀이 새 위치로 갈 때 걸리는 시간(ms) */
  flyMs?: number
  onMetrics?: (m: CourtMetrics) => void
  /** 정적 보기에서도 칸 누름 영역(선택 대기)을 그릴지 */
  interactive?: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ s: 0, left: 0, top: 0, bh: 0 })
  const gridOn = mode !== 'playing'
  const cs = cells(grid)

  // 이미지 비율 그대로(왜곡 없음): focus 범위(상대 머리 ~ 가까운 엔드라인)가 상자에 들어오도록 맞추고, 벽·바닥 여분은 잘림
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const { width: bw, height: bh } = el.getBoundingClientRect()
      const fh = STADIUM.focus.bottom - STADIUM.focus.top
      const s = Math.min(bw / STADIUM.w, bh / fh)
      // 이미지 아래쪽(바닥)을 상자 아래(시트)에 붙여 바닥이 끊기지 않게 하고, 그러면 focus가 잘리는 경우에만 focus를 가운데에 둠
      const bottomAligned = bh - STADIUM.h * s
      const top = bottomAligned + STADIUM.focus.top * s >= 0 ? bottomAligned : (bh - fh * s) / 2 - STADIUM.focus.top * s
      setFit({ s, left: (bw - STADIUM.w * s) / 2, top, bh })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 확인 단계 판단용 실제 칸 크기(CSS px): 가장 작은 칸(네트 쪽 줄)의 너비·높이
  useEffect(() => {
    if (!fit.s || !onMetrics) return
    let w = Infinity, h = Infinity
    for (const c of cs) {
      const a = project([c.x0, c.cy]), b = project([c.x1, c.cy]), t = project([c.cx, c.y0]), d = project([c.cx, c.y1])
      w = Math.min(w, (b[0] - a[0]) * fit.s)
      h = Math.min(h, (d[1] - t[1]) * fit.s)
    }
    onMetrics({ scale: fit.s, minCellW: w, minCellH: h })
  }, [fit.s, grid]) // eslint-disable-line react-hooks/exhaustive-deps

  const poly = (x0: number, y0: number, x1: number, y1: number) => [project([x0, y0]), project([x1, y0]), project([x1, y1]), project([x0, y1])].map((p) => p.join(',')).join(' ')
  const line = (a: Pt, b: Pt) => { const p = project(a), q = project(b); return { x1: p[0], y1: p[1], x2: q[0], y2: q[1] } }
  const xs = grid === 9 ? [0, 20.33, 40.67, 61] : [0, 30.5, 61]
  const rows = [67, 89.33, 111.67, 134]
  const byNo = Object.fromEntries(cs.map((c) => [c.no, c]))
  const key = (e: KeyboardEvent, no: number) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCell?.(no) } }
  const choosing = mode === 'choose'
  // 번호(칸 정중앙, 원근 크기)
  const nums = cs.map((c) => {
    // 번호 위치 = 칸의 정중앙(코트 좌표) → 원근 변환. 라인 회피용 오프셋 없음(9칸 2·5·8은 x=30.5, 센터 라인과 같은 축)
    const p = project([c.cx, c.cy]), u = unitScale([c.cx, c.cy]), fs = NUM_UNITS * u.h
    return { no: c.no, x: p[0], y: p[1], fs, w: fs * 0.62, h: fs * NUM_SQUASH * 0.78 }
  })
  // VD-027(DD r8): 흰 숫자 100% + 둥근 반투명 받침(color.text.primary 60%), 칸 정중앙·원근 크기·세로 눌림.
  // 층은 모든 상태에서 선수·셔틀 위, 누름 영역 바로 아래(UX Spec r6 그리는 순서: … → 선수·셔틀콕 → 번호 → 누름 영역, DD r8 B안)
  const numEls = nums.map((n) => {
    const wide = n.no > 9
    return (
      <g key={n.no} className={`sc-numg${choosing && selected === n.no ? ' sc-num-on' : ''}`} transform={`translate(${n.x} ${n.y}) scale(1 ${NUM_SQUASH}) translate(${-n.x} ${-n.y})`}>
        <rect className="sc-num-plate" x={n.x - n.fs * (wide ? 0.62 : 0.46)} y={n.y - n.fs * 0.6} width={n.fs * (wide ? 1.24 : 0.92)} height={n.fs * 1.2} rx={n.fs * 0.46} />
        <text className="sc-num" data-cell={n.no} x={n.x} y={n.y} fontSize={n.fs} dominantBaseline="central" textAnchor="middle">{n.no}</text>
      </g>
    )
  })
  // "이 영역으로 이동" 안내 위치: 선택 칸 주변을 촘촘히 훑어, 코트 상자(네트 아래 ~ 시트 위) 안이면서
  // ① 어떤 번호와도 겹치지 않고 ② 선수와 덜 겹치며 ③ 선택 칸 중심에 가까운 곳. 칸이 안내보다 좁으면 작은 안내(compact)
  // "이 영역으로 이동" 안내 위치(VD-028: 고른 칸 주변, 번호와 겹치지 않고, 선수와 가장 덜 겹치는 자리)
  // (Preview r5, B-07) 같은 규칙 안에서 계산만 보정: ① 선수 상자를 실제로 그리는 그림 상자(그림 너비 × 발 기준점)로,
  // ② 번호 피하기 영역을 r8 받침 크기로, ③ 선수 겹침 가중치를 크게(겹침이 있으면 거리보다 우선), ④ 후보를 '주변' 규칙 전체에서 촘촘히,
  // ⑤ 셔틀·발 그림자·흰 코트 라인 겹침에 작은 벌점. 칸이 안내보다 좁으면 작은 안내(compact)
  const goAt = (() => {
    if (!selected || !fit.s || !byNo[selected]) return null
    const c = byNo[selected], n = nums.find((x) => x.no === selected)!
    const cl = project([c.x0, c.cy])[0], cr = project([c.x1, c.cy])[0], ct = project([c.cx, c.y0])[1], cb = project([c.cx, c.y1])[1]
    const compact = (cr - cl) * fit.s < 112 || (cb - ct) * fit.s < 44
    const lw = (compact ? 108 : 112) / fit.s, lh = (compact ? 21 : 26) / fit.s, gap = 3 / fit.s
    const visTop = Math.max(-fit.top / fit.s, project([c.cx, 67])[1]) + gap, visBot = (fit.bh - fit.top) / fit.s - gap
    type Box = { x0: number; x1: number; y0: number; y1: number }
    const ovl = (x: number, y: number, r: Box) =>
      Math.max(0, Math.min(x + lw / 2, r.x1) - Math.max(x - lw / 2, r.x0)) * Math.max(0, Math.min(y + lh / 2, r.y1) - Math.max(y - lh / 2, r.y0))
    // 번호 받침(VD-027 r8: 너비 0.92em(두 자리 1.24em) × 높이 1.2em × 세로 눌림)
    const ng = 1 / fit.s // 번호와는 1px만 띄움(맞닿아도 겹치지 않음)
    const numR = nums.map((m) => { const hw = m.fs * (m.no > 9 ? 0.62 : 0.46), hh = m.fs * 0.6 * NUM_SQUASH; return { x0: m.x - hw - ng, x1: m.x + hw + ng, y0: m.y - hh - ng, y1: m.y + hh + ng } })
    // 선수: 실제로 그리는 그림 상자(Player와 같은 계산). 발 그림자는 따로(작은 벌점)
    const plR = ([['me', me], ['partner', partner]] as const).map(([id, a]) => {
      const sp = SPRITES[id][facingFor(a[0])], [fx, fy] = project(a), hPx = PLAYER_UNITS * unitScale(a).h, wPx = hPx * sp.aspect
      return { x0: fx - sp.footX * wPx, x1: fx + (1 - sp.footX) * wPx, y0: fy - hPx, y1: fy }
    })
    const sdR = [me, partner].map((a) => { const [fx, fy] = project(a), hPx = PLAYER_UNITS * unitScale(a).h; return { x0: fx - hPx * 0.31, x1: fx + hPx * 0.31, y0: fy - hPx * 0.08, y1: fy + hPx * 0.08 } })
    // 셔틀(선택 대기에서 멈춘 위치)과 바닥 그림자
    const shR: Box[] = shuttle ? (() => { const [gx, gy] = project(shuttle.at), u = unitScale(shuttle.at), sz = 4.2 * u.h, y = gy - shuttle.h * u.h * HEIGHT_K
      return [{ x0: gx - sz / 2, x1: gx + sz / 2, y0: y - sz / 2, y1: y + sz / 2 }, { x0: gx - sz * 0.35, x1: gx + sz * 0.35, y0: gy - sz * 0.11, y1: gy + sz * 0.11 }] })() : []
    // 흰 코트 라인(내 편): 복식·단식 사이드라인, 센터 라인, 숏 서비스·복식 롱 서비스·엔드라인 — 얇은 띠로 근사
    const lineR: Box[] = [
      ...[0, 4.6, 30.5, 56.4, 61].map((x) => { const a = project([x, x === 30.5 ? 86.8 : 67]), b = project([x, 134]), w = 0.25 * unitScale([x, 100]).h; return { x0: Math.min(a[0], b[0]) - w, x1: Math.max(a[0], b[0]) + w, y0: a[1], y1: b[1] } }),
      ...[86.8, 126.4, 134].map((y) => { const a = project([0, y]), b = project([61, y]), w = 0.25 * unitScale([30.5, y]).v; return { x0: a[0], x1: b[0], y0: Math.min(a[1], b[1]) - w, y1: Math.max(a[1], b[1]) + w } }),
    ]
    // 후보: '주변' 규칙(선택 칸과 맞닿음)을 만족하는 모든 자리를 촘촘히 훑음. 번호와 겹치는 자리는 제외(VD-028),
    // 그런 자리가 하나도 없을 때만 번호 겹침을 큰 벌점으로 바꿔 가장 덜 겹치는 자리를 고름(고정 기본 위치로 떨어지지 않게)
    const cw = cr - cl, ch = cb - ct, A = lw * lh
    const score = (x: number, y: number) => {
      const inCell = x - lw / 2 >= cl && x + lw / 2 <= cr && y - lh / 2 >= ct && y + lh / 2 <= cb
      const pl = plR.reduce((sum, r) => sum + ovl(x, y, r), 0) / A
      const sh = shR.reduce((sum, r) => sum + ovl(x, y, r), 0) / A
      const sd = sdR.reduce((sum, r) => sum + ovl(x, y, r), 0) / A
      const ln = lineR.reduce((sum, r) => sum + (ovl(x, y, r) > 0 ? 1 : 0), 0)
      return pl * 40 + (pl > 0 ? 1 : 0) + sh * 20 + sd * 3 + ln * 0.12 + Math.hypot((x - n.x) / cw, (y - n.y) / ch) + (inCell ? 0 : 0.6)
    }
    let best: { x: number; y: number; cost: number } | null = null
    let fallback: { x: number; y: number; cost: number } | null = null
    const X0 = cl - lw / 2 + 1, X1 = cr + lw / 2 - 1, Y0 = ct - lh / 2 - gap + 1, Y1 = cb + lh / 2 + gap - 1
    // 격자 후보 + 번호·선수 상자 가장자리에 맞닿는 후보(좁은 빈자리를 놓치지 않게)
    const xs = [...Array.from({ length: 41 }, (_, i) => X0 + ((X1 - X0) * i) / 40), ...plR.flatMap((r) => [r.x0 - lw / 2 - ng, r.x1 + lw / 2 + ng]), ...numR.flatMap((r) => [r.x0 - lw / 2, r.x1 + lw / 2])].filter((x) => x >= X0 && x <= X1)
    const ys = [...Array.from({ length: 33 }, (_, j) => Y0 + ((Y1 - Y0) * j) / 32), ...plR.flatMap((r) => [r.y0 - lh / 2 - ng, r.y1 + lh / 2 + ng]), ...numR.flatMap((r) => [r.y0 - lh / 2, r.y1 + lh / 2])].filter((y) => y >= Y0 && y <= Y1)
    for (const x of xs) for (const y of ys) {
      if (x - lw / 2 < 0 || x + lw / 2 > STADIUM.w || y - lh / 2 < visTop || y + lh / 2 > visBot) continue
      const nOv = numR.reduce((sum, r) => sum + ovl(x, y, r), 0) / A
      const cost = score(x, y)
      if (nOv === 0) { if (!best || cost < best.cost) best = { x, y, cost } }
      else if (!fallback || cost + nOv * 60 < fallback.cost) fallback = { x, y, cost: cost + nOv * 60 }
    }
    const pick = best ?? fallback
    return pick ? { x: pick.x, y: pick.y, compact } : { x: n.x, y: Math.min(cb + gap + lh / 2, visBot - lh / 2), compact }
  })()

  return (
    <div ref={boxRef} className="sc-box" onClick={mode === 'playing' ? onSkip : undefined} data-cmp="CMP-046" data-mode={mode} data-grid={gridOn ? `grid-${grid === 6 ? '2x3' : '3x3'}` : 'none'} data-slow={slow ? 'true' : undefined}>
      <div className="sc-stage" style={{ width: STADIUM.w * fit.s, height: STADIUM.h * fit.s, left: fit.left, top: fit.top, visibility: fit.s ? 'visible' : 'hidden' }} role={mode === 'choose' ? 'group' : 'img'} aria-label={label}>
        <img className="sc-bg" src={`${BASE}${STADIUM.src}`} alt="" aria-hidden draggable={false} />
        {/* 학습 격자·강조·판정·방향·동선(원근 변환된 SVG, 이미지 좌표계) */}
        <svg className="sc-svg" viewBox={`0 0 ${STADIUM.w} ${STADIUM.h}`} aria-hidden>
          {gridOn && (
            <g className="sc-grid" data-testid="learning-grid">
              {xs.slice(1, -1).map((x) => <line key={`v${x}`} {...line([x, 67], [x, 134])} />)}
              {rows.slice(1, -1).map((y) => <line key={`h${y}`} {...line([0, y], [61, y])} />)}
            </g>
          )}
          {/* 선택 영역 바닥 면(선택 대기에서만 보이고, 이동이 시작되면 흐려지며 사라짐) */}
          {gridOn && (
            <g className="sc-tiles" data-testid="select-tiles" data-on={choosing ? 'true' : 'false'}>
              {cs.map((c) => <polygon key={c.no} className="sc-tile" data-cell={c.no} points={poly(c.x0 + 0.7, c.y0 + 0.7, c.x1 - 0.7, c.y1 - 0.7)} />)}
              {/* VD-028(DD r8): 고른 칸은 이웃 칸 테두리 위에 바깥쪽 어두운 선 → 굵은 흰 테두리 순서로 그림 */}
              {cs.filter((c) => c.no === selected).map((c) => [
                <polygon key="o" className="sc-tile-out" points={poly(c.x0 + 0.7, c.y0 + 0.7, c.x1 - 0.7, c.y1 - 0.7)} />,
                <polygon key="i" className="sc-tile sc-tile-on" data-cell={c.no} data-selected="true" points={poly(c.x0 + 0.7, c.y0 + 0.7, c.x1 - 0.7, c.y1 - 0.7)} />,
              ])}
            </g>
          )}
          {marks.map((m) => {
            const c = byNo[m.cell]
            const Icon = m.kind === 'ok' ? Check : m.kind === 'allow' ? Waves : m.kind === 'bad' ? XIcon : null
            const tr = project([c.x1 - 1.2, c.y0 + 1.2]), u = unitScale([c.x1, c.y0])
            const sz = 6.4 * u.h
            return (
              <g key={`${m.cell}-${m.kind}`} className={`sc-mk sc-mk-${m.kind}${m.mine ? ' sc-mine' : ''}`}>
                {(m.kind === 'select' || m.kind === 'selectWait') && <polygon className="sc-mk-out" points={poly(c.x0, c.y0, c.x1, c.y1)} />}
                <polygon className="sc-mk-poly" points={poly(c.x0, c.y0, c.x1, c.y1)} />
                {Icon && <Icon x={tr[0] - sz} y={tr[1]} width={sz} height={sz} className="sc-mk-ic" />}
              </g>
            )
          })}
          {ring && (() => { const p = project(ring), u = unitScale(ring); return <ellipse className="sc-ring" cx={p[0]} cy={p[1]} rx={3.5 * u.h} ry={3.5 * u.v} /> })()}
          {routes?.map((r, i) => (
            <g key={i} className={`sc-rt${r.partner ? ' sc-rt-p' : ''}`}>
              <line className="sc-rt-under" {...line(r.from, r.to)} />
              <line className="sc-rt-line" {...line(r.from, r.to)} markerEnd="url(#sc-arrow)" />
            </g>
          ))}
          <defs>
            <marker id="sc-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="sc-arrowhead" />
            </marker>
          </defs>
        </svg>
        {/* 선수·셔틀(독립 이미지 레이어, 발 기준 정렬, 원근 크기) */}
        {opponents.map((p, i) => <Player key={`o${i}`} id={i === 0 ? 'oppF' : 'oppM'} at={p} />)}
        <Player id="partner" at={partner} bubble={choosing ? undefined : '파트너'} />
        <Player id="me" at={me} bubble={choosing ? undefined : '나'} self />
        {shuttle && <Shuttle target={shuttle} ms={flyMs} />}
        {/* "이 영역으로 이동" 안내(선택 칸 주변, 번호와 겹치지 않게) */}
        {gridOn && goAt && <span className={`sc-go${goAt.compact ? ' sc-go-sm' : ''}`} data-on={choosing ? 'true' : 'false'} aria-hidden style={{ left: pctX(goAt.x), top: pctY(goAt.y) }}>이 영역으로 이동</span>}
        {/* 칸 누름 영역(맨 위, 칸 전체가 누름 대상) */}
        {gridOn && (
          <svg className="sc-svg sc-top" viewBox={`0 0 ${STADIUM.w} ${STADIUM.h}`}>
            {numEls}
            {mode === 'choose' && interactive && cs.map((c) => (
              <polygon key={c.no} className="sc-hit" points={poly(c.x0, c.y0, c.x1, c.y1)} role="button" tabIndex={0} aria-label={c.label} aria-pressed={selected === c.no}
                onClick={onCell ? () => onCell(c.no) : undefined} onKeyDown={(e) => key(e, c.no)} />
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}

function Player({ id, at, bubble, self = false }: { id: Sprite; at: Pt; bubble?: string; self?: boolean }) {
  // 방향은 목표(최종) 위치로 이동 시작 때 한 번 정함 → 이동 중에는 바뀌지 않음
  const face = useRef<Facing | undefined>(undefined)
  face.current = facingFor(at[0], face.current)
  const sp = SPRITES[id][face.current]
  const [fx, fy] = project(at)
  const u = unitScale(at)
  const hPx = PLAYER_UNITS * u.h
  const wPx = hPx * sp.aspect
  return (
    <>
      <span className={`sc-mv sc-shadow${self ? ' sc-shadow-me' : ''}`} aria-hidden style={{ left: pctX(fx - hPx * 0.31), top: pctY(fy - hPx * 0.08), width: pctX(hPx * 0.62), height: pctY(hPx * 0.16) }} />
      <img className="sc-mv sc-pl" data-player={id} data-facing={face.current} data-flipped={sp.file.includes('-flipped') ? 'true' : 'false'} src={`${BASE}${sp.file}`} alt="" aria-hidden draggable={false}
        style={{ left: pctX(fx - sp.footX * wPx), top: pctY(fy - hPx), width: pctX(wPx), height: pctY(hPx) }} />
      {bubble && <span className={`sc-mv sc-bubble${self ? ' sc-bubble-me' : ''}`} style={{ left: pctX(fx), top: pctY(fy - hPx * 1.02) }}>{bubble}</span>}
    </>
  )
}

// 셔틀: 지면 위치 + 높이(단위). 새 목표가 오면 rAF로 포물선 이동(움직임 줄이기면 바로). 그림자는 지면에
function Shuttle({ target, ms }: { target: ShuttleState; ms: number }) {
  const [cur, setCur] = useState<ShuttleState>(target)
  const from = useRef<ShuttleState>(target)
  useEffect(() => {
    const a = from.current, b = target
    if (reduce() || (a.at[0] === b.at[0] && a.at[1] === b.at[1] && a.h === b.h)) { setCur(b); from.current = b; return }
    const t0 = performance.now(), peak = Math.max(a.h, b.h) + 6
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) * (1 - k)
      const h = a.h + (b.h - a.h) * e + 4 * (peak - Math.max(a.h, b.h)) * e * (1 - e)
      const s = { at: [a.at[0] + (b.at[0] - a.at[0]) * e, a.at[1] + (b.at[1] - a.at[1]) * e] as Pt, h }
      setCur(s); from.current = s
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target.at[0], target.at[1], target.h, ms]) // eslint-disable-line react-hooks/exhaustive-deps
  const [gx, gy] = project(cur.at)
  const u = unitScale(cur.at)
  const size = 4.2 * u.h
  return (
    <>
      <span className="sc-sh-shadow" style={{ left: pctX(gx - size * 0.35), top: pctY(gy - size * 0.11), width: pctX(size * 0.7), height: pctY(size * 0.22) }} aria-hidden />
      <img className="sc-sh" data-shuttle src={`${BASE}game/shuttle.webp`} alt="" aria-hidden draggable={false}
        style={{ left: pctX(gx - size / 2), top: pctY(gy - cur.h * u.h * HEIGHT_K - size / 2), width: pctX(size), height: pctY(size * 0.975) }} />
    </>
  )
}
