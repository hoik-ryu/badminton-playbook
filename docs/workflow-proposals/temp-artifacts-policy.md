# 임시 산출물 관리 정책

- 작성: 2026-11-20(저장소 1차 정리 뒤 예방 조치)
- 범위: 사람·Claude·AI Product Workflow가 개발·검증 중에 만드는 파일. 자동 삭제는 아직 없음(아래 "정리 절차"는 사람이 실행)

## 1. 세 가지 분류

| 분류 | 예 | 위치 | Git |
|---|---|---|---|
| 제품 자산 | 서비스 화면이 실제로 불러오는 이미지·아이콘·JSON(`frontend/public/`, `backend/app/modules/*/content/` 등) | 제품 코드 경로 | 보관 |
| 승인 필수 산출물 | 승인 해시와 연결된 기준본: `docs/design/*`, `design-preview/`(디렉터리 전체 해시), 선택된 탐색 라운드(`design-explore/V05/`), `tools/pd-measure/`, `.ai-workflow/` 상태 파일, 그리고 승인 문서·해시 대상 파일이 **경로로 직접 인용**한 검토 근거 | 현재 경로 그대로(옮기지 않음) | 보관 |
| 임시 산출물 | 디자인 중간 시안·비교 이미지, 중간 렌더, 테스트·디버깅 캡처, E2E 로그, 일회성 측정 JSON, 목업 빌드 | 아래 2절 | 제외 |

워크플로가 이미 관리하는 임시 경로는 그대로 둡니다(바꾸지 않음): `design-explore/*/shots/`·`compare/`(`design-explore/.gitignore`), `.ai-workflow/build/evidence/`·`runs/`(`.ai-workflow/build/.gitignore`). `.ai-workflow/build/ui/`는 빌드 계약 파일이라 추적합니다.

## 2. 임시 산출물 기본 생성 위치

1. **기본: 저장소 밖** `~/smapsh-work/<YYYY-MM-DD>-<작업>/` (예: `~/smapsh-work/2026-11-21-clubmatch-e2e/`)
2. 저장소 안에 있어야 실행되는 도구만: 저장소 루트 `.tmp/<작업>/` (`.gitignore`로 제외)
3. Playwright 기본 출력(`playwright-report/`, `test-results/`, `blob-report/`, `**/playwright/.cache/`, `.pw-browsers/`, `*.har`, `trace.zip`)은 어느 위치에 생겨도 제외

작업 중에는 자유롭게 쓰고, 검증 보고에는 파일 경로와 요약만 적습니다. 승인 문서에 근거로 남겨야 하는 자료는 3절을 따릅니다.

## 3. 임시 → 보관으로 바꿀 때

- 승인 문서(06·07 등)나 해시 대상 파일이 근거로 인용해야 하는 자료만 저장소로 옮깁니다(`design-explore/review/<라운드>/` 등). 옮길 때 인용할 파일만 고르고, 같은 내용의 사본은 넣지 않습니다.
- `.gitignore`에 걸리는 경로에 둬야 하면 그 파일만 `git add -f`로 추가하고, 인용하는 문서에 경로를 적습니다.

## 4. 정리 절차(나중에 사람이 실행, 자동 삭제 없음)

1. 임시 산출물은 작업이 끝나면 **삭제 후보**입니다.
2. 오류 재현에 필요한 자료는 삭제하지 말고 저장소 밖 보관 폴더(예: `~/smapsh-archive/<날짜>/`)에 원래 경로 구조로 옮기고, 목록(`MANIFEST.tsv`: 경로·sha256·크기)을 남깁니다.
3. **승인된 자료는 자동 삭제 금지.** 1절의 승인 필수 산출물과, 승인 문서·해시 대상 파일·선택 라운드 문서가 인용하는 경로는 정리 대상에서 뺍니다.
4. 삭제 전 필수 확인
   - 참조: `git grep`으로 승인 문서·`.ai-workflow/`·라운드 문서·코드에서 그 경로를 가리키는지
   - 해시: 보관본을 만들었다면 원본과 sha256이 같은지, 같은 내용의 KEEP 사본을 근거로 지운다면 그 사본과 sha256이 같은지
   - 승인 상태: 정리 전후 `/product-design status`·`explore-status` 출력과 승인 해시 재계산 결과가 같은지
   - `make check` 통과
5. Git에서 빼는 것은 경로를 하나씩 지정해서 합니다(와일드카드 일괄 삭제, 스테이징 전체 초기화 금지).

참고: 2026-11-20 1차 정리 기록은 `~/smapsh-archive/2026-11-20/README.md`(저장소 밖)에 있습니다.
