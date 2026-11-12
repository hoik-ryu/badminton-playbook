// SMAPSH 심볼 v4 렌더러. 사용: node experiments/brand-assets/v4/render.mjs
// (먼저 gen.mjs로 src/*.svg 생성). c-preview-poc의 Playwright/Chromium을 읽기 전용으로 사용.
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const REPO = path.resolve(here, '../../..')
const POC = path.join(REPO, 'experiments/c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))

const SRC = path.join(here, 'src')
const OUT = path.join(here, 'out')
const WORK = path.join(here, '.work')
fs.mkdirSync(WORK, { recursive: true })
fs.mkdirSync(path.join(here, 'compare'), { recursive: true })

const FONT_CSS = `file://${REPO}/frontend/node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css`
const FONT = `'Pretendard Variable', Pretendard, system-ui, -apple-system, sans-serif`
const DARK = '#0B1F20'

const META = {
  a: { name: 'A · Smash Arc', ko: '스매시 아크', line: '타점에서 내리꽂히는 스매시 궤적이 셔틀(원)을 밀어내는 순간' },
  b: { name: 'B · Geo Shuttle', ko: '지오 셔틀', line: '원 + 부채꼴 3장으로 줄인 비행 중의 셔틀콕' },
  c: { name: 'C · Rally S', ko: '랠리 S', line: 'SMAPSH의 S를 주고받는 두 획(랠리)으로 구성' },
}
const KEYS = Object.keys(META)
const svgText = (k, v = '') => fs.readFileSync(path.join(SRC, `symbol-${k}${v ? '-' + v : ''}.svg`), 'utf8')
const dataUri = (s) => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64')
const uri = (k, v) => dataUri(svgText(k, v))

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] })

async function newPage(w, h, transparent = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const cdp = await page.context().newCDPSession(page)
  if (transparent) await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  return { page, cdp }
}

async function shotHtml(html, out, w, h) {
  const file = path.join(WORK, path.basename(out, '.png') + '-' + Math.random().toString(36).slice(2, 7) + '.html')
  fs.writeFileSync(file, html)
  const { page, cdp } = await newPage(w, h)
  await page.goto('file://' + file)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = r)))))
  })
  await page.waitForTimeout(150)
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(out, Buffer.from(r.data, 'base64'))
  await page.close()
}

// ---------- 1) 투명 PNG + 알파 검사 ----------
const { page: cp } = await newPage(200, 200, true)
await cp.goto('about:blank')
const alphaReport = []
for (const k of KEYS) {
  for (const v of ['', 'mono', 'white']) {
    for (const size of v ? [1024] : [1024, 512]) {
      const res = await cp.evaluate(
        async ({ src, size }) => {
          const img = new Image()
          img.src = src
          await img.decode()
          const c = document.createElement('canvas')
          c.width = c.height = size
          const x = c.getContext('2d')
          x.drawImage(img, 0, 0, size, size)
          const d = x.getImageData(0, 0, size, size).data
          const A = (px, py) => d[(py * size + px) * 4 + 3]
          const corners = [A(0, 0), A(size - 1, 0), A(0, size - 1), A(size - 1, size - 1)]
          // 불투명 영역 bbox (광학 중심/여백 확인용)
          let x0 = size, y0 = size, x1 = -1, y1 = -1, sx = 0, sy = 0, sa = 0
          for (let py = 0; py < size; py++)
            for (let px = 0; px < size; px++) {
              const a = A(px, py)
              if (a > 8) {
                if (px < x0) x0 = px
                if (px > x1) x1 = px
                if (py < y0) y0 = py
                if (py > y1) y1 = py
              }
              sx += px * a; sy += py * a; sa += a
            }
          return { url: c.toDataURL('image/png'), corners, bbox: [x0, y0, x1, y1], centroid: [sx / sa, sy / sa] }
        },
        { src: uri(k, v), size },
      )
      const name = `symbol-${k}${v ? '-' + v : ''}-${size}.png`
      fs.writeFileSync(path.join(OUT, k, name), Buffer.from(res.url.split(',')[1], 'base64'))
      const s = size / 100
      alphaReport.push({
        file: `out/${k}/${name}`,
        cornerAlpha: res.corners.join(','),
        bboxPct: res.bbox.map((n) => (n / s).toFixed(1)).join(','),
        bboxCenterPct: [((res.bbox[0] + res.bbox[2]) / 2 / s).toFixed(1), ((res.bbox[1] + res.bbox[3]) / 2 / s).toFixed(1)].join(','),
        centroidPct: res.centroid.map((n) => (n / s).toFixed(1)).join(','),
      })
    }
  }
}
await cp.close()
console.table(alphaReport)
fs.writeFileSync(path.join(here, 'out/alpha-check.json'), JSON.stringify(alphaReport, null, 2))

