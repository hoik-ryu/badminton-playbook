# 토큰 매핑 (SMAPSH 전용)

값의 원본은 승인된 `docs/design/04-ui-system.md`이고, `tokens.json`(W3C DTCG 2025.10 형식)은 그 값을 그대로 옮긴 것입니다. 아래 표는 `tokens.json`에서 자동으로 뽑았습니다(2026-11-10).

## 1. 층 구조

```
DTCG tokens.json (원본 62개)
  → CSS 변수 (01 6.5 규칙: 점을 하이픈으로, 예 color.team.blue.bg → --color-team-blue-bg)
  → Tailwind v4 @theme inline (유틸리티 이름이 필요한 것만 별칭)
  → shadcn/ui 변수 (tokens.json의 shadcn 그룹: 원본을 가리키는 별칭 13개)
  → Figma Variables (컬렉션 = 분류, 변수 이름 = 나머지 경로를 '/'로)
```

- 모든 층은 원본 토큰을 **참조**만 합니다. 값을 복사해 새로 만들지 않습니다.
- 모드는 `light` 하나입니다(다크 모드는 범위 밖).
- 글꼴은 VD-001(Pretendard)을 CSS·Figma 텍스트 스타일에서 원본 `font.family.base` 앞에 덧씌웁니다. 승인된 04와 tokens.json의 값은 바꾸지 않습니다.

## 2. 원본 토큰 62개

