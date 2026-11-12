# B0–B6 Mock → 실제 PostgreSQL/API 통합 계획

> **진행 상태(2026-11-12)**: 사용자 결정 D1 서버 실행·동등성 테스트 / D2 게스트 소프트 삭제 / D3 미통과 기준 보류(임의 정책 금지) / D4 프런트 콘텐츠 기준, 서버는 id·상황 수만 / D5 코트 수 DB 설정(기본 4). 점수는 `users.score` 대신 **`member_ratings` 분리 테이블**(사용자 요청). **I1 완료**(리비전 0004), **I2 완료**(리비전 0005 — 영속 DB 적용은 사용자 승인 후), I3–I4 미착수

- 작성: 2026-11-12. **계획만** — 사용자 승인 후 배치별로 구현합니다.
- 기준: 승인된 Planning·UX Spec(변경 없음), 현재 구현(B0–B6), 프런트엔드 `api.ts`에 이미 적어 둔 api 모드 경로(계약).
- 이미 실제 DB/API: 인증(카카오·세션·개발용 로그인), 가입 승인, 역할, 본인 프로필(`users`, `user_identities`, `auth_sessions`, 리비전 0001–0003).
- 이 문서의 표·스키마는 제안입니다. 구현 단계에서 사람이 검토·테스트해야 합니다.

## 0. 공통 원칙

| 항목 | 방침 |
|---|---|
| 사람 키 | 지금 Mock의 `'member:<id>' / 'guest:<id>'`를 DB에서는 `user_id`·`guest_id` 두 FK 열 + `CHECK(정확히 하나)`로 표현(참조 무결성 유지). API 응답은 지금처럼 `key` 문자열을 계속 씀(프런트 변경 최소) |
| 권한 | 운영 API는 `admin_user`, 회원 API는 `approved_user`(본인 것만, 사용자 id를 경로로 받지 않음), 상태 변경은 모두 `verify_origin`. 회원 응답 계약 테스트로 1–10 점수·실력차·팀 점수 합·급수(타인)·지인·튜토리얼 권장 여부가 없음을 확인(AC-017·066·068) |
| 동시 수정 | 세션·청백전에 `version` 정수 열. 요청의 version이 다르면 409 `conflict`(지금 프런트 오류 코드 그대로) |
| 기능 전환 | `frontend/src/lib/data/source.ts`의 `BACKEND_READY`에 배치마다 기능 이름을 추가. **되돌릴 때는 이 목록에서 빼면 Mock으로 복귀**(DB 롤백 없이 화면만 되돌림) |
| 마이그레이션 | 배치마다 새 리비전(0004~), 추가만(기존 열·행을 바꾸지 않음), downgrade 작성. 공유 DB에 적용하기 전 `pg_dump` 백업 |
| 기존 데이터 | Mock 샘플은 **DB에 넣지 않음**. 개발용 가상 데이터가 필요하면 별도 시드 명령(로컬 전용, 마이그레이션과 분리) |
| 검증 | 배치마다 `make check` + `make migrate` + `make test-db`(Docker 또는 임시 PostgreSQL) + 프런트 api 모드 테스트 + 브라우저 `check-*.mjs`(api 모드, 임시 DB) + Mock 모드 회귀 |

### 전환 기간의 불일치(알려진 문제)
명단을 실제 DB로 바꾸고 청백전·오늘 운동은 아직 Mock이면, Mock 기능은 Mock 사람(샘플)을 계속 씁니다. 실제 회원이 Mock 대진에 나오지 않습니다. → **I1–I4를 이어서 진행하고, 끝날 때까지 api 모드는 개발 확인용**으로만 씁니다.