// ---------- 2) on-white / on-dark ----------
const stage = (bg, src) =>
  `<!doctype html><html><body style="margin:0;width:800px;height:800px;background:${bg};display:grid;place-items:center"><img src="${src}" style="width:480px;height:480px"></body></html>`
for (const k of KEYS) {
  await shotHtml(stage('#FFFFFF', uri(k)), path.join(OUT, k, 'on-white.png'), 800, 800)
  await shotHtml(stage(DARK, uri(k, 'white')), path.join(OUT, k, 'on-dark.png'), 800, 800)
}

// ---------- 3) sizes ----------
// 32/64/192 실제 크기 + 32px을 캔버스로 래스터화 후 4배 픽셀 확대
const zoomScript = `<script>
(async()=>{for(const el of document.querySelectorAll('canvas[data-src]')){const img=new Image();img.src=el.dataset.src;await img.decode();
const c=document.createElement('canvas');c.width=c.height=32;c.getContext('2d').drawImage(img,0,0,32,32);
const x=el.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(c,0,0,128,128)}document.body.dataset.ready=1})()</script>`
function sizesHtml(k) {
  const row = (bg, fg, src, label) => `
  <div class="row" style="background:${bg};color:${fg}">
    <div class="lab">${label}</div>
    <figure><img src="${src}" width="32" height="32"><figcaption>32</figcaption></figure>
    <figure><img src="${src}" width="64" height="64"><figcaption>64</figcaption></figure>
    <figure><img src="${src}" width="192" height="192"><figcaption>192</figcaption></figure>
    <figure><canvas width="128" height="128" data-src="${src}" style="width:128px;height:128px;outline:1px dashed ${fg}33"></canvas><figcaption>32px × 4 zoom</figcaption></figure>
  </div>`
  return `<!doctype html><html><head><link rel="stylesheet" href="${FONT_CSS}"><style>
  body{margin:0;font-family:${FONT};width:900px}
  .row{display:flex;align-items:flex-end;gap:40px;padding:28px 32px;height:250px;box-sizing:border-box}
  .lab{width:90px;font-size:13px;font-weight:600;align-self:center}
  figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
  figcaption{font-size:12px;opacity:.6}
  </style></head><body>
  ${row('#FFFFFF', '#191919', uri(k), 'Color / white')}
  ${row('#FFFFFF', '#191919', uri(k, 'mono'), 'Mono / white')}
  ${row(DARK, '#FFFFFF', uri(k, 'white'), 'White / dark')}
  ${zoomScript}</body></html>`
}
for (const k of KEYS) await shotHtml(sizesHtml(k), path.join(OUT, k, 'sizes.png'), 900, 750)

// ---------- 4) 로그인 목업 ----------
function loginInner(k) {
  return `<main class="lg">
    <section class="brand"><img src="${uri(k)}" alt="" width="108" height="108"><h1>SMAPSH</h1></section>
    <section class="cta"><button>카카오로 시작하기</button><p>개발 단계: Mock 카카오 인증입니다(실제 카카오 로그인 미연결)</p></section>
  </main>`
}
const loginCss = `
  *{box-sizing:border-box} body{margin:0;font-family:${FONT}}
  .lg{background:#fff;height:100%;padding:24px 16px;display:flex;flex-direction:column}
  .brand{flex:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
  .brand img{display:block}
  .brand h1{margin:0;color:#006D68;font-size:32px;font-weight:800;letter-spacing:.02em;line-height:1.2}
  .cta{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:12px;padding-bottom:24px}
  .cta button{width:100%;height:48px;border:0;border-radius:10px;background:#FEE500;color:#191919;font:700 16px ${FONT}}
  .cta p{margin:0;text-align:center;font-size:13px;color:#545A65}`
