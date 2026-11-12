// 탐색용: 스피드 라인 구역만 여러 기준으로 다시 분리해 3배 확대로 나란히 비교.
// 사용: node experiments/brand-assets/symbol-v3/probe-mask.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.resolve(here, '../source/brand-board.png')).toString('base64')
const browser = await chromium.launch(); const page = await browser.newPage()
const png = await page.evaluate(async ({ dataUrl }) => {
  const img = new Image(); img.src = dataUrl; await img.decode()
  const X0 = 530, Y0 = 230, w = 150, h = 140 // 보드 좌표 구역(스피드 라인 왼쪽 아래)
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, X0, Y0, w, h, 0, 0, w, h)
  const d = x.getImageData(0, 0, w, h).data, bg = [8, 30, 32]
  const met = {
    a: (k) => Math.max(...[0, 1, 2].map((q) => Math.max(0, d[k + q] - bg[q]) / (255 - bg[q]))),
    white: (k) => Math.max(0, Math.min(d[k], d[k + 1], d[k + 2]) - bg[0]) / (255 - bg[0]),
    lum: (k) => Math.max(0, 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2] - 26) / 229,
  }
  const blur = (m, s) => { const r = Math.ceil(s * 3), ker = []; let sum = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * s * s)); ker.push(v); sum += v } ker.forEach((v, i) => (ker[i] = v / sum)); const t = new Float32Array(w * h), o = new Float32Array(w * h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let a = 0; for (let k = -r; k <= r; k++) a += m[j * w + Math.min(w - 1, Math.max(0, i + k))] * ker[k + r]; t[j * w + i] = a }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let a = 0; for (let k = -r; k <= r; k++) a += t[Math.min(h - 1, Math.max(0, j + k)) * w + i] * ker[k + r]; o[j * w + i] = a } return o }
  const ss = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
  const variants = [
    ['v2 기준 a 0.50–0.64', (k) => ss(0.5, 0.64, met.a(k)), 0],
    ['a 0.80–0.92 + 매끈', (k) => ss(0.8, 0.92, met.a(k)), 1.2],
    ['white 0.35–0.6 + 매끈', (k) => ss(0.35, 0.6, met.white(k)), 1.2],
    ['lum 0.62–0.78 + 매끈', (k) => ss(0.62, 0.78, met.lum(k)), 1.2],
  ]
  const Z = 3, out = document.createElement('canvas'); out.width = (w * Z + 10) * variants.length + w * Z + 10; out.height = h * Z + 30
  const ox = out.getContext('2d'); ox.fillStyle = '#000'; ox.fillRect(0, 0, out.width, out.height); ox.imageSmoothingEnabled = false
  ox.drawImage(c, 0, 0, w, h, 0, 0, w * Z, h * Z); ox.fillStyle = '#fff'; ox.font = '14px sans-serif'; ox.fillText('원본', 4, h * Z + 20)
  variants.forEach(([name, f, s], vi) => {
    let m = new Float32Array(w * h); for (let p = 0; p < w * h; p++) m[p] = f(p * 4)
    if (s) { m = blur(m, s); for (let p = 0; p < w * h; p++) m[p] = ss(0.35, 0.65, m[p]) }
    const t = document.createElement('canvas'); t.width = w; t.height = h; const tx = t.getContext('2d'), id = tx.createImageData(w, h)
    for (let p = 0; p < w * h; p++) { const v = Math.round(m[p] * 255); id.data[p * 4] = d[p * 4]; id.data[p * 4 + 1] = d[p * 4 + 1]; id.data[p * 4 + 2] = d[p * 4 + 2]; id.data[p * 4 + 3] = v }
    tx.putImageData(id, 0, 0); const ox0 = (w * Z + 10) * (vi + 1)
    ox.fillStyle = '#fff'; ox.fillRect(ox0, 0, w * Z, h * Z); ox.imageSmoothingEnabled = true; ox.drawImage(t, 0, 0, w, h, ox0, 0, w * Z, h * Z)
    ox.fillStyle = '#fff'; ox.fillText(name, ox0 + 4, h * Z + 20)
  })
  return out.toDataURL('image/png').split(',')[1]
}, { dataUrl })
await browser.close()
fs.mkdirSync(path.join(here, 'probe'), { recursive: true })
fs.writeFileSync(path.join(here, 'probe/mask-variants.png'), Buffer.from(png, 'base64')); console.log('ok')
