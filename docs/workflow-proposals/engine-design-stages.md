# 제안: Design Direction · Visual Review 단계 (ai-product-workflow `/product-design`)

- 상태: **제안서**(엔진 코드·규칙 미수정). 승인되면 ai-product-workflow 저장소로 옮겨 설계 문서로 씁니다.
- 작성: 2026-11-10, SMAPSH SCR-211 Figma PoC와 UI UX Pro Max 조사에서 나온 근거를 바탕으로 함.
- 범위: 범용 엔진. SMAPSH 고유 선택(Tailwind, shadcn/ui, Radix, Pretendard, 초록 브랜드)은 예시로만 언급합니다.

## 1. 현재 엔진과 드러난 공백

현재 단계: `ux_planning`(00) → `ux_spec`(01–05, 구조 checkpoint) → `preview`(`design-preview/` + 06, 트리 해시 승인).

| 공백 | PoC에서 드러난 근거 |
|---|---|
| UX 설계와 시각 결정 사이에 단계가 없음 | 글꼴·아이콘·치수·열 너비가 04 4장 "시각 디자인 단계로 넘긴 항목"으로만 남고, 결정 기록과 승인 위치가 엔진 밖(`docs/design-profile/visual-decisions.md`)에 생김 |
| 시각 결과를 규칙으로 검증하는 단계가 없음 | SCR-211에서 안전 영역, 고정 버튼 가림, 360px 넘침을 사람이 계산해야 했음 |
| Figma 결과가 승인 흐름 밖에 있음 | `preview.md`: Figma는 06에 링크만, 변경 감지 없음 |
| 디자인 변경의 성격을 분류하는 규칙이 하나뿐 | "토큰 변경 = UX 설계 변경"이라 브랜드 색만 바꿔도 UX Spec 재승인이 필요 |
| 외부 디자인 스킬·규칙의 위치가 정의되지 않음 | frontend-design, UI UX Pro Max가 승인 문서와 다른 팔레트·스타일을 추천 |

## 2. 단계 구성(제안)

```
ux_planning → ux_spec → design_direction → [render] → visual_review → (preview 승인)
                                             │
                          ┌──────────────────┴───────────────────┐
                    Figma-first 경로                       code-first 경로
                 (Figma 프레임 = 렌더 결과)          (design-preview/ = 렌더 결과)
```

- `design_direction`과 `visual_review`는 **새 단계**입니다. 기존 `preview` 단계는 code-first 경로의 렌더 결과(`design-preview/`)와 최종 시각 승인을 그대로 맡습니다.
- 두 단계는 프로젝트 설정으로 끌 수 있습니다(작은 프로젝트는 기존 흐름 유지). 끄면 현재 엔진과 같습니다.

## 3. Design Direction 단계

| 구분 | 내용 |
|---|---|
| 전제 | `ux_spec` approved |
| 입력 | 승인된 UX Spec(01–05)과 해시 · 토큰 원본(04 → `tokens.json`) · 테마 설정(`theme-separation.md`) · 프로젝트 디자인 프로필(스택, 글꼴, 아이콘, **밀도 정책**) · 제품 맥락 브리프 · 선택형 규칙 출처(외부 스킬·데이터, 출처와 고정 버전 기록) |
| 출력 | `07-design-direction.md`(가칭): VD 목록(ID·근거·상태·출처), 밀도 정책 값, 렌더 경로 선택(Figma-first / code-first / 둘 다), 렌더할 화면·상태 목록(SCR-ID·ST), 비식별 샘플 데이터 규칙, 적용 규칙 목록(규칙 ID·출처·버전) · **변경 요청 목록**(VD로 처리할 수 없는 것: 토큰 의미·정보·행동 변경 → UX Spec 개정 후보, 테마 값 변경 → 테마 게이트) |
| 승인 게이트 | "디자인 방향 승인" — VD 중 '승인' 상태만 렌더에 쓸 수 있음(후보는 표시와 함께 탐색용으로만). 변경 요청이 UX Spec에 해당하면 이 단계에서 진행하지 않고 `reopen --stage ux_spec`을 안내 |
| 보호 | 승인 시 01–05 해시를 `based_on_ux_spec`로 기록. UX Spec이 다시 승인되면 이 단계는 outdated(기존 rebase와 같은 방식) |

밀도 정책(필수 입력): "한 화면에 보이는 목록 행 수 최솟값", "최소 터치 크기", "행 간격 정책" 같은 수치. 외부 스킬이 일반적으로 권하는 '여백 늘리기'가 업무 화면 밀도를 낮추지 못하게 하는 기준입니다.

## 4. 렌더 경로

| 경로 | 렌더 결과 | 엔진이 남길 기록 |
|---|---|---|
| Figma-first | Figma 프레임(이름 규칙 `SCR-### 이름 / ST# 상태 / 플랫폼`) | 파일 키, 프레임 노드 ID, Figma 버전 ID 또는 노드 메타데이터 해시(가능하면), 사용한 MCP 계정·호출 수, 대체 사항(예: 글꼴 대체) |
| code-first | `design-preview/`(현재 엔진) | 현재와 같은 트리 해시 |
| 둘 다 | Figma에서 탐색, Preview에서 확정 | 두 기록 모두. 토큰 일치 검증(§7 P5) 필수 |

Figma는 승인 대상이 아니라 **검토 대상**으로 둡니다(현재 원칙 유지). 최종 시각 승인은 저장소 안의 결과(`design-preview/` + 06)로 합니다. Figma 변경 감지는 버전 ID 기록으로 '검토 시점'만 고정합니다.

