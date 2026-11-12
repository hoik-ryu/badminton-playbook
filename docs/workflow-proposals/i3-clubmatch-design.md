# I3 청백전·전적·랭크 — DB/API 설계안(구현 전)

- 작성: 2026-11-12. **설계 보고용** — 코드 구현·마이그레이션은 아직 하지 않음(사용자 승인 후 하위 배치로 진행).
- 근거: Planning r4(FR-014–016·023·024, C-07·09·13–20·26, ASM-019), AC-042–047·057·070–089·013·105–107, UX Spec(SCR-111·112·221–226, UXD-032·036·037·043·045·047·049·072·075), B4·B5 구현과 Mock, I1·I2 구현.
- 승인 문서·해시·`state.yaml`은 변경하지 않습니다. 이 문서는 제안이며 사람이 검토해야 합니다.

## 1. 현재 구조 분석

### 1.1 B4 운영(SCR-221–226) — `frontend/src/features/clubmatch/api.ts`·`schedule.ts`
| 항목 | 현재 Mock 동작 |
|---|---|
| 저장 형태 | `MockClubMatch`: id·이름·날짜·방식·상태(draft/confirmed/finished)·참가자 맵(`'member:<id>'`·`'guest:<id>'` → 팀·귀가)·총 경기 수·규칙(밸런스·성별)·경기 배열(`team1/team2` 사람 키, `winner`, `genderRelaxed`, `changed`)·시드·`teamProposed`·`modifiedAt`·`version` |
| 운영 조작 | 만들기, 방식(확정 전, 대진 버림·팀 초기화), 설정, 참가(경기에 든 사람은 해제 불가 `in_games`), 팀, 팀 배정안, 대진 생성(점수 미설정 `unscored_players`, 4명 미만 `min_players`), 확정, 결과 기록·수정, 종료(미기록 있으면 `not_all_recorded`), 선수 교체, 중도 귀가 + 대체 선수(원자적) |
| 충돌 감지 | `version` 비교는 C-19 목록과 같음: 확정·교체·결과·방식·종료(+중도 귀가). 참가자·팀·설정·생성은 비교 안 함 |
| 알고리즘 | `generateClubGames`(시드 `rng`=mulberry32, 참가자 입력 순서, 경기마다 60회 시도, 비용 = 같은 4명·같은 팀 1e12 > 파트너 반복 1e9 > 성별 1e6 > 밸런스 1e3, 경기 수 차이 ≤1은 `pickLowest`로 보장), `distribution`·`evenProposals`(균등안 2개), `proposeTeams`(성별별 점수 지그재그), `individualStandings`(공동 순위 1·2·2·4), `teamScore` |
| 교체 후보 | 클라이언트 계산 `candidatesFor`(같은 경기 중복·같은 4명·같은 팀 구성 비활성, 교체 후 실력차·경기 수 차이) |

### 1.2 B5 회원(SCR-111·112·121) — `memberApi.ts`, `features/me/api.ts`
- 회원 목록·상세: 확정·종료만, 미확정·없음은 같은 404(AC-069). 응답에 점수·실력차·급수·성별 완화·version 없음(계약 테스트 있음).
- 전적·랭크: `clubRecordOf`(확정·종료 청백전의 **기록된 결과**를 회원별 합산) + Mock 샘플의 이전 기록 → `rankFor`(10경기 이상, 70/55/40%).

### 1.3 I1·I2와의 연결
- I1: 회원 = `users`(승인 상태), 게스트 = `guests`(소프트 삭제), 1–10 점수 = `member_ratings`·`guests.score`. 청백전의 사람 키와 점수는 여기서 가져옴(생성 전 점수 필수, C-19).
- I1 게스트 삭제(`/api/roster/guests/{id}` DELETE, `delete-info`)는 지금 항상 '포함 없음' → I3에서 C-26 청백전 분기 연결.
- I1 회원 현황(`/members/{id}/status`)의 랭크·전적은 I3에서 연결.
- I2: 직접 의존 없음(튜토리얼 통과 수는 별개). 회원 현황 응답만 공유.
- 현재 API 모드 혼재: 청백전 화면은 Mock 사람(샘플), 명단은 실제 DB. I3 전환 후 청백전 화면 점수 입력(`ScoreEntrySheet`)을 다시 명단 API로 돌려야 함.

