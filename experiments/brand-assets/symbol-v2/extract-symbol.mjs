// SMAPSH 셔틀콕 심볼 투명 PNG 추출 v2(심볼 전용, 재현용). 새로 그리지 않고 브랜드 보드 원본 픽셀만 씁니다.
// 사용: node experiments/brand-assets/symbol-v2/extract-symbol.mjs
// 규칙
//  - 모양(알파): 배경(2차 곡면 맞춤)보다 밝아진 정도 a를 구해 심볼 본체만 남김(빛 번짐 제거). 모양 밖은 알파 0.
//  - 어두운 배경용 색: 모양 안은 원본 픽셀 색 그대로. 가장자리는 F = (C − (1−m)·B) / m 로 배경을 걷어 낸 색(검은 테두리 방지).
//  - 밝은 배경용: 같은 알파를 그대로 쓰고, 색만 원본 밝기(흰색 정도)에 따라 짙은 teal(흰 끝) → mint(청록 뿌리)로 대응.
//  - 연결 요소 중 작은 조각(보드 배경 빛 티끌)은 제거.
// 픽셀 처리는 experiments/c-preview-poc/의 Chromium canvas를 씁니다(읽기만 함).
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const SRC = path.resolve(here, '../source/brand-board.png')
const OUT = path.join(here, 'out'); fs.mkdirSync(OUT, { recursive: true })

const CFG = {
  region: { x: 500, y: 76, w: 600, h: 290 }, // 보드 좌표. 아래 경계 y=366은 워드마크 위
  mask: [0.5, 0.64], // a에서 심볼 본체로 보는 구간(smoothstep). 빛 번짐(a≈0.2–0.45)은 제외
  minArea: 150, // 이보다 작은 연결 조각은 제거(px)
  pad: 0.06, // 결과 캔버스의 투명 여백(긴 변 대비)
  light: [[0, '#3FD2C2'], [0.5, '#008F89'], [1, '#00524E']], // A안: 흰 정도 0(청록 뿌리) → 1(흰 끝). #3FD2C2·#00524E는 테마 밖 자산 전용 색
  lightTokens: [[0, '#008F89'], [1, '#006D68']], // B안: 테마 원시 값만(teal-600 → teal-700)
}

