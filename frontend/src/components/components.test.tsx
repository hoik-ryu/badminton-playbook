import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Badge } from './Badge'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { NoticeBox } from './NoticeBox'
import { StateView } from './StateView'

describe('core components', () => {
  it('Button shows loading and blocks duplicate submit (CMP-001)', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>저장</Button>)
    const btn = screen.getByRole('button', { name: '저장' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('NoticeBox uses alert for danger and status otherwise (CMP-023)', () => {
    render(<><NoticeBox tone="danger">실패</NoticeBox><NoticeBox>안내</NoticeBox></>)
    expect(screen.getByRole('alert')).toHaveTextContent('실패')
    expect(screen.getByRole('status')).toHaveTextContent('안내')
  })

  it('StateView loading is aria-busy (CMP-027)', () => {
    render(<StateView kind="loading" />)
    expect(screen.getByLabelText('불러오는 중')).toHaveAttribute('aria-busy', 'true')
  })

  it('Badge always carries text (CMP-005)', () => {
    render(<Badge tone="warning">미설정</Badge>)
    expect(screen.getByText('미설정')).toBeInTheDocument()
  })

  it('ConfirmDialog is an alertdialog, focuses cancel first, and runs the action (CMP-022)', async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="삭제할까요?" tone="danger" confirmLabel="삭제" onConfirm={onConfirm} />)
    expect(screen.getByRole('alertdialog', { name: '삭제할까요?' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '취소' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
