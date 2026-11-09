---
doc: ui-system
revision: 1
language: ko
based_on:
  planning_revision: 3
  ux_planning_revision: 1
---

# UI 컴포넌트와 디자인 토큰 (UI System): 배드민턴 플레이북 (badminton-playbook)

`02-screens.md`에서 **실제로 반복해 쓰인 것만** 컴포넌트로 정의합니다. 특정 디자인 시스템이나 도구에 묶이지 않으며(CLAUDE.md), 이름은 `01` 6장의 명명 규칙을 따라 Figma Variables·컴포넌트와 CSS 변수에 그대로 옮길 수 있게 둡니다.
값은 시각 디자인 단계(UI Preview)에서 바뀔 수 있는 초기값입니다. 토큰 값 변경은 UX 설계 변경으로 처리합니다(`reference/preview.md`).

## 1. 디자인 토큰

### 1.1 명명과 대응 규칙

| 층 | 형식 | 예 |
|---|---|---|
| 토큰 이름(문서·Figma Variables) | `분류.역할.변형` | `color.team.blue.bg` |
| CSS 변수(React) | `--분류-역할-변형` | `--color-team-blue-bg` |
| Figma Variables 컬렉션 | 분류 이름(`color`, `space`, `radius`, `font`, `size`, `motion`, `elevation`) | 컬렉션 `color` / 변수 `team/blue/bg` |
| 모드 | MVP는 `light` 하나. 다크 모드는 범위 밖 | - |

- 컴포넌트에는 원시 색값을 직접 쓰지 않고 역할 토큰만 씁니다.
- 대비 수치는 아래 값으로 계산한 WCAG 대비비입니다(2026-11-09 계산).

### 1.2 색

| 토큰 | 값 | 용도 | 대비 |
|---|---|---|---|
| color.bg.page | #FFFFFF | 페이지 배경 | - |
| color.bg.surface | #F4F5F7 | 카드 안 구역, 목록 묶음 머리, 스켈레톤 | - |
| color.text.primary | #1A1D23 | 본문·제목 | 16.88:1(page), 15.48:1(surface) |
| color.text.secondary | #545A65 | 보조 정보(성별·급수·시각) | 6.94:1(page), 6.36:1(surface) |
| color.text.disabled | #6B7280 | 비활성 글자·사유 | 4.43:1(surface) · 비활성 요소라 기준 예외지만 사유 글자는 page 배경(4.83:1)에 둠 |
| color.border.default | #D5D9E0 | 장식 구분선(카드 경계 보조) | 1.42:1 · 장식용만 |
| color.border.strong | #6B7280 | 입력칸·체크박스·보조 버튼 테두리, 백팀 표식 | 4.83:1 |
| color.action.primary | #1D5BD0 | 주 버튼 배경, 링크, 선택 상태 | 6.07:1 |
| color.action.onPrimary | #FFFFFF | 주 버튼 글자 | 6.07:1 |
| color.focus.ring | #1D5BD0 | 키보드 포커스 링(2px + 2px 간격) | 6.07:1 |
| color.status.danger.fg | #B3261E | 오류 글자, 위험 버튼 | 6.54:1(page), 5.52:1(danger.bg) |
| color.status.danger.bg | #FDE7E5 | 오류 안내 상자 배경 | - |
| color.status.warning.fg | #7A4F00 | 경고 글자(규칙 완화, 점수 미설정) | 6.45:1(warning.bg) |
| color.status.warning.bg | #FFF3D1 | 경고 안내 상자·배지 배경 | - |
| color.status.success.fg | #1B6E35 | 통과·승·완료 | 6.31:1(page), 5.53:1(success.bg) |
| color.status.success.bg | #E4F4E8 | 성공 안내 상자·배지 배경 | - |
| color.status.info.bg | #E3ECFC | 정보 안내 상자 배경 | - |
| color.team.blue.fg | #1747A6 | 청팀 글자 | 7.10:1(team.blue.bg) |
| color.team.blue.bg | #E3ECFC | 청팀 띠·배지 배경 | - |
| color.team.white.fg | #1A1D23 | 백팀 글자 | 16.88:1 |
| color.team.white.bg | #FFFFFF | 백팀 배지 배경(테두리 color.border.strong 필수) | 테두리 4.83:1 |
| color.brand.kakao.bg | #FEE500 | 카카오 로그인 버튼 | - |
| color.brand.kakao.fg | #191919 | 카카오 버튼 글자 | 13.75:1 |
| color.court.surface | #2F7D4F | 튜토리얼 코트 바닥 | 라인 5.04:1 |
| color.court.line | #FFFFFF | 코트 라인·네트 | 5.04:1 |
| color.court.me | #1D5BD0 | 내 선수(흰 글자 표식) | 6.07:1 |
| color.court.opponent | #F2C14E | 상대 선수(진한 글자 표식) | 10.06:1 |