| 토큰 | DTCG 타입 | 값 | CSS 변수 | Tailwind v4 | Figma Variables |
|---|---|---|---|---|---|
| `color.bg.page` | color | #FFFFFF | `--color-bg-page` | --color-bg-page (그대로 @theme) | color / `bg/page` (COLOR) |
| `color.bg.surface` | color | #F4F5F7 | `--color-bg-surface` | --color-bg-surface (그대로 @theme) | color / `bg/surface` (COLOR) |
| `color.text.primary` | color | #1A1D23 | `--color-text-primary` | --color-text-primary (그대로 @theme) | color / `text/primary` (COLOR) |
| `color.text.secondary` | color | #545A65 | `--color-text-secondary` | --color-text-secondary (그대로 @theme) | color / `text/secondary` (COLOR) |
| `color.text.disabled` | color | #6B7280 | `--color-text-disabled` | --color-text-disabled (그대로 @theme) | color / `text/disabled` (COLOR) |
| `color.border.default` | color | #D5D9E0 | `--color-border-default` | --color-border-default (그대로 @theme) | color / `border/default` (COLOR) |
| `color.border.strong` | color | #6B7280 | `--color-border-strong` | --color-border-strong (그대로 @theme) | color / `border/strong` (COLOR) |
| `color.action.primary` | color | #1D5BD0 | `--color-action-primary` | --color-action-primary (그대로 @theme) | color / `action/primary` (COLOR) |
| `color.action.onPrimary` | color | #FFFFFF | `--color-action-onPrimary` | --color-action-onPrimary (그대로 @theme) | color / `action/onPrimary` (COLOR) |
| `color.focus.ring` | color | #1D5BD0 | `--color-focus-ring` | --color-focus-ring (그대로 @theme) | color / `focus/ring` (COLOR) |
| `color.status.danger.fg` | color | #B3261E | `--color-status-danger-fg` | --color-status-danger-fg (그대로 @theme) | color / `status/danger/fg` (COLOR) |
| `color.status.danger.bg` | color | #FDE7E5 | `--color-status-danger-bg` | --color-status-danger-bg (그대로 @theme) | color / `status/danger/bg` (COLOR) |
| `color.status.warning.fg` | color | #7A4F00 | `--color-status-warning-fg` | --color-status-warning-fg (그대로 @theme) | color / `status/warning/fg` (COLOR) |
| `color.status.warning.bg` | color | #FFF3D1 | `--color-status-warning-bg` | --color-status-warning-bg (그대로 @theme) | color / `status/warning/bg` (COLOR) |
| `color.status.success.fg` | color | #1B6E35 | `--color-status-success-fg` | --color-status-success-fg (그대로 @theme) | color / `status/success/fg` (COLOR) |
| `color.status.success.bg` | color | #E4F4E8 | `--color-status-success-bg` | --color-status-success-bg (그대로 @theme) | color / `status/success/bg` (COLOR) |
| `color.status.info.bg` | color | #E3ECFC | `--color-status-info-bg` | --color-status-info-bg (그대로 @theme) | color / `status/info/bg` (COLOR) |
| `color.team.blue.fg` | color | #1747A6 | `--color-team-blue-fg` | --color-team-blue-fg (그대로 @theme) | color / `team/blue/fg` (COLOR) |
| `color.team.blue.bg` | color | #E3ECFC | `--color-team-blue-bg` | --color-team-blue-bg (그대로 @theme) | color / `team/blue/bg` (COLOR) |
| `color.team.white.fg` | color | #1A1D23 | `--color-team-white-fg` | --color-team-white-fg (그대로 @theme) | color / `team/white/fg` (COLOR) |
| `color.team.white.bg` | color | #FFFFFF | `--color-team-white-bg` | --color-team-white-bg (그대로 @theme) | color / `team/white/bg` (COLOR) |
| `color.brand.kakao.bg` | color | #FEE500 | `--color-brand-kakao-bg` | --color-brand-kakao-bg (그대로 @theme) | color / `brand/kakao/bg` (COLOR) |
| `color.brand.kakao.fg` | color | #191919 | `--color-brand-kakao-fg` | --color-brand-kakao-fg (그대로 @theme) | color / `brand/kakao/fg` (COLOR) |
| `color.court.surface` | color | #2F7D4F | `--color-court-surface` | --color-court-surface (그대로 @theme) | color / `court/surface` (COLOR) |
| `color.court.line` | color | #FFFFFF | `--color-court-line` | --color-court-line (그대로 @theme) | color / `court/line` (COLOR) |
| `color.court.me` | color | #1D5BD0 | `--color-court-me` | --color-court-me (그대로 @theme) | color / `court/me` (COLOR) |
| `color.court.opponent` | color | #F2C14E | `--color-court-opponent` | --color-court-opponent (그대로 @theme) | color / `court/opponent` (COLOR) |
| `space.1` | dimension | 4px | `--space-1` | --spacing: 4px 배수 | space / `1` (FLOAT) |
| `space.2` | dimension | 8px | `--space-2` | --spacing: 4px 배수 | space / `2` (FLOAT) |
| `space.3` | dimension | 12px | `--space-3` | --spacing: 4px 배수 | space / `3` (FLOAT) |
| `space.4` | dimension | 16px | `--space-4` | --spacing: 4px 배수 | space / `4` (FLOAT) |
| `space.5` | dimension | 20px | `--space-5` | --spacing: 4px 배수 | space / `5` (FLOAT) |
| `space.6` | dimension | 24px | `--space-6` | --spacing: 4px 배수 | space / `6` (FLOAT) |
| `space.8` | dimension | 32px | `--space-8` | --spacing: 4px 배수 | space / `8` (FLOAT) |
| `space.gutter.mobile` | dimension | 16px | `--space-gutter-mobile` | @theme 미등록(레이아웃 CSS에서 var 사용) | space / `gutter/mobile` (FLOAT) |
| `space.gutter.desktop` | dimension | 24px | `--space-gutter-desktop` | @theme 미등록(레이아웃 CSS에서 var 사용) | space / `gutter/desktop` (FLOAT) |
| `radius.sm` | dimension | 6px | `--radius-sm` | --radius-sm | radius / `sm` (FLOAT) |
| `radius.md` | dimension | 10px | `--radius-md` | --radius-md | radius / `md` (FLOAT) |
| `radius.sheet` | dimension | 16px | `--radius-sheet` | --radius-sheet | radius / `sheet` (FLOAT) |
| `size.touch.min` | dimension | 44px | `--size-touch-min` | @theme 미등록(var 사용) | size / `touch/min` (FLOAT) |
| `size.content.member` | dimension | 480px | `--size-content-member` | @theme 미등록(var 사용) | size / `content/member` (FLOAT) |
| `size.content.ops.max` | dimension | 1200px | `--size-content-ops-max` | @theme 미등록(var 사용) | size / `content/ops/max` (FLOAT) |
| `size.panel.side` | dimension | 400px | `--size-panel-side` | @theme 미등록(var 사용) | size / `panel/side` (FLOAT) |
| `size.nav.side` | dimension | 240px | `--size-nav-side` | @theme 미등록(var 사용) | size / `nav/side` (FLOAT) |
| `font.family.base` | fontFamily | system-ui, sans-serif | `--font-family-base` | --font-sans (VD-001: Pretendard 앞에 덧씌움) | font / `family/base` (STRING) |
| `font.size.caption` | dimension | 13px | `--font-size-caption` | --text-caption | font / `size/caption` (FLOAT) |
| `font.size.body` | dimension | 16px | `--font-size-body` | --text-body | font / `size/body` (FLOAT) |
| `font.size.title` | dimension | 18px | `--font-size-title` | --text-title | font / `size/title` (FLOAT) |
| `font.size.heading` | dimension | 22px | `--font-size-heading` | --text-heading | font / `size/heading` (FLOAT) |
| `font.size.display` | dimension | 32px | `--font-size-display` | --text-display | font / `size/display` (FLOAT) |
| `font.weight.regular` | fontWeight | 400 | `--font-weight-regular` | --font-weight-regular | font / `weight/regular` (FLOAT) |
| `font.weight.bold` | fontWeight | 700 | `--font-weight-bold` | --font-weight-bold | font / `weight/bold` (FLOAT) |
| `font.lineHeight.body` | number | 1.5 | `--font-lineHeight-body` | --leading-body | font / `lineHeight/body` (FLOAT) |
| `elevation.sheet` | shadow | 0 -4px 16px rgba(0,0,0,0.16) | `--elevation-sheet` | --shadow-sheet | (Effect Style) |
| `elevation.card` | shadow | 0 1px 3px rgba(0,0,0,0.12) | `--elevation-card` | --shadow-card | (Effect Style) |
| `motion.duration.fast` | duration | 150ms | `--motion-duration-fast` | @theme 미등록(var 사용) | motion / `duration/fast` (FLOAT) |
| `motion.duration.base` | duration | 250ms | `--motion-duration-base` | @theme 미등록(var 사용) | motion / `duration/base` (FLOAT) |
| `motion.tutorial.speed.normal` | number | 1.0 | `--motion-tutorial-speed-normal` | 해당 없음(스크립트 상수) | motion / `tutorial/speed/normal` (FLOAT) |
| `motion.tutorial.speed.slow` | number | 0.5 | `--motion-tutorial-speed-slow` | 해당 없음(스크립트 상수) | motion / `tutorial/speed/slow` (FLOAT) |
| `breakpoint.base` | dimension | 0px | `--breakpoint-base` | 해당 없음(base는 기본값) | (변수 아님: 프레임 너비) |
| `breakpoint.tablet` | dimension | 768px | `--breakpoint-tablet` | --breakpoint-tablet | (변수 아님: 프레임 너비) |
| `breakpoint.desktop` | dimension | 1024px | `--breakpoint-desktop` | --breakpoint-desktop | (변수 아님: 프레임 너비) |

