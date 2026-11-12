// ===== SMAPSH Figma lib — C안 Mint Hybrid (실험) =====
// 모든 use_figma 호출 앞에 그대로 붙는 공통 코드입니다. assemble.py가 lib.js + 파트 파일을 합칩니다.
// 규칙: 색은 모두 변수 연결(직접 hex 없음), 글자는 기존 텍스트 스타일, 아이콘은 C/Icon 컴포넌트 인스턴스.
const FONT = "Noto Sans KR"; // Pretendard 미설치(2026-11-10 확인) → 대체 글꼴
await Promise.all(["Regular", "Medium", "Bold"].map(s => figma.loadFontAsync({ family: FONT, style: s })));
const _cols = await figma.variables.getLocalVariableCollectionsAsync();
const _vars = await figma.variables.getLocalVariablesAsync();
const V = {};
for (const v of _vars) { const c = _cols.find(c => c.id === v.variableCollectionId); V[c.name + "/" + v.name] = v; }
// 의미 이름 해석: C 테마(exp/theme-C)에 있으면 그것, 없으면 승인 토큰(color/*)
const col = n => { const v = V["exp/theme-C/" + n] || V["color/" + n]; if (!v) throw new Error("var " + n); return v; };
const P = (n, o) => { const p = figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", col(n)); return o != null ? Object.assign({}, p, { opacity: o }) : p; };
const ST = { heading: "S:2365e9948cb8aa35d0777ec48f1088aef47c91a7,", title: "S:03c7610f9e856549fe4179de9c38cfb8714042c0,", body: "S:bb517b8e8c55a6b8ec33df594fc9fe98883d5c8d,", bodyStrong: "S:073f0007735439167e80cf6f8e59985b8a3f0603,", caption: "S:4ba8c8384b5d43aaff35be8beaaca50f3e88aa33,", captionStrong: "S:7e367f490cfa32e63ad5be0ced83665cda86a48f," };
const EF = { sheet: "S:ad2d7957473b974283434cafb4a0e11e1c6931cd,", card: "S:5d71ed81c44b9e4cbfffd069e9e123bb1a53600b," };
async function T(chars, style, color, o) {
  style = style || "body"; color = color || "text/primary"; o = o || {};
  const t = figma.createText();
  if (style === "display") { t.fontName = { family: FONT, style: "Bold" }; t.fontSize = 32; t.lineHeight = { unit: "PERCENT", value: 125 }; }
  else await t.setTextStyleIdAsync(ST[style]);
  t.characters = String(chars); t.fills = [P(color)]; t.name = o.name || String(chars).slice(0, 24);
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.w) { t.resize(o.w, t.height); t.textAutoResize = "HEIGHT"; }
  return t;
}
function AL(dir, o) { const f = figma.createAutoLayout(dir || "VERTICAL"); f.fills = []; return applyO(f, o); }
// 컴포넌트(자동 레이아웃) 만들기
function COMP(dir, o) { const c = figma.createComponent(); c.fills = []; c.layoutMode = dir || "VERTICAL"; c.primaryAxisSizingMode = "AUTO"; c.counterAxisSizingMode = "AUTO"; return applyO(c, o); }
function applyO(f, o) {
  o = o || {};
  for (const k in o) {
    const v = o[k];
    if (k === "fill") f.fills = [P(v)];
    else if (k === "stroke") { f.strokes = [P(v)]; f.strokeAlign = "INSIDE"; f.strokeWeight = o.sw || 1; }
    else if (k === "sw") { }
    else if (k === "pad") { const a = Array.isArray(v) ? (v.length === 2 ? [v[0], v[1], v[0], v[1]] : v) : [v, v, v, v]; f.paddingTop = a[0]; f.paddingRight = a[1]; f.paddingBottom = a[2]; f.paddingLeft = a[3]; }
    else if (k === "gap") f.itemSpacing = v;
    else if (k === "r") f.cornerRadius = v;
    else if (k === "rMd" || k === "rSm" || k === "rSheet") { const rv = V["radius/" + ({ rMd: "md", rSm: "sm", rSheet: "sheet" })[k]]; for (const c of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) f.setBoundVariable(c, rv); }
    else if (k === "align") f.counterAxisAlignItems = v;
    else if (k === "justify") f.primaryAxisAlignItems = v;
    else f[k] = v;
  }
  return f;
}
// 크기 고정 도우미(resize 뒤에 sizing mode를 다시 지정: figma-use 12c)
function W(f, w) { f.resize(w, Math.max(f.height, 1)); if (f.layoutMode === "VERTICAL") { f.counterAxisSizingMode = "FIXED"; f.primaryAxisSizingMode = "AUTO"; } else if (f.layoutMode === "HORIZONTAL") { f.primaryAxisSizingMode = "FIXED"; f.counterAxisSizingMode = "AUTO"; } return f; }
function H(f, h) { f.resize(Math.max(f.width, 1), h); if (f.layoutMode === "HORIZONTAL") { f.counterAxisSizingMode = "FIXED"; f.primaryAxisSizingMode = "AUTO"; } else if (f.layoutMode === "VERTICAL") { f.primaryAxisSizingMode = "FIXED"; f.counterAxisSizingMode = "AUTO"; } return f; }
function WH(f, w, h) { f.resize(w, h); if (f.layoutMode !== "NONE") { f.primaryAxisSizingMode = "FIXED"; f.counterAxisSizingMode = "FIXED"; } return f; }
function add(p, c, o) { o = o || {}; p.appendChild(c); if (o.fillW) { if (c.type === "TEXT") c.textAutoResize = "HEIGHT"; c.layoutSizingHorizontal = "FILL"; } if (o.fillH) c.layoutSizingVertical = "FILL"; if (o.grow) c.layoutGrow = 1; return c; }
function divider(f, side) { f.strokes = [P("border/default")]; f.strokeAlign = "INSIDE"; f.strokeTopWeight = side === "top" ? 1 : 0; f.strokeBottomWeight = side === "bottom" ? 1 : 0; f.strokeLeftWeight = side === "left" ? 1 : 0; f.strokeRightWeight = side === "right" ? 1 : 0; }
function rect(w, h, color, r, o) { const n = figma.createRectangle(); n.resize(w, h); n.fills = color ? [P(color, o)] : []; if (r) n.cornerRadius = r; return n; }

