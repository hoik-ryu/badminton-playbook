# C안 Preview 인계 자료 (Figma 스크립트 dry-run 추출)

- 생성: 2026-11-10. **Figma를 호출하지 않고** Figma 생성 스크립트(`../figma-scripts/`)를 모의 Figma API(`../figma-scripts/dryrun/`)에서 실행해 화면 트리를 기록했습니다.
- 대상: 계획 56개 프레임 전부(Figma에 실제로 있는 14개 + 미생성 42개). 29개 화면이 모두 들어 있습니다.
- 용도: React(Code-first) Preview를 만들 때 화면 구조, 컴포넌트 계층, 토큰 참조, 상태, SCR/ST 추적의 입력으로 씁니다. **승인 자료가 아닙니다**(C안 실험).

## 신뢰도
- 모의 환경에서 `c1`–`c3`, `s1`이 만든 수(컴포넌트 43 / 13 / 7, 프레임 14)가 실제 Figma 실행 결과와 같았습니다. 그래서 같은 스크립트의 나머지 42개 프레임 트리도 구조는 믿을 만합니다.
- 모의 환경이 확인하지 **않는** 것: 자동 레이아웃 크기 계산, 글자 넘침, 렌더링, 실제 Figma API의 값 검증. 크기·넘침·시각 품질은 미확인입니다.
- 남은 42개 스크립트는 모의 실행에서 오류가 없었습니다. 실제 Figma에서 실패하지 않는다는 보장은 아니지만, 이름·속성·변형 조합 오류(이번 작업에서 가장 흔했던 실패)는 미리 걸러졌습니다.

## `C-screens.dryrun.json` 형식
```
{ log: [파트별 실행 결과],
  library: [{ name, type, variants[], props[], tokens[], uses[] }],   // C 컴포넌트 28개
  screens: [{ frame, group, scr[], st, stateLabel, platform, size[w,h],
              components{이름: 인스턴스 수}, icons[], tokens[],          // 화면 전체 토큰 참조(컴포넌트 내부 포함)
              tree: [노드] }] }
노드: 프레임  { t, n(이름), layout, tok[], k[자식] }
      글자    { t:"text", text, style(텍스트 스타일), tok[] }
      인스턴스 { c(컴포넌트), v(변형 "kind=score"), as(별칭), p{글자 속성}, k[중첩 인스턴스·{icon}] }
```
- React 대응: `c` → 컴포넌트, `v` → props(variant), `p` → children·label, `tok` → CSS 변수(`color/text/primary` → `--color-text-primary`, `exp/theme-C/action/primary` → 테마 `--color-action-primary`)
- SCR/ST 추적: `scr`·`st`를 Preview 경로(`#SCR-211/SCR-211-ST1/mobile`)와 manifest에 그대로 씁니다.

## 집계
- 화면 29/29개, 프레임 56개(모바일 53, PC 3)
- 컴포넌트 27/28개 사용(토스트 CMP-029는 쓰이지 않음)
  - 인스턴스가 많은 순서: ChoiceCell 144, Button 103, Badge 73, PageHeader 49, PersonRow 38
- 토큰 29종
  - C 테마 7종: `action/primary`, `action/accent`, `header/bg`, `header/fg`, `nav/active`, `selected/bg`, `selected/fg`
  - 승인 색 19종, 반경 3종
- 명세 문구 공백 자리 표시 19곳(`[…]`)

