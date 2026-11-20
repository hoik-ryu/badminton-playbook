# 튜토리얼 MVP 제품 구현 계획과 승인 문서 편차 제안 (SCR-101·102·103)

- 작성: 2026-11-19
- 상태: **사용자 결정(2026-11-19) — 편차 원장으로 기록, 승인 문서(PRD r7 등)·`state.yaml`은 바꾸지 않음.** PRD 본문 반영은 다음 기획 개정 때 함께 합니다(사용자 선택: '결정 기록으로 진행').
- 사용자 결정 원문(2026-11-19): "기존 ASM-034의 프런트 정적 콘텐츠 및 클라이언트 점수 전송 방식은 변경하겠습니다." 새 MVP 구조 — "튜토리얼 콘텐츠는 백엔드의 버전별 JSON 파일로 관리 / FastAPI를 통해 과정·스테이지·상황 데이터 제공 / 프런트엔드는 API에서 받은 콘텐츠로 화면 구성 / 향후 중급·고급 과정 추가 시 프런트 코드 수정 최소화 / 기존 PostgreSQL tutorial_progress 테이블 재사용 / 정답·허용·오답 및 점수 판정은 서버에서 수행 / 첫 시도 정답만 1점 / 재도전 점수 0점 / 사용자별 진행률과 최고 점수 영속 저장 / 선택 이력은 영구 저장하지 않음 / 콘텐츠 관리용 관리자 UI와 DB 마이그레이션은 MVP에서 제외" · "서명된 회차 토큰 방식은 검토하되, 중복 요청·토큰 재사용·재도전 점수 조작을 막을 수 있는 최소한의 서버 측 검증을 포함하세요." · "이미 승인된 게임 규칙, 코트 좌표, UI 디자인, 사용자 흐름은 변경하지 않습니다."
- 결정 결과: D-T1·D-T2 **채택**, D-T3 해석 확인(선택 이력 영구 저장 안 함). D-T4 **(b) 짧은 수명의 DB 회차 관리를 설계 방향으로 선택**(사용자 결정 2026-11-20 "짧은 수명의 DB 회차 관리 방식(b)을 설계 방향으로 선택합니다. 단, 이번 작업에서 DB 마이그레이션을 실행하지 마세요."). 스키마 변경·마이그레이션은 §6 설계 검토 후 별도 승인.
- 기준: PRD r7, AC(05) r7, UX Planning r6, UX Spec r5, Design Direction r6(제출, 승인 대기)
- 이 문서의 코드·API·스키마 제안은 실제 적용 전에 사람이 검토하고 테스트해야 합니다.

## 1. 결정이 필요한 편차(D-T1–D-T3)

사용자 요청(2026-11-19) "튜토리얼 콘텐츠는 프론트엔드에 하드코딩하지 말고 백엔드에서 받아오는 구조로 구현하세요." · "점수·통과 판정은 클라이언트 조작을 신뢰하지 않는 구조를 검토하세요. 콘텐츠 정답이 클라이언트에 노출되는 문제도 고려해 서버 검증 방식을 제안하세요."는 승인된 PRD r7과 다음 부분이 다릅니다.

| ID | 승인 문서(현재) | 요청 | 제안 | 영향 |
|---|---|---|---|---|
| D-T1 | ASM-034(`02-prd.md` 226행): "시나리오 본문·코트 분할 좌표·예상 학습 시간은 지금처럼 **프런트 정적 데이터**에 둡니다." "진행 저장·조회 API는 바꾸지 않습니다." | 콘텐츠를 백엔드에서 받음 | 콘텐츠를 백엔드 모듈 안의 버전별 JSON 파일(`backend/app/modules/tutorial/content/<stage_id>.json`)로 옮기고 조회 API로 내려줌. **DB 구조 변경·마이그레이션 없음** | PRD ASM-034 개정(기획 재승인 필요). NFR-009·AC-117(자동 검사)은 백엔드 테스트로 충족 |
| D-T2 | ASM-034 "진행 저장·조회 API는 바꾸지 않습니다"(`PUT /stages/{id}` `{score,total}` — 클라이언트가 점수를 보냄) | 서버가 점수·통과를 판정 | 무상태 회차 토큰 방식(§3). 저장 API의 요청 형식이 바뀜 | PRD ASM-034 개정. 저장 항목(C-23·NFR-006)은 그대로 |
| D-T3 | NFR-006·C-23: "튜토리얼 상황별 선택 기록은 수집하지 않습니다." | (충돌 회피 조건) | 선택은 **DB에 저장하지 않음**. 판정 요청에 칸 번호가 오가지만 서버는 서명 토큰에 상황별 첫 판정(정답·허용·오답)만 담아 돌려주고 보관하지 않음. 로그에도 남기지 않음 | 규칙 유지(편차 아님) — 해석 확인만 필요 |

