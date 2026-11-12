import {
  CircleUserRound,
  ClipboardList,
  GraduationCap,
  Swords,
} from "lucide-react";

// CMP-025 AppNav(하단, 운영진). B안 구조: 탭 64(CMP-025 '56'과 다름, 실험 X8) + 안전 영역
const TABS = [
  { key: "tutorial", label: "튜토리얼", Icon: GraduationCap },
  { key: "match", label: "청백전", Icon: Swords },
  { key: "ops", label: "운영", Icon: ClipboardList },
  { key: "my", label: "마이페이지", Icon: CircleUserRound },
] as const;

export function AppNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav
      aria-label="주 메뉴"
      data-cmp="CMP-025"
      data-testid="app-nav"
      data-experimental="C안: 탭 높이 64"
      className="fixed inset-x-0 bottom-0 z-10 bg-bg-page pb-(--safe-bottom)"
    >
      <ul className="flex h-16 border-t border-border-default">
        {TABS.map(({ key, label, Icon }) => {
          const on = key === active;
          return (
            <li key={key} className="flex-1">
              <a
                href={`#${key}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-full flex-col items-center gap-1 pt-2 ${on ? "text-nav-active" : "text-text-secondary"}`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-2xl ${on ? "bg-selected-bg" : ""}`}
                >
                  <Icon aria-hidden className="size-6" />
                </span>
                <span className={`text-caption ${on ? "font-bold" : ""}`}>
                  {label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
