// 승인 tokens.json(읽기 전용) + 테마 파일 → src/styles/tokens.css, review/palette.json
// Tailwind 기본 색은 비워(--color-*: initial) 토큰 밖 색 클래스를 쓸 수 없게 함.
import fs from "node:fs"; import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TOKENS = path.resolve(root, "../../docs/design-profile/tokens.json");
const THEME = path.join(root, "themes/c-mint-hybrid.json");
const tok = JSON.parse(fs.readFileSync(TOKENS, "utf8")); const theme = JSON.parse(fs.readFileSync(THEME, "utf8"));
const flat = {}; // "color.bg.page" -> {type, value}
(function walk(n, p, type) { for (const [k, v] of Object.entries(n)) { if (k.startsWith("$")) continue; const key = p ? p + "." + k : k; const t = v.$type || type; if (v && typeof v === "object" && "$value" in v) flat[key] = { type: t, value: v.$value }; else if (v && typeof v === "object") walk(v, key, t); } })(tok, "", null);
const prim = theme.primitive;
const resolve = (val, seen = 0) => { if (typeof val === "string" && /^\{.+\}$/.test(val)) { const k = val.slice(1, -1); if (prim[k]) return prim[k]; if (!flat[k]) throw new Error("unresolved " + k); return resolve(flat[k].value, seen + 1); } return val; };
const hexOf = v => (typeof v === "object" && v.hex) ? v.hex.toUpperCase() : String(v).toUpperCase();
const dim = v => typeof v === "object" ? v.value + (v.unit || "") : v;
const cssName = k => "--" + k.replace(/\./g, "-");
const colors = {}; const origin = {};
for (const [k, t] of Object.entries(flat)) if (t.type === "color" && k.startsWith("color.")) { colors[k] = hexOf(resolve(t.value)); origin[k] = "tokens.json"; }
for (const [k, v] of Object.entries(theme.override)) { if (!colors[k]) throw new Error("override of unknown " + k); colors[k] = hexOf(resolve(v)); origin[k] = "theme override (실험)"; }
for (const [k, v] of Object.entries(theme.add)) { if (colors[k]) throw new Error("add collides " + k); colors[k] = hexOf(resolve(v)); origin[k] = "theme add (실험)"; }
const L = [];
L.push("/* 생성 파일: scripts/gen-tokens.mjs — 직접 수정 금지. 원본: docs/design-profile/tokens.json(승인) + themes/" + theme.name + ".json(실험) */");
L.push("@theme {", "  --color-*: initial;", "  --color-transparent: transparent;", "  --color-current: currentColor;");
for (const [k, v] of Object.entries(colors)) L.push(`  ${cssName(k).replace("--color-", "--color-")}: ${v}; /* ${origin[k]} */`);
for (const [k, t] of Object.entries(flat)) {
  if (k.startsWith("radius.")) L.push(`  --radius-${k.split(".")[1]}: ${dim(t.value)};`);
  if (k.startsWith("font.size.")) { L.push(`  --text-${k.split(".")[2]}: ${dim(t.value)};`); L.push(`  --text-${k.split(".")[2]}--line-height: ${flat["font.lineHeight.body"].value};`); }
}
L.push("  --radius-lg: var(--radius-md); /* shadcn rounded-lg → 04 radius.md */");
L.push(`  --spacing: 4px; /* space.* = 4px 배수 */`);
L.push(`  --font-sans: "Pretendard Variable", Pretendard, ${(flat["font.family.base"].value).join(", ")}; /* VD-001 */`);
const sh = v => `${dim(v.offsetX)} ${dim(v.offsetY)} ${dim(v.blur)} ${dim(v.spread)} rgba(0, 0, 0, ${v.color.alpha})`;
L.push(`  --shadow-sheet: ${sh(flat["elevation.sheet"].value)};`, `  --shadow-card: ${sh(flat["elevation.card"].value)};`);
L.push("}");
// shadcn 별칭(tokens.json shadcn.*) → :root 변수 + Tailwind 색 이름
const sc = Object.entries(flat).filter(([k]) => k.startsWith("shadcn."));
L.push(":root {");
for (const [k, t] of sc) { const ref = String(t.value).slice(1, -1); L.push(k === "shadcn.radius" ? `  --radius: var(--radius-md);` : `  --${k.slice(7)}: var(${cssName(ref)});`); }
L.push(`  --primary: var(--color-action-primary); /* C 테마가 action.primary를 덮어씀 */`);
L.push("  --safe-bottom: env(safe-area-inset-bottom, 0px);", "}");
L.push("@theme inline {"); for (const [k] of sc) if (k !== "shadcn.radius") L.push(`  --color-${k.slice(7)}: var(--${k.slice(7)});`); L.push("}");
fs.writeFileSync(path.join(root, "src/styles/tokens.css"), L.join("\n") + "\n");
fs.mkdirSync(path.join(root, "review"), { recursive: true });
fs.writeFileSync(path.join(root, "review/palette.json"), JSON.stringify({ colors, origin }, null, 1));
console.log("colors", Object.keys(colors).length, "shadcn aliases", sc.length);