- 개인전의 '1팀 / 2팀'은 팀 색을 쓰지 않고 글자 레이블만 씁니다(청·백 팀전과 혼동 방지, C-24).
- 카카오 버튼 색·문구는 카카오 로그인 버튼 가이드를 따르며 위 값은 가이드 확인 후 확정합니다.

### 1.3 간격·모양·글자·크기

| 토큰 | 값 | 용도 |
|---|---|---|
| space.1 / 2 / 3 / 4 / 5 / 6 / 8 | 4 / 8 / 12 / 16 / 20 / 24 / 32px | 4px 단위 간격 |
| space.gutter.mobile | 16px | 모바일 좌우 여백 |
| space.gutter.desktop | 24px | PC 좌우 여백 |
| radius.sm | 6px | 배지·칩 |
| radius.md | 10px | 버튼·입력·카드 |
| radius.sheet | 16px | 하단 시트 위쪽 모서리 |
| font.family.base | 시스템 기본 sans-serif 글꼴 스택(웹 글꼴 도입 여부는 시각 디자인 단계에서 결정) | 본문 |
| font.size.caption / body / title / heading / display | 13 / 16 / 18 / 22 / 32px | 보조·본문(모바일 최소 16px)·카드 제목·화면 제목·결과 점수 |
| font.weight.regular / bold | 400 / 700 | |
| font.lineHeight.body | 1.5 | 본문 |
| size.touch.min | 44px | 터치 영역 최소(주요 버튼 48px, 튜토리얼 선택 버튼 56px) |
| size.content.member | 480px | 회원 화면 최대 너비(NFR-002, ASM-017) |
| size.panel.side | 400px | PC 옆 패널 너비 |
| size.nav.side | 240px | PC 왼쪽 메뉴 너비 |
| size.content.ops.max | 1200px | 운영 화면 가운데 영역 최대 너비 |
| elevation.sheet | 0 -4px 16px rgba(0,0,0,0.16) | 시트·옆 패널 |
| elevation.card | 0 1px 3px rgba(0,0,0,0.12) | 카드 |

### 1.4 움직임

| 토큰 | 값 | 용도 |
|---|---|---|
| motion.duration.fast | 150ms | 버튼·칩 상태 변화 |
| motion.duration.base | 250ms | 시트 열기·닫기 |
| motion.tutorial.speed.normal | 1.0 | 튜토리얼 애니메이션 기본 속도 |
| motion.tutorial.speed.slow | 0.5 | '느리게 보기'(UXD-069) |
| motion.reduced | `prefers-reduced-motion: reduce`이면 시트 전환은 즉시, 튜토리얼은 결과 위치를 바로 표시 | WCAG 2.3.3 |

### 1.5 반응형 기준점(모바일 우선)

| 토큰 | 값 | 회원 화면(SCR-0xx·1xx) | 운영 화면(SCR-2xx) |
|---|---|---|---|
| breakpoint.base | 0–767px | 한 열, 하단 탭 | 한 열, 하단 탭, 시트는 하단 시트, 주요 행동은 하단 고정 바 |
| breakpoint.tablet | 768–1023px | 한 열, 가운데 480px | 한 열(최대 720px), 하단 탭, 패널은 하단 시트 |
| breakpoint.desktop | ≥1024px | 가운데 480px, 하단 탭 대신 왼쪽 메뉴 | 왼쪽 메뉴 + 가운데(최대 1200px) + 오른쪽 옆 패널(400px), 카드 2열, 행동 버튼은 위쪽 오른쪽 |

- 설계 기준 폭은 360px(가장 좁은 폭)과 390px이며, 200% 확대에서도 가로 스크롤이 생기지 않게 합니다(WCAG 1.4.10).
- 회원 화면은 어떤 폭에서도 480px를 넘지 않습니다(NFR-002). 넓은 배치는 운영 화면에만 씁니다.

## 2. 컴포넌트

번호 대역: CMP-001–019 기본 요소, CMP-021–039 공통 패턴, CMP-041– 도메인 컴포넌트(`01` 6.4). Figma 컴포넌트 이름은 `CMP-### 영문이름`, 변형은 variant 속성으로 둡니다.

