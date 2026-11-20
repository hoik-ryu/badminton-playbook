---
doc: design-direction
revision: 5
language: ko
based_on:
  ux_spec_revision: 5
---

# 디자인 방향 (Design Direction): 배드민턴 플레이북 (badminton-playbook)

승인된 UX 설계를 바꾸지 않고, 그 위에 어떤 모습으로 렌더링할지 정합니다. 여기서 승인된 시각 결정(VD)만 정식 렌더링(프리뷰)에 씁니다.
화면·정보·행동·토큰 이름을 바꿔야 하면 이 문서에서 결정하지 않고 7장 변경 요청(①·②)으로 남겨 UX 설계를 다시 엽니다.

> 결정 기록(2026-11-11, 사용자, r1): C안 테마 값(청록·Pretendard)은 테마 파일로 적용. 렌더러 code. VD-003·004·008·010·020 확정, CR-004·005·006 거절, CR-007 시각 표현으로 반영, CR-010 `radius.md` 적용.
>
> **r2 개정(2026-11-13, 사용자 결정)**: UX Spec r2(사용자 결정 D1–D6: PC·모바일 공통 최대 600px 한 열, 하단 탭, 하단 시트, 게스트 추가 오른쪽 아래, 카드 선택적 허용, 공통 패턴은 04 3장)를 기준으로 다시 맞췄습니다.
> - 기존 VD 9개(VD-001·002·003·004·007·008·010·019·020) 유지, VD-020은 적용 범위를 PC 600px 열과 시트까지 확장
> - 신규 VD-021–025: 04 3.1·3.2가 Design Direction에 넘긴 값(한 열 여백·바깥 배경, 섹션 간격, 제목 계층, 카드 표현, 하단 시트 시각)
> - CR-001·002·003 기각·종결(r1의 'r2 재검토 후보' 마감)
> - 렌더 범위에 SCR-202·203·223 추가, 검증 폭 390px·1440px
> - 새 토큰·컴포넌트·변형은 만들지 않았습니다. 딤 배경 투명도 하나가 토큰 밖 값(임시 구현값)입니다(VD-025).
>
> r1 승인 기록은 `design.json`의 `last_approved`(r1)와 Git 이력에 있습니다.
>
> **r3 개정(2026-11-17, 사용자 결정)**: VD-021만 고쳤습니다. 데스크톱에서 가운데 600px 열이 바깥과 구분되도록 열 바깥 배경을 `color.bg.surface`로, 열에 그림자 `elevation.card`를 줍니다(r2: 바깥 `color.bg.page`, 경계선 없음). 공식 영향 분석(`impact --design`): ④ 시각 표현, 재승인 Design Direction·Preview. UX Spec·기획은 바뀌지 않습니다. 다른 VD와 CR은 r2 그대로입니다.

> **r4 개정 초안(2026-11-18, 사용자 검토 대기)**: UX Spec r3(튜토리얼 상황 판단형 재기획)과 참고 이미지 REF-001(Discovery Q-019)을 기준으로 튜토리얼 목록·코트 학습·결과 화면의 시각 결정을 정합니다.
> - **새 결정**: VD-026–VD-037(모두 **후보**)
> - **개정**: VD-024 카드 표현(**후보**). 2장 원칙에 튜토리얼 목록 예외를 추가
> - **변경 요청**: CR-011–CR-013(사용자 결정 대기)
> - **유지**: 기존 승인 VD-001·002·003·004·007·008·010·019·020·021·022·023·025와 테마 `smapsh-c-mint-hybrid`
> - **시각 탐색**: 켜져 있습니다(2026-11-18). 참고 의도 INT-001: 왼쪽 튜토리얼 화면 = 직접 기준, 오른쪽 마이페이지 = 스타일 참고. 레퍼런스 시안 라운드와 사용자 선택(EXP-…)이 끝나야 후보 VD를 승인하고 제출할 수 있습니다.
> - 이 초안의 색·치수는 기존 04 토큰과 테마 값으로 쓸 수 있는 값을 우선했고, 이미지에서 추정한 값(RX 추정 항목)은 사용자 확인 전이라 그대로 쓰지 않았습니다.
>
> **r4 재개(2026-11-19, UX Spec r4 승인 후)**: 사용자 원문 "UX Spec revision 4를 승인합니다." 이후 `begin`으로 재개했습니다.
> - **CR-011 확정**: 새 토큰 3개(`color.accent.subtle`·`color.accent.mint`·`color.text.accent`, UX Spec r4 반영)와 최종 테마 값(③) 기록
> - **CR-012 재결정**: C안 계열 — 등록·관리되는 일러스트 자산 사용 정책
> - **공식 선택**: 시각 탐색 V04-A — `explore-choose` 기록 EXP-V04-A(2026-11-19, 사용자 원문 "저는 V04-A를 최종 디자인으로 선택합니다.", 측정 M20261119-020127-3e7ee5 스크린샷 증거). 채택(`explore-adopt`)은 아직 하지 않았으며, 채택 때 후보 VD-026–037의 값을 V04-A 기준으로 확정합니다(아래 각 VD의 'V04-A 정합 메모').
> - **DD 해결 항목**: 작은 주 버튼·SegmentedControl 흰 글자 대비(4.1), 자산 권리 확인(CR-012)

> **r4 재개 2(2026-11-19, UX Planning r6·UX Spec r5 승인 후)**: 사용자 원문 "UX Spec revision 5의 변경 내용과 구조 확인 결과를 검토했으며, UX Planning revision 6에 따른 코트 표시 방식 및 번호 위치 개정을 승인합니다." 이후 `begin`으로 재개했습니다.
> - **기준 갱신**: UX Spec r5(CMP-046 재생 중 번호 격자 숨김), UX 결정 r6(UXD-077 재생 중 숨김·번호 위치 개정)
> - **반영**: VD-026·027 재생 중 완전 숨김, V05 2차 시안의 번호 위치·크기·대비 값(VD-027), 판정 칸 위 가독성 보완(VD-029·030·031)
> - **V04 채택 완료**(`explore-adopt --round V04`, 2026-11-19): 엔진 후보 VD-038–043(`design-explore/V04/selection/adoption/vd-candidates.md`)은 아직 이 문서로 옮기지 않았습니다(기존 VD-024·032–036과 겹침 정리 후 옮김).
> - **V05 최종 후보(공식 선택 전)**: SCR-102 = V05-A(떠 있는 시트형), SCR-103 = V05-B(밴드·구획형), 코트 `color.court.surface` #2F7D4F 유지(사용자 결정 2026-11-19)
> - **유지**: UXD-081 아래 영역 높이 고정(V05-A 160px)

> **r5 수정 요청 반영(2026-11-19)**: r4 제출 후 사용자 원문 "승인된 VD가 07 렌더 범위 표에 반영되지 않았고, 이번 Preview에서 핵심 탭 화면을 함께 검증하기 위해 렌더 범위를 보완합니다."로 수정 요청(`reopen`). 6장 렌더 범위만 바꿨습니다(SCR-101·102·103 적용 VD 갱신, SCR-103 ST2·ST4, SCR-111·112·121·122 추가). VD-046에 AST-027(intro-1 썸네일, 권리 확인 2026-11-19)을 연결했습니다. 다른 VD 결정과 V04/V05 선택은 바뀌지 않았습니다.

## 0. 결정 정리표

| 구분 | VD | CR |
|---|---|---|
| A. 승인 명세와 일치해 확정 | VD-001, VD-002, VD-003, VD-004, VD-007(단일 행), VD-008, VD-010, VD-020, VD-021, VD-022, VD-023, VD-024, VD-025 | CR-009(해당 없음) |
| B. 테마 값 변경만으로 적용 | (VD-001 글꼴 값) | CR-008(반영: `docs/design-profile/theme.json`) |
| C. UX Spec r2에 반영하지 않아 종결 | - | CR-001, CR-002, CR-003(기각·종결, r2) |
| D. 사용자 판단으로 결정 | VD-019(반영) | CR-004·005·006(거절), CR-007(④로 반영), CR-010(반영) |

| E. (r4 재개 2) 승인 — V04·V05 채택 완료(EXP-V04-A·EXP-V05-MIX) | VD-024(r4 개정안), VD-026–VD-046 | - |
| E2. (r5) 렌더 범위 보완 | 6장: SCR-101·102·103 적용 VD 갱신, SCR-111·112·121·122 추가. VD-046에 AST-027 연결(AST-018 미사용) | - |
| F. (r4) 사용자 결정 | - | CR-011(확정 2026-11-19: 토큰 3개, UX Spec r4 승인), CR-012(재결정 2026-11-19: C안 계열), CR-013(B안 유지) |
| G. (r4) DD 해결 항목 | - | 4.1 작은 주 버튼·SegmentedControl 대비(결정 2026-11-19), CR-012 자산 권리 확인(2026-11-19: AST-028–037·046 확인 완료, AST-018 미확인 — VD-046에서 제외) |

~~미결정·후보 VD와 미결 CR은 없습니다.~~ (r4) 위 E행(후보 VD)과 G행(해결 항목)이 결정될 때까지 제출할 수 없습니다.

## 1. 입력

- **UX 설계 기준**: ~~ux_spec r2(승인됨, 2026-11-13), UX 결정 r4~~ ~~(r4) ux_spec r3(승인됨, 2026-11-18), UX 결정 r5~~ (r4 재개 2) ux_spec r5(승인됨, 2026-11-19), UX 결정 r6
- **(r4) 참고 이미지**: REF-001(`design-explore/references/REF-001/`, 원본은 Git 제외, 권리 미상 → 참고 전용). 분석 `extraction.json`(RX-001-01–19, 추정 7건은 사용자 확인 대기). 참고 의도 INT-001(사용자 문장 2026-11-18). 이미지의 문구·스테이지 개수·메뉴 구성·범위 밖 기능(맞춤 추천, 알림, 활동 리포트 등)은 요구사항이 아닙니다.
- **디자인 프로필**: `docs/design-profile/`(stack.md, visual-decisions.md, token-mapping.md, component-mapping.md, figma.md)
- **브랜드·시각 방향**: C안 Mint Hybrid의 테마 값(청록 주 행동 색·포커스 링, Pretendard)만 적용하고, 화면 구조는 승인된 UX 설계 그대로. 테마 값은 `docs/design-profile/theme.json`(개발자 설정)
- **컴포넌트·토큰 매핑**: `docs/design-profile/component-mapping.md`(CMP ↔ shadcn/ui + Radix), `docs/design-profile/token-mapping.md`(04 토큰 → CSS 변수)
- **규칙 출처**: UI UX Pro Max v2.15.0 커밋 `4f2dbb6`(데이터만 참조, 설치 안 함, 권위 순서 최하위)

## 2. 디자인 방향과 스타일 원칙

- 체육관 현장에서 한 손으로 빨리 읽고 누르는 업무 화면: 정보 밀도는 높게, 그라데이션·장식은 쓰지 않음
- (r4, 후보) **튜토리얼 목록(SCR-101) 예외**: 학습 화면은 업무 화면과 달리 동기 부여가 목적이라, 참고 이미지(REF-001)처럼 밝은 흰 바탕에 민트 한 계열 면, 소개 배너의 부드러운 그라데이션 한 곳, 장식 그림을 허용합니다. 운영 화면과 다른 회원 화면에는 적용하지 않습니다(마이페이지 개편은 범위 밖).
- (r2) 카드는 일괄 금지가 아니라 04 3.1 '카드와 Flat 구분' 기준에 해당하는 정보 묶음(경기·코트, 결과·순위, 청백전 목록 항목, 랭크·전적, 스테이지, 내 다음 경기)에만 씀. 반복 목록·입력·설정은 Flat(사용자 결정 D4, VD-024)
- (r2) 모든 화면은 PC·모바일 같은 배치: 가운데 정렬한 최대 600px 한 열(`size.content.member`), 하단 탭, 하단 시트. PC 전용 다단·옆 메뉴·옆 패널·가운데 대화상자 없음(D1·D2, VD-021·025)
- 브랜드 색(청록)은 04의 `color.action.primary`·`color.focus.ring` 의미 그대로(주 버튼, 링크, 선택 상태, 포커스)에만 씀. 상태 색과 팀·코트 색은 04 값 그대로
- 화면 구조·정보·행동은 승인된 02 그대로(헤더 → 안내 줄 → 검색 → 칩 → 목록, '게스트 추가'는 PC·모바일 모두 오른쪽 아래, D3)
- 모든 누름 대상은 누름 영역 44 이상. 보이는 크기와 누름 영역을 따로 정함. 글자 대비 4.5:1(큰 글자 3:1), 색만으로 구분하지 않음

## 3. 시각 결정 (VD)