- PRD 81행("콘텐츠 검수 시스템이나 관리자 승인 워크플로는 만들지 않습니다")에 따라 관리자 편집 화면은 만들지 않습니다. 콘텐츠 변경은 JSON 파일 + 코드 리뷰(7.3절 체크리스트)로 합니다.
- 중급·고급은 JSON과 레지스트리 항목만 추가하면 되고 프런트 코드는 바꾸지 않습니다(NFR-009, AC-116). 현재 중급·고급 콘텐츠는 만들지 않습니다.

## 2. 현재 제품 코드 요약

- 라우트(`frontend/src/routes/router.tsx`): 회원 셸 아래 `tutorial`(목록)·`tutorial/stages/:stageId`(플레이)·`.../result`(결과). 플레이·결과는 탭바 숨김, 나가기 확인(`useBlocker`)
- 프런트 기능(`frontend/src/features/tutorial/`): 선택지(Choice) 방식 엔진(`engine/logic.ts` — 첫 시도 정답 1점·재도전 0점·70% 통과는 재사용 가능), 2D 코트, 옛 ID(`beginner`·`novice`) 초안 콘텐츠, `api.ts`(`getMyTutorialProgress`·`saveStageResult`)
- 백엔드(`backend/app/modules/tutorial/`): `tutorial_progress`(회원+스테이지 PK, passed·best·first_passed_at), `stage_registry.json`(옛 6개 ID), `GET /api/me/tutorial/progress`, `PUT /api/me/tutorial/stages/{id}`(서버가 통과 재계산, 원자적 upsert, 404·409·422), `passed_counts()`(옛 2개 난이도 고정 — roster가 사용)
- 인증: 세션 쿠키 → `approved_user`, 상태 변경은 `verify_origin`. 진행은 `user.id`로만 묶임(본인 것만)
- 승인 기준과 다른 곳: 스테이지 ID(`intro-1-v1` 등, ASM-033), 과정 이름(입문자·왕초급·초급·중급·고급), 칸 번호 판정(AC-090), 토큰 3개(`color.accent.*`·`color.text.accent`)가 제품 `tokens.css`에 없음, 경기장 자산이 `frontend/public`에 없음

## 3. 서버 판정 방식(제안, D-T2)

1. `GET /api/me/tutorial/courses` — 과정(ID·이름·순서·분할·출시 여부)·스테이지(ID·순번·제목·예상 시간)와 본인 진행(passed·best)을 함께 돌려줌(SCR-101)
2. `GET /api/me/tutorial/stages/{id}` — 상황 데이터(설명·질문·선수 시작 위치·셔틀 출발/멈춤 위치·분할)만. **정답·허용 칸·떨어지는 지점·파트너 목표·해설은 빼고** 보냄. 회차 토큰 `runToken`(HMAC 서명, 기존 세션 비밀값 사용: user·stage·만료·상황별 첫 판정 배열)을 함께 줌
3. `POST /api/me/tutorial/stages/{id}/judge` `{runToken, situation, cell}` — 판정(정답·허용·오답)·정답 칸·허용 칸·떨어지는 지점·파트너 목표·해설과 갱신된 토큰을 돌려줌. 서버는 **상황별 첫 판정만** 토큰에 기록(재도전은 토큰을 바꾸지 않음 → 재도전 0점 규칙을 서버가 강제, AC-092). 입문자(guided)는 허용 칸 없음(AC-112)
4. `PUT /api/me/tutorial/stages/{id}` `{runToken}` — 서명·만료·사용자·5개 상황 판정 완료를 검증하고 서버가 점수·통과(70%)를 계산해 기존 upsert로 저장(멱등). 옛 `{score,total}` 형식은 거부
- 한계: 회원이 한 회차에서 오답으로 정답을 알아낸 뒤 '다시 하기'로 새 회차에서 맞히는 것은 막지 않습니다(규칙상 허용, 최고 점수만 남음).
- 서버 검증(최소): 토큰 서명·만료·사용자·스테이지 일치, 상황 순서(커서)·같은 상황의 첫 판정 고정(재도전은 토큰을 바꾸지 않음), 저장은 기존 원자적 upsert라 같은 토큰을 다시 보내도 결과가 같음(중복 요청 멱등), 5개 상황 판정 완료 전 저장 거부.
- **D-T4(미결, 3단계 전 결정)**: 서버에 상태가 전혀 없으면 '토큰 되감기'를 막을 수 없습니다. 상황 i를 판정하기 전 토큰을 보관해 두었다가, 오답으로 정답을 본 뒤 그 이전 토큰으로 같은 상황을 다시 판정하면 첫 시도 정답으로 기록됩니다. 막으려면 서버가 '이미 판정한 회차·상황'을 기억해야 합니다. 선택지: (a) 한계로 수용(학습용 자기 점수, 운영진 통과 현황에만 영향), (b) 짧은 수명의 회차 표(`tutorial_runs`: 회차 id·회원·스테이지·상황별 첫 판정·만료 — 선택한 칸은 저장하지 않음, NFR-006 유지)를 추가 — **DB 마이그레이션 필요(별도 승인)**, (c) 서버 프로세스 메모리에 회차 기억 — 마이그레이션 없음, 서버 1개 프로세스일 때만 유효(재시작·다중 워커에서 깨짐).