### CMP-001: Button
- **용도**: 화면·시트의 행동(가입 신청, 대진 생성, 확정, 저장, 승인 등)
- **변형**: `variant=primary|secondary|danger|text|kakao`, `size=md(44px)|lg(48px)`, `fullWidth`
- **상태**: 기본, 눌림, 비활성(사유 문구를 근처에 표시), 로딩(진행 표시·중복 제출 막기)
- **사용 화면**: SCR-001, SCR-002, SCR-003, SCR-004, SCR-005, SCR-102, SCR-103, SCR-121, SCR-122, SCR-202, SCR-203, SCR-211, SCR-212, SCR-213, SCR-221, SCR-222, SCR-223, SCR-226, SCR-231, SCR-232
- **접근성**: 버튼 글자가 곧 레이블, 비활성 사유는 `aria-describedby`, 포커스 링 color.focus.ring

### CMP-002: SegmentedControl
- **용도**: 2–3개 중 하나 고르기(남·여, 개인전·팀전, 레벨별·무작위, 청·백·불참)
- **변형**: `options=2|3`, `size=md|sm`(목록 행 안은 sm, 최소 44px 유지)
- **상태**: 기본, 선택됨(색 + 굵은 글자 + 체크), 비활성(잠금 사유 표시)
- **사용 화면**: SCR-002, SCR-122, SCR-204, SCR-212, SCR-213, SCR-222, SCR-223, SCR-224
- **접근성**: `role="radiogroup"`, 방향키 이동

### CMP-003: ChoiceGrid
- **용도**: 여러 값 중 하나를 버튼 격자로 고르기(급수 8개 4×2, 점수 1–10 5×2)
- **변형**: `kind=grade(4열)|score(5열)`, `allowClear`(점수 미설정으로 되돌리기)
- **상태**: 기본, 선택됨, 오류(그리드 아래 오류 문구), 저장 중(누른 칸만)
- **사용 화면**: SCR-002, SCR-122, SCR-212, SCR-213, SCR-214
- **접근성**: `role="radiogroup"` + 그룹 레이블('급수', '점수'), 칸 최소 44×44px

### CMP-004: FilterChip
- **용도**: 목록 필터('점수 미설정 N명', '튜토리얼 권장 · 미통과 N명')
- **변형**: `count`(0이면 숨김)
- **상태**: 기본, 켜짐, 숨김
- **사용 화면**: SCR-211
- **접근성**: `aria-pressed`, 숫자를 포함한 레이블

### CMP-005: Badge
- **용도**: 짧은 상태·구분 표시(방식, 청백전 상태, 팀, 미설정, 게스트, 비활성, 변경됨, 귀가, 출전, 규칙 완화, 역할, 대기 건수)
- **변형**: `tone=neutral|info|warning|danger|success|teamBlue|teamWhite`, `shape=label|count`
- **상태**: 기본(정적)
- **사용 화면**: SCR-111, SCR-112, SCR-201, SCR-202, SCR-205, SCR-211, SCR-212, SCR-221, SCR-223, SCR-224, SCR-225, SCR-232
- **접근성**: 항상 글자 포함(색만으로 구분하지 않음, WCAG 1.4.1). 누를 수 있는 배지(규칙 완화)는 버튼 역할

### CMP-006: TextField
- **용도**: 한 줄 입력(이름, 지인, 날짜, 총 경기 수), 이름 검색
- **변형**: `type=text|search|date|number`
- **상태**: 기본, 포커스, 오류(아래 오류 문구), 비활성
- **사용 화면**: SCR-002, SCR-122, SCR-203, SCR-211, SCR-212, SCR-213, SCR-222, SCR-223, SCR-224, SCR-232
- **접근성**: 보이는 레이블, 오류 `aria-invalid` + `aria-describedby`, 글자 16px(모바일 확대 방지)

### CMP-007: Switch
- **용도**: 켜기/끄기(대진 규칙, 청백전 규칙, '비활성 포함')
- **변형**: `withDescription`(한 줄 설명)
- **상태**: 켜짐, 꺼짐, 비활성
- **사용 화면**: SCR-204, SCR-211, SCR-223
- **접근성**: `role="switch"`, 레이블 + 상태 읽기

