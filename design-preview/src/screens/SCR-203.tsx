import { Check, Plus, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Sheet } from '../components/smapsh/Sheet'
import { SearchField } from '../components/smapsh/SearchField'
import { GroupHeader } from '../components/smapsh/PersonRow'
import { attendance, session } from '../mock/data'
import { Scr202 } from './SCR-202'

// SCR-203 참석 체크 — UX Spec r2(02 SCR-203, 형태 '시트') + Design Direction r2(VD-025)
// SCR-202 위의 하단 시트(처음 70%). 인원 요약은 시트 위쪽 고정(CMP-028), 목록은 Flat 행(VD-024, VD-008 행 높이)
// child: 이 시트 위에 여는 두 번째 시트(SCR-213 게스트 추가, 04 3.2 중첩 — 딤은 한 겹)
type Row = { name: string; gender: '남' | '여'; score: number | null; checked: boolean }

function CheckRow({ r }: { r: Row }) {
  return (
    <li>
      <label data-cmp="CMP-024" className="flex h-14 items-center gap-3 border-b border-line text-body">
        <span data-cmp="CMP-008" aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-sm border-2 ${r.checked ? 'border-action bg-action text-on-action' : 'border-line-strong bg-page'}`}>
          {r.checked && <Check className="size-4" />}
        </span>
        <input type="checkbox" className="sr-only" defaultChecked={r.checked} />
        <span className={r.checked ? 'font-bold text-ink' : 'text-ink'}>{r.name}</span>
        <span className="text-ink-muted">· {r.gender}</span>
        {r.score == null ? (
          <span data-cmp="CMP-005" className="inline-flex h-6 items-center rounded-sm bg-warning-bg px-2 text-caption font-bold text-warning-fg">미설정</span>
        ) : (
          <span className="tabular-nums text-ink">{r.score}점</span>
        )}
      </label>
    </li>
  )
}

export function AttendanceSheet() {
  const a = session.attendance
  return (
    <Sheet title="참석 체크" height="70%" testId="sheet-203">
      <div data-cmp="CMP-028" aria-live="polite" className="sticky top-0 z-10 flex flex-col gap-2 bg-page pb-3">
        <p className="text-body font-bold tabular-nums text-ink">
          참석 {a.total}명 · 남 {a.male} 여 {a.female}
        </p>
        <button type="button" data-cmp="CMP-023" className="flex h-11 items-center gap-2 rounded-md bg-warning-bg px-3 text-body text-warning-fg">
          <TriangleAlert aria-hidden className="size-5" />
          점수 미설정 {a.unset}명
        </button>
        <SearchField placeholder="이름 검색" />
      </div>
      <ul className="border-t border-line">{attendance.members.map((r) => <CheckRow key={r.name} r={r} />)}</ul>
      <div className="-mx-4">
        <GroupHeader label="게스트" />
      </div>
      <ul>{attendance.guests.map((r) => <CheckRow key={r.name} r={r} />)}</ul>
      <button type="button" data-cmp="CMP-001" data-testid="sheet-guest-add" className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-md border border-line-strong text-body font-bold text-ink">
        <Plus aria-hidden className="size-5" />
        게스트 추가
      </button>
    </Sheet>
  )
}

export function Scr203({ stateId, child }: { stateId: string; child?: ReactNode }) {
  return (
    <Scr202
      stateId="SCR-202-ST1"
      scr="SCR-203"
      overlay={
        <div data-st={stateId}>
          {/* 중첩: 첫 시트의 딤 한 겹만 두고, 두 번째 시트(child)는 stacked·딤 없이 위에 겹침(VD-025) */}
          <AttendanceSheet />
          {child}
        </div>
      }
    />
  )
}