## 4. 작업 단위(순서대로, 단위마다 `make check`, DB 테스트는 `make test-db`)

| # | 작업 | 주요 파일 | AC | 승인 필요 |
|---|---|---|---|---|
| 1 | 레지스트리를 새 ID·과정 구조로(ASM-033·034 범위 안) | `stage_registry.json`, `registry.py`, `router.py:passed_counts`, `roster/router.py`, `test_tutorial.py`, FE `registry.test.ts` 대체 | AC-093, AC-118, AC-119 | 제품 코드 수정 승인 |
| 2 | 콘텐츠 JSON 형식·로더·자동 검사(MVP 8개 스테이지, 프리뷰 데이터에서 이전) | `tutorial/content/*.json`, `content.py`, `schemas.py`, `test_tutorial_content.py` | AC-117, AC-116(15칸 시험 데이터) | D-T1 |
| 3 | 콘텐츠 조회·판정·저장 API(§3) | `router.py`, `token.py`, 테스트 | AC-090–092, AC-094, AC-112, AC-113, AC-115 | D-T2 |
| 4 | SCR-101 연결 | `features/tutorial/api.ts`(Mock은 픽스처 분리), `TutorialHomePage.tsx`, 카드 컴포넌트, `tokens.css`·`tailwind.css` 토큰 3개, AST-027–037·046 자산 | AC-093, AC-120, AC-121 | - |
| 5 | SCR-102 게임 컴포넌트 | `features/tutorial/court/{projection.ts, cells.ts, StadiumCourt.tsx}`(프리뷰에서 분리·이전), `engine/`(칸 번호 상태기계, 렌더링 없이 테스트), `StagePlayPage.tsx`, `frontend/public/game/*` | AC-090, AC-096, AC-111, AC-114, AC-115, AC-095 | - |
| 6 | SCR-103 결과 저장·조회(틀린 상황 다시 보기는 경기장 컴포넌트) | `StageResultPage.tsx`, roster 타입 | AC-094, AC-092, AC-100, AC-067 | - |
| 7 | 전체 흐름 테스트 | FE 통합 테스트(Mock), API 모드 E2E(`e2e-guard`) | 전체 | - |

- 재사용 원칙: 프리뷰 코드를 복사해 두 벌로 두지 않고, 순수 로직(`courtProjection`·`cells`·방향 결정·상태기계·점수)과 렌더링(`StadiumCourt`)을 `features/tutorial/` 아래로 옮겨 제품 한 곳에서만 유지합니다. 프리뷰 전용(해시 라우팅·Mock·registry)은 옮기지 않습니다.
- 콘텐츠 이전 시 정답·허용 칸 등은 백엔드 JSON에만 두고 프런트 번들에 넣지 않습니다(D-T1·D-T2 승인 시).

## 5. 진행 기록

| 단계 | 상태 | 검증 |
|---|---|---|
| 1. 레지스트리 새 ID·과정 구조 | 완료(사용자 수용 2026-11-20, DB 통합 테스트 미실행으로 최종 검증 보류) | `make check` 통과. `make test-db` 미실행(Docker 데몬 꺼짐) |
| 2. 백엔드 JSON 콘텐츠·조회 API | 구현 완료(2026-11-20) | `make check` 통과(백엔드 1415·프런트 179). `make test-db` 미실행(Docker 데몬 꺼짐) |
| 3. 서버 판정·결과 저장 API | 구현 완료(2026-11-20). **0010 마이그레이션은 작성만, 미적용(사용자 승인 대기)** | `make check` 통과(백엔드 1439·프런트 179). 마이그레이션은 오프라인 SQL 렌더링·모델 DDL 대조로만 확인. `make test-db` 미실행(Docker 데몬 꺼짐, 0010 적용 필요) |
| 0010 로컬 적용 | 완료(2026-11-20, 사용자 승인: 로컬 Docker Compose PostgreSQL 한정) | 대상 `db:5432/app` 확인, 적용 전 백업(세션 임시 폴더, 표 11개·행 0), `make migrate` 0009→0010, `make test-db` 20개 통과(동시 판정·동시 완료·CASCADE 포함), 테스트 잔여 행 0 |
| 4. SCR-101 제품 연동 | 구현 완료(2026-11-20) | `make check` 통과(백엔드 1439·프런트 185), `make test-db` 20개 통과. 제품 화면 3폭 캡처·측정(`docs/workflow-proposals/review/tutorial-step4-scr101/`) |
| 5. SCR-102 경기장 게임 | 구현 완료(2026-11-20) | `make check` 통과(백엔드 1439·프런트 197), `make test-db` 20개 통과. 제품 화면 3폭 흐름 캡처(`docs/workflow-proposals/review/tutorial-step5-scr102/`) |
| 6. SCR-103 결과·서버 저장 | 구현 완료(2026-11-20) | `make check` 통과(백엔드 1441·프런트 195), `make test-db` 21개 통과(실제 PostgreSQL 전체 흐름 포함). 제품 화면 3폭 캡처(`docs/workflow-proposals/review/tutorial-step6-scr103/`) |
| 7. 전체 흐름·회귀 검증 | 완료(2026-11-20) | 실제 api 모드 브라우저 E2E 21단계 통과(임시 DB `smapsh_e2e`, `APP_ENV=e2e`, `e2e-guard` 확인), `make check` 통과(백엔드 1441·프런트 197), `make test-db` 21개 통과, Mock 3폭 흐름·다른 화면 스타일 확인(`docs/workflow-proposals/review/tutorial-step7/`) |

