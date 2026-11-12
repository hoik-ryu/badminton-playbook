// s4: 운영 명단(SCR-211–214). C안: B안 헤더·검색 띠·하단 탭 + A안 '게스트 추가' 상단 + 안내 배너 제거.
const ROSTER = [["score", "권초록", "여 · B조", "6점"], ["score", "김가람", "남 · C조", "7점"], ["score", "박다온", "남 · A조", "9점"], ["unset", "서이든", "남 · 입문자"], ["score", "신자람", "여 · 왕초심", "2점"], ["score", "오아라", "여 · D조", "5점"], ["score", "윤새벽", "남 · 초심", "3점"], ["unset", "이나래", "여 · C조"], ["score", "정마루", "남 · 자강조", "10점"], ["unset", "최라온", "여 · 초심"], ["score", "한바다", "남 · B조", "8점"]];
const GUESTS = [["score", "남보람", "남 · C조", "7점"], ["score", "문솔빛", "여 · 입문자", "4점"]];
const SCORES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
async function rosterTop(body, withControls) {
  hdr(body, "명단", "back", "actionMenu", "게스트 추가"); band(body);
  if (!withControls) return;
  const c = box(body, { gap: 12, pad: [12, 16, 4, 16] });
  const chips = AL("HORIZONTAL", { name: "Filter chips", gap: 8 }); add(c, chips, { fillW: 1 }); chips.layoutWrap = "WRAP"; chips.counterAxisSpacing = 8;
  for (const l of ["점수 미설정 3명", "튜토리얼 권장 · 미통과 5명"]) add(chips, inst("C/CMP-004 FilterChip", { state: "off" }, { Label: l }));
  const r = hrow(c, { gap: 8 }); H(r, 44); r.layoutSizingHorizontal = "FILL"; await tx(r, "비활성 포함", "body"); add(r, inst("C/CMP-007 Switch", { state: "off" }));
}
// ---- SCR-211 명단 ----
await screen(4, "SCR-211 명단 / ST1 기본(C안) / mobile", async (fr, body) => {
  await rosterTop(body, true);
  const l = AL("VERTICAL", { name: "Roster list" }); add(body, l, { fillW: 1 });
  for (const r of ROSTER) person(l, ...r); person(l, "group", "게스트"); for (const r of GUESTS) person(l, ...r);
  spacer(body, 114, "Scroll safe area 114 (탭 98 + 16)");
  nav(fr, "admin", "ops");
});
await screen(4, "SCR-211 명단 / ST3 빈 상태(C안) / mobile", async (fr, body) => {
  await rosterTop(body, false);
  stateView(body, "empty", "아직 회원이 없습니다", "카카오로 가입한 사람을 승인하면 여기에 나타납니다", "게스트 추가");
  nav(fr, "admin", "ops");
});
await screen(4, "SCR-211 명단 / ST4 오류(C안) / mobile", async (fr, body) => {
  await rosterTop(body, false);
  stateView(body, "error", "명단을 불러오지 못했습니다", "연결이 불안정합니다. 다시 시도해 주세요", "다시 시도");
  nav(fr, "admin", "ops");
});
// ---- SCR-212 회원·게스트 편집 ----
async function editor(kind) {
  const guest = kind !== "member";
  const label = kind === "member" ? "ST1 기본(회원)" : kind === "guest" ? "ST7 게스트" : "ST10 게스트 삭제: 확정 전 대진 포함";
  await screen(4, `SCR-212 회원·게스트 편집 / ${label}(C안) / mobile`, async (fr, body) => {
    await sheet(fr, body, "명단", guest ? "남보람 · 게스트" : "김가람 · 회원", async (b) => {
      field(b, "이름", guest ? "남보람" : "김가람", " ");
      const g1 = AL("VERTICAL", { name: "성별", gap: 6 }); add(b, g1, { fillW: 1 }); await tx(g1, "성별", "captionStrong"); seg(g1, ["남", "여"], 1);
      const g2 = AL("VERTICAL", { name: "급수", gap: 6 }); add(b, g2, { fillW: 1 }); await tx(g2, "급수", "captionStrong"); grid(g2, GRADES, 4, "C조");
      const g3 = AL("VERTICAL", { name: "점수", gap: 6 }); add(b, g3, { fillW: 1 }); await tx(g3, "점수", "captionStrong"); grid(g3, SCORES, 5, "7");
      if (!guest) {
        await tx(b, "현황", "captionStrong", "text/secondary");
        add(b, inst("C/CMP-045 RecordSummary", { rank: "yes" }, { Rank: "A", Note: "지인: 권초록", Record: "청백전 24경기 14승 10패" }), { fillW: 1 });
        await tx(b, "튜토리얼: 입문자 2/3 · 왕초보 0/3 · 권장 대상", "caption", "text/secondary");
      }
      const d = hrow(b, { name: "Danger" }); H(d, 44); d.layoutSizingHorizontal = "FILL"; divider(d, "top");
      await tx(d, guest ? "게스트 삭제" : "회원 비활성 처리", "bodyStrong", "status/danger/fg");
    }, "저장");
    if (kind === "guestDelete") dialog(fr, "danger", "남보람을 삭제할까요?", "확정하지 않은 '가을 청백전' 대진이 폐기됩니다. 지난 기록에는 '삭제된 게스트'로 남습니다", "삭제");
  });
}
await editor("member"); await editor("guest"); await editor("guestDelete");
// ---- SCR-213 사람 추가 ----
async function addPerson(member) {
  await screen(4, `SCR-213 사람 추가 / ${member ? "ST7 회원 직접 추가" : "ST1 기본(게스트 추가)"}(C안) / mobile`, async (fr, body) => {
    await sheet(fr, body, "명단", member ? "회원 직접 추가" : "게스트 추가", async (b) => {
      if (member) notice(b, "info", "카카오로 가입하지 않는 회원만 직접 추가하세요");
      field(b, "이름", " ", " ");
      const g1 = AL("VERTICAL", { name: "성별", gap: 6 }); add(b, g1, { fillW: 1 }); await tx(g1, "성별", "captionStrong"); seg(g1, ["남", "여"], null);
      const g2 = AL("VERTICAL", { name: "급수", gap: 6 }); add(b, g2, { fillW: 1 }); await tx(g2, "급수", "captionStrong"); grid(g2, GRADES, 4, null);
      const g3 = AL("VERTICAL", { name: "점수", gap: 6 }); add(b, g3, { fillW: 1 }); await tx(g3, "점수(선택)", "captionStrong"); grid(g3, SCORES, 5, null);
      if (member) field(b, "누구의 지인(선택)", " ", " ");
    }, "추가");
  });
}
await addPerson(false); await addPerson(true);
// ---- SCR-214 점수 입력(두 번째 시트) ----
await screen(4, "SCR-214 점수 입력 / ST1 기본(C안) / mobile", async (fr, body) => {
  await sheet(fr, body, "오늘 운동 11/09", "점수 미설정 2명", async (b) => {
    for (const [n, m] of [["서이든", "남 · 입문자"], ["최라온", "여 · 초심"]]) { const p = person(b, "score", n, m, " "); grid(b, SCORES, 5, null); }
  }, null);
});
return OUT;
