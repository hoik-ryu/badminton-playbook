// s3: 운영 홈(SCR-201) + 오늘 운동(SCR-202)과 패널·시트(SCR-203–205). 실시간 대진은 '1팀/2팀' 글자 표기(C-24).
function hideSub(i) { const t = i.findOne(n => n.type === "TEXT" && n.name === "Sub"); if (t) t.visible = false; }
// ---- SCR-201 운영 홈 ----
await screen(3, "SCR-201 운영 홈 / ST1 기본(C안) / mobile", async (fr, body) => {
  hdr(body, "운영", "none", "none");
  const l = AL("VERTICAL", { name: "Menu" }); add(body, l, { fillW: 1 });
  const s = listItem(l, "badge", "오늘 운동", " ", "calendar", "진행 중"); hideSub(s); s.findOne(n => n.type === "INSTANCE" && n.name === "Count").setProperties({ tone: "info" });
  hideSub(listItem(l, "chevron", "명단", " ", "users"));
  hideSub(listItem(l, "chevron", "청백전 관리", " ", "trophy"));
  hideSub(listItem(l, "badge", "가입 승인", " ", "user-check", "3"));
  hideSub(listItem(l, "chevron", "역할 관리", " ", "shield"));
  nav(fr, "admin", "ops");
});
// ---- SCR-202 오늘 운동 ----
// 실시간 대진 샘플: 출전 16명 + 대기 2명(가상 인물, figma.md 샘플 세트에 8명 추가)
const COURTS = [["코트 1", "실력차 0", "권초록(여6) · 김가람(남7)", "한바다(남8) · 오아라(여5)", "합 13", "합 13"], ["코트 2", "실력차 2", "박다온(남9) · 신자람(여2)", "정마루(남10) · 윤새벽(남3)", "합 11", "합 13"], ["코트 3", "실력차 0", "남보람(남7) · 문솔빛(여4)", "강하늬(여6) · 노을빛(남5)", "합 11", "합 11"], ["코트 4", "실력차 1", "도담(남6) · 류새움(여5)", "마루한(남8) · 배나린(여4)", "합 11", "합 12"]];
async function session(st) {
  const NAMES = { 1: "ST1 기본(생성 전)", 3: "ST3 빈 상태", 6: "ST6 충돌", 7: "ST7 대진 검토", 8: "ST8 라운드 진행 중", 10: "ST10 이전 날짜 미종료 세션" };
  await screen(3, `SCR-202 오늘 운동 / ${NAMES[st]}(C안) / mobile`, async (fr, body) => {
    hdr(body, st === 3 ? "오늘 운동" : "오늘 운동 11/09", "back", st === 3 ? "none" : "menu");
    if (st === 3) { spacer(body, 80); stateView(body, "empty", "오늘 운동을 시작하세요", "[보조 문구 — 명세에 없음]", "오늘 운동 시작"); return; }
    const b = box(body, { gap: 12 });
    if (st === 10) { notice(b, "warning", "종료되지 않은 11/02(일) 세션이 있습니다"); const r = hrow(b); btn(r, "secondary", "이어서 열기", "md", { hug: 1 }); btn(r, "text", "종료", "md", { hug: 1 }); }
    const phase = (st === 1 || st === 10) ? "생성 전" : st === 8 ? "진행 중" : "대진 검토";
    await tx(b, "2라운드 · " + phase, "title");
    const pr = hrow(b); btn(pr, "secondary", "참석 18명", "md", { grow: 1 }); btn(pr, "secondary", "옵션: 레벨별", "md", { grow: 1 });
    if (phase === "생성 전") {
      await tx(b, "[대기자 우선 안내 — 명세에 문구 없음] 지난 라운드 대기자 2명", "body", "text/secondary");
      const lr = hrow(b, { pad: [8, 0, 8, 0] }); add(lr, I("chevron-right", 20, "text/secondary")); await tx(lr, "지난 라운드 (1)", "body");
      actionBar(fr, [["primary", "대진 생성", 1]]);
    } else {
      if (phase === "대진 검토") notice(b, "warning", "2경기에서 규칙 완화");
      for (const [c, m, a, z, sa, sb] of COURTS) { const g = game(b, "numbered", st === 8 ? "live" : "review", { Court: c, Meta: m, TeamA: a, TeamB: z }); for (const [nm, v] of [["SumA", sa], ["SumB", sb]]) { const t = g.findOne(n => n.type === "TEXT" && n.name === nm); if (t) t.characters = v; } }
      await tx(b, "대기자 2명: 차온유(남, 2게임) · 소이랑(여, 1게임)", "body", "text/secondary");
      if (st === 8) actionBar(fr, [["primary", "라운드 완료", 1]]); else actionBar(fr, [["secondary", "다시 생성", 0], ["primary", "확정", 1]]);
      if (st === 6) dialog(fr, "conflict", "다른 운영진이 대진을 변경했습니다", "확정은 처리되지 않았습니다. 확인을 누르면 최신 상태를 불러옵니다", "확인");
    }
  });
}
for (const st of [1, 3, 7, 8, 6, 10]) await session(st);
// ---- SCR-203 참석 체크(패널 → 모바일 하단 시트) ----
await screen(3, "SCR-203 참석 체크 / ST1 기본(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "오늘 운동 11/09", "참석 체크", async (b) => {
    b.itemSpacing = 12;
    add(b, inst("C/CMP-028 StickySummary", { kind: "default" }, { Text: "참석 18명 · 남 10 여 8" }), { fillW: 1 });
    notice(b, "warning", "점수 미설정 2명 · 눌러서 점수 입력");
    search(b);
    const l = AL("VERTICAL", { name: "People" }); add(b, l, { fillW: 1 });
    for (const [k, n, m, s] of [["checkOn", "권초록", "여", "6점"], ["checkOn", "김가람", "남", "7점"], ["checkOff", "박다온", "남", "9점"], ["checkOn", "서이든", "남", "미설정"], ["checkOn", "신자람", "여", "2점"]]) person(l, k, n, m, s);
    person(l, "group", "게스트"); person(l, "checkOn", "남보람", "남", "7점");
    btn(b, "secondary", "게스트 추가");
  }, null);
});
// ---- SCR-204 대진 옵션 ----
await screen(3, "SCR-204 대진 옵션 / ST1 기본(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "오늘 운동 11/09", "대진 옵션", async (b) => {
    const g = AL("VERTICAL", { name: "생성 방식", gap: 6 }); add(b, g, { fillW: 1 }); await tx(g, "생성 방식", "captionStrong"); seg(g, ["레벨별", "무작위"], 1);
    for (const [name, on] of [["밸런스", 1], ["성별 조합", 1], ["게임 수 공평성", 1], ["중복 회피", 0]]) {
      const r = hrow(b, { gap: 12 }); const t = AL("VERTICAL", { name: "Text" }); add(r, t, { fillW: 1 });
      await tx(t, name, "bodyStrong"); await tx(t, "[한 줄 설명 — 명세에 문구 없음]", "caption", "text/secondary");
      add(r, inst("C/CMP-007 Switch", { state: on ? "on" : "off" }));
    }
    await tx(b, "다음 라운드에도 같은 옵션을 씁니다", "caption", "text/secondary");
  }, null);
});
// ---- SCR-205 선수 교체(실시간 대진) ----
await screen(3, "SCR-205 선수 교체(실시간 대진) / ST1 기본(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "오늘 운동 11/09", "김가람(남7)와 바꿀 사람", async (b) => {
    b.itemSpacing = 8;
    const sec = async (title, rows) => { await tx(b, title, "captionStrong", "text/secondary"); const l = AL("VERTICAL", { name: title }); add(b, l, { fillW: 1 }); for (const [st, n, info, tag] of rows) { const r = inst("C/CMP-044 CandidateRow", { state: st }, { Name: n, Info: info }); add(l, r, { fillW: 1 }); if (tag && st === "warning") setNested(r, "Warn", { Label: tag }); if (tag && st === "disabled") setNested(r, "Reason", { Label: tag }); } };
    await sec("대기자", [["available", "차온유", "남 · 6점 · 교체 후 실력차 1점"], ["available", "소이랑", "여 · 5점 · 교체 후 실력차 2점"]]);
    await sec("다른 경기", [["warning", "코트 2 · 박다온", "남 · 9점 · 교체 후 실력차 3점", "성별 완화"], ["disabled", "코트 3 · 오아라", "같은 날 같은 경기가 됩니다", "비활성"]]);
  }, null);
});
return OUT;