### CMP-008: Checkbox
- **용도**: 여러 사람 고르기(참석, 개인전 참가, 일괄 승인)
- **변형**: `rowMode`(행 전체가 누름 영역), `selectAll`
- **상태**: 선택, 해제, 비활성(사유 표시)
- **사용 화면**: SCR-203, SCR-224, SCR-231
- **접근성**: 체크 아이콘 + 행 레이블, 행 높이 48px

### CMP-021: Sheet
- **용도**: 부모 화면 위에 여는 시트·패널(SCR-122, SCR-203–205, SCR-212–214, SCR-222, SCR-224–226, 랭크 기준 안내)
- **변형**: `presentation=bottom|side|dialog`(모바일 bottom, PC 패널은 side, PC 시트는 dialog), `height=content|70%|full`, `stacked`(시트 위 두 번째 시트)
- **상태**: 열림, 닫힘, 입력 중 닫기 확인(CMP-022)
- **사용 화면**: SCR-121, SCR-122, SCR-202, SCR-203, SCR-204, SCR-205, SCR-212, SCR-213, SCR-214, SCR-222, SCR-223, SCR-224, SCR-225, SCR-226
- **접근성**: 열리면 제목으로 포커스, 포커스 가둠(모달 시트), Esc·뒤로 가기로 닫기, 닫히면 연 버튼으로 포커스 복귀. PC 옆 패널은 가두지 않음

### CMP-022: ConfirmDialog
- **용도**: 되돌릴 수 없는 행동·충돌 알림 확인 창(UXD-006, UXD-010)
- **변형**: `tone=default|danger|conflict`, 버튼 1개(충돌 알림 '확인') 또는 2개('취소'·행동 이름)
- **상태**: 열림, 처리 중(행동 버튼 로딩)
- **사용 화면**: SCR-102, SCR-122, SCR-202, SCR-212, SCR-213, SCR-223, SCR-224, SCR-225, SCR-226, SCR-231, SCR-232
- **접근성**: `role="alertdialog"`, 처음 포커스는 '취소'(위험 행동) 또는 '확인'(충돌), 행동 버튼은 동사로('확정', '삭제')

### CMP-023: NoticeBox
- **용도**: 화면 안 안내 상자(인증 실패, 점수 미설정 N명, 규칙 완화 요약, 저장 실패, 대진 수정 배너, 공통 튜토리얼 안내)
- **변형**: `tone=info|warning|danger|success`, `action`(오른쪽 버튼 또는 화살표), `dismissible`
- **상태**: 표시, 숨김
- **사용 화면**: SCR-001, SCR-003, SCR-101, SCR-103, SCR-112, SCR-202, SCR-203, SCR-205, SCR-212, SCR-223, SCR-224, SCR-225, SCR-226, SCR-231
- **접근성**: 오류·충돌은 `role="alert"`, 그 밖은 `role="status"`. 아이콘 + 글자

### CMP-024: PersonRow
- **용도**: 사람 한 명 행(이름·성별·급수·점수 + 오른쪽 조작)
- **변형**: `trailing=none|checkbox|segmented|scoreGrid|actions|chevron`, `meta`(급수·점수·게임 수·지인 표시 항목 선택), `group`(회원/게스트 구분 머리)
- **상태**: 기본, 선택, 비활성(회색 + 배지), 잠금(사유)
- **사용 화면**: SCR-202, SCR-203, SCR-211, SCR-214, SCR-224, SCR-231, SCR-232
- **접근성**: 행 높이 48px 이상, 회원 화면에는 쓰지 않음(점수·급수 노출 방지)

### CMP-025: AppNav
- **용도**: 하단 탭바(튜토리얼 / 청백전 / 마이페이지 / 운영)와 PC 왼쪽 메뉴(UXD-066)
- **변형**: `role=member|admin|superAdmin`(운영 탭·역할 관리 노출), `layout=bottom|side`
- **상태**: 현재 탭, 배지(운영 탭 승인 대기 건수)
- **사용 화면**: SCR-101, SCR-111, SCR-121, SCR-201
- **접근성**: `nav` + `aria-current="page"`, 탭 높이 56px, 배지 수를 레이블에 포함

### CMP-026: PageHeader
- **용도**: 화면 제목, 뒤로 가기·나가기, 상태 배지, 오른쪽 행동(더보기, 만들기)
- **변형**: `leading=none|back|close`, `trailing=none|menu|action`, `sticky`
- **상태**: 기본
- **사용 화면**: SCR-101, SCR-102, SCR-103, SCR-111, SCR-112, SCR-121, SCR-201, SCR-202, SCR-211, SCR-221, SCR-223, SCR-231, SCR-232
- **접근성**: 화면 제목은 `h1`, 뒤로 가기 버튼 레이블 '뒤로'

