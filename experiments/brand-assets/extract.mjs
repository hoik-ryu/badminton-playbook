// SMAPSH 브랜드 보드(사용자 제공 PNG)에서 로고·심볼을 분리해 투명 PNG와 아이콘을 만드는 스크립트(실험, 재현용).
// 사용: node experiments/brand-assets/extract.mjs <브랜드보드.png>
// - 새 로고를 그리지 않습니다. 보드의 메인 로고 픽셀에서 배경(어두운 그라데이션)을 빼 투명도를 계산하고,
//   밝은 배경용은 같은 모양(마스크)에 보드의 '로그인 화면 사용 예시' 색 계열(청록 심볼 + 어두운 워드마크)을 입힙니다.
// - 픽셀 처리는 experiments/c-preview-poc/의 Chromium canvas를 씁니다(그 폴더는 읽기만 함).
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const src = process.argv[2] || path.join(here, 'source/brand-board.png')
const OUT = path.join(here, 'out'); fs.mkdirSync(OUT, { recursive: true })

// 보드 좌표(1536×1024): 메인 로고의 심볼·워드마크 영역(설명 문구 'BADMINTON CLUB PLATFORM'은 제외)
const CFG = {
  region: { x: 352, y: 84, w: 864, h: 396 },
  // 워드마크와 심볼의 경계(영역 안 y). 위는 심볼, 아래는 워드마크
  splitY: 282,
  // 보드 배경의 네온 줄기(로고 아님)를 지우는 다각형(영역 좌표)
  erase: [[[0, 0], [250, 0], [250, 120], [150, 190], [0, 250]], [[730, 0], [864, 0], [864, 282], [730, 282]]],
  alphaFloor: 0.06,
  mask: [0.42, 0.66], // 단색 마스크(빛 번짐 제거) smoothstep 구간
  light: { symbolFrom: '#006D68', symbolTo: '#00A69E', wordmark: '#0F2C2F' },
  iconDark: { from: '#0B3436', to: '#03181A' },
}