### 2단계 결과

- 콘텐츠: `backend/app/modules/tutorial/content/<stage_id>.json` 8개(40상황). **Preview 흐름 예시를 옮긴 미검수 초안** — `content/REVIEW_CHECKLIST.md`에 알려진 문제와 체크리스트(모두 미체크, 배포 금지). 검수 기록은 데이터 안에 두지 않음(PRD 7.3)
- 레지스트리: 과정에 `guided`(입문자 안내형, ASM-037) 추가. 스테이지 ID 형식 `<과정>-<순번>-v<버전>` 검사, 코트 분할 `grid-<열>x<행>`을 열·행으로 읽음
- 로더·검사: `content.py` — Pydantic(정의되지 않은 필드 거부) + `validate_content`(AC-117 8개 규칙, 좌표 범위·내 편/상대 편 배치, 도착 칸·이동 목표점이 칸과 맞음, 파일 이름·버전·레지스트리 일치). 오류면 첫 사용 때 실패
- API(기존 `/api/me/tutorial` 라우터, 승인 회원):
  - `GET /courses` → `{courses: [{id, name, order, grid{id, cols, rows}, released, guided, stages: [{id, no, version, title, minutes, thumbnail, situations}]}], passRule{numerator, denominator}}`. 미출시 과정은 `stages: []`. 진행 기록은 기존 `GET /progress` 그대로(중복 없음)
  - `GET /stages/{id}` → `{id, course, courseName, no, version, title, minutes, thumbnail, guided, grid, passRule, situations: [{no, description, question, start{me, partner, opponents}, shuttle{from, stop} | null}]}`. 판정 데이터(정답·허용 칸, 떨어지는 지점·도착 칸, 파트너 목표, 이동 목표점, 해설) 없음
  - 레지스트리에 없는 ID(개편 전 ID 포함)·미출시 과정 스테이지 → 404 `stage_not_found`. 기존 `PUT /stages/{id}`도 미출시 과정 스테이지를 같은 404로 거부
- 남은 차이: 02 SCR-101-ST2·ST4는 "콘텐츠는 앱 포함 정적 데이터"를 전제로 함. 콘텐츠를 API로 받으면 콘텐츠 로딩·실패 상태가 새로 생김 → 4단계에서 화면 처리 방식 확인 필요(UX 변경 여부 판단)

## 6. 3단계 설계: 짧은 수명의 DB 회차(D-T4 (b) 확정 2026-11-20 — 구현 완료, 마이그레이션 미적용)

> 확정(사용자 결정 2026-11-20): "D-T4는 (b) PostgreSQL `tutorial_runs` 회차 테이블 방식으로 확정합니다." NFR-006 해석: "사용자가 선택한 칸 번호와 개별 선택 이력은 저장하지 않습니다. 다만 점수 조작 방지에 필요한 상황별 최초 판정 결과(c/a/w/-)는 회차 유효기간 동안 임시 보관할 수 있습니다. 이 정보는 학습 분석, 행동 추적, 통계 목적으로 사용하지 않습니다."
>
> 구현에서 정한 세부: 판정 응답은 `scored` 대신 `firstVerdict`·`points`(첫 판정 기준)를 돌려줘 같은 요청의 재전송이 같은 응답이 되게 했습니다. 지난 상황을 다시 판정(재도전)하는 것은 허용하되 기록은 바뀌지 않습니다. 완료 응답은 기존 진행 기록 키(`passed`·`best`·`firstPassedAt`)에 `run{score, total, passed, wrong}`을 더했습니다.

