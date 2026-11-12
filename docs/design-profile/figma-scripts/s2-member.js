// s2: 회원 청백전·마이(SCR-111, 112, 121, 122). 회원 화면은 점수·실력차·팀 합을 그리지 않음(NFR-005).
function cmItem(p, status, date, name, summary, mode) { const i = inst("C/CMP-043 ClubMatchListItem", { status }, { Date: date, Name: name, Summary: summary }); add(p, i, { fillW: 1 }); if (mode) setNested(i, "Mode", { Label: mode }); return i; }
function hideAction(i) { const a = i.findOne(n => n.name === "Action"); if (a) a.visible = false; }
// ---- SCR-111 청백전 목록(회원) ----
await screen(2, "SCR-111 청백전 목록(회원) / ST1 기본(C안) / mobile", async (fr, body) => {
  hdr(body, "청백전", "none", "none");
  const l = AL("VERTICAL", { name: "List" }); add(body, l, { fillW: 1 });
  cmItem(l, "live", "11/08", "가을 청백전", "청 3 : 백 2 · 미기록 4", "팀전");
  cmItem(l, "done", "10/25", "시월 개인전", "1위 김가람", "개인전");
  cmItem(l, "done", "10/11", "추석맞이 청백전", "청팀 승리 (청 6 : 백 4)", "팀전");
  nav(fr, "member", "match");
});
await screen(2, "SCR-111 청백전 목록(회원) / ST3 빈 상태(C안) / mobile", async (fr, body) => {
  hdr(body, "청백전", "none", "none");
  const s = stateView(body, "empty", "아직 공개된 청백전이 없습니다", "공개되면 여기에 나타납니다 [보조 문구는 명세에 없음]"); hideAction(s);
  const lh = box(body, { pad: [16, 16, 8, 16] }); await tx(lh, "지난 청백전", "captionStrong", "text/secondary");
  const l = AL("VERTICAL", { name: "List" }); add(body, l, { fillW: 1 }); cmItem(l, "done", "10/25", "시월 개인전", "1위 김가람", "개인전");
  nav(fr, "member", "match");
});
// ---- SCR-112 청백전 상세(회원) ----
async function detail(final) {
  await screen(2, `SCR-112 청백전 상세(회원) / ${final ? "ST8 종료" : "ST1 기본(진행 중)"}(C안) / mobile`, async (fr, body) => {
    hdr(body, "가을 청백전", "back", "none");
    const top = hrow(body, { pad: [12, 16, 0, 16] }); badgeI(top, "neutral", "팀전"); badgeI(top, final ? "success" : "info", final ? "종료" : "진행 중");
    const b = box(body, { gap: 12 });
    if (final) { const f = inst("C/CMP-042 StandingsCard", { mode: "team" }, { ScoreA: "6", ScoreB: "4", Summary: "청팀 승리" }); f.name = "최종 결과"; add(b, f, { fillW: 1 }); }
    else {
      await tx(b, "다음 경기", "bodyStrong");
      game(b, "blueWhite", "member", { Court: "3번째 경기", Meta: "내 경기", TeamA: "나(한바다) · 권초록", TeamB: "박다온 · 정마루" });
    }
    await tx(b, "내 경기", "bodyStrong");
    game(b, "blueWhite", "recorded", { Court: "1번째 경기", Meta: "승", TeamA: "나(한바다) · 오아라", TeamB: "김가람 · 신자람" });
    if (!final) { const s = inst("C/CMP-042 StandingsCard", { mode: "team" }, { ScoreA: "3", ScoreB: "2", Summary: "10경기 중 5경기 결과" }); add(b, s, { fillW: 1 }); }
    const all = hrow(b, { pad: [8, 0, 8, 0] }); await tx(all, "전체 대진", "bodyStrong"); add(all, I("chevron-right", 20, "text/secondary"));
    spacer(body, 114, "Scroll safe area 114");
    nav(fr, "member", "match");
  });
}
await detail(false); await detail(true);
// ---- SCR-121 마이페이지 ----
async function my(rank) {
  await screen(2, `SCR-121 마이페이지 / ${rank ? "ST1 기본" : "ST7 랭크 없음"}(C안) / mobile`, async (fr, body) => {
    hdr(body, "마이페이지", "none", "none");
    const b = box(body, { gap: 12 });
    add(b, inst("C/CMP-045 RecordSummary", { rank: rank ? "yes" : "none" }, rank ? { Rank: "A", Note: "승률 58%", Record: "청백전 24경기 14승 10패 58%" } : { Rank: "랭크 없음 · 랭크까지 4경기", Note: "10경기부터 랭크가 생깁니다", Record: "청백전 6경기 3승 3패" }), { fillW: 1 });
    const l = AL("VERTICAL", { name: "Links" }); add(body, l, { fillW: 1 }); listItem(l, "chevron", "청백전 기록 보기", "개인전·팀전 합산", "swords");
    const p = box(body, { gap: 8 }); await tx(p, "프로필", "captionStrong", "text/secondary"); await tx(p, "한바다 · 남 · 급수 B조", "body");
    btn(p, "secondary", "프로필 수정"); btn(p, "text", "로그아웃");
    nav(fr, "member", "my");
  });
}
await my(true); await my(false);
// ---- SCR-122 프로필 수정(시트) ----
await screen(2, "SCR-122 프로필 수정 / ST1 기본(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "마이페이지", "프로필 수정", async (b) => {
    field(b, "이름", "한바다", " ");
    const g1 = AL("VERTICAL", { name: "성별", gap: 6 }); add(b, g1, { fillW: 1 }); await tx(g1, "성별", "captionStrong"); seg(g1, ["남", "여"], 1);
    const g2 = AL("VERTICAL", { name: "급수", gap: 6 }); add(b, g2, { fillW: 1 }); await tx(g2, "급수", "captionStrong"); grid(g2, GRADES, 4, "B조");
  }, "저장", { parentLeading: "none" });
});
return OUT;