const browser = await chromium.launch()
const page = await browser.newPage()
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64')
const files = await page.evaluate(async ({ dataUrl, CFG }) => {
  const img = new Image(); img.src = dataUrl; await img.decode()
  const { x, y, w, h } = CFG.region
  const cv = (W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c }
  const base = cv(w, h); const bx = base.getContext('2d'); bx.drawImage(img, x, y, w, h, 0, 0, w, h)
  const px = bx.getImageData(0, 0, w, h).data

  // 1) 배경 추정: 어두운 픽셀(밝기<48)로 채널별 2차 곡면 최소제곱 맞춤
  const feats = (u, v) => [1, u, v, u * u, u * v, v * v]
  const A = Array.from({ length: 6 }, () => new Float64Array(6)); const B = [0, 1, 2].map(() => new Float64Array(6))
  for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) {
    const k = (j * w + i) * 4, L = 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2]
    if (L > 48) continue
    const f = feats(i / w, j / h)
    for (let a = 0; a < 6; a++) { for (let b = 0; b < 6; b++) A[a][b] += f[a] * f[b]; for (let c = 0; c < 3; c++) B[c][a] += f[a] * px[k + c] }
  }
  const solve = (M, v) => { const n = 6, m = M.map((r, i) => [...r, v[i]]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;[m[i], m[p]] = [m[p], m[i]]; for (let r = 0; r < n; r++) if (r !== i) { const f = m[r][i] / m[i][i]; for (let c = i; c <= n; c++) m[r][c] -= f * m[i][c] } } return m.map((r, i) => r[n] / r[i]) }
  const coef = [0, 1, 2].map((c) => solve(A, B[c]))
  const bgAt = (i, j) => { const f = feats(i / w, j / h); return coef.map((cf) => cf.reduce((s, q, t) => s + q * f[t], 0)) }

  // 2) 투명도: 배경보다 밝아진 정도(채널 최댓값). 빛 번짐은 반투명으로 남김
  const inPoly = (P, X, Y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) c = !c } return c }
  const alpha = new Float32Array(w * h), fg = new Uint8ClampedArray(w * h * 3)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, bg = bgAt(i, j)
    if (CFG.erase.some((P) => inPoly(P, i, j))) continue
    let a = 0
    for (let c = 0; c < 3; c++) a = Math.max(a, Math.max(0, px[k * 4 + c] - bg[c]) / Math.max(1, 255 - bg[c]))
    if (a < CFG.alphaFloor) continue
    alpha[k] = a
    for (let c = 0; c < 3; c++) fg[k * 3 + c] = bg[c] + (px[k * 4 + c] - bg[c]) / a
  }
  const ss = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

  // 3) 결과 캔버스 만들기
  const make = (part, mode) => {
    const y0 = part === 'wordmark' ? CFG.splitY : 0, y1 = part === 'symbol' ? CFG.splitY : h
    const c = cv(w, h), cx = c.getContext('2d'), id = cx.createImageData(w, h)
    let minX = w, minY = h, maxX = 0, maxY = 0
    const L = CFG.light, hex = (s) => [1, 3, 5].map((o) => parseInt(s.slice(o, o + 2), 16))
    const s0 = hex(L.symbolFrom), s1 = hex(L.symbolTo), wm = hex(L.wordmark)
    for (let j = y0; j < y1; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i; let a = alpha[k]; if (!a) continue
      let rgb
      if (mode === 'dark') rgb = [fg[k * 3], fg[k * 3 + 1], fg[k * 3 + 2]]
      else if (mode === 'crisp') { a = ss(CFG.mask[0], CFG.mask[1], a); if (a <= 0) continue; rgb = [fg[k * 3], fg[k * 3 + 1], fg[k * 3 + 2]] } // 원래 색, 빛 번짐 제거(아이콘용)
      else {
        a = ss(CFG.mask[0], CFG.mask[1], a); if (a <= 0) continue
        if (j < CFG.splitY) { const t = Math.min(1, Math.max(0, (i / w) * 0.9 + (1 - j / CFG.splitY) * 0.4)); rgb = s0.map((v, c) => v + (s1[c] - v) * t) } else rgb = wm
      }
      const o = k * 4; id.data[o] = rgb[0]; id.data[o + 1] = rgb[1]; id.data[o + 2] = rgb[2]; id.data[o + 3] = Math.round(a * 255)
      if (a > 0.02) { minX = Math.min(minX, i); maxX = Math.max(maxX, i); minY = Math.min(minY, j); maxY = Math.max(maxY, j) }
    }
    cx.putImageData(id, 0, 0)
    const pad = mode === 'dark' ? 12 : 2, bb = { x: Math.max(0, minX - pad), y: Math.max(0, minY - pad) }
    bb.w = Math.min(w, maxX + pad + 1) - bb.x; bb.h = Math.min(h, maxY + pad + 1) - bb.y
    const t = cv(bb.w, bb.h); t.getContext('2d').drawImage(c, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); t.bb = bb; return t
  }
  const parts = {}
  for (const mode of ['dark', 'light', 'crisp']) for (const part of ['symbol', 'wordmark', 'full']) parts[`${part}-${mode}`] = make(part, mode)

  // 4) 가로형(보드 '로그인 화면 사용 예시' 배치): 심볼 높이 = 워드마크 높이 × 1.9, 심볼이 워드마크 왼쪽에 살짝 겹침
  const horiz = (mode) => {
    const S = parts[`symbol-${mode}`], W = parts[`wordmark-${mode}`], sh = W.height * 1.9, sw = (S.width * sh) / S.height
    const overlap = sw * 0.12, H = Math.ceil(sh), c = cv(Math.ceil(sw - overlap + W.width), H), cx = c.getContext('2d')
    cx.drawImage(S, 0, 0, sw, sh); cx.drawImage(W, sw - overlap, H - W.height - sh * 0.06); return c
  }
  parts['horizontal-dark'] = horiz('dark'); parts['horizontal-light'] = horiz('light')

  // 5) 아이콘: 512 원본(어두운 바탕 + 네온 심볼 / 밝은 바탕 + 청록 심볼)을 만든 뒤 단계적으로 줄임
  const icon = (variant, size) => {
    const c = cv(512, 512), cx = c.getContext('2d'), g = cx.createLinearGradient(0, 0, 512, 512)
    if (variant === 'dark') { g.addColorStop(0, CFG.iconDark.from); g.addColorStop(1, CFG.iconDark.to) } else { g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#D9F3F0') }
    cx.fillStyle = g; cx.fillRect(0, 0, 512, 512)
    // 작은 크기 식별성: 빛 번짐 없는 심볼을 크게(폭 84%) 배치. 어두운 아이콘은 원래 색(흰·청록), 밝은 아이콘은 청록 마스크
    const S = parts[`symbol-${variant === 'dark' ? 'crisp' : 'light'}`], scale = Math.min(512 * 0.84 / S.width, 512 * 0.74 / S.height)
    cx.drawImage(S, (512 - S.width * scale) / 2, (512 - S.height * scale) / 2, S.width * scale, S.height * scale)
    let cur = c; while (cur.width / 2 >= size) { const n = cv(cur.width / 2, cur.height / 2); const nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(cur, 0, 0, n.width, n.height); cur = n }
    if (cur.width !== size) { const n = cv(size, size); const nx = n.getContext('2d'); nx.imageSmoothingQuality = 'high'; nx.drawImage(cur, 0, 0, size, size); cur = n }
    return cur
  }
  for (const s of [512, 192, 180, 48, 32, 16]) parts[`icon-dark-${s}`] = icon('dark', s)
  for (const s of [512, 192]) parts[`icon-light-${s}`] = icon('light', s)

  const out = {}
  for (const [k, c] of Object.entries(parts)) out[k] = { w: c.width, h: c.height, x: c.bb?.x, y: c.bb?.y, png: c.toDataURL('image/png').split(',')[1] }
  return out
}, { dataUrl, CFG })
await browser.close()

const report = {}
for (const [k, v] of Object.entries(files)) { fs.writeFileSync(path.join(OUT, `smapsh-${k}.png`), Buffer.from(v.png, 'base64')); report[k] = v.x == null ? `${v.w}x${v.h}` : `${v.w}x${v.h}@${v.x},${v.y}` }
// favicon.ico (16·32·48, PNG 내장)
const ico = [16, 32, 48].map((s) => fs.readFileSync(path.join(OUT, `smapsh-icon-dark-${s}.png`)))
const head = Buffer.alloc(6 + 16 * ico.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4)
let off = head.length; ico.forEach((d, i) => { const s = [16, 32, 48][i], o = 6 + 16 * i; head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(d.length, o + 8); head.writeUInt32LE(off, o + 12); off += d.length })
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, ...ico]))
fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(report, null, 1))
console.log(JSON.stringify(report))