const browser = await chromium.launch()
const page = await browser.newPage()
const res = await page.evaluate(async ({ dataUrl, CFG }) => {
  const img = new Image(); img.src = dataUrl; await img.decode()
  const { x, y, w, h } = CFG.region
  const cv = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c }
  const src = cv(w, h).getContext('2d'); src.drawImage(img, x, y, w, h, 0, 0, w, h)
  const px = src.getImageData(0, 0, w, h).data

  // 배경 추정(어두운 픽셀로 2차 곡면 최소제곱)
  const feats = (u, v) => [1, u, v, u * u, u * v, v * v]
  const A = Array.from({ length: 6 }, () => new Float64Array(6)), B = [0, 1, 2].map(() => new Float64Array(6))
  for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) {
    const k = (j * w + i) * 4, L = 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]
    if (L > 40) continue
    const f = feats(i / w, j / h)
    for (let a = 0; a < 6; a++) { for (let b = 0; b < 6; b++) A[a][b] += f[a] * f[b]; for (let c = 0; c < 3; c++) B[c][a] += f[a] * px[k + c] }
  }
  const solve = (M, v) => { const n = 6, m = M.map((r, i) => [...r, v[i]]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;[m[i], m[p]] = [m[p], m[i]]; for (let r = 0; r < n; r++) if (r !== i) { const f = m[r][i] / m[i][i]; for (let c = i; c <= n; c++) m[r][c] -= f * m[i][c] } } return m.map((r, i) => r[n] / r[i]) }
  const coef = [0, 1, 2].map((c) => solve(A, B[c]))
  const bgAt = (i, j) => { const f = feats(i / w, j / h); return coef.map((cf) => cf.reduce((s, q, t) => s + q * f[t], 0)) }

  // 모양 마스크
  const ss = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
  const m = new Float32Array(w * h)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, bg = bgAt(i, j); let a = 0
    for (let c = 0; c < 3; c++) a = Math.max(a, Math.max(0, px[k * 4 + c] - bg[c]) / Math.max(1, 255 - bg[c]))
    m[k] = ss(CFG.mask[0], CFG.mask[1], a)
  }
  // 연결 요소(8방향, m>0) 면적이 작은 조각 제거
  const lab = new Int32Array(w * h).fill(-1), comps = []
  for (let s = 0; s < w * h; s++) {
    if (m[s] <= 0 || lab[s] >= 0) continue
    const id = comps.length, st = [s]; lab[s] = id; let area = 0, minX = w, minY = h, maxX = 0, maxY = 0; const members = []
    while (st.length) { const p = st.pop(); members.push(p); area++; const pi = p % w, pj = (p / w) | 0; minX = Math.min(minX, pi); maxX = Math.max(maxX, pi); minY = Math.min(minY, pj); maxY = Math.max(maxY, pj)
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ni = pi + di, nj = pj + dj; if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue; const q = nj * w + ni; if (m[q] > 0 && lab[q] < 0) { lab[q] = id; st.push(q) } } }
    comps.push({ id, area, box: [minX + x, minY + y, maxX + x, maxY + y], members })
  }
  const kept = comps.filter((c) => c.area >= CFG.minArea), dropped = comps.filter((c) => c.area < CFG.minArea)
  for (const c of dropped) for (const p of c.members) m[p] = 0

  // 결과 경계 + 여백
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (m[j * w + i] > 0) { minX = Math.min(minX, i); maxX = Math.max(maxX, i); minY = Math.min(minY, j); maxY = Math.max(maxY, j) }
  const bw = maxX - minX + 1, bh = maxY - minY + 1, pad = Math.round(Math.max(bw, bh) * CFG.pad), W = bw + pad * 2, H = bh + pad * 2

  // 색
  const hex = (s) => [1, 3, 5].map((o) => parseInt(s.slice(o, o + 2), 16))
  const mkRamp = (def) => { const stops = def.map(([t, c]) => [t, hex(c)]); return (t) => { for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], u = (t - t0) / (t1 - t0); return c0.map((v, q) => v + (c1[q] - v) * u) } return stops.at(-1)[1] } }
  const rampA = mkRamp(CFG.light), rampB = mkRamp(CFG.lightTokens)
  const make = (variant) => {
    const c = cv(W, H), cx = c.getContext('2d'), id = cx.createImageData(W, H)
    for (let j = minY; j <= maxY; j++) for (let i = minX; i <= maxX; i++) {
      const k = j * w + i, mm = m[k]; if (mm <= 0) continue
      const bg = bgAt(i, j), C = [px[k * 4], px[k * 4 + 1], px[k * 4 + 2]]
      const F = C.map((v, q) => Math.min(255, Math.max(0, (v - (1 - mm) * bg[q]) / mm)))
      let rgb = F
      if (variant !== 'dark') { const white = Math.min(1, Math.max(0, (Math.min(F[0], F[1], F[2]) - 40) / 200)); rgb = (variant === 'light' ? rampA : rampB)(white) }
      const o = ((j - minY + pad) * W + (i - minX + pad)) * 4
      id.data[o] = Math.round(rgb[0]); id.data[o + 1] = Math.round(rgb[1]); id.data[o + 2] = Math.round(rgb[2]); id.data[o + 3] = Math.round(mm * 255)
    }
    cx.putImageData(id, 0, 0); return c
  }
  const dark = make('dark'), light = make('light'), lightTokens = make('lightTokens')
  return {
    size: { W, H, body: { w: bw, h: bh }, pad, boardBox: [minX + x, minY + y, maxX + x, maxY + y] },
    comps: { kept: kept.map(({ area, box }) => ({ area, box })), dropped: dropped.map(({ area, box }) => ({ area, box })) },
    files: { dark: dark.toDataURL('image/png').split(',')[1], light: light.toDataURL('image/png').split(',')[1], lightTokens: lightTokens.toDataURL('image/png').split(',')[1] },
  }
}, { dataUrl: 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'), CFG })
await browser.close()
fs.writeFileSync(path.join(OUT, 'smapsh-symbol-dark.png'), Buffer.from(res.files.dark, 'base64'))
fs.writeFileSync(path.join(OUT, 'smapsh-symbol-light.png'), Buffer.from(res.files.light, 'base64'))
fs.writeFileSync(path.join(OUT, 'smapsh-symbol-light-tokens.png'), Buffer.from(res.files.lightTokens, 'base64'))
const meta = { source: 'experiments/brand-assets/source/brand-board.png', config: CFG, size: res.size, components: res.comps }
fs.writeFileSync(path.join(OUT, 'extract-meta.json'), JSON.stringify(meta, null, 1))
console.log(JSON.stringify({ size: res.size, kept: res.comps.kept, droppedCount: res.comps.dropped.length, droppedMaxArea: Math.max(0, ...res.comps.dropped.map((d) => d.area)) }))
