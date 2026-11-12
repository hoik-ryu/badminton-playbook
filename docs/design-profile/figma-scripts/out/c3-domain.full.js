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

// ===== part: c3-domain.js =====
// c3: 도메인 컴포넌트(CMP-041–047) + 스켈레톤 행. c1·c2 이후 실행. 멱등.
await openLibSection();
if (!CMP["C/CMP-027 StateView"]) throw new Error("run c2 first");
_cx = 99999;
const badge = (tone, label, name) => { const b = inst("C/CMP-005 Badge", { tone }, { Label: label }); if (name) b.name = name; return b; };
// CMP-041 GameCard
const gcCombos = [{ label: "numbered", phase: "review" }, { label: "numbered", phase: "live" }, { label: "numbered", phase: "recorded" }, { label: "blueWhite", phase: "review" }, { label: "blueWhite", phase: "live" }, { label: "blueWhite", phase: "recorded" }, { label: "blueWhite", phase: "member" }];
await mkSet("C/CMP-041 GameCard", gcCombos, async ({ label, phase }) => {
  const team = label === "blueWhite", member = phase === "member";
  const c = COMP("VERTICAL", { pad: 12, gap: 8, rMd: 1, fill: "bg/page", stroke: member ? "action/accent" : "border/default", sw: member ? 2 : 1 }); W(c, 358);
  const top = AL("HORIZONTAL", { name: "Top", align: "CENTER", gap: 8 }); add(c, top, { fillW: 1 });
  add(top, await T("코트 1", "bodyStrong", "text/primary", { name: "Court" }), { grow: 1 });
  add(top, await T(member ? "내 경기" : "실력차 1", "caption", member ? "selected/fg" : "text/secondary", { name: "Meta" }));
  for (const side of ["A", "B"]) {
    const win = phase === "recorded" && side === "A";
    const r = AL("HORIZONTAL", { name: "Team" + side, align: "CENTER", gap: 8, pad: [8, 8, 8, 0], rSm: 1, fill: win ? "selected/bg" : "bg/surface" }); add(c, r, { fillW: 1 });
    add(r, rect(4, 24, team ? (side === "A" ? "team/blue/fg" : "border/strong") : null, 2));
    if (team) add(r, badge(side === "A" ? "teamBlue" : "teamWhite", side === "A" ? "청팀" : "백팀", "TeamLabel"));
    else add(r, await T(side === "A" ? "1팀" : "2팀", "captionStrong", "text/secondary", { name: "TeamLabel" }));
    add(r, await T(side === "A" ? "김가람 · 박다온" : "한바다 · 정마루", win ? "bodyStrong" : "body", "text/primary", { name: "Team" + side }), { grow: 1 });
    if (!member && !team) add(r, await T(side === "A" ? "합 16" : "합 18", "caption", "text/secondary", { name: "Sum" + side }));
    if (win) add(r, badge("success", "승", "Win"));
  }
  if (phase === "live") {
    const row = AL("HORIZONTAL", { name: "Results", gap: 8 }); add(c, row, { fillW: 1 });
    for (const s of ["A", "B"]) { const b = inst("C/CMP-001 Button", { variant: "secondary", size: "md" }, { Label: team ? (s === "A" ? "청 승" : "백 승") : (s === "A" ? "1팀 승" : "2팀 승") }); b.name = "Win" + s; add(row, b, { grow: 1 }); }
  }
  if (phase === "review") add(c, await T("선수를 누르면 교체할 수 있습니다", "caption", "text/secondary", { name: "Hint" }), { fillW: 1 });
  return c;
}, { Court: "코트 1", Meta: "실력차 1", TeamA: "김가람 · 박다온", TeamB: "한바다 · 정마루" });
// CMP-042 StandingsCard
await mkSet("C/CMP-042 StandingsCard", [{ mode: "team" }, { mode: "individual" }], async ({ mode }) => {
  const c = COMP("VERTICAL", { pad: 16, gap: 8, rMd: 1, fill: "bg/surface" }); W(c, 358);
  if (mode === "team") {
    const r = AL("HORIZONTAL", { name: "Score", align: "CENTER", gap: 12 }); add(c, r, { fillW: 1 });
    add(r, badge("teamBlue", "청팀")); add(r, await T("3", "display", "team/blue/fg", { name: "ScoreA" })); add(r, await T("승", "body", "text/secondary"));
    add(r, rect(16, 1, null)); add(r, badge("teamWhite", "백팀")); add(r, await T("2", "display", "text/primary", { name: "ScoreB" })); add(r, await T("승", "body", "text/secondary"));
    add(c, await T("남은 경기 3", "caption", "text/secondary", { name: "Summary" }), { fillW: 1 });
  } else {
    add(c, await T("순위", "bodyStrong", "text/primary", { name: "Heading" }));
    for (const [i, t] of [[1, "1위 김가람 3승"], [2, "2위 박다온 2승"], [3, "공동 3위 한바다 · 오아라 1승"]]) add(c, await T(t, "body", "text/primary", { name: "Row" + i }), { fillW: 1 });
  }
  return c;
}, { ScoreA: "3", ScoreB: "2", Summary: "남은 경기 3", Row1: "1위 김가람 3승", Row2: "2위 박다온 2승", Row3: "공동 3위 한바다 · 오아라 1승" });
// CMP-043 ClubMatchListItem
const CM = { pending: ["warning", "대진 미확정"], live: ["info", "진행 중"], done: ["success", "종료"] };
await mkSet("C/CMP-043 ClubMatchListItem", Object.keys(CM).map(s => ({ status: s })), async ({ status }) => {
  const c = COMP("VERTICAL", { pad: [12, 16, 12, 16], gap: 4, fill: "bg/page" }); W(c, 390); divider(c, "bottom");
  const r = AL("HORIZONTAL", { name: "Meta", align: "CENTER", gap: 6 }); add(c, r, { fillW: 1 });
  add(r, await T("11월 9일(일)", "caption", "text/secondary", { name: "Date" })); add(r, badge("neutral", "팀전", "Mode")); add(r, badge(CM[status][0], CM[status][1], "Status"));
  add(c, await T("11월 정기 청백전", "bodyStrong", "text/primary", { name: "Name" }), { fillW: 1 });
  add(c, await T("청팀 3 : 2 백팀", "caption", "text/secondary", { name: "Summary" }), { fillW: 1 });
  return c;
}, { Date: "11월 9일(일)", Name: "11월 정기 청백전", Summary: "청팀 3 : 2 백팀" });
// CMP-044 CandidateList 행
await mkSet("C/CMP-044 CandidateRow", [{ state: "available" }, { state: "disabled" }, { state: "warning" }], async ({ state }) => {
  const dis = state === "disabled";
  const c = COMP("HORIZONTAL", { align: "CENTER", gap: 12, pad: [0, 16], fill: "bg/page" }); WH(c, 390, 64); divider(c, "bottom");
  const tx = AL("VERTICAL", { name: "Text" }); add(c, tx, { fillW: 1 });
  add(tx, await T("오아라", "bodyStrong", dis ? "text/disabled" : "text/primary", { name: "Name" }), { fillW: 1 });
  add(tx, await T("대기 · 2경기 · 교체 후 실력차 1", "caption", dis ? "text/disabled" : "text/secondary", { name: "Info" }), { fillW: 1 });
  if (state === "warning") add(c, badge("warning", "경기 수 차이", "Warn"));
  if (dis) add(c, badge("neutral", "경기 중", "Reason")); else add(c, I("arrow-left-right", 20, "action/primary"));
  return c;
}, { Name: "오아라", Info: "대기 · 2경기 · 교체 후 실력차 1" });
// CMP-045 RecordSummary
await mkSet("C/CMP-045 RecordSummary", [{ rank: "yes" }, { rank: "none" }], async ({ rank }) => {
  const c = COMP("VERTICAL", { pad: 16, gap: 12, rMd: 1, fill: "bg/page", stroke: "border/default" }); W(c, 358);
  const h = AL("HORIZONTAL", { name: "Head", align: "CENTER", gap: 8 }); add(c, h, { fillW: 1 });
  add(h, await T("랭크", "bodyStrong", "text/primary"), { grow: 1 }); const q = I("circle-help", 20, "text/secondary"); q.name = "랭크 기준 보기"; add(h, q);
  if (rank === "yes") add(c, await T("A", "display", "action/primary", { name: "Rank" }));
  else add(c, await T("랭크까지 3경기", "title", "text/primary", { name: "Rank" }));
  add(c, await T(rank === "yes" ? "청백전 20경기 기준" : "청백전 2경기 참여", "caption", "text/secondary", { name: "Note" }), { fillW: 1 });
  const d = rect(326, 1, "border/default"); add(c, d); d.layoutSizingHorizontal = "FILL";
  add(c, await T("청백전 12전 7승 5패", "body", "text/primary", { name: "Record" }), { fillW: 1 });
  return c;
}, { Rank: "A", Note: "청백전 20경기 기준", Record: "청백전 12전 7승 5패" });
// CMP-046 TutorialCourt(세로 탑뷰, 코트 토큰)
await mkComp("C/CMP-046 TutorialCourt", async () => {
  const c = figma.createComponent(); c.resize(358, 400); c.fills = [P("court/surface")]; for (const k of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) c.setBoundVariable(k, V["radius/md"]);
  const line = (x, y, w, h) => { const r = figma.createRectangle(); r.resize(w, h); r.x = x; r.y = y; r.fills = []; r.strokes = [P("court/line")]; r.strokeWeight = 2; c.appendChild(r); return r; };
  line(24, 16, 310, 368); line(24, 199, 310, 2); line(24, 136, 310, 128); line(178, 16, 2, 120); line(178, 264, 2, 120);
  const dot = (x, y, color, label) => { const e = figma.createEllipse(); e.resize(32, 32); e.x = x; e.y = y; e.fills = [P(color)]; e.strokes = [P("court/line")]; e.strokeWeight = 2; e.name = label; c.appendChild(e); return e; };
  dot(90, 300, "court/me", "나"); dot(236, 300, "bg/page", "파트너"); dot(90, 70, "court/opponent", "상대 1"); dot(236, 70, "court/opponent", "상대 2");
  const s = figma.createEllipse(); s.resize(12, 12); s.x = 172; s.y = 176; s.fills = [P("court/line")]; s.name = "셔틀콕"; c.appendChild(s);
  return c;
});
// CMP-047 StageCard
const SC = { notPlayed: [null, ""], passed: ["success", "통과"], failed: ["warning", "미통과"], comingSoon: ["neutral", "준비 중"] };
await mkSet("C/CMP-047 StageCard", Object.keys(SC).map(s => ({ status: s })), async ({ status }) => {
  const soon = status === "comingSoon";
  const c = COMP("HORIZONTAL", { align: "CENTER", gap: 12, pad: [0, 16], rMd: 1, fill: soon ? "bg/surface" : "bg/page", stroke: "border/default" }); WH(c, 358, 72);
  const tx = AL("VERTICAL", { name: "Text" }); add(c, tx, { fillW: 1 });
  add(tx, await T("스테이지 1", "bodyStrong", soon ? "text/disabled" : "text/primary", { name: "Name" }), { fillW: 1 });
  add(tx, await T(status === "notPlayed" ? "아직 안 함" : "최고 5점 중 4점", "caption", "text/secondary", { name: "Sub" }), { fillW: 1 });
  if (SC[status][0]) add(c, badge(SC[status][0], SC[status][1], "Status")); else add(c, I("chevron-right", 20, "text/secondary"));
  return c;
}, { Name: "스테이지 1", Sub: "최고 5점 중 4점" });
fitSection();
return { made: MADE, skipped: SKIPPED.length };
