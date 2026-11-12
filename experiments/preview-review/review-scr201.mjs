// 정식 design-preview/의 화면 측정(실험 보조 스크립트, 승인 트리 해시 밖).
// SCR-201 운영 홈용 사본(review.mjs에서 행 선택자·하단 검사만 바꿈). 사용: node experiments/preview-review/review-scr201.mjs
// - design-preview/dist를 vite preview(55181)로 띄우고 ?bare=1&safe=34 로 화면만 렌더해 측정합니다.
// - Playwright·Chromium은 experiments/c-preview-poc/에 설치된 것을 읽기만 합니다(그 폴더는 수정하지 않음).
// - 결과 구분: measured(브라우저 측정) / calculated(설계값 계산). visually-reviewed는 보고서에 기록.
import fs from "node:fs"; import path from "node:path"; import { spawn } from "node:child_process";
const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, "../..");
const POC = path.join(repo, "experiments/c-preview-poc");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, ".pw-browsers");
const { chromium } = await import(path.join(POC, "node_modules/playwright/index.mjs"));
const [SCREEN = "SCR-201", STATE = "SCR-201-ST1"] = process.argv.slice(2);
const OUT = path.join(here, "results", SCREEN); const SHOTS = path.join(OUT, "screens"); fs.mkdirSync(SHOTS, { recursive: true });
const PREVIEW = path.join(repo, "design-preview");
const PORT = 55182, BASE = `http://localhost:${PORT}/`;
const VIEWPORTS = [{ w: 360, h: 800 }, { w: 390, h: 844 }, { w: 430, h: 932 }];
const SAFE = 34;
const DENSITY = {}; // density 정책은 SCR-211 기준이라 SCR-201에는 적용하지 않음

// 팔레트: tokens.css의 색(04 + theme.json) + 그림자용 #000(알파)
const tokensCss = fs.readFileSync(path.join(PREVIEW, "src/tokens.css"), "utf8");
const allowedHex = [...new Set([...tokensCss.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(m => m[0].toUpperCase()).concat(["#000000"]))];
// 정적 검사: 화면·CMP 코드와 Tailwind 진입 CSS의 직접 색(shadcn 원본 부품·프리뷰 셸은 별도 표시)
const staticColors = [];
for (const dir of ["src/screens", "src/components/smapsh", "src/app.css", "src/components/ui"]) {
  const p = path.join(PREVIEW, dir); const files = fs.statSync(p).isDirectory() ? fs.readdirSync(p).map(f => path.join(p, f)) : [p];
  for (const f of files) fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => { const m = l.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|oklab\(/g); if (m && !/^\s*(\/\/|\/\*|\*)/.test(l)) staticColors.push({ file: path.relative(repo, f), line: i + 1, match: m.join(" "), scope: dir.includes("/ui") ? "shadcn 원본(미사용 변형일 수 있음)" : "화면·CMP" }); });
}

const srv = spawn("pnpm", ["exec", "vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: PREVIEW, stdio: "pipe" });
for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE)).ok) break; } catch { } await new Promise(r => setTimeout(r, 250)); }

