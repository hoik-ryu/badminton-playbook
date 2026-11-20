# 자산 카탈로그 — 2026-11-19 사용자 제공 자료 반영(V04 탐색)

레지스트리 원본은 `design-profile/assets.json`(엔진 관리)입니다. 이 문서는 사람이 읽는 요약입니다. **모든 자산은 권리 미확인 → 탐색 전용, 공식 채택 아님.**

## 원본 자료(변경 없이 보존, Git 제외: `.git/info/exclude`)
| 자료 | 보존 위치 | SHA-256(앞 16자) | 판단 |
|---|---|---|---|
| 학습 UI 보드 | `design-profile/sources/2026-11-19/배드민턴 코트 위치 학습 UI 보드.png` (원 위치 `~/Downloads`) | 633b18fd9ea0d215 | 과정 아이콘·라켓 추출, 나머지는 `smapsh_assets_v2`와 동일 그림 → 참고 |
| 역동적 스매시 | `…/셔틀콕과 라켓의 역동적 스매시.png` | 362fd0d3926bf117 | **참고 전용**: 투명이 아닌 체크무늬가 그려진 RGB. 흰 깃털·줄·그립 분리 불가 |
| 민트 라켓·셔틀콕 | `…/민트 테니스 라켓과 셔틀콕.png` | 092473d7fbfceced | **참고 전용**: 같은 이유 |
| 셔틀콕 단독 v2(배너 교체 원본) | `…/셔틀콕 단독 v2(배너 교체 원본).png` | dfe1d56febf424d0 | 그려진 체크무늬(32px) RGB였으나 대상이 하나라 분리 성공 → AST-046 |
| 셔틀콕 단독(AST-026 원본) | `…/셔틀콕 단독(AST-026 원본).png` | 97aaa25fe5b723ee | AST-026으로 가공·사용 |
| smapsh_assets_v2 폴더 | 프로젝트 루트 `smapsh_assets_v2/`(그대로 둠) | — | 아래 표 |
가공 스크립트: `design-profile/sources/2026-11-19/scripts/`

## 등록 자산
| ID | 용도 | 원본 | 가공 | 출처·라이선스 | V04 사용 |
|---|---|---|---|---|---|
| AST-026 | 배너 셔틀콕(이전) | 셔틀콕 단독 이미지 | 바닥·그림자·구름 제거, 420×394 | self_made(실제 원작자 미확인)·unknown | 보존·V04 미사용(교체됨) |
| AST-046 | 배너 셔틀콕 v2 | 셔틀콕 단독 v2 | 그려진 체크무늬 제거(평평함·색·가장자리 연결·깃대 사이 체크무늬 판정, `scripts/cut_checker3.py`), 480×454 | self_made(실제 원작자 미확인)·unknown | ✔ |
| AST-027 | 썸네일 intro-1 코트와 번호 익히기 | stages/12-course-strategy | 크롭 x110–650, 위아래 배경 연장, 240×144 | generated_tool·unknown | ✔ |
| AST-028 | 썸네일 intro-2 기본 자리와 복귀 | stages/02-serve-recovery | 크롭 x140–620(흰 모서리 제외) | 〃 | ✔ |
| AST-029 | 썸네일 starter-1 나란히 수비 대형 | stages/05-defense | 크롭 x140–620 | 〃 | ✔ |
| AST-030 | 썸네일 starter-2 담당 영역 나누기 | stages/08-defense-zones | 크롭 x110–650, 배경 연장 | 〃 | ✔ |
| AST-031 | 썸네일 starter-3 셔틀콕을 받은 뒤 복귀 | stages/03-receive-position | 크롭 x140–660, 위쪽 배경 연장 | 〃 | ✔ |
| AST-032 | 썸네일 basic-1 앞뒤 공격 대형 | stages/09-front-back-position | 크롭 x160–640 | 〃 | ✔ |
| AST-033 | 썸네일 basic-2 공격에서 수비로 전환 | stages/07-attack-defense-transition | 크롭 x140–620 | 〃 | ✔ |
| AST-034 | 썸네일 basic-3 수비에서 공격으로 전환과 좌우 수비 | stages/06-attack | 크롭 x180–660 | 〃 | ✔ |
| AST-035–037 | 과정 장식 새싹·왕관·메달 | 학습 UI 보드 과정 아이콘 영역 | 배경 제거(색 거리 알파)·정사각 여백 | 〃 | ✔ |
| AST-038–044 | 공통 장식: 공격 화살표·코트·점선 경로·두 선수·선수·순환 화살표·방패 | common/*.png | 배경 제거·여백 정리(원본 약 64px) | 〃 | 등록·미사용 |
| AST-045 | 공통 장식: 라켓 | 학습 UI 보드(ZIP 사본은 손잡이 잘림) | 배경 제거 | 〃 | 등록·미사용(배너 비교안 ②에만) |
| AST-017–025 | V03 셔틀콕 SVG·썸네일 SVG | 모델 제작 | — | model_drawn·unknown | 삭제 안 함(V03에서 사용) |

## 등록하지 않은 자료와 이유
| 자료 | 이유 |
|---|---|
| stages/01-serve, 04-rotation, 10-left-right-cover, 11-clear-drop | 승인된 MVP 8개 학습 목표(Planning r7 C-27)에 서브·로테이션·클리어/드롭 스테이지가 없음. 10은 basic-3 대안 후보로 보류 |
| common/shuttlecock | 깃털이 배경과 같은 흰색이라 분리 시 반투명해짐. AST-026이 더 좋음 |
| common/racket(ZIP 사본) | 손잡이 끝 잘림 → 보드에서 다시 추출(AST-045) |
| badges/passed·in-progress·coming-soon | 글자·점수가 이미지에 고정 → 참고 전용, 실제 상태는 CSS 배지 |
| reference/newly-generated-asset-board | 개별 자산과 같은 그림의 보드 → 참고 |
| 스매시·민트 라켓 이미지 | 체크무늬 RGB, 분리 품질 낮음 → 참고 전용(분리 시도: `design-explore/review/V04/rejected/`) |
| ~/Downloads/배드민턴 튜토리얼 아이콘 세트.png | 이번 요청 목록에 없어 검토하지 않음 |

## VD-002(Lucide 아이콘만 사용)와의 관계
- 과정 장식(AST-035–037)·썸네일·공통 장식은 **장식 일러스트(decorative, alt="")**로 등록했습니다. 누를 수 있는 UI 아이콘(탭·버튼)은 계속 Lucide입니다 → 현재 V04 사용 범위에서는 VD-002 예외가 필요 없다고 판단합니다.
- 다만 공통 장식(AST-038–045)을 버튼·상태 표시 등 **기능 아이콘으로 쓰면 VD-002와 충돌**하므로 VD 예외(사용자 결정)가 필요합니다. 현재는 미사용.
