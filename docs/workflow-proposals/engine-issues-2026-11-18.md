# 엔진 이슈 기록 — 튜토리얼 재기획(Discovery r4) 중 발견 (2026-11-18)

- 대상 엔진: `~/Desktop/ai-product-workflow` HEAD `18bf645`
- 대상 제품 상태: Git HEAD `5f3a054`, Discovery r4 작성 중(T7 실행 2026-11-18T05:51:02Z), Planning `outdated`, Build 계획 r3 승인
- 성격: 관찰 기록입니다. 엔진·상태 파일·Build 기록은 고치지 않았습니다. 확인은 읽기 전용 명령으로만 했습니다(실행 전후 `.ai-workflow`·`docs`·`design-preview` 해시 비교로 무변경 확인).
- 조치 원칙: 해결 전까지 Build 배치는 실행하지 않습니다(사용자 지시 2026-11-18).

## EI-01. B7 검증 뒤 범위 파일이 바뀌었는데 재검증 필요(stale)로 표시되지 않음

- **관찰**
  - B7은 `verified` 상태입니다. 검증 기록(`run_id 20261117-091208-508038`)의 코드 기준 커밋은 `5d8a930`입니다.
  - 그 뒤 커밋 `5f3a054`가 B7 수정 범위(`paths.allow`) 안의 파일 2개를 바꿨습니다.
    - `frontend/src/routes/layouts/shells.css`
    - `frontend/src/layout.test.tsx`(AC-050 증거 테스트 파일)
  - 두 파일의 현재 해시는 B7 제출 기록(`batches.B7.run.submitted.files`)과 다릅니다.
  - 그런데 `product_build.py status --all`은 `needs_reverify: {}`, B7 `stale_reason: null`로 보고합니다.
- **영향**: 바뀐 코드로 AC-050 증거(E2)가 유효한지 확인되지 않은 채 `verified`가 유지됩니다. 최종 승인(`approve batch`) 판단을 왜곡할 수 있습니다.
- **가능한 원인(확인 필요)**
  - `freshness()`는 검증 때 기록한 `code_tree`·`deps`를 비교합니다. 커밋된 변경이나 이 두 파일이 비교 대상에서 빠졌을 수 있습니다.
  - 또는 status가 기록만 읽고 재계산하지 않을 수 있습니다.
- **임시 조치**: Build 계획 r4를 진행할 때 B7을 재검증 대상으로 명시합니다(`impact` → 재검증).

## EI-02. Planning이 `outdated`(기획 게이트 실패)인데 Build status가 배치 시작 가능으로 안내함

- **관찰**: T7 실행 뒤 `product_build.py status --project .` 결과입니다.
  - `next`: "다음 배치를 batch-start로 시작합니다(후보: B1, B2, B3)"
  - 계획 `validity`: `valid`
  - 같은 명령에 `--all`을 붙이면 `planning.ok: false`가 나오고, discovery `in_progress`, planning `outdated`, 승인 해시 없음, design `locked`가 정확히 보고됩니다.
  - 즉 기획 게이트 판정은 맞지만, 기본 출력의 다음 행동 안내(`next_action`)와 계획 유효성(`validity`)에는 반영되지 않습니다.
- **원인(코드 확인)**
  - `cmd_status`는 `planning_gate()` 결과를 `--all`일 때만 출력합니다.
  - `next_action(st, project)`는 계획·배치 상태만 보고 기획 게이트를 보지 않습니다.
  - 계획 `validity`는 `check`가 기준선(승인 해시)을 비교할 때만 갱신됩니다. T7은 기획 문서 내용을 바꾸지 않으므로 계획이 `outdated`가 되지 않습니다.
- **영향**: 사용자나 에이전트가 기본 status만 보고 기획 재검토 중에 배치를 시작할 수 있습니다. 실제 진입은 `execute-gate`·`batch-start`가 기획 게이트로 막을 가능성이 높지만, 이번에는 실행하지 않아 확인하지 않았습니다.
- **제안**: 기획 게이트가 실패하면 기본 status의 `next`를 "기획 재검토 중 — 실행 불가"로 바꿉니다. 계획 표시에도 기획 게이트 실패를 함께 보여 줍니다.

## 참고(이슈 후보, 동작은 문서와 일치)

- **T7 전용 스크립트 없음**
  - `ps_state.py reopen`은 planning(T9)만 지원합니다.
  - discovery 재개(T7)는 state.yaml의 상태값과 승인 블록을 사람이 직접 바꾸고 `event`로 history만 기록합니다.
  - 그래서 승인 블록 초기화와 이전 해시 보존이 실행자의 수작업에 달려 있습니다. 이번에는 전체 해시를 history note에 남겼습니다.
- **디자인 status는 T7 직후에도 `valid`**
  - `product_design.py status`는 Planning 문서 해시가 바뀌어야 `outdated`를 감지합니다.
  - Planning r7이 승인되기 전까지는 디자인 상태가 유효로 보입니다. 문서(design-state D9)와 일치하는 동작이지만, 기획 재검토 중이라는 사실은 status에 드러나지 않습니다.