서명 토큰 대신 **DB 회차 행을 유일한 기준**으로 씁니다. 회차 ID는 서버가 만든 임의 UUID(추측 불가)이고, 모든 검사는 DB 행으로 하므로 HMAC 서명·토큰 되감기 문제가 없어 구현이 더 단순합니다.

### 6.1 스키마(새 리비전 `0010_add_tutorial_runs`, downgrade = 표 삭제)

| 열 | 형식 | 설명 |
|---|---|---|
| `id` | UUID PK | 회차 ID(서버 생성, `uuid4`) |
| `user_id` | UUID FK `users.id` ON DELETE CASCADE | 회원. 다른 회원의 회차는 404 |
| `stage_id` | String(32) | 레지스트리 스테이지 ID. 콘텐츠 버전은 ID에 포함(`-v1`, C-28) |
| `content_hash` | String(16) | 회차 시작 때 콘텐츠 파일 SHA-256 앞 16자. 회차 중 콘텐츠가 바뀌면 409 `content_changed` |
| `first_verdicts` | String(5) | 상황별 **첫 판정**만: `c`(정답)·`a`(허용)·`w`(오답)·`-`(아직). 고른 칸 번호는 저장하지 않음 |
| `created_at` | timestamptz | 시작 시각 |
| `expires_at` | timestamptz, 인덱스 | 시작 + 2시간 |
| `completed_at` | timestamptz NULL | 결과 저장 시각(저장 후에는 판정 불가, 같은 저장 요청은 같은 결과) |

- 제약: `CHECK (length(first_verdicts) = 5)`(상황 수 5 고정이 바뀌면 길이 가변으로), 인덱스 `(user_id, stage_id)`, `(expires_at)`
- `tutorial_progress`와는 FK 없이 독립. 결과 저장 때 같은 트랜잭션에서 기존 원자적 upsert(통과 OR·최고 MAX·최초 통과 시각)를 그대로 호출. `tutorial_progress` 구조는 바뀌지 않음

### 6.2 API(3단계, 기존 라우터)

1. `POST /api/me/tutorial/stages/{id}/runs` → `{runId, expiresAt}`. 같은 회원·스테이지의 끝나지 않은 회차는 지움(새 시도가 대체), 만료된 회차 정리(아래)
2. `POST /api/me/tutorial/runs/{runId}/judge` `{situation, cell}` → `{verdict, scored, answer, allow, landing, landingCell, partnerCell, target, explanation}`
   - 상황 순서대로만(앞 상황이 판정되지 않았으면 409 `out_of_order`), 칸 범위 밖 422
   - 그 상황의 `first_verdicts`가 `-`일 때만 기록(`scored: true`). 이미 판정한 상황(재도전)은 판정만 돌려주고 기록은 그대로(`scored: false`) → **재도전 0점을 서버가 강제**, 되감기 불가
3. `PUT /api/me/tutorial/stages/{id}` `{runId}`(기존 경로, 요청 본문 교체) → 5개 상황 모두 판정됐는지 확인 → 점수 = `c` 개수, 통과 = 70% → upsert → `completed_at` 기록 → 기존 응답 `{passed, best, firstPassedAt}` + `{score, wrong: [{no, kind}]}`. 옛 `{score, total}` 본문은 422
   - 이미 완료된 회차를 다시 보내면(재시도·시간 초과 재전송) upsert를 다시 하지 않고 같은 결과 반환(멱등)

### 6.3 중복·재사용·동시성

- 회차 행을 `SELECT … FOR UPDATE`로 잠그고 판정·완료(PostgreSQL). 같은 상황을 동시에 판정해도 첫 판정은 하나만 기록
- 만료(`expires_at < now`) → 410 `run_expired`, 완료 후 판정 → 409 `run_completed`, 다른 회원·없는 회차 → 404 `run_not_found`
- 완료 요청 동시 2건: 잠금 + `completed_at` 확인으로 한 번만 upsert(upsert 자체도 멱등)
- '다시 하기'는 새 회차(규칙상 허용). 최고 점수만 남음

### 6.4 만료·정리

- 수명 2시간(한 스테이지 약 2–4분). 별도 작업 큐(범위 외: Celery 등) 없이 **회차 시작 요청 때** 만료된 행을 지움(`DELETE … WHERE expires_at < now() - interval '1 day'`, 완료 회차 포함). 완료 회차는 멱등 응답을 위해 만료까지만 남김
- 운영 데이터 정리용 수동 명령(`make tutorial-cleanup`)은 필요해지면 추가

### 6.5 NFR-006(선택 기록 미수집)과의 관계 — 사용자 확인 필요