### 1.4 I1 결함 발견(승인 AC와 불일치)
- **AC-013**(승인): "지난 경기 기록에는 G의 이름 대신 '삭제된 게스트'가 표시됩니다. (r3) G의 급수도 함께 지워집니다."
- 현재 I1 소프트 삭제는 `guests` 행의 이름·급수를 **그대로 보관**(목록에서만 숨김). 급수 삭제가 빠져 있음.
- 제안(I3-a에 포함, 승인 필요): 삭제 시 `grade`를 지움(→ `guests.grade` NULL 허용 + CHECK 수정 마이그레이션), 지난 기록 표시는 항상 '삭제된 게스트'. 이름 보관 여부는 §3 U5.

## 2. DB/API 설계(확정안)

### 2.1 테이블(리비전 0007, 추가만 — 0006은 게스트 비식별화, §6)
| 테이블 | 열(요약) | 비고 |
|---|---|---|
| `club_matches` | id uuid PK, name(30), match_date date, method CHECK(individual/team), status CHECK(draft/confirmed/finished), total_games smallint(≥1), rule_balance, rule_gender, seed bigint NULL, team_proposed bool, modified_at NULL, version int, created_by_id, created_at, confirmed_at, finished_at | 대진 버전·동시 조작 기준 |
| `club_match_participants` | id uuid PK, match_id FK CASCADE, user_id FK NULL, guest_id FK NULL, team CHECK(blue/white/NULL), left_at NULL, position int(추가 순서) | `CHECK(user_id 또는 guest_id 정확히 하나)`, `UNIQUE(match_id,user_id)`, `UNIQUE(match_id,guest_id)`. `position` = 생성 알고리즘 입력 순서(결정성) |
| `club_match_games` | id uuid PK, match_id FK CASCADE, no smallint, winner smallint NULL CHECK(1/2), gender_relaxed bool, changed bool, recorded_at NULL, recorded_by_id NULL | `UNIQUE(match_id,no)` |
| `club_match_game_players` | game_id FK CASCADE, side CHECK(1/2), slot CHECK(1/2), participant_id FK **RESTRICT** | PK(game_id,side,slot). 같은 경기 중복 금지 `UNIQUE(game_id, participant_id)` |

- 회원·게스트 FK: `users`·`guests` 행은 지우지 않음(회원은 비활성, 게스트는 소프트 삭제) → 지난 기록 보존. 참가자 → 사람 FK는 `RESTRICT`(기록 있는 사람의 물리 삭제를 막음).
- 전적·랭크·순위·팀 승수는 **저장하지 않고 경기 결과에서 계산**(결과 수정 시 자동으로 다시 계산, FR-016·023, AC-047·085). 값이 바뀌는 곳이 한 곳뿐이라 불일치가 없음.
- 대진 생성 결과(경기·선수)는 저장(확정 후 공개·교체·기록의 대상).

### 2.2 API(프런트 계약 유지)
**운영(`admin_user`, 쓰기는 `verify_origin`)** — 응답 형태는 지금 `ClubMatchView`·`ClubMatchListItem` 그대로(운영진 화면이라 점수·실력차·급수 포함)
| 메서드·경로 | 동작 | 충돌 검사(version) |
|---|---|---|
| `GET /api/club-matches`, `GET /api/club-matches/{id}` | 목록·상세(참가자 행, 미리보기, 균등안, 경기, 순위, 팀 승수) | - |
| `POST /api/club-matches` | 만들기(draft) | - |
| `PUT …/{id}/method` | 방식 변경(확정 전, 대진 폐기·팀 초기화) | ✔ |
| `PUT …/{id}/settings`, `PUT …/participants/{key}`, `PUT …/teams/{key}`, `POST …/teams/propose` | 확정 전 설정·참가·팀 | ✔(U9 결정, 2026-11-12) |
| `POST …/{id}/games` | 대진 생성·다시 생성(서버 알고리즘, 새 시드) | ✔(U9) |
| `POST …/{id}/confirm` | 확정(회원 공개) | ✔ |
| `PUT …/{id}/games/{no}/result` | 결과 기록·수정(확정·종료 모두, 이긴 쪽만) | ✔ |
| `POST …/{id}/finish` | 종료(미기록 0) | ✔ |
| `POST …/{id}/games/{no}/swap` | 결과 없는 경기 선수 교체(확정 전 전체, 확정 후 미기록만, 종료 후 불가) | ✔ |
| `POST …/{id}/participants/{key}/leave` | 이후 대진에서 제외 + 남은 경기 대체(원자적) | ✔ |

**회원(`approved_user`)** — 확정·종료만, 점수·실력차·급수·성별 완화·version 없음(AC-017·066·068)
- `GET /api/member/club-matches`, `GET /api/member/club-matches/{id}`(미확정·없음 같은 404 `club_match_not_found`), `GET /api/me/record`(본인 전적·랭크)

