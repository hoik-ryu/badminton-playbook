import { Search } from 'lucide-react'
import { Input } from '../ui/input'

// CMP-006 TextField type=search. 높이 44, 글자 16(모바일 확대 방지)
export function SearchField({ placeholder }: { placeholder: string }) {
  return (
    <label data-cmp="CMP-006" className="flex h-11 items-center gap-2 rounded-md border border-line-strong bg-page px-3">
      <Search aria-hidden className="size-5 shrink-0 text-ink-muted" />
      <span className="sr-only">{placeholder}</span>
      <Input type="search" placeholder={placeholder} className="h-auto border-0 bg-transparent p-0 text-[length:var(--font-size-body)] text-ink shadow-none placeholder:text-ink-muted focus-visible:ring-0 md:text-[length:var(--font-size-body)]" />
    </label>
  )
}
