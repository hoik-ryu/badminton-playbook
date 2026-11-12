// 확정 심볼 B(Geo Shuttle) 최종 자산 렌더. 사용: node experiments/brand-assets/v4/final/render-final.mjs
// - 형태는 v4 B안(../src/symbol-b.svg) 그대로, 흰 배경 대비만 보정: 코르크 민트 #2BBFAF(약 2.3:1) → #17A193(약 3.2:1, 그래픽 3:1 기준)
// - favicon(16·32·48)은 투명 배경, apple-touch-icon(180)·앱 아이콘(192·512)은 불투명이 필요해 흰 바탕 + 여백
import fs from 'node:fs'
import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../../../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const svg = fs.readFileSync(path.join(here, 'smapsh-symbol-b.svg'), 'utf8')
const OUT = path.join(here, 'out'); fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch(); const p = await b.newPage()
const res = await p.evaluate(async (svg) => {
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode()
  const draw = (size, { bg = null, pad = 0 } = {}) => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size) } const s = size * (1 - pad * 2); x.drawImage(img, size * pad, size * pad, s, s); const a = x.getImageData(0, 0, 1, 1).data[3]; return { png: c.toDataURL('image/png').split(',')[1], cornerAlpha: a } }
  return { 'symbol-1024': draw(1024), 'symbol-512': draw(512), 'favicon-16': draw(16), 'favicon-32': draw(32), 'favicon-48': draw(48), 'apple-touch-icon-180': draw(180, { bg: '#FFFFFF', pad: 0.12 }), 'icon-192': draw(192, { bg: '#FFFFFF', pad: 0.12 }), 'icon-512': draw(512, { bg: '#FFFFFF', pad: 0.12 }) }
}, svg)
await b.close()
const alpha = {}
for (const [k, v] of Object.entries(res)) { fs.writeFileSync(path.join(OUT, `smapsh-${k}.png`), Buffer.from(v.png, 'base64')); alpha[k] = v.cornerAlpha }
const ico = [16, 32, 48].map((s) => fs.readFileSync(path.join(OUT, `smapsh-favicon-${s}.png`)))
const head = Buffer.alloc(6 + 16 * ico.length); head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4)
let off = head.length; ico.forEach((d, i) => { const s = [16, 32, 48][i], o = 6 + 16 * i; head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(d.length, o + 8); head.writeUInt32LE(off, o + 12); off += d.length })
fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, ...ico]))
console.log('corner alpha', JSON.stringify(alpha))
