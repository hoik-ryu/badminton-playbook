import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { setPersona, type PersonaKey } from '../features/auth/devPersona'
import { routes } from './router'

// 청백전 4단계(UX Spec r6 01 3·5장, UXD-085): 최종 주소 /club-matches·/club-matches/:matchId, 이전 운영 주소 정리, SCR-201 링크, 하단 탭 글자색(DD r8)
function renderAt(paths: string[] | string, persona: PersonaKey) {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: Array.isArray(paths) ? paths : [paths], initialIndex: Array.isArray(paths) ? paths.length - 1 : 0 })
  render(<RouterProvider router={router} />)
  return router
}
type R = ReturnType<typeof renderAt>
const at = (router: R) => router.state.location.pathname + router.state.location.search
const landsOn = (router: R, path: string) => waitFor(() => expect(at(router)).toBe(path))
const scr = () => document.querySelector('[data-scr]')
const text = (a: HTMLElement) => a.querySelector(':scope > span:last-child')!.textContent // 탭 레이블(운영 탭 승인 대기 배지 숫자 제외)

describe('club match routes (4단계)', () => {
  beforeEach(() => window.localStorage.clear())

  it('운영진: /ops/club-matches → /club-matches(SCR-111), 기록을 바꾸는 이동이라 뒤로 가기는 이전 화면', async () => {
    const router = renderAt('/ops', 'admin')
    await screen.findByRole('heading', { name: '운영' })
    await router.navigate('/ops/club-matches')
    await landsOn(router, '/club-matches')
    await waitFor(() => expect(scr()).toHaveAttribute('data-scr', 'SCR-111'))
    expect(scr()).toHaveAttribute('data-role', 'admin')
    await router.navigate(-1)
    await landsOn(router, '/ops') // 이전 주소(/ops/club-matches)는 기록에 남지 않음
  })

  it('운영진: /ops/club-matches/:id → /club-matches/:id(SCR-112), 쿼리 유지', async () => {
    const router = renderAt('/ops/club-matches/cm-1?from=bookmark&x=1', 'admin')
    await landsOn(router, '/club-matches/cm-1?from=bookmark&x=1')
    expect(await screen.findByTestId('ops-area')).toBeInTheDocument()
    expect(scr()).toHaveAttribute('data-scr', 'SCR-112')
  })

  it('운영진: 준비 중 청백전의 이전 주소도 통합 상세로(운영 영역만)', async () => {
    const router = renderAt('/ops/club-matches/cm-2', 'admin')
    await landsOn(router, '/club-matches/cm-2')
    expect(await screen.findByTestId('ops-area')).toHaveAttribute('data-st', 'SCR-112-ST10')
  })

  it.each([['/ops/club-matches'], ['/ops/club-matches/cm-1'], ['/ops/club-matches/cm-2?x=1']])('회원: 이전 운영 주소 %s 는 지금처럼 /forbidden(SCR-004)', async (path) => {
    const router = renderAt(path, 'member')
    await landsOn(router, '/forbidden')
    expect(await screen.findByText('접근 권한이 없습니다')).toBeInTheDocument()
  })

  it('비로그인·제한 계정: 권한 확인이 먼저(로그인으로 원래 주소 기억 / 계정 상태)', async () => {
    const guest = renderAt('/ops/club-matches/cm-1', 'guest')
    await landsOn(guest, '/login?next=%2Fops%2Fclub-matches%2Fcm-1')
  })

  it('제한 계정: /ops/club-matches → /account-status', async () => {
    const router = renderAt('/ops/club-matches', 'pending')
    await landsOn(router, '/account-status')
  })

  it('SCR-201: 청백전 관리 → /club-matches', async () => {
    const router = renderAt('/ops', 'admin')
    const menu = await screen.findByRole('list', { name: '운영 메뉴' })
    const link = within(menu).getByRole('link', { name: '청백전 관리' })
    expect(link).toHaveAttribute('href', '/club-matches')
    // 다른 관리 링크는 그대로
    expect(within(menu).getByRole('link', { name: '오늘 운동' })).toHaveAttribute('href', '/ops/session')
    expect(within(menu).getByRole('link', { name: '명단' })).toHaveAttribute('href', '/ops/roster')
    fireEvent.click(link)
    await landsOn(router, '/club-matches')
    await waitFor(() => expect(scr()).toHaveAttribute('data-scr', 'SCR-111'))
  })

  it.each([['member' as const], ['admin' as const]])('%s: 목록 → 상세 → 머리글 뒤로 → 목록', async (persona) => {
    const router = renderAt('/club-matches', persona)
    const card = await waitFor(() => {
      const a = document.querySelector('a[data-match=cm-1]')
      expect(a).not.toBeNull()
      return a as HTMLAnchorElement
    })
    expect(card).toHaveAttribute('href', '/club-matches/cm-1')
    fireEvent.click(card)
    await landsOn(router, '/club-matches/cm-1')
    await waitFor(() => expect(scr()).toHaveAttribute('data-scr', 'SCR-112'))
    expect(scr()).toHaveAttribute('data-role', persona)
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    await landsOn(router, '/club-matches')
    await router.navigate(-1) // 브라우저 뒤로 가기도 목록·상세 기록을 따라감
    await landsOn(router, '/club-matches/cm-1')
  })

  it('회원: 준비 중 청백전은 목록에 없고 직접 주소로도 찾을 수 없음(AC-069)', async () => {
    renderAt('/club-matches', 'member')
    await waitFor(() => expect(document.querySelector('a[data-match=cm-1]')).not.toBeNull())
    expect(document.querySelector('a[data-match=cm-2]')).toBeNull()
    const router = renderAt('/club-matches/cm-2', 'member')
    expect(await screen.findAllByText('청백전을 찾을 수 없습니다')).not.toHaveLength(0)
    expect(at(router)).toBe('/club-matches/cm-2')
  })
})