## 5. Visual Review 단계

| 구분 | 내용 |
|---|---|
| 전제 | `design_direction` approved, 렌더 결과 존재 |
| 입력 | 렌더 결과(Figma 노드 메타데이터·스크린샷 또는 `design-preview/` 빌드·스크린샷) · 승인된 VD · 밀도 정책 · 적용 규칙 목록 · 화면↔SCR-ST 추적표 |
| 자동 점검 | 토큰 기준 대비비(의미 색 쌍), 터치 크기(노드 크기), 화면 폭 360·390·430에서 넘침·가림 계산, 밀도 수치(첫 화면 행 수), 안전 영역 여백, 고정 요소 아래 여백, 토큰 바인딩 비율(원시 값 사용 여부), 화면·상태 누락 |
| 사람 점검 | 규칙 판정 확정(충족 / 개선 후보 / 의도적 예외 / 명세 공백), 시각 품질 |
| 출력 | `08-visual-review.md`(가칭): 규칙별 판정과 근거(측정값), 명세와의 차이, 결함, FB 항목, 다음 조치 분류(VD 수정 / 구현 메모 / UX Spec 개정 후보 / 테마 변경) |
| 승인 게이트 | "시각 검토 통과" — 결함 0 또는 의도적 예외로 기록됨. code-first 경로에서는 이 통과가 `preview` 제출의 전제 조건 |
| 보호 | 검토한 렌더 결과의 해시(트리 해시 또는 Figma 버전)를 기록. 검토 후 렌더가 바뀌면 통과 무효 |

SCR-211 검토표(`docs/design-profile/reviews/SCR-211-mobile-ux-review.md`)가 이 출력의 견본입니다.

## 6. 기존 승인 해시·revision 보호

- 새 단계는 01–05, 00을 **쓰지 않습니다**. 읽고 해시를 기록만 합니다.
- 상위 단계가 바뀌면 하위 단계는 기존 `invalidate_downstream`과 같은 방식으로 무효화됩니다: `ux_spec` 재승인 → `design_direction`·`visual_review`·`preview` 무효.
- 테마 변경은 `ux_spec`를 건드리지 않고 `visual_review`·`preview`만 무효화합니다(`theme-separation.md`).
- 외부 규칙 출처의 버전이 바뀌어도 기존 승인은 유지되고, 다음 검토부터 새 버전을 씁니다(검토 기록에 버전이 남음).

## 7. 엔진 개선 후보 — 우선순위와 의존성

| 순위 | 후보 | 내용 | 의존 | 근거 |
|---|---|---|---|---|
| P0 | **디자인 변경 영향 분류** | 변경을 ① 정보·행동(UX Spec) ② 토큰 의미·이름(UX Spec) ③ 테마 값(테마 게이트) ④ 시각 표현(VD) ⑤ 구현 메모(코드만)로 분류하는 규칙과 `impact`의 디자인 버전. 모든 후보의 기반 | 없음 | 지금은 "토큰 변경 = UX 설계 변경" 하나뿐. PoC에서 R6·R9 같은 판단을 사람이 함 |
| P1 | **테마 설정** | 브랜드 원시 토큰과 의미 토큰 분리, 개발자 설정 파일, 대비 자동 검증, 테마 전용 승인 기록 | P0 | 초록 브랜드 전환이 UX Spec 재승인을 요구하는 문제 |
| P1 | **Design Direction 단계** | §3 | P0, (P1 테마) | VD·밀도 정책·렌더 경로가 엔진 밖에 있음 |
| P2 | **Visual Review 단계** | §5 | Design Direction | SCR-211 검토를 수작업으로 함 |
| P2 | **모바일 품질 검증** | 360·390·430 폭 계산, 터치 크기, 안전 영역, 고정 요소 가림, 밀도 수치를 Visual Review 자동 점검으로 | Visual Review | R3·R4·R6 |
| P3 | **Figma ↔ React 토큰 검증** | `tokens.json` → Figma Variables(값·코드 문법 `var(--…)`) ↔ `design-preview/src/tokens.css` 3자 일치 검사 | P1(토큰 원본 일원화) | PoC에서 Figma 변수 57개를 `tokens.json`에서 만들었으나 이후 일치 검증 수단 없음 |
| P3 | **외부 규칙 어댑터** | 규칙 출처를 선택형으로 등록(이름, 고정 버전, 규칙 ID, 데이터 경로). 읽기 전용. 결과는 Design Direction의 적용 규칙 목록과 Visual Review 판정에 ID로 인용 | Design Direction(입력 위치) | UI UX Pro Max 데이터에서 SCR-211 규칙 23개 중 다수를 인용함. 플러그인 전체 설치는 위험(실행 스크립트, 자동 호출) |

권장 순서: P0 → P1(테마) → P1(Design Direction) → P2(Visual Review + 모바일 검증) → P3(토큰 검증, 규칙 어댑터).

## 8. 외부 규칙 출처 원칙

- 선택형: 등록하지 않아도 모든 단계가 동작해야 함.
- 읽기 전용: 데이터만 읽고 외부 스크립트를 실행하지 않음. 설치형 플러그인은 권장하지 않음.
- 고정 버전: 출처마다 커밋·버전을 기록하고 결과에 규칙 ID를 인용.
- 권위 순서 최하위: 승인 기획 → UXD → UX Spec → 토큰·테마 → 승인 VD → 외부 규칙·스킬 제안.
- 충돌 시: 외부 규칙을 따르지 않는 결정은 '의도적 예외'로 이유와 함께 기록(SCR-211 R12·R13 예시).