### 결정이 필요한 사항(구현 전 질문)
| ID | 질문 | 권장안 |
|---|---|---|
| D1 | 대진 생성 알고리즘(오늘 운동 `lineup.ts`, 청백전 `schedule.ts`)을 어디서 실행할지 | **서버로 이식**(Python `service.py`). 확정·동시 수정·권한 판단이 서버에 있어야 하므로. 같은 시드·입력에 같은 결과인지 TS 테스트에서 뽑은 JSON 고정 사례로 비교 |
| D2 | 게스트 삭제 방식 | **소프트 삭제(`deleted_at`)**: 종료된 청백전·지난 세션 기록이 '삭제된 게스트'로 남게. 진행 중·확정 경기 포함 시 삭제 거부(C-26)는 그대로 |
| D3 | '튜토리얼 권장 · 미통과' 정의(F16) | 기획 결정 필요. 임시: 권장 대상(점수 3 이하·미설정 승인 회원) 중 입문자 스테이지를 하나도 통과하지 않은 회원 |
| D4 | 튜토리얼 스테이지 목록을 서버가 아는 방식 | 프런트 `content/stages.ts`의 스테이지 id·상황 수만 JSON으로 내보내 서버 상수로 둠(시나리오 본문은 서버에 두지 않음) |
| D5 | 코트 수(C-06) 저장 위치 | `club_settings` 한 행 테이블(운영진 변경 화면은 범위 밖, 기본 4) |

---

## I1. 회원 명단·게스트·점수 (SCR-211–214, FR-004–006, C-21·C-26)

**현재 Mock**: `MockUser`(이름·성별·급수·지인·역할·상태·`score`·튜토리얼 개수·샘플 전적) / `MockGuest`(이름·성별·급수·`score`) / 게스트 삭제 분기는 세션·청백전 Mock에서 계산.

**DB**
- (구현) `member_ratings(user_id PK·FK CASCADE, score 1–10, updated_at, updated_by_id)` — 회원 기본 프로필(`users`)과 분리, 미설정 = 행 없음. 회원 권한 API는 이 테이블을 읽지 않음
- `guests(id uuid PK, name varchar(30), gender, grade, score smallint null check 1–10, created_at, updated_at, deleted_at null)` — 게스트는 카카오 계정·가입 기록 없음
- 직접 추가 회원(SCR-213 '회원 추가'): `users` 행만(상태 approved, `user_identities` 없음) — 이미 선택적 연결 구조

**API**(프런트 계약 그대로, 모두 `admin_user`)
| 메서드·경로 | 내용 |
|---|---|
| `GET /api/roster` | 승인·비활성 회원(이름순) + 게스트(삭제 제외). 행: id·kind·이름·성별·급수·점수·튜토리얼 권장 미통과 |
| `GET /api/roster/members/{id}/status` | 지인·랭크·전적·튜토리얼 통과 수·권장 대상(I2·I3 전에는 0·기록 없음) |
| `PUT /api/roster/{members|guests}/{id}` | 이름·성별·급수·점수 |
| `PUT /api/roster/{members|guests}/{id}/score` | 점수만(SCR-214 연달아 입력) |
| `POST /api/roster/guests`, `POST /api/roster/members` | 추가(회원 직접 추가는 지인 포함) |
| `GET /api/roster/guests/{id}/delete-info`, `DELETE /api/roster/guests/{id}` | 삭제 분기(C-26). I3·I4 전에는 포함 없음으로 계산 → 해당 배치에서 실제 판정 연결 |

**권한 연결**: 회원 본인 프로필(`/api/me/profile`)과 명단 편집이 같은 `users` 행 → AC-054·098 실제 반영. 회원 API 응답에 `score` 없음(계약 테스트).

**프런트**: `BACKEND_READY`에 `'roster'`. 화면 수정 없음(응답 형태가 같으면). 명단 Mock 전용 필드(`involvement` 등)는 서버 응답으로 대체.

**마이그레이션·테스트**(구현): 0004 `add member ratings and guests`. 동시 수정은 내용 기반 `version` 토큰 + `SELECT … FOR UPDATE`, 점수만 입력은 `previous` 값 비교. 오늘 운동·청백전(아직 Mock) 화면의 점수 입력은 Mock 저장(`setMockScore`). `tests/modules/test_roster.py`(AC-010·012–016·097–100·105–107, 권한, 계약), db 테스트(점수 CHECK, 소프트 삭제).

