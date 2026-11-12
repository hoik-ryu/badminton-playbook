// 탐색용: 원본 보드에서 바깥 스피드 라인의 밝은 중심선(능선)을 극좌표로 찾고, 원본 위에 점으로 겹쳐 그림.
// 사용: node experiments/brand-assets/symbol-v3/probe-ridge.mjs <cx> <cy>
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const [cx = 690, cy = 330] = process.argv.slice(2).map(Number)
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.resolve(here, '../source/brand-board.png')).toString('base64')
const browser = await chromium.launch(); const page = await browser.newPage()
const res = await page.evaluate(async ({ dataUrl, cx, cy }) => {
  const img = new Image(); img.src = dataUrl; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data
  const L = (px, py) => { const i = (Math.round(py) * c.width + Math.round(px)) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] }
  const W = (px, py) => { const i = (Math.round(py) * c.width + Math.round(px)) * 4; return Math.min(d[i], d[i + 1], d[i + 2]) }
  const rows = []
  for (let t = -130; t <= 175; t += 5) {
    const th = (t * Math.PI) / 180; let prof = []
    for (let r = 60; r <= 230; r++) prof.push([r, L(cx + r * Math.cos(th), cy + r * Math.sin(th)), W(cx + r * Math.cos(th), cy + r * Math.sin(th))])
    // 바깥쪽부터: 국소 최대 + 밝기 > 120
    let pick = null
    for (let k = prof.length - 2; k > 0; k--) { const [r, l] = prof[k]; if (l > 120 && l >= prof[k - 1][1] && l >= prof[k + 1][1]) { pick = prof[k]; break } }
    rows.push({ t, r: pick?.[0] ?? null, L: pick ? Math.round(pick[1]) : null, white: pick ? pick[2] : null })
  }
  // 겹쳐 그리기
  const o = document.createElement('canvas'); o.width = 360; o.height = 260; const ox = o.getContext('2d'); ox.imageSmoothingEnabled = false
  ox.drawImage(img, 520, 160, 360, 260, 0, 0, 360, 260); ox.fillStyle = '#ff2d55'
  for (const rw of rows) if (rw.r) { const th = (rw.t * Math.PI) / 180; ox.fillRect(cx + rw.r * Math.cos(th) - 520 - 1, cy + rw.r * Math.sin(th) - 160 - 1, 3, 3) }
  ox.fillStyle = '#ffd60a'; ox.fillRect(cx - 520 - 2, cy - 160 - 2, 5, 5)
  const big = document.createElement('canvas'); big.width = 1080; big.height = 780; const bx = big.getContext('2d'); bx.imageSmoothingEnabled = false; bx.drawImage(o, 0, 0, 1080, 780)
  return { rows, png: big.toDataURL('image/png').split(',')[1] }
}, { dataUrl, cx, cy })
await browser.close()
const OUT = path.join(here, 'probe'); fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, `ridge-${cx}-${cy}.png`), Buffer.from(res.png, 'base64'))
console.log(res.rows.map((r) => `${r.t}:${r.r ?? '-'}/${r.L ?? '-'}/${r.white ?? '-'}`).join('  '))
