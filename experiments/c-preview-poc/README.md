# c-preview-poc — SMAPSH C안 Code-first 디자인 PoC (실험)

정식 `/product-design` Preview(`design-preview/`)가 **아닙니다**. 승인 대상이 아니며, 엔진의 승인 해시와 관계없습니다. SCR-211 명단 ST1(mobile) 한 화면만 구현했습니다.

## 실행
```bash
pnpm install                 # 이 폴더 안에만 설치(esbuild 빌드 스크립트는 pnpm 10 기본 정책으로 실행되지 않음)
pnpm run tokens              # docs/design-profile/tokens.json(읽기 전용) + themes/c-mint-hybrid.json → src/styles/tokens.css
pnpm run build
PLAYWRIGHT_BROWSERS_PATH=$PWD/.pw-browsers pnpm exec playwright install chromium   # 브라우저도 폴더 안
pnpm run review              # 360/390/430 측정 → review/results.json, review/screens/*.png
pnpm run dev                 # http://localhost:55190/?safe=34  (safe=34: iPhone 안전 영역 가정값)
```

## 구성
| 경로 | 내용 |
|---|---|
| `themes/c-mint-hybrid.json` | 개발자 설정 테마(원시 청록 3개, 의미 토큰 덮어쓰기 2개, 추가 6개) |
| `scripts/gen-tokens.mjs` | 토큰 CSS 생성. Tailwind 기본 색을 비워(`--color-*: initial`) 토큰 밖 색 클래스를 막음 |
| `src/components/ui/` | shadcn/ui(공식 CLI 4.23.0, style `radix-nova`) Button·Input·Toggle·Switch·Badge. **switch.tsx에 `lg` 크기 추가**(아래) |
| `src/components/smapsh/` | CMP 대응: PageHeader(CMP-026 + CMP-006), RosterControls(CMP-004, CMP-007), PersonRow(CMP-024, CMP-005), AppNav(CMP-025) |
| `src/screens/Scr211Roster.tsx` | SCR-211 ST1. `data-scr`, `data-st`, `data-cmp`, `data-experimental` 속성으로 추적 |
| `scripts/review.mjs` | Visual Review 자동 검증(Playwright) |

## shadcn 코드 변경 기록
- `init`은 실행하지 않았습니다. 임시 복사본에서 리허설한 결과, Geist 글꼴 추가, `^` 범위 의존성, 무채색 oklch 테마 덮어쓰기가 확인되었기 때문입니다.
  - `components.json`은 리허설에서 나온 것과 같은 내용을 두었습니다.
  - `src/lib/utils.ts`는 clsx + tailwind-merge로 직접 작성했습니다.
- `add`는 `--dry-run`과 `--view`로 먼저 확인했습니다.
  - 변경 대상: `src/components/ui/` 새 파일 5개
  - 추가 의존성: `cn`. shadcn 공식 패키지이고 설치 스크립트는 없습니다.
  - 불러오는 모듈: react, cva, cn, radix-ui
  - 실험 폴더 밖 변경: 0
- `switch.tsx`: nova 스위치는 크기를 `data-[size=*]` 변형으로 고정합니다. 그래서 `className` 덮어쓰기로는 CMP-007 44×24를 만들 수 없었고, `size="lg"`를 추가했습니다(3줄).
- 나머지 4개 부품은 고치지 않았고, 감싸는 컴포넌트에서 `className`으로 덮어썼습니다.
