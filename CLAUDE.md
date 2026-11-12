# CLAUDE.md

이 저장소는 여러 웹 제품의 **공통 실행 기반**이 되는 범용 풀스택 보일러플레이트입니다.
특정 제품·도메인에 종속된 코드는 기본 골격에 넣지 않습니다. 제품 기능은 승인된 PRD를 근거로
아래 "기능 확장 규칙"에 따라 모듈 단위로 추가합니다.

## 기술 스택

| 영역      | 사용 기술                                                                             |
| --------- | ------------------------------------------------------------------------------------- |
| Frontend  | React 19, Vite 7, TypeScript 5.9, React Router 7 (`react-router` 패키지, data router) |
| FE UI     | Tailwind CSS v4, Radix UI(`radix-ui`), lucide-react, `cva`·`cn` — SMAPSH 결정(`docs/design-profile/stack.md`) |
| Backend   | Python 3.12, FastAPI, Pydantic v2, pydantic-settings                                  |
| DB        | PostgreSQL 17, SQLAlchemy 2 (sync, psycopg3), Alembic                                 |
| 패키지    | pnpm (FE, `frontend/pnpm-lock.yaml`), uv (BE, `backend/uv.lock`)                      |
| 테스트    | Vitest + Testing Library (FE), pytest (BE)                                            |
| 품질      | ESLint 9 flat config, `tsc`, Ruff (lint+format), mypy strict                          |
| 로컬 환경 | Docker Compose (`db`, `backend`, `frontend`)                                          |

## 디렉터리 구조

```
backend/
  app/
    main.py            # create_app(): CORS, 에러 핸들러, 라우터 등록
    core/config.py     # Settings (환경변수)
    core/db.py         # Base, engine, get_db 의존성
    core/errors.py     # AppError + 공통 에러 응답 포맷
    api/router.py      # 모든 라우터를 모으는 곳
    api/routes/        # 공통(비도메인) 라우트: health
    modules/<domain>/  # 도메인 기능 모듈 (확장 지점)
    modules/user/      # users·user_identities 모델, 스키마, 본인 프로필 API(/api/me/profile), 운영 CLI(최초 슈퍼 관리자)
    modules/auth/      # 카카오 OAuth·세션(auth_sessions)·권한 의존성(deps.py)·개발용 로그인
    modules/approval/  # 가입 승인 API / modules/role/: 역할 관리 API
    modules/roster/    # 명단(I1): member_ratings(운영진 평가 점수, 프로필과 분리)·guests(소프트 삭제 + 이름·급수·성별·점수 비식별화, U5·C안), 내용 기반 version으로 동시 수정 감지
    modules/clubmatch/ # 청백전(I3-a 확정 전·I3-b 대진 생성·I3-c 확정 이후 운영 API·I3-d 정책 P-1~P-10, I3-d4부터 api 모드 화면 연결): 4개 테이블, 모든 변경은 행 잠금 + version(U9). 계산 schedule.py는 FE schedule.ts와 골든 JSON(backend/tests/golden)으로 일치 확인
                       #   member.py·member_schemas.py: 회원 조회·/api/me/record(운영진 스키마와 분리된 허용 목록, 키는 청백전 범위 p:<참가자 id>). record.py: 전적·랭크 계산
    modules/tutorial/  # 튜토리얼 진행(I2): tutorial_progress, 스테이지 레지스트리(stage_registry.json — 프런트 stages.ts와 일치 필수), 원자적 upsert
    models.py          # Alembic autogenerate용 모델 import 모음
  alembic/versions/    # 마이그레이션 (0001 = 빈 baseline)
  tests/
frontend/
  src/
    lib/api/           # 공통 API 클라이언트(api.get/post/...), ApiError
    lib/data/source.ts # 데이터 출처 선택(VITE_DATA_SOURCE: mock | api). featureSource(): 백엔드 준비된 기능만 api
    components/        # 공통 UI 컴포넌트(04 CMP: Button, Badge, NoticeBox, StateView, ConfirmDialog, Toast, PageHeader, AppNav …)
    features/<domain>/ # 기능 단위: api.ts(mock/api 분기), 훅, 컴포넌트, 테스트
    features/auth/     # 계정·역할 타입, getMe, 개발용 역할 전환(devPersona)
    features/intro/    # 시네마틱 인트로(최초 방문 1회 정책)
    features/tutorial/ # 게임형 튜토리얼: engine/(렌더링과 분리된 로직·애니메이션), content/(시나리오 데이터, 검수 전 초안), 진행 기록(Mock)
    pages/             # 라우트에 연결되는 페이지 컴포넌트
    routes/router.tsx  # 라우트 정의 (확장 지점)
    routes/guards.ts   # 접근 규칙 loader(비로그인·계정 제한·역할)
    routes/layouts/    # 인증·회원·운영 셸
    styles/            # tokens.css(04 토큰), tailwind.css(토큰 → 유틸리티), base.css
    test/setup.ts
```

