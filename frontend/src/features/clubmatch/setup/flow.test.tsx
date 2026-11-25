import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { read } from '../api'
import { match, page, renderAt, SCORED, seedDraft, waitSt, clickNext } from './testkit'

// 청백전 생성 페이지 흐름(SCR-241–245, Mock): 팀전 5단계·개인전 4단계 전체, 재진입·이탈 확인

describe('club match setup flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
  })

  it('[AC-122, AC-123, AC-129, AC-130] individual: 4 steps from new to confirmed detail', async () => {
    const router = renderAt('/club-matches/new')
    await waitFor(() => expect(page()).toHaveAttribute('data-st', 'SCR-241-ST7'))
    fireEvent.click(screen.getByRole('radio', { name: '팀전' }))
    expect(screen.getByRole('list', { name: '진행 단계 5개' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '개인전' }))
    expect(screen.getByRole('list', { name: '진행 단계 4개' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '테스트 개인전' } })
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/club-matches\/cm-.*\/setup\/participants$/))
    const id = router.state.location.pathname.split('/')[2]!
    await waitFor(() => expect(document.activeElement).toHaveTextContent('참가자 설정')) // 단계가 바뀌면 단계 제목으로 초점
    for (const n of ['김가람', '박다온', '정마루', '권초록']) fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${n},`) }))
    expect(screen.getByRole('button', { name: /^선택 4명/ })).toBeInTheDocument()
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    expect(Object.keys(match(id).participants)).toHaveLength(4)
    fireEvent.click(await screen.findByTestId('su-generate'))
    await waitFor(() => expect(match(id).games.length).toBe(8))
    await waitFor(() => expect(page()).toHaveAttribute('data-st', 'SCR-244-ST7'))
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/confirm`))
    await clickNext()
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' })).getByRole('button', { name: '확정' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}`))
    expect(match(id).status).toBe('confirmed')
  })
  it('[AC-122, AC-127, AC-135] team: 5 steps from new to confirmed detail with auto assignment', async () => {
    const router = renderAt('/club-matches/new')
    await waitSt('SCR-241-ST7')
    fireEvent.click(screen.getByRole('radio', { name: '팀전' }))
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '테스트 팀전' } })
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/setup\/participants$/))
    const id = router.state.location.pathname.split('/')[2]!
    for (const n of ['김가람', '박다온', '정마루', '권초록', '오아라', '한바다']) fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${n},`) }))
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/teams`))
    await waitSt('SCR-243-ST7')
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/games`))
    fireEvent.click(await screen.findByTestId('su-generate'))
    await waitSt('SCR-244-ST7')
    await clickNext()
    await waitSt('SCR-245-ST1')
    await clickNext()
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '확정' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}`))
    expect(match(id).status).toBe('confirmed')
    expect(Object.values(match(id).participants).every((p) => p.team)).toBe(true)
  })

  it('[SCR-242-ST9] [AC-125, AC-131] unsaved changes: leaving the page asks; staying keeps input; leave discards it', async () => {
    const id = await seedDraft({ method: 'individual', keys: SCORED.slice(0, 4) })
    const router = renderAt(`/club-matches/${id}/setup/participants`)
    await waitSt('SCR-242-ST8')
    fireEvent.click(screen.getByRole('checkbox', { name: /^한바다,/ }))
    await waitSt('SCR-242-ST9')
    fireEvent.click(screen.getByRole('button', { name: '나가기(청백전 목록)' }))
    const dlg = await screen.findByRole('alertdialog', { name: '저장하지 않은 변경이 있습니다' })
    fireEvent.click(within(dlg).getByRole('button', { name: '계속 편집' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(router.state.location.pathname).toBe(`/club-matches/${id}/setup/participants`)
    fireEvent.click(screen.getByRole('button', { name: '나가기(청백전 목록)' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '나가기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches'))
    expect(Object.keys(match(id).participants)).toHaveLength(4)
    expect(page()).toBeNull()
  })
})
