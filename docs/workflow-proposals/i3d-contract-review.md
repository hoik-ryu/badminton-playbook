# I3-d 진입 전 점검 — 정책(P-1~P-9)·FE↔BE 계약·회원 API 보안 설계

- 작성: 2026-11-12 (분석·설계만, 구현 없음)
- 상태: **제안**. 승인 문서·해시·`state.yaml`은 바꾸지 않았습니다.
- **갱신(2026-11-12, I3-d1~d3 구현)**: P-1~P-10·S-1·되돌리기 UI 사용자 확정 후 구현. 확정 내용과 승인 문서 차이는 `i3d-ac-deviations-proposal.md`. 이 문서의 '미결정' 표기는 점검 시점 기록
- 사용자 결정(2026-11-12): P-1·P-3 추천안 동의, P-4는 '수동 교체 중복'과 '불가피한 중복'을 구분하는 방향으로 검토, 나머지는 미결정

## 0. 먼저 알려 드릴 문제(발견)

| ID | 내용 | 근거 | 영향 | 처리 |
|---|---|---|---|---|
| F-1 | **현재 코드(0009 기준) + `smapsh`(0007) 조합에서 게스트 삭제가 500** | 임시 PG를 0007로 내려 재현: `DELETE /api/roster/guests/{id}` → 500 `internal_error`(0007은 `guests.gender NOT NULL`, C안 코드는 성별을 NULL로 씀). 청백전은 경기가 생기면 0009 열(`manual`·`relaxations`)이 없어 실패 | 사용자 개발 환경(API 모드, 8000 `--reload`)의 명단 게스트 삭제 | 미조치(DB 변경 금지). 해소 방법은 §5 |
| F-2 | **P-4 현재 구현이 승인 문서와 충돌** | UXD-009 "같은 경기(같은 4명·같은 팀 구성)가 되는 대상은 고를 수 없게", NFR-003·C-19 "한 청백전 안 0건, 가능한 조합이 모두 소진된 경우만 예외", SCR-225 비활성 사유 | 서버가 수동 교체 중복을 허용(`manual`)하면 API를 직접 부르는 경우 0건 원칙이 깨짐 | §1 P-4 추천안 |
| F-3 | **SCR-226(중도 귀가 대체)에 '규칙을 지키는 후보가 없는 경기' 상태가 없음** | SCR-226 상태 표: ST1·ST3(남은 경기 없음)·ST4·ST6만 | P-4를 '거부'로 바꾸면, 소수 인원에서 대체 후보가 모두 중복이 되는 경기는 중도 귀가 처리 자체가 막힘 | 결정 필요(§1 P-4-b) |
| F-4 | **U10 수정 표시 문구 불일치** | SCR-112-ST7 문구는 '대진이 수정되었습니다(시각)'(C-15 대진 수정 기준). U10으로 종료 후 **결과** 수정에도 `modifiedAt`이 찍힘 | 회원에게 결과 수정이 '대진 수정'으로 보임 | 결정 필요(§1 P-10 신규) |

## 1. P-1~P-9 정책 결정표(원문: `i3c-ac-deviations-proposal.md` §2)