**I1 연결**: `GET /api/roster/members/{id}/status`의 rank·record, `GET/DELETE /api/roster/guests/{id}`(C-26: 확정 미종료 미기록 경기 포함 → 거부 / 확정 전 대진 포함 → 대진 폐기와 원자적 삭제 / 참가자만 → 참가자에서 빼고 삭제)

### 2.3 동시 조작
- 모든 쓰기: `club_matches` 행 `SELECT … FOR UPDATE`로 잠근 뒤 처리(한 청백전의 변경을 줄 세움).
- **모든 변경**이 요청의 `version`과 비교 → 다르면 409 `conflict`(`details.version` = 최신). C-19 대상 + 확정 전 조작(U9 결정).
- **모든 변경에서 version 증가**(Mock은 일부만 증가). 그래야 다른 운영진이 참가자를 바꾼 뒤의 확정도 충돌로 잡힘. 프런트는 변경 후 다시 불러오므로 영향 없음(설계 선택, 정책 아님).

### 2.4 회원 공개 데이터 분리
- 운영 응답 스키마와 회원 응답 스키마를 **별도 Pydantic 모델**로 두고, 회원 스키마에는 점수·실력차·급수·성별 완화·version 필드 자체가 없게 함. 계약 테스트로 확인(AC-066).

### 2.5 대진 알고리즘 서버 이전(D1 결정: 서버 실행 + 동등성 테스트)
- `schedule.ts`의 `distribution`·`evenProposals`·`proposeTeams`·`generateClubGames`·`individualStandings`·`teamScore`와 `lineup.ts`의 `rng`·`pairKey`·`matchupKey`를 Python(`backend/app/modules/clubmatch/schedule.py`)으로 이식.
- 결정성 조건: mulberry32를 32비트 정수 연산으로 똑같이(`Math.imul`·`>>>` 대응), 안정 정렬, 문자열 키 비교(ASCII 키라 같음), **참가자 순서 = `position`(추가 순서)**, 시드 저장.
- 동등성 테스트: 고정 입력 세트(인원 4·5·9·12·20, 개인전·팀전, 규칙 4조합, 시드 여러 개)의 TS 결과를 **골든 JSON**(`backend/tests/golden/*.json`, I3-a는 `clubmatch_schedule.json`)으로 저장 → 프런트 테스트(TS 엔진 = 골든)와 백엔드 테스트(Python 엔진 = 골든)가 같은 파일을 비교. 둘 중 하나만 바뀌면 실패.
- 이식 후 프런트 Mock은 그대로 TS 엔진 사용(Mock 모드 유지).

### 2.6 프런트엔드 전환 범위
- `BACKEND_READY`에 `'clubmatch'` 추가(운영·회원·전적이 한 번에 전환 — 부분 전환은 화면 간 데이터가 어긋나므로 I3 마지막에).
- `ClubMatchPage`의 점수 입력 시트: Mock 저장(`setMockScore`) → 명단 API(`setScore`)로 되돌림(참가자가 실제 사람이 되므로). `SessionPage`는 I4 전까지 Mock 유지.
- 응답 형태가 같아 화면 코드 변경은 거의 없음. Mock 전용 함수(`guestClubInvolvement` 등)는 Mock 경로에만 남김.

## 3. 정책 점검

