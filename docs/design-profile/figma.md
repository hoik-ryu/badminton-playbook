# Figma 운용 (SMAPSH 전용)

Figma는 시각 디자인 탐색용입니다. 현재 `/product-design` 엔진의 시각 승인 대상은 `design-preview/`(UI Preview)이고, Figma-first 엔진 규칙 개정은 PoC 이후로 보류했습니다(2026-11-10). 그래서 Figma 결과는 승인 대상이 아니라 VD 결정과 Preview 구현의 참고 자료입니다.

## 1. 계정과 한도

| 항목 | 값 |
|---|---|
| MCP 서버 | `figma-personal` (이 프로젝트 local 범위) |
| 계정 | 개인 계정(`whoami`로 확인한 gmail 계정), 플랜 'Hoic Ryu's team' Starter, Full 좌석 |
| plan key | `team::1397854285838237233` (파일 생성 시 사용) |
| 읽기 한도 | **월 20회**(Starter, Figma 공식 문서 rate-limits-access). 읽기 도구: `get_screenshot`, `get_metadata`, `get_design_context`, `get_variable_defs`, `search_design_system` 등 |
| 한도 제외 | 쓰기 도구(`create_new_file`, `generate_figma_design`, `add_code_connect_map`, `whoami` 등). `use_figma`가 제외인지는 문서에 명시되지 않아 **한도에 포함된다고 보고 계획** |
| 쓸 수 없는 것 | Code Connect(Professional 이상 필요) |
| 회사 서버 `figma` | 이 프로젝트 PoC에는 쓰지 않음 |

### 호출 예산 관리
- 작업 시작 전에 예상 호출 수를 적고, 호출할 때마다 아래 기록표에 남깁니다.
- 한 번의 `use_figma`에 가능한 많은 작업을 묶습니다(변수 전체, 스타일 전체, 컴포넌트 묶음).
- 확인용 스크린샷은 꼭 필요한 프레임에만 씁니다.
- MCP 스킬 지침(`skill://figma/...`)은 리소스 읽기라 도구 호출이 아닙니다.

| 날짜 | 도구 | 목적 | 한도 포함 여부 |
|---|---|---|---|
| 2026-11-10 | `create_new_file` | `SMAPSH – Design PoC` 생성 | 제외(문서상 쓰기 도구) |
| 2026-11-10 | `create_session` | 작업 세션 | 문서에 언급 없음 |
| 2026-11-10 | `get_libraries` | 연결 라이브러리 확인(커뮤니티 키트 8개, 사용 안 함) | 포함(읽기) |
| 2026-11-10 | `use_figma` #1 | 글꼴 확인, 변수 57개, 텍스트 스타일 6, 효과 스타일 2, 페이지 3 | 문서에 명시 없음 |
| 2026-11-10 | `use_figma` #2 | 컴포넌트 13개(아이콘 4 포함) | 문서에 명시 없음 |
| 2026-11-10 | `use_figma` #3 | SCR-211 ST1 mobile 프레임 조립 + 노드 스크린샷 | 문서에 명시 없음 |
| 2026-11-10 | `use_figma` #4 | 컴포넌트 크기 방식 수정 | 문서에 명시 없음 |
| 2026-11-10 | `use_figma` #5 | 프레임 보조 정보·버튼 위치 수정 + 노드 스크린샷 | 문서에 명시 없음 |
| 2026-11-10 | `use_figma` #6 | SCR-211 모바일 UX 검토용 크기 측정(읽기 전용, 수정 없음) | 문서에 명시 없음 |
| 2026-11-10 | `create_session` | 디자인 실험 A/B 세션(`437c25b4-…`) | 문서에 언급 없음 |
| 2026-11-10 | `use_figma` #7 | 원본 `3:2` 구조·변수·글꼴 조사(읽기 전용) | 문서에 명시 없음 |
| 2026-11-10 | `use_figma` #8 | 실험 페이지 생성 시도 → **실패**(Starter 페이지 3개 제한, 생성된 것 없음) | 문서에 명시 없음 |
| 2026-11-10 | `use_figma` #9 | 실험 변수(`exp/brand-primitive`, `exp/theme-A`, `exp/theme-B`, 모드 1개 제한으로 분리) + `EXP-A/B` 컴포넌트 15개 | 문서에 명시 없음 |
| 2026-11-10 | `use_figma` #10 | A안 `13:98`, B안 `13:256` 프레임 조립 + 측정, 구분 글자 3개 | 문서에 명시 없음 |
| 2026-11-10 | `get_screenshot` ×3 | 기존안 `3:2`, A안, B안 스크린샷(`reviews/screens/`) | 포함(읽기) |
| 2026-11-10 | `use_figma` | C안 c1 → **실패**(GROUP constraints) | 포함(확인됨) |
| 2026-11-10 | `use_figma` ×3 | C안 c1·c2·c3: 테마 변수 12, 아이콘 35, 컴포넌트 28 (섹션 `17:28`) | 포함 |
| 2026-11-10 | `get_screenshot` | C안 컴포넌트 섹션 | 포함 |
| 2026-11-10 | `use_figma` | C안 s1: 화면 프레임 14개 | 포함 |
| 2026-11-10 | `use_figma` | C안 s2 → **거부: Starter MCP 호출 한도 도달** | - |

