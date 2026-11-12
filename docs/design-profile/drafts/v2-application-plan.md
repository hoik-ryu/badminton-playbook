# SMAPSH — 디자인 워크플로 v2(M1) 적용 계획 (초안)

- 작성: 2026-11-11. 엔진 `ai-product-workflow` 9d4d375(읽기 전용).
- 이 문서와 같은 폴더의 `07-design-direction.draft.md`, 그리고 `docs/design-profile/theme.json`은 **초안**입니다. 실행된 것은 읽기 전용 명령과 임시 복제본의 모의 실행뿐입니다.

## 1. 현재 승인 상태(실제 저장소, 읽기 전용 확인)

| 단계 | 상태 | 승인 revision | 해시 대조 |
|---|---|---|---|
| Discovery | approved | r3 | `state.yaml` 기록 |
| Planning | approved | r4 | `state.yaml` 기록 |
| UX Planning(00) | approved | r2 (2026-11-10T00:49:46Z) | 00 일치 |
| UX Spec(01–05) | approved | r1 (2026-11-10T01:38:14Z) | 01–05 모두 일치 |
| Preview | not_started | - | - |
| 워크플로 | v1(`config` 없음) | - | `check`: consistent, 문제 0 |

- 미커밋: `.ai-workflow/design-notes.md`(수정), `docs/design-profile/`, `docs/workflow-proposals/`, `experiments/`(미추적). 승인 산출물과 상태 파일은 변경 없음.

## 2. v2 전환 dry-run

