// 심볼 v2 검증: 알파 채널 실측, 두 버전 윤곽·크기 동일성, 흰·검정 배경 비교 이미지, 32·64px 식별성 이미지.
// 사용: node experiments/brand-assets/symbol-v2/verify-symbol.mjs
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const POC = path.resolve(here, '../../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const OUT = path.join(here, 'out'), CMP = path.join(here, 'compare'); fs.mkdirSync(CMP, { recursive: true })
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')
const dark = b64(path.join(OUT, 'smapsh-symbol-dark.png')), light = b64(path.join(OUT, 'smapsh-symbol-light.png')), lightTokens = b64(path.join(OUT, 'smapsh-symbol-light-tokens.png'))
const board = b64(path.resolve(here, '../source/brand-board.png'))
const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'extract-meta.json'), 'utf8'))

// PNG 헤더(IHDR)에서 색 형식 확인: 6 = RGBA
const ihdr = (f) => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bitDepth: b[24], colorType: b[25] } }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
const alpha = await page.evaluate(async ({ dark, light, lightTokens }) => {
  const load = async (s) => { const i = new Image(); i.src = s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height) }
  const D = await load(dark), L = await load(light), n = D.width * D.height
  const stat = (I) => { let zero = 0, full = 0, partial = 0; for (let k = 0; k < n; k++) { const a = I.data[k * 4 + 3]; if (a === 0) zero++; else if (a === 255) full++; else partial++ } return { zero, full, partial, zeroPct: +(zero / n * 100).toFixed(1) } }
  // 테두리 1px 띠(여백) 알파 최댓값, 네 모서리
  const edgeMax = (I) => { let mx = 0; for (let i = 0; i < I.width; i++) for (const j of [0, I.height - 1]) mx = Math.max(mx, I.data[(j * I.width + i) * 4 + 3]); for (let j = 0; j < I.height; j++) for (const i of [0, I.width - 1]) mx = Math.max(mx, I.data[(j * I.width + i) * 4 + 3]); return mx }
  let diff = 0, maxDiff = 0; for (let k = 0; k < n; k++) { const d = Math.abs(D.data[k * 4 + 3] - L.data[k * 4 + 3]); if (d) diff++; maxDiff = Math.max(maxDiff, d) }
  const T = await load(lightTokens); let diffB = 0; for (let k = 0; k < n; k++) if (D.data[k * 4 + 3] !== T.data[k * 4 + 3]) diffB++
  return { lightTokensAlphaDiffPixels: diffB, lightTokens: { ...stat(T), borderMaxAlpha: edgeMax(T) }, size: [D.width, D.height, L.width, L.height], dark: { ...stat(D), borderMaxAlpha: edgeMax(D) }, light: { ...stat(L), borderMaxAlpha: edgeMax(L) }, alphaDiffPixels: diff, alphaMaxDiff: maxDiff }
}, { dark, light, lightTokens })

const shot = async (html, file, w, h) => { await page.setViewportSize({ width: w, height: h }); await page.setContent(html); await page.waitForTimeout(300); const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(CMP, file), Buffer.from(r.data, 'base64')); await s.detach() }
const [bx, by, bx2, by2] = meta.size.boardBox, pad = meta.size.pad
const css = `body{margin:0;font:13px system-ui;color:#555;background:#fff}.row{display:flex;gap:16px;padding:16px;align-items:center}.cap{font-size:12px;margin-top:6px}.ck{background:repeating-conic-gradient(#d0d0d0 0 25%,#fff 0 50%) 0 0/14px 14px}figure{margin:0;text-align:center}`
// 1) 원본 대비 + 흰·검정 배경
const crop = `<div style="width:${bx2 - bx + 1 + pad * 2}px;height:${by2 - by + 1 + pad * 2}px;background:url(${board}) -${bx - pad}px -${by - pad}px no-repeat"></div>`
await shot(`<style>${css}</style>
<div class="row" style="background:#fff"><figure>${crop}<div class="cap">원본(보드에서 같은 범위)</div></figure></div>
<div class="row" style="background:#000"><figure><img src="${dark}"><div class="cap" style="color:#aaa">dark · 검정 배경</div></figure><figure><img src="${light}"><div class="cap" style="color:#aaa">light · 검정 배경</div></figure></div>
<div class="row" style="background:#fff"><figure><img src="${dark}"><div class="cap">dark · 흰 배경</div></figure><figure><img src="${light}"><div class="cap">light · 흰 배경</div></figure></div>
<div class="row ck"><figure><img src="${dark}"><div class="cap">dark · 투명 확인(체크무늬)</div></figure><figure><img src="${light}"><div class="cap">light · 투명 확인(체크무늬)</div></figure></div>`, 'compare-backgrounds.png', 1240, 1500)
// 2) 작은 크기(32·64px): 실제 크기와 4배 확대(픽셀 그대로)
const small = (src, bg, s) => `<figure><canvas data-src="${src}" data-s="${s}" style="background:${bg}"></canvas><div class="cap">${s}px 실제</div></figure><figure><canvas data-src="${src}" data-s="${s}" data-zoom="4" style="background:${bg};image-rendering:pixelated"></canvas><div class="cap">${s}px ×4</div></figure>`
await shot(`<style>${css}</style><div class="row" style="background:#000;color:#aaa">${[32, 64].map((s) => small(dark, '#000', s)).join('')}</div><div class="row" style="background:#fff">${[32, 64].map((s) => small(light, '#fff', s)).join('')}</div><div class="row" style="background:#fff">${[32, 64].map((s) => small(dark, '#fff', s)).join('')}</div><div class="row" style="background:#000;color:#aaa">${[32, 64].map((s) => small(light, '#000', s)).join('')}</div>
<script>(async()=>{for(const c of document.querySelectorAll('canvas')){const i=new Image();i.src=c.dataset.src;await i.decode();const s=+c.dataset.s,z=+(c.dataset.zoom||1);const k=Math.min(s/i.width,s/i.height);
// 긴 변 = s px로 단계 축소(고품질)
let cur=i,cw=i.width,ch=i.height;const tw=Math.round(i.width*k),th=Math.round(i.height*k);while(cw/2>=tw){const n=document.createElement('canvas');n.width=Math.round(cw/2);n.height=Math.round(ch/2);const x=n.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(cur,0,0,n.width,n.height);cur=n;cw=n.width;ch=n.height}
const f=document.createElement('canvas');f.width=tw;f.height=th;const fx=f.getContext('2d');fx.imageSmoothingQuality='high';fx.drawImage(cur,0,0,tw,th);c.width=s;c.height=s;c.getContext('2d').drawImage(f,(s-tw)/2,(s-th)/2);c.style.width=s*z+'px';c.style.height=s*z+'px'}})()</script>`, 'compare-small-32-64.png', 1000, 900)
await browser.close()

const report = { files: { dark: ihdr(path.join(OUT, 'smapsh-symbol-dark.png')), light: ihdr(path.join(OUT, 'smapsh-symbol-light.png')), lightTokens: ihdr(path.join(OUT, 'smapsh-symbol-light-tokens.png')) }, alpha }
fs.writeFileSync(path.join(CMP, 'verify.json'), JSON.stringify(report, null, 1))
console.log(JSON.stringify(report))
