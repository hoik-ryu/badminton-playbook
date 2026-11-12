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

// ===== part: c1-theme-icons-base.js =====
// c1: C 테마 변수 + Lucide 아이콘 + 기본 요소(CMP-001–008). 멱등: 있으면 건너뜀.
// --- 1) 테마 변수: 원시(exp/brand-primitive) + 의미(exp/theme-C). Starter는 모드 1개라 테마=컬렉션 ---
const hex = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const prim = _cols.find(c => c.name === "exp/brand-primitive");
if (!prim) throw new Error("exp/brand-primitive missing");
const pm = prim.modes[0].modeId; const madeVars = [];
for (const [n, h] of [["teal/50", "#DFF5F1"], ["teal/600", "#008F89"], ["teal/700", "#006D68"]]) {
  if (!V["exp/brand-primitive/" + n]) { const v = figma.variables.createVariable(n, prim, "COLOR"); v.setValueForMode(pm, hex(h)); v.scopes = []; V["exp/brand-primitive/" + n] = v; madeVars.push(n); }
}
let thC = _cols.find(c => c.name === "exp/theme-C");
if (!thC) { thC = figma.variables.createVariableCollection("exp/theme-C"); thC.renameMode(thC.modes[0].modeId, "C Mint Hybrid"); }
const cm = thC.modes[0].modeId;
const FILLS = ["FRAME_FILL", "SHAPE_FILL"], TXT = ["TEXT_FILL"], STK = ["STROKE_COLOR"];
const semC = [
  ["action/primary", "exp/brand-primitive/teal/700", FILLS.concat(TXT, STK)],   // 채운 버튼·링크 글자(흰 글자 6.20:1)
  ["action/accent", "exp/brand-primitive/teal/600", FILLS.concat(STK)],          // 표시·아이콘·큰 글자 배경(3.97:1, 비텍스트 전용)
  ["action/tint", "exp/brand-primitive/teal/50", FILLS],
  ["selected/bg", "exp/brand-primitive/teal/50", FILLS],
  ["selected/fg", "exp/brand-primitive/teal/700", TXT.concat(STK, FILLS)],
  ["nav/active", "exp/brand-primitive/teal/700", TXT.concat(STK, FILLS)],
  ["header/bg", "exp/brand-primitive/teal/600", FILLS],
  ["header/fg", "color/action/onPrimary", TXT.concat(STK)],
  ["focus/ring", "exp/brand-primitive/teal/600", STK],
];
for (const [n, target, sc] of semC) {
  if (V["exp/theme-C/" + n]) continue;
  const v = figma.variables.createVariable(n, thC, "COLOR"); v.scopes = sc; v.setValueForMode(cm, figma.variables.createVariableAlias(V[target])); V["exp/theme-C/" + n] = v; madeVars.push("theme-C/" + n);
}
// --- 2) 라이브러리 섹션 ---
await openLibSection();
// 1차 실행 실패(GROUP constraints)로 페이지 최상위에 남은 빈 아이콘 컴포넌트 정리: 기본 이름 + 24×24 + 섹션 밖
const cleaned = [];
for (const n of SEC.parent.children.slice()) if (n.type === "COMPONENT" && /^Component( \d+)?$/.test(n.name) && Math.round(n.width) === 24 && Math.round(n.height) === 24) { cleaned.push(n.id); n.remove(); }
// --- 3) 아이콘(Lucide 도형을 옮겨 적음, 패키지 원본과 대조 필요) ---
const IC = {
  "chevron-left": '<path d="m15 18-6-6 6-6"/>', "chevron-right": '<path d="m9 18 6-6-6-6"/>', "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "ellipsis": '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>', "check": '<path d="M20 6 9 17l-5-5"/>',
  "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  "graduation-cap": '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  "swords": '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
  "circle-user-round": '<path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="10" r="4"/><circle cx="12" cy="12" r="10"/>',
  "clipboard-list": '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  "calendar": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  "shuffle": '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  "sliders-horizontal": '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  "refresh-cw": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  "trophy": '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  "play": '<polygon points="6 3 20 12 6 21 6 3"/>', "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  "triangle-alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  "lock": '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "house": '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', "arrow-left-right": '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  "circle-help": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  "user-check": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  "shield": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  "pencil": '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  "trash-2": '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  "clock": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  "flag": '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
};
for (const [k, d] of Object.entries(IC)) {
  await mkComp("C/Icon/" + k, async () => {
    const svg = figma.createNodeFromSvg('<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</g></svg>');
    const c = figma.createComponent(); c.resize(24, 24); c.fills = [];
    for (const ch of [...svg.children]) { c.appendChild(ch); }
    svg.remove();
    for (const g of c.findAll(x => x.type === "GROUP")) figma.ungroup(g); // <g> → GROUP 풀기(constraints는 GROUP에 없음)
    for (const n of c.findAll(x => "strokes" in x && x.strokes.length > 0)) n.strokes = [P("text/primary")];
    for (const n of c.children) if ("constraints" in n) n.constraints = { horizontal: "SCALE", vertical: "SCALE" };
    return c;
  });
}
// 아이콘 줄이 끝나면 다음 줄로
_cx = 99999;
// --- 4) CMP-001 Button ---
const BTN = { primary: ["action/primary", "action/onPrimary", null], secondary: ["bg/page", "text/primary", "border/strong"], danger: ["status/danger/fg", "action/onPrimary", null], text: [null, "action/primary", null], kakao: ["brand/kakao/bg", "brand/kakao/fg", null] };
const btnCombos = []; for (const v of Object.keys(BTN)) for (const s of ["md", "lg"]) btnCombos.push({ variant: v, size: s });
await mkSet("C/CMP-001 Button", btnCombos, async ({ variant, size }) => {
  const [bg, fg, st] = BTN[variant];
  const c = COMP("HORIZONTAL", { align: "CENTER", justify: "CENTER", gap: 6, pad: [0, 16], rMd: 1 });
  if (bg) c.fills = [P(bg)]; if (st) { c.strokes = [P(st)]; c.strokeWeight = 1; c.strokeAlign = "INSIDE"; }
  if (variant === "kakao") add(c, I("message-circle", 20, "brand/kakao/fg"));
  add(c, await T(variant === "kakao" ? "카카오로 시작하기" : "버튼", "bodyStrong", fg, { name: "Label" }));
  H(c, size === "lg" ? 48 : 44); return c;
}, { Label: "버튼" });
// --- CMP-002 SegmentedControl ---
const segCombos = [{ options: "2", selected: "1" }, { options: "2", selected: "2" }, { options: "2", selected: "none" }, { options: "3", selected: "1" }, { options: "3", selected: "2" }, { options: "3", selected: "3" }, { options: "3", selected: "none" }];
await mkSet("C/CMP-002 SegmentedControl", segCombos, async ({ options, selected }) => {
  const c = COMP("HORIZONTAL", { fill: "bg/surface", rMd: 1, pad: 4, gap: 4 }); W(c, 358);
  for (let i = 1; i <= +options; i++) {
    const on = String(i) === selected;
    const s = AL("HORIZONTAL", { name: "Option" + i, align: "CENTER", justify: "CENTER", gap: 4, rMd: 1 }); H(s, 36);
    if (on) { s.fills = [P("selected/bg")]; s.strokes = [P("action/accent")]; s.strokeWeight = 1; s.strokeAlign = "INSIDE"; add(s, I("check", 16, "selected/fg")); }
    else s.fills = [P("bg/page")];
    add(s, await T(["남", "여", "불참"][i - 1], on ? "bodyStrong" : "body", on ? "selected/fg" : "text/secondary", { name: "Opt" + i }));
    add(c, s, { grow: 1 });
  }
  return c;
}, { Opt1: "남", Opt2: "여", Opt3: "불참" });
// --- CMP-003 ChoiceGrid 칸 ---
await mkSet("C/CMP-003 ChoiceCell", [{ state: "default" }, { state: "selected" }], async ({ state }) => {
  const on = state === "selected";
  const c = COMP("HORIZONTAL", { align: "CENTER", justify: "CENTER", rMd: 1, fill: on ? "action/primary" : "bg/page" });
  if (!on) { c.strokes = [P("border/strong")]; c.strokeWeight = 1; c.strokeAlign = "INSIDE"; }
  add(c, await T("C조", on ? "bodyStrong" : "body", on ? "action/onPrimary" : "text/primary", { name: "Label" }));
  WH(c, 80, 44); return c;
}, { Label: "C조" });
// --- CMP-004 FilterChip ---
await mkSet("C/CMP-004 FilterChip", [{ state: "off" }, { state: "on" }], async ({ state }) => {
  const on = state === "on";
  const c = COMP("HORIZONTAL", { align: "CENTER", gap: 4, pad: [0, 14], r: 16, fill: on ? "action/primary" : "bg/page" });
  if (!on) { c.strokes = [P("border/strong")]; c.strokeWeight = 1; c.strokeAlign = "INSIDE"; } else add(c, I("check", 16, "action/onPrimary"));
  add(c, await T("점수 미설정 3명", "body", on ? "action/onPrimary" : "text/primary", { name: "Label" }));
  H(c, 32); return c;
}, { Label: "점수 미설정 3명" });
// --- CMP-005 Badge ---
const BD = { neutral: ["bg/surface", "text/secondary"], info: ["status/info/bg", "text/primary"], warning: ["status/warning/bg", "status/warning/fg"], danger: ["status/danger/bg", "status/danger/fg"], success: ["status/success/bg", "status/success/fg"], teamBlue: ["team/blue/bg", "team/blue/fg"], teamWhite: ["team/white/bg", "team/white/fg", "border/strong"] };
await mkSet("C/CMP-005 Badge", Object.keys(BD).map(t => ({ tone: t })), async ({ tone }) => {
  const [bg, fg, st] = BD[tone];
  const c = COMP("HORIZONTAL", { align: "CENTER", pad: [0, 8], rSm: 1, fill: bg });
  if (st) { c.strokes = [P(st)]; c.strokeWeight = 1; c.strokeAlign = "INSIDE"; }
  add(c, await T("미설정", "captionStrong", fg, { name: "Label" })); H(c, 24); return c;
}, { Label: "미설정" });
// --- CMP-006 TextField ---
await mkSet("C/CMP-006 TextField", [{ type: "text", state: "default" }, { type: "text", state: "error" }, { type: "search", state: "default" }], async ({ type, state }) => {
  const err = state === "error";
  const box = (h) => { const b = AL("HORIZONTAL", { name: "Box", align: "CENTER", gap: 8, pad: [0, 12], rMd: 1, fill: "bg/page", stroke: err ? "status/danger/fg" : "border/strong", sw: err ? 2 : 1 }); H(b, h); return b; };
  if (type === "search") {
    const c = COMP("HORIZONTAL", { align: "CENTER", gap: 8, pad: [0, 12], rMd: 1, fill: "bg/page", stroke: "border/strong" });
    add(c, I("search", 20, "text/secondary")); add(c, await T("이름 검색", "body", "text/secondary", { name: "Value" })); WH(c, 358, 44); return c;
  }
  const c = COMP("VERTICAL", { gap: 6 }); W(c, 358);
  add(c, await T("이름", "captionStrong", "text/primary", { name: "Label" }), { fillW: 1 });
  const b = box(44); add(c, b, { fillW: 1 }); add(b, await T("입력", "body", "text/primary", { name: "Value" }));
  add(c, await T(err ? "이름을 입력해 주세요" : " ", "caption", err ? "status/danger/fg" : "text/secondary", { name: "Helper" }), { fillW: 1 });
  return c;
}, { Label: "이름", Value: "입력", Helper: " " });
// --- CMP-007 Switch ---
await mkSet("C/CMP-007 Switch", [{ state: "off" }, { state: "on" }], async ({ state }) => {
  const on = state === "on"; const c = figma.createComponent(); c.resize(44, 24); c.cornerRadius = 12; c.fills = [P(on ? "action/primary" : "border/strong")];
  const k = figma.createEllipse(); k.resize(20, 20); k.x = on ? 22 : 2; k.y = 2; k.fills = [P("bg/page")]; k.name = "Knob"; c.appendChild(k); return c;
});
// --- CMP-008 Checkbox ---
await mkSet("C/CMP-008 Checkbox", [{ state: "unchecked" }, { state: "checked" }], async ({ state }) => {
  const on = state === "checked";
  const c = COMP("HORIZONTAL", { align: "CENTER", justify: "CENTER", rSm: 1, fill: on ? "action/primary" : "bg/page" });
  if (!on) { c.strokes = [P("border/strong")]; c.strokeWeight = 2; c.strokeAlign = "INSIDE"; } else add(c, I("check", 16, "action/onPrimary"));
  WH(c, 24, 24); return c;
});
fitSection();
return { section: SEC.id, cleaned, madeVars, made: MADE.length, madeList: MADE.filter(x => !x.startsWith("C/Icon/")), icons: MADE.filter(x => x.startsWith("C/Icon/")).length, skipped: SKIPPED.length };