### 3.1 이미 결정된 정책(문서 근거)
| 항목 | 결정 | 근거 |
|---|---|---|
| 확정 후 수정 범위 | 결과 없는 경기의 선수 교체만, 중도 귀가는 제외 + 남은 경기 대체(기존 경기·결과 유지), 수정 표시('대진이 수정되었습니다(시각)', 바뀐 경기), 알림 없음 | C-15, AC-077·078·088 |
| 확정 후 잠금 | 방식·다시 생성·팀 변경 불가 | C-13, SCR-223-ST8 |
| 종료 | 미기록 0일 때만, 확인 창. 종료 후 승패 수정 가능(확인), 선수 교체 불가 | C-20, AC-085 |
| 결과 입력 | 확정 후부터, 이긴 쪽만(스코어 없음). 처음 기록은 즉시, 반대로 바꿀 때만 확인 | C-20, AC-044·081, UXD-032·036 |
| 재계산 | 결과가 바뀌면 순위·팀 승수·랭크 다시 계산. **기록 즉시 반영**(종료를 기다리지 않음) | FR-016·023, AC-047·057·085 |
| 랭크 공식 | 전체 누적, 10경기 이상만, S ≥70% · A ≥55% · B ≥40% · C <40%, 미만은 '랭크 없음 · n경기 남음' | C-07, FR-016, AC-045·046 |
| 랭크 대상 | 개인전·팀전 모든 경기, 이긴 2명 승·진 2명 패, 대체 선수는 실제로 뛴 사람 기록, 게스트 제외(게스트와 함께 뛴 회원 경기는 반영) | C-09·15·17, AC-057·083·086 |
| 집계 | 개인전 누적 승수 순위, 동률 공동 순위, 경기 수 표시, 게스트 '게스트' 표시 / 팀전 청·백 승수, 같으면 무승부(결정전 없음) | C-16, AC-082·084 |
| 회원 공개 | 확정 청백전의 대진·결과·순위/팀 승수, 본인 강조. 미확정·점수·실력차·팀 점수 합·타인 랭크 비공개 | C-18, AC-069·087 |
| 알고리즘 | 결정적 엔진(같은 입력 같은 결과), 경기 수 차이 ≤1(자동·다시 생성), 균등안, 같은 4명·같은 팀 금지, 파트너 반복 최소화, 팀전 청2:백2, 밸런스·성별 옵션, 점수 모두 있어야 생성. 수동 교체로 차이 2 이상이면 경고만 | C-14·19, AC-043·071–076·079 |
| 동시 조작 감지 대상 | 확정, 선수 교체, 결과 입력·수정, 방식 변경, 종료 | C-19, AC-080 |
| 게스트 삭제 | 확정 미종료 미기록 경기 포함 → 삭제 불가 / 확정 전 대진 포함 → 폐기 안내·확인 후 원자적 / 지난 기록은 '삭제된 게스트', **급수 삭제** | C-26, AC-013·105–107, ASM-019 |
| 탈퇴 | 회원 직접 탈퇴 없음(범위 밖). 활동 중단은 운영진 비활성(Should) | PRD 범위 밖, Q-018, FR-020 |
| 서버 이전 | 대진 생성은 서버, 동등성 테스트 | 사용자 결정 D1 |

### 3.2 미결 정책 → 사용자 결정(2026-11-12, 결과는 §3.3)
| ID | 질문 | 현재 B4 Mock 임시 동작 | 영향 |
|---|---|---|---|
| U1 | 청백전 **삭제·취소**(잘못 만든 청백전, 확정 후 취소) 기능 | 없음 | 없으면 잘못 만든 draft도 남음 |
| U2 | 기록된 결과를 **미기록으로 되돌리기** | 없음(이긴 쪽 바꾸기만) | 잘못 누른 경기 처리 |
| U3 | 공동 순위 다음 번호(1·2·2·**4** 경쟁 순위 vs 1·2·2·**3** 밀집 순위) | 1·2·2·4 | AC-082는 '공동 2위'까지만 정의 |
| U4 | 같은 승수 안의 표시 순서(이름순 등) | 사람 키 순(사실상 임의) | 표시 일관성 |
| U5 | 게스트 삭제 시 **이름 보관 여부**(급수는 삭제로 결정됨) | 이름·급수 모두 보관(I1) | 개인정보 최소화(NFR-006) vs 운영 감사 |
| U6 | **비활성 회원**(US-020, Should)의 지난 기록 표시·순위표 포함·랭크 유지 | Mock은 승인 회원만 이름 매핑 → 비활성은 '삭제된 게스트'로 잘못 보임 | 비활성 기능 구현 시 |
| U7 | 같은 4명·같은 팀 구성을 **피할 수 없을 때**(소수 인원·경기 수 많음) 생성 거부 vs 허용 | 비용 최소안을 그대로 둠(금지 위반 가능) — B3 P7과 같은 공백 | C-05 '항상 금지'와 충돌 가능 |
| U8 | 참가자 4명 미만·팀전 한 팀 2명 미만 외의 **최소 인원** 기준 | 4명·팀당 2명 | - |
| U9 | 확정 전(참가자·팀·설정·다시 생성) 동시 수정: C-19 목록 밖 | 마지막 저장 우선 | §2.3처럼 version은 올려 확정 시 감지(설계로 해결 가능, 정책 확인 권장) |
| U10 | 종료 후 결과 수정 시 '대진이 수정되었습니다' 표시 여부(C-15는 확정 후 '대진' 수정 기준) | 결과 수정은 표시 안 함 | 회원 화면 문구 |