| ID | 원문 상황 | 현재 구현 | 승인 AC·설계와 차이 | 결정이 필요한 이유 | 추천안 | 변경 시 영향 | 상태 |
|---|---|---|---|---|---|---|---|
| P-1 | 종료 후 결과를 미기록으로 되돌리기 | 거부(409 `locked`) | AC-085는 종료 후 '승패를 고칠 수 있다'만 정의, 되돌리기(U2)와 종료 조건(C-20 '미기록 0')의 관계는 미정의 | U2와 C-20이 부딪침 | 현행 유지(거부) | 없음 | **동의(확정)** |
| P-2 | 같은 결과를 다시 보냄 | 변경 없음, version 유지 | 정의 없음(AC-080은 '다른 기록'만) | 두 번 누름·재시도 시 충돌 창이 뜰지 여부 | 현행 유지(멱등) — 서버리스 재시도·느린 응답에서 오탐 충돌 방지 | Mock은 version을 올림 → I3-d에서 Mock도 맞춤 | 미결정 |
| P-3 | 대진 없는 확정 | 409 `no_games` | Mock은 409 `conflict` + '대진이 없습니다'. SCR-223 확정 버튼은 대진이 있어야 보임 | 오류 코드 계약 | 현행 유지(`no_games`) | FE `CLUB_ERRORS`에 추가, Mock도 `no_games` | **동의(확정)** |
| P-4 | 교체로 같은 4명·같은 팀이 됨 | 서버 허용 + `repeatedMatchup` + 사유 `manual` | **충돌(F-2)**: UXD-009·NFR-003·C-19·SCR-225는 '고를 수 없음'(0건, 소진만 예외) | 서버가 최종 규칙을 지켜야 함(NFR-005 '서버가 최종 검사' 원칙과도 관련) | **P-4-a**: 서버도 거부 — 교체 결과가 다른 어떤 경기와 같은 4명·같은 팀이면 409/422 `same_matchup`(FE `candidatesFor`와 같은 판정: 이 경기를 뺀 모든 경기). 생성 시 불가피한 반복은 `exhausted`로 계속 허용 → 반복의 출처가 '생성(소진)'만 남아 구분이 명확. 사유 `manual`은 성별 등 '허용되는 위반'(UXD-009)에만 남음. **P-4-b(결정 필요, F-3)**: 중도 귀가에서 어떤 경기의 모든 후보가 중복이 될 때 — (1) 거부하고 운영진이 다른 경기와 함께 조정, (2) 그 경우만 허용하고 사유 `exhausted_manual` 같은 별도 표시 | 서버: swap·leave 검사 추가, 테스트 3개 수정(`test_swap_recomputes_repeated_matchup_and_reasons`, `test_swap_makes_later_untouched_game_repeat` → 거부 검증으로). `refresh_after_swap`의 matchup `manual` 분기는 P-4-b가 (2)일 때만 남음. 제안서 D-4 문구 수정 | **방향 확정, 세부(P-4-b) 미결정** |
| P-5 | 교체·대체로 들어갈 사람 | 참가자·미제외·승인 회원·삭제 안 된 게스트·팀전 같은 팀(422 `not_eligible`) | SCR-225 후보 = 참가자(팀전 같은 팀). 비활성·삭제 게스트는 U6의 '새 참가자 선택 제외'를 교체에도 적용한 해석 | U6 범위가 '새 참가'만인지 '교체 대상'까지인지 | 현행(교체 대상에도 적용) | FE `candidatesFor`도 같은 조건으로(현재 Mock rows에 비활성·삭제가 없어 차이가 드러나지 않음) | 미결정 |
| P-6 | 이미 제외된 사람을 다시 제외 | 409 `conflict` | 정의 없음 | 409 `conflict`이면 FE가 '다른 운영진이 변경' 창을 띄움(실제로도 다른 운영진이 먼저 처리한 경우가 대부분) | 현행 | 없음 | 미결정 |
| P-7 | 중도 귀가 대체 목록 | 남은 미기록 경기와 정확히 일치해야 함, 하나라도 잘못되면 전체 거부(원자적) | AC-078·SCR-226 '모든 남은 경기의 교체를 한 번에 저장'과 일치 | 부분 저장 허용 여부 | 현행 | 없음 | 미결정 |
| P-8 | 진행 중(확정·미종료) 결과 수정 | 수정 표시 안 함 | C-15(대진 수정만 표시)·U10(종료 후만)과 일치 | 진행 중 결과 수정도 회원에게 알릴지 | 현행 | 표시하면 `changed` 의미가 '결과 수정'까지 넓어짐(F-4와 연결) | 미결정 |
| P-9 | 0009 이전에 만든 경기의 완화 사유 | 빈 목록(플래그만) | 해당 없음(새 열) | `smapsh`에 경기 0건이라 실제 영향 없음 | 백필 없음(현행) | `smapsh`에 0009 적용 전 경기가 생기면 그 경기만 사유 없이 배지만 보임 | 미결정 |
| P-10 (신규, F-4) | 종료 후 결과 수정의 회원 표시 문구 | `modifiedAt`·`changed` 공용 | SCR-112-ST7 문구는 '대진이 수정되었습니다' | U10 결정과 기존 문구가 다름 | (a) '기록이 수정되었습니다(시각)'처럼 문구를 분리하려면 `resultModifiedAt`을 따로 두거나, (b) 문구를 '대진·결과가 수정되었습니다'로 통일 | (a) BE 필드 1개(+마이그레이션 없이 계산 불가 → 열 추가 필요), (b) 문구만 | 미결정 |

