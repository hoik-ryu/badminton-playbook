// Figma Plugin API 최소 모의 객체(dry-run). 실제 Figma 호출 없이 c*/s* 스크립트를 실행해
// (1) 실행 오류를 미리 찾고 (2) 화면 트리(컴포넌트·변형·글자·토큰)를 기록합니다.
// 한계: 자동 레이아웃 크기 계산, 글꼴·렌더링, 실제 API 값 검증은 하지 않습니다.
let idc = 1; const REG = new Map();
const nid = () => `m:${idc++}`;
export const STYLE_NAMES = {};
class Node {
  constructor(type) { this.id = nid(); REG.set(this.id, this); this.type = type; this.name = type; this.children = []; this.parent = null; this.x = 0; this.y = 0; this.width = 100; this.height = 100; this.fills = []; this.strokes = []; this.visible = true; this.layoutMode = "NONE"; this.boundVariables = {}; this.componentPropertyReferences = null; this._chars = ""; }
  get characters() { return this._chars; } set characters(v) { this._chars = String(v); this.width = Math.max(8, this._chars.length * 14); }
  appendChild(c) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = this; this.children.push(c); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; REG.delete(this.id); }
  resize(w, h) { this.width = w; this.height = h; } resizeWithoutConstraints(w, h) { this.resize(w, h); }
  findAll(f) { const out = []; const walk = n => { for (const c of n.children) { if (!f || f(c)) out.push(c); walk(c); } }; walk(this); return out; }
  findOne(f) { return this.findAll(f)[0] || null; } findChild(f) { return this.children.find(f) || null; }
  findAllWithCriteria({ types }) { return this.findAll(n => types.includes(n.type)); }
  setBoundVariable(k, v) { this.boundVariables[k] = v ? { id: v.id, _token: v._full } : null; }
  async setTextStyleIdAsync(id) { if (!STYLE_NAMES[id]) throw new Error("unknown text style " + id); this.textStyle = STYLE_NAMES[id]; this.height = 24; }
  async setEffectStyleIdAsync(id) { this.effectStyle = id; }
  setExplicitVariableModeForCollection() { } async loadAsync() { }
  // ----- 컴포넌트 -----
  get componentPropertyDefinitions() {
    if (this.type === "COMPONENT" && this.parent && this.parent.type === "COMPONENT_SET") throw new Error("componentPropertyDefinitions on variant (Rule 18)");
    const d = Object.assign({}, this._defs || {});
    if (this.type === "COMPONENT_SET") for (const v of this.children) for (const [k, val] of Object.entries(parseVariant(v.name))) { d[k] = d[k] || { type: "VARIANT", variantOptions: [] }; if (!d[k].variantOptions.includes(val)) d[k].variantOptions.push(val); }
    return d;
  }
  addComponentProperty(name, type, def) { if (!["COMPONENT", "COMPONENT_SET"].includes(this.type)) throw new Error("addComponentProperty on " + this.type); this._defs = this._defs || {}; const key = `${name}#${idc++}:0`; this._defs[key] = { type, defaultValue: def }; return key; }
  get defaultVariant() { return this.children[0]; }
  createInstance() { if (this.type !== "COMPONENT") throw new Error("createInstance on " + this.type); const i = cloneTree(this, true); i.type = "INSTANCE"; i.mainComponent = this; i.name = ownerName(this); i._props = {}; return i; }
  get componentProperties() { if (this.type !== "INSTANCE") throw new Error("componentProperties on " + this.type); const own = owner(this.mainComponent); const out = {}; for (const [k, d] of Object.entries(own.componentPropertyDefinitions)) out[k] = { type: d.type, value: d.type === "VARIANT" ? parseVariant(this.mainComponent.name)[k] : (this._props[k] ?? d.defaultValue) }; return out; }
  setProperties(p) {
    if (this.type !== "INSTANCE") throw new Error("setProperties on " + this.type);
    const own = owner(this.mainComponent); const defs = own.componentPropertyDefinitions;
    const vk = Object.keys(p).filter(k => !k.includes("#"));
    if (vk.length) {
      if (own.type !== "COMPONENT_SET") throw new Error("variant prop on non-set " + own.name + " " + vk);
      const want = Object.assign(parseVariant(this.mainComponent.name), Object.fromEntries(vk.map(k => [k, String(p[k])])));
      const v = own.children.find(c => { const pv = parseVariant(c.name); return Object.keys(want).every(k => pv[k] === want[k]); });
      if (!v) throw new Error(`no variant ${JSON.stringify(want)} in ${own.name}`);
      this._swap(v);
    }
    for (const k of Object.keys(p).filter(k => k.includes("#"))) { if (!defs[k]) throw new Error(`unknown prop ${k} on ${own.name}`); this._props[k] = p[k]; }
    this._applyText();
  }
  swapComponent(c) { if (this.type !== "INSTANCE") throw new Error("swap on " + this.type); this._swap(c); }
  _swap(c) { const nm = this.name; for (const ch of [...this.children]) ch.remove(); const t = cloneTree(c, true); for (const ch of [...t.children]) this.appendChild(ch); this.mainComponent = c; if (nm.startsWith("C/")) this.name = ownerName(c); this._applyText(); }
  _applyText() { for (const t of ownTexts(this)) { const ref = t.componentPropertyReferences && t.componentPropertyReferences.characters; if (ref && this._props[ref] != null) t.characters = this._props[ref]; } }
  set(props) { Object.assign(this, props); return this; }
}
function parseVariant(n) { const o = {}; for (const part of String(n).split(",")) { const [k, v] = part.split("=").map(s => s && s.trim()); if (k && v != null) o[k] = v; } return o; }
function owner(c) { return c.parent && c.parent.type === "COMPONENT_SET" ? c.parent : c; }
export function ownerName(c) { return owner(c).name; }
function ownTexts(root) { return root.findAll(n => { if (n.type !== "TEXT") return false; let p = n.parent; while (p && p !== root) { if (p.type === "INSTANCE") return false; p = p.parent; } return true; }); }
const COPY = ["name", "_chars", "textStyle", "fills", "strokes", "layoutMode", "width", "height", "componentPropertyReferences", "visible", "boundVariables", "itemSpacing", "effectStyle", "layoutSizingHorizontal", "layoutSizingVertical", "layoutGrow"];
function cloneTree(n, top) { const c = new Node(n.type); for (const k of COPY) if (n[k] !== undefined) c[k] = JSON.parse(JSON.stringify(n[k])); if (n.type === "INSTANCE") { c.mainComponent = n.mainComponent; c._props = Object.assign({}, n._props); } if (n.type === "COMPONENT" && !top) c.type = "COMPONENT"; for (const ch of n.children) c.appendChild(cloneTree(ch, false)); return c; }
// ----- 변수 -----
export function makeWorld(varRows, styleIds) {
  Object.assign(STYLE_NAMES, styleIds);
  const cols = [], vars = [];
  const mkCol = name => { const c = { id: `VariableCollectionId:${idc++}`, name, modes: [{ modeId: `${idc++}:0`, name: "Mode 1" }], renameMode() { }, addMode() { throw new Error("in addMode: Limited to 1 modes only"); } }; cols.push(c); return c; };
  const mkVar = (name, col, type) => { const v = { id: `VariableID:${idc++}`, name, variableCollectionId: col.id, resolvedType: type, scopes: [], _full: col.name + "/" + name, setValueForMode() { } }; vars.push(v); return v; };
  const byName = {};
  for (const [c, n, t] of varRows) { byName[c] = byName[c] || mkCol(c); mkVar(n, byName[c], t); }
  const prim = mkCol("exp/brand-primitive"); for (const n of ["pine/50", "pine/700", "grass/100", "grass/700", "grass/900"]) mkVar(n, prim, "COLOR");
  for (const t of ["exp/theme-A", "exp/theme-B"]) { const c = mkCol(t); for (const n of ["action/primary", "action/tint", "nav/active", "header/bg", "header/fg"]) mkVar(n, c, "COLOR"); }
  const root = new Node("DOCUMENT");
  const pages = [["0:1", "00 Foundations"], ["1:73", "01 Components"], ["1:74", "운영 · 명단"]].map(([id, name]) => { const p = new Node("PAGE"); REG.delete(p.id); p.id = id; REG.set(id, p); p.name = name; root.appendChild(p); return p; });
  const figma = {
    root, currentPage: pages[0], mixed: Symbol("mixed"),
    async loadFontAsync() { }, async listAvailableFontsAsync() { return []; },
    async getNodeByIdAsync(id) { return REG.get(id) || null; },
    async setCurrentPageAsync(p) { figma.currentPage = p; },
    variables: {
      async getLocalVariableCollectionsAsync() { return cols.slice(); }, async getLocalVariablesAsync() { return vars.slice(); },
      createVariableCollection: mkCol, createVariable: (n, col, t) => mkVar(n, typeof col === "string" ? cols.find(c => c.id === col) : col, t),
      createVariableAlias: v => ({ type: "VARIABLE_ALIAS", id: v.id }),
      setBoundVariableForPaint(p, f, v) { if (!v) throw new Error("bind undefined variable"); return Object.assign({}, p, { boundVariables: { color: { type: "VARIABLE_ALIAS", id: v.id, _token: v._full } } }); },
    },
  };
  const onPage = n => { figma.currentPage.appendChild(n); return n; };
  figma.createFrame = () => onPage(new Node("FRAME"));
  figma.createAutoLayout = (dir, props) => { const f = onPage(new Node("FRAME")); f.layoutMode = typeof dir === "string" ? dir : "HORIZONTAL"; if (typeof dir === "object") Object.assign(f, dir); if (props) Object.assign(f, props); return f; };
  figma.createText = () => onPage(new Node("TEXT"));
  figma.createRectangle = () => onPage(new Node("RECTANGLE"));
  figma.createEllipse = () => onPage(new Node("ELLIPSE"));
  figma.createComponent = () => onPage(new Node("COMPONENT"));
  figma.createSection = () => onPage(new Node("SECTION"));
  figma.createNodeFromSvg = svg => { const f = onPage(new Node("FRAME")); const g = new Node("GROUP"); f.appendChild(g); const n = (svg.match(/<(path|circle|line|polyline|polygon|rect)\b/g) || []).length; for (let i = 0; i < n; i++) { const v = new Node("VECTOR"); v.strokes = [{ type: "SOLID" }]; g.appendChild(v); } return f; };
  figma.ungroup = g => { const p = g.parent; for (const c of [...g.children]) p.appendChild(c); g.remove(); };
  figma.combineAsVariants = (nodes, parent) => { const s = new Node("COMPONENT_SET"); parent.appendChild(s); for (const n of nodes) s.appendChild(n); return s; };
  return { figma, pages, cols, vars };
}
