// Visual Review 자동 검증(실험). 빌드 결과(dist)를 vite preview로 띄우고 Playwright Chromium으로 측정합니다.
// 결과 구분: measured(브라우저 측정) / calculated(설계값 계산) / visually-reviewed(사람이 스크린샷 확인, 보고서에 기록)
import fs from "node:fs"; import path from "node:path"; import { spawn } from "node:child_process";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, ".pw-browsers"); // 브라우저는 실험 폴더 안에만
const { chromium } = await import("playwright");
const OUT = path.join(root, "review"); const SHOTS = path.join(OUT, "screens"); fs.mkdirSync(SHOTS, { recursive: true });
const palette = JSON.parse(fs.readFileSync(path.join(OUT, "palette.json"), "utf8"));
const allowedHex = new Set([...Object.values(palette.colors), "#000000"]); // #000000은 그림자(elevation, 알파) 전용
const PORT = 55191, BASE = `http://localhost:${PORT}/`;
const VIEWPORTS = [{ w: 360, h: 800 }, { w: 390, h: 844 }, { w: 430, h: 932 }];
const SAFE = 34; // iPhone 가정값(calculated 기준과 같게)
const DENSITY_TARGET = { 360: 7.9, 390: 9.4, 430: 10.9 };

// ---- 정적 검사: 토큰 파일 밖 직접 색 ----
const srcFiles = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|css)$/.test(f)) srcFiles.push(p); } })(path.join(root, "src"));
const staticColors = [];
for (const f of srcFiles) { if (f.endsWith(path.join("styles", "tokens.css"))) continue; const lines = fs.readFileSync(f, "utf8").split("\n"); lines.forEach((l, i) => { const m = l.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|oklab\(/g); if (m && !/^\s*(\/\/|\/\*|\*)/.test(l)) staticColors.push({ file: path.relative(root, f), line: i + 1, match: m.join(" "), text: l.trim().slice(0, 120) }); }); }

// ---- 중립 화면 명세(dry-run IR)와 명단 비교 ----
const IR_PATH = path.resolve(root, "../../docs/design-profile/preview-handoff/C-screens.dryrun.json");
let irNames = null;
try { const ir = JSON.parse(fs.readFileSync(IR_PATH, "utf8")); const s = ir.screens.find(x => x.frame === "SCR-211 명단 / ST1 기본(C안) / mobile"); const names = []; (function w(n) { if (!n) return; if (n.c === "C/CMP-024 PersonRow" && n.v !== "kind=group") names.push(n.p.Name); for (const k of n.k || []) w(k); })({ k: s.tree }); irNames = names; } catch (e) { irNames = String(e); }

// ---- 서버 ----
const srv = spawn("pnpm", ["exec", "vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "pipe" });
let srvLog = ""; srv.stdout.on("data", d => srvLog += d); srv.stderr.on("data", d => srvLog += d);
for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE); if (r.ok) break; } catch { } await new Promise(r => setTimeout(r, 250)); }