### 3.3 사용자 결정(2026-11-12)
| ID | 결정 | 반영 배치 |
|---|---|---|
| U1 | 청백전 삭제·취소 **없음** | - (API 없음) |
| U2 | 기록된 결과를 **미기록으로 되돌리기 허용**(확인 창, 기록 재계산) | I3-c |
| U3 | 공동 순위 **1·2·2·4**(경쟁 순위) | I3-a `schedule.standings` |
| U4 | 같은 승수 안 **승률 높은 순 → 이름순**(공동 순위 번호는 유지) | I3-a(BE), I3-d(FE Mock `individualStandings`) |
| U5 | 게스트 삭제 시 **이름·급수 모두 비식별화**, 지난 경기는 '삭제된 게스트' | I3-a(0006, 제안서 `ac-013-guest-anonymization-proposal.md`) |
| U6 | 비활성 회원은 **기록·순위 유지**, 새 참가자 선택에서 제외 | I3-a(참가 자격), I3-d(랭크) |
| U7 | 피할 수 없는 중복 대진 **허용 + 운영진 경고** | I3-b(`club_match_games.repeated_matchup` 열은 I3-a에서 미리 둠) |
| U8 | 최소 **4명**, 팀전은 **팀당 2명** | I3-b(대진 생성 조건) |
| U9 | 확정 전 참가자·팀·설정도 **version 검사** | I3-a(모든 변경), I3-d(FE가 version 전송) |
| U10 | 종료 후 결과 수정 시 회원에게 **수정 표시** | I3-c(`modified_at`·`changed`) |

※ `b4-policy-open-items.md`의 Q1–Q7(배정안 대상, 비용 순서, 대체 추천 기준, 교체 경고, '경기 중' 표시, 종료 조건)도 임시 처리로 남아 있으며 서버 이식 시 그대로 옮깁니다.

## 4. 구현 배치(제안)

| 배치 | 내용 | AC | 마이그레이션 | 테스트 | 롤백 |
|---|---|---|---|---|---|
| I3-a 스키마·초안 단계 | 0006(4개 테이블) + (승인 시) 게스트 급수 NULL 허용·삭제 시 급수 지움. 만들기·목록·상세(조회)·방식·설정·참가·팀·배정안. 응답은 `ClubMatchView` 형태 | AC-042·070·072, AC-013(급수) | 0006(+0007 게스트) | 단위·API(SQLite), PG 연동(제약·CASCADE·RESTRICT), 계약 | downgrade(새 테이블 삭제), 화면은 Mock 유지(아직 전환 안 함) |
| I3-b 알고리즘 이식 | Python `schedule.py` + 골든 JSON 동등성(프런트·백엔드 양쪽 테스트) + 대진 생성·다시 생성 API(점수 필수·최소 인원) | AC-043·071·073–076 | 없음 | 골든 비교, 결정성, 경기 수 차이 ≤1 성질 테스트, 성능(20명·20경기 2초, ASM-026) | 코드만 |
| I3-c 확정 이후 | 확정·결과·종료·교체·중도 귀가(원자적)·수정 표시·충돌(SELECT FOR UPDATE + version)·C-26 게스트 삭제 연결 | AC-044·077–081·085·088·105–107·014 | 없음 | 동시 확정·결과 PG 연동(스레드), 원자성(부분 실패 없음) | 코드만 |
| I3-d 집계·회원·전환 | 순위·팀 승수·전적·랭크(조회 시 계산), `/api/me/record`, 명단 회원 현황 연결, 회원 API, **`BACKEND_READY`에 clubmatch** + `ClubMatchPage` 점수 입력 명단 API로 | AC-045–047·057·068·069·082–084·086·087·089·017·066 | 없음 | 계약 테스트(회원 응답 필드), 랭크 경계값, API 모드 브라우저(390·1440), Mock B1–B6 회귀 | `BACKEND_READY`에서 빼면 즉시 Mock |

- 각 배치 끝: `make check`, 임시 PostgreSQL 연동 테스트, (Docker 가능 시) `make migrate`·`make test-db`, 영속 DB 적용은 **사전 승인 후 백업 → 적용**.
- 전환(I3-d) 전까지 API 모드 화면은 Mock 그대로라 사용자 개발 환경에 영향 없음.

## 5. 예상 위험
| 위험 | 대응 |
|---|---|
| 알고리즘 이식 불일치(난수·정렬·부동소수) | 골든 JSON 양쪽 테스트, 32비트 연산 단위 테스트, 정수 비용 위주 |
| 혼재 기간 데이터 어긋남(청백전 실제·오늘 운동 Mock) | 오늘 운동 화면은 계속 Mock 사람·Mock 점수 저장, I4로 해소 |
| 게스트 익명화 규칙 변경(I1 결함 수정) | 별도 마이그레이션·테스트, 기존 삭제된 게스트에도 적용 여부 결정 |
| 집계 성능(조회 때 계산) | 인덱스(game_players.participant_id, games.match_id), 회원 수·경기 수 규모가 작음. 필요 시 이후 캐시 |
| 동시 조작 | 행 잠금 + version, PG 동시성 테스트 |
| 정책 공백(U1–U10) | 결정 전에는 Mock 동작을 유지하고 임의 확장하지 않음 |

