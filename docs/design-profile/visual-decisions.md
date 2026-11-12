# 시각 결정 (Visual Decisions, SMAPSH)

승인된 04 4장 '시각 디자인 단계(Figma PoC)로 넘긴 항목'을 정하는 기록입니다. 각 결정은 `VD-###`로 번호를 매기고 재사용하지 않습니다.

상태 값
- **승인**: 사용자가 결정함. Figma PoC와 UI Preview에서 씀
- **후보**: 제안만 됨. 사용자 승인 전에는 Figma에 '후보'로 표시해서만 씀
- **미결정**: 정보가 부족해 제안하지 않음

모든 VD는 토큰 범위 안의 값만 씁니다(`tokens.json`). 토큰에 없는 수치는 space·size·radius 토큰의 조합이나 배수로 표현하고, 그것도 안 되면 '토큰 밖 값'이라고 적습니다.

## 1. 공통 결정

| VD | 항목 | 결정 | 근거 | 상태 |
|---|---|---|---|---|
| VD-001 | 기본 글꼴 | Pretendard, 폴백 `system-ui, sans-serif`(= 04 `font.family.base`) | 사용자 결정(2026-11-10). 한글 가독성, 고정폭 숫자 지원 | **승인** |
| VD-002 | 아이콘 세트 | Lucide | 사용자 결정(2026-11-10, stack) | **승인** |
| VD-003 | 웹 글꼴 로딩 방식 | 미결정(자체 호스팅 / CDN, 서브셋 여부) | 성능(NFR-008 인앱 브라우저)과 라이선스(SIL OFL) 확인 필요 | 미결정 |
| VD-004 | 숫자 표기 | 점수·인원 수 등 숫자에 고정폭 숫자(`font-variant-numeric: tabular-nums`) | 체육관에서 세로로 훑어볼 때 자릿수가 맞아야 함 | 후보 |
| VD-005 | 아이콘 크기·선 굵기 | 20px(`space.5`), 선 굵기 2(Lucide 기본). 터치 영역은 아이콘과 별개로 44px 이상 | 본문 16px과 균형, 터치 기준(size.touch.min) 유지 | 후보 |
| VD-006 | 강조를 두는 한 곳 | 운영 화면의 점수 숫자만 `font.weight.bold`. 그 밖의 장식 강조 없음 | 스킬 원칙 "대담함은 한 곳에만"을 업무 화면에 맞게 적용 | 후보 |

## 2. SCR-211 명단 화면 후보 (frontend-design 절차 적용)

### 2.1 주제 파악(스킬 1단계)
- 대상: 체육관에서 휴대폰 한 손으로 회원·게스트를 찾아 점수를 매기는 운영진. PC에서는 사전 준비 때 점수 미설정 필터로 연달아 편집.
- 이 화면의 주된 일: **이름으로 빨리 찾고, 점수가 비었거나 튜토리얼이 필요한 사람을 골라내는 것**(02 SCR-211 목적).

### 2.2 계획(스킬 2단계, 승인 토큰 안에서)
- 색: 승인 토큰 그대로(배경 `color.bg.page`, 구역 `color.bg.surface`, 본문 `color.text.primary`, 보조 `color.text.secondary`, 주 행동 `color.action.primary`, 경고 배지 `color.status.warning.*`).
- 글꼴: Pretendard 한 가지(VD-001). 크기는 `font.size.body` 16px 중심, 보조 정보도 16px(모바일 최소 16px 원칙), 머리글·배지만 `font.size.caption` 13px.
- 레이아웃: 위에서부터 헤더 → 카카오 안내 한 줄 → 검색 → 필터 칩 줄 + '비활성 포함' → 목록(회원, '게스트' 머리글, 게스트). 왼쪽 정렬. 카드로 감싸지 않고 구분선으로 나눈 연속 목록.

