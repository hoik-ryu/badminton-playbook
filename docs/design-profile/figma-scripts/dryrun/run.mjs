// dry-run: c1–c3, s1–s6를 모의 Figma에서 차례로 실행하고 화면 트리를 JSON으로 남깁니다.
// 사용: node run.mjs <varsJson> <outJson>
import fs from "node:fs"; import path from "node:path"; import { makeWorld, ownerName } from "./mock-figma.mjs";
const here = path.dirname(new URL(import.meta.url).pathname); const outDir = path.join(here, "..", "out");
const [varsPath, outPath] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(varsPath, "utf8"));
const libSrc = fs.readFileSync(path.join(here, "..", "lib.js"), "utf8");
const ST = Object.fromEntries([...libSrc.matchAll(/(\w+): "(S:[0-9a-f]+,)"/g)].map(m => [m[2], m[1]]));
const { figma, pages } = makeWorld(rows, ST);
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
const parts = ["c1-theme-icons-base", "c2-patterns", "c3-domain", "s1-auth-tutorial", "s2-member", "s3-ops-session", "s4-ops-roster", "s5-ops-clubmatch", "s6-ops-admin-pc"];
const log = [];
for (const p of parts) {
  const code = fs.readFileSync(path.join(outDir, p + ".full.js"), "utf8");
  try { const r = await new AsyncFunction("figma", code)(figma); log.push({ part: p, ok: true, created: r && r.created ? r.created.length : (r && r.made ? (Array.isArray(r.made) ? r.made.length : r.made) : null), skipped: r && r.skipped ? (Array.isArray(r.skipped) ? r.skipped.length : r.skipped) : 0 }); }
  catch (e) { log.push({ part: p, ok: false, error: String(e && e.stack || e).split("\n").slice(0, 3).join(" | ") }); }
}
// ---- 직렬화: 화면 프레임 → 컴포넌트 트리 + 토큰 ----
const tokOf = n => { const t = []; for (const k of ["fills", "strokes"]) for (const p of (n[k] || [])) if (p.boundVariables && p.boundVariables.color) t.push(p.boundVariables.color._token); for (const v of Object.values(n.boundVariables || {})) if (v && v._token) t.push(v._token); return t; };
function variantOf(inst) { const own = inst.mainComponent.parent && inst.mainComponent.parent.type === "COMPONENT_SET" ? inst.mainComponent.name : null; return own; }
function ser(n) {
  if (n.visible === false) return null;
  if (n.type === "INSTANCE") {
    const o = { c: ownerName(n.mainComponent) }; const v = variantOf(n); if (v) o.v = v; if (!n.name.startsWith("C/")) o.as = n.name;
    const props = {}; for (const [k, val] of Object.entries(n._props || {})) props[k.split("#")[0]] = val; if (Object.keys(props).length) o.p = props;
    const kids = []; const walk = m => { for (const ch of m.children) { if (ch.visible === false) continue; if (ch.type === "INSTANCE") { const s = ser(ch); if (s && !s.c.startsWith("C/Icon/")) kids.push(s); else if (s) kids.push({ icon: s.c.replace("C/Icon/", "") }); } else walk(ch); } }; walk(n);
    if (kids.length) o.k = kids; return o;
  }
  const o = { t: n.type === "TEXT" ? "text" : n.type.toLowerCase(), n: n.name };
  if (n.type === "TEXT") { o.text = n.characters; o.style = n.textStyle; }
  if (n.layoutMode && n.layoutMode !== "NONE") o.layout = n.layoutMode;
  const tk = tokOf(n); if (tk.length) o.tok = tk;
  const kids = n.children.map(ser).filter(Boolean); if (kids.length) o.k = kids; return o;
}
const tokensAll = n => { const s = new Set(tokOf(n)); for (const d of n.findAll()) for (const t of tokOf(d)) s.add(t); return [...s].sort(); };
const compsAll = n => { const m = {}; for (const d of n.findAll(x => x.type === "INSTANCE")) { const c = ownerName(d.mainComponent); if (!c.startsWith("C/Icon/")) m[c] = (m[c] || 0) + 1; } return m; };
const iconsAll = n => [...new Set(n.findAll(x => x.type === "INSTANCE").map(d => ownerName(d.mainComponent)).filter(c => c.startsWith("C/Icon/")).map(c => c.slice(7)))].sort();
const screens = [];
for (const sec of pages[2].children.filter(n => n.type === "SECTION")) for (const fr of sec.children.filter(n => n.type === "FRAME")) {
  const m = fr.name.match(/^(SCR-\d+)(?: \+ (SCR-\d+))? (.+?) \/ (ST\d+)\s*(.*?)\(C안\) \/ (\w+)$/);
  screens.push({ frame: fr.name, group: sec.name, scr: m ? [m[1], m[2]].filter(Boolean) : null, st: m ? m[4] : null, stateLabel: m ? m[5] : null, platform: m ? m[6] : null, size: [fr.width, fr.height], components: compsAll(fr), icons: iconsAll(fr), tokens: tokensAll(fr), tree: fr.children.map(ser).filter(Boolean) });
}
const lib = []; const libSec = pages[1].children.find(n => n.type === "SECTION");
if (libSec) for (const c of libSec.children) { if (!["COMPONENT", "COMPONENT_SET"].includes(c.type) || c.name.startsWith("C/Icon/")) continue; const d = c.componentPropertyDefinitions; lib.push({ name: c.name, type: c.type, variants: c.type === "COMPONENT_SET" ? c.children.map(v => v.name) : [], props: Object.keys(d).filter(k => d[k].type === "TEXT").map(k => k.split("#")[0]), tokens: tokensAll(c), uses: Object.keys(compsAll(c)) }); }
fs.writeFileSync(outPath, JSON.stringify({ generated: "dry-run (mock Figma, no network)", log, library: lib, screens }, null, 1));
console.log(JSON.stringify(log, null, 1)); console.log("screens", screens.length, "library", lib.length);
