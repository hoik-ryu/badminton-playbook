// Preview 공통 레이아웃(PC 중앙 정렬 열) 확인. 사용: node experiments/preview-review/layout-check.mjs <라벨(before|after)> [기준 URL]
// 개발 서버(기본 http://localhost:55180)를 열어 5개 폭에서 열 너비·중앙 정렬·고정 요소 위치·가로 스크롤·바깥 배경·그림자를 측정합니다.
import fs from "node:fs"; import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname); const repo = path.resolve(here, "../..");
const POC = path.join(repo, "experiments/c-preview-poc");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, ".pw-browsers");
const { chromium } = await import(path.join(POC, "node_modules/playwright/index.mjs"));
const [LABEL = "after", BASE = "http://localhost:55180/"] = process.argv.slice(2);
const OUT = path.join(here, "results/layout", LABEL); fs.mkdirSync(OUT, { recursive: true });
const VPS = [{ w: 360, h: 800, m: 1 }, { w: 390, h: 844, m: 1 }, { w: 430, h: 932, m: 1 }, { w: 1280, h: 800, m: 0 }, { w: 1440, h: 900, m: 0 }];
const URLS = { bare: "?bare=1&safe=34#SCR-211/SCR-211-ST1/mobile", shellDesktop: "#SCR-211/SCR-211-ST1/desktop" };
const b = await chromium.launch(); const res = [];
for (const vp of VPS) for (const [kind, q] of Object.entries(URLS)) {
  if (kind === "shellDesktop" && vp.m) continue;
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: !!vp.m, hasTouch: !!vp.m });
  const p = await ctx.newPage(); const errs = []; p.on("console", m => { if (m.type() === "error") errs.push(m.text()); }); p.on("pageerror", e => errs.push(String(e)));
  await p.goto(BASE + q, { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
  const m = await p.evaluate(() => {
    const R = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
    const root = document.querySelector(".smapsh"), nav = document.querySelector("[data-testid=app-nav]"), fab = document.querySelector("[data-testid=fab]");
    const col = document.querySelector(".pv-column") || root; const host = col.parentElement;
    const rootR = R(root), navR = R(nav), fabR = R(fab), colR = R(col);
    return { vw: innerWidth, vh: innerHeight, docScrollW: document.documentElement.scrollWidth, hScroll: document.documentElement.scrollWidth > innerWidth + 0.5, column: colR, content: rootR, nav: navR, fab: fabR,
      navInsideColumn: navR.x >= colR.x - 0.5 && navR.right <= colR.right + 0.5, navMatchesColumn: Math.abs(navR.x - colR.x) <= 1 && Math.abs(navR.right - colR.right) <= 1, navAtViewportBottom: Math.abs(navR.bottom - Math.min(innerHeight, colR.bottom)) <= 1,
      fabRightInset: colR.right - fabR.right, centered: Math.abs((colR.x) - (innerWidth - colR.w) / 2) <= 1 || colR.w >= innerWidth - 1,
      outerBg: getComputedStyle(host).backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor, columnShadow: getComputedStyle(col).boxShadow, rows: document.querySelectorAll("[data-testid=person-row]").length };
  });
  const s = await ctx.newCDPSession(p); const r = await s.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, `${kind}-${vp.w}.png`), Buffer.from(r.data, "base64"));
  res.push({ kind, ...vp, ...m, errors: errs.length }); await ctx.close();
}
await b.close(); fs.writeFileSync(path.join(OUT, "layout.json"), JSON.stringify(res, null, 1));
for (const x of res) console.log(`${x.kind.padEnd(12)} ${String(x.w).padStart(4)} col=${x.column.x}+${x.column.w} centered=${x.centered} nav=${x.nav.x}..${x.nav.right} navInCol=${x.navInsideColumn} navMatch=${x.navMatchesColumn} navBottom=${x.navAtViewportBottom} fabInset=${x.fabRightInset} hScroll=${x.hScroll} outer=${x.outerBg} shadow=${x.columnShadow === "none" ? "none" : "yes"} rows=${x.rows} err=${x.errors}`);
setTimeout(() => process.exit(0), 200);
