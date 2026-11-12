# I3-d 승인 문서 ↔ 구현 차이 기록(deviation ledger)

- 작성: 2026-11-12 (I3-d4)
- 상태: **기록용. 정식 워크플로 재승인 전**. 승인 문서(`docs/planning/*`, `docs/design/00~05`), `design.json`, 승인 해시, `state.yaml`은 수정하지 않았습니다. 이 문서는 문서 정합성이 완료됐다는 뜻이 아닙니다.
- 근거: 사용자 결정(2026-11-12) D-6~D-13. 원 제안은 `i3d-ac-deviations-proposal.md`, 점검은 `i3d-contract-review.md`입니다.
- 정정(2026-11-12): 배지 컴포넌트 표기를 CMP-002(실제로는 SegmentedControl)에서 **CMP-005 Badge**로 바로잡았습니다.
- 진행(2026-11-12): D-6·D-7·D-8은 Planning r5(승인 대기)에 반영했습니다. UX Spec 변경안은 `ux-spec-r2-change-plan.md`에 있습니다(Planning r5 승인 후 정식 개정).
- 승인 해시 확인(2026-11-12 d4 시작 시점): `docs/design/00~05` 6개 파일의 현재 sha256이 `design.json` 승인 해시와 일치합니다.

## 1. 결정과 구현 상태

| ID | 결정 | 구현(d4 기준) | 승인 문서와 차이 | 정식 반영 필요 문서 |
|---|---|---|---|---|
| D-6 | 승인. 모든 유효 대체 후보가 중복일 때만 `substitute_exhausted` 예외, 중복 없는 후보가 있으면 거부(409 `same_matchup`), 후보 자체가 없으면 거부(422 `no_substitute`) | 서버 `schedule.substitute_decision` = FE `substituteDecision`(골든 일치) | **있음**: NFR-003·C-19의 예외는 "가능한 조합 소진"뿐 | `docs/planning/02-prd.md`(NFR-003, C-19). 필요하면 `05-acceptance-criteria.md`(AC-078에 예외 결과 추가) |
| D-7 | 승인. 종료 후 결과 수정은 '경기 결과가 수정되었습니다(시각)' + '결과 수정됨' 배지 | `resultChanged`·`resultModifiedAt`(마이그레이션 없음), 회원·운영진 화면 반영 | **있음**: C-15·AC-088·SCR-112-ST7은 대진 수정 안내만 정의 | `02-prd.md`(C-15), `05-acceptance-criteria.md`(AC-085 또는 신규 AC), `docs/design/02-screens.md`(SCR-112 상태·SCR-223 카드), `04-ui-system.md`(CMP-005 Badge 용도 '결과 수정됨') |
| D-8 | 승인. 진행 중 청백전의 기록된 결과를 '미기록으로 되돌리기'(확인 창 + 토스트) | 구현됨(I3-d3) | **있음**: AC-081·SCR-223에 되돌리기 없음(U2는 사용자 결정) | `02-prd.md`(FR-015 또는 C-20), `05-acceptance-criteria.md`, `02-screens.md`(SCR-223 행동·상태 흐름), `05-design-traceability.md` |
| D-9 | SCR-226-ST7 = '중복되지 않는 대체 후보가 모두 소진되어 중복 후보만 선택 가능한 상태'. 대체 후보 자체가 없으면 기존 ST4 | `data-st="SCR-226-ST7"` + 안내 상자, 후보 없음은 ST4 + '반영' 비활성 | **있음**: SCR-226 상태 표에 ST7 없음(번호 충돌은 없음, ST7+는 화면 고유 상태 관례) | `02-screens.md`(SCR-226 상태 표), `03-screen-flows.md`(FLOW-005-S7), `05-design-traceability.md`(AC-078 매핑) |
| D-10 | 문구 결정: `substitute_exhausted` 대체 후보 소진 · `manual` 운영진 수동 변경 · `exhausted`(matchup) 가능한 조합 소진 · `exhausted`(gender) 가능한 성별 조합 없음 · `higher_priority` 중복 대진 방지 우선 · `search_limit` 자동 탐색 한계 | 운영진 경기 카드 배지 '같은 대진 반복 · …', '성별 규칙 완화 · …' | **있음**: UXD-007·CMP-005(Badge)는 '성별 완화' 배지만 예시. 사유 표기·'같은 대진 반복' 배지는 명세에 없음 | `00-ux-decisions.md`(UXD-007 사유 표기) 또는 `04-ui-system.md`(CMP-005·CMP-041), `02-screens.md`(SCR-223 경기 카드 정보) |
| D-11 | **제안 철회, 승인 명세대로 구현** | 삭제된 게스트는 참가자 명단에서 빠짐(지난 경기·순위에는 '삭제된 게스트'). 비활성 회원 행: '비활성' 배지 + "남은 경기 n개 · 대체 선수를 정하세요" + '이후 대진에서 제외' | **없음**(SCR-224 원문과 일치) | 없음 |
| D-12 | 승인. 회원 API 사람 키 `p:<참가자 행 id>`, 내부 UUID 비노출 | 구현됨(I3-d2), 계약 테스트 유지 | 명세가 정하지 않은 부분(충돌 없음) | 선택: `02-prd.md` NFR-005 또는 API 계약 메모 |
| D-13 | U4 유지(정책 변경 없음) | Mock·서버 같은 정렬(골든) | 없음 | 없음 |

## 2. 정식 반영 계획(재승인 절차, 아직 실행하지 않음)

1. **기획 개정(Planning r5)**: D-6·D-7·D-8의 정책 문구를 `02-prd.md`·`05-acceptance-criteria.md`에 반영합니다.
   - ai-product-workflow 절차(reopen → 제출 → 사용자 승인)를 따르며 새 승인 해시가 기록됩니다.
   - 기획이 바뀌면 design 단계가 outdated로 표시될 수 있습니다. 이전 r3·r4 개정 때와 같은 흐름입니다.
2. **UX 명세 개정(ux_spec r2)**: D-7·D-8·D-9·D-10을 `02-screens.md`·`03-screen-flows.md`·`04-ui-system.md`·`05-design-traceability.md`(필요 시 `00-ux-decisions.md`)에 반영합니다.
   - 제출·승인 후 `design.json` 해시를 갱신합니다.
3. **개정 승인 전까지**: 이 문서를 차이의 기준 기록으로 둡니다. 구현은 사용자 결정을 따르며, 승인 문서는 그대로 둡니다.

## 3. d4에서 함께 확인·수정한 것(명세와 일치시키는 쪽)

- 대체 선수 시트에서 '반영' 뒤 시트가 닫히지 않고 ST3로 남던 결함을 고쳤습니다(d3 회귀).
  - 원인: 상태 반영 시 `key={view.version}`으로 다시 마운트되고, 새 인스턴스의 이탈 확인이 닫기를 막았습니다.
  - 수정: 충돌(ST6) 뒤에만 다시 마운트합니다.
  - SCR-226 시트 동작("반영 → 시트 닫힘")과 일치합니다.
- 청백전 화면의 점수 입력을 명단 API(`setScore`)로 연결했습니다(Mock 모드는 Mock 저장 유지).