### CMP-027: StateView
- **용도**: 화면 블록 단위 로딩(스켈레톤)·빈 상태·오류·권한 없음·찾을 수 없음
- **변형**: `kind=loading|empty|error|forbidden|notFound`, `action`(다시 시도·만들기·돌아가기)
- **상태**: 각 kind
- **사용 화면**: SCR-004, SCR-005, SCR-101, SCR-102, SCR-111, SCR-112, SCR-202, SCR-211, SCR-221, SCR-223, SCR-231, SCR-232
- **접근성**: 로딩은 `aria-busy`, 빈·오류 문구는 원인 + 다음 행동

### CMP-028: StickySummary
- **용도**: 목록 위에 고정되는 인원 요약(참석 n명 · 남 a 여 b, 청 n · 백 m)
- **변형**: `kind=attendance|teams`
- **상태**: 기본, 경고(점수 미설정 포함)
- **사용 화면**: SCR-203, SCR-224
- **접근성**: 값이 바뀌면 `aria-live="polite"`

### CMP-029: Toast
- **용도**: 저장·승인·역할 변경 완료 알림("저장했습니다")
- **변형**: `tone=success|neutral`
- **상태**: 표시(3초), 사라짐
- **사용 화면**: SCR-003, SCR-122, SCR-212, SCR-231, SCR-232
- **접근성**: `role="status"`, 행동 버튼을 넣지 않음(시간 제한 없이 할 일은 화면에 둠)

### CMP-030: ListItem
- **용도**: 누르면 이동·재생하는 일반 목록 행(운영 메뉴, 틀린 상황, 남은 경기)
- **변형**: `trailing=chevron|badge|control`
- **상태**: 기본, 눌림
- **사용 화면**: SCR-103, SCR-201, SCR-226
- **접근성**: 행 전체가 하나의 링크·버튼, 높이 48px

### CMP-041: GameCard
- **용도**: 한 경기 카드(실시간 대진 코트 카드, 청백전 경기 카드, 회원 '내 경기' 카드)
- **변형**: `context=session|clubMatch`, `audience=ops|member`(member는 점수·팀 합·실력차를 그리지 않음, NFR-005), `teamLabel=numbered(1팀/2팀)|blueWhite(청팀/백팀)`, `phase=review|live|recorded`, `highlight=next|mine|changed`
- **상태**: 검토(선수 누르면 교체), 진행·결과 입력(결과 버튼), 결과 기록됨(이긴 쪽 강조), 변경됨 배지, 규칙 완화 배지, '실력차 계산 불가'
- **사용 화면**: SCR-112, SCR-202, SCR-223
- **접근성**: 팀은 글자 레이블 + 색 띠, 결과 버튼 레이블 '청 승', '백 승', '1팀 승'

### CMP-042: StandingsCard
- **용도**: 결과 요약(팀전 청·백 승수, 개인전 순위 요약·전체 순위, 종료 후 최종 결과 카드)
- **변형**: `mode=team|individual`, `phase=live|final`, `expanded`
- **상태**: 접힘(상위 3명), 펼침(전체, 공동 순위·경기 수·'게스트'), 최종(승리 팀·무승부 / 최종 순위)
- **사용 화면**: SCR-112, SCR-223
- **접근성**: 순위표는 목록 구조, 공동 순위는 '공동 1위'처럼 글자로

### CMP-043: ClubMatchListItem
- **용도**: 청백전 목록 항목(날짜·이름·방식 배지·상태 배지·요약 또는 최종 결과·미기록 수)
- **변형**: `audience=member|ops`(member는 '대진 미확정' 항목 자체가 없음)
- **상태**: 대진 미확정, 진행 중, 종료
- **사용 화면**: SCR-111, SCR-221
- **접근성**: 항목 전체가 링크, 배지 글자 포함

### CMP-044: CandidateList
- **용도**: 교체·대체 후보 목록(교체 후 예상 실력차, 경기 수, '경기 중', 비활성 사유, 경고)
- **변형**: `context=sessionSwap|clubMatchSwap|replacement`, `sort=waitingFirst|fewestGames`
- **상태**: 후보 있음, 후보 없음, 후보 비활성(사유), 경고(경기 수 차이·규칙 위반)
- **사용 화면**: SCR-205, SCR-225, SCR-226
- **접근성**: 비활성 후보도 포커스 가능, 사유를 레이블에 포함