## 3. shadcn/ui 변수

### 3.1 원본에 대응하는 변수(tokens.json `shadcn` 그룹, 별칭 13개)

| shadcn 변수 | 별칭 대상 | 근거 |
|---|---|---|
| `--background` | `color.bg.page` | 페이지 배경 |
| `--foreground` | `color.text.primary` | 본문 |
| `--card` | `color.bg.page` | 카드 배경은 페이지와 같은 흰색(그림자 elevation.card로 구분) |
| `--card-foreground` | `color.text.primary` | 카드 본문 |
| `--muted` | `color.bg.surface` | 구역·스켈레톤 배경 |
| `--muted-foreground` | `color.text.secondary` | 보조 정보 |
| `--primary` | `color.action.primary` | 주 버튼·선택 |
| `--primary-foreground` | `color.action.onPrimary` | 주 버튼 글자 |
| `--destructive` | `color.status.danger.fg` | 오류·위험 |
| `--border` | `color.border.default` | 장식 구분선 |
| `--input` | `color.border.strong` | 입력칸 테두리(대비 4.83:1) |
| `--ring` | `color.focus.ring` | 포커스 링 |
| `--radius` | `radius.md` | 버튼·입력·카드 반경 |

### 3.2 대응하는 원본이 없는 변수(미결정, 만들지 않음)

