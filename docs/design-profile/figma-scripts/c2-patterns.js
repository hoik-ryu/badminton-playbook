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