const loginMobile = (k) =>
  `<!doctype html><html style="height:100%"><head><link rel="stylesheet" href="${FONT_CSS}"><style>${loginCss} body{height:100%}</style></head><body>${loginInner(k)}</body></html>`
const loginDesktop = (k) =>
  `<!doctype html><html style="height:100%"><head><link rel="stylesheet" href="${FONT_CSS}"><style>${loginCss}
  body{height:100%;background:#F4F5F7}.col{width:600px;height:100%;margin:0 auto;background:#fff}</style></head><body><div class="col">${loginInner(k)}</div></body></html>`
for (const k of KEYS) {
  await shotHtml(loginMobile(k), path.join(OUT, k, 'login.png'), 390, 844)
  await shotHtml(loginDesktop(k), path.join(OUT, k, 'login-1440.png'), 1440, 900)
}

// ---------- 5) 비교 개요 ----------
const png = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')
function overviewHtml() {
  const col = (k) => `
  <div class="col">
    <header><div class="nm">${META[k].name} <span>${META[k].ko}</span></div><div class="ln">${META[k].line}</div></header>
    <div class="pair">
      <div class="tile" style="background:#fff"><img src="${uri(k)}" width="150" height="150"><i>컬러</i></div>
      <div class="tile" style="background:${DARK}"><img src="${uri(k, 'white')}" width="150" height="150"><i style="color:#fff9">다크(화이트)</i></div>
    </div>
    <div class="pair">
      <div class="tile" style="background:#fff"><img src="${uri(k, 'mono')}" width="150" height="150"><i>모노 #006D68</i></div>
      <div class="tile small" style="background:#fff">
        <div class="sz"><img src="${uri(k)}" width="32" height="32"><img src="${uri(k)}" width="64" height="64"></div>
        <div class="sz" style="background:${DARK}"><img src="${uri(k, 'white')}" width="32" height="32"><img src="${uri(k, 'white')}" width="64" height="64"></div>
        <i>32 / 64px</i>
      </div>
    </div>
    <div class="phone"><img src="${png(path.join(OUT, k, 'login.png'))}" width="273" height="591"></div>
  </div>`
  return `<!doctype html><html><head><link rel="stylesheet" href="${FONT_CSS}"><style>
  body{margin:0;background:#F4F5F7;font-family:${FONT};color:#191919;width:1320px}
  h2{margin:0;padding:32px 40px 4px;font-size:24px;font-weight:800;color:#006D68}
  .sub{padding:0 40px 20px;font-size:14px;color:#545A65}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:0 40px 40px}
  .col{background:#fff;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px;border:1px solid #E5E7EB}
  .nm{font-size:20px;font-weight:800}.nm span{font-size:15px;font-weight:600;color:#545A65;margin-left:6px}
  .ln{font-size:13px;color:#545A65;margin-top:4px;min-height:18px}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .tile{position:relative;height:190px;border-radius:12px;border:1px solid #E5E7EB;display:grid;place-items:center}
  .tile i{position:absolute;left:10px;bottom:8px;font-style:normal;font-size:11px;color:#545A65}
  .tile.small{display:flex;flex-direction:column;justify-content:center;gap:8px;padding:8px}
  .sz{display:flex;align-items:center;justify-content:center;gap:16px;border-radius:8px;padding:8px;width:100%;box-sizing:border-box}
  .phone{display:flex;justify-content:center;background:#F4F5F7;border-radius:12px;padding:12px}
  .phone img{border-radius:18px;border:1px solid #D9DCE1;box-shadow:0 2px 10px #0001}
  </style></head><body>
  <h2>SMAPSH 심볼 후보 v4 — A / B / C 비교</h2>
  <div class="sub">순수 벡터(SVG) · 배경 타일 없음 · 컬러 / 다크 / 모노 / 작은 크기 / 로그인 목업 (실제 앱에는 미적용)</div>
  <div class="grid">${KEYS.map(col).join('')}</div></body></html>`
}
await shotHtml(overviewHtml(), path.join(here, 'compare/overview.png'), 1320, 1290)

await browser.close()
fs.rmSync(WORK, { recursive: true, force: true })
console.log('done')