> 정정(2026-11-10): 실제로는 Full 좌석에서도 한도가 적용되었고, `use_figma`도 한도에 포함되었습니다. 1장의 "`use_figma`가 제외인지 불명" 항목은 **포함**으로 확인되었습니다.

파일: https://www.figma.com/design/gqwivlIXG9u8WoPpHIQWdQ (file key `gqwivlIXG9u8WoPpHIQWdQ`). 확실히 읽기 한도에 들어가는 호출은 `get_libraries` 1회이고, `use_figma` 5회는 한도 포함 여부가 공식 문서에 없어 확인되지 않았습니다. `get_screenshot`·`search_design_system`은 쓰지 않았습니다(스크린샷은 `use_figma` 안의 노드 스크린샷으로 대신).

## 2. 파일·페이지·프레임 이름

- 파일 이름: `SMAPSH – Design PoC`
- 페이지: `00 Foundations`(변수·스타일 확인용), `01 Components`, 그리고 화면 대역별 페이지(`01` 6.3): 첫 PoC는 `운영 · 명단`
- 프레임 이름(`01` 6.3 규칙): `SCR-### 화면 이름 / ST# 상태 / 플랫폼`
  - 예: `SCR-211 명단 / ST1 기본 / mobile`, `SCR-211 명단 / ST3 빈 상태(검색 결과 없음) / mobile`
  - 같은 상태의 변형은 상태 이름 뒤 괄호로 구분
- 컴포넌트 이름: `CMP-### 영문이름`, 변형은 variant 속성(`component-mapping.md`)
- 후보 표시: VD가 '후보'인 값으로 만든 프레임에는 프레임 설명에 `VD 후보: VD-007, VD-008…`을 적습니다.

## 3. 변수(Figma Variables) 계획

- 원본은 `tokens.json`. 값을 손으로 다시 입력하지 않고 이 파일에서 읽어 만듭니다.
- 컬렉션: `color`, `space`, `radius`, `font`, `size`, `motion` (모드 `light` 하나)
- 변수 이름: 분류를 뺀 나머지 경로를 `/`로. 예: `color` 컬렉션의 `team/blue/bg`
- 변수 타입: color → COLOR, dimension·number·fontWeight·duration → FLOAT, fontFamily → STRING
- 그림자 2개는 변수가 아니라 Effect Style `elevation/sheet`, `elevation/card`
- 브레이크포인트는 변수로 만들지 않고 프레임 너비로 표현
- 텍스트 스타일: `font/caption`, `font/body`, `font/title`, `font/heading`, `font/display`(크기 토큰 + VD-001 글꼴 + `font.lineHeight.body`)
- shadcn 별칭 그룹은 Figma에 만들지 않음(코드 쪽 층)
- 상세 대응: `token-mapping.md` 2장의 'Figma Variables' 열

## 4. 비식별 샘플 데이터 원칙