// ----- C 라이브러리 섹션(페이지 01 Components) -----
const LIB_SECTION_NAME = "C안 Mint Hybrid · Components (실험)";
const CMP = {};
async function loadLib() {
  const pg = await figma.getNodeByIdAsync("1:73");
  await pg.loadAsync();
  const sec = pg.children.find(n => n.type === "SECTION" && n.name === LIB_SECTION_NAME);
  if (sec) for (const n of sec.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] })) if (n.parent.type !== "COMPONENT_SET") CMP[n.name] = n;
  return sec;
}
const _defs = {};
function defsOf(name) { if (!_defs[name]) _defs[name] = CMP[name].componentPropertyDefinitions; return _defs[name]; }
// 인스턴스 만들기: vp = 변형 속성 {variant:"primary"}, tp = 글자 속성 {Label:"저장"}
function inst(name, vp, tp) {
  const n = CMP[name]; if (!n) throw new Error("comp " + name);
  const i = n.type === "COMPONENT_SET" ? n.defaultVariant.createInstance() : n.createInstance();
  const set = {}; const defs = defsOf(name);
  for (const k in (vp || {})) set[k] = vp[k];
  for (const k in (tp || {})) { const key = Object.keys(defs).find(d => d.split("#")[0] === k); if (!key) throw new Error(name + " no prop " + k); set[key] = tp[k]; }
  if (Object.keys(set).length) i.setProperties(set);
  return i;
}
// 아이콘 인스턴스 + 색 덮어쓰기
function I(name, size, color) {
  const i = inst("C/Icon/" + name); i.resize(size || 24, size || 24);
  if (color) for (const c of i.findAll(x => "strokes" in x && x.strokes.length > 0)) c.strokes = [P(color)];
  return i;
}
// ----- 컴포넌트 생성용(c*.js) -----
let SEC = null, _cx = 80, _cy = 80, _rowH = 0;
async function openLibSection() {
  const page = await figma.getNodeByIdAsync("1:73"); await figma.setCurrentPageAsync(page);
  SEC = page.children.find(n => n.type === "SECTION" && n.name === LIB_SECTION_NAME);
  if (!SEC) { let maxR = 0; for (const c of page.children) maxR = Math.max(maxR, c.x + c.width); SEC = figma.createSection(); SEC.name = LIB_SECTION_NAME; SEC.x = maxR + 400; SEC.y = 0; SEC.resizeWithoutConstraints(3000, 400); }
  await loadLib();
  let b = 0; for (const c of SEC.children) b = Math.max(b, c.y + c.height); _cy = b ? b + 120 : 80; _cx = 80; _rowH = 0;
  return SEC;
}
function place(n) { if (n.parent !== SEC) SEC.appendChild(n); if (_cx + n.width > 2900 && _cx > 80) { _cx = 80; _cy += _rowH + 60; _rowH = 0; } n.x = _cx; n.y = _cy; _cx += n.width + 60; _rowH = Math.max(_rowH, n.height); }
function fitSection() { let r = 0, b = 0; for (const c of SEC.children) { r = Math.max(r, c.x + c.width); b = Math.max(b, c.y + c.height); } SEC.resizeWithoutConstraints(Math.max(r + 80, 3000), b + 80); }
function ownTexts(root, name) { return root.findAll(n => { if (n.type !== "TEXT" || n.name !== name) return false; let p = n.parent; while (p && p !== root) { if (p.type === "INSTANCE") return false; p = p.parent; } return true; }); }
const MADE = [], SKIPPED = [];
async function mkSet(name, combos, build, textProps) {
  if (CMP[name]) { SKIPPED.push(name); return CMP[name]; }
  const comps = [];
  for (const combo of combos) { const c = await build(combo); c.name = Object.entries(combo).map(([k, v]) => k + "=" + v).join(", "); SEC.appendChild(c); comps.push(c); }
  const set = figma.combineAsVariants(comps, SEC); set.name = name;
  let x = 24, y = 24, rh = 0;
  for (const c of set.children) { if (x + c.width > 1600 && x > 24) { x = 24; y += rh + 24; rh = 0; } c.x = x; c.y = y; x += c.width + 24; rh = Math.max(rh, c.height); }
  set.resize(Math.max(...set.children.map(c => c.x + c.width)) + 24, y + rh + 24);
  for (const [prop, def] of Object.entries(textProps || {})) { const key = set.addComponentProperty(prop, "TEXT", def); for (const c of set.children) for (const t of ownTexts(c, prop)) t.componentPropertyReferences = { characters: key }; }
  place(set); CMP[name] = set; MADE.push(name + " " + set.id); return set;
}
async function mkComp(name, build, textProps) {
  if (CMP[name]) { SKIPPED.push(name); return CMP[name]; }
  const c = await build(); c.name = name; SEC.appendChild(c);
  for (const [prop, def] of Object.entries(textProps || {})) { const key = c.addComponentProperty(prop, "TEXT", def); for (const t of ownTexts(c, prop)) t.componentPropertyReferences = { characters: key }; }
  place(c); CMP[name] = c; MADE.push(name + " " + c.id); return c;
}
// 중첩 인스턴스의 글자 바꾸기(예: 확인 창의 Action 버튼)
function setNested(i, childName, tp) { const c = i.findOne(n => n.type === "INSTANCE" && n.name === childName); if (!c) throw new Error("nested " + childName); const d = c.componentProperties; const set = {}; for (const k in tp) { const key = Object.keys(d).find(x => x.split("#")[0] === k); if (key) set[key] = tp[k]; } c.setProperties(set); return c; }

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
function band(p, value) { const i = inst("C/CMP-026 PageHeader SearchBand"); add(p, i, { fillW: 1 }); if (value) setNested(i, "Search", { Value: value }); return i; }
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
  const maxH = fr.height - 72; if (sh.height > maxH) { H(sh, maxH); sh.layoutSizingHorizontal = "FIXED"; sh.clipsContent = true; }
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