## 프레임 색인
| # | 프레임 | SCR | ST | 플랫폼 | Figma | 주요 컴포넌트(인스턴스 수) | C 테마 토큰 |
|---|---|---|---|---|---|---|---|
| 1 | SCR-001 로그인 | SCR-001 | ST1 기본 | mobile | `20:357` | SheetFooter×1, Button×1 | action/primary |
| 2 | SCR-001 로그인 | SCR-001 | ST4 오류 | mobile | `20:372` | Button×2, NoticeBox×1, SheetFooter×1 | action/primary |
| 3 | SCR-002 가입 정보 입력 | SCR-002 | ST1 기본 | mobile | `20:405` | ChoiceCell×8, TextField×2, PageHeader×1, SegmentedControl×1, SheetFooter×1 | action/primary, header/bg, header/fg |
| 4 | SCR-003 계정 상태 안내 | SCR-003 | ST1 기본(승인 대기) | mobile | `20:466` | Button×2 | action/accent, action/primary |
| 5 | SCR-003 계정 상태 안내 | SCR-003 | ST7 거절 | mobile | `20:481` | Button×2 | action/accent, action/primary |
| 6 | SCR-003 계정 상태 안내 | SCR-003 | ST8 비활성 | mobile | `20:496` | Button×2 | action/accent, action/primary |
| 7 | SCR-004 권한 없음 | SCR-004 | ST1 기본 | mobile | `20:510` | StateView×1, Button×1 | action/primary |
| 8 | SCR-005 페이지 없음 | SCR-005 | ST1 기본 | mobile | `20:536` | StateView×1, Button×1 | action/primary |
| 9 | SCR-101 튜토리얼 홈 | SCR-101 | ST1 기본 | mobile | `20:561` | StageCard×6, Badge×2, PageHeader×1, NoticeBox×1, AppNav×1 | header/bg, header/fg, nav/active, selected/bg |
| 10 | SCR-102 스테이지 플레이 | SCR-102 | ST1 기본 | mobile | `20:676` | Button×4, PageHeader×1, TutorialCourt×1 | action/primary, header/bg, header/fg |
| 11 | SCR-102 스테이지 플레이 | SCR-102 | ST7 정답 | mobile | `20:719` | PageHeader×1, TutorialCourt×1, NoticeBox×1, Button×1 | action/primary, header/bg, header/fg |
| 12 | SCR-102 스테이지 플레이 | SCR-102 | ST9 오답 | mobile | `20:761` | Button×3, PageHeader×1, TutorialCourt×1, NoticeBox×1 | action/primary, header/bg, header/fg |
| 13 | SCR-103 스테이지 결과 | SCR-103 | ST1 기본(통과) | mobile | `20:809` | Button×3, PageHeader×1, Badge×1, ListItem×1 | action/primary, header/bg, header/fg |
| 14 | SCR-103 스테이지 결과 | SCR-103 | ST7 미통과 | mobile | `20:857` | ListItem×3, Button×2, PageHeader×1, Badge×1 | action/primary, header/bg, header/fg |
| 15 | SCR-111 청백전 목록(회원) | SCR-111 | ST1 기본 | mobile | 미생성 | Badge×6, ClubMatchListItem×3, PageHeader×1, AppNav×1 | header/bg, header/fg, nav/active, selected/bg |
| 16 | SCR-111 청백전 목록(회원) | SCR-111 | ST3 빈 상태 | mobile | 미생성 | Badge×2, PageHeader×1, StateView×1, Button×1, ClubMatchListItem×1 | action/primary, header/bg, header/fg, nav/active, selected/bg |
| 17 | SCR-112 청백전 상세(회원) | SCR-112 | ST1 기본(진행 중) | mobile | 미생성 | Badge×9, GameCard×2, PageHeader×1, StandingsCard×1, AppNav×1 | header/bg, header/fg, nav/active, selected/bg, selected/fg |
| 18 | SCR-112 청백전 상세(회원) | SCR-112 | ST8 종료 | mobile | 미생성 | Badge×7, PageHeader×1, StandingsCard×1, GameCard×1, AppNav×1 | header/bg, header/fg, nav/active, selected/bg |
| 19 | SCR-121 마이페이지 | SCR-121 | ST1 기본 | mobile | 미생성 | Button×2, PageHeader×1, RecordSummary×1, ListItem×1, AppNav×1 | action/primary, header/bg, header/fg, nav/active, selected/bg |
| 20 | SCR-121 마이페이지 | SCR-121 | ST7 랭크 없음 | mobile | 미생성 | Button×2, PageHeader×1, RecordSummary×1, ListItem×1, AppNav×1 | action/primary, header/bg, header/fg, nav/active, selected/bg |
| 21 | SCR-122 프로필 수정 | SCR-122 | ST1 기본 | mobile | 미생성 | ChoiceCell×8, PageHeader×1, SheetHeader×1, TextField×1, SegmentedControl×1 | action/accent, action/primary, header/bg, header/fg, selected/bg, selected/fg |
| 22 | SCR-201 운영 홈 | SCR-201 | ST1 기본 | mobile | 미생성 | ListItem×5, Badge×2, PageHeader×1, AppNav×1 | action/primary, header/bg, header/fg, nav/active, selected/bg |
| 23 | SCR-202 오늘 운동 | SCR-202 | ST1 기본(생성 전) | mobile | 미생성 | Button×3, PageHeader×1 | action/primary, header/bg, header/fg |
| 24 | SCR-202 오늘 운동 | SCR-202 | ST3 빈 상태 | mobile | 미생성 | PageHeader×1, StateView×1, Button×1 | action/primary, header/bg, header/fg |
| 25 | SCR-202 오늘 운동 | SCR-202 | ST7 대진 검토 | mobile | 미생성 | Button×4, GameCard×4, PageHeader×1, NoticeBox×1 | action/primary, header/bg, header/fg |
| 26 | SCR-202 오늘 운동 | SCR-202 | ST8 라운드 진행 중 | mobile | 미생성 | Button×11, GameCard×4, PageHeader×1 | action/primary, header/bg, header/fg |
| 27 | SCR-202 오늘 운동 | SCR-202 | ST6 충돌 | mobile | 미생성 | Button×5, GameCard×4, PageHeader×1, NoticeBox×1, ConfirmDialog×1 | action/primary, header/bg, header/fg |
| 28 | SCR-202 오늘 운동 | SCR-202 | ST10 이전 날짜 미종료 세션 | mobile | 미생성 | Button×5, PageHeader×1, NoticeBox×1 | action/primary, header/bg, header/fg |
| 29 | SCR-203 참석 체크 | SCR-203 | ST1 기본 | mobile | 미생성 | PersonRow×7, Checkbox×6, PageHeader×1, SheetHeader×1, StickySummary×1 | action/primary, header/bg, header/fg |
| 30 | SCR-204 대진 옵션 | SCR-204 | ST1 기본 | mobile | 미생성 | Switch×4, PageHeader×1, SheetHeader×1, SegmentedControl×1 | action/accent, header/bg, header/fg, selected/bg, selected/fg |
| 31 | SCR-205 선수 교체(실시간 대진) | SCR-205 | ST1 기본 | mobile | 미생성 | CandidateRow×4, Badge×2, PageHeader×1, SheetHeader×1 | action/primary, header/bg, header/fg |
| 32 | SCR-211 명단 | SCR-211 | ST1 기본 | mobile | 미생성 | PersonRow×14, Badge×3, FilterChip×2, PageHeader×1, PageHeader SearchBand×1 | action/primary, header/bg, header/fg, nav/active, selected/bg |
| 33 | SCR-211 명단 | SCR-211 | ST3 빈 상태 | mobile | 미생성 | PageHeader×1, PageHeader SearchBand×1, TextField×1, StateView×1, Button×1 | action/primary, header/bg, header/fg, nav/active, selected/bg |
| 34 | SCR-211 명단 | SCR-211 | ST4 오류 | mobile | 미생성 | PageHeader×1, PageHeader SearchBand×1, TextField×1, StateView×1, Button×1 | action/primary, header/bg, header/fg, nav/active, selected/bg |
| 35 | SCR-212 회원·게스트 편집 | SCR-212 | ST1 기본(회원) | mobile | 미생성 | ChoiceCell×18, PageHeader×1, SheetHeader×1, TextField×1, SegmentedControl×1 | action/accent, action/primary, header/bg, header/fg, selected/bg, selected/fg |
| 36 | SCR-212 회원·게스트 편집 | SCR-212 | ST7 게스트 | mobile | 미생성 | ChoiceCell×18, PageHeader×1, SheetHeader×1, TextField×1, SegmentedControl×1 | action/accent, action/primary, header/bg, header/fg, selected/bg, selected/fg |
| 37 | SCR-212 회원·게스트 편집 | SCR-212 | ST10 게스트 삭제: 확정 전 대진 포함 | mobile | 미생성 | ChoiceCell×18, Button×3, PageHeader×1, SheetHeader×1, TextField×1 | action/accent, action/primary, header/bg, header/fg, selected/bg, selected/fg |
| 38 | SCR-213 사람 추가 | SCR-213 | ST1 기본(게스트 추가) | mobile | 미생성 | ChoiceCell×18, PageHeader×1, SheetHeader×1, TextField×1, SegmentedControl×1 | action/primary, header/bg, header/fg |
| 39 | SCR-213 사람 추가 | SCR-213 | ST7 회원 직접 추가 | mobile | 미생성 | ChoiceCell×18, TextField×2, PageHeader×1, SheetHeader×1, NoticeBox×1 | action/primary, header/bg, header/fg |
| 40 | SCR-214 점수 입력 | SCR-214 | ST1 기본 | mobile | 미생성 | ChoiceCell×20, PersonRow×2, PageHeader×1, SheetHeader×1 | header/bg, header/fg |
| 41 | SCR-221 청백전 관리 목록 | SCR-221 | ST1 기본 | mobile | 미생성 | Badge×6, ClubMatchListItem×3, PageHeader×1 | action/primary, header/bg, header/fg |
| 42 | SCR-222 청백전 만들기 | SCR-222 | ST1 기본 | mobile | 미생성 | TextField×2, PageHeader×1, SheetHeader×1, SegmentedControl×1, SheetFooter×1 | action/accent, action/primary, header/bg, header/fg, selected/bg, selected/fg |
| 43 | SCR-223 청백전 운영 상세 | SCR-223 | ST1 기본(생성 전) | mobile | 미생성 | FilterChip×3, Badge×2, Button×2, Switch×2, PageHeader×1 | action/accent, action/primary, header/bg, header/fg, selected/bg, selected/fg |
| 44 | SCR-223 청백전 운영 상세 | SCR-223 | ST7 대진 검토 | mobile | 미생성 | Badge×8, Button×3, GameCard×3, PageHeader×1 | action/primary, header/bg, header/fg |
| 45 | SCR-223 청백전 운영 상세 | SCR-223 | ST9 종료 | mobile | 미생성 | Badge×13, GameCard×3, PageHeader×1, StandingsCard×1 | header/bg, header/fg, selected/bg |
| 46 | SCR-224 참가자·팀 구성 | SCR-224 | ST1 기본(개인전) | mobile | 미생성 | PersonRow×7, Checkbox×6, PageHeader×1, SheetHeader×1, StickySummary×1 | header/bg, header/fg |
| 47 | SCR-224 참가자·팀 구성 | SCR-224 | ST7 팀전 | mobile | 미생성 | SegmentedControl×5, PageHeader×1, SheetHeader×1, StickySummary×1, NoticeBox×1 | action/accent, header/bg, header/fg, selected/bg, selected/fg |
| 48 | SCR-225 선수 교체(청백전) | SCR-225 | ST1 기본 | mobile | 미생성 | CandidateRow×3, Badge×2, PageHeader×1, SheetHeader×1, NoticeBox×1 | action/primary, header/bg, header/fg |
| 49 | SCR-225 선수 교체(청백전) | SCR-225 | ST6 충돌 | mobile | 미생성 | CandidateRow×3, Badge×2, PageHeader×1, SheetHeader×1, NoticeBox×1 | action/primary, header/bg, header/fg |
| 50 | SCR-226 대체 선수 지정 | SCR-226 | ST1 기본 | mobile | 미생성 | Button×3, PageHeader×1, SheetHeader×1, SheetFooter×1 | action/primary, header/bg, header/fg |
| 51 | SCR-231 가입 승인 | SCR-231 | ST1 기본 | mobile | 미생성 | Button×7, Checkbox×4, PageHeader×1, NoticeBox×1 | action/primary, header/bg, header/fg |
| 52 | SCR-231 가입 승인 | SCR-231 | ST3 빈 상태 | mobile | 미생성 | PageHeader×1, StateView×1, Button×1 | action/primary, header/bg, header/fg |
| 53 | SCR-232 역할 관리 | SCR-232 | ST1 기본 | mobile | 미생성 | Button×5, Badge×3, PersonRow×2, PageHeader×1, PageHeader SearchBand×1 | action/primary, header/bg, header/fg |
| 54 | SCR-201 운영 홈 | SCR-201 | ST1 기본 | desktop | 미생성 | ListItem×5, Badge×2, AppNav side×1, PageHeader×1 | action/primary, header/bg, header/fg, selected/bg, selected/fg |
| 55 | SCR-202 오늘 운동 | SCR-202 | ST8 라운드 진행 중 | desktop | 미생성 | Button×9, PersonRow×6, Checkbox×6, GameCard×4, AppNav side×1 | action/accent, action/primary, header/bg, header/fg, selected/bg, selected/fg |
| 56 | SCR-211 명단 + SCR-212 편집 패널 | SCR-211 | ST1 기본 | desktop | 미생성 | ChoiceCell×18, TextField×2, FilterChip×2, AppNav side×1, PageHeader×1 | action/accent, action/primary, header/bg, header/fg, selected/bg, selected/fg |
