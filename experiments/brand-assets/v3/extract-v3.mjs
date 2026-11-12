// SMAPSH 브랜드 v3(확정본) 추출: 심볼(스피드 라인 보정) + 워드마크 + 잠금(lockup) + 아이콘. 재현용, 새로 그리지 않음.
// 사용: node experiments/brand-assets/v3/extract-v3.mjs
// - 원본: ../source/brand-board.png(사용자 제공 브랜드 보드)
// - 모양(알파): 배경(어두운 픽셀 2차 곡면)보다 밝아진 정도 a → smoothstep. 모양 밖 알파 0.
// - 스피드 라인 보정(v3): 바깥 스피드 라인 구역만 a 0.80–0.92(밝은 중심선)로 다시 분리 → 가우시안(σ1.2) 후 재임계로 가장자리를 매끈하게.
//   구역 경계는 σ4로 섞어 v2 모양과 이어 붙임. 깃털 3개·코르크·안쪽 곡선은 v2와 같은 기준.
// - 색: 어두운 배경용은 원본 픽셀 색(가장자리는 배경을 걷어 낸 색). 밝은 배경용은 같은 알파에 원본 흰 정도로 색 대응.
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const SRC = path.resolve(here, '../source/brand-board.png')
const OUT = path.join(here, 'out'); fs.mkdirSync(OUT, { recursive: true })

const CFG = {
  symbol: { region: { x: 500, y: 76, w: 600, h: 290 }, mask: [0.5, 0.64] },
  speedZone: { poly: [[530, 225], [700, 225], [700, 262], [650, 282], [612, 292], [600, 372], [530, 372]], mask: [0.8, 0.92], blur: 1.2, feather: 4 },
  wordmark: { region: { x: 352, y: 362, w: 864, h: 126 }, mask: [0.5, 0.64] },
  minArea: 150,
  // 밝은 배경용 A안(사용자 결정): 원본 teal/mint 유지, 흰 배경에서 흐린 뿌리 색만 최소 보정(#3FD2C2 → #2BBFAF)
  lightSymbol: [[0, '#2BBFAF'], [0.5, '#008F89'], [1, '#00524E']],
  // 밝은 배경 워드마크: 보드 '로그인 화면 사용 예시'의 짙은 워드마크 계열(흰 부분 → 짙은 색, 청록 부분 → 짙은 청록)
  lightWordmark: [[0, '#0B4D4A'], [1, '#0F2C2F']],
  iconBg: ['#0B3436', '#03181A'],
}

