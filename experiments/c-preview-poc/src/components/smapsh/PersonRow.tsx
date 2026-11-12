import { Badge } from "@/components/ui/badge";
import type { Person } from "@/mock/roster";

// CMP-024 PersonRow: 한 줄, 높이 56, 구분선. 표기 순서 이름 · 성별 · 급수 · 점수(UXD-074)
// C안: 점수를 오른쪽 열로 분리(실험 D6 — UXD-074 표기 해석 필요)
export function PersonRow({ p }: { p: Person }) {
  return (
    <li>
      <button type="button" aria-label={`${p.name}, ${p.gender}, ${p.grade}, ${p.score == null ? "점수 미설정" : `${p.score}점`}`} data-cmp="CMP-024" data-testid="person-row" data-experimental="C안: 점수 오른쪽 열(D6)" className="flex h-14 w-full items-center gap-3 border-b border-border-default px-4 text-left">
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 text-body font-bold text-text-primary" data-field="name">{p.name}</span>
          <span className="truncate text-body text-text-secondary" data-field="meta">{p.gender} · {p.grade}</span>
        </span>
        {p.score == null ? (
          <Badge data-cmp="CMP-005" className="h-6 rounded-sm border-0 bg-status-warning-bg px-2 text-caption font-bold text-status-warning-fg">미설정</Badge>
        ) : (
          <span className="shrink-0 text-body font-bold tabular-nums text-text-primary" data-field="score">{p.score}점</span>
        )}
      </button>
    </li>
  );
}

export function GroupHeader({ label }: { label: string }) {
  return <div role="heading" aria-level={2} className="flex h-8 items-center bg-bg-surface px-4 text-caption font-bold text-text-secondary">{label}</div>;
}
