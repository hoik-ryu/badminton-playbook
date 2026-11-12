// 브랜드 심볼과 기존 디자인 시스템(04 토큰 + theme.json, 실제 frontend·design-preview 스타일)의 조화 확인 이미지.
// 사용: node experiments/brand-assets/symbol-v2/harmony.mjs → compare/compare-ui-harmony.png
// UI 요소 값은 승인 토큰 그대로: action.primary #006D68, focus.ring #008F89, radius.md 10, radius.sm 6, 탭 56·아이콘 24(VD-019), Lucide(VD-002)
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const repo = path.resolve(here, '../../..')
const POC = path.resolve(repo, 'experiments/c-preview-poc')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, '.pw-browsers')
const { chromium } = await import(path.join(POC, 'node_modules/playwright/index.mjs'))
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(here, 'out', f)).toString('base64')
const [dark, lightA, lightB] = ['smapsh-symbol-dark.png', 'smapsh-symbol-light.png', 'smapsh-symbol-light-tokens.png'].map(b64)

// Lucide 아이콘(design-preview에 설치된 lucide-react의 정의를 읽기만 함)
const iconSrc = (name) => fs.readFileSync(path.join(repo, `design-preview/node_modules/lucide-react/dist/esm/icons/${name}.mjs`), 'utf8')
const icon = (name, color) => {
  const body = iconSrc(name).match(/const __iconData = (\{[\s\S]*?\n\});/)[1]
  const node = Function(`return ${body}`)().node // 로컬 패키지의 정적 객체 리터럴
  const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
}
const tab = (name, label, on) => `<div style="flex:1;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;height:56px;color:${on ? '#006D68' : '#545A65'};font-weight:${on ? 700 : 400};font-size:13px">${on ? '<span style="position:absolute;top:0;width:32px;height:3px;border-radius:0 0 6px 6px;background:#006D68"></span>' : ''}${icon(name, on ? '#006D68' : '#545A65')}<span>${label}</span></div>`

const css = `*{box-sizing:border-box}body{margin:0;font:14px "Pretendard Variable",system-ui,sans-serif;color:#1A1D23;background:#fff}
.sec{padding:20px 24px;border-bottom:1px solid #D5D9E0}.t{font-size:13px;color:#545A65;margin:0 0 12px}
.row{display:flex;gap:20px;align-items:center;flex-wrap:wrap}.phone{width:360px;border:1px solid #D5D9E0;border-radius:10px;overflow:hidden;background:#fff}
.btn{height:48px;padding:0 16px;border-radius:10px;font-weight:700;font-size:16px;display:inline-flex;align-items:center;justify-content:center}
.cap{font-size:12px;color:#545A65;text-align:center;margin-top:6px}figure{margin:0}`
const html = `<style>${css}</style>
<div class="sec"><p class="t">① 밝은 배경 심볼 A(현재: 짙은 teal #00524E → #008F89 → mint #3FD2C2, 테마 밖 색 2개) / B(테마 원시 값만: teal-700 #006D68 → teal-600 #008F89)</p>
<div class="row"><figure><img src="${lightA}" width="200"><div class="cap">A · 200px</div></figure><figure><img src="${lightB}" width="200"><div class="cap">B · 200px</div></figure>
<figure><img src="${lightA}" width="64"><div class="cap">A · 64</div></figure><figure><img src="${lightB}" width="64"><div class="cap">B · 64</div></figure>
<figure><img src="${lightA}" width="32"><div class="cap">A · 32</div></figure><figure><img src="${lightB}" width="32"><div class="cap">B · 32</div></figure></div></div>
<div class="sec"><p class="t">② 서비스 UI와 나란히(로그인 구조: 브랜드 영역 + 카카오 버튼 / 하단 탭 Lucide 24px·선 2 / 버튼·배지 radius 10·6)</p>
<div class="row" style="align-items:flex-start">
 <div class="phone"><div style="height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px"><img src="${lightA}" width="150"><div style="font-size:12px;color:#545A65">(A) 심볼만 · 워드마크 자리 비움</div></div>
  <div style="padding:0 16px 16px"><div class="btn" style="width:100%;background:#FEE500;color:#191919">카카오로 시작하기</div></div></div>
 <div class="phone"><div style="height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px"><img src="${lightB}" width="150"><div style="font-size:12px;color:#545A65">(B) 심볼만 · 워드마크 자리 비움</div></div>
  <div style="padding:0 16px 16px"><div class="btn" style="width:100%;background:#FEE500;color:#191919">카카오로 시작하기</div></div></div>
 <div style="display:flex;flex-direction:column;gap:12px;width:360px">
  <div class="row" style="gap:10px"><span class="btn" style="background:#006D68;color:#fff">저장</span><span class="btn" style="border:1px solid #6B7280;color:#1A1D23;background:#fff">취소</span>
   <span style="height:24px;padding:0 8px;border-radius:6px;background:#FFF3D1;color:#7A4F00;font-weight:700;font-size:13px;display:inline-flex;align-items:center">미설정</span>
   <span style="height:24px;padding:0 8px;border-radius:6px;background:#E4F4E8;color:#1B6E35;font-weight:700;font-size:13px;display:inline-flex;align-items:center">진행 중</span></div>
  <div style="display:flex;border-top:1px solid #D5D9E0;border:1px solid #D5D9E0;border-radius:10px;overflow:hidden">${tab('graduation-cap', '튜토리얼')}${tab('swords', '청백전')}${tab('circle-user-round', '마이페이지')}${tab('clipboard-list', '운영', true)}</div>
  <div class="row" style="gap:12px"><img src="${lightA}" width="40"> ${icon('search', '#545A65')} ${icon('plus', '#545A65')} ${icon('chevron-right', '#545A65')} <span style="font-size:12px;color:#545A65">심볼(40) 옆 Lucide 기능 아이콘(24)</span></div>
 </div></div></div>
<div class="sec" style="background:#02090A;border:0"><p class="t" style="color:#9aa">③ 어두운 배경(인트로 무대 #02090A) — dark 심볼과 인트로 건너뛰기 버튼(알약형 999px, 실험 값)</p>
<div class="row"><img src="${dark}" width="260"><img src="${dark}" width="64"><img src="${dark}" width="32"><span style="height:44px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.45);color:#fff;font-weight:700;display:inline-flex;align-items:center">건너뛰기</span></div></div>`
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1180, height: 900 } })
await page.setContent(html); await page.waitForTimeout(400)
const h = await page.evaluate(() => document.body.scrollHeight); await page.setViewportSize({ width: 1180, height: h })
const s = await page.context().newCDPSession(page); const r = await s.send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(path.join(here, 'compare/compare-ui-harmony.png'), Buffer.from(r.data, 'base64')); await browser.close()
console.log('ok', h)