const browser = await chromium.launch()
const page = await browser.newPage()
const res = await page.evaluate(async ({ dataUrl, CFG }) => {
  const img = new Image(); img.src = dataUrl; await img.decode()
  const cv = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c }
  const ss = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
  const hex = (s) => [1, 3, 5].map((o) => parseInt(s.slice(o, o + 2), 16))
  const mkRamp = (def) => { const st = def.map(([t, c]) => [t, hex(c)]); return (t) => { for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const [t0, c0] = st[i - 1], [t1, c1] = st[i], u = (t - t0) / (t1 - t0); return c0.map((v, q) => v + (c1[q] - v) * u) } return st.at(-1)[1] } }
  const blur = (m, w, h, s) => { const r = Math.ceil(s * 3), ker = []; let sum = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * s * s)); ker.push(v); sum += v } ker.forEach((v, i) => (ker[i] = v / sum)); const t = new Float32Array(w * h), o = new Float32Array(w * h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let a = 0; for (let k = -r; k <= r; k++) a += m[j * w + Math.min(w - 1, Math.max(0, i + k))] * ker[k + r]; t[j * w + i] = a }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let a = 0; for (let k = -r; k <= r; k++) a += t[Math.min(h - 1, Math.max(0, j + k)) * w + i] * ker[k + r]; o[j * w + i] = a } return o }
  const inPoly = (P, X, Y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) c = !c } return c }

  function extract({ region, mask }, zone) {
    const { x, y, w, h } = region
    const sx = cv(w, h).getContext('2d'); sx.drawImage(img, x, y, w, h, 0, 0, w, h); const px = sx.getImageData(0, 0, w, h).data
    // 배경 2차 곡면
    const feats = (u, v) => [1, u, v, u * u, u * v, v * v]
    const A = Array.from({ length: 6 }, () => new Float64Array(6)), B = [0, 1, 2].map(() => new Float64Array(6))
    for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) { const k = (j * w + i) * 4, L = 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]; if (L > 40) continue; const f = feats(i / w, j / h); for (let a = 0; a < 6; a++) { for (let b = 0; b < 6; b++) A[a][b] += f[a] * f[b]; for (let c = 0; c < 3; c++) B[c][a] += f[a] * px[k + c] } }
    const solve = (M, v) => { const n = 6, m = M.map((r, i) => [...r, v[i]]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;[m[i], m[p]] = [m[p], m[i]]; for (let r = 0; r < n; r++) if (r !== i) { const f = m[r][i] / m[i][i]; for (let c = i; c <= n; c++) m[r][c] -= f * m[i][c] } } return m.map((r, i) => r[n] / r[i]) }
    const coef = [0, 1, 2].map((c) => solve(A, B[c])); const bgAt = (i, j) => { const f = feats(i / w, j / h); return coef.map((cf) => cf.reduce((s, q, t) => s + q * f[t], 0)) }
    const aMap = new Float32Array(w * h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i, bg = bgAt(i, j); let a = 0; for (let c = 0; c < 3; c++) a = Math.max(a, Math.max(0, px[k * 4 + c] - bg[c]) / Math.max(1, 255 - bg[c])); aMap[k] = a }
    let m = new Float32Array(w * h); for (let k = 0; k < w * h; k++) m[k] = ss(mask[0], mask[1], aMap[k])
    if (zone) {
      // 구역 안: 밝은 중심선 기준 + 매끈하게 / 경계는 부드럽게 섞음
      let core = new Float32Array(w * h); for (let k = 0; k < w * h; k++) core[k] = ss(zone.mask[0], zone.mask[1], aMap[k])
      core = blur(core, w, h, zone.blur); for (let k = 0; k < w * h; k++) core[k] = ss(0.35, 0.65, core[k])
      let zw = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) zw[j * w + i] = inPoly(zone.poly, i + x, j + y) ? 1 : 0
      zw = blur(zw, w, h, zone.feather)
      for (let k = 0; k < w * h; k++) m[k] = m[k] * (1 - zw[k]) + core[k] * zw[k]
    }
    // 작은 조각 제거
    const lab = new Int32Array(w * h).fill(-1); let dropped = 0
    for (let s = 0; s < w * h; s++) { if (m[s] <= 0.01 || lab[s] >= 0) continue; const st = [s], mem = []; lab[s] = 1
      while (st.length) { const p = st.pop(); mem.push(p); const pi = p % w, pj = (p / w) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ni = pi + di, nj = pj + dj; if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue; const q = nj * w + ni; if (m[q] > 0.01 && lab[q] < 0) { lab[q] = 1; st.push(q) } } }
      if (mem.length < CFG.minArea) { dropped++; for (const p of mem) m[p] = 0 } }
    for (let k = 0; k < w * h; k++) if (m[k] <= 0.01) m[k] = 0
    let minX = w, minY = h, maxX = 0, maxY = 0
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (m[j * w + i] > 0) { minX = Math.min(minX, i); maxX = Math.max(maxX, i); minY = Math.min(minY, j); maxY = Math.max(maxY, j) }
    const bw = maxX - minX + 1, bh = maxY - minY + 1
    // 색(어두운 배경용 원본색 F, 흰 정도)
    const F = new Uint8ClampedArray(bw * bh * 3), A8 = new Uint8ClampedArray(bw * bh), Wt = new Float32Array(bw * bh)
    for (let j = minY; j <= maxY; j++) for (let i = minX; i <= maxX; i++) { const k = j * w + i, mm = m[k], o = (j - minY) * bw + (i - minX); if (!mm) continue; const bg = bgAt(i, j)
      for (let q = 0; q < 3; q++) F[o * 3 + q] = (px[k * 4 + q] - (1 - mm) * bg[q]) / mm
      A8[o] = Math.round(mm * 255); Wt[o] = Math.min(1, Math.max(0, (Math.min(F[o * 3], F[o * 3 + 1], F[o * 3 + 2]) - 40) / 200)) }
    return { bw, bh, F, A8, Wt, boardBox: [x + minX, y + minY], dropped }
  }
  const paint = (part, ramp, pad = 0) => { const c = cv(part.bw + pad * 2, part.bh + pad * 2), cx = c.getContext('2d'), id = cx.createImageData(c.width, c.height)
    for (let j = 0; j < part.bh; j++) for (let i = 0; i < part.bw; i++) { const o = j * part.bw + i; if (!part.A8[o]) continue; const rgb = ramp ? ramp(part.Wt[o]) : [part.F[o * 3], part.F[o * 3 + 1], part.F[o * 3 + 2]], d = ((j + pad) * c.width + (i + pad)) * 4
      id.data[d] = Math.round(rgb[0]); id.data[d + 1] = Math.round(rgb[1]); id.data[d + 2] = Math.round(rgb[2]); id.data[d + 3] = part.A8[o] }
    cx.putImageData(id, 0, 0); return c }

  const sym = extract(CFG.symbol, CFG.speedZone), symV2 = extract(CFG.symbol, null), wm = extract(CFG.wordmark, null)
  const rampS = mkRamp(CFG.lightSymbol), rampW = mkRamp(CFG.lightWordmark)
  const padS = Math.round(Math.max(sym.bw, sym.bh) * 0.06)
  const P = { 'symbol-dark': paint(sym, null, padS), 'symbol-light': paint(sym, rampS, padS), 'symbol-v2-dark': paint(symV2, null, padS) }
  const wD = paint(wm, null), wL = paint(wm, rampW), sD = paint(sym, null), sL = paint(sym, rampS)
  P['wordmark-dark'] = wD; P['wordmark-light'] = wL

  // 세로형(보드 메인 배치 그대로: 보드 좌표 기준)
  const stack = (S, W) => { const x0 = Math.min(sym.boardBox[0], wm.boardBox[0]), y0 = sym.boardBox[1], x1 = Math.max(sym.boardBox[0] + sym.bw, wm.boardBox[0] + wm.bw), y1 = wm.boardBox[1] + wm.bh
    const c = cv(x1 - x0, y1 - y0), cx = c.getContext('2d'); cx.drawImage(S, sym.boardBox[0] - x0, sym.boardBox[1] - y0); cx.drawImage(W, wm.boardBox[0] - x0, wm.boardBox[1] - y0)
    return { c, layout: { w: c.width, h: c.height, symbol: { x: sym.boardBox[0] - x0, y: sym.boardBox[1] - y0, w: sym.bw, h: sym.bh }, wordmark: { x: wm.boardBox[0] - x0, y: wm.boardBox[1] - y0, w: wm.bw, h: wm.bh } } } }
  const stD = stack(sD, wD); P['lockup-stacked-dark'] = stD.c; P['lockup-stacked-light'] = stack(sL, wL).c
  // 가로형(보드 '로그인 화면 사용 예시' 실측 배치: 심볼 높이 = 워드마크 높이 × 1.8, 심볼 폭 20% 겹침, 워드마크 중심은 심볼 중심보다 심볼 높이 6% 아래)
  const horiz = (S, W) => { const sh = W.height * 1.8, sw = (S.width * sh) / S.height, ov = sw * 0.2, wy = sh / 2 + sh * 0.06 - W.height / 2
    const top = Math.min(0, wy), H = Math.ceil(Math.max(sh, wy + W.height) - top), c = cv(Math.ceil(sw - ov + W.width), H), cx = c.getContext('2d')
    cx.imageSmoothingQuality = 'high'; cx.drawImage(S, 0, -top, sw, sh); cx.drawImage(W, sw - ov, wy - top); return c }
  P['lockup-horizontal-light'] = horiz(sL, wL); P['lockup-horizontal-dark'] = horiz(sD, wD)

  // 아이콘(어두운 바탕 + 원본색 심볼, 폭 84%)
  const icon = (size) => { const c = cv(512, 512), cx = c.getContext('2d'), g = cx.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, CFG.iconBg[0]); g.addColorStop(1, CFG.iconBg[1]); cx.fillStyle = g; cx.fillRect(0, 0, 512, 512)
    const k = Math.min((512 * 0.84) / sD.width, (512 * 0.74) / sD.height); cx.imageSmoothingQuality = 'high'; cx.drawImage(sD, (512 - sD.width * k) / 2, (512 - sD.height * k) / 2, sD.width * k, sD.height * k)
    let cur = c; while (cur.width / 2 >= size) { const n = cv(cur.width / 2, cur.height / 2), nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(cur, 0, 0, n.width, n.height); cur = n }
    if (cur.width !== size) { const n = cv(size, size), nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(cur, 0, 0, size, size); cur = n } return cur }
  for (const s of [512, 192, 180, 48, 32, 16]) P[`icon-${s}`] = icon(s)

  const out = {}; for (const [k, c] of Object.entries(P)) out[k] = { w: c.width, h: c.height, png: c.toDataURL('image/png').split(',')[1] }
  return { out, stackedLayout: stD.layout, dropped: { symbol: sym.dropped, wordmark: wm.dropped } }
}, { dataUrl: 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'), CFG })
await browser.close()

const sizes = {}
for (const [k, v] of Object.entries(res.out)) { fs.writeFileSync(path.join(OUT, `smapsh-${k}.png`), Buffer.from(v.png, 'base64')); sizes[k] = `${v.w}x${v.h}` }
const ico = [16, 32, 48].map((s) => fs.readFileSync(path.join(OUT, `smapsh-icon-${s}.png`)))
const head = Buffer.alloc(6 + 16 * ico.length); head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4)
let off = head.length; ico.forEach((d, i) => { const s = [16, 32, 48][i], o = 6 + 16 * i; head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(d.length, o + 8); head.writeUInt32LE(off, o + 12); off += d.length })
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, ...ico]))
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ config: CFG, sizes, stackedLayout: res.stackedLayout, dropped: res.dropped }, null, 1))
console.log(JSON.stringify({ sizes, stackedLayout: res.stackedLayout, dropped: res.dropped }))