### VD-001: 기본 글꼴 Pretendard
- **결정**: Pretendard Variable, 폴백 system-ui, sans-serif(테마 값 `font.family.base`)
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-10). Code-first PoC에서 3개 폭 모두 적용 확인
- **관련**: font.family.base
- **토큰 밖 값**: 없음

### VD-002: 아이콘 세트 Lucide
- **결정**: lucide-react 아이콘만 씀
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-10). 04 4장 '아이콘 세트와 크기는 시각 디자인 단계에서 정함'
- **관련**: CMP-025, CMP-026
- **토큰 밖 값**: 없음

### VD-003: 웹 글꼴 로딩 방식
- **결정**: npm `pretendard` 패키지의 dynamic subset을 빌드에 포함(자체 호스팅, 외부 CDN 없음)
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-11). PoC에서 외부 요청 없이 동작. 04 4장이 '웹 글꼴 도입 여부'를 시각 디자인 단계로 넘김. 인앱 브라우저 첫 로딩 크기는 프리뷰에서 측정
- **관련**: font.family.base
- **토큰 밖 값**: 없음

### VD-004: 점수·인원 숫자는 고정폭 숫자
- **결정**: 점수와 인원 숫자에 `tabular-nums`
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-11). 세로로 훑을 때 자릿수 정렬. 정보·순서는 바뀌지 않음
- **관련**: CMP-024, SCR-211
- **토큰 밖 값**: 없음

### VD-007: 명단 행 구성(단일 행)
- **결정**: UXD-074 표기 그대로 한 줄 '이름 · 성별 · 급수 · 점수'(이름·점수 굵게). 점수 없음은 점수 자리에 '미설정' 배지. 점수 오른쪽 열 분리는 쓰지 않음(CR-006 거절)
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-11). UXD-074와 02 SCR-211 레이아웃의 한 줄 표기. 오른쪽 아래 떠 있는 '게스트 추가'가 남으므로 오른쪽 점수 열은 가려질 위험이 있음(B안 실험 결함)
- **관련**: CMP-024, CMP-005, UXD-074, SCR-211
- **토큰 밖 값**: 없음

### VD-008: 행 높이 56 + 구분선 1(행 안)
- **결정**: 행 전체 56(구분선 포함), 좌우 여백 16(VD-021의 페이지 좌우 여백과 같음)
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-11). 04 CMP-024 '행 높이 48px 이상'을 충족. PoC 측정 56
- **관련**: CMP-024, color.border.default
- **토큰 밖 값**: 없음

### VD-010: 필터 칩 보이는 높이 32 · 누름 영역 44
- **결정**: 위아래 6px 누름 영역 확장, 두 줄일 때 줄 간격 12, 반경 `radius.md`(CR-010)
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-11). 04 size.touch.min 44 충족(PoC 측정). 줄 간격 8이면 누름 영역이 4px 겹침
- **관련**: CMP-004, color.border.strong, radius.md
- **토큰 밖 값**: 없음

### VD-019: 하단 탭 Lucide 아이콘과 현재 탭 표시
- **결정**: 튜토리얼 graduation-cap, 청백전 swords, 마이페이지 circle-user-round, 운영 clipboard-list(24px). 탭 이름·순서·글자 레이블·행동은 그대로. 현재 탭은 아이콘·글자 `color.action.primary` + 굵은 글자 + 위쪽 표시 막대(새 토큰 없음). 탭 높이 56(CR-005). (r2) PC·모바일 같은 하단 탭, 600px 열 너비(04 CMP-025 `layout=bottom`)
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-11, CR-007을 시각 표현으로 반영). 04 CMP-025 상태 '현재 탭'(aria-current), 04 4장 '아이콘은 기능만 정의'
- **관련**: CMP-025, color.action.primary
- **토큰 밖 값**: 없음

### VD-020: 하단 안전 영역
- **결정**: 하단 탭 아래 `env(safe-area-inset-bottom)`, 목록 끝 스크롤 여백 = 탭 높이 + 안전 영역 + 16, 포커스 스크롤 여백도 같게. 오른쪽 아래 '게스트 추가'는 탭 위 16. (r2) 적용 범위 확장: PC(1440px)의 600px 열에서도 같은 값을 쓰고, '게스트 추가'는 열 오른쪽 안쪽 16(열 바깥 화면 가장자리가 아님). 하단 고정 행동 바(SCR-202, SCR-223)와 시트 하단 고정 버튼도 안전 영역 위(04 3.1·3.2)
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-11, r2 범위 확장 2026-11-13 D3). 새 시각 정책 값(④). PoC 측정에서 가림·포커스 가림 0(안전 영역 34 가정)
- **관련**: CMP-025, CMP-001, CMP-021, SCR-211, SCR-202, SCR-223
- **토큰 밖 값**: 없음

### VD-021: 한 열 레이아웃의 좌우 여백과 열 바깥 배경
- **결정**: 열 안쪽 좌우 여백은 모든 폭에서 `space.gutter.mobile`(16px). 600px 열에 닿는 넓은 화면에서도 `space.gutter.desktop`으로 넓히지 않음. ~~열 바깥 배경은 `color.bg.page`(열과 같은 흰색, 경계선 없음).~~ (r3) 화면 폭이 열보다 넓을 때(태블릿·PC) 열 바깥 배경은 `color.bg.surface`, 열 배경은 `color.bg.page`이고 열에 그림자 `elevation.card`를 줘 영역을 구분함. 모바일(화면 폭 = 열 폭)에는 바깥 영역이 없어 해당 없음. 화면 제목·목록·카드·하단 고정 바·시트 내용의 왼쪽 시작선을 이 여백으로 맞춤
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-13, r3 수정 2026-11-17: 데스크톱에서 열과 바깥이 같은 흰색이면 영역 구분이 안 보임). 04 3.1 '한 열 원칙'·'페이지 좌우 여백'. VD-008의 행 좌우 여백 16과 같아 시작선이 하나로 정리됨
- **관련**: space.gutter.mobile, color.bg.page, color.bg.surface, elevation.card, size.content.member, CMP-026
- **토큰 밖 값**: 없음

### VD-022: 섹션 간격 3단계
- **결정**: ① 섹션 사이 `space.6`(24px) ② 섹션 안 항목 사이(카드와 카드, 입력칸과 입력칸) `space.3`(12px) ③ 한 요소 안(제목과 보조 글, 아이콘과 글자) `space.1`(4px). 항상 ① > ② > ③. 목록 행 사이는 간격 없이 VD-008의 구분선
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-13, 기존 space 토큰 중 3단계 선택). 04 3.1 '섹션 간격'. ②는 VD-010의 칩 줄 간격 12와 같음
- **관련**: space.6, space.3, space.1
- **토큰 밖 값**: 없음

### VD-023: 제목 계층의 색과 간격
- **결정**: 크기·굵기는 04 3.1 그대로(h1 `font.size.heading`, h2 `font.size.title`·`font.weight.bold`, h3 `font.size.body`·`font.weight.bold`). 제목 색은 모두 `color.text.primary`, 보조 정보는 `color.text.secondary`. 제목 아래 내용과의 간격은 `space.2`(8px), 제목 위 간격은 VD-022의 섹션·항목 간격을 따름
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-13, 04 크기·굵기 유지, 색과 간격은 기존 토큰)
- **관련**: font.size.heading, font.size.title, font.size.body, font.weight.bold, color.text.primary, color.text.secondary, space.2
- **토큰 밖 값**: 없음