- 고른 칸 번호는 DB·로그 어디에도 저장하지 않음(요청 처리 중에만 사용)
- 상황별 **첫 판정 결과**(c/a/w)는 회차가 살아 있는 동안(최대 2시간 + 정리 주기)만 저장되고, 운영진 화면·API에 나오지 않으며 기간이 지나면 지워짐. 영구 저장 항목은 기존과 같음(통과 여부·최고 점수·최초 통과 시각)
- 이 일시 저장이 NFR-006 "상황별 선택 기록은 수집하지 않습니다"에 어긋나지 않는다는 해석을 승인 때 확인받습니다(어긋난다고 보시면 회차에는 '첫 시도 정답 여부' 비트만 두고 허용·오답 구분은 결과 화면에서 클라이언트 표시로 대체 — 다만 결과 화면의 틀린 상황 종류 표시는 서버 근거를 잃음)

### 6.6 테스트(3단계)

- AC-092(첫 시도 정답만 1점·재도전 0점·70%), AC-091·113·112·115, AC-094(멱등), 되감기(같은 상황 재판정은 점수 불변), 순서 위반, 다른 회원 회차, 만료·완료 후 판정, 콘텐츠 변경 감지, 동시 판정·동시 완료(`make test-db`), NFR-006(표에 칸 번호 열 없음)

### 6.7 3단계 결과(2026-11-20)

- 모델 `TutorialRun`(`app/modules/tutorial/models.py`), 마이그레이션 `alembic/versions/20261120_0010_add_tutorial_runs.py`(작성만, **미적용**). 오프라인(`alembic upgrade 0009:0010 --sql`)으로 렌더링한 SQL과 모델 DDL이 열·제약·인덱스까지 같음을 확인, head는 `0010` 하나
- API: `POST /stages/{id}/runs`, `POST /runs/{runId}/judge`, `PUT /stages/{id}` `{runId}`(본문 교체). 오류 코드: `run_not_found`(404), `run_expired`(410), `run_completed`·`run_incomplete`·`out_of_order`·`content_changed`(409), `invalid_situation`·`invalid_cell`·`validation_error`(422)
- 첫 판정 배열로 순서·재도전 제어가 되는지: 다음 첫 판정 대상은 배열의 첫 `-` 위치 하나뿐(앞 상황이 `-`면 409). 이미 판정한 상황은 몇 번을 보내도 기록이 바뀌지 않음(재도전·재전송 모두). 배열만으로 충분 — 단, '재도전'과 '재전송'을 서버가 구분하지 않으며 둘 다 점수에 영향이 없으므로 구분할 필요가 없음
- 정리 정책: 수명 2시간, 회차 시작 요청마다 `expires_at < now − 1일` 행을 전부 삭제(완료 회차 포함) + 같은 회원·스테이지의 끝나지 않은 회차 삭제. 사용이 없으면 행도 늘지 않으므로 무기한 누적 없음. 회원 삭제 시 CASCADE
- `{score, total}` 의존 조사와 변경 범위:
  - 백엔드: `PUT /stages/{id}`의 본문이 `{runId}`로 바뀜(옛 본문 422). 응답은 기존 키 유지 + `run` 추가
  - 백엔드 테스트: `test_tutorial.py`·`test_tutorial_content.py`·`test_tutorial_db.py`를 회차 방식으로 바꿈(`tests/modules/tutorialkit.py` 도우미)
  - 프런트(바꾸지 않음, UI 수정 금지): `features/tutorial/api.ts`의 `saveStageResult`(api 모드 `{score, total}`)와 이를 흉내 내는 `features/auth/apiMode.test.tsx`. 옛 화면은 이미 옛 ID라 api 모드 저장이 404였고, 이제 본문 형식도 맞지 않음 → 4–6단계에서 회차 API로 교체. Mock 모드는 영향 없음
  - E2E: 튜토리얼 저장 호출 없음

## 7. 4단계 결과(SCR-101 제품 연동, 2026-11-20)

