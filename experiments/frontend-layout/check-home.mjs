// frontend/ 서비스 첫 화면(SCR-001)·개발용 상태 경로·PC 가운데 열 확인. 사용: node experiments/frontend-layout/check-home.mjs [기준 URL]
import fs from "node:fs"; import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname); const repo = path.resolve(here, "../..");
const POC = path.join(repo, "experiments/c-preview-poc");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(POC, ".pw-browsers");
const { chromium } = await import(path.join(POC, "node_modules/playwright/index.mjs"));
const BASE = (process.argv[2] || "http://localhost:5173").replace(/\/$/, "");
const OUT = path.join(here, "results/home"); fs.mkdirSync(OUT, { recursive: true });
const VPS = [{ w: 360, h: 800, m: 1 }, { w: 390, h: 844, m: 1 }, { w: 430, h: 932, m: 1 }, { w: 1280, h: 800, m: 0 }, { w: 1440, h: 900, m: 0 }];
const b = await chromium.launch(); const res = [];
for (const vp of VPS) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: !!vp.m, hasTouch: !!vp.m, locale: "ko-KR" });
  const p = await ctx.newPage(); const errs = []; p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); }); p.on("pageerror", e => errs.push(String(e).slice(0, 160)));
  await p.goto(BASE + "/", { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  const home = await p.evaluate(() => {
    const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
    const col = document.querySelector(".app-column"), btn = document.querySelector(".login__kakao"), h1 = document.querySelector("h1");
    const c = R(col), k = R(btn); const lum = s => { const v = s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const bs = getComputedStyle(btn), hs = getComputedStyle(h1); const L1 = lum(bs.color), L2 = lum(bs.backgroundColor); const kr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const tL = lum(hs.color), pageL = lum(getComputedStyle(col).backgroundColor === "rgba(0, 0, 0, 0)" ? "rgb(255,255,255)" : getComputedStyle(col).backgroundColor); const tr = (Math.max(tL, pageL) + 0.05) / (Math.min(tL, pageL) + 0.05);
    const clipped = [...document.querySelectorAll("body *")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5); }).length;
    return { path: location.pathname, scr: document.querySelector("[data-scr]")?.getAttribute("data-scr"), h1: h1.textContent, font: hs.fontFamily.split(",")[0], titleColor: hs.color, titleContrast: +tr.toFixed(2),
      column: c, centered: Math.abs(c.x - (innerWidth - c.w) / 2) <= 1, shadow: getComputedStyle(col).boxShadow !== "none", htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      kakao: k, kakaoInsideColumn: k.x >= c.x && k.right <= c.right, kakaoInLowerThird: k.y >= innerHeight * 2 / 3, kakaoHeight: k.h, kakaoContrast: +kr.toFixed(2),
      hScroll: document.documentElement.scrollWidth > innerWidth + 0.5, vScroll: document.documentElement.scrollHeight > innerHeight + 0.5, clipped };
  });
  const s1 = await ctx.newCDPSession(p); fs.writeFileSync(path.join(OUT, `login-${vp.w}.png`), Buffer.from((await s1.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await p.goto(BASE + "/dev/health", { waitUntil: "networkidle" }); await p.waitForTimeout(500);
  const dev = await p.evaluate(() => ({ path: location.pathname, h2: document.querySelector("#health-title")?.textContent, status: document.querySelector("[data-testid=health-status]")?.textContent ?? null, database: document.querySelector("[data-testid=health-database]")?.textContent ?? null, alert: document.querySelector("[role=alert]")?.textContent ?? null, hScroll: document.documentElement.scrollWidth > innerWidth + 0.5 }));
  const s2 = await ctx.newCDPSession(p); fs.writeFileSync(path.join(OUT, `dev-health-${vp.w}.png`), Buffer.from((await s2.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  res.push({ ...vp, home, dev, errors: errs }); await ctx.close();
}
await b.close(); fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, results: res }, null, 1));
for (const r of res) console.log(JSON.stringify({ w: r.w, path: r.home.path, scr: r.home.scr, font: r.home.font, col: [r.home.column.x, r.home.column.w], centered: r.home.centered, shadow: r.home.shadow, htmlBg: r.home.htmlBg, kakao: [r.home.kakao.y, r.home.kakao.h], kakaoIn: r.home.kakaoInsideColumn, lowerThird: r.home.kakaoInLowerThird, kakaoCR: r.home.kakaoContrast, titleCR: r.home.titleContrast, hScroll: r.home.hScroll, vScroll: r.home.vScroll, clipped: r.home.clipped, dev: [r.dev.path, r.dev.status, r.dev.database, r.dev.alert, r.dev.hScroll], errors: r.errors.length }));
setTimeout(() => process.exit(0), 200);
