import { AlertDialog } from 'radix-ui'
import { useState } from 'react'

import { Button } from './Button'

// CMP-022 ConfirmDialog — 04: tone=default|danger|conflict, 버튼 1개(충돌 알림 '확인') 또는 2개('취소'·행동 이름), 처리 중(행동 버튼 로딩).
// 접근성: role="alertdialog"(Radix AlertDialog). 처음 포커스는 '취소'(위험·기본) 또는 '확인'(충돌). 행동 버튼은 동사('확정', '삭제')
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  tone?: 'default' | 'danger' | 'conflict'
  /** 행동 버튼 이름(동사). conflict는 '확인' 고정 */
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void | Promise<void>
}

export function ConfirmDialog({ open, onOpenChange, title, description, tone = 'default', confirmLabel = '확인', cancelLabel = '취소', onConfirm }: Props) {
  const [pending, setPending] = useState(false)
  const run = async () => {
    setPending(true)
    try {
      await onConfirm?.()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <AlertDialog.Content data-cmp="CMP-022" data-tone={tone} className="fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100%-32px),400px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-md bg-page p-5 shadow-sheet">
          <AlertDialog.Title className="m-0 text-title font-bold text-ink">{title}</AlertDialog.Title>
          {description ? <AlertDialog.Description className="m-0 text-body text-ink-muted">{description}</AlertDialog.Description> : <AlertDialog.Description className="sr-only">{title}</AlertDialog.Description>}
          <div className="mt-2 flex gap-2">
            {tone === 'conflict' ? (
              <AlertDialog.Action asChild>
                <Button fullWidth onClick={() => void onConfirm?.()}>확인</Button>
              </AlertDialog.Action>
            ) : (
              <>
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary" className="flex-1" disabled={pending}>{cancelLabel}</Button>
                </AlertDialog.Cancel>
                <Button variant={tone === 'danger' ? 'danger' : 'primary'} className="flex-1" loading={pending} onClick={() => void run()}>
                  {confirmLabel}
                </Button>
              </>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
