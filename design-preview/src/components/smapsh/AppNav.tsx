import {
  CircleUserRound,
  ClipboardList,
  GraduationCap,
  Swords,
} from "lucide-react";
import { previewHref } from "../../previewLinks";
import { COLUMN } from "./Layout";

// CMP-025 AppNav(하단, 운영진). 탭 높이 56(CR-005 거절) + 안전 영역(VD-020).
// VD-019: Lucide 아이콘, 글자 레이블 유지, 현재 탭 = color.action.primary + 굵은 글자 + 위쪽 표시 막대(새 토큰 없음)
// (r2) 순서는 UXD-066 '튜토리얼 / 청백전 / 마이페이지' + 운영진 '운영'. PC·모바일 같은 하단 탭, 600px 열 너비(04 CMP-025 layout=bottom, VD-019)
// 탭을 누르면 그 탭의 첫 화면(03 공통 이동: SCR-101, SCR-111, SCR-121, SCR-201)
// 04 CMP-025 상태 '배지(운영 탭 승인 대기 건수)': opsBadge가 1 이상일 때만 표시, 건수를 레이블에 포함
const TABS = [
  { key: "tutorial", label: "튜토리얼", Icon: GraduationCap, to: "SCR-101" },
  { key: "match", label: "청백전", Icon: Swords, to: "SCR-111" },
  { key: "my", label: "마이페이지", Icon: CircleUserRound, to: "SCR-121" },
  { key: "ops", label: "운영", Icon: ClipboardList, to: "SCR-201" },
] as const;

export function AppNav({
  active,
  opsBadge,
}: {
  active: (typeof TABS)[number]["key"];
  opsBadge?: number;
}) {
  return (
    <nav
      aria-label="주 메뉴"
      data-cmp="CMP-025"
      data-testid="app-nav"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10"
    >
      <ul data-testid="app-nav-inner" className={`${COLUMN} pointer-events-auto flex h-[calc(56px+var(--safe-bottom))] border-t border-line bg-page pb-(--safe-bottom)`}>
        {TABS.map(({ key, label, Icon, to }) => {
          const on = key === active;
          const count = key === "ops" && opsBadge ? opsBadge : 0;
          return (
            <li key={key} className="relative flex-1">
              {on && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 mx-auto h-[3px] w-8 rounded-b-sm bg-action"
                />
              )}
              <a
                href={previewHref(to)}
                aria-current={on ? "page" : undefined}
                aria-label={
                  count ? `${label}, 승인 대기 ${count}건` : undefined
                }
                className={`flex h-full flex-col items-center justify-center gap-0.5 ${on ? "font-bold text-action" : "text-ink-muted"}`}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" />
                  {count > 0 && (
                    <span
                      aria-hidden
                      data-cmp="CMP-005"
                      data-testid="tab-badge"
                      className="absolute top-0 left-4 flex h-5 min-w-5 items-center justify-center rounded-sm bg-warning-bg px-1 text-caption leading-none font-bold tabular-nums text-warning-fg"
                    >
                      {count}
                    </span>
                  )}
                </span>
                <span className="text-caption">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
