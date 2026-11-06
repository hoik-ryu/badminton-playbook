# fullstack-boilerplate

여러 웹 제품 개발에 공통으로 사용하는 범용 풀스택 보일러플레이트입니다.
React + Vite 프론트엔드, FastAPI 백엔드, PostgreSQL을 Docker Compose로 함께 실행합니다.

> AI 에이전트(Claude Code 등)와 함께 작업할 때의 규칙·확장 절차는 [CLAUDE.md](CLAUDE.md)를 참고하세요.

## 구성

- **Frontend**: React 19, Vite 7, TypeScript, React Router 7, Vitest, ESLint
- **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, pytest, Ruff, mypy
- **Database**: PostgreSQL 17
- **도구**: pnpm, uv, Docker Compose, Make, GitHub Actions

## 사전 요구사항

- Docker (Docker Compose v2)
- Node.js 20.19 이상 + pnpm 10 (`corepack enable`)
- uv (Python 3.12는 uv가 자동 설치)
- GNU Make

## 빠른 시작

```bash
make setup   # .env 생성 + 로컬 의존성 설치
make dev     # DB 기동 → 마이그레이션 → backend/frontend 실행
```

- Frontend: http://localhost:5173 (Backend 상태 확인 화면)
- Backend: http://localhost:8000/health , API 문서 http://localhost:8000/docs

`make dev`, `make migrate`, `make test-db`는 Docker만 있으면 됩니다. `make setup`, `make check`는 호스트에 uv와 pnpm이 필요합니다.

### 포트가 이미 사용 중인 경우

`make dev` 실행 시 `port is already allocated` / `address already in use` 오류가 나면 `.env`에서 포트를 바꿉니다.

| 충돌 포트 | `.env`에서 바꿀 값 | 함께 바꿀 값 |
| --- | --- | --- |
| 5432 (로컬 PostgreSQL 등) | `POSTGRES_PORT=5433` | Docker 없이 backend 실행 시 `backend/.env`의 `DATABASE_URL` 포트 |
| 8000 | `BACKEND_PORT` | `VITE_API_BASE_URL` |
| 5173 | `FRONTEND_PORT` | `CORS_ORIGINS` |

컨테이너 내부 통신(backend → `db:5432`)은 호스트 포트와 무관하므로 영향이 없습니다.

## 새 프로젝트 시작하기

이 저장소의 Git 히스토리를 가져오지 않도록 **GitHub Template**으로 사용하는 것을 권장합니다.

1. (최초 1회) 이 저장소의 GitHub Settings → General → **Template repository** 체크
2. **Use this template → Create a new repository**로 새 저장소 생성 (히스토리 없이 단일 초기 커밋으로 시작)
3. 새 저장소를 clone 한 뒤 이름 관련 값을 바꿉니다.
   - `.env.example`의 `APP_NAME` (및 필요 시 `COMPOSE_PROJECT_NAME`, DB 계정)
   - `backend/app/core/config.py`의 `app_name` 기본값
   - `frontend/index.html`의 `<title>`, `frontend/src/pages/HomePage.tsx`의 제목
   - README.md 상단 소개
4. `make setup && make dev`로 실행 확인 후 `make check`

Template 기능을 쓸 수 없다면 `git clone --depth 1 <url> my-product && cd my-product && rm -rf .git && git init`으로 히스토리 없이 시작할 수 있습니다.

## 명령어

`make help`로 전체 목록을 볼 수 있습니다.

| 명령 | 설명 |
| --- | --- |
| `make setup` | `.env` 파일 생성 및 FE/BE 의존성 설치 |
| `make dev` | 전체 스택 실행 (foreground) |
| `make up` / `make down` | 백그라운드 실행 / 중지 |
| `make logs` / `make ps` | 로그 / 상태 확인 |
| `make migrate` | Alembic `upgrade head` |
| `make migration m="메시지"` | 새 마이그레이션 생성 (autogenerate) |
| `make migrate-down` | 마이그레이션 1단계 롤백 |
| `make test` | FE/BE 단위 테스트 |
| `make test-db` | 실제 PostgreSQL 연동 테스트 |
| `make lint` | Ruff + ESLint |
| `make typecheck` | mypy + tsc |
| `make format` | Ruff 포맷/자동 수정 |
| `make build` | Frontend 프로덕션 빌드 |
| `make check` | lint + typecheck + test + build (CI와 동일) |

## 환경변수

| 파일 | 용도 |
| --- | --- |
| `.env.example` | Docker Compose (DB 계정, 포트, CORS, `VITE_API_BASE_URL`) |
| `backend/.env.example` | Docker 없이 backend 실행 시 (`DATABASE_URL` 등) |
| `frontend/.env.example` | Docker 없이 frontend 실행 시 (`VITE_API_BASE_URL`) |

`.env` 파일은 Git에 포함되지 않습니다. 실제 비밀번호·키는 `.env`에만 저장하세요.

## Docker 없이 실행

```bash
docker compose up -d --wait db                       # DB만 컨테이너로
cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
cd frontend && pnpm dev
```

## 프로젝트 구조

```
.
├── backend/            FastAPI 앱 (app/), Alembic (alembic/), 테스트 (tests/)
├── frontend/           Vite + React 앱 (src/)
├── docker-compose.yml  db / backend / frontend
├── Makefile            개발 명령 통일
├── .github/workflows/  CI (lint, typecheck, test, build, migration)
├── CLAUDE.md           개발 규칙 및 기능 확장 규칙
└── README.md
```

## 에러 응답 형식

모든 Backend 에러는 다음 형식을 따르며, Frontend 공통 클라이언트는 이를 `ApiError`로 변환합니다.

```json
{ "error": { "code": "http_404", "message": "Not Found", "details": null } }
```

## 기능 추가

새 기능은 `backend/app/modules/<domain>/`와 `frontend/src/features/<domain>/`에 모듈 단위로 추가합니다.
자세한 절차는 [CLAUDE.md의 "기능 확장 규칙"](CLAUDE.md#기능-확장-규칙-ai-product-workflow-product-build-대상)을 참고하세요.

## CI

GitHub Actions(`.github/workflows/ci.yml`)가 push(main)·PR마다 실행합니다.

- Backend: Ruff, mypy, pytest, PostgreSQL 서비스에 `alembic upgrade head` + `alembic check`, DB 연동 테스트
- Frontend: ESLint, tsc, Vitest, Vite build