- 실제 회원 이름·연락처·카카오 정보 등 개인정보를 쓰지 않습니다.
- 이름은 지어낸 이름만 쓰고, 유명인 이름과 겹치지 않게 고릅니다.
- 화면 상태를 재현하는 데 필요한 만큼만 만듭니다(점수 미설정, 튜토리얼 권장 대상, 비활성, 게스트).
- 같은 데이터 세트를 Figma와 UI Preview(`design-preview/src/mock`)에서 함께 씁니다.

### SCR-211 샘플 세트(모두 가상 인물)

| 구분 | 이름 | 성별 | 급수 | 점수 | 상태 |
|---|---|---|---|---|---|
| 회원 | 권초록 | 여 | B조 | 6 | |
| 회원 | 김가람 | 남 | C조 | 7 | |
| 회원 | 박다온 | 남 | A조 | 9 | |
| 회원 | 서이든 | 남 | 입문자 | 미설정 | 튜토리얼 권장 |
| 회원 | 신자람 | 여 | 왕초심 | 2 | 튜토리얼 권장 |
| 회원 | 오아라 | 여 | D조 | 5 | |
| 회원 | 윤새벽 | 남 | 초심 | 3 | 튜토리얼 권장 |
| 회원 | 이나래 | 여 | C조 | 미설정 | 튜토리얼 권장 |
| 회원 | 정마루 | 남 | 자강조 | 10 | |
| 회원 | 최라온 | 여 | 초심 | 미설정 | 튜토리얼 권장 |
| 회원 | 한바다 | 남 | B조 | 8 | |
| 회원 | 황하랑 | 남 | D조 | 6 | 비활성(기본 목록에서 숨김) |
| 게스트 | 남보람 | 남 | C조 | 7 | |
| 게스트 | 문솔빛 | 여 | 입문자 | 4 | |

- 기본 목록: 활성 회원 11명(이름순) + 게스트 2명
- 칩: '점수 미설정 3명'(서이든·이나래·최라온), '튜토리얼 권장 · 미통과 5명'(권장 기준: 점수 3 이하 또는 미설정인 승인 회원, C-23. 다섯 명 모두 미통과로 가정)
- 비활성 1명은 어느 칩에도 들지 않게 점수를 넣어, 칩 집계에 비활성을 넣을지(명세에 없음) 판단하지 않도록 했습니다.
- 긴 이름 확인(VD-007 자기 비평): 360px 확인 프레임에서만 회원 한 명의 이름을 다섯 글자 가상 이름 '남궁하늘빛'으로 바꿔 넘침을 봅니다.

## 5. SCR-211 PoC 프레임 구성안

기준 명세: `02-screens.md` SCR-211(승인본). 크기: mobile 390×844(확인용 360×800 1개), desktop 1440×900.

| # | 프레임 | 명세 상태 | 내용 |
|---|---|---|---|
| 1 | `SCR-211 명단 / ST1 기본 / mobile` | ST1 | 샘플 기본 목록, 칩 둘 다 보임, 떠 있는 '게스트 추가', 하단 탭(운영 선택) |
| 2 | `SCR-211 명단 / ST1 기본(점수 미설정 필터) / mobile` | ST1 | 칩 켜짐, 3명만 |
| 3 | `SCR-211 명단 / ST1 기본(비활성 포함) / mobile` | ST1 | '비활성 포함' 켬, 황하랑 회색 + '비활성' 배지 |
| 4 | `SCR-211 명단 / ST2 로딩 / mobile` | ST2 | 스켈레톤(VD-017) |
| 5 | `SCR-211 명단 / ST3 빈 상태(명단 없음) / mobile` | ST3 | 02 문구 + '게스트 추가' |
| 6 | `SCR-211 명단 / ST3 빈 상태(검색 결과 없음) / mobile` | ST3 | 조건 해제 버튼 |
| 7 | `SCR-211 명단 / ST4 오류 / mobile` | ST4 | 블록 오류 + 다시 시도 |
| 8 | `SCR-211 명단 / ST1 기본(긴 이름) / mobile-360` | ST1 | 360px 넘침 확인 |
| 9 | `SCR-211 명단 / ST1 기본 / desktop` | ST1 | 왼쪽 메뉴, 목록 위 '게스트 추가'(UXD-026), 열 구성(VD-016), 오른쪽 편집 패널 자리는 비워 'SCR-212 영역' 표시 |
| 10 | `SCR-211 명단 / ST2 로딩 / desktop` | ST2 | |
| 11 | `SCR-211 명단 / ST3 빈 상태(명단 없음) / desktop` | ST3 | |
| 12 | `SCR-211 명단 / ST4 오류 / desktop` | ST4 | |

