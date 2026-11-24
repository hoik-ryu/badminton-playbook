import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { FilterChip } from './FilterChip'
import { ChoiceGrid, SegmentedControl } from './RadioButtons'
import { Switch } from './Switch'

// Design Direction r9 4.1 · Preview r6 승인 규칙(Soft Mint)의 공통 부품 색 역할.
// 쓰지 않는 조합: Main Mint 단독 글자·아이콘(1.97:1), 흰 글자 대 Main Mint(1.99:1), Main Mint 상태 채움(비텍스트 1.97:1)
describe('Soft Mint component color roles (DD r9 4.1)', () => {
  it('CMP-001 primary lg = Main Mint + dark text; md(작은 주 버튼) = page + text.accent border', () => {
    render(
      <>
        <Button>큰 버튼</Button>
        <Button size="md">작은 버튼</Button>
      </>,
    )
    const lg = screen.getByRole('button', { name: '큰 버튼' })
    expect(lg).toHaveClass('bg-action', 'text-on-action')
    const md = screen.getByRole('button', { name: '작은 버튼' })
    expect(md).toHaveClass('border-ink-accent', 'bg-page', 'text-ink-accent')
    expect(md).not.toHaveClass('bg-action')
  })

  it('CMP-001 danger keeps white text (onStrong) and text variant uses text.accent', () => {
    render(
      <>
        <Button variant="danger">삭제</Button>
        <Button variant="text">더 보기</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: '삭제' })).toHaveClass('bg-danger-fg', 'text-on-strong')
    const text = screen.getByRole('button', { name: '더 보기' })
    expect(text).toHaveClass('text-ink-accent')
    expect(text).not.toHaveClass('text-action')
  })

  it('CMP-002·003 selection = Light Mint + text.accent + check', () => {
    render(
      <>
        <SegmentedControl label="방식" options={['팀전', '개인전'] as const} value="팀전" onChange={() => {}} />
        <ChoiceGrid label="점수" kind="score" options={['1', '2'] as const} value="2" onChange={() => {}} />
      </>,
    )
    for (const name of ['팀전', '2']) {
      const on = screen.getByRole('radio', { name })
      expect(on).toHaveAttribute('aria-checked', 'true')
      expect(on).toHaveClass('border-ink-accent', 'bg-mint-subtle', 'text-ink-accent')
      expect(on).not.toHaveClass('bg-action')
      expect(on.querySelector('svg')).not.toBeNull()
    }
  })

  it('CMP-004 pressed chip = Light Mint + text.accent', () => {
    render(<FilterChip label="점수 미설정" count={3} pressed onToggle={() => {}} />)
    const chip = screen.getByRole('button', { pressed: true })
    expect(chip).toHaveClass('border-ink-accent', 'bg-mint-subtle', 'text-ink-accent')
  })

  it('CMP-007 Switch on and CMP-008 Checkbox checked use action.strong (사용자 승인 2026-11-24)', () => {
    render(
      <>
        <Switch label="비활성 포함" checked onCheckedChange={() => {}} />
        <Checkbox label="참석" checked onChange={() => {}} />
      </>,
    )
    const sw = screen.getByRole('switch', { name: '비활성 포함' })
    expect(sw.className).toContain('data-[state=checked]:bg-strong')
    expect(sw.className).not.toContain('bg-action')
    const box = screen.getByRole('checkbox', { name: '참석' })
    expect(box.className).toContain('checked:bg-strong')
    expect(box.className).not.toContain('bg-action')
    expect(box.parentElement!.querySelector('svg')).toHaveClass('text-on-strong')
  })
})
