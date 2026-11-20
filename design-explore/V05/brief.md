# 탐색 브리프 V05 — 2차 시각 탐색(Design Direction)

엔진이 만든 파일입니다. 시안·후보 테마는 승인 대상이 아니며 제품 코드·정식 프리뷰·공식 테마에 쓰지 않습니다. 선택 결과는 explore-adopt로 **후보 VD·후보 테마**가 되고, VD마다 사용자가 결정합니다.

## 대표 화면(승인된 02)
| 화면 | 이름 | 유형 | 선정 근거 |
|---|---|---|---|
| SCR-102 | 스테이지 플레이 | browse | 사용자 지정 |
| SCR-103 | 스테이지 결과 | input | 사용자 지정 |

### SCR-102 구조 지문(바꾸지 않음)
- `SCR-102:info-1` 코트(선수·파트너·상대·셔틀콕 위치, 내 선수 강조)와 내 편 번호 격자
- `SCR-102:info-2` 질문('어디로 이동해야 할까요?' 또는 입문자 'N번 위치로 이동해 보세요')
- `SCR-102:info-3` 판정 뒤 표시: 고른 칸·정답 칸·허용 칸·셔틀 방향, 결과 문구(득점/랠리 이어짐/실점, 이유, '더 좋은 위치' 설명)
- `SCR-102:info-4` 상황 진행(n/5)과 현재 점수
- `SCR-102:action-1` 번호 칸 터치(단일 터치)
- `SCR-102:action-2` 번호 칸 터치(확인 단계)
- `SCR-102:action-3` '이 칸으로 이동'(확인 단계)
- `SCR-102:action-4` '다음 상황'
- `SCR-102:action-5` '다시 도전'
- `SCR-102:action-6` '올바른 움직임 보기' / '최선 위치 보기'
- `SCR-102:action-7` '다시 보기' / '느리게 보기(0.5배속)'
- `SCR-102:action-8` '나가기'
- `SCR-102:action-9` 브라우저 뒤로 가기
- `SCR-102:action-10` 새로고침·창 닫기·인앱 브라우저 닫기
- 컴포넌트: CMP-001, CMP-022, CMP-026, CMP-027, CMP-046 · 상태: SCR-102-ST1, SCR-102-ST10, SCR-102-ST11, SCR-102-ST12, SCR-102-ST2, SCR-102-ST4, SCR-102-ST5, SCR-102-ST7, SCR-102-ST8, SCR-102-ST9

### SCR-103 구조 지문(바꾸지 않음)
- `SCR-103:info-1` 이번 점수·통과 여부(통과 기준 '5개 중 4개(70%)' 함께 표시)
- `SCR-103:info-2` 최고 점수(이번이 더 높으면 '최고 점수 갱신')
- `SCR-103:info-3` (r3) 과정 진행률과 전체 진행률(저장 뒤 값, 새 스테이지 ID 기준)
- `SCR-103:info-4` 틀린(허용·오답) 상황 목록
- `SCR-103:info-5` '다음 스테이지'·'다시 하기'·'목록'
- `SCR-103:action-1` 화면 진입
- `SCR-103:action-2` '다시 저장'(ST4)
- `SCR-103:action-3` 틀린 상황 누르기
- `SCR-103:action-4` '다음 스테이지'
- `SCR-103:action-5` '다시 하기'
- `SCR-103:action-6` '목록'
- 컴포넌트: CMP-001, CMP-023, CMP-026, CMP-030, CMP-046, CMP-049 · 상태: SCR-103-ST1, SCR-103-ST2, SCR-103-ST4, SCR-103-ST7

## 규칙
- 시안 2개. 같은 시안의 모든 화면은 같은 theme.json 토큰과 같은 컴포넌트 규칙을 씁니다.
- 구조 고정: 위 정보(순서 포함)·행동·입력을 모두 넣고, 없는 정보·행동·컴포넌트를 더하지 않습니다(structure_drift). 레퍼런스 이미지 속 기능·문구·데이터도 마찬가지입니다.
- 시안끼리 색만 달라서는 안 됩니다: distinct_axes(typography·density·component·hierarchy·layout_grid)의 실제 CSS 값이 달라야 합니다(variants_color_only).
- styles.css는 색을 var(--토큰)으로만 씁니다(raw_color_literal). theme.json 토큰 이름은 04 문서 이름을 쓰고, 없는 이름은 ② 변경 요청 후보로 표시됩니다.
- 컴포넌트에는 data-cmp="CMP-xxx"(변형은 data-cmp-variant)를 붙입니다. 측정(explore-verify)이 화면 간 같은 컴포넌트의 계산된 스타일을 비교합니다(component_inconsistent).
- 레퍼런스 기반이면 theme.json provenance에 토큰별 출처 규칙(RX)을 적고, 확인 전 추정값은 쓰지 않습니다.
- 절차(frontend-design): plan.md(계획) → 진부한 기본값 대조 → 제작 → 측정 스크린샷으로 critique.md(모델 평가) → 사용자 선택.

## 수정 라운드(기준 None, 1회째 / 상한 2)
> 사용자 피드백: 

- G1: SCR-102·103에 V04-A 디자인 시스템 적용(코트 #2F7D4F·좌표·6/9칸·학습 로직 고정, 화면 셸의 카드 구성·정보 위계·간격만 비교)

기준 시안을 복사해 고칩니다. 승인된 구조·요구사항(구조 지문)은 바꾸지 않고, 정보·기능을 더하지 않습니다. 고친 뒤 explore-check → explore-verify(필요하면 --asset-fallback) → quality.json(목표별 수정 전·후 스크린샷) → explore-quality.