## 6. I3-a 구현 결과(2026-11-12)

### 6.1 범위
- 테이블 4개(리비전 **0007**) + 게스트 비식별화(리비전 **0006**, 소급 적용).
- 운영 API: 목록·만들기·상세·방식·설정·참가·팀·팀 배정안. 모두 `admin_user` + 쓰기 `verify_origin`.
- 모든 변경: `club_matches` 행 `FOR UPDATE` → version 비교(409 `conflict`) → 확정 전 확인(409 `locked`) → 변경 → version + 1 → 최신 `ClubMatchView` 응답.
- 참가 자격(U6): 승인 회원 + 삭제되지 않은 게스트만 새로 추가(422 `not_eligible`). 이미 참가한 사람은 비활성·삭제여도 행·기록 유지.
- 대진에 들어간 참가자는 참가 해제 불가(409 `in_games`).
- C-26 청백전 부분을 앞당겨 연결(`clubmatch/involvement.py`): 게스트 삭제 시 확정 미종료 미기록 경기 → 409 `guest_delete_blocked`, 확정 전 대진 → 대진 폐기, 확정 전 참가자 → 제거(각 청백전 version + 1). `delete-info`가 `confirmedMatch`·`draftLineup`·`participantOnly` 판정. 실시간 대진(`inRound`)은 세션 DB 이관(I4)에서.
- 계산(`clubmatch/schedule.py`): 경기 수 분포·균등안·팀 배정안(골든 JSON 동등성), 실력차, 팀 승수, 순위(U3·U4). 대진 생성(`generateClubGames`)은 I3-b.
- 화면은 아직 Mock(`BACKEND_READY`에 clubmatch 없음) → 사용자 개발 환경 화면 변화 없음.

### 6.2 프런트 계약 변경(I3-d에서 FE 반영)
- 확정 전 조작(`setSettings`·`setParticipating`·`setTeam`·`applyTeamProposal`, 이후 `generateClub`)도 `version`을 보냄(U9). 현재 FE `api.ts`의 api 분기는 보내지 않으므로 전환 시 422가 됨 → I3-d에서 수정.
- 변경 API 응답 = 최신 `ClubMatchView`(FE는 지금처럼 다시 불러와도 되고, 응답을 바로 써도 됨).
- `GuestDeleteInfo`에 `matchId`·`matchName`·`remaining`·`place`(해당 분기에서만, FE `GuestInvolvement`와 같은 이름).
- FE Mock `individualStandings`는 아직 키 순 → I3-d에서 U4로.
- 새 오류 코드 `not_eligible`(422, 비활성 회원·삭제된 게스트 추가 시) → FE `CLUB_ERRORS`에 추가 필요.
- 삭제된 게스트는 `name: '삭제된 게스트'`, `grade: null` → FE `Person.grade` 타입을 `Grade | null`로(급수 표시 컴포넌트 null 처리).

### 6.3 I3-b 진입 조건
1. 영속 개발 DB `smapsh`에 0006·0007 적용 여부 결정(사용자 승인 → `pg_dump` 백업 → 적용). 미적용이어도 I3-b 개발·임시 PG 테스트는 가능.
2. `generateClubGames`·`rng`(mulberry32)·`pairKey`·`matchupKey` 이식 + 골든 JSON 확장(인원·방식·규칙·시드 조합).
3. U7 경고 표시 방식: `repeated_matchup` 열을 응답에 어떻게 노출할지(FE `ClubGame`에 필드 추가 필요) — 화면 문구는 04/05 문서 확인 후.
4. U8 최소 인원 오류 코드·문구를 FE `CLUB_ERRORS`와 맞춤.
5. 성능 기준(20명·20경기 2초, ASM-026) 측정 테스트.

## 7. I3-b 구현 결과(2026-11-12)

### 7.1 대진 생성 서버 이전
- `clubmatch/schedule.py`에 `rng`(mulberry32)·`pair_key`·`matchup_key`·`generate_club_games`를 이식. FE `generateClubGames`·`lineup.ts`는 **바꾸지 않음**.
- 일치 조건: 32비트 연산은 모두 2^32 나머지(JS `Math.imul`·`>>>`·ToInt32와 비트 단위 동일), 난수 호출 순서(시도 → 청 → 백 / 4명 고르기, 고를 때마다 '문턱과 같은 사람' Fisher–Yates), 안정 정렬, 입력 순서 = `position`, 비용 정수.
- API `POST /api/club-matches/{id}/games {version}` → 최신 `ClubMatchView`. 확정 전만(409 `locked`), version 검사(409 `conflict`), 새 시드 `[0, 2^31)`(Mock과 같은 범위)를 `club_matches.seed`에 저장(같은 시드로 다시 돌리면 같은 대진).