## 2. I3-d FE↔BE 계약 차이(현재 Mock vs 실제 API)

### 2.1 운영진(SCR-221–226)
| 영역 | 현재 Mock / 화면 | 실제 API(I3-a~c) | I3-d 할 일 |
|---|---|---|---|
| 확정 전 조작 version | `setSettings`·`setParticipating`·`setTeam`·`applyTeamProposal`·`generateClub`이 **version을 보내지 않음** | 모든 변경에 `version` 필수(없으면 422, 다르면 409 `conflict` + `details.version`) | 함수 시그니처에 `version` 추가, `ParticipantsPanel`·`ClubMatchPage` 호출부 수정 |
| 변경 응답 | 화면은 응답을 버리고 `refresh()`로 다시 GET | 모든 변경이 최신 `ClubMatchView` 반환 | 응답으로 바로 갱신(왕복 1회 절약, 서버리스 지연에 유리). `refresh()`는 충돌 때만 |
| 확정 | 대진 없음 → 409 `conflict` | 409 `no_games`, 이미 확정 409 `locked` | `CLUB_ERRORS.noGames` 추가, Mock 맞춤(P-3) |
| 결과 기록 | `winner: 1 | 2`만, 같은 값도 version 증가 | `winner: 1 | 2 | null`(U2), 같은 값은 무변경(P-2), 종료 후 되돌리기 409 `locked`(P-1) | 되돌리기 UI(확인 창) — **화면 명세에 없음**, 위치·문구 결정 필요. Mock에 null 지원 |
| 종료 후 수정 | Mock은 `changed`·`modifiedAt`을 안 바꿈 | `changed = true` + `modifiedAt`(U10) | Mock 맞춤, 회원 문구(P-10) |
| 종료 | 409 `not_all_recorded` | 같음 + `details.remaining` | 안내에 남은 수 사용 가능 |
| 교체 | 서버 검사 없음(시트가 비활성 처리), `manual`·재계산 없음 | `not_eligible`(P-5), 결과 있음 409 `locked`, 대진 바뀜 409 `conflict`, 교체 뒤 반복·성별 재계산, `manual` | P-4 확정 후 `same_matchup` 처리, `candidatesFor`에 P-5 조건 |
| 중도 귀가 | 이미 제외·자기 자신 대체 검사 없음 | 409 `conflict`(+`details.games`), 422 `not_eligible` | 충돌 시 `details.games`로 남은 경기 다시 표시(SCR-226-ST6) |
| 대진 생성 | 같은 엔진(골든 일치), 응답에 완화 사유 없음 | `relaxations[{rule, reason}]`·`repeatedMatchup`·`manual` | `GameView` 타입 추가, 경고 문구(사유별) — UXD-007 완화 배지 방식, 문구는 04/05 확인 |
| 점수 미설정·인원 | 422 `unscored_players`·`min_players`(문구만) | 같은 코드 + `details` | 그대로 호환 |
| 참가 자격 | 없음 | 422 `not_eligible`(비활성·삭제) | 코드 추가 |
| 사람 필드 | `Person.gender: Gender`, `grade: Grade`, 삭제된 게스트는 **가짜 값**(`'남'`·`'입문자'`) | 삭제된 게스트 `gender·grade·score = null`(C안) | 타입 `| null`, `ParticipantsPanel`의 `r.gender` 표시·낭독 문구 null 처리 |
| 참가자 행 | 승인 회원 + 현재 게스트만 | + 이미 참가한 비활성 회원·삭제된 게스트(기록 보존) | 그런 행은 체크 해제·교체 대상에서 제외 표시 |
| 순위 | 키 순 정렬 | U4(승률 → 이름), 공동 순위 U3 | Mock `individualStandings` U4로 |
| 목록 | `winnerText` 같음(동률 이름 순서만 다를 수 있음) | U4 순서 | Mock 맞춤 |
| 점수 입력 시트 | `setMockScore`(Mock 사람) | 명단 API `setScore`(I1) | `ClubMatchPage`에서 `setScore`로 |

