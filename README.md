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
| 8000 | `BACKEND_PORT` | `API_PROXY_TARGET`(호스트 실행 시 `frontend/.env`) |
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
| `make users status=pending` | 사용자 목록(가입 신청자 UUID 확인) |
| `make super-admin id=<UUID>` | 최초 슈퍼 관리자 지정(아래 '인증' 참고) |
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
| `.env.example` | Docker Compose (DB 계정, 포트, CORS, `VITE_DATA_SOURCE`) |
| `backend/.env.example` | backend 설정. 카카오 키·`SESSION_SECRET`·개발용 로그인(`DEV_LOGIN_*`)은 **항상 `backend/.env`**에서 읽습니다(Compose도 마운트된 파일 사용) |
| `frontend/.env.example` | Docker 없이 frontend 실행 시 (`VITE_DATA_SOURCE`, `VITE_API_BASE_URL`, `API_PROXY_TARGET`) |

`VITE_DATA_SOURCE`: `mock`(기본, 화면 개발용 가짜 데이터) 또는 `api`(실제 백엔드). 현재 백엔드가 있는 기능은 **인증·가입 승인·역할·본인 프로필·명단(회원·게스트·점수)·튜토리얼 진행 기록·청백전(운영진·회원 조회·마이페이지 전적, I3-d4)**이고, `api`여도 오늘 운동은 Mock으로 동작합니다(I4 전, 그 화면의 사람·점수 입력도 Mock 샘플)(`lib/data/source.ts`의 `featureSource`). `frontend/.env`의 `VITE_API_BASE_URL`을 비우면 Vite 프록시(`API_PROXY_TARGET`, 기본 `http://localhost:8000`)를 거쳐 같은 출처로 호출합니다.

`VITE_API_BASE_URL`은 비워 두는 것을 권장합니다. 그러면 브라우저가 같은 출처의 `/api`를 호출하고, Vite 개발 서버가 `API_PROXY_TARGET`(기본 `http://localhost:8000`, Compose는 `http://backend:8000`)으로 넘깁니다. 세션 쿠키와 카카오 Redirect URI(`http://localhost:5173/api/auth/kakao/callback`)가 이 방식을 전제로 합니다.

`.env` 파일은 Git에 포함되지 않습니다. 실제 비밀번호·키는 `.env`에만 저장하세요.

## 인증(카카오 로그인·세션·가입 승인)

- 흐름: '카카오로 시작하기' → `/api/auth/kakao/login`(state 서명 쿠키) → 카카오 → `/api/auth/kakao/callback`(state 검증, 서버에서 토큰 교환·회원번호 조회, **카카오 토큰은 저장하지 않음**) → 미가입이면 가입 티켓 쿠키 + `/signup`, 가입자면 httpOnly 세션 쿠키 + 상태별 화면.
- DB: `users`(회원 기본 프로필), `user_identities`(외부 인증 계정 — 카카오 없는 직접 추가 회원도 있으므로 선택), `auth_sessions`(세션 토큰 SHA-256 해시), `member_ratings`(운영진 평가 1–10 점수, 프로필과 분리), `guests`(게스트, 소프트 삭제), `tutorial_progress`(회원×스테이지 통과·최고 점수·최초 통과 시각). 마이그레이션 `0002`–`0005`.
- API: `GET·PUT /api/me/profile`(본인 이름·성별·급수, 승인된 본인), 명단(I1, 운영진): `GET /api/roster`, `GET /api/roster/members/{id}/status`, `PUT /api/roster/{members|guests}/{id}`(+ `/score`), `POST /api/roster/{guests|members}`, `GET /api/roster/guests/{id}/delete-info`, `DELETE /api/roster/guests/{id}`(소프트 삭제), 튜토리얼 진행(I2, 승인된 본인): `GET /api/me/tutorial/progress`, `PUT /api/me/tutorial/stages/{id}`(`{score, total}` — 통과는 서버가 다시 계산, 멱등), `GET /api/auth/me`, `POST /api/auth/signup`, `GET·DELETE /api/auth/signup/ticket`, `POST /api/auth/logout`, `GET /api/approvals`(`/count`), `POST /api/approvals/{id}/approve|reject`, `POST /api/approvals/approve`, `GET /api/roles`, `PUT /api/roles/{id}`. 상태 변경 요청은 허용된 Origin만(CSRF).
- **최초 슈퍼 관리자**: 지정할 사람이 실제 카카오로 가입 신청 → `make users status=pending`으로 UUID 확인 → `make super-admin id=<UUID>`(승인 + 슈퍼 관리자). 이메일·닉네임으로 자동 부여하지 않으며, 이미 있으면 `--additional` 없이 거부합니다. 그 뒤 운영진 지정은 화면(역할 관리)에서.
- 운영 환경: `APP_ENV`가 `local`이 아니면 `SESSION_SECRET`(32자 이상 무작위)이 필수이고, HTTPS에서는 `SESSION_COOKIE_SECURE=true`.

### 로컬 개발용 운영진 로그인