**보존·롤백**: 열·테이블 추가만이라 기존 사용자 영향 없음. downgrade는 `guests` 삭제·`users.score` 삭제(그 사이 입력한 점수·게스트는 사라지므로 백업 후). 화면은 `BACKEND_READY`에서 빼면 즉시 Mock.

## I2. 튜토리얼 진행 기록 (SCR-101·103, FR-026, C-23, AC-094, NFR-006)

**현재 Mock**: `tutorialProgress[userId][stageId] = { passed, best, firstPassedAt }`, 저장 규칙은 순수 함수 `mergeProgress`.

**DB**: `tutorial_progress(user_id FK CASCADE, stage_id varchar(32), passed bool, best smallint, first_passed_at timestamptz null, updated_at, PK(user_id, stage_id))` — 상황별 선택 기록 열 없음.

**API**(`approved_user`, 본인만)
| 메서드·경로 | 내용 |
|---|---|
| `GET /api/me/tutorial/progress` | `{ stageId: {passed, best, firstPassedAt} }` |
| `PUT /api/me/tutorial/stages/{stageId}` | (구현) `{score, total}` → 서버 레지스트리로 스테이지·상황 수(다르면 409 `content_mismatch`)·점수 범위 검증 후 통과 다시 계산(클라이언트 `passed`는 믿지 않음). **한 문장 원자적 upsert**: `passed = 기존 OR 이번`, `best = GREATEST`, `first_passed_at = COALESCE(기존, 이번 통과면 now())` — 재전송·두 기기 동시 저장에도 결과 같음 |

**권한 연결**: 운영진 명단 상태(`/members/{id}/status`)가 같은 테이블에서 통과 수를 읽음(C-23). 회원에게는 본인 것만.

**프런트**: `BACKEND_READY`에 `'tutorial'`. Mock 실패 시뮬레이션 플래그는 Mock 전용으로 남김.

**마이그레이션·테스트**: 0005 `add tutorial progress`. AC-094(4점 → 3점 재플레이, 같은 결과 두 번), 동시 저장 db 테스트, 범위 밖 점수·없는 스테이지 거부, 응답에 상황별 기록 없음.

**보존·롤백**: 새 테이블만. downgrade는 테이블 삭제(진행 기록 소실 → 백업). 시나리오 검수(ASM-023)는 데이터 파일 교체로 별도 진행.

## I3. 청백전·전적·랭크 (SCR-221–226·111·112·121, FR-014–016·023·024, C-13–C-20)

**현재 Mock**: `MockClubMatch`(참가자 맵·팀·귀가, 경기 배열(team1/team2 키, 결과, 성별 완화, 변경됨), 시드, `version`, `modifiedAt`) / 전적·랭크는 경기 결과에서 계산(`clubRecordOf`, `rankFor`).

**DB**
- `club_matches(id, name, date, method check, status check draft|confirmed|finished, total_games, rule_balance, rule_gender, seed, team_proposed, modified_at, version, created_by, created_at, confirmed_at, finished_at)`
- `club_match_participants(id, match_id FK CASCADE, user_id null, guest_id null, team null|blue|white, left_at null, CHECK 하나, UNIQUE(match_id, user_id), UNIQUE(match_id, guest_id))`
- `club_match_games(id, match_id FK CASCADE, no, winner null|1|2, gender_relaxed, changed, UNIQUE(match_id, no))`
- `club_match_game_players(game_id FK CASCADE, side 1|2, slot 1|2, participant_id FK, PK(game_id, side, slot))`
- 전적·랭크는 **저장하지 않고 경기 결과에서 계산**(개인전·팀전 합산, 게스트 제외, 확정·종료 청백전만). 필요하면 이후 뷰·캐시

**API**
- 운영(`admin_user`, 프런트 계약 그대로): 목록·만들기·상세, `PUT method|settings|participants/{key}|teams/{key}`, `POST teams/propose|games|confirm|finish|games/{no}/swap|participants/{key}/leave`, `PUT games/{no}/result`. 409 코드: `conflict`·`unscored_players`·`min_players`·`in_games`·`not_all_recorded`·`locked`
- 회원(`approved_user`): `GET /api/member/club-matches`, `GET /api/member/club-matches/{id}`(미확정·없는 것은 같은 404, 점수·실력차·급수 없는 응답), `GET /api/me/record`
- 명단 연결: 회원 상태의 랭크·전적, 게스트 삭제 분기(확정 미기록 경기·확정 전 대진·참가자만)

