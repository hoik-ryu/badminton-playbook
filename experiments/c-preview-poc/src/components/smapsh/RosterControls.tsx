import { useId, useState } from "react";
import { Check } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";

// CMP-004 FilterChip: 보이는 높이 32, 누름 영역 44(VD-010). 두 칩 중 하나만 켜짐(UXD-073)
function FilterChip({ label, pressed, onChange }: { label: string; pressed: boolean; onChange: (v: boolean) => void }) {
  return (
    <Toggle data-cmp="CMP-004" pressed={pressed} onPressedChange={onChange} data-hit="44" className="group relative h-8 min-w-0 rounded-none bg-transparent p-0 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:bg-transparent data-[state=on]:bg-transparent">
      <span className="flex h-8 items-center gap-1 rounded-2xl border border-border-strong bg-bg-page px-3.5 text-body font-normal text-text-primary group-data-[state=on]:border-action-primary group-data-[state=on]:bg-action-primary group-data-[state=on]:text-action-onPrimary">
        {pressed && <Check aria-hidden className="size-4" />}
        {label}
      </span>
    </Toggle>
  );
}

export function RosterControls({ unset, tutorial }: { unset: number; tutorial: number }) {
  const [chip, setChip] = useState<"unset" | "tutorial" | null>(null);
  const [inactive, setInactive] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-1">
      <div className="flex flex-wrap gap-x-2 gap-y-3" role="group" aria-label="필터">
        {unset > 0 && <FilterChip label={`점수 미설정 ${unset}명`} pressed={chip === "unset"} onChange={v => setChip(v ? "unset" : null)} />}
        {tutorial > 0 && <FilterChip label={`튜토리얼 권장 · 미통과 ${tutorial}명`} pressed={chip === "tutorial"} onChange={v => setChip(v ? "tutorial" : null)} />}
      </div>
      {/* CMP-007 Switch: 줄 전체(44)가 누름 영역(R14) */}
      <label htmlFor={id} data-cmp="CMP-007" className="flex h-11 items-center justify-between text-body">
        비활성 포함
        <Switch id={id} size="lg" checked={inactive} onCheckedChange={setInactive} className="data-[state=checked]:bg-action-primary data-[state=unchecked]:bg-border-strong" />
      </label>
    </div>
  );
}
