# 카카오 로그인 작업 흐름(준비 문서)

- 작성: 2026-11-11. UI 배치(B1–B6)는 Mock 인증으로 진행하고, 이 문서의 작업은 별도 흐름으로 진행합니다.
- 비밀값(REST API 키, 클라이언트 시크릿, 세션 비밀값)은 `.env`에만 둡니다. 코드·채팅·티켓에 넣지 않습니다. 아래 값은 **이름만** 적었습니다.
- 이 문서의 구조와 설정은 AI 조사·제안입니다. 운영 환경 적용 전 사람이 검토·테스트해야 합니다.

## 1. Kakao Developers 콘솔에서 할 일(사용자)

1. 앱 생성(개발용·운영용 분리 여부 결정), 앱 소유 계정 결정
2. [앱] > [플랫폼 키]의 **REST API 키**에 리다이렉트 URI 등록(값이 요청과 정확히 같아야 함. JavaScript 키에 등록하면 KOE006)
   - 로컬: `http://localhost:5173/api/auth/kakao/callback`(Vite 프록시 경유, 같은 출처)
   - 운영: `https://<운영 도메인>/api/auth/kakao/callback`(FE·BE 같은 도메인 권장)
3. 카카오 로그인 사용 설정 ON(OFF면 KOE004)
4. 클라이언트 시크릿 확인(REST API 키 생성 시 기본 활성)
5. 동의항목: 이름·성별은 SCR-002에서 직접 입력하므로 **카카오 회원번호만** 사용(이름·성별은 비즈 앱 심사 필요). 최소 1개 항목이 필요하면 닉네임을 선택 동의로
6. (선택) 로그아웃 리다이렉트 URI, 연결 해제 웹훅

## 2. 환경변수(이름만)

| 변수 | 위치 | 출처 |
|---|---|---|
| `KAKAO_REST_API_KEY` | backend `.env` | 콘솔 |
| `KAKAO_CLIENT_SECRET` (비밀) | backend `.env` | 콘솔 |
| `KAKAO_REDIRECT_URI` | backend `.env` | 환경별, 콘솔 등록값과 동일 |
| `FRONTEND_BASE_URL` | backend `.env` | 환경별 |
| `SESSION_SECRET` (비밀) | backend `.env` | 환경마다 무작위 생성 |
| `SESSION_COOKIE_SECURE`, `SESSION_TTL_DAYS`, `SESSION_COOKIE_DOMAIN`(필요 시) | backend `.env` | 운영 도메인 결정 후 |
| `INITIAL_SUPER_ADMIN_KAKAO_ID`(방식 결정 필요, ASM-015) | backend `.env` | 사용자 |
| `VITE_DATA_SOURCE=api` | frontend | 실제 연결 시 |
| `API_PROXY_TARGET`(vite.config 전용) | frontend | local `http://localhost:8000`, docker `http://backend:8000` |

함께 갱신: `backend/app/core/config.py` Settings, `frontend/src/vite-env.d.ts`, `.env.example` 3곳(자리표시자만), `docker-compose.yml` backend environment.

## 3. 흐름(백엔드 주도 Authorization Code)

1. '카카오로 시작하기' → 페이지 이동 `/api/auth/kakao/login?next=<서비스 내부 경로>`
2. BE: `state` 생성 → 서명된 단기 쿠키(httpOnly, SameSite=Lax, 10분)에 state·next 저장 → `kauth.kakao.com/oauth/authorize` 302
3. 콜백: state 대조 → `oauth/token`(client_secret) → `kapi.kakao.com/v2/user/me`의 `id` → **카카오 토큰은 저장하지 않음**
4. 분기: 미가입 → 서명된 가입 티켓 쿠키(30분, DB 저장 없음) + `/signup` / 기존 계정 → 앱 세션 생성 → 제한 상태면 `/account-status`, 승인이면 next 또는 `/tutorial` / 실패·취소 → `/login?error=kakao_failed`(FE가 실패 횟수 셈, UXD-019)
5. `POST /api/auth/signup`(티켓 검증 → 승인 대기 사용자 + 세션), `GET /api/auth/me`(비로그인 401), `POST /api/auth/logout`

## 4. 세션·권한

- DB 세션 테이블 + 불투명 토큰 쿠키(httpOnly, Secure(로컬 제외), SameSite=Lax, Path=/), DB에는 토큰 SHA-256 해시만. 로그아웃·승인·역할 변경 즉시 반영. Redis 불필요.
- CSRF: SameSite=Lax + 상태 변경 요청의 `Origin` 허용 목록 검사.
- BE 의존성: `get_current_user`(401 `unauthenticated`), `require_active_member`(403 `account_restricted`), `require_admin`(403 `forbidden`), `require_super_admin`.
- FE: 이미 구현된 loader 가드(`frontend/src/routes/guards.ts`)가 `getMe()`의 결과로 분기. `VITE_DATA_SOURCE=api`면 `/api/auth/me`를 호출(`features/auth/api.ts`).