// ===== part: s1-auth-tutorial.js =====
// s1: 인증·공통(SCR-001–005) + 튜토리얼(SCR-101–103). 명세에 문구가 없는 곳은 [대괄호]로 둠.
function bottomBar(fr, label, variant) { const f = inst("C/CMP-021 SheetFooter"); fr.appendChild(f); setNested(f, "Action", { Label: label }); if (variant) f.findOne(n => n.type === "INSTANCE" && n.name === "Action").setProperties({ variant }); f.x = 0; f.y = fr.height - f.height - 34; const s = rect(fr.width, 34, "bg/page"); s.name = "Safe area 34 (가정)"; fr.appendChild(s); s.x = 0; s.y = fr.height - 34; return f; }
function btn56(p, variant, label) { const b = btn(p, variant, label, "lg", {}); b.layoutSizingVertical = "FIXED"; b.resize(b.width, 56); b.layoutSizingHorizontal = "FILL"; return b; }
// ---- SCR-001 로그인 ----
async function login(st) {
  await screen(0, `SCR-001 로그인 / ${st === 4 ? "ST4 오류" : "ST1 기본"}(C안) / mobile`, async (fr, body) => {
    const b = box(body, { pad: [24, 16, 24, 16], gap: 16 });
    if (st === 4) { notice(b, "danger", "카카오 로그인이 완료되지 않았습니다. 카카오톡 안에서 열렸다면 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요"); btn(b, "secondary", "다시 시도", "md", { hug: 1 }); }
    spacer(b, st === 4 ? 96 : 180);
    await tx(b, "SMAPSH", "display", "action/primary", { align: "CENTER" });
    await tx(b, "[한 줄 소개 — 명세에 문구 없음]", "body", "text/secondary", { align: "CENTER" });
    bottomBar(fr, "카카오로 시작하기", "kakao");
  });
}
await login(1); await login(4);
// ---- SCR-002 가입 정보 입력 ----
await screen(0, "SCR-002 가입 정보 입력 / ST1 기본(C안) / mobile", async (fr, body) => {
  hdr(body, "가입 신청", "back", "none");
  const b = box(body, { gap: 20 });
  field(b, "이름", " ", " ");
  const g1 = AL("VERTICAL", { name: "성별", gap: 6 }); add(b, g1, { fillW: 1 }); await tx(g1, "성별", "captionStrong"); seg(g1, ["남", "여"], null);
  const g2 = AL("VERTICAL", { name: "급수", gap: 6 }); add(b, g2, { fillW: 1 }); await tx(g2, "급수", "captionStrong"); grid(g2, GRADES, 4, null);
  field(b, "누구의 지인(선택)", " ", " ");
  bottomBar(fr, "가입 신청");
});
// ---- SCR-003 계정 상태 안내 ----
const ACC = { 1: ["ST1 기본(승인 대기)", "clock", "가입 신청이 접수되었습니다", "운영진 승인 후 이용할 수 있습니다"], 7: ["ST7 거절", "info", "가입이 승인되지 않았습니다", null], 8: ["ST8 비활성", "lock", "현재 이용할 수 없는 계정입니다", null] };
for (const k of [1, 7, 8]) {
  const [stn, ic, title, sub] = ACC[k];
  await screen(0, `SCR-003 계정 상태 안내 / ${stn}(C안) / mobile`, async (fr, body) => {
    const b = box(body, { pad: [120, 16, 16, 16], gap: 12 });
    const i = I(ic, 48, "action/accent"); i.name = "상태 아이콘(장식)"; add(b, i);
    await tx(b, title, "heading");
    if (sub) await tx(b, sub, "body", "text/secondary");
    spacer(b, 24); btn(b, "primary", "상태 다시 확인"); btn(b, "text", "로그아웃");
  });
}
// ---- SCR-004 권한 없음 / SCR-005 페이지 없음 ----
await screen(0, "SCR-004 권한 없음 / ST1 기본(C안) / mobile", async (fr, body) => { spacer(body, 140); stateView(body, "forbidden", "접근 권한이 없습니다", "이 화면은 운영진만 볼 수 있습니다 [명세 문장 일부만 있음]", "처음 화면으로"); });
await screen(0, "SCR-005 페이지 없음 / ST1 기본(C안) / mobile", async (fr, body) => { spacer(body, 140); stateView(body, "notFound", "페이지를 찾을 수 없습니다", "[본문 문구 — 명세에 없음]", "처음 화면으로"); });
// ---- SCR-101 튜토리얼 홈 ----
await screen(1, "SCR-101 튜토리얼 홈 / ST1 기본(C안) / mobile", async (fr, body) => {
  hdr(body, "튜토리얼", "none", "none");
  const b = box(body, { gap: 12 });
  notice(b, "info", "처음이라면 입문자부터");
  const lv = async (name, prog, cards) => {
    const r = hrow(b, { pad: [8, 0, 0, 0] }); await tx(r, "튜토리얼 난이도 · " + name, "bodyStrong", "text/primary", { name: "LevelTitle" }); r.children[0].layoutGrow = 1; await tx(r, prog, "captionStrong", "text/secondary", { hug: 1 });
    for (const [n, s, sub] of cards) add(b, inst("C/CMP-047 StageCard", { status: s }, { Name: n, Sub: sub }), { fillW: 1 });
  };
  await lv("입문자", "2/3 통과", [["스테이지 1", "passed", "최고 점수 5/5"], ["스테이지 2", "passed", "최고 점수 4/5"], ["스테이지 3", "notPlayed", "-"]]);
  await lv("왕초보", "0/3 통과", [["스테이지 1", "notPlayed", "-"], ["스테이지 2", "notPlayed", "-"], ["스테이지 3", "notPlayed", "-"]]);
  const more = hrow(b, { pad: [8, 0, 8, 0] }); add(more, I("chevron-right", 20, "text/secondary")); await tx(more, "준비 중 (초보, D조 이상)", "body", "text/secondary");
  spacer(body, 114, "Scroll safe area 114 (탭 98 + 16)");
  nav(fr, "member", "tutorial");
});
// ---- SCR-102 스테이지 플레이 ----
async function play(st) {
  const names = { 1: "ST1 기본", 7: "ST7 정답", 9: "ST9 오답" };
  await screen(1, `SCR-102 스테이지 플레이 / ${names[st]}(C안) / mobile`, async (fr, body) => {
    hdr(body, "입문자 · 1", "close", "none");
    const s = hrow(body, { pad: [0, 16, 0, 16], fill: "bg/surface", name: "Progress" }); H(s, 44); s.layoutSizingHorizontal = "FILL";
    await tx(s, "상황 2/5", "bodyStrong", "text/primary", { name: "Situation" }); s.children[0].layoutGrow = 1; await tx(s, st === 7 ? "2점" : "1점", "bodyStrong", "action/primary", { hug: 1, name: "Score" });
    const b = box(body, { gap: 12, pad: [12, 16, 16, 16] });
    await tx(b, "[상황 설명 한 줄 — 콘텐츠 데이터]", "body", "text/secondary");
    add(b, inst("C/CMP-046 TutorialCourt"), { fillW: 1 });
    if (st === 1) {
      for (const pair of [["앞으로", "뒤로"], ["옆으로", "위치 유지"]]) { const r = hrow(b, { gap: 8 }); for (const l of pair) { const x = btn56(r, "secondary", l); x.layoutSizingHorizontal = "FILL"; } }
    } else if (st === 7) {
      notice(b, "success", "득점 · [한 줄 이유]"); btn56(b, "primary", "다음 상황");
    } else {
      notice(b, "danger", "실점 · [한 줄 이유]"); btn56(b, "primary", "올바른 움직임 보기");
      const r = hrow(b, { gap: 8 }); const x1 = btn(r, "secondary", "다시 도전", "lg", { grow: 1 }); const x2 = btn(r, "text", "다음 상황(0점)", "lg", { grow: 1 });
    }
  });
}
await play(1); await play(7); await play(9);
// ---- SCR-103 스테이지 결과 ----
async function result(st) {
  const pass = st === 1;
  await screen(1, `SCR-103 스테이지 결과 / ${pass ? "ST1 기본(통과)" : "ST7 미통과"}(C안) / mobile`, async (fr, body) => {
    hdr(body, "입문자 · 스테이지 1", "none", "none");
    const b = box(body, { gap: 8, pad: [24, 16, 16, 16] });
    const r = hrow(b, { gap: 12 }); await tx(r, pass ? "4 / 5" : "2 / 5", "display", "text/primary", { hug: 1, name: "Score" }); badgeI(r, pass ? "success" : "warning", pass ? "통과" : "미통과");
    await tx(b, "통과 기준: 5개 중 4개", "caption", "text/secondary");
    await tx(b, pass ? "최고 점수 5/5" : "통과까지 2점 남았어요", "body", "text/primary");
    const l = AL("VERTICAL", { name: "틀린 상황" }); add(body, l, { fillW: 1 });
    const lh = box(l, { pad: [16, 16, 8, 16] }); await tx(lh, "틀린 상황", "captionStrong", "text/secondary");
    for (const n of (pass ? ["상황 3"] : ["상황 1", "상황 3", "상황 4"])) listItem(l, "chevron", n, "정답 보기", "play");
    const a = box(body, { gap: 8 });
    if (pass) { btn(a, "primary", "다음 스테이지"); const rr = hrow(a); btn(rr, "secondary", "다시 하기", "lg", { grow: 1 }); btn(rr, "secondary", "홈", "lg", { grow: 1 }); }
    else { btn(a, "primary", "다시 하기"); btn(a, "secondary", "홈"); }
  });
}
await result(1); await result(7);
return OUT;