- 화면: `frontend/src/pages/TutorialHomePage.tsx`를 Preview r3 SCR-101(V04-A) 마크업으로 교체. 데이터는 `GET /courses`(과정·스테이지) + 기존 `GET /progress`(본인 진행)를 따로 불러옴(`features/tutorial/api.ts`의 `getTutorialCourses`, Mock 어댑터는 `mockRegistry.ts`)
- 상태(사용자 결정 2026-11-20, SCR-101 안에서): ST2 스켈레톤(배치 유지, 목록을 받으면 진행 자리만 스켈레톤), ST4 목록 실패(`data-error=courses`, 안내 + 다시 시도), ST4 진행 실패(`data-error=progress`, 카드·행은 보이고 누를 수 있음, 통과·점수 표시 없음, 이어서 하기 숨김, 다시 시도), ST3, ST7
- 레지스트리 과정에 `description`·`icon`(Preview 승인 문구·AST-035–037) 추가 → `/courses` 응답에 포함(새 과정도 프런트 수정 없이 표시)
- 토큰: 제품 `tokens.css`에 승인 토큰 3개(`accent.mint`·`accent.subtle`·`text.accent`)만 추가, Tailwind 별칭 `ink-accent`·`mint-subtle`·`mint`. **제품 테마의 나머지 값(action.primary #006D68 → #0B9E8B, bg.page, focus.ring)과 DD 4.1 작은 주 버튼 규칙은 앱 전체 영향이라 미반영(결정 필요)**
- 자산: `frontend/public/assets/AST-027–037·046.png`(등록 원본과 SHA-256 동일), 스타일 `frontend/src/styles/tutorial.css`(배너·옅은 그림자)
- 스테이지 이동: `/tutorial/stages/<새 ID>`로 이동. 플레이 화면(SCR-102)은 아직 옛 화면이라 새 ID에서 '준비 중인 스테이지'(5단계에서 교체)
- 알려진 차이: 360px 폭에서 스테이지 행의 부제('… · 최고 n/5')가 말줄임으로 잘림(디자인의 `truncate`, 접근 가능한 이름에는 전체 정보). 개발 서버의 StrictMode에서는 Mock 일회성 실패 스위치가 이중 실행으로 소모되어 오류 상태가 보이지 않음(운영 빌드·단위 테스트에서는 정상, 실제 API 실패에는 해당 없음)

## 8. 5단계 결과(SCR-102 경기장 게임, 2026-11-20)

- 구조(`frontend/src/features/tutorial/`): `court/`(courtProjection·cells·StadiumCourt — Preview r3에서 옮김, 칸 분할은 서버 grid의 열 × 행), `play/`(parts = 상단 바·단계·질문·재생·판정·버튼, logic = 점수·틀린 상황·판정 문구·오류 회복 — 렌더링 없이 시험), `mock/`(server.ts·content/*.json — Mock 판정 서버, mock 빌드 전용)
- 화면: `pages/StagePlayPage.tsx` 교체. 진입 → GET /stages/{id} → POST /runs → 상황 재생 → 칸 선택(단일 터치 또는 ST12) → POST /judge → 정답·허용·오답 → 다시 도전·올바른 움직임 보기(느리게) → 다음 상황 → 마지막 뒤 `/tutorial/stages/{id}/result`로 이동(상태 `run: {runId, stageId, score, total, wrong}`)
- 점수: 서버 응답의 `points`만 상황별로 기록해 더함(첫 시도 정답 1점, 재도전 0점). 판정 중 입력 잠금(중복 요청 1건), 네트워크 오류는 같은 선택으로 다시 보냄, 410·409·회차 없음은 새 회차로 처음부터, 401은 로그인, 없는·미출시·개편 전 ID는 ST5
- 정답 비노출: Mock 판정 서버는 `import.meta.env.VITE_DATA_SOURCE === 'mock'`일 때만 동적으로 불러옴 → api 모드 운영 빌드 결과물에 정답·해설 문자열 0건(검사), mock 빌드는 별도 청크
- 테마: 튜토리얼 화면 루트에 `.tutorial-theme`(승인 테마 값 3개 덮어쓰기). 제품 전체 tokens.css는 그대로(사용자 결정 2026-11-20)
- 승인 문서와의 차이(보고): 02 SCR-102-ST4는 "플레이 도중에는 네트워크를 쓰지 않음"이지만 서버 판정 결정(D-T2)으로 칸 확정마다 판정 요청을 보냄 → 판정 오류 상태(시트 안 안내 + 다시 보내기·처음부터)를 ST4로 표시. 다음 기획·UX 개정 때 반영 필요
- 6단계로 넘기는 것: 결과 화면(SCR-103)은 아직 옛 화면이라 새 결과 상태(`state.run`)를 읽지 못하고 플레이 화면으로 되돌아감(→ 새 회차로 다시 시작). 6단계에서 `state.run`을 읽어 PUT /stages/{id} {runId}로 저장. 옛 SCR-103 흐름 테스트 5개는 옛 SCR-102를 거쳐야 해 제거(6단계에서 새로 작성)

## 9. 6단계 결과(SCR-103 결과 화면·서버 저장, 2026-11-20)

- API 추가(최소): `GET /api/me/tutorial/runs/{runId}` — 완료된 본인 회차의 결과(`run{score,total,passed,wrong}`)와 틀린 상황 다시 보기 데이터(`review[]`: 설명·시작 배치·셔틀·정답·허용·떨어지는 지점·정답 움직임·정답 이유). 끝나지 않은 회차 409 `run_incomplete`, 없거나 남의 회차 404. 읽기 전용(다시 불러도 진행 기록 불변). 틀린 상황만 정답 데이터를 넣음(판정 때 이미 공개한 것과 같음, D-T2 유지). 새 표·마이그레이션 없음
- 저장: 결과 화면에 들어오면 기존 `PUT /stages/{id}` `{runId}`(멱등). 표시는 서버 응답 기준, 저장 전에는 SCR-102가 넘긴 결과(서버 판정 점수의 합)를 '기록 저장 중'과 함께(ST2). 실패는 성공처럼 보이지 않음(ST4: 안내 + 다시 저장, 최고 점수·진행률 숨김, 나가기 확인 창)
- 새로고침·직접 접근: 결과 주소 `/tutorial/stages/{id}/result?run={runId}`. 같은 PUT(이미 완료면 다시 반영하지 않고 같은 결과) + GET /runs로 복구. 회차 ID 없이 들어오면 SCR-102로
- 최고 점수 갱신 표시: 처음 들어왔을 때 저장 전 기록을 한 번 읽어 비교(새로고침 뒤에는 이전 기록을 알 수 없어 표시하지 않음)
- 다음 스테이지: `/courses` 순서로 같은 과정의 다음 → 다음 과정의 첫 스테이지, 초급 3단계 뒤에는 '목록으로'
- 정리한 옛 코드: `features/tutorial/TutorialCourt.tsx`(2D 코트), `usePlayback.ts`, `engine/`(선택지 엔진·애니메이션·타입·테스트), `content/stages.ts`(옛 콘텐츠). 진행 기록 규칙은 `progress.ts`로 옮김. 레지스트리 동기화 테스트는 `features/tutorial/registry.test.ts`
- Mock: 회차를 Mock 저장소(localStorage)에 두어 결과 화면 새로고침 복구, 본인(Mock 세션) 회차만
- 남은 것: 실제 api 모드 브라우저 화면은 로그인 비밀값을 쓰지 않으려고 확인하지 않음(대신 실제 PostgreSQL DB 테스트로 전체 API 흐름 검증). 02 SCR-103 정보 1 '출처: 클라이언트 판정'·ST4 '플레이 도중 네트워크 없음'은 서버 판정 결정(D-T2)과 다름 → 다음 기획·UX 개정 때 반영

## 10. 7단계 결과(전체 흐름·회귀 검증, 2026-11-20)

- 실제 api 모드 E2E: 로컬 Compose PostgreSQL의 **별도 임시 DB `smapsh_e2e`**(원본 DB·Neon 미접근, `dbguard` 통과) + `APP_ENV=e2e` 백엔드(8001) + api 모드 프런트(5174). 시작 전 `assertE2ETarget` 확인, 화면 밖 출처 요청 차단(0건). 로그인은 `APP_ENV=e2e` 개발용 로그인 화면(비밀값은 `.env`에서 읽어 입력만, 출력 안 함). 로그인 → 목록 → 스테이지 → 회차 → 문제별 서버 판정(정답·오답·재도전 0점·허용) → 마지막 문제 → 저장 → 틀린 상황 다시 보기 → 새로고침 → 다시 하기(최고 점수 갱신) → 목록 진행률 → 로그아웃·재로그인 뒤 기록 유지 → 360×560 확인 단계 → 서버 판정. 콘솔 오류 0, 5xx 0. DB: 진행 기록 1행(통과·최고 5·첫 통과 시각), 회차는 첫 판정 문자열만(문제별 선택 칸 미저장). 결과: `review/tutorial-step7/e2e-api/`
- UX: 마지막 상황에서 처리가 끝나면 정답·오답·허용과 관계없이 다음 버튼을 '결과 보기'로(오답이면 '다시 도전'·'올바른 움직임 보기'는 그대로)
- 회차 보관: 정책과 맞아 DB 변경 없음(회차 2시간 + 1일 뒤 다음 회차 시작 때 삭제, 진행 기록은 영구, 선택 칸 미저장). 지워진 회차의 결과 주소로 다시 들어오면 저장 실패가 아니라 '이 결과는 더 이상 볼 수 없어요' 안내(다시 하기·목록으로, 나가기 막지 않음). 방금 플레이한 회차가 없으면 기존처럼 '이번 결과를 저장할 수 없습니다'
- B-07(360×560 안내 라벨 겹침): 첫 줄 라벨을 네트 위로 허용하면 선수 겹침은 사라지나 셔틀을 가림 → 안전한 수정이 없어 **되돌림**(측정값 기준선과 같음, 숫자 겹침·잘림 없음). 낮음 등급으로 남김
- 다른 화면: `.tutorial-theme`는 튜토리얼 화면에만 있음(청백전·마이페이지·운영 화면 0개, 튜토리얼 다녀온 뒤에도 0개), 주요 버튼 색은 제품 토큰 그대로

