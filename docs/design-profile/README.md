# SMAPSH 디자인 프로필

이 폴더는 **SMAPSH(badminton-playbook) 프로젝트 전용** 시각 디자인 설정입니다. 범용 워크플로 엔진(ai-product-workflow)과 fullstack-boilerplate는 특정 디자인 시스템에 종속되지 않으며, 이 폴더의 선택(Tailwind CSS v4, shadcn/ui + Radix UI, Lucide, Pretendard)은 이 프로젝트에만 적용됩니다.

- 작성: 2026-11-10 (UX Specification r1 승인 후)
- 상태: 초안. 시각 결정(VD)은 `visual-decisions.md`에서 하나씩 승인합니다.

## 기준이 되는 승인 문서

| 문서 | 승인 revision | 비고 |
|---|---|---|
| `docs/planning/01-discovery.md` | Discovery r3 | `.ai-workflow/state.yaml` |
| `docs/planning/02`–`05` | Planning r4 | 같은 파일 |
| `docs/design/00-ux-decisions.md` | UX Planning r2 | `.ai-workflow/design.json` |
| `docs/design/01`–`05` | UX Specification r1 | 같은 파일. 토큰 값의 원본은 `04-ui-system.md` |

## 권위 순서

앞의 것이 항상 우선합니다.

1. 승인된 Planning(FR·NFR·C·AC)
2. 승인된 UX Planning(UXD)
3. 승인된 UX Specification(`01`–`05`: 화면, 정보 우선순위, 행동, 상태, 컴포넌트 정의)
4. 승인된 디자인 토큰(`04` 1장 → 이 폴더의 `tokens.json`)
5. 이 프로필의 승인된 시각 결정(`visual-decisions.md`의 '승인' VD)
6. frontend-design 스킬의 제안(VD 후보로만 기록)

## 파일

| 파일 | 내용 |
|---|---|
| `stack.md` | 기술 선택과 적용 위치 |
| `tokens.json` | W3C DTCG 형식 토큰(값 원본은 `04`) |
| `token-mapping.md` | DTCG → CSS 변수 → Tailwind → shadcn → Figma Variables |
| `component-mapping.md` | CMP 25개 ↔ shadcn 기본 부품 또는 직접 구현 |
| `visual-decisions.md` | VD-### 시각 결정과 승인 상태 |
| `frontend-design-brief.md` | frontend-design 스킬에 주는 브리프(고정 규칙과 자유 요소) |
| `figma.md` | Figma 계정, 프레임 명명, 샘플 데이터, MCP 한도 운용, SCR-211 PoC 준비 |

## 변경과 승인 절차

- **시각 결정(VD)**: 후보로 추가 → 사용자 승인 → 상태를 '승인'으로 바꿉니다. 승인된 VD는 Figma PoC와 UI Preview에서 씁니다.
- **토큰 값 변경**: `tokens.json`만 고치지 않습니다. 값의 원본은 승인된 `04`이므로 `/product-design reopen --stage ux_spec`으로 UX 설계 변경 절차를 거친 뒤 `04`와 `tokens.json`을 함께 바꿉니다(`reference/preview.md`: 토큰 변경은 UX 설계 변경).
- **정보·행동·상태가 바뀌는 제안**: VD가 아니라 UX 설계 변경입니다. 같은 `reopen` 절차를 따릅니다.
- **기술 선택 변경**(`stack.md`): 사용자 결정 후 이 폴더와 `.ai-workflow/design-notes.md`에 함께 기록합니다.
- 이 폴더는 `/product-design`의 단계 산출물(`00`–`06`)이 아니어서 엔진의 승인 해시 대상이 아닙니다. 대신 Git 이력과 VD 승인 상태로 관리합니다.
