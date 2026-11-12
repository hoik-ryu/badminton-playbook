# B6 튜토리얼 — 중단 지점과 재개 메모 (2026-11-11 퇴근 시점)

> **2026-11-12 재개·완료**: 남은 일 1–4 처리. `check-b6` 실패 원인은 결과 화면 정답 다시 보기의 무한 재생 결함(타임라인을 렌더마다 새로 만듦) — 수정 후 통과. B1–B5 브라우저 회귀·API 모드 회귀 통과. 문서는 deviations F44–F51, `b6-policy-open-items.md`. 이 메모는 기록용으로 남김

## 상태 요약
- SCR-101·102·103 구현 완료, `make check` 통과(BE 82, FE 135 — B6 테스트 28개 포함), 스테이징 0
- 브라우저 확인(Mock 5175, 390·1440) 1차 통과, 오답·정답 보기 경로 브라우저 재확인은 미완료(아래 '남은 일' 1)

## 만든 것
- 엔진(렌더링과 분리, NFR-009): `frontend/src/features/tutorial/engine/` — `types.ts`, `logic.ts`(판정·첫 시도만 1점·70% 통과·멱등 저장 병합), `animation.ts`(타임라인 → 위치)
- 시나리오: `frontend/src/features/tutorial/content/stages.ts` — **검수 전 초안(개발용)** 입문자·왕초보 3스테이지 × 5상황 = 30상황. 승인 문서에 본문이 없어 임시 작성(C-22, ASM-023). 운영진·코치 검수 필요
- 진행 저장(Mock, api 모드에서도 Mock): `frontend/src/features/tutorial/api.ts` — 회원 × 스테이지 3항목만, 운영진 명단 현황(`roster/api.ts` getMemberStatus)이 같은 기록을 읽음
- 화면: `pages/TutorialHomePage.tsx`(재작성), `pages/StagePlayPage.tsx`, `pages/StageResultPage.tsx`, 컴포넌트 `TutorialCourt.tsx`(CMP-046, SVG), `StageCard.tsx`(CMP-047), `usePlayback.ts`
- 연결: `routes/router.tsx`(102·103 연결, pending 도우미 제거), `lib/mock/db.ts`(tutorialProgress·실패 시뮬레이션 플래그), `lib/data/source.ts`('tutorial' 출처)
- 테스트: `features/tutorial/engine/logic.test.ts`(13), `features/tutorial/tutorial.test.tsx`(14), `features/auth/apiMode.test.tsx`(+1)
- 브라우저 스크립트: `experiments/frontend-layout/check-b6.mjs`(결과 `results/b6/`)

## 남은 일(내일)
1. `check-b6.mjs` 재실행 확인: 마지막 수정(첫 선택을 3번째 버튼으로 바꿔 허용·정답 보기·느리게 보기·다시 도전 경로를 지나게 함) 후 실행 결과가 출력되지 않았음 — 원인 미조사. 스크립트 확인 후 다시 실행
2. B1~B5 브라우저 회귀(check-b1~b5, Mock 5175)를 B6 변경 뒤 다시 실행(단위 테스트는 통과, 브라우저는 미실행)
3. 문서: `frontend-implementation-deviations.md`에 B6 항목(F44~), `b6-policy-open-items.md`(임시 정책) 작성, README·CLAUDE.md 갱신
4. 최종 보고(형식: 사용자 요청 1–7)

## 임시로 정한 사항(문서화 전 메모)
- 마지막 상황 뒤 버튼 이름 '결과 보기'(명세는 '다음 상황' → SCR-103)
- 결과 화면에서 저장 중에 이동을 누르면 저장이 끝난 뒤 이동(실패 시 이동 안 함)
- 통과 기준 표시 '통과 기준: 5개 중 4개(70%)', 스테이지 카드 상태 '아직 안 함 / 미통과 / 통과'
- 운영진 명단의 '튜토리얼 권장 · 미통과' 칩은 기존 샘플 값 유지(F16 미정 정책), 통과 개수만 실제 기록 연동
- AC-067: 급수는 마이페이지, 튜토리얼 진행(통과·최고 점수·진행률)은 튜토리얼 홈에서 확인(SCR-121 명세에 튜토리얼 표시 항목 없음)

## 재개 방법
```bash
cd ~/Desktop/badminton-playbook/frontend
VITE_DATA_SOURCE=mock pnpm exec vite --port 5175 --strictPort   # Mock 모드(사용자 5173은 api 모드라 건드리지 않음)
cd .. && BASE=http://localhost:5175 node experiments/frontend-layout/check-b6.mjs
for s in b1 b2 b3 b4 b5; do BASE=http://localhost:5175 node experiments/frontend-layout/check-$s.mjs; done
make check
```

## 참고
- 엔진 저장소 `~/Desktop/ai-product-workflow`는 이 작업에서 읽기·쓰기 없음(다른 세션의 M2.2 변경 있음 — 손대지 않음)
