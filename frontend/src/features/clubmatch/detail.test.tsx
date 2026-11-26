import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { read } from './api'
import { clickNext } from './setup/testkit'

// SCR-112 통합 상세(/club-matches/:matchId, UX Spec r6 UXD-085·087) — Mock
// 같은 머리글·공개 영역 + 운영진에게만 운영 기능 영역(ST9–ST14). 기존 운영 기능 8종(참가자·대진 설정·생성·다시 생성·교체·확정·결과·되돌리기·종료)을 같은 화면에서
function renderAt(path: string, persona: PersonaKey = 'member') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const match = (id: string) => readDb().clubMatches!.find((m) => m.id === id)!
const page = () => document.querySelector('[data-scr="SCR-112"]') as HTMLElement

describe('SCR-112 unified club match detail', () => {
  beforeEach(() => {
    window.localStorage.clear()
    read()
  })

  it('member: public area only, header badges with display status, no ops area', async () => {
    renderAt('/club-matches/cm-1')
    expect(await screen.findByTestId('public-area')).toBeInTheDocument()
    expect(page()).toHaveAttribute('data-role', 'member')
    expect(screen.getByTestId('detail-badges')).toHaveTextContent('팀전진행 중')
    expect(screen.queryByTestId('ops-area')).toBeNull()
    expect(screen.queryByRole('button', { name: '청백전 종료' })).toBeNull()
    expect(screen.queryByRole('link', { name: /관리 화면으로/ })).toBeNull()
  })

  it('SCR-112-ST5 / AC-069: member cannot open a pending match (same as missing)', async () => {
    renderAt('/club-matches/cm-2')
    expect(await screen.findByText('청백전을 찾을 수 없습니다')).toBeInTheDocument()
    expect(page()).toHaveAttribute('data-st', 'SCR-112-ST5')
    expect(document.body).not.toHaveTextContent('연말 청백전')
  })

  it('SCR-112-ST15 / UXD-087: confirmed, date after today (KST), no result → upcoming header', async () => {
    updateDb((db) => {
      const m = db.clubMatches!.find((x) => x.id === 'cm-1')!
      m.date = '2999-12-31'
      m.games.forEach((g) => (g.winner = null))
    })
    renderAt('/club-matches/cm-1')
    expect(await screen.findByTestId('detail-badges')).toHaveTextContent('진행 예정')
    expect(page()).toHaveAttribute('data-st', 'SCR-112-ST15')
  })

  // (B11 대체) 운영진이 준비 중 청백전을 열면 상세 대신 생성 페이지(UX Spec r9 UXD-085 r8·099, AC-131). 회원은 그대로 ST5
  it('admin, pending: the detail address opens the setup page at the computed step, not the ops area', async () => {
    const router = renderAt('/club-matches/cm-2', 'admin')
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches/cm-2/setup/games'))
    expect(screen.queryByTestId('ops-area')).toBeNull()
    expect(screen.queryByTestId('public-area')).toBeNull()
    expect(await screen.findByRole('heading', { name: '대진 설정' })).toBeInTheDocument()
  })

  it('admin, confirmed (ST13): public area above ops area, standings shown once, member detail API not needed', async () => {
    renderAt('/club-matches/cm-1', 'admin')
    const pub = await screen.findByTestId('public-area')
    const ops = screen.getByTestId('ops-area')
    expect(pub.compareDocumentPosition(ops) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ops).toHaveAttribute('data-st', 'SCR-112-ST13')
    expect(screen.getByTestId('ops-visibility')).toHaveTextContent('회원 공개됨')
    expect(screen.getAllByRole('region', { name: '팀 승수' })).toHaveLength(1)
    expect(within(ops).getAllByRole('group', { name: /경기 결과$/ }).length).toBeGreaterThan(0) // 결과 버튼(ST13)
    expect(within(pub).getAllByText('나').length).toBeGreaterThan(0) // 운영 응답으로 그린 공개 영역에도 '나' 표시(운영진도 선수)
    expect(pub).not.toHaveTextContent('실력차') // 공개 영역에는 운영 정보 없음
  })

  // (B11 대체) ①–⑤(참가자·설정·생성·다시 생성·교체)는 생성 페이지(SCR-242·244)에서, ⑥ 확정은 SCR-245에서. ⑦–⑨는 통합 상세 그대로
  it('admin: setup page for participants, settings, generate, regenerate, swap, confirm; unified screen for result, revert, finish', async () => {
    const router = renderAt('/club-matches', 'admin')
    fireEvent.click(await screen.findByRole('button', { name: '새 청백전' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches/new'))
    fireEvent.click(await screen.findByRole('radio', { name: '개인전' }))
    fireEvent.change(screen.getByRole('textbox', { name: '청백전 이름' }), { target: { value: '통합 상세 청백전' } })
    await clickNext()
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/setup\/participants$/))
    const id = router.state.location.pathname.split('/')[2]!
    // ① 참가자
    // (B16) 라운드 기반: 12명·코트 4 → 라운드당 3경기(1라운드에 3경기)
    for (const n of ['김가람', '박다온', '정마루', '권초록', '오아라', '한바다', '신자람', '윤새벽', '정마음', '김민결', '남보람', '유하람']) fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^${n},`) }))
    await clickNext()
    await waitFor(() => expect(Object.keys(match(id).participants)).toHaveLength(12))
    // ② 대진 설정 ③ 대진 생성 ④ 다시 생성
    // (B16) 라운드 기반: 기준 1라운드 = 3경기
    fireEvent.change(await screen.findByRole('textbox', { name: '자동 생성 기준 라운드 수' }), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('su-generate'))
    await waitFor(() => expect(match(id).games).toHaveLength(3))
    expect(match(id).totalGames).toBe(3)
    const seed = match(id).seed
    fireEvent.click(await screen.findByRole('button', { name: '다시 생성' }))
    await waitFor(() => expect(match(id).seed).not.toBe(seed))
    // ⑤ 선수 교체(SCR-225): 시트가 열림
    fireEvent.click((await screen.findAllByRole('button', { name: /^1경기 .* 교체$/ }))[0]!)
    const swap = await screen.findByTestId('club-swap-sheet')
    fireEvent.click(within(swap).getByRole('button', { name: '닫기' }))
    await waitFor(() => expect(screen.queryByTestId('club-swap-sheet')).toBeNull())
    // ⑥ 확정(SCR-245) → 통합 상세, 회원 공개(공개 영역이 운영 영역 위에 나타남)
    await clickNext()
    await clickNext()
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '대진을 확정하고 회원에게 공개할까요?' })).getByRole('button', { name: '확정' }))
    await waitFor(() => expect(match(id).status).toBe('confirmed'))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/club-matches/${id}`))
    expect(await screen.findByTestId('public-area')).toBeInTheDocument()
    expect(screen.getByTestId('ops-visibility')).toHaveTextContent('회원 공개됨')
    // ⑦ 결과 입력
    for (const no of [1, 2, 3]) {
      fireEvent.click(within(await screen.findByRole('group', { name: `${no}경기 결과` })).getByRole('button', { name: '1팀 승' }))
      await waitFor(() => expect(match(id).games.find((g) => g.no === no)!.winner).toBe(1))
    }
    // ⑧ 결과 되돌리기(X4) → 종료 비활성 → 다시 기록
    const c1 = screen.getByRole('article', { name: '1경기' })
    fireEvent.click(within(c1).getByRole('button', { name: '미기록으로 되돌리기' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '되돌리기' }))
    await waitFor(() => expect(match(id).games[0]!.winner).toBeNull())
    expect(await screen.findByRole('button', { name: '청백전 종료' })).toBeDisabled()
    fireEvent.click(within(screen.getByRole('group', { name: '1경기 결과' })).getByRole('button', { name: '2팀 승' }))
    await waitFor(() => expect(match(id).games[0]!.winner).toBe(2))
    // ⑨ 청백전 종료(ST14): 공개 영역의 최종 결과 + 운영 영역에서 결과 수정 가능
    fireEvent.click(await screen.findByRole('button', { name: '청백전 종료' }))
    fireEvent.click(within(await screen.findByRole('alertdialog', { name: '청백전을 종료할까요?' })).getByRole('button', { name: '종료' }))
    await waitFor(() => expect(match(id).status).toBe('finished'))
    await waitFor(() => expect(screen.getByTestId('ops-area')).toHaveAttribute('data-st', 'SCR-112-ST14'))
    expect(screen.getByTestId('detail-badges')).toHaveTextContent('종료')
    expect(within(screen.getByTestId('public-area')).getByRole('region', { name: '최종 순위' })).toBeInTheDocument()
  })

  it('(4단계) 이전 /ops/club-matches/:id 는 운영진에게 이 화면으로 바꿔 보냄(UX Spec r6 01 5장)', async () => {
    const router = renderAt('/ops/club-matches/cm-1', 'admin')
    await waitFor(() => expect(router.state.location.pathname).toBe('/club-matches/cm-1'))
    expect(await screen.findByTestId('ops-area')).toBeInTheDocument()
    expect(document.querySelector('[data-scr="SCR-223"]')).toBeNull()
  })
})