### CMP-045: RecordSummary
- **용도**: 랭크·청백전 전적 요약(마이페이지 본인, 운영진 회원 편집 현황)
- **변형**: `audience=self|ops`(ops는 튜토리얼 통과 현황·권장 대상·지인 행 추가)
- **상태**: 랭크 있음, 랭크 없음('랭크까지 n경기'), 기록 없음
- **사용 화면**: SCR-121, SCR-212
- **접근성**: 등급은 글자(S/A/B/C), '?' 버튼 레이블 '랭크 기준 보기'

### CMP-046: TutorialCourt
- **용도**: 세로 2D 탑뷰 코트, 선수·셔틀콕 애니메이션, 아래쪽 선택·재생 버튼 영역(UXD-064)
- **변형**: `mode=choose|playing|result|replay`, `speed=normal|slow`
- **상태**: 멈춤·선택 대기, 재생 중(버튼 잠금, 눌러서 건너뛰기), 결과(정답·허용·오답), 정답 다시 보기
- **사용 화면**: SCR-102, SCR-103
- **접근성**: 선택 버튼 56px, 결과 문구 `aria-live`, 움직임 줄이기 설정 존중, 코트 그림은 상황 설명 글자로 대체 정보 제공

### CMP-047: StageCard
- **용도**: 튜토리얼 홈의 스테이지 카드(이름, 통과 표시, 최고 점수)
- **변형**: `status=notPlayed|passed|failed|comingSoon`
- **상태**: 기본, 통과, 준비 중(누를 수 없음)
- **사용 화면**: SCR-101
- **접근성**: "스테이지 1, 통과, 최고 점수 5점 중 5점"처럼 읽히는 레이블

## 3. 공통 패턴

- **확인 창(CMP-022)**: 되돌릴 수 없는 행동(확정, 라운드 완료, 세션 종료, 청백전 종료, 방식 변경, 팀 변경 후 재생성, 결과 반대로 수정, 거절, 역할 변경, 게스트 삭제, 비활성 처리)과 입력 중 닫기, 스테이지 나가기에만 씁니다. 처음 결과 기록·참석 체크·옵션 변경·다시 생성은 확인 없이 바로 반영합니다. 제목은 질문형, 본문은 결과 한 줄, 행동 버튼은 동사입니다.
- **토스트(CMP-029)**: 성공 알림만 3초. 실패는 토스트로 알리지 않고 안내 상자(CMP-023)로 화면에 남깁니다.
- **빈 상태(CMP-027 empty)**: 왜 비었는지 + 할 수 있는 다음 행동 버튼 하나. 검색·필터 결과 없음은 조건 해제 버튼.
- **오류 표시**: 입력 오류는 필드 아래(CMP-006·CMP-003), 저장 실패는 시트·화면 위쪽 안내 상자(CMP-023, 입력값 유지), 불러오기 실패는 블록 오류(CMP-027, '다시 시도'). 문구는 원인 + 해결 방법. 네트워크 실패는 "연결이 불안정합니다. 다시 시도해 주세요".
- **충돌 안내**: 기획이 정한 지점(SCR-202 확정, SCR-223·SCR-225·SCR-226의 청백전 조작; FLOW-004-S6a, FLOW-005-S6a)에서만 충돌 확인 창(CMP-022 `tone=conflict`) "다른 운영진이 …을 변경했습니다. 방금 한 작업은 처리되지 않았습니다" → '확인' → 최신 상태를 다시 불러옴. 그 밖의 화면에서 이미 처리된 요청은 오류 안내 상자로 알리고 목록을 새로고침합니다.
- **로딩**: 처음 불러오기는 스켈레톤, 행동 중에는 누른 버튼만 진행 표시하고 같은 행동을 막습니다(중복 제출 방지). 대진 생성은 2초 안(AC-034), 스테이지 준비는 3초 안(AC-095)을 목표로 하며 넘으면 문구를 유지합니다.
- **권한별 노출**: 회원 화면 컴포넌트(`audience=member`)는 1–10 점수·팀 점수 합·실력차·다른 회원의 급수·지인·튜토리얼 진행·랭크를 그리지 않습니다(NFR-005, AC-066, AC-068). 화면에서 숨기는 것과 별개로 API 응답에도 없어야 합니다(구현 단계 계약 테스트).
- **팀 표기**: 팀전은 '청팀 / 백팀'(색 띠 + 글자, 백팀은 테두리형), 개인전과 실시간 대진은 '1팀 / 2팀'(글자만, C-24).
