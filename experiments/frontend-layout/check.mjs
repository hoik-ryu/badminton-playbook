// frontend/ 최상위 레이아웃(PC 가운데 열) 확인. 사용: node experiments/frontend-layout/check.mjs <before URL> <after URL>
// 측정만 하며 앱 코드를 바꾸지 않습니다. 고정 요소 클래스는 브라우저 안에 임시 요소를 넣어 확인합니다.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const here = path.dirname(new URL(import.meta.url).pathname); const repo = path.resolve(here, "../..");
const POC = path.join(repo, "experiments/c-preview-poc");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, ".pw-browsers");
const { chromium } = await import(path.join(POC, "node_modules/playwright/index.mjs"));
const [BEFORE = "http://localhost:5183/", AFTER = "http://localhost:5173/"] = process.argv.slice(2);
const OUT = path.join(here, "results"); fs.mkdirSync(OUT, { recursive: true });
const VPS = [{ w: 360, h: 800, m: 1 }, { w: 390, h: 844, m: 1 }, { w: 430, h: 932, m: 1 }, { w: 1280, h: 800, m: 0 }, { w: 1440, h: 900, m: 0 }];
function probe(withFixed) {
  const R = el => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) }; };
  const main = document.querySelector("main"); const col = document.querySelector(".app-column") || main;
  const boxes = [...document.querySelectorAll("main *")].map(e => ({ tag: e.tagName.toLowerCase(), text: (e.textContent || "").trim().slice(0, 20), ...R(e) }));
  const clipped = [...document.querySelectorAll("body *")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5); }).map(e => e.tagName.toLowerCase());
  const overflowText = [...document.querySelectorAll("main *")].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible").map(e => e.tagName.toLowerCase());
  const out = { vw: innerWidth, hScroll: document.documentElement.scrollWidth > innerWidth + 0.5, docH: document.documentElement.scrollHeight, column: R(col), main: R(main), centered: Math.abs(R(col).x - (innerWidth - R(col).w) / 2) <= 1, shadow: getComputedStyle(col).boxShadow, htmlBg: getComputedStyle(document.documentElement).backgroundColor, colBg: getComputedStyle(col).backgroundColor, bodyMargin: getComputedStyle(document.body).margin, boxes, clipped, overflowText, h1: document.querySelector("h1")?.textContent, health: document.querySelector("#health-title")?.textContent };
  if (withFixed) {
    const bar = document.createElement("div"); bar.className = "app-fixed-bar"; Object.assign(bar.style, { bottom: "0", height: "56px", background: "rgba(0,0,0,0.001)" });
    const end = document.createElement("div"); end.className = "app-fixed-end"; Object.assign(end.style, { bottom: "72px", width: "120px", height: "48px", background: "rgba(0,0,0,0.001)" });
    document.body.append(bar, end); const c = R(col), b = R(bar), e = R(end);
    out.fixed = { bar: b, end: e, barMatchesColumn: Math.abs(b.x - c.x) <= 1 && Math.abs(b.right - c.right) <= 1, endInsetFromColumn: +(c.right - e.right).toFixed(1), endInsideColumn: e.x >= c.x - 0.5 && e.right <= c.right + 0.5 };
    bar.remove(); end.remove();
  }
  return out;
}
const b = await chromium.launch(); const res = {};
for (const [label, url] of [["before", BEFORE], ["after", AFTER]]) {
  res[label] = [];
  for (const vp of VPS) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: !!vp.m, hasTouch: !!vp.m });
    const p = await ctx.newPage(); const errs = [];
    // 전후 비교를 공정하게: /health 응답을 같은 고정 값으로(5183은 백엔드 CORS 허용 밖이라 실제 호출 시 오류 화면이 됨)
    await p.route("**/health", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ status: "ok", database: "ok", version: "0.1.0", environment: "local" }) })); p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); }); p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
    await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(400);
    const m = await p.evaluate(probe, label === "after");
    const s = await ctx.newCDPSession(p); const r = await s.send("Page.captureScreenshot", { format: "png" }); const buf = Buffer.from(r.data, "base64");
    fs.writeFileSync(path.join(OUT, `${label}-${vp.w}.png`), buf);
    res[label].push({ ...vp, ...m, shotSha: crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12), errors: errs }); await ctx.close();
  }
}
await b.close();
const cmp = VPS.map((vp, i) => { const a = res.before[i], z = res.after[i]; const same = JSON.stringify(a.boxes) === JSON.stringify(z.boxes); return { w: vp.w, mobile: !!vp.m, mainBoxSame: same, shotSame: a.shotSha === z.shotSha, before: { col: a.column.w, main: a.main, hScroll: a.hScroll }, after: { col: z.column, centered: z.centered, shadow: z.shadow, htmlBg: z.htmlBg, colBg: z.colBg, bodyMargin: z.bodyMargin, hScroll: z.hScroll, clipped: z.clipped.length, overflowText: z.overflowText.length, fixed: z.fixed, h1: z.h1, health: z.health, errors: z.errors } }; });
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), before: BEFORE, after: AFTER, compare: cmp, raw: res }, null, 1));
for (const c of cmp) console.log(JSON.stringify(c));
setTimeout(() => process.exit(0), 200);