// ---- 브라우저 안 측정 ----
function measure(allowed) {
  const R = el => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), bottom: +b.bottom.toFixed(1), right: +b.right.toFixed(1) }; };
  const vw = innerWidth, vh = innerHeight;
  const nav = document.querySelector("[data-testid=app-nav]"); const navR = R(nav);
  const rowEls = [...document.querySelectorAll("[data-testid=person-row]")];
  const rows = rowEls.map(el => ({ name: el.querySelector("[data-field=name]").textContent, ...R(el), li: R(el.closest("li")) }));
  let frac = 0, full = 0; for (const x of rows) { const v = Math.max(0, Math.min(x.bottom, navR.y) - Math.max(x.y, 0)) / x.h; frac += v; if (v > 0.999) full++; }
  // 색 도우미
  const parse = c => { if (!c || c === "transparent") return null; let m = c.match(/^rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; } m = c.match(/^color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[\s\/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] ?? 1 }; } return { unknown: c }; };
  const hex = c => "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  const lum = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && !c.unknown && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (const c of stack.reverse()) base = over(c, base); return base; };
  // 글자: 넘침·줄바꿈·대비
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const textEls = new Map();
  while (tw.nextNode()) { const t = tw.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement; if (el.closest(".sr-only")) continue; const range = document.createRange(); range.selectNodeContents(t); const rects = [...range.getClientRects()]; const prev = textEls.get(el) || { lines: 0, right: 0, left: Infinity }; prev.lines = Math.max(prev.lines, new Set(rects.map(r => Math.round(r.top))).size); for (const r of rects) { prev.right = Math.max(prev.right, r.right); prev.left = Math.min(prev.left, r.left); } textEls.set(el, prev); }
  const texts = [];
  for (const [el, t] of textEls) {
    const cs = getComputedStyle(el); const fg = parse(cs.color); const bg = bgOf(el); const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight;
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700); const need = large ? 3 : 4.5;
    const clipped = el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible";
    const r = el.getBoundingClientRect();
    texts.push({ text: el.textContent.trim().slice(0, 24), fontSize: fs, weight: fw, fontFamily: cs.fontFamily.split(",")[0], lines: t.lines, ratio: fg && !fg.unknown ? +ratio(over(fg, bg), bg).toFixed(2) : null, need, contrastOk: fg && !fg.unknown ? ratio(over(fg, bg), bg) >= need : null, fg: fg && !fg.unknown ? hex(fg) : String(fg && fg.unknown), bg: hex(bg), overflowX: t.right > vw + 0.5 || t.left < -0.5, clipped, ellipsis: cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1, inNav: !!el.closest("nav"), y: +r.y.toFixed(1) });
  }
  // 비텍스트 대비(아이콘, 입력칸·칩 경계, 스위치 트랙): 3:1
  const nonText = [];
  for (const svg of document.querySelectorAll("svg")) { const c = parse(getComputedStyle(svg).color); const bg = bgOf(svg.parentElement); if (c && !c.unknown) nonText.push({ what: "icon " + (svg.getAttribute("class") || "").split(" ").find(s => s.startsWith("lucide-")), ratio: +ratio(c, bg).toFixed(2), ok: ratio(c, bg) >= 3, fg: hex(c), bg: hex(bg) }); }
  for (const el of document.querySelectorAll("[data-cmp=CMP-006] label, [data-cmp=CMP-004] > span")) { const c = parse(getComputedStyle(el).borderTopColor); const fill = bgOf(el); const bg = bgOf(el.parentElement); if (c && !c.unknown) { const rb = ratio(c, bg), rf = ratio(fill, bg); nonText.push({ what: "boundary " + (el.textContent || "검색칸").trim().slice(0, 16), ratio: +Math.max(rb, rf).toFixed(2), by: rb >= rf ? "border" : "fill", ok: Math.max(rb, rf) >= 3, fg: hex(rb >= rf ? c : fill), bg: hex(bg) }); } }
  for (const el of document.querySelectorAll("[role=switch]")) { const c = parse(getComputedStyle(el).backgroundColor); const bg = bgOf(el.parentElement); nonText.push({ what: "switch track", ratio: +ratio(c, bg).toFixed(2), ok: ratio(c, bg) >= 3, fg: hex(c), bg: hex(bg) }); }
  // 부품 내부 넘침: 자식(스위치 손잡이·배지·아이콘)이 부품 경계를 벗어나는지(1차 검증에서 놓친 스위치 결함 대응)
  const containment = [];
  for (const host of document.querySelectorAll("[role=switch], [data-slot=badge], [data-cmp=CMP-004] > span, header button > span")) { const hb = host.getBoundingClientRect(); for (const ch of host.querySelectorAll("*")) { const cb = ch.getBoundingClientRect(); if (cb.width === 0) continue; const out = Math.max(hb.left - cb.left, cb.right - hb.right, hb.top - cb.top, cb.bottom - hb.bottom); if (out > 0.5) containment.push({ host: host.getAttribute("role") || host.getAttribute("data-slot") || host.tagName.toLowerCase(), child: ch.tagName.toLowerCase() + "." + String(ch.className.baseVal ?? ch.className).split(" ")[0], outPx: +out.toFixed(1) }); } }
  // 터치 영역(연결된 label 포함)
  const touch = [...document.querySelectorAll("button, a[href], input, [role=switch]")].map(el => { const b = el.getBoundingClientRect(); let w = b.width, h = b.height, via = "self"; const pb = getComputedStyle(el, "::before"); if (pb.content !== "none" && pb.position === "absolute") { const t = -parseFloat(pb.top) || 0, bt = -parseFloat(pb.bottom) || 0, l = -parseFloat(pb.left) || 0, rt = -parseFloat(pb.right) || 0; if (t > 0 || bt > 0 || l > 0 || rt > 0) { w = b.width + l + rt; h = b.height + t + bt; via = "::before"; } } const lab = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label"); if (lab) { const lb = lab.getBoundingClientRect(); if (lb.height * lb.width > w * h) { w = lb.width; h = lb.height; via = "label"; } } return { el: el.tagName.toLowerCase() + (el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""), name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 24), w: +w.toFixed(1), h: +h.toFixed(1), via, ok: w >= 43.5 && h >= 43.5 }; });
  // 렌더링된 색이 토큰 팔레트에 있는지
  const offPalette = []; const seen = new Set();
  for (const el of document.querySelectorAll("body *")) { const cs = getComputedStyle(el); const props = { color: cs.color, backgroundColor: cs.backgroundColor }; for (const s of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(cs["border" + s + "Width"]) > 0) props["border" + s] = cs["border" + s + "Color"]; if (el instanceof SVGElement) { props.stroke = cs.stroke; props.fill = cs.fill; }
    for (const [k, v] of Object.entries(props)) { if (!v || v === "none" || v === "transparent" || v === "currentcolor") continue; const c = parse(v); if (!c) continue; if (c.unknown) { if (!/url\(/.test(v)) offPalette.push({ prop: k, value: v, el: el.tagName.toLowerCase() }); continue; } if (c.a === 0) continue; const h = hex(c); if (!allowed.includes(h)) { const key = k + h; if (!seen.has(key)) { seen.add(key); offPalette.push({ prop: k, value: v, hex: h, alpha: c.a, el: el.tagName.toLowerCase() + "." + String(el.className.baseVal ?? el.className).split(" ").slice(0, 3).join(".") }); } } } }
  const header = document.querySelector("header"); const fontsOk = document.fonts.check('16px "Pretendard Variable"');
  const loadedFaces = [...document.fonts].filter(f => f.status === "loaded").map(f => f.family).filter((v, i, a) => a.indexOf(v) === i);
  return { vw, vh, scrollH: document.documentElement.scrollHeight, header: R(header), controls: R(document.querySelector("main > div")), listTop: rows[0].y, nav: navR, rows: rows.map(x => ({ name: x.name, y: x.y, h: x.h, liH: x.li.h })), visibleRowsFraction: +frac.toFixed(2), visibleRowsFull: full, texts, nonText, touch, offPalette, containment, fonts: { pretendardCheck: fontsOk, loadedFaces }, scrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom };
}
function bottomCheck() {
  const navR = document.querySelector("[data-testid=app-nav]").getBoundingClientRect();
  const rows = [...document.querySelectorAll("[data-testid=person-row]")]; const last = rows[rows.length - 1].getBoundingClientRect();
  const covered = [...document.querySelectorAll("main button, main a, main input, main [role=switch]")].filter(el => { const b = el.getBoundingClientRect(); return b.bottom > navR.top + 0.5 && b.top < navR.bottom && b.height > 0; }).map(el => (el.textContent || "").trim().slice(0, 16));
  return { lastRowBottom: +last.bottom.toFixed(1), navTop: +navR.top.toFixed(1), gap: +(navR.top - last.bottom).toFixed(1), coveredInteractive: covered };
}
function focusCheck() {
  const navR = document.querySelector("[data-testid=app-nav]").getBoundingClientRect(); const out = [];
  for (const el of document.querySelectorAll("[data-testid=person-row]")) { window.scrollTo(0, 0); el.focus(); const b = el.getBoundingClientRect(); if (b.bottom > navR.top + 0.5) out.push({ name: el.textContent.trim().slice(0, 12), bottom: +b.bottom.toFixed(1), navTop: +navR.top.toFixed(1) }); }
  document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); return { hiddenByNavAfterFocus: out };
}

// 스크린샷: Claude Code macOS 샌드박스에서 page.screenshot()이 멈춰 CDP Page.captureScreenshot을 씀(동작 확인)
async function shot(page, ctx, file, full) {
  const s = await ctx.newCDPSession(page);
  const opt = { format: "png" };
  if (full) { const h = await page.evaluate(() => document.documentElement.scrollHeight); const w = await page.evaluate(() => innerWidth); Object.assign(opt, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }); }
  const r = await Promise.race([s.send("Page.captureScreenshot", opt), new Promise((_, j) => setTimeout(() => j(new Error("screenshot timeout")), 15000))]);
  fs.writeFileSync(file, Buffer.from(r.data, "base64")); await s.detach();
}
const browser = await chromium.launch();
const results = { generatedAt: new Date().toISOString(), tool: "playwright " + (await import("playwright/package.json", { with: { type: "json" } })).default.version, browser: browser.version(), safeAreaAssumed: SAFE, viewports: [], staticColors, ir: { names: irNames } };
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ko-KR" });
  const page = await ctx.newPage(); const consoleMsgs = [];
  page.on("console", m => { if (["error", "warning"].includes(m.type())) consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 200) }); });
  page.on("pageerror", e => consoleMsgs.push({ type: "pageerror", text: String(e).slice(0, 200) }));
  await page.goto(BASE + "?safe=" + SAFE, { waitUntil: "networkidle" }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
  const m = await page.evaluate(measure, [...allowedHex]);
  await shot(page, ctx, path.join(SHOTS, `scr211-st1-${vp.w}.png`), false);
  await shot(page, ctx, path.join(SHOTS, `scr211-st1-${vp.w}-full.png`), true);
  const f = await page.evaluate(focusCheck);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(100);
  const bottom = await page.evaluate(bottomCheck); await shot(page, ctx, path.join(SHOTS, `scr211-st1-${vp.w}-bottom.png`), false);
  const chipWrap = m.texts.filter(t => /점수 미설정|튜토리얼 권장/.test(t.text)).map(t => t.y); const chipRows = new Set(chipWrap.map(Math.round)).size;
  // 칩 32 + 줄 간격 12(코드). Figma 기준 계산은 두 줄일 때 +40(간격 8)
  const calc = { headerAndBand: 112, controls: chipRows > 1 ? 148 : 104, nav: 64 + SAFE, figmaControls: chipRows > 1 ? 144 : 104 }; calc.listTop = calc.headerAndBand + calc.controls; calc.rows = +((vp.h - calc.nav - calc.listTop) / 56).toFixed(2);
  results.viewports.push({ ...vp, measured: m, bottom, focus: f, console: consoleMsgs, chipRows, calculated: calc, densityTarget: DENSITY_TARGET[vp.w] });
  await ctx.close();
}
await browser.close(); srv.kill(); setTimeout(() => process.exit(0), 300);
// ---- 요약 ----
const S = results.viewports.map(v => ({ width: v.w, height: v.h, rowHeight: [...new Set(v.measured.rows.map(r => r.liH))], listTop: v.measured.listTop, navTop: v.measured.nav.y, navH: v.measured.nav.h, visibleRows: v.measured.visibleRowsFraction, visibleRowsFull: v.measured.visibleRowsFull, target: v.densityTarget, meetsTarget: v.measured.visibleRowsFraction >= v.densityTarget, calcRows: v.calculated.rows, chipRows: v.chipRows,
  touchFail: v.measured.touch.filter(t => !t.ok), contrastFail: v.measured.texts.filter(t => t.contrastOk === false), nonTextFail: v.measured.nonText.filter(t => !t.ok), overflow: v.measured.texts.filter(t => t.overflowX || t.clipped || t.ellipsis), wrapped: v.measured.texts.filter(t => t.lines > 1).map(t => t.text), offPalette: v.measured.offPalette, containment: v.measured.containment, bottom: v.bottom, focusHidden: v.focus.hiddenByNavAfterFocus.length, console: v.console, fonts: v.measured.fonts }));
results.summary = S;
results.irMatch = Array.isArray(irNames) ? JSON.stringify(irNames) === JSON.stringify(results.viewports[0].measured.rows.map(r => r.name)) : irNames;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify({ staticColors: staticColors.length, irMatch: results.irMatch, summary: S.map(s => ({ ...s, touchFail: s.touchFail.length ? s.touchFail : 0, contrastFail: s.contrastFail.length ? s.contrastFail : 0, nonTextFail: s.nonTextFail.length ? s.nonTextFail : 0, overflow: s.overflow.length ? s.overflow : 0, offPalette: s.offPalette.length ? s.offPalette : 0 })) }, null, 1));
