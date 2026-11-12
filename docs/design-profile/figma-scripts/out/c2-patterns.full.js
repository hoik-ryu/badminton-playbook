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

// ===== part: c2-patterns.js =====
// c2: 공통 패턴(CMP-021–030) + 하단 탭·옆 메뉴 + 헤더. c1 이후 실행. 멱등.
await openLibSection();
if (!CMP["C/CMP-001 Button"]) throw new Error("run c1 first");
_cx = 99999;
const iconBtn = (name, color) => { const b = AL("HORIZONTAL", { name: "IconButton/" + name, align: "CENTER", justify: "CENTER" }); WH(b, 44, 44); add(b, I(name, 24, color)); return b; };
// CMP-021 Sheet 머리·바닥
await mkComp("C/CMP-021 SheetHeader", async () => {
  const c = COMP("VERTICAL", { fill: "bg/page" }); W(c, 390);
  const g = AL("HORIZONTAL", { name: "Grabber", justify: "CENTER", pad: [8, 0, 4, 0] }); add(c, g, { fillW: 1 }); add(g, rect(36, 4, "border/default", 2));
  const row = AL("HORIZONTAL", { name: "TitleRow", align: "CENTER", pad: [0, 4, 0, 16] }); add(c, row, { fillW: 1 }); H(row, 56); row.layoutSizingHorizontal = "FILL";
  add(row, await T("시트 제목", "title", "text/primary", { name: "Title" }), { grow: 1 }); add(row, iconBtn("x", "text/primary"));
  return c;
}, { Title: "시트 제목" });
await mkComp("C/CMP-021 SheetFooter", async () => {
  const c = COMP("VERTICAL", { fill: "bg/page", pad: [12, 16, 12, 16], gap: 8 }); W(c, 390); divider(c, "top");
  const b = inst("C/CMP-001 Button", { variant: "primary", size: "lg" }, { Label: "저장" }); b.name = "Action"; add(c, b, { fillW: 1 });
  return c;
});
// CMP-022 ConfirmDialog
await mkSet("C/CMP-022 ConfirmDialog", [{ tone: "default" }, { tone: "danger" }, { tone: "conflict" }], async ({ tone }) => {
  const c = COMP("VERTICAL", { fill: "bg/page", pad: 24, gap: 16, rSheet: 1 }); W(c, 326); await c.setEffectStyleIdAsync(EF.sheet);
  add(c, await T("확정할까요?", "title", "text/primary", { name: "Title" }), { fillW: 1 });
  add(c, await T("확정하면 되돌릴 수 없습니다.", "body", "text/secondary", { name: "Body" }), { fillW: 1 });
  const row = AL("HORIZONTAL", { name: "Actions", gap: 8, justify: "MAX" }); add(c, row, { fillW: 1 });
  if (tone !== "conflict") { const x = inst("C/CMP-001 Button", { variant: "secondary", size: "md" }, { Label: "취소" }); x.name = "Cancel"; add(row, x); }
  const a = inst("C/CMP-001 Button", { variant: tone === "danger" ? "danger" : "primary", size: "md" }, { Label: tone === "conflict" ? "확인" : "확정" }); a.name = "Action"; add(row, a);
  return c;
}, { Title: "확정할까요?", Body: "확정하면 되돌릴 수 없습니다." });
// CMP-023 NoticeBox
const NB = { info: ["status/info/bg", "info", "text/primary"], warning: ["status/warning/bg", "triangle-alert", "status/warning/fg"], danger: ["status/danger/bg", "triangle-alert", "status/danger/fg"], success: ["status/success/bg", "circle-check", "status/success/fg"] };
await mkSet("C/CMP-023 NoticeBox", Object.keys(NB).map(t => ({ tone: t })), async ({ tone }) => {
  const [bg, ic, fg] = NB[tone];
  const c = COMP("HORIZONTAL", { fill: bg, pad: 12, gap: 8, rMd: 1 }); W(c, 358);
  add(c, I(ic, 20, fg)); add(c, await T("안내 문구", "body", "text/primary", { name: "Message" }), { fillW: 1 });
  return c;
}, { Message: "안내 문구" });
// CMP-024 PersonRow
const PR = ["score", "unset", "inactive", "checkOn", "checkOff", "chevron", "group"];
await mkSet("C/CMP-024 PersonRow", PR.map(k => ({ kind: k })), async ({ kind }) => {
  if (kind === "group") { const g = COMP("HORIZONTAL", { align: "CENTER", pad: [0, 16], fill: "bg/surface" }); WH(g, 390, 32); add(g, await T("게스트", "captionStrong", "text/secondary", { name: "Name" })); return g; }
  const c = COMP("HORIZONTAL", { align: "CENTER", gap: 12, pad: [0, 16], fill: "bg/page" }); WH(c, 390, 56); divider(c, "bottom");
  if (kind === "checkOn" || kind === "checkOff") add(c, inst("C/CMP-008 Checkbox", { state: kind === "checkOn" ? "checked" : "unchecked" }));
  const dim = kind === "inactive";
  const id = AL("HORIZONTAL", { name: "Identity", gap: 8, align: "CENTER" }); add(c, id, { fillW: 1 });
  add(id, await T("권초록", "bodyStrong", dim ? "text/disabled" : "text/primary", { name: "Name" }));
  add(id, await T("여 · B조", "body", dim ? "text/disabled" : "text/secondary", { name: "Meta" }));
  if (kind === "unset") add(c, inst("C/CMP-005 Badge", { tone: "warning" }, { Label: "미설정" }));
  else if (kind === "inactive") { add(c, inst("C/CMP-005 Badge", { tone: "neutral" }, { Label: "비활성" })); add(c, await T("6점", "bodyStrong", "text/disabled", { name: "Score" })); }
  else if (kind === "chevron") add(c, I("chevron-right", 20, "text/secondary"));
  else add(c, await T("6점", "bodyStrong", "text/primary", { name: "Score", align: "RIGHT" }));
  return c;
}, { Name: "권초록", Meta: "여 · B조", Score: "6점" });
// CMP-025 AppNav(하단 탭) — B안 구조 유지, 탭 64 + 안전 영역 34
const TABS = [["tutorial", "graduation-cap", "튜토리얼"], ["match", "swords", "청백전"], ["my", "circle-user-round", "마이페이지"], ["ops", "clipboard-list", "운영"]];
const navCombos = []; for (const r of ["member", "admin"]) for (const t of TABS) if (r === "admin" || t[0] !== "ops") navCombos.push({ role: r, active: t[0] });
await mkSet("C/CMP-025 AppNav", navCombos, async ({ role, active }) => {
  const c = COMP("VERTICAL", { fill: "bg/page" }); WH(c, 390, 98); divider(c, "top");
  const row = AL("HORIZONTAL", { name: "Tabs" }); add(c, row, { fillW: 1 }); WH(row, 390, 64); row.layoutSizingHorizontal = "FILL";
  for (const [key, ic, label] of TABS) {
    if (role === "member" && key === "ops") continue;
    const on = key === active, colr = on ? "nav/active" : "text/secondary";
    const tab = AL("VERTICAL", { name: "Tab/" + label + (on ? " (현재)" : ""), align: "CENTER", gap: 4, pad: [8, 0, 0, 0] }); add(row, tab, { fillW: 1, fillH: 1 });
    const pill = AL("HORIZONTAL", { name: "Indicator", align: "CENTER", justify: "CENTER", r: 16 }); WH(pill, 56, 32); if (on) pill.fills = [P("selected/bg")];
    add(pill, I(ic, 24, colr)); add(tab, pill); add(tab, await T(label, on ? "captionStrong" : "caption", colr, { name: "Label" }));
  }
  const safe = AL("VERTICAL", { name: "Safe area 34 (가정)", align: "CENTER", justify: "MAX", pad: [0, 0, 8, 0] }); add(c, safe, { fillW: 1 }); H(safe, 34); safe.layoutSizingHorizontal = "FILL";
  add(safe, rect(134, 5, "text/primary", 2.5));
  return c;
});
// CMP-025 AppNav side(PC 왼쪽 메뉴, 운영진)
const SIDE = [["tutorial", "graduation-cap", "튜토리얼"], ["match", "swords", "청백전"], ["my", "circle-user-round", "마이페이지"], ["ops-home", "clipboard-list", "운영"], ["session", "calendar", "오늘 운동", 1], ["roster", "users", "명단", 1], ["clubmatch", "trophy", "청백전 관리", 1], ["approval", "user-check", "가입 승인", 1], ["roles", "shield", "역할 관리", 1]];
await mkSet("C/CMP-025 AppNav side", [{ active: "ops-home" }, { active: "session" }, { active: "roster" }], async ({ active }) => {
  const c = COMP("VERTICAL", { fill: "bg/page", pad: [24, 12, 24, 12], gap: 4 }); WH(c, 240, 900); divider(c, "right");
  add(c, await T("SMAPSH", "heading", "action/primary", { name: "Brand" }));
  add(c, rect(1, 16, null));
  for (const [key, ic, label, sub] of SIDE) {
    const on = key === active;
    const it = AL("HORIZONTAL", { name: "Item/" + label + (on ? " (현재)" : ""), align: "CENTER", gap: 12, pad: [0, 12, 0, sub ? 28 : 12], rMd: 1 }); add(c, it, { fillW: 1 }); H(it, 44); it.layoutSizingHorizontal = "FILL";
    if (on) it.fills = [P("selected/bg")];
    add(it, I(ic, 20, on ? "selected/fg" : "text/secondary")); add(it, await T(label, on ? "bodyStrong" : "body", on ? "selected/fg" : "text/primary", { name: "Label" }));
  }
  return c;
});
// CMP-026 PageHeader(브랜드 띠). leading × trailing
const hdCombos = []; for (const l of ["none", "back", "close"]) for (const t of ["none", "menu", "action", "actionMenu"]) hdCombos.push({ leading: l, trailing: t });
await mkSet("C/CMP-026 PageHeader", hdCombos, async ({ leading, trailing }) => {
  const c = COMP("HORIZONTAL", { align: "CENTER", gap: 4, pad: [0, 4, 0, leading === "none" ? 16 : 4], fill: "header/bg" }); WH(c, 390, 56);
  if (leading !== "none") add(c, iconBtn(leading === "back" ? "chevron-left" : "x", "header/fg"));
  add(c, await T("화면 제목", "heading", "header/fg", { name: "Title" }), { grow: 1 });
  if (trailing === "action" || trailing === "actionMenu") {
    const a = AL("HORIZONTAL", { name: "HeaderAction (보이는 36 / 누름 44)", align: "CENTER", gap: 6, pad: [0, 14, 0, 12], r: 18, fill: "bg/page" }); H(a, 36);
    add(a, I("user-plus", 18, "action/primary")); add(a, await T("게스트 추가", "bodyStrong", "action/primary", { name: "Action" })); add(c, a);
  }
  if (trailing === "menu" || trailing === "actionMenu") add(c, iconBtn("ellipsis", "header/fg"));
  if (trailing === "none" || trailing === "action") add(c, rect(8, 1, null));
  return c;
}, { Title: "화면 제목", Action: "게스트 추가" });
await mkComp("C/CMP-026 PageHeader SearchBand", async () => {
  const c = COMP("VERTICAL", { fill: "header/bg", pad: [0, 16, 12, 16] }); W(c, 390);
  const s = inst("C/CMP-006 TextField", { type: "search", state: "default" }); s.name = "Search"; add(c, s, { fillW: 1 }); return c;
});
// CMP-027 StateView
const SV = { empty: ["info", "만들기", "primary"], error: ["triangle-alert", "다시 시도", "secondary"], forbidden: ["lock", "홈으로", "primary"], notFound: ["circle-help", "홈으로", "primary"] };
await mkSet("C/CMP-027 StateView", ["empty", "error", "forbidden", "notFound", "loading"].map(k => ({ kind: k })), async ({ kind }) => {
  const c = COMP("VERTICAL", { gap: 12, pad: [24, 16, 24, 16], fill: "bg/page" }); W(c, 390);
  if (kind === "loading") {
    for (let i = 0; i < 6; i++) { const r = AL("HORIZONTAL", { name: "SkeletonRow", gap: 12, align: "CENTER" }); add(c, r, { fillW: 1 }); H(r, 32); r.layoutSizingHorizontal = "FILL"; add(r, rect(72, 16, "bg/surface", 4)); add(r, rect(140, 16, "bg/surface", 4)); }
    return c;
  }
  const [ic, label, v] = SV[kind];
  add(c, I(ic, 32, "text/secondary"));
  add(c, await T("제목", "title", "text/primary", { name: "Title" }), { fillW: 1 });
  add(c, await T("원인과 다음 행동", "body", "text/secondary", { name: "Body" }), { fillW: 1 });
  const b = inst("C/CMP-001 Button", { variant: v, size: "md" }, { Label: label }); b.name = "Action"; add(c, b);
  return c;
}, { Title: "제목", Body: "원인과 다음 행동" });
// CMP-028 StickySummary
await mkSet("C/CMP-028 StickySummary", [{ kind: "default" }, { kind: "warning" }], async ({ kind }) => {
  const w = kind === "warning";
  const c = COMP("HORIZONTAL", { align: "CENTER", gap: 8, pad: [0, 16], fill: w ? "status/warning/bg" : "bg/surface" }); WH(c, 390, 44);
  if (w) add(c, I("triangle-alert", 20, "status/warning/fg"));
  add(c, await T("참석 12명 · 남 7 여 5", "bodyStrong", w ? "status/warning/fg" : "text/primary", { name: "Text" })); return c;
}, { Text: "참석 12명 · 남 7 여 5" });
// CMP-029 Toast
await mkComp("C/CMP-029 Toast", async () => {
  const c = COMP("HORIZONTAL", { align: "CENTER", gap: 8, pad: [12, 16, 12, 16], rMd: 1, fill: "text/primary" });
  add(c, I("circle-check", 20, "action/onPrimary")); add(c, await T("저장했습니다", "body", "action/onPrimary", { name: "Message" })); return c;
}, { Message: "저장했습니다" });
// CMP-030 ListItem
await mkSet("C/CMP-030 ListItem", [{ trailing: "chevron" }, { trailing: "badge" }], async ({ trailing }) => {
  const c = COMP("HORIZONTAL", { align: "CENTER", gap: 12, pad: [0, 16], fill: "bg/page" }); WH(c, 390, 64); divider(c, "bottom");
  const ic = I("clipboard-list", 24, "action/primary"); ic.name = "Icon"; add(c, ic);
  const tx = AL("VERTICAL", { name: "Text" }); add(c, tx, { fillW: 1 });
  add(tx, await T("메뉴", "bodyStrong", "text/primary", { name: "Title" }), { fillW: 1 }); add(tx, await T("설명", "caption", "text/secondary", { name: "Sub" }), { fillW: 1 });
  if (trailing === "badge") { const b = inst("C/CMP-005 Badge", { tone: "warning" }, { Label: "3" }); b.name = "Count"; add(c, b); }
  add(c, I("chevron-right", 20, "text/secondary"));
  return c;
}, { Title: "메뉴", Sub: "설명" });
fitSection();
return { made: MADE, skipped: SKIPPED.length };
