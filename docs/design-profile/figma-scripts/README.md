# Figma 생성 스크립트 (C안 Mint Hybrid, 실험)

Figma Plugin API 스크립트입니다. `use_figma`(MCP 서버 `figma-personal`)로 실행합니다. 결과물은 승인 대상이 아닌 실험 산출물입니다.

## 파일
| 파일 | 내용 | 실행 상태(2026-11-10) |
|---|---|---|
| `lib.js` | 공통: 변수 해석(`exp/theme-C` 우선, 없으면 승인 `color/*`), 텍스트 스타일, 자동 레이아웃, 컴포넌트·인스턴스 도우미 | - |
| `libs.js` | 화면 조립 도우미(섹션, 프레임 이름 규칙, 시트·확인 창·하단 탭·행동 바) | - |
| `c1-theme-icons-base.js` | 테마 변수, 아이콘 35, CMP-001–008 | 완료 |
| `c2-patterns.js` | CMP-021–030, 하단 탭·옆 메뉴·헤더 | 완료 |
| `c3-domain.js` | CMP-041–047 | 완료 |
| `s1-auth-tutorial.js` | SCR-001–005, 101–103 (14 프레임) | 완료 |
| `s2-member.js` | SCR-111–122 (7) | 미실행(한도) |
| `s3-ops-session.js` | SCR-201–205 (10) | 미실행 |
| `s4-ops-roster.js` | SCR-211–214 (9) | 미실행 |
| `s5-ops-clubmatch.js` | SCR-221–226 (10) | 미실행 |
| `s6-ops-admin-pc.js` | SCR-231–232 + PC 3 (6) | 미실행 |

## 실행
1. `python3 assemble.py <파트 파일...>`
   - `out/<파트>.full.js`를 만들고 `node --check`로 문법을 검사합니다.
   - `s*`로 시작하는 파트에는 `libs.js`도 붙습니다.
2. `out/<파트>.full.js` 내용을 **그대로** `use_figma`의 `code`로 보냅니다.
   - 대상 파일: fileKey `gqwivlIXG9u8WoPpHIQWdQ`
   - 순서: c1 → c2 → c3 → s1 … s6
3. 모든 파트는 멱등입니다. 같은 이름의 컴포넌트·프레임이 있으면 건너뛰므로, 실패한 파트만 고쳐 다시 실행하면 됩니다.

## 환경과 전제
- 개인 Figma 계정(Starter, Full 좌석). 페이지 3개·변수 모드 1개 제한 때문에 새 페이지 없이 섹션으로 나눕니다.
- 글꼴: Noto Sans KR(Pretendard 없음). 텍스트 스타일 ID는 `lib.js`의 `ST`에 고정되어 있습니다(이 파일 전용).
- 페이지 ID `1:73`(컴포넌트), `1:74`(화면)와 스타일 ID는 이 Figma 파일에서만 유효합니다. 다른 파일에 쓰려면 바꿔야 합니다.
- 아이콘은 Lucide 도형을 옮겨 적은 것이라 `lucide-react` 원본과 대조해야 합니다.
- 생성된 코드는 실험용입니다. 운영 Figma 파일에 쓰기 전에 사람이 검토하고 시험해야 합니다.

## 모의 실행(dry-run, Figma 호출 없음)
- `node dryrun/run.mjs dryrun/figma_vars.json <출력.json>`
  - `out/*.full.js` 9개를 모의 Figma API(`dryrun/mock-figma.mjs`)에서 차례로 실행합니다.
  - 실행 오류(이름·변형·속성 오류)를 미리 찾고, 화면 트리 JSON을 만듭니다.
- 결과는 `../preview-handoff/C-screens.dryrun.json`에 있습니다.
- `figma_vars.json` 형식은 `[컬렉션, 변수 이름, 타입, 값, CSS 이름]` 행 목록입니다. `tokens.json`에서 만듭니다.
- 한계: 자동 레이아웃 크기, 렌더링, 실제 API의 값 검증은 하지 않습니다. 모의 환경 통과가 실제 실행 성공을 보장하지는 않습니다.