**프런트**: `BACKEND_READY`에 `'clubmatch'`. 대진 생성은 D1 결정에 따라 서버 호출로(현재도 api 분기 있음). 회원 '나' 판정은 서버가 세션으로.

**마이그레이션·테스트**: 0006 `add club matches`. `schedule.ts` 이식 시 TS 고정 사례 비교 테스트, AC-042–047·057·058·068–089, 동시 확정·교체 충돌 db 테스트, 회원 응답 계약 테스트.

**보존·롤백**: 새 테이블만. downgrade는 테이블 삭제(기록 소실 → 백업). 실제 운영 기록이 쌓인 뒤에는 downgrade 대신 화면 전환(`BACKEND_READY`)으로만 되돌림을 권장.

## I4. 오늘 운동·출석·라운드 (SCR-202–205, FR-007–013, C-01–C-12·C-25)

**현재 Mock**: `MockSession`(KST 날짜, 상태, 출석 체크 순서, 다음 라운드 제외자, 옵션, 라운드 배열(코트별 팀·완화 표시, 대기자), `version`) + `courtCount`.

**DB**
- `club_settings(id=1, court_count default 4)`(D5)
- `sessions(id, session_date date UNIQUE, status open|closed, method, rule_balance/gender/fairness/no_repeat, check_seq, version, created_at, closed_at)` — 하루 한 세션(C-25), 날짜는 서버가 KST로 계산
- `session_attendance(id, session_id FK CASCADE, user_id null, guest_id null, check_order, excluded_next bool, CHECK 하나, UNIQUE 사람별)`
- `rounds(id, session_id FK CASCADE, no, seed, status draft|inProgress|completed, UNIQUE(session_id, no))`
- `round_courts(id, round_id FK CASCADE, no, relaxations text[])`, `round_court_players(court_id, side, slot, attendance_id)`, `round_waiting(round_id, attendance_id, position)`

**API**(`admin_user`, 프런트 계약 그대로): `GET /api/sessions/today`, `GET /api/sessions/{id}`, `POST /api/sessions/today`, `PUT attendance/{key}`, `PUT options`, `POST rounds`(생성), `POST rounds/confirm|swap|complete`, `POST close`. version 충돌 409 `conflict`.

**권한·연결**: 게스트 삭제 분기(진행 중 라운드 출전 → 거부, 확정 전 대진 → 폐기)를 실제 데이터로. 점수 미설정자 생성 제한(C-24 일반 게임).

**프런트**: `BACKEND_READY`에 `'session'`. 화면 수정 없음.

**마이그레이션·테스트**: 0007 `add sessions and rounds`. `lineup.ts`(C-01–C-06, P1–P8 임시 정책) 이식 + 고정 사례 비교, NFR-004 2초 성능 테스트(20명·4코트), 동시 확정 충돌, 이전 날짜 미종료 세션 배너(UXD-076).

**보존·롤백**: 새 테이블만. 롤백은 I3과 같음.

---

## 권장 진행 순서와 배치 크기

| 순서 | 배치 | 크기 | 선행 |
|---|---|---|---|
| I1 | 명단·게스트·점수 | 중 | - |
| I2 | 튜토리얼 진행 | 소 | I1(명단 상태 연결) |
| I3 | 청백전·전적·랭크 | 대(알고리즘 이식) | I1, D1·D2 결정 |
| I4 | 오늘 운동 | 대(알고리즘 이식) | I1, D1·D5 결정 |

각 배치 끝에 Mock 모드 회귀(B1–B6 스크립트)와 api 모드 확인을 함께 실행합니다. 실제 카카오 신규 가입 수동 확인(남은 항목)은 I1과 함께 진행하면 명단 반영까지 한 번에 볼 수 있습니다.