| 확인 | 결과 |
|---|---|
| 실제 저장소 `migrate --to v2 --theme-file docs/design-profile/theme.json`(확정 없음) | `dry_run: true`. 변경 예정: `config.workflow = v2`, `config.theme_file`, `stages.design_direction` 추가(not_started, 승인 없음), 테마 기준 해시, `stages.preview.review = null`. 보존: ux_planning r2 · ux_spec r1 · preview r0. 승격 없음 |
| 실행 전후 해시(state.yaml, design.json, docs/design/*, theme.json) | **변경 없음**, 백업 파일도 생기지 않음 |
| 임시 복제본(scratchpad)에서 `--confirm` 모의 적용 | 성공. ux_planning·ux_spec 승인 해시 그대로, `check` consistent |
| 모의 적용 뒤 `theme-check` | 계약 통과(오류 0). 04와 다른 값 3개: `color.action.primary` #1D5BD0 → #006D68, `color.focus.ring` #1D5BD0 → #008F89, `font.family.base` → Pretendard. 테마에 없는 04 토큰 60개는 04 값으로 렌더 |
| 모의 적용 뒤 `begin --stage design_direction` + 07 초안 `trace` | 형식 오류 0. 제출 차단 14건은 모두 '결정 대기'(후보 VD 7, ①·② CR 3, 미확정 분류 CR 4) |

- 게이트(`--enable-gate design_direction`)는 계획에 넣지 않았습니다. 켜면 프리뷰 시작·제출·승인에 Design Direction 승인이 필요해집니다(별도 결정).

## 3. 테마와 UX Spec·토큰의 관계

- 04(승인)는 토큰 **이름·의미와 승인 당시 값**의 기준으로 남습니다. 04는 고치지 않습니다.
- `theme.json`은 04에 **이미 있는 토큰의 렌더링 값**만 정합니다(엔진 계약 `design-theme/v1`).
- C안 전용 의미 토큰 6개(헤더 띠 배경·글자, 선택 표시 배경·글자, 현재 탭, 비텍스트 강조)는 04에 없습니다. 그래서 테마에 넣을 수 없고, 넣으려면 ②(UX Spec 개정)입니다 → 07 CR-003.
- 팀·코트·상태 색은 04 값 그대로입니다. `color.court.me`는 04 값이 이전 주 행동 색과 같은 파랑이지만, 의미가 다르므로 바꾸지 않습니다.

## 4. 변경 요청 분류(엔진 `impact --design`, 모의 v2)

| CR | 내용 | 분류 | 영향 |
|---|---|---|---|
| CR-001 | 안내 배너 제거 | ① | ux_spec 재검토 |
| CR-002 | '게스트 추가' 헤더로(UXD-026 위치 고정) | ① | ux_spec 재검토 |
| CR-003 | C안 전용 의미 토큰 6개 | ② | ux_spec 재검토 |
| CR-004 | 헤더 + 검색 브랜드 띠 | conditional(④ 또는 ①) | 사용자 판단 |
| CR-005 | 하단 탭 64(명세 56) | conditional(④ 또는 ①) | 사용자 판단 |
| CR-006 | 점수 오른쪽 열(UXD-074 표기) | needs_review | 사용자 판단 |
| CR-007 | 하단 탭 아이콘 | conditional(④ 또는 ①) | 사용자 판단 |
| CR-008 | 청록 주 행동 색·포커스 링, Pretendard | ③ | 테마 파일 → preview만 |
| CR-009 | 헤더 버튼 보이는 높이 36 | ④ + spec_conflict | Design Direction |
| CR-010 | 반경 16·18 | ④ + outside_tokens | Design Direction |

**정식 렌더에서 고를 길**: (가) ①·② 기각 — 승인 명세대로(배너 유지, 오른쪽 아래 '게스트 추가', 흰 헤더 + 청록 주 행동). UX Spec 승인을 유지합니다. (나) UX Spec r2 개정 — `reopen --stage ux_spec`으로 C안 구조를 명세에 반영. 기존 UX Spec 승인과 하위 단계가 다시 승인 대상이 됩니다.

## 5. 다음 화면 선정(SCR-211 다음)

| 순서 | 화면 | UX Spec 연결 | 재사용(SCR-211 PoC) | 새로 필요 | 렌더 상태 |
|---|---|---|---|---|---|
| 1 | **SCR-201 운영 홈** | 02 SCR-201(운영 셸, '운영' 탭 첫 화면), FLOW-001-S4, UXD-066. 이탈 SCR-211 | CMP-025 AppNav, CMP-026 PageHeader, CMP-005 Badge, 토큰·검증 스크립트 | **CMP-030 ListItem**(아이콘 + 제목 + 배지/화살표, 높이 48) | ST1 |
| 2 | **SCR-212 회원·게스트 편집** | 02 SCR-212(패널: 모바일 하단 시트), FLOW-003-S2·S4–S7, UXD-021·022·024·067. 진입 SCR-211 행 | CMP-005 Badge, CMP-001 Button(shadcn), CMP-006 Input, 명단 mock 데이터 | **CMP-021 Sheet**(하단, 내용 높이), **CMP-002 SegmentedControl**(성별), **CMP-003 ChoiceGrid**(급수 4열·점수 5열), **CMP-045 RecordSummary**, (ST10) CMP-022 ConfirmDialog | ST1, ST7 |
| 3 | **SCR-213 사람 추가** | 02 SCR-213(시트), FLOW-003-S3·S2, UXD-014·026·027. 진입 SCR-211 '게스트 추가'·더보기 | 2번에서 만든 Sheet·SegmentedControl·ChoiceGrid·TextField, Button | 없음(재사용 검증), NoticeBox(CMP-023, ST7 안내) | ST1, ST7 |

- 선정 이유
  - SCR-201 → SCR-211 → SCR-212 / SCR-213으로 운영진의 실제 이동 흐름이 이어집니다(행 누르기, '게스트 추가').
  - 공통 부품 재사용률이 높습니다. 2번에서 만든 시트·입력 부품을 3번이 그대로 씁니다.
  - 모바일 하단 시트(높이, 키보드, 안전 영역)를 처음 검증하는 화면입니다.
- 구현 순서: SCR-211(PoC 이식) → SCR-201 → SCR-212 → SCR-213. 화면마다 측정 → 수정 → 재측정 → 사람 확인.

## 6. SCR-211 PoC 재사용 계획

| PoC 자산 | 정식 프리뷰에서 | 주의 |
|---|---|---|
| `src/components/smapsh/*`, `src/screens/Scr211Roster.tsx` | `design-preview/src/` 아래로 복사 | **프리뷰 경계 규칙: `@/` 별칭 금지, 상대 경로만.** import를 상대 경로로 바꿈. `data-experimental` 요소는 CR 결정에 따라 정리 |
| shadcn/ui 부품 5개(`src/components/ui/`) | 같은 버전(4.23.0, `radix-nova`)으로 `add --dry-run` 확인 뒤 다시 추가하거나 복사 | `cn`·`radix-ui` 의존성을 정확한 버전으로 고정. `switch.tsx`의 `lg` 크기 수정 포함 |
| `scripts/gen-tokens.mjs` + `themes/c-mint-hybrid.json` | 엔진 `theme-check --print-css`의 기대 CSS로 `src/tokens.css`를 맞춤 | C안 전용 토큰은 CR-003 결정 전까지 쓰지 않음 |
| `scripts/review.mjs`(Playwright 측정) | 엔진 M2(`preview-review`)가 아직 없으므로 프로젝트 보조 스크립트로 둠 | 프리뷰 트리 해시 대상에 들어가는지, 의존성(Playwright)을 프리뷰 `package.json`에 둘지 결정 필요 |
| `review/results.json`, 스크린샷 | 실험 기록으로 보존 | 정식 승인 근거가 아님 |
