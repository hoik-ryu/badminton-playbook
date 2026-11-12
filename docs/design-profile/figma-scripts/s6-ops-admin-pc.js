// s6: 가입 승인(SCR-231)·역할 관리(SCR-232) + PC 필수 화면 3개(SCR-201, SCR-202 ST8, SCR-211+212 패널).
function hideAction(i) { const a = i.findOne(n => n.name === "Action"); if (a) a.visible = false; }
// ---- SCR-231 가입 승인 ----
await screen(6, "SCR-231 가입 승인 / ST1 기본(C안) / mobile", async (fr, body) => {
  hdr(body, "가입 승인 (3)", "back", "none");
  const all = hrow(body, { gap: 12, pad: [0, 16, 0, 16] }); H(all, 48); all.layoutSizingHorizontal = "FILL"; divider(all, "bottom");
  add(all, inst("C/CMP-008 Checkbox", { state: "unchecked" })); await tx(all, "전체 선택", "body");
  for (const [on, who, sub, dup] of [[1, "강하늬 · 여 · C조", "지인: 권초록 · 11/08 신청", 0], [1, "김가람 · 남 · B조", "11/08 신청", 1], [0, "노을빛 · 남 · D조", "11/09 신청", 0]]) {
    const it = AL("VERTICAL", { name: "Applicant", pad: [12, 16, 12, 16], gap: 8, fill: "bg/page" }); add(body, it, { fillW: 1 }); divider(it, "bottom");
    const r = hrow(it, { gap: 12 }); add(r, inst("C/CMP-008 Checkbox", { state: on ? "checked" : "unchecked" }));
    const t = AL("VERTICAL", { name: "Who" }); add(r, t, { fillW: 1 }); await tx(t, who, "bodyStrong"); await tx(t, sub, "caption", "text/secondary");
    if (dup) notice(it, "warning", "명단에 같은 이름이 있습니다");
    const a = hrow(it, { gap: 8, justify: "MAX" }); btn(a, "secondary", "거절", "md", { hug: 1 }); btn(a, "primary", "승인", "md", { hug: 1 });
  }
  actionBar(fr, [["primary", "선택한 2명 승인", 1]]);
});
await screen(6, "SCR-231 가입 승인 / ST3 빈 상태(C안) / mobile", async (fr, body) => {
  hdr(body, "가입 승인", "back", "none"); const s = stateView(body, "empty", "승인을 기다리는 신청이 없습니다", "[보조 문구 — 명세에 없음]"); hideAction(s);
});
// ---- SCR-232 역할 관리 ----
await screen(6, "SCR-232 역할 관리 / ST1 기본(C안) / mobile", async (fr, body) => {
  hdr(body, "역할 관리", "back", "none"); band(body);
  const l = AL("VERTICAL", { name: "Roles" }); add(body, l, { fillW: 1 });
  const row = async (name, tone, role, action) => { const r = hrow(l, { gap: 8, pad: [0, 16, 0, 16] }); H(r, 56); r.layoutSizingHorizontal = "FILL"; divider(r, "bottom"); await tx(r, name, "bodyStrong", "text/primary", { hug: 1 }); if (role) badgeI(r, tone, role); add(r, rect(1, 1, null), { grow: 1 }); if (action) btn(r, "secondary", action, "md", { hug: 1 }); };
  person(l, "group", "슈퍼 관리자 · 운영진");
  await row("정마루", "info", "슈퍼 관리자", null); await row("권초록", "neutral", "운영진", "운영진 해제"); await row("한바다", "neutral", "운영진", "운영진 해제");
  person(l, "group", "회원");
  await row("김가람", null, null, "운영진 지정"); await row("박다온", null, null, "운영진 지정"); await row("오아라", null, null, "운영진 지정");
});
// ---- PC 1440×900 ----
await screen(7, "SCR-201 운영 홈 / ST1 기본(C안) / desktop", async (fr) => {
  const main = pcShell(fr, "ops-home"); hdr(main, "운영", "none", "none");
  const g = AL("HORIZONTAL", { name: "Menu cards (2열)", gap: 16, pad: [24, 24, 24, 24] }); add(main, g, { fillW: 1 }); g.layoutWrap = "WRAP"; g.counterAxisSpacing = 16;
  for (const [t, ic, cnt] of [["오늘 운동", "calendar", "진행 중"], ["명단", "users"], ["청백전 관리", "trophy"], ["가입 승인", "user-check", "3"], ["역할 관리", "shield"]]) {
    const c = AL("VERTICAL", { name: "Card/" + t, rMd: 1, stroke: "border/default" }); add(g, c); W(c, 480); c.clipsContent = true;
    const li = listItem(c, cnt ? "badge" : "chevron", t, " ", ic, cnt); const sub = li.findOne(n => n.type === "TEXT" && n.name === "Sub"); if (sub) sub.visible = false; li.strokes = [];
    if (cnt === "진행 중") li.findOne(n => n.type === "INSTANCE" && n.name === "Count").setProperties({ tone: "info" });
  }
}, 1440, 900);
await screen(7, "SCR-202 오늘 운동 / ST8 라운드 진행 중(C안) / desktop", async (fr) => {
  const main = pcShell(fr, "session"); hdr(main, "오늘 운동 11/09", "none", "menu");
  const top = hrow(main, { pad: [16, 24, 8, 24] }); await tx(top, "2라운드 · 진행 중", "title"); btn(top, "primary", "라운드 완료", "lg", { hug: 1 });
  const g = AL("VERTICAL", { name: "Courts 2×2", gap: 16, pad: [8, 24, 16, 24] }); add(main, g, { fillW: 1 });
  const C4 = [["코트 1", "실력차 0", "권초록(여6) · 김가람(남7)", "한바다(남8) · 오아라(여5)"], ["코트 2", "실력차 2", "박다온(남9) · 신자람(여2)", "정마루(남10) · 윤새벽(남3)"], ["코트 3", "실력차 0", "남보람(남7) · 문솔빛(여4)", "강하늬(여6) · 노을빛(남5)"], ["코트 4", "실력차 1", "도담(남6) · 류새움(여5)", "마루한(남8) · 배나린(여4)"]];
  for (let i = 0; i < 4; i += 2) { const r = hrow(g, { gap: 16, align: "MIN" }); for (const [c, m, a, z] of C4.slice(i, i + 2)) { const x = inst("C/CMP-041 GameCard", { label: "numbered", phase: "live" }, { Court: c, Meta: m, TeamA: a, TeamB: z }); add(r, x, { grow: 1 }); } }
  const w = box(main, { pad: [0, 24, 0, 24] }); await tx(w, "대기자 2명: 차온유(남, 2게임) · 소이랑(여, 1게임)", "body", "text/secondary");
  const panel = AL("VERTICAL", { name: "Side panel 400 (SCR-203 참석 / SCR-204 옵션)", fill: "bg/page", pad: [16, 0, 16, 0], gap: 12 }); add(fr, panel, { fillH: 1 }); W(panel, 400); panel.layoutSizingVertical = "FILL"; divider(panel, "left");
  const pt = box(panel, { pad: [0, 16, 0, 16] }); seg(pt, ["참석", "옵션"], 1);
  add(panel, inst("C/CMP-028 StickySummary", { kind: "default" }, { Text: "참석 18명 · 남 10 여 8" }), { fillW: 1 });
  const sb = box(panel, { pad: [0, 16, 0, 16] }); search(sb);
  for (const [k, n, m, s] of [["checkOn", "권초록", "여", "6점"], ["checkOn", "김가람", "남", "7점"], ["checkOn", "박다온", "남", "9점"], ["checkOff", "서이든", "남", "미설정"], ["checkOn", "신자람", "여", "2점"], ["checkOn", "오아라", "여", "5점"]]) person(panel, k, n, m, s);
}, 1440, 900);
await screen(7, "SCR-211 명단 + SCR-212 편집 패널 / ST1 기본(C안) / desktop", async (fr) => {
  const main = pcShell(fr, "roster"); hdr(main, "명단", "none", "actionMenu", "게스트 추가");
  const c = box(main, { pad: [16, 24, 8, 24], gap: 12 }); const sf = search(c); sf.layoutSizingHorizontal = "FIXED"; sf.resize(480, 44);
  const cr = hrow(c, { gap: 8 }); for (const l of ["점수 미설정 3명", "튜토리얼 권장 · 미통과 5명"]) add(cr, inst("C/CMP-004 FilterChip", { state: "off" }, { Label: l })); add(cr, rect(1, 1, null), { grow: 1 }); await tx(cr, "비활성 포함", "body", "text/primary", { hug: 1 }); add(cr, inst("C/CMP-007 Switch", { state: "off" }));
  const tbl = AL("VERTICAL", { name: "Table (VD-016 열: 이름 · 성별 64 · 급수 96 · 점수 80)", pad: [0, 24, 0, 24] }); add(main, tbl, { fillW: 1 });
  const rowT = async (cells, head, sel) => { const r = hrow(tbl, { gap: 0, pad: [0, 12, 0, 12], fill: sel ? "selected/bg" : (head ? "bg/surface" : "bg/page") }); H(r, head ? 36 : 48); r.layoutSizingHorizontal = "FILL"; divider(r, "bottom");
    const ws = [null, 64, 96, 80]; for (let i = 0; i < 4; i++) { const t = await T(cells[i], head ? "captionStrong" : (i === 0 || i === 3 ? "bodyStrong" : "body"), head ? "text/secondary" : (i === 1 || i === 2 ? "text/secondary" : "text/primary"), { name: ["Name", "Gender", "Grade", "Score"][i], align: i === 3 ? "RIGHT" : "LEFT" }); add(r, t); if (ws[i]) { t.layoutSizingHorizontal = "FIXED"; t.resize(ws[i], t.height); } else t.layoutGrow = 1; } };
  await rowT(["이름", "성별", "급수", "점수"], 1);
  for (const [n, g, gr, s] of [["권초록", "여", "B조", "6점"], ["김가람", "남", "C조", "7점"], ["박다온", "남", "A조", "9점"], ["서이든", "남", "입문자", "미설정"], ["신자람", "여", "왕초심", "2점"], ["오아라", "여", "D조", "5점"], ["윤새벽", "남", "초심", "3점"], ["이나래", "여", "C조", "미설정"], ["정마루", "남", "자강조", "10점"], ["최라온", "여", "초심", "미설정"], ["한바다", "남", "B조", "8점"]]) await rowT([n, g, gr, s], 0, n === "김가람");
  const panel = AL("VERTICAL", { name: "Side panel 400 (SCR-212)", fill: "bg/page" }); add(fr, panel, { fillH: 1 }); W(panel, 400); panel.layoutSizingVertical = "FILL"; divider(panel, "left");
  const h = inst("C/CMP-021 SheetHeader", {}, { Title: "김가람 · 회원" }); add(panel, h, { fillW: 1 }); const gr = h.findOne(n => n.name === "Grabber"); if (gr) gr.visible = false;
  const b = box(panel, { gap: 16 }); field(b, "이름", "김가람", " ");
  const g1 = AL("VERTICAL", { name: "성별", gap: 6 }); add(b, g1, { fillW: 1 }); await tx(g1, "성별", "captionStrong"); seg(g1, ["남", "여"], 1);
  const g2 = AL("VERTICAL", { name: "급수", gap: 6 }); add(b, g2, { fillW: 1 }); await tx(g2, "급수", "captionStrong"); grid(g2, GRADES, 4, "C조");
  const g3 = AL("VERTICAL", { name: "점수", gap: 6 }); add(b, g3, { fillW: 1 }); await tx(g3, "점수", "captionStrong"); grid(g3, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], 5, "7");
  add(b, inst("C/CMP-045 RecordSummary", { rank: "yes" }, { Rank: "A", Note: "지인: 권초록", Record: "청백전 24경기 14승 10패" }), { fillW: 1 });
  const f = inst("C/CMP-021 SheetFooter"); add(panel, f, { fillW: 1 });
}, 1440, 900);
return OUT;
