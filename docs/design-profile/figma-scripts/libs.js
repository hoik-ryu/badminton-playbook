// ===== 화면 조립 도우미(s*.js 앞에 붙음) =====
const CPAGE = await figma.getNodeByIdAsync("1:74"); await figma.setCurrentPageAsync(CPAGE);
await loadLib(); if (!CMP["C/CMP-047 StageCard"]) throw new Error("run c1-c3 first");
const GROUPS = ["C안 · 인증·공통 (SCR-001–005)", "C안 · 튜토리얼 (SCR-101–103)", "C안 · 회원 청백전·마이 (SCR-111–122)", "C안 · 운영 홈·오늘 운동 (SCR-201–205)", "C안 · 운영 명단 (SCR-211–214)", "C안 · 운영 청백전 (SCR-221–226)", "C안 · 운영 가입·역할 (SCR-231–232)", "C안 · PC (1440, 운영 필수 화면)"];
const OUT = { created: [], skipped: [] };
function groupSec(i) {
  let s = CPAGE.children.find(n => n.type === "SECTION" && n.name === GROUPS[i]);
  if (!s) { s = figma.createSection(); s.name = GROUPS[i]; CPAGE.appendChild(s); s.x = 1700; s.y = i * 1100; s.resizeWithoutConstraints(600, 1020); }
  return s;
}
// 화면 프레임: 이름 규칙 `SCR-### 이름 / ST# 상태(C안) / 플랫폼`. 이미 있으면 건너뜀(멱등)
async function screen(gi, name, build, w, h) {
  w = w || 390; h = h || 844;
  const sec = groupSec(gi);
  if (sec.children.find(n => n.name === name)) { OUT.skipped.push(name); return null; }
  let x = 40; for (const c of sec.children) x = Math.max(x, c.x + c.width + 48);
  const fr = figma.createFrame(); sec.appendChild(fr); fr.name = name; fr.resize(w, h); fr.x = x; fr.y = 80; fr.clipsContent = true; fr.fills = [P("bg/page")];
  const body = AL("VERTICAL", { name: "Content" }); fr.appendChild(body); W(body, w); body.x = 0; body.y = 0;
  await build(fr, body);
  let r = 0, b = 0; for (const c of sec.children) { r = Math.max(r, c.x + c.width); b = Math.max(b, c.y + c.height); }
  sec.resizeWithoutConstraints(r + 40, Math.max(b + 40, 1020));
  OUT.created.push(name + " " + fr.id); return fr;
}
// --- 조립 단위 ---
function hdr(p, title, leading, trailing, action) { const i = inst("C/CMP-026 PageHeader", { leading: leading || "none", trailing: trailing || "none" }, Object.assign({ Title: title }, action ? { Action: action } : {})); add(p, i, { fillW: 1 }); return i; }
function band(p, value) { const i = inst("C/CMP-026 PageHeader SearchBand"); add(p, i, { fillW: 1 }); setNested(i, "Search", { Value: value || "이름 검색" }); return i; }
function search(p, value) { const i = inst("C/CMP-006 TextField", { type: "search", state: "default" }, { Value: value || "이름 검색" }); add(p, i, { fillW: 1 }); return i; }
function nav(fr, role, active) { const n = inst("C/CMP-025 AppNav", { role, active }); fr.appendChild(n); n.x = 0; n.y = fr.height - n.height; return n; }
function box(p, o) { const b = AL("VERTICAL", Object.assign({ name: "Section", pad: [16, 16, 16, 16], gap: 12 }, o || {})); add(p, b, { fillW: 1 }); return b; }
function hrow(p, o) { const r = AL("HORIZONTAL", Object.assign({ name: "Row", gap: 8, align: "CENTER" }, o || {})); add(p, r, { fillW: 1 }); return r; }
async function tx(p, s, style, color, o) { const t = await T(s, style, color, o); add(p, t, { fillW: !(o && o.hug) }); return t; }
function btn(p, variant, label, size, o) { o = o || {}; const b = inst("C/CMP-001 Button", { variant, size: size || "lg" }, { Label: label }); add(p, b, { fillW: o.hug ? 0 : 1, grow: o.grow }); return b; }
function notice(p, tone, msg) { const n = inst("C/CMP-023 NoticeBox", { tone }, { Message: msg }); add(p, n, { fillW: 1 }); return n; }
function badgeI(p, tone, label) { const b = inst("C/CMP-005 Badge", { tone }, { Label: label }); add(p, b); return b; }
function field(p, label, value, helper, err) { const f = inst("C/CMP-006 TextField", { type: "text", state: err ? "error" : "default" }, { Label: label, Value: value || " ", Helper: helper || " " }); add(p, f, { fillW: 1 }); return f; }
function seg(p, opts, sel) { const tp = {}; opts.forEach((o, i) => tp["Opt" + (i + 1)] = o); const s = inst("C/CMP-002 SegmentedControl", { options: String(opts.length), selected: sel ? String(sel) : "none" }, tp); add(p, s, { fillW: 1 }); return s; }
const GRADES = ["자강조", "A조", "B조", "C조", "D조", "초심", "왕초심", "입문자"];
function grid(p, labels, cols, selected) { const g = AL("VERTICAL", { name: "ChoiceGrid", gap: 8 }); add(p, g, { fillW: 1 }); for (let i = 0; i < labels.length; i += cols) { const r = hrow(g, { gap: 8, name: "GridRow" }); for (const l of labels.slice(i, i + cols)) { const c = inst("C/CMP-003 ChoiceCell", { state: l === selected ? "selected" : "default" }, { Label: l }); add(r, c, { grow: 1 }); } } return g; }
function person(p, kind, name, meta, score) { const tp = { Name: name }; if (meta != null) tp.Meta = meta; if (score != null) tp.Score = score; const r = inst("C/CMP-024 PersonRow", { kind }, tp); add(p, r, { fillW: 1 }); return r; }
function stateView(p, kind, title, body, action) { const s = inst("C/CMP-027 StateView", { kind }, kind === "loading" ? {} : { Title: title, Body: body }); add(p, s, { fillW: 1 }); if (action) setNested(s, "Action", { Label: action }); return s; }
function listItem(p, trailing, title, sub, icon, count) { const i = inst("C/CMP-030 ListItem", { trailing }, { Title: title, Sub: sub || " " }); add(p, i, { fillW: 1 }); if (icon) { const ic = i.findOne(n => n.type === "INSTANCE" && n.name === "Icon"); ic.swapComponent(CMP["C/Icon/" + icon]); for (const v of ic.findAll(x => "strokes" in x && x.strokes.length > 0)) v.strokes = [P("action/primary")]; } if (count) setNested(i, "Count", { Label: count }); return i; }
function spacer(p, h, name) { const s = AL("VERTICAL", { name: name || ("Spacer " + h) }); add(p, s, { fillW: 1 }); H(s, h); s.layoutSizingHorizontal = "FILL"; return s; }
function scrim(fr) { const s = rect(fr.width, fr.height, "text/primary", 0, 0.4); s.name = "Scrim"; fr.appendChild(s); s.x = 0; s.y = 0; return s; }
// 시트: 부모 화면 머리 + 어둡게 + 아래 시트(머리·본문·바닥). build(bodyFrame)
async function sheet(fr, body, parentTitle, title, build, footer, o) {
  o = o || {};
  hdr(body, parentTitle, o.parentLeading || "back", "none");
  scrim(fr);
  const sh = AL("VERTICAL", { name: "Sheet", fill: "bg/page" }); fr.appendChild(sh); W(sh, fr.width);
  for (const k of ["topLeftRadius", "topRightRadius"]) sh.setBoundVariable(k, V["radius/sheet"]);
  await sh.setEffectStyleIdAsync(EF.sheet);
  add(sh, inst("C/CMP-021 SheetHeader", {}, { Title: title }), { fillW: 1 });
  const b = AL("VERTICAL", { name: "SheetBody", pad: [4, 16, 16, 16], gap: 16 }); add(sh, b, { fillW: 1 });
  await build(b);
  if (footer) { const f = inst("C/CMP-021 SheetFooter"); add(sh, f, { fillW: 1 }); setNested(f, "Action", { Label: footer }); }
  add(sh, rect(fr.width, 34, null));
  const maxH = fr.height - 72; if (sh.height > maxH) { const over = sh.height - maxH; H(b, b.height - over); b.layoutSizingHorizontal = "FILL"; b.clipsContent = true; b.name = "SheetBody (내부 스크롤)"; }
  sh.x = 0; sh.y = fr.height - sh.height; return sh;
}
function dialog(fr, tone, title, bodyText, action, cancel) {
  scrim(fr); const d = inst("C/CMP-022 ConfirmDialog", { tone }, { Title: title, Body: bodyText }); fr.appendChild(d);
  if (action) setNested(d, "Action", { Label: action }); if (cancel && tone !== "conflict") setNested(d, "Cancel", { Label: cancel });
  d.x = Math.round((fr.width - d.width) / 2); d.y = Math.round((fr.height - d.height) / 2); return d;
}
function toast(fr, msg, bottom) { const t = inst("C/CMP-029 Toast", {}, { Message: msg }); fr.appendChild(t); t.x = Math.round((fr.width - t.width) / 2); t.y = fr.height - (bottom || 120) - t.height; return t; }
function game(p, label, phase, tp) { const g = inst("C/CMP-041 GameCard", { label, phase }, tp); add(p, g, { fillW: 1 }); return g; }
// PC 셸: 왼쪽 메뉴 + 가운데(+ 오른쪽 패널)
function pcShell(fr, active) { const c0 = fr.findChild(n => n.name === "Content"); if (c0) c0.remove(); fr.layoutMode = "HORIZONTAL"; fr.primaryAxisSizingMode = "FIXED"; fr.counterAxisSizingMode = "FIXED"; const n = inst("C/CMP-025 AppNav side", { active }); add(fr, n); const main = AL("VERTICAL", { name: "Main", fill: "bg/page" }); add(fr, main, { fillW: 1, fillH: 1 }); return main; }
// 하단 고정 행동 바(+ 안전 영역 34 가정)
function actionBar(fr, buttons, note) {
  const bar = AL("VERTICAL", { name: "ActionBar", fill: "bg/page", pad: [12, 16, 12, 16], gap: 8 }); fr.appendChild(bar); W(bar, fr.width); divider(bar, "top");
  const r = AL("HORIZONTAL", { name: "Buttons", gap: 8 }); add(bar, r, { fillW: 1 });
  for (const [v, l, grow] of buttons) { const b = inst("C/CMP-001 Button", { variant: v, size: "lg" }, { Label: l }); add(r, b, { grow: grow ? 1 : 0 }); }
  const safe = rect(fr.width, 34, "bg/page"); safe.name = "Safe area 34 (가정)"; fr.appendChild(safe); safe.x = 0; safe.y = fr.height - 34;
  bar.x = 0; bar.y = fr.height - 34 - bar.height; return bar;
}