### VD-024: 카드 표현과 적용 대상
- **결정**: 04 3.1 '카드를 쓰는 경우'의 정보 묶음(CMP-041 GameCard, CMP-042 StandingsCard, CMP-043 ClubMatchListItem, CMP-045 RecordSummary, CMP-047 StageCard)만 카드로 그림. 표현은 배경 `color.bg.page` + 테두리 1px `color.border.default` + 모서리 `radius.md`, 그림자 없음(`elevation.card`는 쓰지 않음). 카드 안 구역 구분은 `color.bg.surface`. 카드 안 여백은 `space.3`. 반복 목록·입력·설정·필터는 Flat(행과 구분선). 카드 안에 카드를 두지 않음
- **상태**: 승인 (r4 개정안 적용. 사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.' 및 V04-A 기준 지시 '흰 카드와 옅은 그림자 기준으로 r4 개정안 유지')
- **근거**: 사용자 결정(2026-11-13, D4: 필요한 정보 그룹에만 선택적으로 카드). r1 2장의 '카드를 쓰지 않음'을 대체. 테두리는 장식용 구분이라 대비 기준 예외(04 1.2 color.border.default 용도)이며 정보는 글자로 전달
- **관련**: CMP-041, CMP-042, CMP-043, CMP-045, CMP-047, color.border.default, color.bg.surface, radius.md, space.3
- **토큰 밖 값**: 없음
- **r4 개정안**: 카드 대상에서 CMP-047 StageCard를 빼고 CMP-048 CourseCard·CMP-050 ContinueCard를 넣습니다. 스테이지(CMP-047)는 과정 카드 안의 행이며, 행 사이는 `color.border.default` 1px 구분선입니다('카드 안에 카드 없음', 04 3.1 r3). 튜토리얼 목록의 카드 표현은 배경 `color.bg.page`, 테두리 1px `color.border.default`, 모서리 `radius.md`(10px), ~~그림자는 쓰지 않습니다(REF-001 RX-001-05·11: 얇은 테두리, 거의 없는 그림자).~~ (r4 재개 2, V04-A 채택 EXP-V04-A) 테두리는 `color.border.default` 70%로 은은하게, 옅은 그림자(주 행동 색 7%·글자색 5%를 섞은 두 겹, 위로 3px 이내 퍼짐)를 둡니다. 다른 화면의 카드(CMP-041·042·043·045)는 r3 표현 그대로입니다.
- **r4 관련**: CMP-047, CMP-048, CMP-050, REF-001(RX-001-05, RX-001-11), INT-001, EXP-V04-A
- **r4 토큰 밖 값**: 있음 — 옅은 그림자(토큰 색을 섞은 값, VD-025 딤과 같은 방식으로 기록)

### VD-025: 하단 시트 시각(중첩 시트 포함)
- **결정**: PC·모바일 같은 하단 시트(CMP-021 `presentation=bottom`). 시트 너비는 600px 열과 같음. 위쪽 모서리 `radius.sheet`, 그림자 `elevation.sheet`, 배경 `color.bg.page`. 위쪽 손잡이 막대는 `color.border.default`, 높이 `space.1`. 하단 고정 버튼 영역은 위쪽 구분선 `color.border.default` + 안전 영역 위(VD-020). 열기·닫기는 `motion.duration.base`(움직임 줄이기면 즉시). 중첩 시트(04 3.2)는 같은 CMP-021 `stacked`를 재사용하고 새 변형을 만들지 않음: 두 번째 시트는 첫 번째 시트 위에 같은 모양으로 열리고, 딤은 한 겹만 둠. 딤 배경은 `color.text.primary` 40% 불투명도(**임시 구현값**, 현재 FE `bg-ink/40`)
- **상태**: 승인
- **근거**: 사용자 결정(2026-11-13, 기존 radius·elevation 토큰 사용, 중첩은 기존 Sheet 패턴 재사용, 딤은 임시 구현값으로 기록하고 UX Spec r2를 다시 열지 않음). 04 CMP-021, 04 3.2
- **관련**: CMP-021, radius.sheet, elevation.sheet, color.bg.page, color.border.default, color.text.primary, space.1, motion.duration.base
- **토큰 밖 값**: 있음 — 딤 배경 불투명도 40%(`color.text.primary`에 적용). 04에 딤 토큰이 없어 토큰 밖 값입니다. 새 토큰은 추가하지 않았으며, 정식 토큰이 필요하면 다음 UX Spec 개정 때 ② 변경 요청으로 다룹니다

### VD-026: 번호 격자 선(코트 위)
- **결정**: 내 편 반 코트 칸 경계를 흰색(`color.court.line`) 70% 불투명도의 점선으로 그립니다.
  - 굵기 0.35단위(약 1.1–1.6px), 점선 1.6/1.2단위
  - 실제 코트 라인은 `color.court.line` 100%, 실선 0.5단위라 굵기·모양·투명도 세 가지로 구분됩니다.
  - 바깥 테두리는 코트 라인과 겹치므로 그리지 않고, 칸 사이 경계만 그립니다.
  - ~~재생 중(`mode=playing`)에는 35%로 낮춥니다.~~ (r4 재개 2, UXD-077 r6·CMP-046 r5) 상황 재생 중(`mode=playing`)에는 격자 선을 그리지 않습니다(0%). 셔틀이 멈춰 선택 대기에 들어가면 내 편 반 코트에만 240ms 페이드로 나타나고(움직임 줄이기 설정이면 바로), 판정 뒤·정답 움직임 보기에서는 유지합니다. 입문자 안내형(`guided`)은 처음부터 표시합니다. 상대 편 반 코트에는 그리지 않습니다.
- **대비(계산)**: 70% 흰 점선 대 코트 바닥 3.35:1(비텍스트 3:1 충족). 60%는 2.88:1이라 쓰지 않습니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: UXD-077(격자는 학습용 논리 구역, 실제 라인과 혼동 금지), 사용자 요청 '코트 라인과 구별되는 은은한 점선'. 참고 이미지에는 코트 격자가 없어 레퍼런스 규칙이 아닙니다.
- **관련**: CMP-046, SCR-102, color.court.line, color.court.surface
- **토큰 밖 값**: 있음 — 불투명도 70%, ~~35%~~, 점선 간격(SVG 좌표 단위), 나타나는 전환 240ms(04에 motion 토큰 값이 없어 기록, V05 시안 값). 04에 불투명도 토큰이 없어 VD-025 딤과 같은 방식으로 기록합니다.

### VD-027: 칸 번호
- **결정**: ~~칸 왼쪽 위 안쪽(칸 원점 x+2.2, y+4.2단위)에 번호를 둡니다.~~ (r4 재개 2, UXD-077 r6) 칸 왼쪽 위 안쪽에, 실제 코트 라인과 겹치지 않게 번호를 둡니다.
  - 위치(번호 원의 왼쪽 위, 칸 원점 기준): 기본 x+0.8, y+0.8. 왼쪽 끝 열(x 0)은 단식 사이드라인(x 4.6) 안쪽인 x+5.4, 네트에 붙은 첫 줄(y 67)은 네트 아래인 y+1.4(V05 2차 시안 6칸·9칸에서 확인). 칸 영역·누름 영역·번호 매핑은 그대로입니다.
  - 색 `color.court.line`, 굵기 700, ~~크기 4.6단위~~ (r4 재개 2) 크기 5.4단위. V05-A(아래 영역 160px)에서 390×844 22.1px, 360×640 14.5px, 360×560 11.5px(측정)
  - ~~번호 뒤에 지름 6단위 원을 `color.court.surface` 60%로 깔아~~ (r4 재개 2) 번호 뒤에 지름 7단위 원을 `color.court.surface` 100%(불투명)로 깔아, 판정 채움 칸·선수·셔틀·라인 위에서도 흰 번호 대비 5.04:1(일반 글자 기준 4.5:1 이상)을 유지합니다. 60%일 때 채움 칸 위 2.74–2.84:1이라 바꿨습니다.
  - 상태별 표시: 선택 대기 100%, ~~재생 중 40%~~ (r4 재개 2) 재생 중 그리지 않음(VD-026과 같은 전환으로 나타남), ~~판정 뒤 70%~~ (r4 재개 2) 판정 뒤 100%(원이 불투명해 흐리게 둘 필요가 없음)
  - 입문자(`guided`)에서는 질문의 목표 번호를 강조하지 않습니다. 강조하면 정답을 알려 주게 됩니다.
- **대비(계산)**: 흰 글자 대 코트 바닥 5.04:1. (r4 재개 2) 흰 글자 대 불투명 번호 원 5.04:1 — 모든 배경(바닥·정답·허용·오답 채움·선택 채움)에서 같음
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: UXD-077(번호는 칸 왼쪽 위, 선수가 가리지 않게; r6 재생 중 숨김·라인 회피), 사용자 요청 '칸 번호의 크기와 대비'
- **관련**: CMP-046, SCR-102, color.court.line, color.court.surface, font.size.title
- **토큰 밖 값**: 있음 — SVG 좌표 단위 글자 크기(~~4.6~~ 5.4단위)·원 지름(7단위)·위치 값. 화면 배율에 따라 px가 바뀝니다.
- **(r4 재개 2) 검증 항목 — 15칸**: `grid-5x3`(AC-116)은 V05 재검증에서 시험 렌더링으로 위치를 확인합니다(9장 참조).
  - 시험 결과(2026-11-19, `design-explore/review/V05/grid15/`): 6칸·9칸 값을 그대로 쓰면 15칸에서 번호 8개가 겹칩니다(5·10·15번 오른쪽 단식 사이드라인, 8·13번 센터 라인, 1·6·11번 옆 칸 경계 0.2단위). 15칸 전용 참고값(확정 아님, 사용자 결정 2026-11-19: 중급·고급 구현 때 재검증) — 원 5.0단위·글자 4.0단위, 기본 x+0.6, 왼쪽 끝 열 x+5.4, 첫 줄 y+1.4 — 은 겹침 0(계산·렌더 확인)이지만 글자가 360×640에서 10.7px, 390×844에서 16.4px입니다. 15칸 칸 너비는 360×640에서 33px(44px 미만, UXD-078 확인 단계 기본값과 일치). 중급·고급 콘텐츠 개발 때 다시 검증합니다(02 SCR-102 '15칸').

### VD-028: 선택 강조와 확정 대기
- **결정**: 고른 칸은 `color.court.line` 실선 테두리와 흰색 25% 채움으로 강조합니다.
  - 테두리 굵기 0.8단위, 안쪽 모서리 1.5단위
  - 확인 단계의 확정 대기(SCR-102-ST12): 강조를 유지하고 테두리를 1.2단위로 굵게 합니다. 아래 '이 칸으로 이동' 버튼(CMP-001 primary, 56px)을 함께 활성화합니다.
  - 단일 터치: 누르는 순간 같은 강조를 120ms 보여 준 뒤 이동합니다(`motion.duration.fast`).
  - 키보드 초점: 그 칸에 `color.focus.ring` 2px 바깥선을 둡니다.
- **대비(계산)**: 흰 테두리 대 25% 채움 3.13:1, 대 코트 바닥 5.04:1
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: UXD-078, AC-115(고른 칸 강조), 사용자 요청 '선택한 칸의 강조'
- **관련**: CMP-046, CMP-001, SCR-102, color.court.line, color.focus.ring, motion.duration.fast
- **토큰 밖 값**: 있음 — 채움 25%, SVG 단위 굵기

### VD-029: 판정 피드백(코트 위)
- **결정**: 판정 뒤 칸을 상태 배경색 90% 채움, 상태 글자색 아이콘, 테두리 모양 세 가지로 구분합니다.
  - 정답 칸: `color.status.success.bg` 90% 채움, `color.status.success.fg` 체크 아이콘, 실선 테두리 `color.court.line`
  - 허용 칸: `color.status.warning.bg` 90% 채움, `color.status.warning.fg` 물결(~) 아이콘, 점선 테두리
  - 오답으로 고른 칸: `color.status.danger.bg` 90% 채움, `color.status.danger.fg` X 아이콘, 실선 테두리
  - 고른 칸이 정답이 아니면, 고른 칸에 '내 선택' 표시(테두리 1.2단위)를 더해 정답 칸과 동시에 보입니다.
  - (r4 재개 2) 판정 아이콘은 칸 오른쪽 위(6.4단위)에 둡니다. 칸 가운데는 선수·셔틀이 서 있어 가려지기 때문입니다(V05 1차 검토).
  - (r4 재개 2) 선수 이름(나·파트너·상대)에는 `color.court.surface` 100% 받침을 깔아, 판정 채움 칸 위에서도 흰 글자 5.04:1을 유지합니다(받침 없이 오답 채움 위 '나' 1.34:1).
  - 아래 영역의 결과 문구는 기존처럼 색 + 아이콘 + 글자('득점'·'랠리 계속'·'실점')로 표시합니다.
- **대비(계산)**: 아이콘 대 채움 4.87–5.68:1, 채움 대 코트 바닥 3.75–4.01:1. 상태 글자색을 코트 위에 바로 쓰면 1.25–1.41:1이라 쓰지 않습니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: UXD-079(고른 칸·정답 칸·허용 칸 구분, 색만으로 구분하지 않음), 사용자 요청 '정답·허용·오답 피드백'
- **관련**: CMP-046, SCR-102, SCR-103, color.status.success.bg, color.status.success.fg, color.status.warning.bg, color.status.warning.fg, color.status.danger.bg, color.status.danger.fg, color.court.line
- **토큰 밖 값**: 있음 — 채움 불투명도 90%

### VD-030: 셔틀콕 방향 표시
- **결정**: 판정 뒤에만 셔틀콕이 떨어지려던 지점에 표시합니다.
  - `color.court.line` 점선 고리(지름 7단위, 굵기 0.5단위)와 작은 셔틀 아이콘
  - (r4 재개 2) 고리 안팎에 `color.court.surface` 0.4단위 외곽선을 둡니다. 고리는 보통 정답 칸(채움) 안에 놓이며, 흰 점선만으로는 1.29:1이지만 외곽선 대 채움 3.75–4.01:1(비텍스트 3:1 충족)입니다.
  - 판정 전에는 표시하지 않습니다(UXD-079).
  - 입문자 과정은 표시하지 않습니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: UXD-079, AC-113, 사용자 요청 '셔틀콕 방향 표시'
- **관련**: CMP-046, SCR-102, color.court.line
- **토큰 밖 값**: 있음 — SVG 단위 치수

### VD-031: 올바른 이동 동선
- **결정**: '올바른 움직임 보기'(SCR-102-ST10)와 결과 화면 다시 보기에서 시작 위치 → 정답 칸 이동 목표점을 화살표로 그립니다.
  - 선: `color.court.line` 실선 0.6단위, 끝에 화살촉 2.4단위
  - ~~선 아래에 `color.court.surface` 0.6단위 그림자 선을 깔아, 흰 격자 위에서도 보이게 합니다.~~ (r4 재개 2) 선과 화살촉 전체를 `color.court.surface` 100% 0.4단위 외곽선으로 감쌉니다. 화살표 끝이 정답 칸(채움) 안에 들어가면 흰 선만으로 1.29:1, 이전 그림자(85%)로 3.09:1이었고, 외곽선 대 채움 3.75–4.01:1, 바닥 위 흰 선 5.04:1입니다. 파트너 점선에도 같은 외곽선을 씁니다.
  - 그리기 애니메이션은 `motion.duration.base`로 하고, 움직임 줄이기 설정이면 바로 표시합니다.
  - 파트너 동선은 같은 모양의 점선(0.4단위)으로 그립니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: UXD-079·069, 사용자 요청 '올바른 이동 동선 화살표'
- **관련**: CMP-046, SCR-102, SCR-103, color.court.line, color.court.surface, motion.duration.base
- **토큰 밖 값**: 있음 — SVG 단위 치수

### VD-032: 과정 카드
- **결정**: CMP-048 `available`
  - **카드**: VD-024 r4 개정안 표현(흰 바탕, 테두리 1px `color.border.default`, `radius.md`, 그림자 없음)
  - **머리 행**: 높이 약 56px, 안쪽 여백 `space.4`
    - 왼쪽: 과정 아이콘(Lucide 24px, 과정마다 다른 모양 — 입문자 sprout, 왕초급 shield, 초급 swords. 색은 `color.action.primary`). (r4 재개 2) VD-046(일러스트 자산)이 승인되면 V04-A의 과정 장식 일러스트로 바꾸고, 그 전에는 이 Lucide 아이콘(lucide-react 패키지, VD-042)을 씁니다.
    - 가운데: '튜토리얼 난이도 · 입문자'(`font.size.title`, 700)와 한 줄 설명(`font.size.caption`, `color.text.secondary`)
    - 오른쪽: 과정 진행 배지(VD-034)
  - **아래**: 스테이지 행(VD-036)을 1px 구분선으로 쌓습니다.
  - **카드 사이**: `space.6`(24px)
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 선택 EXP-V04-A, UXD-083, REF-001 RX-001-06(난이도별 아이콘 구분)·RX-001-10(과정 섹션 머리 구성)·RX-001-14(진행 배지)
- **관련**: CMP-048, SCR-101, color.bg.page, color.border.default, color.action.primary, color.text.secondary, radius.md, space.4, space.6, font.size.title, font.size.caption
- **토큰 밖 값**: 없음(아이콘 색은 참고 이미지의 초록·금색 대신 Teal 한 색. 다른 색은 CR-011 결정 뒤 재검토)

### VD-033: 전체 진행률 막대와 소개 배너
- **결정**:
  - **소개 배너**(SCR-101 맨 위)
    - 모서리 `radius.md`, 안쪽 여백 `space.5`
    - 배경은 연민트 → `color.bg.page` 그라데이션(왼쪽 위 → 오른쪽 아래). 연민트 값은 CR-011 결정에 따릅니다. CR-011이 거절되면 `color.bg.surface` 단색입니다.
    - 머리글: `font.size.caption` 700 `color.action.primary`
    - 제목: `font.size.heading` 800 두 줄 이내
    - 설명: `font.size.body` `color.text.secondary`
    - 오른쪽 장식 그림: ~~CR-012~~ (r4 재개 2) VD-046으로 분리 — VD-046 승인 전에는 장식 없이 그라데이션 면만 둡니다(자산 없이 렌더한 측정 M20261119-020301-4d5c67에서 차단 0).
  - **전체 진행률**(CMP-049 `overall`): 배너 아래쪽 안에 흰 카드(`color.bg.page`, `radius.md`, 테두리 1px `color.border.default`)로 둡니다.
    - 막대: 높이 8px, 끝 둥글게(`radius.md`). 트랙 `color.bg.surface`, 채움 `color.action.primary`
    - 왼쪽 '전체 진행', 오른쪽 '3 / 8'(`font.size.body` 700, 고정폭 숫자 VD-004)
- **대비(계산)**: 채움 대 트랙 5.68:1. 트랙 대 흰 바탕 1.09:1이라 숫자 글자를 반드시 함께 둡니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.') — 일러스트 의존 분리 후
- **근거**: 사용자 선택 EXP-V04-A, REF-001 RX-001-04(배너 그라데이션)·RX-001-10(진행률을 배너 안에 겹침)·RX-001-13(막대), UXD-083
- **관련**: CMP-049, SCR-101, SCR-103, color.action.primary, color.bg.surface, color.bg.page, color.border.default, color.text.secondary, radius.md, space.5, font.size.heading, font.size.caption, font.size.body
- **토큰 밖 값**: 있음 — 그라데이션(두 토큰 사이 보간, 방향 135°)
- **V04-A 정합 메모(2026-11-19, V04 채택 반영 — 위 결정과 다르면 이 메모가 우선, 근거 EXP-V04-A)**: 머리글 글자 `color.text.accent`(← `color.action.primary`), 배너 배경은 `color.accent.subtle`·`color.accent.mint`·`color.bg.page` 그라데이션(CSS, 이미지 아님), 오른쪽 장식 셔틀콕은 VD-046으로 분리(권리 확인 전 미사용), 진행률 채움 `color.action.primary`(#0B9E8B, 흰 바탕 3.35:1 — 비텍스트 3:1 충족, 트랙 대비는 2.83:1이라 숫자 글자 병기 필수).

### VD-034: 배지(예상 학습 시간·과정 진행)
- **결정**: 알약 모양 배지(CMP-005)
  - 높이 24px, 좌우 `space.2`, 모서리 12px(완전히 둥근 모양)
  - 글자 `font.size.caption` 700 `color.action.primary`, 배경 연민트(CR-011)
  - 내용: 예상 학습 시간 '약 3분', 과정 진행 '1 / 3'
  - 과정을 모두 통과하면 배지 글자 앞에 체크 아이콘을 둡니다.
- **대비(계산)**: Teal 글자 대 teal-50 5.45:1(CR-011 A·B안). CR-011 C안이면 `color.bg.surface` 위 Teal, 5.68:1.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 선택 EXP-V04-A, REF-001 RX-001-09·RX-001-14
- **관련**: CMP-005, CMP-047, CMP-048, SCR-101, color.action.primary, font.size.caption, space.2
- **토큰 밖 값**: 있음 — 모서리 12px(CR-010의 칩 반경 16과 같은 성격의 토큰 밖 값)
- **V04-A 정합 메모(2026-11-19, V04 채택 반영 — 위 결정과 다르면 이 메모가 우선, 근거 EXP-V04-A)**: 배지 글자 `color.text.accent`(#10776C, `color.accent.subtle` 위 4.84:1), 배경 `color.accent.subtle`, 글자 13px. 통과 배지는 점수 포함('통과 5/5').

### VD-035: 이어서 하기 카드와 준비 중 카드
- **결정**:
  - **이어서 하기**(CMP-050)
    - 연민트 면(CR-011)에 모서리 `radius.md`, 안쪽 여백 `space.4`, 테두리 없음
    - 왼쪽: 지름 40px 원형 재생 아이콘(테두리 2px `color.action.primary`)
    - 가운데: '이어서 하기'(`font.size.caption` `color.action.primary` 700), 과정 · 학습 목표 제목(`font.size.title` 700), 예상 학습 시간(`font.size.caption` `color.text.secondary`)
    - 오른쪽: 화살표
    - 카드 전체가 누름 영역(최소 높이 72px)
  - **준비 중**(CMP-048 `comingSoon`)
    - 흰 바탕, 점선 테두리 1px `color.border.strong`, 높이 56px
    - 이름(`font.size.body` `color.text.disabled`)과 '준비 중' 배지(`color.bg.surface` 바탕, `color.text.secondary`)
    - 누름 반응과 화살표가 없습니다.
- **대비(계산)**: 비활성 글자 4.83:1(흰 바탕)
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 선택 EXP-V04-A, REF-001 RX-001-15(연민트 강조 카드의 표현만 참고, '맞춤 추천' 기능은 쓰지 않음), UXD-084, C-29
- **관련**: CMP-050, CMP-048, SCR-101, color.action.primary, color.text.secondary, color.text.disabled, color.border.strong, color.bg.surface, radius.md, space.4, font.size.title, font.size.caption, font.size.body
- **토큰 밖 값**: 없음(연민트 면은 CR-011)
- **V04-A 정합 메모(2026-11-19, V04 채택 반영 — 위 결정과 다르면 이 메모가 우선, 근거 EXP-V04-A)**: 이어서 하기는 사용자 지시(2026-11-19 V02 피드백)대로 **흰 카드 + 은은한 테두리·그림자**(연민트 면 아님). 재생 아이콘은 흰 바탕 위 `color.action.primary` 링·삼각형(3.31:1, 비텍스트 충족), '이어서 하기' 글자 `color.text.accent`.

### VD-036: 스테이지 행과 상태 표현
- **결정**: CMP-047
  - **행 구성**: 높이 72px, 안쪽 여백 `space.3`·`space.4`
    - 왼쪽 썸네일 88×56px, 모서리 `radius.sm`. 연민트 바탕에 그림(~~CR-012~~ (r4 재개 2) 그림은 VD-046으로 분리 — VD-046 승인 전에는 그림 없이 연민트 면만 둠)
    - 가운데: 학습 목표 제목(`font.size.body` 700)과 상태 줄(`font.size.caption` `color.text.secondary`)
    - 오른쪽: 예상 시간 배지(VD-034)와 화살표(Lucide chevron-right 20px, `color.text.secondary`)
  - **상태**
    - 통과: 제목 앞 체크 아이콘 `color.status.success.fg`, 상태 줄 '통과 · 최고 5/5'
    - 미완료: 상태 줄 '미완료 · 최고 2/5'(`color.text.secondary`)
    - 아직 안 함: 상태 줄 '아직 안 함'
  - 상태는 아이콘과 글자로 함께 표시하고, 색만 쓰지 않습니다.
- **대비(계산)**: 성공 글자 대 흰 바탕 6.31:1
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.') — 일러스트 의존 분리 후
- **근거**: 사용자 선택 EXP-V04-A, REF-001 RX-001-11(행 구성)·RX-001-12(크기, 추정 항목이라 확인 전에는 04 토큰 값으로 대체), UXD-083, AC-120
- **관련**: CMP-047, SCR-101, color.status.success.fg, color.text.secondary, radius.sm, space.3, space.4, font.size.body, font.size.caption
- **토큰 밖 값**: 없음(썸네일 크기 88×56은 컴포넌트 치수)
- **V04-A 정합 메모(2026-11-19, V04 채택 반영 — 위 결정과 다르면 이 메모가 우선, 근거 EXP-V04-A)**: 썸네일 80×48, 썸네일 그림과 과정 장식 일러스트는 VD-046으로 분리(권리 확인 전 미사용, 장식 `aria-hidden`). 상태는 제목 옆 배지('통과 5/5'·'미완료 2/5'·'아직 안 함', 글자+색), 행 높이 약 56px. 과정 장식은 VD-032·VD-046.

### VD-037: 결과 화면 진행률
- **결정**: SCR-103의 점수 아래에 '왕초급 진행 2/3'과 '전체 4/8'을 CMP-049(course·overall)로 나란히 둡니다.
  - 표현은 VD-033 막대(8px)와 같습니다.
  - 저장 중에는 숨깁니다.
  - 이번 결과로 진행이 늘었으면 해당 막대 채움을 `motion.duration.base`로 늘립니다(움직임 줄이기 설정이면 바로 표시).
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: UXD-083, SCR-103(r3), AC-094, 사용자 선택 EXP-V05-MIX(SCR-103 = V05-B: 8px 막대 2개, 저장 중 숨김 — 시안과 일치)
- **관련**: CMP-049, SCR-103, color.action.primary, color.bg.surface, motion.duration.base
- **토큰 밖 값**: 없음

### VD-038: 색·팔레트 — 채택 테마(V04-A·V05 공통)
- **결정**: 채택 후보 테마의 색 토큰 값을 공식 테마 후보로 씁니다. color.accent.mint = #8EE3CC; color.accent.subtle = #DDF8EF; color.action.onPrimary = #FFFFFF; color.action.primary = #0B9E8B; color.bg.page = #FAFFFD; color.bg.surface = #F4F5F7; color.border.default = #D5D9E0; color.border.strong = #6B7280; color.brand.kakao.bg = #FEE500; color.brand.kakao.fg = #191919; color.court.line = #FFFFFF; color.court.me = #1D5BD0; color.court.opponent = #F2C14E; color.court.surface = #2F7D4F; color.focus.ring = #087F73; color.status.danger.bg = #FDE7E5; color.status.danger.fg = #B3261E; color.status.info.bg = #E3ECFC; color.status.success.bg = #E4F4E8; color.status.success.fg = #1B6E35; color.status.warning.bg = #FFF3D1; color.status.warning.fg = #7A4F00; color.team.blue.bg = #E3ECFC; color.team.blue.fg = #1747A6; color.team.white.bg = #FFFFFF; color.team.white.fg = #1A1D23; color.text.accent = #10776C; color.text.disabled = #6B7280; color.text.primary = #1A1D23; color.text.secondary = #545A65. 공식 테마 대비 바뀌는 값은 `color.action.primary` #006D68 → #0B9E8B, `color.focus.ring` #008F89 → #087F73(CR-011 결정 값)이고 나머지는 04 기본값을 테마 파일에 옮겨 적는 것입니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 선택 EXP-V04-A, 사용자 선택 EXP-V05-MIX, CR-011 (엔진 채택 후보 V04 VD-038–043·V05 VD-038–043을 병합·재번호, 사용자 결정 2026-11-19 'VD 정리안 승인')
- **관련**: SCR-101, SCR-102, SCR-103, color.accent.mint, color.accent.subtle, color.action.onPrimary, color.action.primary, color.bg.page, color.bg.surface, color.border.default, color.border.strong, color.brand.kakao.bg, color.brand.kakao.fg, color.court.line, color.court.me, color.court.opponent, color.court.surface, color.focus.ring, color.status.danger.bg, color.status.danger.fg, color.status.info.bg, color.status.success.bg, color.status.success.fg, color.status.warning.bg, color.status.warning.fg, color.team.blue.bg, color.team.blue.fg, color.team.white.bg, color.team.white.fg, color.text.accent, color.text.disabled, color.text.primary, color.text.secondary
- **토큰 밖 값**: 없음

### VD-039: 타이포그래피 — 채택 테마(V04-A·V05 공통)
- **결정**: font.family.base = "Pretendard Variable", Pretendard, system-ui, sans-serif; font.size.body = 16px; font.size.caption = 13px; font.size.display = 32px; font.size.heading = 22px; font.size.title = 18px; font.weight.bold = 700; font.weight.regular = 400. 04 값 그대로이며, 큰 CTA 22px 굵게(04 r4 CMP-001)·13px 이상 글자를 지킵니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 선택 EXP-V04-A, 사용자 선택 EXP-V05-MIX (엔진 채택 후보 V04 VD-038–043·V05 VD-038–043을 병합·재번호, 사용자 결정 2026-11-19 'VD 정리안 승인')
- **관련**: SCR-101, SCR-102, SCR-103, font.size.body, font.size.caption, font.size.display, font.size.heading, font.size.title, font.weight.bold, font.weight.regular
- **토큰 밖 값**: 없음

### VD-040: 간격·밀도 — 채택 테마(V04-A·V05 공통)
- **결정**: size.content.member = 600px; size.content.ops.max = 1200px; size.nav.side = 240px; size.panel.side = 400px; size.touch.min = 44px; space.1 = 4px; space.2 = 8px; space.3 = 12px; space.4 = 16px; space.5 = 20px; space.6 = 24px; space.8 = 32px; space.gutter.desktop = 24px; space.gutter.mobile = 16px. 04 값 그대로입니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 선택 EXP-V04-A, 사용자 선택 EXP-V05-MIX (엔진 채택 후보 V04 VD-038–043·V05 VD-038–043을 병합·재번호, 사용자 결정 2026-11-19 'VD 정리안 승인')
- **관련**: SCR-101, SCR-102, SCR-103, size.content.member, size.content.ops.max, size.nav.side, size.panel.side, size.touch.min, space.1, space.2, space.3, space.4, space.5, space.6, space.8, space.gutter.desktop, space.gutter.mobile
- **토큰 밖 값**: 없음

### VD-041: 컴포넌트 표현(모서리) — 채택 테마(V04-A·V05 공통)
- **결정**: radius.md = 10px; radius.sheet = 16px; radius.sm = 6px. 04 값 그대로입니다. 시안의 토큰 밖 모서리(SCR-102 V05-A 14px·20px)는 VD-044에서 따로 다룹니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 선택 EXP-V04-A, 사용자 선택 EXP-V05-MIX (엔진 채택 후보 V04 VD-038–043·V05 VD-038–043을 병합·재번호, 사용자 결정 2026-11-19 'VD 정리안 승인')
- **관련**: SCR-101, SCR-102, SCR-103, CMP-001, CMP-022, CMP-023, CMP-026, CMP-030, CMP-046, CMP-047, CMP-048, CMP-049, CMP-050, radius.md, radius.sheet, radius.sm
- **토큰 밖 값**: 없음

### VD-042: 아이콘 — Lucide 패키지 사용
- **결정**: 아이콘은 Lucide(outline, 선 2.0, 격자 24, 둥근 선 끝, `currentColor`)를 **lucide-react 패키지로** 씁니다(VD-002·VD-019와 같은 방식). 탐색 시안용으로 등록한 아이콘 파일(AST-001·014–016·047–056)은 공식 자산으로 쓰지 않습니다.
  - 라이선스: lucide-react 1.70.0 LICENSE — ISC(Lucide Icons and Contributors), Feather 파생 아이콘(check·x·arrow-right·circle-alert 등)은 MIT(Cole Bemis)도 함께 적용
  - 배포 산출물에 ISC 전문·MIT 전문과 저작권 표시를 서드파티 고지로 포함합니다(구현 단계 확인 항목).
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 결정 2026-11-19 'Lucide는 개별 자산 파일을 공식화하지 않고 lucide-react 패키지 방식으로 사용', 사용자 선택 EXP-V04-A, 사용자 선택 EXP-V05-MIX (엔진 채택 후보 V04 VD-038–043·V05 VD-038–043을 병합·재번호, 사용자 결정 2026-11-19 'VD 정리안 승인')
- **관련**: SCR-101, SCR-102, SCR-103
- **토큰 밖 값**: 없음

### VD-043: 화면 구성·시각 계층 — SCR-101(V04-A)
- **결정**: SCR-101은 V04-A의 계층을 따릅니다: 제목 → 소개 배너(VD-033, 전체 진행률 포함) → 이어서 하기 흰 카드(VD-035) → 과정 카드(VD-032, 머리 + 스테이지 행 VD-036) → 준비 중 카드(VD-035). 강조색은 막대·배지 글자·아이콘·현재 탭에만, 면은 흰색·민트. 구조는 승인된 02 그대로입니다. 일러스트는 VD-046.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 미확인 자산에 의존하지 않는 VD는 앞서 제안한 승인 방향으로 진행합니다.')
- **근거**: 사용자 선택 EXP-V04-A (엔진 채택 후보 V04 VD-038–043·V05 VD-038–043을 병합·재번호, 사용자 결정 2026-11-19 'VD 정리안 승인')
- **관련**: SCR-101, CMP-023, CMP-047, CMP-048, CMP-049, CMP-050
- **토큰 밖 값**: 없음

### VD-044: 화면 구성·시각 계층 — SCR-102 셸(V05-A 떠 있는 시트형)
- **결정**: (선택 시안 V05-A 계산값을 390×844에서 측정해 작성, 2026-11-19)
  - 상단 바(CMP-026 `close`) 56px: '✕ 나가기'(13px `color.text.secondary`, 누름 44px) · 과정·단계(16px 700) · '상황 n/5' 민트 알약(`color.accent.subtle` 바탕, `color.text.accent` 13px 700, 높이 26, 모서리는 VD-034와 같은 '완전히 둥근 알약' 모양 규칙 — CMP-005를 추가하는 것이 아니라 모서리 표현만 같음) · 점수 회색 알약(`color.bg.surface`)
  - 상황 설명 16px 700, 1–2줄 → 코트(CMP-046, 남은 높이, VD-026–031)
  - 아래 영역(UXD-081 고정 160px): `color.bg.page` 시트, 위쪽 옅은 그림자. 질문 18px 700. 판정: 상태색 18px 700 제목 + 28px 상태 배경 원 아이콘, 이유 13px `color.text.secondary` 두 줄(넘치면 영역 안 스크롤)
  - 판정 뒤 행동 위계: 학습 행동('최선 위치 보기'·'올바른 움직임 보기')은 56px 외곽선 버튼(작은 주 버튼 DD 4.1: `color.bg.page` 바탕, `color.text.accent` 글자·테두리), '다시 도전'·'다음 상황'은 판정 제목 줄 오른쪽 13px `color.text.accent` 글자 버튼(44px). 재생 컨트롤(ST10)은 56px 민트 칩(`color.accent.subtle`, 13px). 큰 CTA(`primary`·56px·22px 700 흰 글자)는 ST12 '이 칸으로 이동'·ST7 '다음 상황'
  - 모서리(r4 재개 2, 사용자 결정): 모든 버튼(큰 CTA·외곽선·보조·재생 칩·글자 버튼) `radius.md`(10px), 아래 시트 위쪽과 확인 창 `radius.sheet`(16px), 알약 배지는 VD-034 공통 규칙. 시안의 14·20·13px는 쓰지 않습니다.
  - 나가기 확인 창(CMP-022): `color.bg.page` 대화상자(모서리 `radius.sheet`), '취소' `color.bg.surface`, '나가기' `color.status.danger.fg` 바탕 흰 글자
- **검증(시안 대조)**: 배치·크기·색·글자·행동 위계는 V05-A 계산값(390×844 측정)과 일치합니다. 모서리만 사용자 결정으로 04 토큰에 맞춥니다(시안 버튼 14px → `radius.md` 10px, 시트·대화상자 20px → `radius.sheet` 16px, 알약 13px → VD-034 공통 규칙). 04에는 알약(pill) 전용 토큰이 없어 새로 만들지 않았고, 이미 승인된 VD-034의 '완전히 둥근 배지' 규칙을 따릅니다.
- **상태**: 승인 (사용자 결정 2026-11-19: 'VD-044·045를 수정하고 정합성을 확인한 뒤 승인 상태로 기록하세요.'(버튼 radius.md, 시트·대화상자 radius.sheet, 알약은 기존 공통 규칙, 결과 배지 글자 color.text.accent))
- **근거**: 사용자 선택 EXP-V05-MIX(SCR-102 = V05-A), UXD-081, 4.1 (엔진 채택 후보 V04 VD-038–043·V05 VD-038–043을 병합·재번호, 사용자 결정 2026-11-19 'VD 정리안 승인')
- **관련**: SCR-102, CMP-001, CMP-022, CMP-026, CMP-046, radius.md, radius.sheet, color.bg.page, color.bg.surface, color.accent.subtle, color.text.accent, color.text.secondary, color.action.primary, color.action.onPrimary, color.status.danger.fg, font.size.caption, font.size.body, font.size.title, font.size.heading
- **토큰 밖 값**: 있음 — 아래 시트 위쪽 옅은 그림자(VD-024 그림자와 같은 방식, 04 `elevation.sheet`로 바꿀지는 Preview에서 확인), 알약 모서리(VD-034 공통 예외)

### VD-045: 화면 구성·시각 계층 — SCR-103 셸(V05-B 밴드·구획형)
- **결정**: (선택 시안 V05-B 계산값을 390×844에서 측정해 작성, 2026-11-19)
  - 상단 '스테이지 결과' 16px 700, 저장 중 표시(로더 아이콘 + 13px `color.text.secondary`, ST2)
  - 점수 구획(가운데 정렬): 과정·단계 13px `color.text.accent` → 점수 `font.size.display` 32px 700 + '/ 5' 18px `color.text.secondary` → 통과 배지(`color.status.success.bg`·`fg`, 체크, 28px) 또는 미통과 배지(`color.status.warning.*`, 되돌리기) → 기준 '5개 중 4개(70%)' 13px → (ST7) '통과까지 n점 남았어요' 16px 700 `color.status.warning.fg`
  - 구분선(`color.border.default` 60%) 구획: 최고 점수(가운데, 갱신 배지 `color.accent.subtle` 바탕 + `color.text.accent` 글자, VD-034 공통 알약) → 진행률 CMP-049 2개(VD-037) → 틀린 상황 CMP-030 48px 행(구분선, 종류 칩 danger·warning, '정답 위치 보기' 13px `color.text.accent` + 재생 아이콘)
  - 버튼 영역 화면 아래 고정(목록만 스크롤, 위 구분선): 큰 CTA 52px 22px 700(통과 '다음 스테이지', 미통과 '다시 하기'), 아래 줄 외곽선 버튼 + 보조 버튼 52px, 모서리 `radius.md`(SCR-102와 같은 버튼 모서리)
  - 저장 실패(ST4): CMP-023 danger 안내 상자(모서리 `radius.md`) + '다시 저장', 진행률 숨김
- **검증(시안 대조)**: 배치·크기·색·글자·위계는 V05-B 계산값(390×844 측정)과 일치합니다(버튼 모서리 `radius.md` 10px도 시안과 같음). 시안과 다르게 정한 2건: ① '최고 점수 갱신' 배지 글자는 시안에서 다른 규칙에 덮여 `color.text.secondary`로 보이지만 `color.text.accent`로 구현(사용자 결정) ② 안내 상자 모서리 12px → `radius.md`(토큰 정합). 통과·미통과 표시와 종류 칩은 VD-034와 같은 '완전히 둥근 알약' 모서리 표현(SCR-103 승인 컴포넌트에 CMP-005를 더하지 않음).
- **상태**: 승인 (사용자 결정 2026-11-19: 'VD-044·045를 수정하고 정합성을 확인한 뒤 승인 상태로 기록하세요.'(버튼 radius.md, 시트·대화상자 radius.sheet, 알약은 기존 공통 규칙, 결과 배지 글자 color.text.accent))
- **근거**: 사용자 선택 EXP-V05-MIX(SCR-103 = V05-B), UXD-083 (엔진 채택 후보 V04 VD-038–043·V05 VD-038–043을 병합·재번호, 사용자 결정 2026-11-19 'VD 정리안 승인')
- **관련**: SCR-103, CMP-001, CMP-023, CMP-026, CMP-030, CMP-049, color.text.accent, color.text.secondary, color.status.success.bg, color.status.success.fg, color.status.warning.bg, color.status.warning.fg, color.border.default, color.accent.subtle, radius.md, font.size.display, font.size.title, font.size.caption
- **토큰 밖 값**: 있음 — 알약 모서리(VD-034 공통 예외), 구분선 `color.border.default` 60%(토큰 색 혼합)

### VD-046: SCR-101 일러스트 자산(썸네일·과정 장식·배너 셔틀)
- **결정**: V04-A의 일러스트를 SCR-101에 씁니다(장식, `aria-hidden`).
  - 스테이지 썸네일 8개: AST-027(intro-1, r5 추가), AST-028(intro-2), AST-029(starter-1), AST-030(starter-2), AST-031(starter-3), AST-032(basic-1), AST-033(basic-2), AST-034(basic-3)
  - 과정 장식 3개: AST-035(입문자), AST-036(왕초급), AST-037(초급) — VD-032의 Lucide 과정 아이콘 대신
  - 배너 셔틀콕: AST-046 — VD-033 배너 오른쪽 장식
  - ~~intro-1 썸네일(AST-018, Claude 생성 SVG)은 권리 확인 전이라 이 VD에 포함하지 않습니다.~~ (r5, 사용자 결정 2026-11-19) AST-018은 쓰지 않고 intro-1 썸네일은 AST-027(같은 ChatGPT 생성 보드에서 자른 '코트와 번호 익히기' 그림)을 씁니다. 다른 7개와 색·그림체·구도가 같은 계열임을 확인했습니다(`design-explore/review/V05/thumbs-intro1-AST027.png`). 그림 내용은 셔틀 경로·목표 지점이며 번호 자체를 보여 주지는 않습니다.
  - 자산이 없어도 레이아웃은 유지됩니다(자산 없이 렌더한 측정 M20261119-020301-4d5c67 차단 0).
- **권리**: AST-027·028–037·046 모두 `explore-asset confirm` 기록(2026-11-19). 사용자 확인 사실 — (AST-027) "AST-027은 제가 ChatGPT에 직접 프롬프트를 입력해 생성한 동일한 이미지 보드에서 잘라낸 자산입니다." (AST-028–037·046) "AST-028–037 및 AST-046은 제가 ChatGPT에 직접 프롬프트를 입력하여 생성한 이미지입니다. AST-046은 ChatGPT 생성 원본에서 배경을 제거한 자산입니다." 권리 근거 — 사용자가 지정한 OpenAI 이용약관의 출력물 권리 조항(이번 세션에서 약관 원문은 다시 열람하지 못함, `design-profile/asset-rights-proposal-2026-11-19.md` 참조). AST-046의 레지스트리 출처는 `self_made` → `generated_tool`로 정정했습니다.
- **상태**: 승인 (사용자 결정 2026-11-19: '권리 확인이 완료된 자산만 VD-046에 연결합니다. 조건을 충족하면 VD-046을 승인하고 DD trace를 실행합니다.')
- **근거**: 사용자 선택 EXP-V04-A, CR-012, 사용자 결정 2026-11-19 'SCR-101의 일러스트 중심 디자인은 유지'
- **관련**: SCR-101, CMP-047, CMP-048, CMP-049, AST-027, AST-028, AST-029, AST-030, AST-031, AST-032, AST-033, AST-034, AST-035, AST-036, AST-037, AST-046
- **토큰 밖 값**: 없음

## 4. 정책 값

프로젝트가 정한 값입니다. 엔진 기본값은 없습니다. 아래 density는 승인 명세 구조(안내 줄 포함, 흰 헤더, 탭 56)로 **계산한 기준값**이며, 첫 렌더의 측정값과 차이가 나면 원인을 분석해 기록합니다(구조를 바꿔 맞추지 않음).

| 정책 | 값 | 근거 |
|---|---|---|
| density | SCR-211 첫 화면 회원 행(계산 기준): 390×844 ≥ 8.4, 430×932 ≥ 10.0, 360×800 ≥ 6.8(칩 두 줄). (r2) 1440×900(600px 열, 배치는 390과 같음) ≥ 8.4 | 원본 Figma 프레임 실측 구조(헤더 56 + 컨트롤 224, 탭 56 + 안전 영역 34). 1440은 높이가 더 커서 390 기준 이상이면 통과 |
| touch.min | 44px. 보이는 크기와 누름 영역을 구분(예: 칩 32/44) | 04 size.touch.min |
| safe_area | 하단 34px 가정(검증용), 실제는 `env(safe-area-inset-bottom)` | VD-020 |

### 4.1 (r4) DD 해결 항목: 흰 글자 대 주 행동 색 대비(결정 2026-11-19)

UX Spec r4(04 CMP-001·1.2)에 따라 큰 CTA(`variant=primary`·`size=lg`)는 22px 굵게로 큰 글자 기준 3:1을 충족합니다(#FFFFFF 대 #0B9E8B 3.35:1). 아래는 22px를 쓰기 어려워 **일반 글자 기준 4.5:1이 필요하고 현재 테마 값으로는 미달(3.35:1)**입니다. 해결 전에는 통과로 기록하지 않으며, DD 제출 전에 사용자가 방법을 정합니다.

| 대상 | 현재 | 필요 | 해결 후보(결정 전, 계산값) |
|---|---|---|---|
| CMP-001 `variant=primary`·`size=md`(44px), 목록·시트 안 작은 주 버튼(저장·확정·승인 등) | 흰 글자 16px 700 대 #0B9E8B 3.35:1 | 4.5:1 | (a) 작은 주 버튼은 흰 바탕 + `color.text.accent` 글자·테두리(5.42:1)로 표현 (b) 작은 주 버튼만 더 진한 배경(새 토큰 필요, ② UX Spec) (c) 작은 버튼 글자도 굵게 18.66px 이상(높이·폭 영향 검토) |
| CMP-002 SegmentedControl 선택 상태 | 흰 글자 대 Primary 채움이면 3.35:1 | 4.5:1 | (a) 선택 상태를 `color.accent.subtle` 바탕 + `color.text.accent` 글자(4.84:1) + 체크 아이콘 (b) 위 (b)와 같음 |
| 기타 Primary 채움 위 흰 글자(로그인 화면의 주 버튼 등). 카카오 버튼은 가이드 색이라 별개 | 3.35:1 | 4.5:1(큰 글자면 3:1) | 큰 CTA 규칙 적용 가능 여부를 화면별로 확인 |

- 포커스 링은 `color.focus.ring` #087F73(흰 바탕 4.89:1)으로 3:1을 충족합니다.

**결정(2026-11-19, 사용자)**: 원문 "큰 CTA: 기존 #0B9E8B 배경 + 흰색 22px Bold 유지 / 작은 Primary 버튼: 흰색 배경 + color.text.accent 글자 및 테두리 / SegmentedControl 선택 상태: color.accent.subtle 배경 + color.text.accent 글자 및 체크 아이콘" · "기존 UX Spec r4 토큰만 사용하고 새로운 토큰은 만들지 마세요." → 위 표의 (a)안들을 채택. 새 토큰 없음(④ 시각 표현, UX Spec 변경 없음).

| 대상 | 표현(토큰) | 대비 검증(실제 배경, 계산) | 판정 |
|---|---|---|---|
| 큰 CTA(CMP-001 `primary`·`lg`) | 배경 `color.action.primary` #0B9E8B, 글자 `color.action.onPrimary` 흰색 `font.size.heading` 22px 700 | 3.35:1 — 큰 글자 기준 3:1 | 충족 |
| 작은 주 버튼(CMP-001 `primary`·`md`, 목록·시트 안 저장·확정·승인 등) | 배경 흰색(#FFFFFF), 글자·테두리 1.5px `color.text.accent` #10776C, 글자 16px 700 | 글자 대 흰 5.42:1(4.5 충족). 테두리 대 페이지 5.36·surface 4.96·accent.subtle 4.84(3:1 충족) | 충족 |
| SegmentedControl 선택(CMP-002) | 선택 칸 배경 `color.accent.subtle`, 글자 `color.text.accent` 700, 체크 아이콘 `color.text.accent` | 글자 4.84:1(4.5 충족), 체크 4.84:1(3 충족). 선택 면 대 페이지 1.11:1로 색 차이는 약함 → **체크 아이콘과 굵은 글자를 반드시 함께 표시**(색만으로 구분 금지, 04 CMP-002 '색 + 굵은 글자 + 체크') | 충족(조건부) |
| 포커스 링(공통) | `color.focus.ring` #087F73 2px + 2px 간격 | 대 페이지 4.84·accent.subtle 4.37(3:1 충족) | 충족 |

- 렌더 검증: `design-explore/review/V04/dd41-contrast.png`(V04 토큰, 페이지·surface·연민트 바탕).
- 남은 확인(Preview에서): 작은 주 버튼이 `variant=secondary`와 구분되도록 secondary는 `color.border.strong` 테두리 + `color.text.primary` 글자로 둡니다. 눌림·비활성 상태 대비는 Preview 측정에서 확인합니다.
- V04-A(SCR-101)에는 해당 컴포넌트가 없어 시안 변경은 없습니다.

## 5. 렌더링 경로

- **렌더러**: code
- **최종 시각 승인**: `design-preview/` 트리 해시 + 06 문서(Figma는 검토용 렌더)
- Figma C안 프레임·컴포넌트는 참고 자료로만 둡니다(Starter 호출 한도로 중단, `docs/design-profile/figma.md`). Figma MCP는 쓰지 않습니다.

## 6. 렌더 범위(화면·상태)

적용 VD 열에는 **승인된 VD만** 적습니다.

(r2) **검증 폭**: 모든 행을 모바일 390px(390×844)과 데스크톱 1440px(1440×900)에서 렌더합니다. 1440에서는 가운데 정렬한 최대 600px 한 열, (r3) 열 바깥 `color.bg.surface`·열 그림자 `elevation.card`, 하단 탭·하단 시트가 390과 같은 배치인지 확인합니다(PC 전용 다단·옆 메뉴·옆 패널·가운데 대화상자 0). 프레임 이름은 `01` 6.3의 `mobile`·`desktop` 표기를 따릅니다.

| 화면 | 상태 | 적용 VD |
|---|---|---|
| SCR-211 | SCR-211-ST1 | VD-001, VD-002, VD-003, VD-004, VD-007, VD-008, VD-010, VD-019, VD-020, VD-021, VD-022, VD-023 |
| SCR-201 | SCR-201-ST1 | VD-001, VD-002, VD-003, VD-019, VD-020, VD-021, VD-022, VD-023 |
| SCR-212 | SCR-212-ST1, SCR-212-ST7 | VD-001, VD-002, VD-003, VD-004, VD-020, VD-021, VD-022, VD-023, VD-025 |
| SCR-213 | SCR-213-ST1, SCR-213-ST7 | VD-001, VD-002, VD-003, VD-020, VD-021, VD-022, VD-025 |
| SCR-202 | SCR-202-ST1, SCR-202-ST7 | VD-001, VD-002, VD-003, VD-004, VD-019, VD-020, VD-021, VD-022, VD-023, VD-024 |
| SCR-203 | SCR-203-ST1 | VD-001, VD-002, VD-003, VD-004, VD-008, VD-020, VD-021, VD-022, VD-025 |
| SCR-223 | SCR-223-ST7, SCR-223-ST8 | VD-001, VD-002, VD-003, VD-004, VD-019, VD-020, VD-021, VD-022, VD-023, VD-024 |

| SCR-101 | SCR-101-ST1, SCR-101-ST3, SCR-101-ST4, SCR-101-ST7 | VD-001, VD-002, VD-003, VD-004, VD-019, VD-020, VD-021, VD-022, VD-023, VD-024, VD-032, VD-033, VD-034, VD-035, VD-036, VD-038, VD-039, VD-040, VD-041, VD-042, VD-043, VD-046 |
| SCR-102 | SCR-102-ST1, SCR-102-ST7, SCR-102-ST8, SCR-102-ST9, SCR-102-ST10, SCR-102-ST11, SCR-102-ST12 | VD-001, VD-002, VD-003, VD-004, VD-020, VD-021, VD-026, VD-027, VD-028, VD-029, VD-030, VD-031, VD-038, VD-039, VD-040, VD-041, VD-042, VD-044 |
| SCR-103 | SCR-103-ST1, SCR-103-ST2, SCR-103-ST4, SCR-103-ST7 | VD-001, VD-002, VD-003, VD-004, VD-020, VD-021, VD-022, VD-023, VD-033, VD-037, VD-038, VD-039, VD-040, VD-041, VD-042, VD-045 |
| SCR-111 | SCR-111-ST1, SCR-111-ST3, SCR-111-ST4 | VD-001, VD-002, VD-003, VD-004, VD-019, VD-020, VD-021, VD-022, VD-023, VD-024, VD-038, VD-039, VD-040, VD-041, VD-042 |
| SCR-112 | SCR-112-ST1, SCR-112-ST3, SCR-112-ST7, SCR-112-ST8 | VD-001, VD-002, VD-003, VD-004, VD-019, VD-020, VD-021, VD-022, VD-023, VD-024, VD-038, VD-039, VD-040, VD-041, VD-042 |
| SCR-121 | SCR-121-ST1, SCR-121-ST3, SCR-121-ST7 | VD-001, VD-002, VD-003, VD-004, VD-019, VD-020, VD-021, VD-022, VD-023, VD-024, VD-038, VD-039, VD-040, VD-041, VD-042 |
| SCR-122 | SCR-122-ST1, SCR-122-ST4 | VD-001, VD-002, VD-003, VD-020, VD-021, VD-025, VD-038, VD-039, VD-040, VD-041, VD-042 |

- (r5, 사용자 결정 2026-11-19) SCR-101·102·103의 적용 VD를 승인된 VD로 갱신했습니다(r4 승인 VD-024·026–046). SCR-102-ST1은 6칸과 9칸을 각각 렌더합니다. 튜토리얼 화면은 390×844와 360×640(코드 기준 계산에서 칸이 가장 작은 일반 화면)에서 렌더합니다. 15칸은 렌더 범위가 아닙니다(시험 데이터만, AC-116).
  - SCR-102는 상황 재생(`mode=playing`, ST2 → ST1 사이, 상태 ID 없음) 화면도 함께 렌더해 학습용 격자·번호가 숨겨지는지 확인합니다(UXD-077 r6, CMP-046 r5).
  - SCR-103에 ST2(저장 중)·ST4(저장 실패)를 추가했습니다.
  - 테마 VD(VD-038–041)와 아이콘 VD-042는 공식 테마·패키지로 앱 전체에 적용되므로 새로 넣은 화면에도 적었습니다.
- (r5, 사용자 결정 2026-11-19 '핵심 탭 세 가지를 모두 포함') 청백전 SCR-111·112, 마이페이지 SCR-121·122를 추가했습니다. 상태는 02에 정의된 것만 씁니다. 청백전은 실제 회원이 모여 진행하는 경기·행사이며, SCR-112의 '관리 화면으로'(운영진 이상)는 이미 렌더 범위에 있는 SCR-223으로 이어집니다. 02에 없는 기능(회원용 청백전 일정·참여 신청, 마이페이지 별도 활동 내역)은 그리지 않습니다.
  - 카드: 튜토리얼 목록(CMP-048·050)은 VD-024 r4 개정안(옅은 그림자), 청백전·마이페이지 카드(CMP-041·042·043·045)는 VD-024 r3 표현(그림자 없음)입니다. 탭 사이 카드 표현 차이는 Preview에서 확인합니다.
- SCR-203 위에 SCR-213(두 번째 시트)을 연 상태를 함께 렌더해 중첩 시트(VD-025, 04 3.2)를 확인합니다.
- SCR-202-ST7·SCR-223-ST7·ST8은 카드(VD-024)와 하단 고정 행동 바(VD-020)를, SCR-223-ST8은 완화 사유·'미기록으로 되돌리기'(04 CMP-041 r2 상태)를 확인합니다.

## 7. UX Spec과의 차이와 변경 요청

분류는 엔진 `impact --design --request`(9d4d375) 결과입니다(2026-11-10 v2 모의 적용 복제본에서 실행, 요청 원문은 프로젝트 밖 임시 파일). conditional·needs_review였던 CR-004–007은 사용자 결정으로 확정했습니다. (r2) CR-001–003은 UX Spec r2에 반영되지 않아 종결했습니다.

### CR-001: SCR-211 카카오 가입 안내 줄 제거
- **분류**: ①
- **상태**: 기각(종결, r2 2026-11-13 사용자 결정: 기존 안내 줄 유지. UX Spec r2 02 SCR-211 정보 4·UXD-014대로. 재검토 예정 없음)
- **관련**: SCR-211, CMP-023, UXD-014

### CR-002: 모바일 '게스트 추가'를 헤더로
- **분류**: ①
- **상태**: 기각(종결, r2 2026-11-13 사용자 결정 D3: 게스트 추가는 PC·모바일 모두 오른쪽 아래. UXD-026 r6 정합성. 재검토 예정 없음)
- **관련**: SCR-211, CMP-001, UXD-026

### CR-003: C안 전용 의미 토큰 6개 추가(헤더 띠·선택 표시·현재 탭·비텍스트 강조)
- **분류**: ②
- **상태**: 기각(종결, r2 2026-11-13 사용자 결정: 전용 토큰 6개를 추가하지 않음. 04에 있는 토큰만으로 렌더. 재검토 예정 없음)
- **관련**: SCR-211, CMP-025, CMP-026

### CR-004: 헤더와 검색칸을 하나의 브랜드 띠로 묶음
- **분류**: conditional
- **상태**: 기각(현재 UX Spec 기준으로 거절: 02 SCR-211은 헤더 → 안내 줄 → 검색 순서이고, 띠 배경용 의미 토큰이 04에 없음. 사용자 결정 2026-11-11)
- **관련**: SCR-211, CMP-026

### CR-005: 하단 탭 높이 64(04 CMP-025 '56px')
- **분류**: conditional
- **상태**: 기각(56 유지: 04 CMP-025 '탭 높이 56px'. 사용자 결정 2026-11-11)
- **관련**: CMP-025

### CR-006: 명단 행 점수를 오른쪽 열로(표기 변경)
- **분류**: needs_review
- **상태**: 기각(UXD-074 단일 행 표기 유지, VD-007. 사용자 결정 2026-11-11)
- **관련**: SCR-211, CMP-024, UXD-074

### CR-007: 하단 탭 아이콘 추가
- **분류**: ④
- **상태**: 반영(VD-019 — 탭 이름·순서·레이블·행동을 유지하는 시각 표현으로 확정. 사용자 결정 2026-11-11, 원래 분류 conditional)
- **관련**: CMP-025

### CR-008: 주 행동 색·포커스 링 청록, 기본 글꼴 Pretendard
- **분류**: ③
- **상태**: 반영(테마 파일 `docs/design-profile/theme.json`, VD-001)
- **관련**: CMP-001

### CR-009: 헤더 '게스트 추가' 보이는 높이 36(CMP-001은 44/48)
- **분류**: ④
- **상태**: 기각(해당 없음: CR-002 종결로 헤더 '게스트 추가'가 없음. 오른쪽 아래 버튼은 CMP-001 lg 48)
- **관련**: CMP-001

### CR-010: 칩·탭 표시 반경 16, 헤더 버튼 반경 18(토큰 밖 값)
- **분류**: ④
- **상태**: 반영(VD-010 — 칩은 `radius.md`. 헤더 버튼은 CR-002 종결로 해당 없음, 탭 둘레 표시는 VD-019에서 쓰지 않음. 사용자 결정 2026-11-11)
- **관련**: CMP-004, CMP-025

### CR-011: 연한 민트 보조 면(배너·배지·썸네일·이어서 하기 카드) *(r4, 확정 2026-11-19 — UX Spec r4 반영·승인)*
- **분류**: conditional(A안 ② 토큰 의미·이름 / B안 ③ 테마 값 / C안 해당 없음)
- **요청**: REF-001의 연민트 보조 면(RX-001-03, 약 #DFF4EE)을 튜토리얼 목록에 씁니다. 04에는 이 의미의 토큰이 없습니다. `color.bg.surface`는 회색 #F4F5F7, `color.status.success.bg`는 '성공' 의미, 테마 원시 색 teal-50(#DFF5F1)은 연결된 토큰이 없습니다.
- **선택지와 영향**
  - **A. 새 의미 토큰 추가**(예: `color.accent.subtle` = teal-50) → ② 토큰 의미·이름
    - **승인된 UX Spec r3를 다시 열어 04에 토큰을 추가하고 다시 승인해야 합니다.** v2 규칙상 Design Direction·Preview도 다시 승인합니다.
    - 의미가 가장 분명합니다.
  - **B. 기존 토큰 `color.status.info.bg`의 테마 값을 teal-50으로 바꿈** → ③ 테마 값
    - 테마 파일이 있으므로 Preview만 다시 승인하고, UX Spec·Design Direction은 보존됩니다.
    - 부작용: 앱 전체의 정보 안내 상자(CMP-023 info) 배경이 파랑 → 민트로 바뀝니다. `color.team.blue.bg`는 별도 토큰이라 청팀 표시는 그대로입니다.
    - '정보 안내 면'을 '정보성 보조 면'으로 넓게 읽는 해석이 필요합니다.
  - **C. 새 색 없이 기존 토큰만 사용**: 배지·썸네일은 `color.bg.surface`(회색), 배너는 단색 회색 면입니다. 재승인은 없지만 참고 이미지와의 일치도가 크게 떨어집니다.
- **권장**: ~~B. 재승인 비용이 가장 작고(Preview만), 승인 테마(Teal Mint)와 어울립니다.~~ (2026-11-18) 사용자는 **A안 선호**를 밝혔습니다: "기존 `color.status.info.bg`를 민트색으로 변경해 앱 전체 정보 안내 UI의 의미와 표현이 달라지는 방식은 원하지 않습니다." 영향 분석을 마칠 때까지 확정하지 않습니다.
- **영향 분석(엔진 `impact --design --request`, 읽기 전용, 2026-11-18)**
  - A안: '② 토큰 의미·이름'으로 분류됩니다(근거: 04 토큰 목록에 없음). **UX Spec 재승인이 필수**이며 공식 절차는 `reopen --stage ux_spec`입니다.
  - B안: '③ 테마 값'으로 분류되고 재승인이 없습니다.
- **A안 공식 절차와 영향**
  1. `reopen --stage ux_spec` 사용자 확인
     - UX Spec r3 승인이 `last_approved`로 이동합니다.
     - 진행 중인 Design Direction r4는 `locked`가 되고 작성 완료 기록이 초기화됩니다. 07 파일, 시안, 참고 이미지 기록은 지워지지 않습니다.
     - Preview는 이미 `locked`입니다.
  2. UX Spec r4 수정: 실제 내용 변경은 **04 1.2 색 표에 `color.accent.subtle` 행 하나와 사용처**(CMP-005 배지, CMP-047 썸네일 바탕, CMP-048, CMP-050)뿐입니다. 05에는 개정 기록만 남깁니다. 01–05가 revision을 함께 쓰므로 다섯 문서의 front matter가 4로 올라갑니다.
  3. 구조 확인 다시 받기: 구조 확인 기록이 revision 3 기준이라, 제출하려면 구조가 바뀌지 않았다는 확인을 다시 받아야 합니다.
  4. UX Spec r4 제출 → 사용자 승인
  5. Design Direction r4 재개(`begin`): 07을 다시 작성 완료로 기록하고, 테마에 `color.accent.subtle`(teal-50) 값을 넣습니다.
- **권장 순서**: 시안 선택을 먼저 받고, 그 결과 새 토큰이 더 필요한지 확인한 뒤 UX Spec을 **한 번만** 다시 엽니다. 시안에서는 `color.accent.subtle`을 후보 테마의 임시 값으로만 씁니다. 엔진이 04 밖 토큰으로 경고(`token_needs_cr`)하며 공식 테마에는 들어가지 않습니다.
- **대비(계산)**: Teal 글자 대 teal-50 5.45:1, 보조 글자 대 teal-50 6.10:1
- **상태**: 반영(2026-11-19 확정 — UX Spec r4 승인. 이전 상태 '미결(사용자 A안 선호)'에서 변경): A안을 토큰 3개로 넓혀 UX Spec r4에 반영했고, UX Spec r4가 승인되었습니다(사용자 원문 "UX Spec revision 4를 승인합니다."). 결정 원문: "CR-011은 신규 토큰 3개를 UX Spec r4에 반영하는 방향으로 확정합니다." / "강조 글자색은 Primary에서 계산하는 방식이 아니라 별도 의미 토큰으로 분리합니다."
- **최종 값(2026-11-19 확정)**

  | 토큰 | 값 | 분류 | 용도(04 r4) | 대비 |
  |---|---|---|---|---|
  | `color.accent.subtle` | #DDF8EF | ② 새 토큰 | 강조 보조 면(배지·썸네일 바탕·과정 배지·배너) | 본문 15.07:1, 강조 글자 4.84:1 |
  | `color.accent.mint` | #8EE3CC | ② 새 토큰 | 배너 그라데이션 장식 면 전용 | 장식용 |
  | `color.text.accent` | #10776C | ② 새 토큰 | 강조 글자(링크·머리글·선택 탭 글자·배지 글자) | 흰 5.42:1, page 5.36:1, subtle 4.84:1 |
  | `color.action.primary` | #0B9E8B | ③ 테마 값 | 채움·아이콘, 주 버튼 배경 | 흰 바탕 3.35:1(비텍스트 충족), 흰 글자는 큰 CTA(22px 굵게)만 충족 — 4.1 |
  | `color.focus.ring` | #087F73 | ③ 테마 값 | 키보드 포커스 링 | 흰 바탕 4.89:1 |
  | `color.bg.page` | #FAFFFD | ③ 테마 값 | 페이지 배경 | 본문 16.71:1 |
  | `color.action.onPrimary` | #FFFFFF(변경 없음) | - | 주 버튼 글자 | 4.1 참고 |

- **테마 반영 방법**: 위 ③ 값과 ② 새 토큰 값은 시안 V04-A의 후보 테마에 들어 있습니다. 공식 테마 `docs/design-profile/theme.json`은 `explore-choose` → `explore-adopt`(후보 VD·후보 테마 생성) → VD 승인 순서로 반영하며, 지금 직접 고치지 않았습니다. Preview는 다시 승인합니다.
- **(2026-11-19) 사용자 결정 기록 — 아직 UX Spec 미반영(reopen 전)**
  - 원문: "CR-011은 다음 신규 토큰 2개를 UX Spec r4에 반영하는 방향에 동의합니다. - color.accent.subtle: #DDF8EF - color.accent.mint: #8EE3CC" / "Primary 색상은 A안 `#0B9E8B`로 결정하겠습니다." / "`color.bg.page`: #FAFFFD 유지"
  - ② 새 토큰(UX Spec r4 재개정 대상): `color.accent.subtle` #DDF8EF(배지·썸네일 바탕·이어서 하기 재생 아이콘 주변·배너), `color.accent.mint` #8EE3CC(배너 그라데이션). A안 범위를 토큰 1개 → 2개로 넓힘.
  - ③ 테마 값(Preview 재승인): `color.action.primary` #0B9E8B, `color.bg.page` #FAFFFD, `color.focus.ring` #087F73(사용자가 허용한 별도 유지 — #0B9E8B는 흰 바탕 3.35:1로 포커스 표시 3:1은 넘지만 여유가 작아 더 진한 값 유지).
  - 접근성: #0B9E8B는 13px 강조 글자 기준(4.5:1) 미달(흰 3.35·연민트 2.99). 시안은 글자만 primary 70%+`color.text.primary` 혼합(≈#10776C, 흰 5.42·연민트 4.84)으로 분리. **이 글자색을 04 토큰(예: `color.text.accent`, ②)으로 둘지, 파생 규칙으로 둘지는 UX Spec r4에서 결정 필요(미결).**
  - 비교 근거: `design-explore/review/V04/primary390.png`·`primary360.png`·`primary-zoom.png`, 이전 값 보존본 `design-explore/review/V04/snapshots/V04-A_primary-087F73/`
- **관련**: SCR-101, CMP-005, CMP-048, CMP-050, color.status.info.bg, color.bg.surface, VD-033, VD-034, VD-035, VD-036

### CR-012: 스테이지 썸네일·배너 장식 그림 *(r4, 재결정 2026-11-19 — C안 계열)*
- **분류**: ④
- **요청**: REF-001의 스테이지별 작은 일러스트(RX-001-11)와 배너 셔틀콕 그림(RX-001-18)을 반영합니다. 원본 그림은 쓰지 않습니다(excluded icon_asset).
- **선택지**
  - **A. 미니 코트 썸네일**: 그 스테이지 첫 상황을 기존 코트 그림(CMP-046)으로 작게 그립니다. 새 자산이 없고 학습 내용과 바로 연결됩니다. 배너 장식은 단순한 선 그림 셔틀콕(SVG)을 새로 그려 자산 계약(`explore-asset`)에 등록합니다.
  - **B. 아이콘 썸네일**: Lucide 아이콘(VD-002)을 연민트 바탕 위에 둡니다. 가장 단순하지만 참고 이미지보다 밋밋합니다.
  - **C. 새 일러스트 세트**: 8개 스테이지와 배너용 그림을 새로 그려 자산 계약으로 관리합니다. 일치도는 가장 높지만 제작 부담이 큽니다.
- **분류**: 장식 그림(`aria-hidden`)이면 ④ 시각 표현으로, Design Direction에서 결정합니다. 그림이 정보를 전달하면 ① 정보이고 UX Spec 변경입니다. A안 썸네일은 장식으로 둡니다(정보는 행 글자에 있음).
- **권장**: A
- **상태**: 반영(2026-11-19 C안 계열로 재결정 — 아래 '재결정'·자산 사용 정책. 공식 채택은 자산 권리 확인 후). ~~결정(2026-11-18, 사용자: A안).~~ 이전 원문: "A안인 기존 코트를 활용한 미니 코트 썸네일을 선택합니다. 각 스테이지의 학습 목표가 다르게 보이도록 선수 위치, 이동 방향, 동선 등을 다르게 구성하세요. 기존 TutorialCourt SVG의 축소 표현을 우선 활용하고, 불필요한 신규 일러스트 자산 제작은 하지 마세요. 배너의 셔틀콕 장식은 간결한 벡터 형태로 표현하세요. 장식 이미지는 접근성 트리에서 제외하고, 핵심 학습 정보는 텍스트로 제공하세요."
- **반영**:
  - 썸네일: CMP-046 축소 표현(내 편 반 코트, 격자·번호 없음, `aria-hidden`)으로 그립니다. 스테이지마다 선수 배치·이동 화살표가 다르게 보이도록 그 스테이지의 대표 상황 데이터를 씁니다.
  - 배너 셔틀콕: 단색 선 그림 벡터 하나입니다(`color.action.primary` 선, 장식, `aria-hidden`).
  - 분류는 장식이라 ④입니다.
- **(2026-11-19) 재결정 방향(사용자 동의, 07 공식 갱신은 DD 재개 시)**: 원문 "CR-012는 신규 일러스트 자산 사용을 허용하는 C안 계열로 변경하는 방향에 동의합니다." → 시안 V04-A 기준: 썸네일 AST-018(intro-1 번호 격자)·AST-028–034, 과정 장식 AST-035–037, 배너 셔틀콕 AST-026(새 원본 제공 예정). 모두 장식(`aria-hidden`)이라 ④ 유지. 자산 권리 확인 전에는 공식 채택 불가.
- **재결정(2026-11-19)**: ~~A안~~ → **C안 계열(등록·관리되는 일러스트 자산 사용)**. 사용자 원문: "CR-012는 C안 계열로 재결정합니다. 새 일러스트 자산 사용을 허용하되 자산별 출처, 생성 방식, 가공 이력, 권리 확인 상태, 사용처를 관리하는 정책으로 정리하세요." 위 2026-11-18 A안 결정·반영 문장은 이 재결정으로 대체되어 기준으로 쓰지 않습니다.
- **분류**: ④ 유지(장식 그림, `aria-hidden`, 정보는 글자로 제공)
- **자산 사용 정책**
  1. 화면에는 `design-profile/assets.json`에 등록된 자산만 씁니다(시안은 라운드 사본 `_assets/`). 원본 제공 자료는 `design-profile/sources/`에 변경 없이 보존합니다(Git 제외).
  2. 자산마다 다음을 기록합니다: 자산 ID, 파일 경로·해시, 원본 자료, **생성 방식**(모델 제작·생성 도구·라이선스 아이콘 등), **가공 이력**(크롭·배경 제거·크기 조정과 스크립트), **권리 확인 상태**, **사용처**(화면·컴포넌트). 사람이 읽는 요약은 `design-profile/asset-catalog-2026-11-19.md`.
  3. **권리 확인 전 자산은 탐색 전용**입니다. 공식 채택(VD 승인)·Preview·제품 반영 전에 사용자 확인 문장과 라이선스를 `explore-asset confirm`으로 기록합니다. 파일을 바꾸면 확인이 초기화됩니다.
  4. 상태·점수 같은 동적 정보는 이미지에 넣지 않고 UI 글자·배지로 표시합니다. 그림 속 글자는 쓰지 않습니다.
  5. 장식 일러스트는 버튼·탭 아이콘으로 쓰지 않습니다. 누를 수 있는 UI 아이콘은 VD-002(Lucide)를 유지합니다.
  6. 레퍼런스(REF-001) 원본·조각은 자산으로 쓰지 않습니다(`reference_derived` 금지).
- **V04-A 사용 자산과 권리 상태(2026-11-19, 모두 미확인 → 탐색 전용)**

  | 자산 | 사용처 | 생성 방식 | 엔진 등록(출처·라이선스) | 확인 준비 상태 |
  |---|---|---|---|---|
  | AST-001·014·015·016 | 하단 탭 아이콘(VD-019) | Lucide v1.70.0 | licensed·ISC | ISC 확인됨(저작권 고지 유지 조건) — 사용자 확인 문장 대기 |
  | AST-018 | intro-1 썸네일 | Claude가 프로젝트 작업 중 작성한 SVG | model_drawn·unknown | 조직의 Anthropic 계약 조항 미확인 → 라이선스 보류 |
  | AST-028–034 | 스테이지 썸네일 7종 | 사용자가 ChatGPT 이미지 생성으로 만든 보드에서 크롭 | generated_tool·unknown | OpenAI 이용약관(출력물 사용자 소유·권리 양도, 법이 허용하는 범위) 확인. 계정 유형별 적용 약관 미확인 |
  | AST-035–037 | 과정 장식 | 위 보드에서 배경 제거 | generated_tool·unknown | 위와 같음 |
  | AST-046 | 배너 셔틀콕 | 사용자가 ChatGPT로 생성한 이미지에서 배경 제거 | **self_made**·unknown(실제는 생성 도구 — 확인 문장에 이력 명시, A안) | 위와 같음 |

  확인 문장 제안: `design-profile/asset-rights-proposal-2026-11-19.md`
- **관련**: CMP-047, CMP-046, SCR-101, VD-033, VD-036, VD-002, VD-019

### CR-013: 카드 테두리를 더 옅게 *(r4, 선택)*
- **분류**: ③
- **요청**: REF-001 카드 테두리(RX-001-05, 약 #E3E8E7)는 현재 `color.border.default`(#D5D9E0)보다 옅습니다.
- **선택지**: A. 테마에서 `color.border.default` 값을 옅게(③ 테마 값, Preview만 재승인, 앱 전체 구분선이 옅어짐) / B. 그대로 유지
- **권장**: B. 이미 장식용 1.42:1이라 더 옅으면 구분이 약해지고, 차이가 작습니다.
- **상태**: 기각(2026-11-18, 사용자: B안 — 기존 테두리 토큰 유지). 원문: "카드의 여백, 둥근 모서리, 정보 배치로 참고 이미지와 유사한 분위기를 만드세요."
- **관련**: color.border.default, VD-024

### (r4 재개 2) UX Spec r5 정합 메모(변경 요청 아님)
- **AC-090(전제)·AC-111(결과)**: "내 편 반 코트에 번호 격자가 보입니다"는 **선택 단계(셔틀이 멈춘 뒤, 입문자는 처음부터)** 에 격자가 보인다는 뜻으로 해석합니다. 상황 재생 중 숨김(UXD-077 r6, CMP-046 r5)은 이 의미와 충돌하지 않습니다(UXD-077 r6 근거에 같은 해석 기록). AC 문구는 바꾸지 않습니다.
- **UXD-081 유지**: SCR-102 아래 영역은 단계가 바뀌어도 높이를 고정합니다(V05-A 160px). 판정 전후 높이를 다르게 쓰는 안은 코트 크기가 흔들려 채택하지 않았습니다(사용자 결정 2026-11-19).

## 8. 실험 허용 목록

승인 명세와 달라도 되는 실험 항목입니다(실험 산출물은 승인 대상이 아님). (r2) CR-001–006이 모두 종결되어 아래 실험은 결정 기록의 근거로만 남습니다. 정식 렌더 근거로 쓰는 것은 `experiments/c-preview-poc/review/`의 측정값(VD-008·010·020)뿐입니다.

| 항목 | 범위 | 근거 |
|---|---|---|
| 안내 배너 제거, '게스트 추가' 상단, 브랜드 띠 헤더, C안 전용 토큰, 점수 오른쪽 열, 탭 64 | `experiments/c-preview-poc/`만 | 사용자 실험 허용(2026-11-10). 정식 렌더에서는 CR-001–006 거절·종결 |
| Figma C안 프레임·컴포넌트 | Figma 파일 `gqwivlIXG9u8WoPpHIQWdQ`의 C안 섹션 | 실험 산출물 |

## 9. 검증 기준과 도구 제약

- **검증 기준**: 글자 대비 4.5:1(큰 글자 3:1), 비텍스트 3:1, 고정 요소 가림·포커스 가림 0(오른쪽 아래 '게스트 추가'와 행 정보, 하단 고정 행동 바, 시트 하단 버튼 포함), 누름 영역 44, 부품 내부 넘침 0, 토큰 밖 색 0(VD-025 딤 불투명도는 기록된 예외), 콘솔 오류 0, 행 수는 4장 density(측정값으로 판정, PoC `review.mjs` 방식). (r2) 1440px에서 콘텐츠 폭 ≤ 600px, 열 바깥에 콘텐츠·메뉴·버튼 0, 옆 패널·가운데 대화상자 0, 중첩 시트에서 닫기 1회에 시트 1개만 닫힘
- **(r4 재개 2) Preview 재검증 항목(사용자 결정 2026-11-19)**: 360×560(인앱 가정) 화면에서 코트 번호 11.5px는 9칸 확인 단계 전환(UXD-078)을 전제로 조건부 수용. Preview 실기기에서 작은 화면 번호 가독성을 다시 확인합니다.
- **(r4 재개 2) 튜토리얼 코트 검증 항목**: 번호 글자 대 번호 원 4.5:1 이상, 셔틀 방향 고리·동선 외곽선 대 판정 채움 3:1 이상, 선수 이름 대 받침 4.5:1 이상, 9칸 누름 영역 44px 이상(미만이면 UXD-078 확인 단계), 아래 영역 넘침·버튼 글자 잘림 0, 재생 중 격자 선·번호 0. **15칸(`grid-5x3`, AC-116)**: 시험 데이터로 렌더링해 번호와 코트 라인(단식 사이드라인 x 4.6·56.4, 센터 라인 x 30.5) 겹침을 확인하고 위치 값을 정합니다.
- **도구 제약**: Figma Starter(페이지 3, 변수 모드 1, MCP 월 호출 한도 도달) → Figma 호출 안 함. Playwright 스크린샷은 Claude Code 샌드박스에서 CDP 캡처로 대체. shadcn/ui CLI 4.23.0(`radix-nova`, `init` 대신 `add`만). 프리뷰는 `@/` 별칭 금지(상대 경로)