### 7.2 골든·성질 테스트
- `backend/tests/golden/clubmatch_generate.json`(FE `generate.golden.test.ts`가 생성): 난수열 10개 시드 × 12값(0·1·2^31−1·2^31·2^32−1·2^32 경계 포함), 대진 240사례·3,058경기(인원 4–20, 남만·여만·여1, 같은 점수·극단 점수, 팀 2v2·2v3·3v5·2v10·10v10, 규칙 4조합, 시드 여러 개, 4명×10경기·8명×40경기 같은 소진 사례). **TS ↔ Python 전부 일치**.
- 성질(골든 + 무작위 300): 한 경기 같은 사람 없음, 팀전 청2:백2, 경기 수 차이 ≤1(팀전은 팀 안에서).

### 7.3 U7 처리
- 생성은 기존 우선순위 그대로(같은 4명·같은 팀 > 파트너 반복 > 성별 > 밸런스).
- 각 경기 응답에 `repeatedMatchup`(DB `repeated_matchup`)와 `relaxations: [{rule, reason}]`.
  - `rule`: `matchup`(U7) · `gender`(C-03, 성별 규칙을 켰을 때)
  - `reason`: `exhausted`(경기 수 차이 ≤1을 지키는 **모든 후보를 전수 확인**해도 규칙을 지킬 조합이 없음) · `higher_priority`(성별: 지킬 조합은 있으나 더 높은 우선순위에서 더 나쁨) · `search_limit`(지킬 수 있었는데 60회 탐색이 못 찾음)
- 판정은 저장된 경기 순서로 생성 시점 상태를 재현해 계산(추가 열·마이그레이션 없음). 생성 뒤 참가자가 바뀐 경우(I3-c 교체)는 판정하지 않음.
- 결과: 골든 + 무작위 2,000건에서 **같은 대진 반복은 전부 `exhausted`**(피할 수 있는데 반복한 경우 0건). 판정기는 피할 수 있는 반복을 `search_limit`로 잡는지 별도 테스트로 확인.
- **발견(보고)**: 성별 완화 중 약 3%(무작위 5,555건 중 158건)는 `search_limit` — 기존 TS 알고리즘의 60회 무작위 탐색 한계. FE 알고리즘을 바꾸지 말라는 조건에 따라 그대로 두고 사유로 드러냄. 고치려면 FE·BE 동시 변경(예: 탐색 실패 시 전수 탐색) + 골든 재생성이 필요 — 결정 요청.

### 7.4 U8 오류 계약(FE `CLUB_ERRORS`와 같은 코드, Mock과 같은 판정 순서)
| 순서 | 코드 | 상태 | details |
|---|---|---|---|
| 1 | `unscored_players` | 422 | `{keys: [사람 키]}` |
| 2 | `min_players` | 422 | `{minTotal: 4, minPerTeam: 2 \| null, count, blue \| null, white \| null}` |
- 문구: 개인전 '참가자가 4명 이상이어야 대진을 만들 수 있습니다', 팀전 '청·백 팀마다 2명 이상이어야 대진을 만들 수 있습니다'.

### 7.5 I3-d 연계(FE 전환 시 할 일)
- `generateClub(id)` → `generateClub(id, version)`으로 `{version}` 전송(U9).
- `ClubGame` 타입에 `repeatedMatchup`·`relaxations` 추가, U7 경고 표시(사유별 문구: `exhausted` '인원·경기 수 때문에 같은 대진이 반복됩니다', `search_limit` '다시 생성하면 피할 수 있습니다' 등 — 문구는 04/05 확인 후).
- `min_players` details로 팀별 부족 인원 안내 가능(현재 Mock은 문구만).
- Mock `generateClub`도 같은 `relaxations`를 내려면 판정 함수 TS 이식 필요(선택).

### 7.6 성능(ASM-026)
- 엔진 + 완화 판정: 20명·20경기, 규칙 4조합 × 개인/팀 × 시드 3 — 최악 수십 ms(기준 2초).
- API(SQLite, 저장·응답 포함) 20명·20경기 < 2초 테스트. 무작위 2,000건 최악 0.02초.

