# CLAUDE.md

이 저장소는 여러 웹 제품의 **공통 실행 기반**이 되는 범용 풀스택 보일러플레이트입니다.
특정 제품·도메인에 종속된 코드는 기본 골격에 넣지 않습니다. 제품 기능은 승인된 PRD를 근거로
아래 "기능 확장 규칙"에 따라 모듈 단위로 추가합니다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Frontend | React 19, Vite 7, TypeScript 5.9, React Router 7 (`react-router` 패키지, data router) |
| Backend | Python 3.12, FastAPI, Pydantic v2, pydantic-settings |
| DB | PostgreSQL 17, SQLAlchemy 2 (sync, psycopg3), Alembic |
| 패키지 | pnpm (FE, `frontend/pnpm-lock.yaml`), uv (BE, `backend/uv.lock`) |
| 테스트 | Vitest + Testing Library (FE), pytest (BE) |
| 품질 | ESLint 9 flat config, `tsc`, Ruff (lint+format), mypy strict |
| 로컬 환경 | Docker Compose (`db`, `backend`, `frontend`) |

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
    models.py          # Alembic autogenerate용 모델 import 모음
  alembic/versions/    # 마이그레이션 (0001 = 빈 baseline)
  tests/
frontend/
  src/
    lib/api/           # 공통 API 클라이언트(api.get/post/...), ApiError
    features/<domain>/ # 기능 단위: api.ts, 훅, 컴포넌트, 테스트
    pages/             # 라우트에 연결되는 페이지 컴포넌트
    routes/router.tsx  # 라우트 정의 (확장 지점)
    test/setup.ts
```

## 명령어 (항상 루트에서 Makefile 사용)

| 명령 | 내용 |
| --- | --- |
| `make setup` | `.env` 생성 + uv/pnpm 의존성 설치 |
| `make dev` | DB 기동 → `alembic upgrade head` → 전체 서비스 실행 |
| `make migrate` | 마이그레이션 적용 |
| `make migration m="..."` | 모델 변경 기반 autogenerate 리비전 생성 |
| `make test` | BE/FE 단위 테스트 (DB 불필요) |
| `make test-db` | 실제 PostgreSQL 연동 테스트 (`pytest -m db`, Docker) |
| `make lint` / `make typecheck` | Ruff·ESLint / mypy·tsc |
| `make check` | lint + typecheck + test + build (작업 완료 전 반드시 통과) |

## 개발 규칙

- 작업 완료로 보고하기 전 `make check`를 실행하고, DB/마이그레이션을 건드렸다면 `make migrate`와 `make test-db`도 실행합니다.
- 실패한 테스트를 skip/삭제하거나 lint·타입 규칙을 완화하지 않습니다. 불가피하면 이유를 명시하고 사용자에게 보고합니다.
- 실행하지 못한 검증은 성공으로 보고하지 않습니다.
- 의존성 추가 시 lockfile(`uv.lock`, `pnpm-lock.yaml`)을 함께 갱신합니다. 이유 없는 의존성 추가를 피합니다.
- 비밀값은 `.env`에만 둡니다. 새 환경변수는 `Settings`(BE) 또는 `vite-env.d.ts`(FE)와 해당 `.env.example`에 함께 추가합니다.
- 불필요한 추상화(Repository/Service 계층 강제, DI 컨테이너, 전역 상태 라이브러리 등)를 도입하지 않습니다. 필요해지면 그때 추가합니다.
- UI는 특정 디자인 시스템에 종속되지 않습니다. 디자인 시스템 도입은 별도 결정 사항입니다.
- 범위 외(현재 미포함): 인증/권한, 소셜 로그인, Redis, Celery, WebSocket, Storybook.

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
   - `api.ts`: 타입 + `api.get/post` 호출 함수 (fetch 직접 호출 금지)
   - 훅/컴포넌트, `*.test.tsx` (AC 기반, `fetch`는 `vi.stubGlobal`로 모킹)
   - 페이지는 `src/pages/`, 라우트는 `src/routes/router.tsx`의 `children`에 추가
7. **검증**: `make check`, `make migrate`, `make test-db` 실행. 실행 결과와 AC ID ↔ 테스트 매핑을 보고합니다.
8. **문서**: 새 명령·환경변수·모듈이 생기면 README.md와 이 파일을 갱신합니다.
