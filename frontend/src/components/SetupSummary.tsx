import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'

// CMP-056 SetupSummary — 04 r8, Design Direction r12 VD-067. 묶음 제목 + '수정'(Pencil) + 행(왼쪽 아이콘·항목 이름·오른쪽 값·보조 줄)
export type SummaryRow = { icon: ReactNode; label: string; value: ReactNode; sub?: string[] }

export function SetupSummary({ title, onEdit, rows }: { title: string; onEdit: () => void; rows: SummaryRow[] }) {
  return (
    <section className="su-sum-group" data-cmp="CMP-056" aria-label={title}>
      <div className="su-sum-head">
        <h3>{title}</h3>
        <button type="button" className="su-edit" onClick={onEdit} aria-label={`${title} 수정`}>
          <Pencil aria-hidden />
          수정
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="su-kv">
          {r.icon}
          <span>{r.label}</span>
          <b>
            {r.value}
            {r.sub?.map((x) => <small key={x}>{x}</small>)}
          </b>
        </div>
      ))}
    </section>
  )
}