## 5. DB 초안

- `users`: id, `kakao_user_id` BIGINT UNIQUE NULL(직접 추가 회원), name, gender, grade, referrer NULL, role(member/admin/super_admin), status(pending/approved/rejected/inactive), created_at, updated_at, approved_at
- `auth_sessions`: id, token_hash UNIQUE, user_id FK(CASCADE), created_at, expires_at, last_seen_at
- 새 리비전(0002) + downgrade. enum은 String + CHECK. 런타임 의존성 `httpx` 추가(uv.lock 갱신)

## 6. 결정 필요(인증 흐름 착수 시)

운영 도메인 구조(같은 도메인 권장), 카카오 앱 개발·운영 분리와 소유 계정, 앱 세션 유지 기간(예: 30일 슬라이딩), 최초 슈퍼 관리자 생성 방식(ASM-015), 거절 사용자 재신청 허용 여부, 인앱 브라우저 `prompt=none` 자동 로그인 적용 여부(MVP 이후 가능)

## 7. 리스크

KOE006(리다이렉트 URI 불일치), FE·BE 도메인 분리 시 인앱 브라우저 쿠키 차단, AC-060은 실제 기기(iOS·Android 카카오톡)에서만 확인 가능

출처: developers.kakao.com/docs/ko/kakaologin/rest-api, …/prerequisite, …/utilize, …/common, /getting-started/security-guideline, /getting-started/app-key-migration

## 8. 구현 상태(2026-11-11)

구현: `backend/app/modules/{user,auth,approval,role}`, 마이그레이션 `0002`(users·user_identities·auth_sessions)·`0003`(provider 'dev' 허용), FE `featureSource`(인증·승인·역할만 api), Vite 프록시 `/api`·`/health`.

위 설계와 달라진 점·임시 결정(최종 정책 아님, 기획 확인 필요):

| 항목 | 설계 초안 | 구현(임시) |
|---|---|---|
| 카카오 ID 저장 | `users.kakao_user_id` | 별도 `user_identities(provider, provider_user_id)` — 직접 추가 회원은 연결 없음, 공급자 추가 가능 |
| 세션 유지 기간 | 30일 슬라이딩(예) | 30일 고정(`SESSION_TTL_DAYS`), 연장 없음 |
| 로그아웃 | - | 현재 브라우저 세션만 삭제(다른 기기 유지) |
| 거절 사용자 재신청 | 결정 필요 | 허용 안 함: 다시 로그인하면 계정 상태(거절) 화면 |
| 최초 슈퍼 관리자(ASM-015) | 결정 필요 | 실제 카카오 가입 신청 → 서버 CLI `make super-admin id=<UUID>`(이미 있으면 `--additional` 필요). 이메일·닉네임 자동 부여 없음 |
| 이름 최대 길이(F13) | 백엔드 스키마 | 30자(지인 표시도 30자) |
| CSRF | SameSite=Lax + Origin | 동일. Origin이 없으면 같은 출처 Referer만 허용 |
| 개발용 운영진 로그인 | 없음 | 사용자 요청(2026-11-11): `DEV_LOGIN_*`, APP_ENV=local 전용·기본 꺼짐, 비밀번호는 환경변수만 |
| 회원 로그아웃 화면 | SCR-121(B5) | 마이페이지(`/me`) 최소 구현의 '로그아웃'(카카오·개발용 공통) |

## 9. 수동 확인 절차(실제 카카오 계정 필요 — 자동 검증 아님)

1. DB: `make up` 또는 `docker compose up -d --wait db` → `make migrate`
2. backend 실행(호스트: `cd backend && uv run uvicorn app.main:app --reload`), frontend는 `cd frontend && VITE_DATA_SOURCE=api pnpm dev`(5173, `VITE_API_BASE_URL` 비움 권장)
3. `http://localhost:5173/login` → '카카오로 시작하기' → 카카오 로그인·동의 → `/signup`으로 돌아오는지(KOE006이면 콘솔의 Redirect URI 확인)
4. 이름·성별·급수 입력 → '가입 신청' → `/account-status`(승인 대기)
5. 다른 브라우저(또는 시크릿 창)에서 '운영진 로그인하기'(개발용) 또는 슈퍼 관리자 계정으로 `/ops/approvals` → 승인
6. 4의 브라우저에서 '다시 확인' 또는 로그아웃 후 다시 카카오 로그인 → `/tutorial` 진입
7. 새로고침해도 로그인 유지, 같은 카카오 계정으로 다시 가입 시도 시 새 계정이 생기지 않는지(`make users`)
8. 카카오 로그인 화면에서 '취소' → `/login?error=kakao_failed` 안내
9. 최초 슈퍼 관리자: `make users status=pending` → `make super-admin id=<UUID>` → 그 계정으로 `/ops/roles` 접근