### 2.2 회원(SCR-111·112·121)·마이페이지
| 영역 | 현재 Mock | 실제 API | I3-d 할 일 |
|---|---|---|---|
| 목록·상세 | `memberApi.ts` Mock(계약 형태는 있음) | **없음** | §3대로 신규 |
| 내 전적 | `getMyRecord` Mock | `/api/me/record` **없음** | 신규(본인만, 랭크 문자 포함) |
| 명단 회원 현황(운영진) | Mock 값 | I1 `/api/roster/members/{id}/status`가 `rank: null`, `record: 0` 자리표시자 | 청백전 결과로 계산 |

### 2.3 로딩·오류·충돌 공통
- 409 `conflict`: 기존 충돌 창(SCR-223-ST6 등) 그대로, 닫으면 다시 GET.
- 409 `locked`·`no_games`·`not_all_recorded`, 422 `not_eligible`·`unscored_players`·`min_players`: 안내 상자(`message` 사용).
- 404 `not_found`(운영진), 404 `club_match_not_found`(회원, 미확정 포함).
- 네트워크(`status 0`): 기존 `act()` 실패 문구.
- 서버리스 지연 대비: 버튼 `busy` 동안 재입력 막기(청백전 만들기 중복 M3).

## 3. 회원 API 보안 설계

### 3.1 원칙
- **별도 라우터·별도 Pydantic 스키마**. 운영진 `ClubMatchView`를 만든 뒤 필드를 지우는 방식 금지(필드가 늘면 새어 나감). 회원 응답은 DB에서 필요한 값만 읽어 **허용 목록(allowlist) 스키마**로 직접 만든다.
- 권한: `approved_user`(회원·운영진·슈퍼 관리자 모두 같은 응답). 승인 대기·거절·비활성은 403.
- 미확정(draft)과 없는 청백전은 **같은 404**(`club_match_not_found`, 같은 본문) — 존재 여부를 드러내지 않음(AC-069).
- '나' 판정은 서버가 세션으로(`me`, `mySide`, `participating`).

### 3.2 엔드포인트·스키마(허용 필드만)
| 경로 | 응답 스키마 | 필드 |
|---|---|---|
| `GET /api/member/club-matches` | `PublicClubMatchItem[]` | `id, name, date, method, status(confirmed\|finished), team{blue,white}\|null, games, participants, unrecorded, resultText` |
| `GET /api/member/club-matches/{id}` | `PublicClubMatch` | `id, name, date, method, status, modifiedAt, games[MemberGame], standings[MemberStanding], team, unrecorded, participating` |
| (중첩) `MemberGame` | | `no, team1[MemberPlayer], team2[MemberPlayer], winner, changed, mySide` |
| (중첩) `MemberPlayer` | | `key, name, guest, me` |
| (중첩) `MemberStanding` | | `key, name, guest, me, wins, games, rank(순위 숫자), tied` |
| `GET /api/me/record` | `MyRecord` | `rank(S/A/B/C\|null, 본인만), gamesToRank, games, wins, losses, rate` |

**넣지 않는 것**: 1–10 점수, 급수, 성별, 실력차(`gap`), 팀 점수 합, 완화 사유·`genderRelaxed`·`repeatedMatchup`·`manual`, `version`, 규칙(`rules`), `seed`, `totalGames`·설정, 미리보기·균등안, `rows`(참가자 전체 목록·점수 미설정 목록), 지인·튜토리얼, 다른 회원의 랭크, 작성자·기록자 id·시각(`modifiedAt` 제외).

