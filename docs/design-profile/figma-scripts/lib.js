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