### 2.3 진부한 기본값 대조와 수정(스킬 3단계)
- 행마다 둥근 카드와 그림자를 두는 'SaaS 카드 키트' → **쓰지 않음**. 행은 연속 목록이고 `color.border.default` 구분선만 둡니다.
- 머리글을 대문자·자간 넓힌 라벨로 → **쓰지 않음**. '게스트' 머리글은 일반 표기 13px 굵게.
- 행 오른쪽에 장식용 화살표(→, chevron) → **쓰지 않음**. 승인 명세에 없는 요소이고 행 전체가 누름 영역입니다.
- 가운뎃점 표기 → 스킬은 진부하다고 보지만 **UXD-074 표기라 유지**합니다.

### 2.4 후보 목록

| VD | 항목 | 후보 | 근거 | 상태 |
|---|---|---|---|---|
| VD-007 | 행 구성 | 한 줄: **이름**(16px, `font.weight.bold`) + ` · 남 · C조 · `(16px `color.text.secondary`) + **점수**(16px bold, 고정폭 숫자). 점수가 없으면 점수 자리에 '미설정' 배지 | UXD-074 표기 순서 유지, 이름과 점수를 가장 빨리 읽게 함 | 후보 |
| VD-008 | 행 높이·여백 | 최소 높이 56px(`space.4` 위아래 + 본문 줄높이), 좌우 `space.gutter.mobile` 16px, 행 사이 구분선 1px `color.border.default` | CMP-024 '행 높이 48px 이상', 체육관에서 잘못 누르지 않게 여유 | 후보 |
| VD-009 | 배지 | 높이 24px, 좌우 `space.2` 8px, `radius.sm`, 13px bold. '미설정'은 `status.warning.bg/fg`, '비활성'은 `bg.surface` + `text.secondary` | CMP-005 tone, 대비 6.45:1 이상 | 후보 |
| VD-010 | 필터 칩 | 보이는 높이 32px(`space.8`, 테두리 포함), 터치 영역은 44px(`size.touch.min`)로 확장. 꺼짐: `bg.page` + `border.strong` 테두리 + `text.primary`. 켜짐: `action.primary` 배경 + `action.onPrimary` 글자 + 체크 아이콘(Lucide Check) | CMP-004, 색 외에 체크 아이콘으로도 구분 | 후보 |
| VD-011 | 검색 입력 | 높이 44px, 앞쪽 Lucide Search 아이콘, `radius.md`, 테두리 `border.strong` | CMP-006 search, 터치 기준 | 후보 |
| VD-012 | '게스트 추가' 버튼 | 모바일: 오른쪽 아래 떠 있는 주 버튼, 높이 56px(튜토리얼 선택 버튼과 같은 큰 터치), Lucide Plus + '게스트 추가' 글자, `elevation.card`, 화면 가장자리에서 `space.4` 16px, 하단 탭 위. PC: 헤더 줄 오른쪽(목록 위) 주 버튼 48px(`size=lg`), 더보기(⋯, Lucide Ellipsis) 옆 | UXD-026 위치 유지, CMP-001 primary | 후보 |
| VD-013 | '게스트' 머리글 | 높이 32px, `bg.surface` 배경, 13px bold `text.secondary`, 왼쪽 정렬 | UXD-074 구분 머리글 | 후보 |
| VD-014 | 비활성 행 | 글자 `text.disabled`(page 배경 대비 4.83:1) + '비활성' 배지 | UXD-024, 색 외에 배지로 구분 | 후보 |
| VD-015 | 카카오 가입 안내 줄 | CMP-023 NoticeBox `tone=info`(`status.info.bg`), 본문 16px 한 줄, 닫기 없음 | UXD-014, SCR-211 '고정 한 줄 문구'(닫기 미정의) | 후보 |
| VD-016 | PC 목록 열 | 열: 이름(나머지 너비, 최소 160px) · 성별(64px) · 급수(96px) · 점수(80px, 오른쪽 정렬, 고정폭 숫자). 목록 영역 = 가운데 최대 너비에서 옆 패널 `size.panel.side` 400px를 뺀 폭 | 02 SCR-211 PC 열 구성(이름·성별·급수·점수). 열 너비는 토큰 밖 값 | 후보 |
| VD-017 | 스켈레톤 | 행 8개, 이름·보조 정보 자리의 막대 2개(`bg.surface`, `radius.sm`). 반짝이는 애니메이션 없이 고정 표시(움직임 줄이기와 무관하게 동일) | CMP-027 loading, 장식 모션 금지 원칙 | 후보 |
| VD-018 | 빈 상태·오류 블록 | CMP-027 empty/error: 가운데 정렬 대신 왼쪽 정렬 문구 + 행동 버튼 하나(02 SCR-211-ST3·ST4 문구 그대로). 아이콘 없음 | 원인 + 다음 행동(04 3장), 장식 일러스트 없음 | 후보 |