### 7.7 I3-c 진입 조건
1. `smapsh`에 0006·0007 적용 여부(사용자 승인 → 백업 → 적용). I3-b는 새 마이그레이션 없음.
2. 확정 후 교체·중도 귀가 뒤 `repeated_matchup`·`gender_relaxed` 재계산 규칙(교체 결과로 반복이 생기면 표시할지) 결정.
3. U2(결과 되돌리기) API 형태: `PUT …/games/{no}/result {winner: null, version}` 허용으로 할지.
4. U10 종료 후 결과 수정 표시: `modified_at`·`changed`를 결과 수정에도 쓸지(현재 C-15는 대진 수정 기준).
5. 성별 `search_limit` 개선 여부(§7.3).

## 8. I3-c 구현 결과(2026-11-12)

### 8.1 API(운영진, 모두 version 검사 409 `conflict`)
| 메서드·경로 | 동작 | 주요 오류 |
|---|---|---|
| `POST …/{id}/confirm` | 확정(회원 공개), `confirmed_at` | 409 `locked`(이미 확정), 409 `no_games` |
| `PUT …/{id}/games/{no}/result {winner: 1\|2\|null}` | 기록·수정·되돌리기(U2). 종료 후 수정 = `changed` + `modifiedAt`(U10) | 409 `locked`(확정 전 / 종료 후 되돌리기), 404 `not_found` |
| `POST …/{id}/finish` | 종료, `finished_at` | 409 `locked`(진행 중 아님), 409 `not_all_recorded {remaining}` |
| `POST …/{id}/games/{no}/swap {from, to}` | 교체: 확정 전 전체, 확정 후 결과 없는 경기만, 종료 후 불가. 확정 후면 `changed` + `modifiedAt` | 409 `locked`, 409 `conflict`(대진이 바뀜), 422 `not_eligible` |
| `POST …/{id}/participants/{key}/leave {assignments}` | 중도 귀가: 제외 + 남은 미기록 경기 대체를 원자적으로 | 409 `locked`, 409 `conflict {games}`, 422 `not_eligible` |

- 응답은 모두 최신 `ClubMatchView`. 경기에 `manual`(직접 교체) 추가.
- 리비전 **0009**: `club_match_games.manual`, `club_match_games.relaxations`(JSON). 사유를 생성·교체 때 저장 → 조회 때 다시 계산하지 않음(비식별화 뒤에도 사유 유지, 조회 비용 없음).

### 8.2 교체 뒤 재계산
- 같은 대진 반복: 모든 경기를 번호 순으로 다시(교체로 생긴 반복·풀린 반복 모두 반영).
- 성별 완화: 교체한 경기만 다시(선수가 바뀐 경기). 위반 사유 `manual`.
- 손대지 않은 경기가 앞선 교체 때문에 반복이 되면 사유 `manual`, 원래 불가피했던 반복은 `exhausted` 유지.

### 8.3 성별 탐색 보강(FE·BE 동시)
- 60회 무작위 탐색 뒤 성별 위반이면 전수 보강(고정 순서, 비용이 더 낮을 때만 교체 → 우선순위 보존, 난수 추가 사용 없음 → 재현성 보존).
- 전후: 무작위 2,000건 성별 `search_limit` **158 → 0**, 골든 **11 → 0**. 성별 규칙을 끈 사례(골든 118개)는 결과 동일, 켠 사례 중 12개 대진 변경(골든 재생성). 같은 대진 반복 수·성별 완화 경기 수는 골든에서 같음(205·499) — 위반을 늘리지 않고 더 나은 후보로 바뀜.
- 성능: BE 20명·20경기 불리한 성별 구성 100건 최악 5.6ms, FE 같은 기준 테스트(2초) 통과.

### 8.4 I3-d 진입 조건
1. FE `api.ts` api 분기: 확정 전 조작·`generateClub`에 version, 응답 형태 그대로 사용.
2. `GameView`·`Person` 타입: `repeatedMatchup`·`relaxations`·`manual`, `gender/grade/score` null.
3. 결과 되돌리기 UI(확인 창) — 04/05 화면 명세에 없는 동작이라 문구·위치 확인 필요(제안서 D-1).
4. `CLUB_ERRORS`에 `no_games`·`not_eligible` 추가, `not_all_recorded` details 활용.
5. Mock `individualStandings` U4 정렬, Mock 결과 되돌리기·종료 후 수정 표시를 서버와 맞춤.
6. 회원 API(`/api/member/club-matches…`, `/api/me/record`)를 점수·실력차·급수·완화 사유 없는 별도 스키마로(AC-066) + 계약 테스트.
7. `BACKEND_READY`에 `clubmatch` 추가와 `ClubMatchPage` 점수 입력을 명단 API로(§2.6).
8. `smapsh`에 0008·0009 적용 승인(전환 전 필요).
