// SMAPSH 심볼 v4 후보 SVG 생성기. 사용: node experiments/brand-assets/v4/gen.mjs
// 모든 기하는 여기서 손으로 정의한 수치로 계산한다 (외부 이미지/폰트 없음).
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const SRC = path.join(here, 'src')
fs.mkdirSync(SRC, { recursive: true })

const T1 = '#008F89' // teal light
const T2 = '#006D68' // teal primary
const MINT = '#2BBFAF' // accent
const f = (n) => +n.toFixed(2)
const rad = (d) => (d * Math.PI) / 180

// ---------- helpers ----------
// 큐빅 베지어 위 점/접선
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
  const l = Math.hypot(dx, dy)
  return { x, y, nx: -dy / l, ny: dx / l }
}

// 베지어 척추를 따라 굵기가 변하는 획 → 하나의 채움 path (양 끝 둥근 마감)
function taperedStroke(pts, w0, w1, ease = (t) => t, n = 40) {
  const L = [], R = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p = bez(...pts, t)
    const w = (w0 + (w1 - w0) * ease(t)) / 2
    L.push([p.x + p.nx * w, p.y + p.ny * w])
    R.push([p.x - p.nx * w, p.y - p.ny * w])
  }
  const r1 = w1 / 2, r0 = w0 / 2
  let d = `M${f(L[0][0])} ${f(L[0][1])}`
  for (let i = 1; i <= n; i++) d += `L${f(L[i][0])} ${f(L[i][1])}`
  d += `A${f(r1)} ${f(r1)} 0 0 0 ${f(R[n][0])} ${f(R[n][1])}`
  for (let i = n - 1; i >= 0; i--) d += `L${f(R[i][0])} ${f(R[i][1])}`
  d += `A${f(r0)} ${f(r0)} 0 0 0 ${f(L[0][0])} ${f(L[0][1])}Z`
  return d
}

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none">` +
  (defs ? `<defs>${defs}</defs>` : '') +
  body +
  `</svg>\n`

// ---------- A: Smash Arc (모션 추상) ----------
// 왼쪽 위 타점에서 오른쪽 아래로 휘며 내리꽂히는 스매시 궤적.
// 꼬리는 가늘고(민트) 머리로 갈수록 굵어지며(틸), 끝의 원 = 셔틀.
function candA(mode) {
  // 궤적(척추)은 셔틀 중심에서 끝난다. 셔틀 둘레를 따라 일정 폭의 간격을 마스크로 비워
  // '꼬리가 셔틀을 밀어내는 순간'처럼 보이게 함 (구두점처럼 떨어진 점이 되지 않도록).
  const r = 18, gap = 4.5
  const hc = [A_HEAD[0], A_HEAD[1]]
  const spine = [[14, 16], [42, 14], [70, 36], hc]
  const stroke = taperedStroke(spine, 8, 2 * r + 2, (t) => Math.pow(t, 1.35))
  const fillArc = mode === 'color' ? 'url(#aG)' : mode === 'mono' ? T2 : '#FFFFFF'
  const fillDot = mode === 'color' ? T2 : mode === 'mono' ? T2 : '#FFFFFF'
  const grad =
    mode === 'color'
      ? `<linearGradient id="aG" x1="14" y1="16" x2="${hc[0]}" y2="${hc[1]}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${MINT}"/><stop offset="0.55" stop-color="${T1}"/><stop offset="1" stop-color="${T2}"/></linearGradient>`
      : ''
  const mask = `<mask id="aM" maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="160"><rect x="-20" y="-20" width="160" height="160" fill="#fff"/><circle cx="${hc[0]}" cy="${hc[1]}" r="${r + gap}" fill="#000"/></mask>`
  return svg(
    `<g transform="translate(${A_SHIFT})"><path d="${stroke}" fill="${fillArc}" mask="url(#aM)"/><circle cx="${hc[0]}" cy="${hc[1]}" r="${r}" fill="${fillDot}"/></g>`,
    grad + mask,
  )
}
const A_HEAD = [80, 82]
const A_SHIFT = '5 4.5'