### 3.3 설계 확인 요청(결정 필요)
- **사람 키**: Mock은 `member:<사용자 UUID>`·`guest:<게스트 UUID>`를 그대로 씀 → 회원이 다른 회원·게스트의 내부 id를 알게 되고, 삭제된 게스트도 청백전 사이에서 같은 사람으로 이어 볼 수 있음. 추천: **청백전 참가자 행 id(`p:<participant id>`)** 같은 청백전마다 다른 키로 바꿔 내보냄(화면은 키를 React key·'나' 표시에만 쓰므로 영향 없음). → 결정 필요(S-1).

### 3.4 계약 테스트(릴리스 기준 3, AC-066·068·069)
1. 응답 JSON의 모든 키(중첩 포함) ⊆ 허용 목록.
2. 금지 키 이름(`score`, `grade`, `gender`, `gap`, `relaxations`, `genderRelaxed`, `repeatedMatchup`, `manual`, `version`, `rules`, `seed`, `referrer`, `tutorial*`)이 어디에도 없음 — OpenAPI의 회원 경로 응답 스키마까지 검사.
3. draft·없는 id → 같은 상태·같은 본문.
4. 다른 회원 행에 랭크 문자 없음, `/api/me/record`는 본인 것만.
5. 운영진 경로는 회원에게 403(기존 테스트 유지).
6. 삭제된 게스트·비활성 회원 표시(이름만 '삭제된 게스트' / 회원 이름).

## 4. I3-d 구현 배치 계획(제안)

| 배치 | 내용 | 선행 조건 | 검증 |
|---|---|---|---|
| I3-d1 BE 정책 반영 | P-4-a(`same_matchup` 거부)·P-4-b·P-10 결정분, 테스트 수정 | P-4-b·P-10 결정 | `make check`, 임시 PG |
| I3-d2 BE 회원·전적 | §3 회원 API·`/api/me/record`·명단 회원 현황 rank/record 계산(확정·종료 청백전의 기록된 경기, 게스트 제외, 대체 선수는 실제로 뛴 사람) | S-1 결정 | 계약 테스트 §3.4, 랭크 경계값(9·10경기, 70·55·40%) |
| I3-d3 FE 계약 맞춤(Mock 유지) | 타입(nullable·새 필드), version 전달, 응답 사용, 새 오류 코드, 되돌리기 UI, Mock을 서버 동작(P-1~P-3·U2·U4·U10·C안)에 맞춤 | 되돌리기 UI 문구·위치 결정 | FE 테스트, Mock B4·B5 회귀(390·1440) |
| I3-d4 전환 | `BACKEND_READY`에 `clubmatch`, 점수 입력 `setScore`, API 모드 브라우저 검증(운영진 2명 동시 충돌, 회원 화면 필드 확인) | **`smapsh`에 0008·0009 적용 승인**(§5) | API 모드 브라우저, Mock 회귀, 임시 PG |

## 5. 개발 DB(`smapsh`) 마이그레이션 전제 조건

현재: 0007 유지(읽기 전용 점검 — 회원 2, 게스트 0, 청백전 0, 제약·고아 행 이상 없음).

1. **F-1 해소 시점 결정**: 지금처럼 0007이면 API 모드 게스트 삭제가 500. 선택지 — (a) 0008·0009 적용(아래 절차), (b) I3-d4 전까지 API 모드에서 게스트 삭제를 쓰지 않음(안내만).
2. 적용 절차(승인 후): 백엔드 서버(8000) 잠시 중지 → `pg_dump -Fc`를 **저장소 밖 영구 위치**에 → `pg_restore --list`로 덤프 확인 → `alembic upgrade head`(0008·0009) → `alembic current`·`alembic check`·행 수 비교 → 서버 재시작 → 게스트 추가·삭제 1회 확인.
3. 0008은 삭제된 게스트의 성별·점수를 지움(되돌릴 수 없음). 현재 삭제된 게스트 0건이라 실제로 지워지는 값 없음.
4. 되돌리기: `alembic downgrade 0007`(0008 downgrade는 성별 자리표시자로 채움) 또는 덤프 복원.