| shadcn 변수 | 사용처 | 상태 |
|---|---|---|
| `--secondary`, `--secondary-foreground` | Button `secondary` 변형 배경 | 미결정. CMP-001의 보조 버튼은 04에서 테두리형(color.border.strong)이라 채움 색이 없음. VD로 결정하거나 `variant=outline`을 쓸지 정해야 함 |
| `--accent`, `--accent-foreground` | 메뉴·목록의 hover/선택 배경 | 미결정. 04에 hover 배경 토큰 없음 |
| `--popover`, `--popover-foreground` | 드롭다운·더보기 메뉴 배경 | 미결정. 더보기(⋯) 메뉴 배경 토큰 없음 |
| `--destructive-foreground` | 위험 버튼 글자(버전에 따라 없음) | 미결정. 04에 위험 버튼 글자 토큰 없음(대비는 흰색 6.54:1로 계산됨) |
| `--chart-1`~`--chart-5` | 차트 | 해당 없음(SMAPSH에 차트 없음) |
| `--sidebar-*` | shadcn Sidebar(PC 왼쪽 메뉴) | 미결정. CMP-025 PC 메뉴의 배경·선택 색 토큰 없음 |

## 4. 알려진 충돌과 처리

| 충돌 | 처리 |
|---|---|
| shadcn은 `--radius` 하나에서 `--radius-sm = --radius - 4px`, `--radius-md = - 2px`, `--radius-xl = + 4px`를 계산. `--radius: 10px`이면 sm 6px(04와 같음), md 8px(04는 10px), xl 14px | Tailwind `@theme inline`에서 `--radius-sm: var(--radius-sm)`처럼 04 값으로 직접 재정의하고 계산식을 쓰지 않음 |
| Tailwind v4 간격은 `--spacing` 배수 | `--spacing: 4px`. space.1–8과 일치(space.7은 04에 없음) |
| 04의 CSS 변수 규칙(`--font-size-body`)과 Tailwind 이름(`--text-body`) | 04 이름을 원본 변수로 두고 Tailwind 이름은 별칭 |
| 그림자는 Figma에서 변수가 아님 | Effect Style `elevation/sheet`, `elevation/card`로 만듦 |
| 브레이크포인트는 DTCG 전용 타입이 없음 | `dimension`(최소 너비) + `$extensions.smapsh.breakpoint`(min·max). Figma에서는 프레임 너비 |
| `motion.reduced` | 토큰이 아닌 접근성 규칙. `tokens.json`의 `$extensions.smapsh.excludedRules`와 04 1.4에 둠 |
| 색 공간 | 원본은 sRGB hex(대비 계산 기준). shadcn 기본 테마의 oklch는 쓰지 않거나 hex에서 변환만 함(변환 후 대비 재확인) |