// ---------- B: Geo Shuttle (배드민턴 요소의 기하 단순화) ----------
// 셔틀콕 = 원(코르크) + 부채꼴 3장(스커트). 비행 방향으로 기울여 역동성 부여.
function candB(mode) {
  const apex = [0, 62] // 스커트 방사 중심(가상의 꼭짓점)
  const rIn = 50, rOut = 94
  const half = 20 // 스커트 반각(도)
  const P = (r, a) => [apex[0] + r * Math.sin(rad(a)), apex[1] - r * Math.cos(rad(a))]
  // 날개 3장: 경계선을 광선에서 수직으로 h만큼 띄워 '일정 폭' 슬릿을 만든 뒤, 동색 stroke로 모서리를 둥글림
  const RS = 4 // 라운딩 stroke 폭
  const h = (SLIT + RS) / 2
  const edge = (a, side) => {
    const nx = Math.cos(rad(a)) * side * h, ny = Math.sin(rad(a)) * side * h
    const [ax, ay] = P(rIn, a), [bx, by] = P(rOut, a)
    return [[ax + nx, ay + ny], [bx + nx, by + ny]]
  }
  const bounds = [-half, -SPLIT, SPLIT, half]
  const vanes = []
  for (let i = 0; i < 3; i++) {
    const [p0, p1] = i === 0 ? edge(bounds[0], 0) : edge(bounds[i], 1)
    const [p3, p2] = i === 2 ? edge(bounds[3], 0) : edge(bounds[i + 1], -1)
    vanes.push(
      `M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}A${rOut} ${rOut} 0 0 1 ${f(p2[0])} ${f(p2[1])}L${f(p3[0])} ${f(p3[1])}A${rIn} ${rIn} 0 0 0 ${f(p0[0])} ${f(p0[1])}Z`,
    )
  }
  const fan = vanes.join('')
  const cork = { cx: 0, cy: 36.5, r: 16 }
  const cSkirt = mode === 'color' ? 'url(#bG)' : mode === 'mono' ? T2 : '#FFFFFF'
  const cCork = mode === 'color' ? MINT : mode === 'mono' ? T2 : '#FFFFFF'
  const grad =
    mode === 'color'
      ? `<linearGradient id="bG" x1="0" y1="-34" x2="0" y2="12" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${T1}"/><stop offset="1" stop-color="${T2}"/></linearGradient>`
      : ''
  return svg(
    `<g transform="translate(${B_SHIFT}) rotate(40)">` +
      `<path d="${fan}" fill="${cSkirt}" stroke="${cSkirt}" stroke-width="${RS}" stroke-linejoin="round"/>` +
      `<circle cx="${cork.cx}" cy="${cork.cy}" r="${cork.r}" fill="${cCork}"/>` +
      `</g>`,
    grad,
  )
}
const SLIT = 4.5
const SPLIT = 6.8 // 슬릿 광선 각도(도)
const B_SHIFT = '58.5 60'
const C_CUT = 6

// ---------- C: Rally S (S 레터마크) ----------
// 두 원호를 이은 기하학적 S를 이탤릭으로 기울이고, 척추를 사선으로 끊어
// '넘어가는 공 / 주고받는 랠리' 두 획으로 읽히게 함. 위 획 틸, 아래 획 민트→틸.
function candC(mode) {
  const rx = 24, ry = 21, sw = 17.5
  const cu = [60, 39], cl = [60, 81]
  const pt = (c, a) => [c[0] + rx * Math.cos(rad(a)), c[1] + ry * Math.sin(rad(a))]
  const u0 = pt(cu, -36), u1 = pt(cu, 90)
  const l0 = pt(cl, 270), l1 = pt(cl, 144)
  // 위: 반시계(sweep 0)로 -36°→90° 큰 호, 아래: 시계(sweep 1)로 270°→144° 큰 호 (타원 rx24·ry21)
  const up = `M${f(u0[0])} ${f(u0[1])}A${rx} ${ry} 0 1 0 ${f(u1[0])} ${f(u1[1])}`
  const lo = `M${f(l0[0])} ${f(l0[1])}A${rx} ${ry} 0 1 1 ${f(l1[0])} ${f(l1[1])}`
  const cUp = mode === 'color' ? T2 : mode === 'mono' ? T2 : '#FFFFFF'
  const cLo = mode === 'color' ? 'url(#cG)' : mode === 'mono' ? T2 : '#FFFFFF'
  const grad =
    mode === 'color'
      ? `<linearGradient id="cG" x1="78" y1="64" x2="40" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${T1}"/><stop offset="1" stop-color="${MINT}"/></linearGradient>`
      : ''
  // 척추 사선 컷: 획마다 컷 반대편의 국소 영역만 지워, 두 획이 서로의 끝 캡을 침범하지 않게 함
  const g = C_CUT / 2, ang = 32, cx = 59, cy = 60
  const cutMask = (id, x) =>
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="160"><rect x="-20" y="-20" width="160" height="160" fill="#fff"/><rect x="${x}" y="${cy - 22}" width="30" height="44" fill="#000" transform="rotate(${ang} ${cx} ${cy})"/></mask>`
  const mask = cutMask('cMu', cx - g) + cutMask('cMl', cx + g - 30)
  return svg(
    `<g transform="translate(60 60) skewX(-10) translate(-60 -60)" stroke-width="${sw}" stroke-linecap="round" fill="none">` +
      `<path d="${lo}" stroke="${cLo}" mask="url(#cMl)"/><path d="${up}" stroke="${cUp}" mask="url(#cMu)"/>` +
      `</g>`,
    grad + mask,
  )
}

const C = { a: candA, b: candB, c: candC }
for (const [k, fn] of Object.entries(C)) {
  fs.writeFileSync(path.join(SRC, `symbol-${k}.svg`), fn('color'))
  fs.writeFileSync(path.join(SRC, `symbol-${k}-mono.svg`), fn('mono'))
  fs.writeFileSync(path.join(SRC, `symbol-${k}-white.svg`), fn('white'))
}
console.log('wrote', fs.readdirSync(SRC).join(', '))