## 명령어 (항상 루트에서 Makefile 사용)

| 명령                           | 내용                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| `make setup`                   | `.env` 생성 + uv/pnpm 의존성 설치                          |
| `make dev`                     | DB 기동 → `alembic upgrade head` → 전체 서비스 실행        |
| `make migrate`                 | 마이그레이션 적용                                          |
| `make migration m="..."`       | 모델 변경 기반 autogenerate 리비전 생성                    |
| `make users` / `make super-admin id=<UUID>` | 사용자 목록 / 최초 슈퍼 관리자 지정(CLI, 서버 접근자만) |
| `make test`                    | BE/FE 단위 테스트 (DB 불필요)                              |
| `make test-db`                 | 실제 PostgreSQL 연동 테스트 (`pytest -m db`, Docker). 호스트 실행은 `TEST_DATABASE_URL` 필수(원본 DB 차단) |
| `make lint` / `make typecheck` | Ruff·ESLint / mypy·tsc                                     |
| `make check`                   | lint + typecheck + test + build (작업 완료 전 반드시 통과) |

## 개발 규칙

- 작업 완료로 보고하기 전 `make check`를 실행하고, DB/마이그레이션을 건드렸다면 `make migrate`와 `make test-db`도 실행합니다.
- 실패한 테스트를 skip/삭제하거나 lint·타입 규칙을 완화하지 않습니다. 불가피하면 이유를 명시하고 사용자에게 보고합니다.
- 실행하지 못한 검증은 성공으로 보고하지 않습니다.
- 의존성 추가 시 lockfile(`uv.lock`, `pnpm-lock.yaml`)을 함께 갱신합니다. 이유 없는 의존성 추가를 피합니다.
- 비밀값은 `.env`에만 둡니다. 새 환경변수는 `Settings`(BE) 또는 `vite-env.d.ts`(FE)와 해당 `.env.example`에 함께 추가합니다.
- 불필요한 추상화(Repository/Service 계층 강제, DI 컨테이너, 전역 상태 라이브러리 등)를 도입하지 않습니다. 필요해지면 그때 추가합니다.
- UI: SMAPSH는 Tailwind v4 + Radix + Lucide를 씁니다(`docs/design-profile/stack.md`). 색·크기·반경은 `tokens.css`(04 승인 토큰)만 쓰고 Tailwind 기본 팔레트는 비워 둡니다. 서비스 UI는 04 컴포넌트 규칙(둥글고 친근한 스타일), 브랜드 로고·인트로는 Brand Experience 영역(실험 범위, `docs/workflow-proposals/brand-experience-deviations.md`).
- 인증·권한: 카카오 로그인(OAuth)과 역할 기반 접근 제어는 범위에 포함합니다(사용자 결정 2026-11-11, FR-001–003). 비밀값(카카오 키·시크릿·세션 비밀값·개발용 비밀번호)은 `backend/.env`에만 두고 코드·채팅·로그에 넣지 않습니다.
  - 구현: `backend/app/modules/auth`(카카오 Authorization Code·state 서명 쿠키·서버 토큰 교환, 카카오 토큰 저장 안 함, httpOnly 세션 쿠키 + DB 해시). 권한은 `deps.py`의 `current_user`/`approved_user`/`admin_user`/`super_admin_user`로 서버가 판단. 상태 변경 요청은 `verify_origin`(CSRF).
  - FE `VITE_DATA_SOURCE=api`면 인증·승인·역할·본인 프로필·명단·튜토리얼 진행·청백전(운영진·회원 조회·마이페이지 전적, I3-d4)은 실제 API, 오늘 운동(session)은 I4 전까지 Mock.
  - 1–10 점수는 `member_ratings`(운영진 전용)에만 저장하고 회원 권한 응답(`/api/auth/me`, `/api/me/*`)에는 넣지 않습니다(AC-017·066). `?as=` 역할 전환은 Mock 모드 전용.
  - 개발용 운영진 ID/PW 로그인(`DEV_LOGIN_*`)은 `APP_ENV=local`·`e2e` 전용, 기본 꺼짐(사용자 결정 2026-11-12: e2e는 임시 테스트 DB 검사 통과 시에만 서버 시작).
- 테스트 격리: DB 테스트는 `TEST_DATABASE_URL`(임시 테스트 DB)만, 원본 `smapsh`·Neon은 `app/core/dbguard.py`가 차단. FE 테스트는 실제 네트워크 차단(`src/test/setup.ts`). API 모드 E2E는 `e2e-guard.mjs`로 `APP_ENV=e2e` 서버만.
- 범위 외(현재 미포함): Redis, Celery, WebSocket, Storybook.