function measure(allowed) {
  const R = el => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), bottom: +b.bottom.toFixed(1), right: +b.right.toFixed(1) }; };
  const vw = innerWidth;
  const nav = document.querySelector("[data-testid=app-nav]"), navR = R(nav);
  const fab = document.querySelector("[data-testid=fab]"), fabR = fab ? R(fab) : null;
  const rowEls = [...document.querySelectorAll("[data-testid=list-item]")];
  const rows = rowEls.map(el => ({ name: el.textContent.trim(), to: el.getAttribute("data-to"), target: el.getAttribute("data-preview-target"), href: el.getAttribute("href"), aria: el.getAttribute("aria-label"), ...R(el), li: R(el.closest("li")) }));
  let frac = 0, full = 0; for (const x of rows) { const v = Math.max(0, Math.min(x.bottom, navR.y) - Math.max(x.y, 0)) / x.h; frac += v; if (v > 0.999) full++; }
  // 떠 있는 버튼과 행 내용(이름·정보·점수)의 겹침: 첫 화면 기준(R6 의도적 예외 여부를 수치로)
  const fabOverRows = []; if (false) for (const el of rowEls) { for (const f of el.querySelectorAll("[data-field]")) { const b = f.getBoundingClientRect(); if (b.right > fabR.x && b.left < fabR.right && b.bottom > fabR.y && b.top < fabR.bottom) fabOverRows.push({ row: el.querySelector("[data-field=name]").textContent, field: f.getAttribute("data-field"), overlapX: +(b.right - fabR.x).toFixed(1) }); } }
  const rowContentRightMax = Math.max(...rowEls.map(el => el.querySelector("svg").getBoundingClientRect().right));
  const tabBadge = document.querySelector("[data-testid=tab-badge]"); const navStyle = getComputedStyle(nav);
  const safe = { navPaddingBottom: parseFloat(navStyle.paddingBottom), navBottom: +navR.bottom.toFixed(1), vh: innerHeight, tabBadge: tabBadge ? { indicatorOverlap: (() => { const ind = tabBadge.closest("li").querySelector(":scope > span[aria-hidden]"); if (!ind) return null; const i = ind.getBoundingClientRect(), t = tabBadge.getBoundingClientRect(); return Math.max(0, Math.min(i.bottom, t.bottom) - Math.max(i.top, t.top)) * (Math.max(0, Math.min(i.right, t.right) - Math.max(i.left, t.left)) > 0 ? 1 : 0); })(), ...R(tabBadge), text: tabBadge.textContent, link: tabBadge.closest("a").getAttribute("aria-label") } : null };
  const parse = c => { if (!c || c === "transparent") return null; let m = c.match(/^rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; } m = c.match(/^color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[\s\/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] ?? 1 }; } return { unknown: c }; };
  const hex = c => "#" + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  const lum = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const bgOf = el => { const st = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && !c.unknown && c.a > 0) { st.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (const c of st.reverse()) base = over(c, base); return base; };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const textEls = new Map();
  while (tw.nextNode()) { const t = tw.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement; if (el.closest(".sr-only")) continue; const range = document.createRange(); range.selectNodeContents(t); const rects = [...range.getClientRects()]; const prev = textEls.get(el) || { lines: 0, right: 0, left: Infinity }; prev.lines = Math.max(prev.lines, new Set(rects.map(r => Math.round(r.top))).size); for (const r of rects) { prev.right = Math.max(prev.right, r.right); prev.left = Math.min(prev.left, r.left); } textEls.set(el, prev); }
  const texts = [];
  for (const [el, t] of textEls) { const cs = getComputedStyle(el); const fg = parse(cs.color); const bg = bgOf(el); const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight; const need = (fs >= 24 || (fs >= 18.66 && fw >= 700)) ? 3 : 4.5; const r0 = fg && !fg.unknown ? ratio(over(fg, bg), bg) : null;
    texts.push({ text: el.textContent.trim().slice(0, 24), fontSize: fs, weight: fw, fontFamily: cs.fontFamily.split(",")[0], lines: t.lines, ratio: r0 && +r0.toFixed(2), need, contrastOk: r0 == null ? null : r0 >= need, overflowX: t.right > vw + 0.5 || t.left < -0.5, clipped: el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible", ellipsis: cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1 }); }
  const nonText = [];
  for (const svg of document.querySelectorAll(".smapsh svg")) { const c = parse(getComputedStyle(svg).color); const bg = bgOf(svg.parentElement); if (c && !c.unknown) nonText.push({ what: "icon " + (svg.getAttribute("class") || "").split(" ").find(s => s.startsWith("lucide-")), ratio: +ratio(c, bg).toFixed(2), ok: ratio(c, bg) >= 3 }); }
  for (const el of document.querySelectorAll("[data-cmp=CMP-006], [data-cmp=CMP-004] > span")) { const c = parse(getComputedStyle(el).borderTopColor); const fill = bgOf(el), bg = bgOf(el.parentElement); if (c && !c.unknown) { const v = Math.max(ratio(c, bg), ratio(fill, bg)); nonText.push({ what: "boundary " + (el.textContent || "검색칸").trim().slice(0, 16), ratio: +v.toFixed(2), ok: v >= 3 }); } }
  for (const el of document.querySelectorAll("[role=switch]")) { const c = parse(getComputedStyle(el).backgroundColor), bg = bgOf(el.parentElement); nonText.push({ what: "switch track", ratio: +ratio(c, bg).toFixed(2), ok: ratio(c, bg) >= 3 }); }
  const curTab = document.querySelector("[aria-current=page]"); const ind = curTab && curTab.parentElement.querySelector("span[aria-hidden]"); if (ind) { const c = parse(getComputedStyle(ind).backgroundColor); nonText.push({ what: "current tab indicator", ratio: +ratio(c, bgOf(ind.parentElement)).toFixed(2), ok: ratio(c, bgOf(ind.parentElement)) >= 3 }); }
  const containment = [];
  for (const host of document.querySelectorAll("[data-cmp=CMP-005], [data-testid=list-item], [data-testid=app-nav] a")) { const hb = host.getBoundingClientRect(); for (const ch of host.querySelectorAll("*")) { const cb = ch.getBoundingClientRect(); if (cb.width === 0) continue; const out = Math.max(hb.left - cb.left, cb.right - hb.right, hb.top - cb.top, cb.bottom - hb.bottom); if (out > 0.5) containment.push({ host: host.getAttribute("role") || host.getAttribute("data-slot") || host.getAttribute("data-testid"), outPx: +out.toFixed(1) }); } }
  const touch = [...document.querySelectorAll(".smapsh button, .smapsh a[href], .smapsh input, .smapsh [role=switch]")].map(el => { const b = el.getBoundingClientRect(); let w = b.width, h = b.height, via = "self"; const pb = getComputedStyle(el, "::before"); if (pb.content !== "none" && pb.position === "absolute") { const t = -parseFloat(pb.top) || 0, bt = -parseFloat(pb.bottom) || 0, l = -parseFloat(pb.left) || 0, rt = -parseFloat(pb.right) || 0; if (t > 0 || bt > 0 || l > 0 || rt > 0) { w = b.width + l + rt; h = b.height + t + bt; via = "::before"; } } const lab = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label"); if (lab) { const lb = lab.getBoundingClientRect(); if (lb.height * lb.width > w * h) { w = lb.width; h = lb.height; via = "label"; } } return { el: el.tagName.toLowerCase(), name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 24), w: +w.toFixed(1), h: +h.toFixed(1), via, ok: w >= 43.5 && h >= 43.5 }; });
  const offPalette = []; const seen = new Set();
  for (const el of document.querySelectorAll(".smapsh, .smapsh *")) { const cs = getComputedStyle(el); const props = { color: cs.color, backgroundColor: cs.backgroundColor }; for (const s of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(cs["border" + s + "Width"]) > 0) props["border" + s] = cs["border" + s + "Color"]; if (el instanceof SVGElement) { props.stroke = cs.stroke; props.fill = cs.fill; }
    for (const [k, v] of Object.entries(props)) { if (!v || v === "none" || v === "transparent" || v === "currentcolor") continue; const c = parse(v); if (!c) continue; if (c.unknown) { offPalette.push({ prop: k, value: v }); continue; } if (c.a === 0) continue; const h = hex(c); if (!allowed.includes(h) && !seen.has(k + h)) { seen.add(k + h); offPalette.push({ prop: k, hex: h, alpha: c.a, el: el.tagName.toLowerCase() }); } } }
  const chipRows = new Set([...document.querySelectorAll("[data-cmp=CMP-004]")].map(c => Math.round(c.getBoundingClientRect().top))).size;
  return { chipRows, vw, scrollW: document.documentElement.scrollWidth, horizontalScroll: document.documentElement.scrollWidth > vw + 0.5, header: R(document.querySelector("[data-testid=page-header]")), headerButtons: document.querySelectorAll("[data-testid=page-header] button").length, title: document.querySelector("h1").textContent, safe, menu: rows, listTop: rows[0].y, nav: navR, fab: fabR, rows: rows.map(x => ({ name: x.name, y: x.y, h: x.h, liH: x.li.h })), visibleRowsFraction: +frac.toFixed(2), visibleRowsFull: full, fabOverRows, rowContentRightMax: +rowContentRightMax.toFixed(1), texts, nonText, containment, touch, offPalette, fonts: { pretendard: document.fonts.check('16px "Pretendard Variable"'), loaded: [...new Set([...document.fonts].filter(f => f.status === "loaded").map(f => f.family))] } };
}
function bottomCheck() {
  const navR = document.querySelector("[data-testid=app-nav]").getBoundingClientRect(); const fab = document.querySelector("[data-testid=fab]"); const fabR = fab && fab.getBoundingClientRect();
  const rows = [...document.querySelectorAll("[data-testid=list-item]")]; const last = rows[rows.length - 1].getBoundingClientRect();
  const blockers = [navR, fabR].filter(Boolean);
  const covered = [...document.querySelectorAll("main button, main a, main input, main [role=switch]")].filter(el => { const b = el.getBoundingClientRect(); return b.height > 0 && blockers.some(k => b.bottom > k.top + 0.5 && b.top < k.bottom && b.right > k.left && b.left < k.right); }).map(el => (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 16));
  return { lastRowBottom: +last.bottom.toFixed(1), navTop: +navR.top.toFixed(1), fabTop: fabR ? +fabR.top.toFixed(1) : null, gapToFab: fabR ? +(fabR.top - last.bottom).toFixed(1) : null, coveredInteractive: covered };
}
function focusCheck() {
  const navR = document.querySelector("[data-testid=app-nav]").getBoundingClientRect(); const fab = document.querySelector("[data-testid=fab]"); const out = [];
  for (const el of document.querySelectorAll("[data-testid=list-item]")) { window.scrollTo(0, 0); el.focus(); const b = el.getBoundingClientRect(); if (b.bottom > navR.top + 0.5) out.push({ row: el.textContent, bottom: +b.bottom.toFixed(1) }); }
  document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); return out;
}
async function shot(page, ctx, file, full) {
  const s = await ctx.newCDPSession(page); const opt = { format: "png" };
  if (full) { const h = await page.evaluate(() => document.documentElement.scrollHeight); const w = await page.evaluate(() => innerWidth); Object.assign(opt, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }); }
  const r = await Promise.race([s.send("Page.captureScreenshot", opt), new Promise((_, j) => setTimeout(() => j(new Error("screenshot timeout")), 15000))]);
  fs.writeFileSync(file, Buffer.from(r.data, "base64")); await s.detach();
}
const browser = await chromium.launch();
const results = { generatedAt: new Date().toISOString(), screen: SCREEN, state: STATE, browser: browser.version(), safeAreaAssumed: SAFE, densityPolicy: DENSITY, staticColors, viewports: [] };
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ko-KR" });
  const page = await ctx.newPage(); const consoleMsgs = [];
  const bgBelow = async () => page.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight - 140); let e = el; while (e && getComputedStyle(e).backgroundColor === "rgba(0, 0, 0, 0)") e = e.parentElement; return e ? getComputedStyle(e).backgroundColor : "none"; });
  page.on("console", m => { if (["error", "warning"].includes(m.type())) consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 200) }); });
  page.on("pageerror", e => consoleMsgs.push({ type: "pageerror", text: String(e).slice(0, 200) }));
  await page.goto(`${BASE}?bare=1&safe=${SAFE}#${SCREEN}/${STATE}/mobile`, { waitUntil: "networkidle" }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
  const m = await page.evaluate(measure, allowedHex); m.safe.bgBelowContent = await bgBelow();
  await shot(page, ctx, path.join(SHOTS, `${SCREEN}-${STATE}-${vp.w}.png`), false);
  await shot(page, ctx, path.join(SHOTS, `${SCREEN}-${STATE}-${vp.w}-full.png`), true);
  const focus = await page.evaluate(focusCheck);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(100);
  const bottom = await page.evaluate(bottomCheck); await shot(page, ctx, path.join(SHOTS, `${SCREEN}-${STATE}-${vp.w}-bottom.png`), false);
  const chipRows = m.chipRows;
  // 계산: 헤더 56 + 컨트롤(위 8 + 안내 48 + 12 + 검색 44 + 12 + 칩 32 + 12 + 비활성 44 + 아래 4 = 216, 칩 두 줄이면 +44) / 탭 56 + 안전 영역
  const calc = { header: 56, listTop: 56, rowH: 48, nav: 56 + SAFE, menuBottom: 56 + 5 * 48 + 1 }; // 위 구분선 1 포함
  // 링크 이동 확인: 구현된 대상(명단)과 미구현 대상(오늘 운동)을 실제로 눌러 봄
  const nav2 = {};
  await page.click("[data-to=SCR-211]"); await page.waitForTimeout(150); nav2.toImplemented = await page.evaluate(() => ({ hash: location.hash, scr: document.querySelector("[data-scr]")?.getAttribute("data-scr") }));
  await page.goBack(); await page.waitForTimeout(150);
  await page.click("[data-to=SCR-202]"); await page.waitForTimeout(150); nav2.toUnimplemented = await page.evaluate(() => ({ hash: location.hash, missing: document.querySelector("[data-preview-missing]")?.getAttribute("data-preview-missing"), text: document.querySelector("[data-preview-missing] h2")?.textContent }));
  await shot(page, ctx, path.join(SHOTS, `${SCREEN}-${STATE}-${vp.w}-unimplemented.png`), false);
  await page.click("[data-preview-missing] button"); await page.waitForTimeout(150); nav2.back = await page.evaluate(() => document.querySelector("[data-scr]")?.getAttribute("data-scr"));
  await page.click("[data-testid=app-nav] a[href^='#SCR-201']"); await page.waitForTimeout(150); nav2.opsTab = await page.evaluate(() => location.hash);
  results.viewports.push({ ...vp, measured: m, bottom, focusHidden: focus, console: consoleMsgs, calculated: calc, navigation: nav2 });
  await ctx.close();
}
await browser.close(); srv.kill();
results.summary = results.viewports.map(v => ({ width: v.w, height: v.h, title: v.measured.title, headerButtons: v.measured.headerButtons, header: v.measured.header, menu: v.measured.menu.map(r => ({ name: r.name, to: r.to, target: r.target, aria: r.aria, y: r.y, liH: r.li.h })), navTop: v.measured.nav.y, navH: v.measured.nav.h, safe: v.measured.safe, horizontalScroll: v.measured.horizontalScroll, scrollW: v.measured.scrollW, rowContentRightMax: v.measured.rowContentRightMax,
  touchFail: v.measured.touch.filter(t => !t.ok), contrastFail: v.measured.texts.filter(t => t.contrastOk === false), nonTextFail: v.measured.nonText.filter(t => !t.ok), containment: v.measured.containment, overflow: v.measured.texts.filter(t => t.overflowX || t.clipped || t.ellipsis), wrapped: v.measured.texts.filter(t => t.lines > 1).map(t => t.text), offPalette: v.measured.offPalette, bottom: v.bottom, focusHidden: v.focusHidden, console: v.console, fonts: v.measured.fonts, navigation: v.navigation, calculated: v.calculated }));
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results.summary, null, 0));
console.log("staticColors", JSON.stringify(staticColors));
setTimeout(() => process.exit(0), 300);
