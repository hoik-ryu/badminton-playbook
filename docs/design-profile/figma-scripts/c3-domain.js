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
