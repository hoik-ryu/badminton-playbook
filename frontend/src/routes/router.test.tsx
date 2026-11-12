import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setPersona, type PersonaKey } from '../features/auth/devPersona'
import { readDb } from '../lib/mock/db'
import { safeNext } from './guards'
import { routes } from './router'

// 접근 규칙(01 IA 4·5장)을 Mock 역할로 확인합니다.
function renderAt(path: string, persona: PersonaKey = 'guest') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const landsOn = async (router: ReturnType<typeof renderAt>, path: string) => waitFor(() => expect(router.state.location.pathname).toBe(path))

describe('routes and access rules', () => {
  beforeEach(() => window.localStorage.clear())

  it('sends a signed-out visitor from / to the login screen (SCR-001)', async () => {
    const router = renderAt('/')
    await landsOn(router, '/login')
    expect(await screen.findByRole('heading', { name: 'SMAPSH' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument()
  })

  it('remembers the original address when a signed-out visitor opens a protected screen', async () => {
    const router = renderAt('/ops')
    await landsOn(router, '/login')
    expect(router.state.location.search).toBe('?next=%2Fops')
  })

  it('sends signed-in members to the tutorial home (SCR-101) with the bottom tab', async () => {
    const router = renderAt('/', 'member')
    await landsOn(router, '/tutorial')
    expect(await screen.findByRole('heading', { name: '튜토리얼' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: '주 메뉴' })
    expect(nav).toHaveTextContent('마이페이지')
    expect(nav).not.toHaveTextContent('운영')
  })

  it('returns to the original address after login checks', async () => {
    const router = renderAt('/login?next=%2Fme', 'member')
    await landsOn(router, '/me')
  })

  it('sends restricted accounts to the account status screen (SCR-003)', async () => {
    const router = renderAt('/tutorial', 'pending')
    await landsOn(router, '/account-status')
  })

  it('blocks members from ops screens (SCR-004)', async () => {
    const router = renderAt('/ops', 'member')
    await landsOn(router, '/forbidden')
    expect(await screen.findByText('접근 권한이 없습니다')).toBeInTheDocument()
  })

  it('lets admins into ops but keeps role management for super admins', async () => {
    const admin = renderAt('/ops', 'admin')
    await landsOn(admin, '/ops')
    const menu = await screen.findByRole('list', { name: '운영 메뉴' })
    expect(menu).toHaveTextContent('가입 승인')
    expect(menu).not.toHaveTextContent('역할 관리') // 슈퍼 관리자만(AC-003)
  })

  it('blocks admins from role management and allows super admins', async () => {
    const admin = renderAt('/ops/roles', 'admin')
    await landsOn(admin, '/forbidden')
  })

  it('allows super admins into role management', async () => {
    const sup = renderAt('/ops/roles', 'superAdmin')
    await landsOn(sup, '/ops/roles')
  })

  it('keeps the backend status check on the dev path', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderAt('/dev/health')
    expect(await screen.findByRole('heading', { name: 'Backend status' })).toBeInTheDocument()
  })

  it('renders the not found screen (SCR-005) for unknown paths', async () => {
    renderAt('/missing')
    expect(await screen.findByText('페이지를 찾을 수 없습니다')).toBeInTheDocument()
  })
})

describe('safeNext', () => {
  it('allows only in-service paths', () => {
    expect(safeNext('/club-matches/3')).toBe('/club-matches/3')
    for (const bad of [null, '', 'https://evil.example', '//evil.example', '/\\evil']) expect(safeNext(bad)).toBeNull()
  })

  it('SCR-121 / AC-005: logout from My Page (Mock) ends the session and protected screens stay closed', async () => {
    const router = renderAt('/me', 'admin')
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-121]')).toHaveTextContent('박다온 · 남 · 급수 A조'))
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    await landsOn(router, '/login')
    expect(readDb().session).toBeNull()
    // 뒤로 가기·직접 접근 모두 다시 로그인으로(loader가 매번 세션 확인)
    await router.navigate(-1)
    await landsOn(router, '/login')
    await router.navigate('/ops')
    await landsOn(router, '/login')
    expect(router.state.location.search).toBe('?next=%2Fops')
    // Mock 인증 흐름은 그대로: 다시 카카오로 시작하기 → 기존 계정으로 로그인
    expect(await screen.findByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument()
  })
})
