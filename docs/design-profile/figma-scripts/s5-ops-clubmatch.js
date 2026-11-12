// s5: 운영 청백전(SCR-221–226). 팀전은 '청팀/백팀' 배지 + 색 띠(C-24).
function cmItem(p, status, date, name, summary, mode) { const i = inst("C/CMP-043 ClubMatchListItem", { status }, { Date: date, Name: name, Summary: summary }); add(p, i, { fillW: 1 }); if (mode) setNested(i, "Mode", { Label: mode }); return i; }
function headerIcon(h, icon) { const ic = h.findOne(n => n.type === "INSTANCE" && n.name === "C/Icon/user-plus"); if (ic) { ic.swapComponent(CMP["C/Icon/" + icon]); for (const v of ic.findAll(x => "strokes" in x && x.strokes.length > 0)) v.strokes = [P("action/primary")]; } }
async function switchRow(p, label, on) { const r = hrow(p, { gap: 12 }); H(r, 44); r.layoutSizingHorizontal = "FILL"; await tx(r, label, "body"); add(r, inst("C/CMP-007 Switch", { state: on ? "on" : "off" })); return r; }
const MATCHES = [["1경기", "실력차 1", "권초록(6) · 김가람(7)", "한바다(8) · 오아라(5)"], ["2경기", "실력차 0", "박다온(9) · 신자람(2)", "정마루(10) · 윤새벽(3)"], ["3경기", "실력차 2", "남보람(7) · 문솔빛(4)", "강하늬(6) · 차온유(6)"]];
// ---- SCR-221 청백전 관리 목록 ----
await screen(5, "SCR-221 청백전 관리 목록 / ST1 기본(C안) / mobile", async (fr, body) => {
  const h = hdr(body, "청백전 관리", "back", "action", "만들기"); headerIcon(h, "plus");
  const l = AL("VERTICAL", { name: "List" }); add(body, l, { fillW: 1 });
  cmItem(l, "pending", "11/15", "연말 청백전", "참가자 14명", "팀전");
  cmItem(l, "live", "11/08", "가을 청백전", "청 3 : 백 2 · 미기록 4", "팀전");
  cmItem(l, "done", "10/25", "시월 개인전", "1위 김가람", "개인전");
});
// ---- SCR-222 청백전 만들기 ----
await screen(5, "SCR-222 청백전 만들기 / ST1 기본(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "청백전 관리", "청백전 만들기", async (b) => {
    seg(b, ["개인전", "팀전"], 2); field(b, "날짜", "2026-11-15", " "); field(b, "이름", " ", " ");
  }, "만들기");
});
// ---- SCR-223 청백전 운영 상세 ----
async function cmDetail(st) {
  const NAMES = { 1: "ST1 기본(생성 전)", 7: "ST7 대진 검토", 9: "ST9 종료" };
  await screen(5, `SCR-223 청백전 운영 상세 / ${NAMES[st]}(C안) / mobile`, async (fr, body) => {
    hdr(body, "가을 청백전 11/08", "back", "menu");
    const top = hrow(body, { pad: [12, 16, 0, 16] }); badgeI(top, st === 9 ? "success" : st === 7 ? "warning" : "warning", st === 9 ? "종료" : "대진 미확정"); badgeI(top, "neutral", "팀전");
    const b = box(body, { gap: 12 });
    if (st === 9) {
      add(b, inst("C/CMP-042 StandingsCard", { mode: "team" }, { ScoreA: "6", ScoreB: "4", Summary: "청팀 승리 · 10경기 모두 기록" }), { fillW: 1 });
      for (const [c, m, a, z] of MATCHES) game(b, "blueWhite", "recorded", { Court: c, Meta: m, TeamA: a, TeamB: z });
      return;
    }
    if (st === 1) { await tx(b, "방식", "captionStrong"); seg(b, ["개인전", "팀전"], 2); }
    btn(b, "secondary", "참가자 14명 · 청 7 백 7", "md");
    if (st === 1) {
      await tx(b, "대진 설정", "title");
      field(b, "총 경기 수", "10", "14명 · 10경기 → 12명 3경기, 2명 2경기");
      const chips = AL("HORIZONTAL", { name: "균등안", gap: 8 }); add(b, chips, { fillW: 1 }); chips.layoutWrap = "WRAP"; chips.counterAxisSpacing = 8;
      for (const l of ["7경기 · 모두 2경기", "14경기 · 모두 4경기", "입력값 유지"]) add(chips, inst("C/CMP-004 FilterChip", { state: "off" }, { Label: l }));
      await switchRow(b, "밸런스", 1); await switchRow(b, "성별 조합", 1);
      actionBar(fr, [["primary", "대진 생성", 1]]);
    } else {
      const sum = hrow(b, { pad: [8, 0, 8, 0] }); await tx(sum, "대진 설정 · 10경기 · 밸런스 · 성별 조합 [접힌 요약 문구 미정]", "body", "text/secondary"); add(sum, I("chevron-right", 20, "text/secondary"));
      for (const [c, m, a, z] of MATCHES) game(b, "blueWhite", "review", { Court: c, Meta: m, TeamA: a, TeamB: z });
      actionBar(fr, [["secondary", "다시 생성", 0], ["primary", "확정", 1]]);
    }
  });
}
for (const st of [1, 7, 9]) await cmDetail(st);
// ---- SCR-224 참가자·팀 구성 ----
await screen(5, "SCR-224 참가자·팀 구성 / ST1 기본(개인전)(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "가을 청백전 11/08", "참가자", async (b) => {
    b.itemSpacing = 12;
    add(b, inst("C/CMP-028 StickySummary", { kind: "default" }, { Text: "참가 14명 · 남 8 여 6" }), { fillW: 1 });
    notice(b, "warning", "점수 미설정 1명 · 눌러서 점수 입력"); search(b);
    const l = AL("VERTICAL", { name: "People" }); add(b, l, { fillW: 1 });
    for (const [k, n, m, s] of [["checkOn", "권초록", "여 · 출전", "6점"], ["checkOn", "김가람", "남 · 출전", "7점"], ["checkOn", "박다온", "남", "9점"], ["checkOff", "신자람", "여", "2점"], ["checkOn", "이나래", "여", "미설정"]]) person(l, k, n, m, s);
    person(l, "group", "게스트"); person(l, "checkOn", "남보람", "남", "7점");
  }, null);
});
await screen(5, "SCR-224 참가자·팀 구성 / ST7 팀전(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "가을 청백전 11/08", "팀 구성", async (b) => {
    b.itemSpacing = 12;
    add(b, inst("C/CMP-028 StickySummary", { kind: "default" }, { Text: "청 7(남4 여3) · 백 7(남4 여3)" }), { fillW: 1 });
    notice(b, "info", "알고리즘 배정안을 채웠습니다");
    const l = AL("VERTICAL", { name: "Teams" }); add(b, l, { fillW: 1 });
    for (const [n, m, sel] of [["권초록", "여 · 6점", 1], ["김가람", "남 · 7점", 2], ["박다온", "남 · 9점", 1], ["신자람", "여 · 2점", 2], ["문솔빛", "여 · 4점", 3]]) {
      const r = hrow(l, { gap: 8, pad: [6, 0, 6, 0] }); divider(r, "bottom"); const t = AL("VERTICAL", { name: "Who" }); add(r, t, { fillW: 1 });
      await tx(t, n, "bodyStrong"); await tx(t, m, "caption", "text/secondary");
      const s = inst("C/CMP-002 SegmentedControl", { options: "3", selected: String(sel) }, { Opt1: "청", Opt2: "백", Opt3: "불참" }); add(r, s); s.resize(186, s.height);
    }
  }, null);
});
// ---- SCR-225 선수 교체(청백전) ----
async function swap(conflict) {
  await screen(5, `SCR-225 선수 교체(청백전) / ${conflict ? "ST6 충돌" : "ST1 기본"}(C안) / mobile`, async (fr, body) => {
    await sheet(fr, body, "가을 청백전 11/08", "3경기 김가람(청)와 바꿀 사람", async (b) => {
      b.itemSpacing = 8; await tx(b, "경기 수 적은 순", "caption", "text/secondary");
      const l = AL("VERTICAL", { name: "Candidates" }); add(b, l, { fillW: 1 });
      add(l, inst("C/CMP-044 CandidateRow", { state: "available" }, { Name: "박다온", Info: "청 · 2경기 · 교체 후 실력차 1점" }), { fillW: 1 });
      const w = inst("C/CMP-044 CandidateRow", { state: "warning" }, { Name: "한바다", Info: "청 · 3경기 · 경기 중 · 교체 후 실력차 2점" }); add(l, w, { fillW: 1 });
      const d = inst("C/CMP-044 CandidateRow", { state: "disabled" }, { Name: "오아라", Info: "청 · 3경기 · 같은 4명이 다시 모입니다" }); add(l, d, { fillW: 1 }); setNested(d, "Reason", { Label: "비활성" });
      notice(b, "warning", "교체하면 경기 수 차이가 2가 됩니다");
    }, null);
    if (conflict) dialog(fr, "conflict", "다른 운영진이 청백전을 변경했습니다", "방금 한 작업은 처리되지 않았습니다. 확인을 누르면 최신 상태를 불러옵니다", "확인");
  });
}
await swap(false); await swap(true);
// ---- SCR-226 대체 선수 지정 ----
await screen(5, "SCR-226 대체 선수 지정 / ST1 기본(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "가을 청백전 11/08", "윤새벽의 남은 경기 2개", async (b) => {
    for (const [g, who] of [["6경기 (청)", "권초록"], ["9경기 (청)", "한바다"]]) { const r = hrow(b, { gap: 8 }); H(r, 56); r.layoutSizingHorizontal = "FILL"; divider(r, "bottom"); await tx(r, g, "bodyStrong"); btn(r, "secondary", "대체: " + who + " ▾", "md", { hug: 1 }); }
  }, "반영");
});
return OUT;
