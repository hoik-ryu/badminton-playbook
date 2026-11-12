# 기술 스택 (SMAPSH 전용)

사용자 결정(2026-11-10, `.ai-workflow/design-notes.md` '시각 디자인·디자인 시스템 결정'). 아직 아무 패키지도 설치하지 않았습니다.

| 영역 | 선택 | 이유 | 상태 |
|---|---|---|---|
| CSS | Tailwind CSS v4 (`@tailwindcss/vite`) | `@theme` 토큰이 CSS 변수로 바로 나와 Figma Variables와 이름을 맞추기 쉬움 | 결정, 미설치 |
| 컴포넌트 기반 | shadcn/ui, 기반은 **Radix UI** (`init -b radix`) | 최신 기본값(Base UI)보다 기존 생태계와 Figma·React 참고 자료가 풍부한 쪽을 우선 | 결정, 미설치 |
| 아이콘 | Lucide (`lucide-react`) | shadcn 기본 아이콘, Figma용 아이콘 세트도 있음 | 결정, 미설치 |
| 글꼴 | **Pretendard**, 폴백은 시스템 sans-serif(`system-ui, sans-serif`) | 한글 가독성, 숫자 표기(고정폭 숫자) 지원 | 결정(VD-001). 로딩 방식은 미결정 |
| 시각 디자인 보조 | Anthropic 공식 `frontend-design` 플러그인(v1.1.1, user 범위) | 시각 품질 보조. 권위 순서 6위 | 설치·활성 |
| Figma | Figma MCP `figma-personal` | `figma.md` 참고 | 연결됨 |

## 적용 위치와 순서

1. **Figma PoC**(패키지 불필요): SCR-211부터.
2. **UI Preview** (`/product-design` preview 단계, `design-preview/`): 여기에 처음 설치합니다. 엔진 규칙상 `design-preview/`는 독립 Vite 앱이며 자체 `package.json`을 씁니다.
3. **제품 구현** (`frontend/`, `/product-build`): Preview 승인 후 결정합니다. 프리뷰 코드를 복사하지 않는 것이 엔진 기본값입니다.
4. **fullstack-boilerplate**: 바꾸지 않습니다(디자인 시스템 비종속 원칙).

## 알려진 충돌과 대응

| 충돌 | 내용 | 대응(결정 필요) |
|---|---|---|
| 경로 별칭 | shadcn은 `@/*` 별칭을 전제로 하고, 엔진의 preview 규칙은 "별칭 대신 상대 경로"를 요구하며 `preview-check`가 검사 | Preview 착수 시 결정: shadcn 생성 파일을 상대 경로로 바꾸거나, 엔진 규칙 개정(보류 중) |
| 반경 계산 | shadcn은 `--radius` 하나에서 sm/md/lg/xl을 계산, 04는 sm 6 · md 10 · sheet 16을 따로 정의 | `token-mapping.md` 4장: `@theme`에서 반경 변수를 04 값으로 재정의 |
| 간격 체계 | Tailwind v4는 `--spacing` 기준값의 배수 | `--spacing: 4px`로 두면 space.1–8과 일치 |
| 글꼴 토큰 | 승인된 04의 `font.family.base`는 시스템 sans-serif, Pretendard는 VD | CSS에서 `--font-sans: "Pretendard", var(--font-family-base)`처럼 VD를 앞에 덧씌움(04 미수정) |
| frontend-design의 표기 지적 | 스킬은 'A · B · C' 가운뎃점 표기를 진부한 패턴으로 봄 | UXD-074(명단 행 표기)가 우선. 표기 유지 |

## 버전 고정 정책

설치할 때 `package.json`과 lockfile로 정확한 버전을 고정하고, 설치한 버전을 이 표에 적습니다. 메이저 버전 변경(예: Tailwind v5, shadcn CLI 메이저)은 사용자 결정 사항입니다.

| 패키지 | 버전 | 설치 위치 |
|---|---|---|
| (설치 후 기록) | | |