- `backend/.env`에 `DEV_LOGIN_ENABLED=true`, `DEV_ADMIN_USERNAME`, `DEV_ADMIN_PASSWORD`를 두면 로그인 화면(`VITE_DATA_SOURCE=api`)에 '운영진 로그인하기'가 나타납니다. 누르면 아이디·비밀번호 폼이 펼쳐지고, 검증은 FastAPI가 합니다. 성공하면 슈퍼 관리자 세션으로 `/ops`.
- 비밀번호는 환경변수에서만 읽고 DB·프런트엔드에 저장하지 않습니다(계정은 `user_identities.provider='dev'`로 연결).
- **로컬·E2E 전용**: 기본 꺼짐, `APP_ENV`가 `local`·`e2e`가 아니면 요청을 404로 거부하고, 켜 둔 채 그 밖에서 시작하면 서버가 시작하지 않습니다. `APP_ENV=e2e` 서버는 `DATABASE_URL`이 임시 테스트 DB 규칙(`backend/app/core/dbguard.py`)을 통과해야만 시작합니다. 로그아웃은 마이페이지(`/me`) 하단의 '로그아웃'(카카오·개발용 로그인 공통, `POST /api/auth/logout`).

## 튜토리얼(B6)

- 게임 로직은 렌더링과 분리돼 있습니다(`frontend/src/features/tutorial/engine/`: 판정·점수·통과·저장 병합, 애니메이션 타임라인). 화면 없이 테스트합니다(`logic.test.ts`).
- 시나리오는 `frontend/src/features/tutorial/content/stages.ts`의 정적 데이터입니다. **현재는 검수 전 초안**이며 운영진·코치 검수 후 이 파일만 바꿉니다.
- 진행 기록(통과 여부·최고 점수·최초 통과 시각)은 api 모드에서 `tutorial_progress`(I2)에, Mock 모드에서는 브라우저 저장소에 저장됩니다. 서버는 스테이지 id·상황 수만 압니다(`backend/app/modules/tutorial/stage_registry.json`). **시나리오(stages.ts)의 스테이지·상황 수를 바꾸면 이 파일도 함께 바꿔야 하며**, 프런트 테스트(`content/registry.test.ts`)가 어긋남을 알려 줍니다.

## 청백전(I3, 진행 중)

