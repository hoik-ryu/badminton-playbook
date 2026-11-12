import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'

// CMP-001 Button — 04: variant=primary|secondary|danger|text|kakao, size=md(44)|lg(48), fullWidth, 상태 기본·눌림·비활성·로딩
// 반경 radius.md(10), 글자 body 16 굵게. 포커스 링은 base.css(color.focus.ring)
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-4 text-body font-bold whitespace-nowrap select-none transition-[background-color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed aria-busy:cursor-progress [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-action text-on-action disabled:bg-surface disabled:text-ink-disabled',
        secondary: 'border border-line-strong bg-page text-ink disabled:border-line disabled:text-ink-disabled',
        danger: 'bg-danger-fg text-on-action disabled:bg-surface disabled:text-ink-disabled',
        text: 'bg-transparent px-2 text-action disabled:text-ink-disabled',
        kakao: 'bg-kakao-bg text-kakao-fg disabled:opacity-60',
      },
      size: { md: 'h-11', lg: 'h-12' },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'lg' },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** 로딩: 진행 표시 + 중복 제출 막기 */
    loading?: boolean
    /** 자식(예: Link)을 버튼 모양으로 */
    asChild?: boolean
  }

export function Button({ className, variant, size, fullWidth, loading = false, asChild = false, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-cmp="CMP-001"
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}