### 2.5 자기 비평(스킬 4단계)
- 남은 위험: 한 줄 행 표기(VD-007)는 이름이 길면 360px 폭에서 줄바꿈될 수 있습니다. Figma PoC에서 360·390px로 확인하고, 넘치면 '이름 말줄임 + 보조 정보 유지' 규칙을 별도 VD로 제안합니다.
- 절제 확인: 강조는 점수 숫자(VD-006)뿐이고 장식 요소는 없습니다. 한 가지를 더 빼야 한다면 `elevation.card`가 들어간 떠 있는 버튼의 그림자입니다(PoC에서 그림자 유무 비교).

## 3. 미결정 항목(VD로 만들지 않음)

| 항목 | 이유 |
|---|---|
| shadcn `--secondary`·`--accent`·`--popover`·`--sidebar-*`·`--destructive-foreground` | 대응하는 승인 토큰이 없음(`token-mapping.md` 3.2). 정하려면 VD 또는 토큰 추가(UX 설계 변경) |
| 다크 모드 | 범위 밖 |
| 더보기(⋯) 메뉴의 추가 항목, 카카오 안내 닫기, 권장 대상 행 배지 | 승인 명세에 정의되지 않은 기능(UX Spec 후속 검토) |

## 4. Figma PoC 1차 적용 기록 (2026-11-10)

- PoC 사용 허가: VD-004–018은 사용자가 Figma PoC에서 **후보로 사용**하도록 허용(2026-11-10). 상태는 '후보'로 유지.
- 글꼴: Figma에서 Pretendard를 쓸 수 없어(사용 가능 스타일 0개) **Noto Sans KR**(Regular·Bold)을 PoC용 임시 글꼴로 사용. VD-001(Pretendard)은 그대로 승인 상태이며 Preview·구현에서는 Pretendard를 씀. Figma에서 Pretendard를 쓰려면 사용자 PC 설치와 Figma 데스크톱 글꼴 연동이 필요.
- 아이콘: Lucide SVG(검색, 추가, 더보기, 뒤로)를 `createNodeFromSvg`로 넣어 아이콘 컴포넌트 4개로 만듦(VD-002). SVG 경로는 패키지가 아니라 Lucide 공개 도형을 옮겨 적은 것이므로 Preview 단계에서 `lucide-react` 원본과 대조 필요.
- VD-012 차이: 후보는 떠 있는 '게스트 추가'를 56px로 제안했지만 승인된 CMP-001 크기는 md 44·lg 48뿐이라 **lg 48px로 적용**. 56px를 쓰려면 CMP-001 크기 추가(UX 설계 변경) 필요. VD-012는 '후보'로 두고 높이 항목은 미결정.
- VD-004(고정폭 숫자)는 Figma에 적용하지 않음(Noto Sans KR 글꼴 기능 설정을 이번에 하지 않음).
- 새 미결정: 하단 탭(CMP-025) 아이콘은 명세에 없어 글자만 표시. 아이콘을 넣으려면 VD 후보로 제안 필요(VD-019 예정).