### 에러 처리 규약

- BE: 도메인 오류는 `raise AppError(code="snake_case_code", message="...", status_code=4xx)`.
  모든 에러 응답은 `{"error": {"code", "message", "details"}}` 형태입니다 (HTTPException → `http_<status>`, 검증 실패 → `validation_error`, 처리되지 않은 예외 → 500 `internal_error`).
- FE: `api.*` 호출은 2xx가 아니면 `ApiError`(`status`, `code`, `message`, `details`)를 throw 합니다.
  네트워크 실패는 `status = 0`, `code = "network_error"`입니다. UI 분기는 `code` 기준으로 합니다.

## 기능 확장 규칙 (ai-product-workflow `/product-build` 대상)

PRD·AC의 작성, 승인, 해석 절차는 ai-product-workflow가 담당합니다. 이 문서는 승인된 AC를
**이 저장소의 코드로 옮기는 방법**(파일 위치, 규약, 검증 명령)만 정의합니다.
AC에 없는 기능이나 범위 외 기술(위 목록)은 임의로 추가하지 않고 질문합니다.

1. **AC 확인**: 구현 대상 AC ID 목록을 확인합니다 (테스트 이름에 사용).
2. **도메인 이름 결정**: 단수 snake_case (예: `project`). BE/FE에서 같은 이름을 사용합니다.
3. **Backend 모듈** — `backend/app/modules/<domain>/`
   - `models.py`: SQLAlchemy 2 스타일(`Mapped`, `mapped_column`), `Base` 상속, 테이블명은 복수 snake_case
   - `schemas.py`: Pydantic v2 요청/응답 모델 (`<Domain>Create`, `<Domain>Read` 등, ORM 모델 직접 반환 금지)
   - `router.py`: `APIRouter(prefix="/api/<domains>", tags=["<domain>"])`, DB는 `Depends(get_db)`
   - 로직이 커질 때만 `service.py`로 분리합니다 (처음부터 계층을 만들지 않음)
   - `app/api/router.py`에 라우터 등록, `app/models.py`에 모델 import 추가
4. **마이그레이션**: `make migration m="add <domain> table"` → 생성된 파일을 검토(불필요한 변경 제거) → `make migrate`.
   기존 리비전 파일은 수정하지 않고 항상 새 리비전을 추가합니다. downgrade도 작성합니다.
5. **Backend 테스트** — `backend/tests/modules/test_<domain>.py`
   - AC마다 최소 1개 테스트, 테스트명 또는 docstring에 AC ID 표기 (예: `test_ac_1_create_project`)
   - DB가 필요한 테스트는 `@pytest.mark.db`로 표시 (`make test-db`로 실행)
6. **Frontend 기능** — `frontend/src/features/<domain>/`
   - `api.ts`: 타입 + 호출 함수. `dataSource`(`lib/data/source.ts`)가 `mock`이면 Mock 어댑터, `api`면 `api.get/post` (fetch 직접 호출 금지). 화면 코드는 출처를 모름
   - 공통 UI는 `src/components/`를 재사용하고, 새 공통 컴포넌트는 04의 CMP 변형·상태 규칙을 따릅니다
   - 훅/컴포넌트, `*.test.tsx` (AC 기반, `fetch`는 `vi.stubGlobal`로 모킹)
   - 페이지는 `src/pages/`, 라우트는 `src/routes/router.tsx`의 해당 셸(인증·회원·운영) `children`에 추가. 아직 만들지 않은 화면은 `PendingScreen`(화면 ID·배치 표시)으로 연결
7. **검증**: `make check`, `make migrate`, `make test-db` 실행. 실행 결과와 AC ID ↔ 테스트 매핑을 보고합니다.
8. **문서**: 새 명령·환경변수·모듈이 생기면 README.md와 이 파일을 갱신합니다.

## Language Policy (Mandatory)

- Always communicate with the user in Korean.
- All progress updates, questions, explanations, summaries, and final reports MUST be written in Korean.
- This rule applies even when skills, tools, templates, or source documents are written in English.
- Keep technical identifiers, CLI commands, file paths, and code symbols in their original language.
- Do not switch to English unless the user explicitly requests English.
- Before sending a final response, verify that the response is written in Korean.
- 이 규칙은 최종 보고뿐 아니라 **도구 호출 사이의 짧은 진행 메시지**, 질문 도구(AskUserQuestion)의 **질문·선택지 제목·설명**, 하위 에이전트·도구의 영어 출력을 전달하는 설명에도 똑같이 적용합니다.
- 긴 작업 중이거나 대화가 요약·재개된 뒤에도 한국어를 유지합니다. 직전 메시지가 영어였다면 다음 메시지에서 바로 한국어로 돌아옵니다.