// CMP-025 하단 탭: 회원 3탭·운영진 4탭 그대로. 현재 탭 글자 = color.text.accent(text-ink-accent), 아이콘·표시 막대 = color.action.primary, 비활성 = text-ink-muted
describe('bottom tab active state (DD r8 color.text.accent)', () => {
  beforeEach(() => window.localStorage.clear())

  const tabs = async () => {
    const nav = await screen.findByRole('navigation', { name: '주 메뉴' })
    return within(nav).getAllByRole('link')
  }
  const expectActive = (links: HTMLElement[], label: string) => {
    for (const a of links) {
      const on = text(a) === label
      const labelEl = a.querySelector(':scope > span:last-child')!
      const icon = a.querySelector('svg')!
      const bar = a.parentElement!.querySelector(':scope > span[aria-hidden]')
      if (on) {
        expect(a).toHaveAttribute('aria-current', 'page')
        expect(a).toHaveClass('font-bold', 'text-ink-accent')
        expect(a).not.toHaveClass('text-action')
        expect(icon).toHaveClass('text-action')
        expect(bar).toHaveClass('bg-action')
      } else {
        expect(a).not.toHaveAttribute('aria-current')
        expect(a).toHaveClass('text-ink-muted')
        expect(icon).not.toHaveClass('text-action')
        expect(bar).toBeNull()
      }
      expect(labelEl).toHaveClass('text-caption') // 글자 크기 그대로
    }
  }

  it('회원 3탭: 청백전 목록·상세에서 청백전 탭이 현재 탭', async () => {
    renderAt('/club-matches', 'member')
    let links = await tabs()
    expect(links.map((a) => a.textContent)).toEqual(['튜토리얼', '청백전', '마이페이지'])
    expectActive(links, '청백전')
    renderAt('/club-matches/cm-1', 'member')
    links = (await screen.findAllByRole('navigation', { name: '주 메뉴' })).at(-1)!.querySelectorAll('a') as unknown as HTMLElement[]
    expectActive([...links], '청백전')
  })

  it('회원: 튜토리얼·마이페이지 탭(청백전 밖 화면)도 같은 규칙', async () => {
    renderAt('/me', 'member')
    expectActive(await tabs(), '마이페이지')
  })

  it('운영진 4탭: 청백전 화면은 청백전 탭, /ops는 운영 탭', async () => {
    renderAt('/club-matches/cm-1', 'admin')
    const links = await tabs()
    expect(links.map(text)).toEqual(['튜토리얼', '청백전', '마이페이지', '운영'])
    expectActive(links, '청백전')
  })

  it('운영진: /ops 에서는 운영 탭이 현재 탭', async () => {
    renderAt('/ops', 'admin')
    await screen.findByRole('heading', { name: '운영' })
    expectActive(await tabs(), '운영')
  })
})
