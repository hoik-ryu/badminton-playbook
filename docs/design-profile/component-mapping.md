# 컴포넌트 매핑 (SMAPSH 전용)

기준: 승인된 `docs/design/04-ui-system.md` 2장의 CMP 25개. 컴포넌트의 용도·변형·상태·접근성 정의는 04가 원본이며, 여기서는 **구현 수단**만 정합니다. shadcn/ui 부품은 기반을 Radix로 쓰고(`stack.md`), 부품을 쓰더라도 CMP의 정의(변형 이름, 상태, 접근성)를 바꾸지 않습니다.

구분
- **shadcn**: shadcn/ui 기본 부품을 추가해 CMP 정의에 맞게 스타일·변형만 조정
- **조합**: shadcn 부품과 Tailwind로 직접 조합
- **직접**: 새로 구현(도메인·레이아웃 컴포넌트)

| CMP | 이름 | 구현 | shadcn 부품(Radix) | 조정·주의 | Figma 컴포넌트 이름 |
|---|---|---|---|---|---|
| CMP-001 | Button | shadcn | Button | `variant`: primary→default, secondary→outline(04 테두리형), danger→destructive, text→ghost/link, **kakao는 추가 변형**(color.brand.kakao.*). `size`: md 44px·lg 48px로 재정의 | `CMP-001 Button` |
| CMP-002 | SegmentedControl | shadcn | ToggleGroup (type=single) | 선택 상태에 체크 표시 추가(04: 색 + 굵은 글자 + 체크) | `CMP-002 SegmentedControl` |
| CMP-003 | ChoiceGrid | shadcn | ToggleGroup (type=single) | grade 4열·score 5열 격자, `allowClear`는 다시 눌러 해제 | `CMP-003 ChoiceGrid` |
| CMP-004 | FilterChip | shadcn | Toggle | `aria-pressed` 기본 제공. count 0이면 렌더링하지 않음 | `CMP-004 FilterChip` |
| CMP-005 | Badge | shadcn | Badge | tone 7종 중 warning·success·info·teamBlue·teamWhite는 추가 변형. 항상 글자 포함 | `CMP-005 Badge` |
| CMP-006 | TextField | shadcn | Input + Label | search 변형은 앞쪽 아이콘(Lucide). 글자 16px 유지(모바일 확대 방지) | `CMP-006 TextField` |
| CMP-007 | Switch | shadcn | Switch | `role="switch"` 기본 제공 | `CMP-007 Switch` |
| CMP-008 | Checkbox | shadcn | Checkbox | `rowMode`(행 전체 누름)는 조합으로 구현 | `CMP-008 Checkbox` |
| CMP-021 | Sheet | shadcn | Sheet(side·bottom), Dialog(PC dialog) | 모바일 하단 시트의 끌어올림(70%→전체)은 Sheet만으로 부족할 수 있음. Drawer(vaul) 추가 여부는 Preview에서 결정 | `CMP-021 Sheet` |
| CMP-022 | ConfirmDialog | shadcn | AlertDialog | `tone=conflict`는 버튼 1개 변형 | `CMP-022 ConfirmDialog` |
| CMP-023 | NoticeBox | shadcn | Alert | tone 4종, 오류·충돌은 `role="alert"` | `CMP-023 NoticeBox` |
| CMP-024 | PersonRow | 직접 | (Checkbox·ToggleGroup을 trailing에 사용) | 회원 화면에는 쓰지 않음(점수·급수 노출 방지) | `CMP-024 PersonRow` |
| CMP-025 | AppNav | 조합 | (선택) Sidebar | 모바일 하단 탭은 직접 구현. PC 왼쪽 메뉴에 shadcn Sidebar를 쓰면 `--sidebar-*` 토큰이 필요(미결정, `token-mapping.md` 3.2) | `CMP-025 AppNav` |
| CMP-026 | PageHeader | 직접 | - | 화면 제목 `h1` | `CMP-026 PageHeader` |
| CMP-027 | StateView | 조합 | Skeleton | empty·error·forbidden·notFound는 직접 | `CMP-027 StateView` |
| CMP-028 | StickySummary | 직접 | - | `aria-live="polite"` | `CMP-028 StickySummary` |
| CMP-029 | Toast | shadcn | Sonner | 성공 알림만 3초(04 3장) | `CMP-029 Toast` |
| CMP-030 | ListItem | 직접 | - | 행 전체 링크·버튼 | `CMP-030 ListItem` |
| CMP-041 | GameCard | 직접 | (Badge·Button 사용) | `audience=member`는 점수·팀 합·실력차를 그리지 않음 | `CMP-041 GameCard` |
| CMP-042 | StandingsCard | 직접 | (Collapsible 선택) | 펼치기는 Radix Collapsible 사용 가능 | `CMP-042 StandingsCard` |
| CMP-043 | ClubMatchListItem | 직접 | (Badge 사용) | - | `CMP-043 ClubMatchListItem` |
| CMP-044 | CandidateList | 직접 | - | 비활성 후보도 포커스 가능 | `CMP-044 CandidateList` |
| CMP-045 | RecordSummary | 직접 | - | - | `CMP-045 RecordSummary` |
| CMP-046 | TutorialCourt | 직접 | - | Canvas 또는 SVG(구현 단계에서 결정), `prefers-reduced-motion` | `CMP-046 TutorialCourt` |
| CMP-047 | StageCard | 직접 | - | - | `CMP-047 StageCard` |

집계(25개): shadcn 12개(CMP-001–008, 021, 022, 023, 029), 조합 2개(CMP-025, CMP-027 — CMP-027은 Skeleton 부품을 일부 사용), 직접 11개(CMP-024, 026, 028, 030, 041–047).

## shadcn 부품을 추가할 때 지킬 것

- 필요한 부품만 `add`합니다. 위 표에 없는 부품을 미리 넣지 않습니다.
- 생성된 부품의 색·반경·간격은 `token-mapping.md`의 변수만 씁니다. 원시 값(hex, px)을 직접 쓰지 않습니다.
- 경로 별칭 문제는 `stack.md` '알려진 충돌'을 따릅니다.

## SCR-211 PoC에 필요한 컴포넌트

SCR-211(명단)의 컴포넌트 목록(02 승인본): CMP-026, CMP-006, CMP-004, CMP-007, CMP-024, CMP-005, CMP-001, CMP-027. 화면 셸로 CMP-025, 카카오 가입 안내 한 줄에 CMP-023을 함께 씁니다. Figma 컴포넌트 구성은 `figma.md` 6장을 따릅니다.
