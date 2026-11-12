import { ChevronLeft, Ellipsis, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// CMP-026 PageHeader (leading=back, trailing=actionMenu) + 검색 띠. C안: B안 띠 구조 + A안 상단 '게스트 추가'
export function PageHeader({ title, action }: { title: string; action: string }) {
  return (
    <header data-cmp="CMP-026" className="bg-header-bg text-header-fg">
      <div className="flex h-14 items-center gap-1 px-1">
        <Button variant="ghost" aria-label="뒤로" className="size-11 rounded-md p-0 text-header-fg hover:bg-transparent [&_svg:not([class*='size-'])]:size-6">
          <ChevronLeft aria-hidden />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-heading font-bold">{title}</h1>
        {/* 보이는 높이 36 · 누름 영역 44 (CMP-001 크기 밖: 실험 X10) */}
        <button type="button" data-experimental="C안: 게스트 추가 상단(UXD-026 모바일과 다름), 보이는 높이 36" className="group flex h-11 items-center px-0.5">
          <span className="flex h-9 items-center gap-1.5 rounded-[18px] bg-bg-page pr-3.5 pl-3 text-body font-bold text-action-primary">
            <UserPlus aria-hidden className="size-[18px]" />
            {action}
          </span>
        </button>
        <Button variant="ghost" aria-label="더보기" className="size-11 rounded-md p-0 text-header-fg hover:bg-transparent [&_svg:not([class*='size-'])]:size-6">
          <Ellipsis aria-hidden />
        </Button>
      </div>
      <div data-cmp="CMP-006" className="px-4 pb-3">
        <label className="flex h-11 items-center gap-2 rounded-md border border-border-strong bg-bg-page px-3">
          <Search aria-hidden className="size-5 shrink-0 text-text-secondary" />
          <span className="sr-only">이름 검색</span>
          <Input type="search" placeholder="이름 검색" className="h-auto border-0 bg-transparent p-0 text-body text-text-primary shadow-none placeholder:text-text-secondary focus-visible:ring-0 md:text-body" />
        </label>
      </div>
    </header>
  );
}
