// 브랜드 자산 확인용 모아보기 캡처. 사용: node experiments/brand-assets/shot.mjs <html> <out.jpg> [width] [height]
import fs from 'node:fs'; import path from 'node:path'
const here = path.dirname(new URL(import.meta.url).pathname); const POC = path.resolve(here, '../c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const [html, out, w = 1400, h = 1100] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] }); const p = await b.newPage({ viewport: { width: +w, height: +h } })
await p.goto('file://' + path.resolve(html)); await p.waitForTimeout(400)
const s = await p.context().newCDPSession(p); const r = await s.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 })
fs.writeFileSync(out, Buffer.from(r.data, 'base64')); await b.close()
