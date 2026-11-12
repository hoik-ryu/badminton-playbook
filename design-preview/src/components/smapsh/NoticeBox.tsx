import { Info } from 'lucide-react'

// CMP-023 NoticeBox tone=info. 아이콘 + 글자, role=status(04)
export function NoticeBox({ children }: { children: string }) {
  return (
    <div data-cmp="CMP-023" role="status" className="flex items-start gap-2 rounded-md bg-info-bg p-3 text-body text-ink">
      <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
