// s1: 인증·공통(SCR-001–005) + 튜토리얼(SCR-101–103). 명세에 문구가 없는 곳은 [대괄호]로 둠.
function bottomBar(fr, label, variant) { const f = inst("C/CMP-021 SheetFooter"); fr.appendChild(f); setNested(f, "Action", { Label: label }); if (variant) f.findOne(n => n.type === "INSTANCE" && n.name === "Action").setProperties({ variant }); f.x = 0; f.y = fr.height - f.height - 34; const s = rect(fr.width, 34, "bg/page"); s.name = "Safe area 34 (가정)"; fr.appendChild(s); s.x = 0; s.y = fr.height - 34; return f; }
function btn56(p, variant, label) { const b = btn(p, variant, label, "lg", {}); b.layoutSizingVertical = "FIXED"; b.resize(b.width, 56); b.layoutSizingHorizontal = "FILL"; return b; }
// ---- SCR-001 로그인 ----
async function login(st) {
  await screen(0, `SCR-001 로그인 / ${st === 4 ? "ST4 오류" : "ST1 기본"}(C안) / mobile`, async (fr, body) => {
    const b = box(body, { pad: [24, 16, 24, 16], gap: 16 });
    if (st === 4) { notice(b, "danger", "카카오 로그인이 완료되지 않았습니다. 카카오톡 안에서 열렸다면 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요"); btn(b, "secondary", "다시 시도", "md", { hug: 1 }); }
    spacer(b, st === 4 ? 96 : 180);
    await tx(b, "SMAPSH", "display", "action/primary", { align: "CENTER" });
    await tx(b, "[한 줄 소개 — 명세에 문구 없음]", "body", "text/secondary", { align: "CENTER" });
    bottomBar(fr, "카카오로 시작하기", "kakao");
  });
}
await login(1); await login(4);
// ---- SCR-002 가입 정보 입력 ----
await screen(0, "SCR-002 가입 정보 입력 / ST1 기본(C안) / mobile", async (fr, body) => {
  hdr(body, "가입 신청", "back", "none");
  const b = box(body, { gap: 20 });
  field(b, "이름", " ", " ");
  const g1 = AL("VERTICAL", { name: "성별", gap: 6 }); add(b, g1, { fillW: 1 }); await tx(g1, "성별", "captionStrong"); seg(g1, ["남", "여"], null);
  const g2 = AL("VERTICAL", { name: "급수", gap: 6 }); add(b, g2, { fillW: 1 }); await tx(g2, "급수", "captionStrong"); grid(g2, GRADES, 4, null);
  field(b, "누구의 지인(선택)", " ", " ");
  bottomBar(fr, "가입 신청");
});
// ---- SCR-003 계정 상태 안내 ----
const ACC = { 1: ["ST1 기본(승인 대기)", "clock", "가입 신청이 접수되었습니다", "운영진 승인 후 이용할 수 있습니다"], 7: ["ST7 거절", "info", "가입이 승인되지 않았습니다", null], 8: ["ST8 비활성", "lock", "현재 이용할 수 없는 계정입니다", null] };
for (const k of [1, 7, 8]) {
  const [stn, ic, title, sub] = ACC[k];
  await screen(0, `SCR-003 계정 상태 안내 / ${stn}(C안) / mobile`, async (fr, body) => {
    const b = box(body, { pad: [120, 16, 16, 16], gap: 12 });
    const i = I(ic, 48, "action/accent"); i.name = "상태 아이콘(장식)"; add(b, i);
    await tx(b, title, "heading");
    if (sub) await tx(b, sub, "body", "text/secondary");
    spacer(b, 24); btn(b, "primary", "상태 다시 확인"); btn(b, "text", "로그아웃");
  });
}
// ---- SCR-004 권한 없음 / SCR-005 페이지 없음 ----
await screen(0, "SCR-004 권한 없음 / ST1 기본(C안) / mobile", async (fr, body) => { spacer(body, 140); stateView(body, "forbidden", "접근 권한이 없습니다", "이 화면은 운영진만 볼 수 있습니다 [명세 문장 일부만 있음]", "처음 화면으로"); });
await screen(0, "SCR-005 페이지 없음 / ST1 기본(C안) / mobile", async (fr, body) => { spacer(body, 140); stateView(body, "notFound", "페이지를 찾을 수 없습니다", "[본문 문구 — 명세에 없음]", "처음 화면으로"); });
// ---- SCR-101 튜토리얼 홈 ----
await screen(1, "SCR-101 튜토리얼 홈 / ST1 기본(C안) / mobile", async (fr, body) => {
  hdr(body, "튜토리얼", "none", "none");
  const b = box(body, { gap: 12 });
  notice(b, "info", "처음이라면 입문자부터");
  const lv = async (name, prog, cards) => {
    const r = hrow(b, { pad: [8, 0, 0, 0] }); await tx(r, "튜토리얼 난이도 · " + name, "bodyStrong", "text/primary", { name: "LevelTitle" }); r.children[0].layoutGrow = 1; await tx(r, prog, "captionStrong", "text/secondary", { hug: 1 });
    for (const [n, s, sub] of cards) add(b, inst("C/CMP-047 StageCard", { status: s }, { Name: n, Sub: sub }), { fillW: 1 });
  };
  await lv("입문자", "2/3 통과", [["스테이지 1", "passed", "최고 점수 5/5"], ["스테이지 2", "passed", "최고 점수 4/5"], ["스테이지 3", "notPlayed", "-"]]);
  await lv("왕초보", "0/3 통과", [["스테이지 1", "notPlayed", "-"], ["스테이지 2", "notPlayed", "-"], ["스테이지 3", "notPlayed", "-"]]);
  const more = hrow(b, { pad: [8, 0, 8, 0] }); add(more, I("chevron-right", 20, "text/secondary")); await tx(more, "준비 중 (초보, D조 이상)", "body", "text/secondary");
  spacer(body, 114, "Scroll safe area 114 (탭 98 + 16)");
  nav(fr, "member", "tutorial");
});
// ---- SCR-102 스테이지 플레이 ----
async function play(st) {
  const names = { 1: "ST1 기본", 7: "ST7 정답", 9: "ST9 오답" };
  await screen(1, `SCR-102 스테이지 플레이 / ${names[st]}(C안) / mobile`, async (fr, body) => {
    hdr(body, "입문자 · 1", "close", "none");
    const s = hrow(body, { pad: [0, 16, 0, 16], fill: "bg/surface", name: "Progress" }); H(s, 44); s.layoutSizingHorizontal = "FILL";
    await tx(s, "상황 2/5", "bodyStrong", "text/primary", { name: "Situation" }); s.children[0].layoutGrow = 1; await tx(s, st === 7 ? "2점" : "1점", "bodyStrong", "action/primary", { hug: 1, name: "Score" });
    const b = box(body, { gap: 12, pad: [12, 16, 16, 16] });
    await tx(b, "[상황 설명 한 줄 — 콘텐츠 데이터]", "body", "text/secondary");
    add(b, inst("C/CMP-046 TutorialCourt"), { fillW: 1 });
    if (st === 1) {
      for (const pair of [["앞으로", "뒤로"], ["옆으로", "위치 유지"]]) { const r = hrow(b, { gap: 8 }); for (const l of pair) { const x = btn56(r, "secondary", l); x.layoutSizingHorizontal = "FILL"; } }
    } else if (st === 7) {
      notice(b, "success", "득점 · [한 줄 이유]"); btn56(b, "primary", "다음 상황");
    } else {
      notice(b, "danger", "실점 · [한 줄 이유]"); btn56(b, "primary", "올바른 움직임 보기");
      const r = hrow(b, { gap: 8 }); const x1 = btn(r, "secondary", "다시 도전", "lg", { grow: 1 }); const x2 = btn(r, "text", "다음 상황(0점)", "lg", { grow: 1 });
    }
  });
}
await play(1); await play(7); await play(9);
// ---- SCR-103 스테이지 결과 ----
async function result(st) {
  const pass = st === 1;
  await screen(1, `SCR-103 스테이지 결과 / ${pass ? "ST1 기본(통과)" : "ST7 미통과"}(C안) / mobile`, async (fr, body) => {
    hdr(body, "입문자 · 스테이지 1", "none", "none");
    const b = box(body, { gap: 8, pad: [24, 16, 16, 16] });
    const r = hrow(b, { gap: 12 }); await tx(r, pass ? "4 / 5" : "2 / 5", "display", "text/primary", { hug: 1, name: "Score" }); badgeI(r, pass ? "success" : "warning", pass ? "통과" : "미통과");
    await tx(b, "통과 기준: 5개 중 4개", "caption", "text/secondary");
    await tx(b, pass ? "최고 점수 5/5" : "통과까지 2점 남았어요", "body", "text/primary");
    const l = AL("VERTICAL", { name: "틀린 상황" }); add(body, l, { fillW: 1 });
    const lh = box(l, { pad: [16, 16, 8, 16] }); await tx(lh, "틀린 상황", "captionStrong", "text/secondary");
    for (const n of (pass ? ["상황 3"] : ["상황 1", "상황 3", "상황 4"])) listItem(l, "chevron", n, "정답 보기", "play");
    const a = box(body, { gap: 8 });
    if (pass) { btn(a, "primary", "다음 스테이지"); const rr = hrow(a); btn(rr, "secondary", "다시 하기", "lg", { grow: 1 }); btn(rr, "secondary", "홈", "lg", { grow: 1 }); }
    else { btn(a, "primary", "다시 하기"); btn(a, "secondary", "홈"); }
  });
}
await result(1); await result(7);
return OUT;