- 백엔드 `backend/app/modules/clubmatch`에 확정 전 단계 운영 API(만들기·목록·상세·방식·설정·참가·팀·팀 배정안·대진 생성)와 확정 이후 API, 회원 조회·내 전적이 있습니다(I3-a~d2). **I3-d4부터 api 모드 화면이 실제 API를 씁니다**(`BACKEND_READY`에 `clubmatch`).
- 계약 확인: 요청 형태 `api.contract.test.ts`, 응답·오류 키 구조 `backend/tests/golden/clubmatch_api_shapes.json`(백엔드 `test_clubmatch_api_contract.py`가 만들고 FE `api.shapes.test.ts`가 TS 타입·Mock과 대조, 다시 만들기: `cd backend && UPDATE_GOLDEN=1 uv run pytest tests/modules/test_clubmatch_api_contract.py`).
- API 모드 브라우저 E2E(`check-clubmatch-api.mjs`·`check-roster-api.mjs`·`check-tutorial-api.mjs`): **임시 DB + `APP_ENV=e2e` 별도 백엔드로만** 실행됩니다(`experiments/frontend-layout/e2e-guard.mjs`가 시작 전에 확인 — BASE가 로컬·5173/8000 아님, Vite 프록시 뒤 `/health`가 `environment=e2e`, `PSQL_ARGS`가 임시 DB, 브라우저의 BASE 밖 API 요청은 차단·실패). 예: 임시 PG에 `smapsh_e2e` 생성·`alembic upgrade head` → 백엔드 `APP_ENV=e2e DATABASE_URL=postgresql+psycopg://app@127.0.0.1:55433/smapsh_e2e CORS_ORIGINS=http://localhost:5174 SESSION_SECRET=… DEV_LOGIN_ENABLED=true … uvicorn app.main:app --port 8001` → `VITE_API_BASE_URL= VITE_DATA_SOURCE=api API_PROXY_TARGET=http://localhost:8001 pnpm exec vite --port 5174` → `DEV_ADMIN_PASSWORD=... E2E_BACKEND=http://localhost:8001 node experiments/frontend-layout/check-clubmatch-api.mjs`.
- 승인 문서와 구현의 차이(D-6~D-13)는 `docs/workflow-proposals/i3d-deviation-ledger.md`에 기록합니다(정식 재승인 전).
- 모든 변경은 요청의 `version`을 확인하고(다르면 409 `conflict`) 최신 상세를 돌려줍니다. 화면은 응답으로 바로 갱신하고, 변경을 차례대로 보냅니다(직전 응답의 version). 확정 후에는 확정 전 조작이 409 `locked`입니다.
- 회원용(I3-d2, 승인된 사용자, 조회만): `GET /api/member/club-matches`, `GET /api/member/club-matches/{id}`(확정 전·없는 id·잘못된 id는 같은 404 `club_match_not_found`), `GET /api/me/record`(본인 전적·랭크). 운영진 응답과 다른 허용 목록 스키마(`member_schemas.py`)로 만들며 점수·급수·성별·실력차·완화 사유·version·규칙·시드·내부 id가 없습니다. 사람 키는 청백전 범위 키 `p:<참가자 행 id>`입니다. 명단 회원 현황(`/api/roster/members/{id}/status`)의 랭크·전적도 같은 계산(`record.py`)입니다.
- 정책(I3-d1, 2026-11-12 확정): 교체로 다른 경기와 같은 4명·같은 팀이 되면 409 `same_matchup`. 중도 귀가는 그 경기의 모든 대체 후보가 중복일 때만 허용(사유 `substitute_exhausted`), 대체할 사람이 없으면 422 `no_substitute`. 종료 후 결과 수정은 `resultChanged`·`resultModifiedAt`으로 대진 수정(`changed`·`modifiedAt`)과 따로 표시합니다. 순위 정렬·재계산·대체 판정은 FE·BE가 `backend/tests/golden/clubmatch_policy.json`으로 일치를 확인합니다(다시 만들기: `UPDATE_GOLDEN=1 pnpm exec vitest run policy.golden`).
- 계산(경기 수 분포·균등안·팀 배정안)은 프런트 `schedule.ts`와 백엔드 `schedule.py`가 같은 결과여야 합니다. 둘 다 `backend/tests/golden/clubmatch_schedule.json`과 비교하며, 규칙을 의도적으로 바꿀 때만 `cd frontend && UPDATE_GOLDEN=1 pnpm exec vitest run schedule.golden`으로 다시 만들고 백엔드도 같이 고칩니다.
- 대진 생성(`POST /api/club-matches/{id}/games`, I3-b)은 서버가 FE `generateClubGames`와 같은 결과로 만듭니다(`backend/tests/golden/clubmatch_generate.json`, 다시 만들기: `UPDATE_GOLDEN=1 pnpm exec vitest run generate.golden`). 경기마다 `relaxations`로 같은 대진 반복(U7)·성별 완화의 사유를 알려 줍니다.
- 확정 이후(I3-c): 확정·결과 기록·수정·미기록 되돌리기(`winner: null`)·종료·선수 교체·중도 귀가 API. 교체하면 같은 대진 반복·성별 완화 사유를 다시 계산해 경기 행에 저장합니다(마이그레이션 0009).
- 게스트 삭제는 이름·급수·성별·점수를 지우는 비식별화입니다(마이그레이션 0006·0008, 이미 삭제된 게스트에도 소급). 지난 경기에는 '삭제된 게스트'로 남습니다.

## 개발용 도구(SMAPSH, 개발 빌드에서만)

- `/dev`: Mock 역할 전환(비로그인·승인 대기·거절·비활성·회원·운영진·슈퍼 관리자), 인트로 다시 보기, 백엔드 상태 확인 링크
- 어느 주소든 `?as=admin`처럼 붙이면 그 역할로 전환됩니다(예: `/ops?as=admin`). **Mock 모드에서만** 동작하며 api 모드에서는 무시됩니다(서버 권한과 무관).
- Mock 카카오 로그인: `/dev`에서 '새 카카오 계정(미가입)으로 바꾸기' → 로그인 화면의 '카카오로 시작하기' → 가입 정보 입력 → 승인 대기. '다음 카카오 로그인 실패시키기', 'Mock 데이터 초기화'도 있습니다. Mock 데이터는 브라우저 localStorage(`smapsh.mock.db.v1`)에 저장됩니다.
- 인트로는 최초 방문 1회만 재생합니다. 다시 보려면 `/?intro=replay`(개발 빌드에서만).

## Docker 없이 실행

```bash
docker compose up -d --wait db                       # DB만 컨테이너로
cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
cd frontend && pnpm dev                              # 실제 API: VITE_DATA_SOURCE=api pnpm dev
```

로컬 DB 테스트: `make migrate && make test-db`(Docker, compose 내부 DB만 사용). Docker 없이 할 때는 임시 테스트 DB를 만들어 `DATABASE_URL=<테스트 DB> uv run alembic upgrade head` 후 `TEST_DATABASE_URL=<테스트 DB> uv run pytest -m db`.
**DB 테스트 보호**: `pytest -m db`는 `TEST_DATABASE_URL`만 쓰고(`backend/.env`의 `DATABASE_URL` 무시), 루프백·포트 5432 아님·이름 `*_test`/`*_e2e`(또는 compose 내부 `db`)가 아니거나 `smapsh`·Neon이면 테스트 실행 전에 중단합니다(연결하지 않음). 프런트 테스트는 스텁하지 않은 네트워크 요청을 막고 `frontend/.env` 대신 테스트 전용 값(`vite.config.ts`의 `test.env`)을 씁니다.

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