- ST5(권한 없음)는 SCR-211 프레임이 아니라 SCR-004로 이동하는 동작이므로 만들지 않고 페이지 메모로 남깁니다.
- ST6(충돌)은 명세상 해당 없음입니다.

## 6. 컴포넌트 대응 계획(SCR-211에 필요한 것만)

| Figma 컴포넌트 | 변형(variant) | 04 정의 |
|---|---|---|
| `CMP-025 AppNav` | layout=bottom·side, role=admin | 하단 탭 4개 / PC 왼쪽 메뉴 |
| `CMP-026 PageHeader` | leading=back, trailing=menu | 제목 '명단', 더보기 |
| `CMP-023 NoticeBox` | tone=info | 카카오 가입 안내 한 줄 |
| `CMP-006 TextField` | type=search | 이름 검색 |
| `CMP-004 FilterChip` | state=off·on | 두 칩 |
| `CMP-007 Switch` | on·off | 비활성 포함 |
| `CMP-024 PersonRow` | state=default·inactive, score=set·unset | 한 줄 표기(VD-007) |
| `CMP-005 Badge` | tone=warning·neutral | '미설정', '비활성' |
| `CMP-001 Button` | variant=primary, size=lg, icon=leading | '게스트 추가'(모바일 떠 있는 배치·PC 헤더) |
| `CMP-027 StateView` | kind=loading·empty·error | 스켈레톤, 빈 상태, 오류 |

## 7. 생성·검증 순서와 예상 호출 수

1. MCP 지침 읽기(리소스, 호출 아님): `figma-use`, `figma-generate-library`(변수·컴포넌트 순서), `figma-create-new-file`
2. `create_new_file`(개인 plan key, 한도 제외) → `create_session`
3. `use_figma` ① 글꼴 확인(Pretendard 사용 가능 여부) + 변수 컬렉션 6개 + 텍스트·효과 스타일 (1회)
4. `use_figma` ② 컴포넌트 10개와 변형 (1–2회)
5. `use_figma` ③ 프레임 12개 조립과 샘플 데이터 (2–3회)
6. `get_screenshot` 확인: mobile ST1, mobile-360 긴 이름, desktop ST1 (3회)
7. 수정이 필요하면 `use_figma` 1–2회

예상: 읽기로 칠 수 있는 호출 약 9–12회(`use_figma`를 한도에 넣는 보수적 계산). 월 20회 안에서 한 번의 PoC와 소규모 수정이 가능합니다.

## 8. 예상 제약

| 제약 | 내용 | 대응 |
|---|---|---|
| Pretendard | Figma 기본 제공 글꼴(Google Fonts)이 아니라 사용 가능 여부가 불확실 | ①에서 확인. 없으면 (a) 사용자가 PC에 설치하고 Figma 데스크톱 글꼴 연동, 또는 (b) PoC에서만 대체 글꼴을 쓰고 프레임에 '글꼴 대체' 표시 — 결정 필요 |
| Lucide 아이콘 | 패키지를 설치하지 않았고 Figma에 기본 제공되지 않음 | (a) 사용자가 Lucide Figma 플러그인으로 넣기, (b) 아이콘 자리를 '아이콘: Search' 같은 표시로 두기 — 결정 필요 |
| 호출 한도 | 월 20회, 실패 재시도도 한도 소진 | 작업을 묶고 기록표 관리 |
| Code Connect | Starter라 불가 | Preview 구현 시 `component-mapping.md`로 수동 대응 |
| 승인 대상 아님 | Figma 결과는 엔진의 승인 대상이 아님 | 결정은 VD 승인으로, 화면 승인은 UI Preview에서 |
