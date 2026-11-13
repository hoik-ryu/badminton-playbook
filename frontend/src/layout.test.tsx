import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Sheet } from './components/Sheet'
import { setPersona, type PersonaKey } from './features/auth/devPersona'
import { routes } from './routes/router'

// B7(UX Spec r2·Design Direction r2 레이아웃 정합) — AC-050: 회원 화면은 PC(1440)에서도 가운데 최대 600px 한 열.
// 한계: jsdom은 CSS 레이아웃을 계산하지 않으므로 이 테스트는 '정책의 구조'를 검증합니다(토큰 값·셸 열 연결·PC 폭에서도
// 하단 탭·하단 시트·옆 메뉴/옆 패널 없음). 실제 픽셀 폭은 브라우저 확인(수동 증거·브라우저 단계)으로 따로 봅니다.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** PC 폭(1440×900)을 흉내 냄: matchMedia가 min-width 조건을 1440 기준으로 판정 */
function useDesktopViewport() {
  vi.stubGlobal('innerWidth', 1440)
  vi.stubGlobal('innerHeight', 900)
  vi.stubGlobal('matchMedia', (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return { matches: min ? 1440 >= Number(min[1]) : false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }
  })
}

function renderAt(path: string, persona: PersonaKey) {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('AC-050 한 열 최대 600px (UX Spec r2, VD-021)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useDesktopViewport()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('[AC-050] 토큰 size.content.member는 600px이고 셸 열·바깥 배경이 그 토큰과 color.bg.page를 쓴다', () => {
    const tokens = read('./styles/tokens.css')
    expect(tokens).toMatch(/--size-content-member:\s*600px;/)
    const shells = read('./routes/layouts/shells.css')
    expect(shells).toMatch(/--app-column-max:\s*var\(--size-content-member\);/)
    expect(shells).toMatch(/--app-outer-bg:\s*var\(--color-bg-page\);/)
    expect(shells).toMatch(/--app-column-shadow:\s*none;/)
  })

  it('[AC-050] 튜토리얼 홈(SCR-101-ST1)은 PC 폭에서도 한 열 셸과 하단 탭만 쓴다', async () => {
    renderAt('/tutorial', 'member')
    expect(await screen.findByRole('heading', { level: 1, name: '튜토리얼' })).toBeInTheDocument()
    const column = document.querySelector('.app-column[data-shell="member"]')
    expect(column).not.toBeNull()
    const nav = screen.getByRole('navigation', { name: '주 메뉴' })
    expect(nav).toHaveAttribute('data-layout', 'bottom')
    expect(document.querySelectorAll('[data-layout="side"], [data-presentation="side"], [data-presentation="dialog"]')).toHaveLength(0)
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['튜토리얼', '청백전', '마이페이지'])
  })

  it('[AC-050] 마이페이지(SCR-121-ST1)는 PC 폭에서도 한 열 셸과 하단 탭만 쓴다', async () => {
    renderAt('/me', 'member')
    expect(await screen.findByRole('heading', { level: 1, name: '마이페이지' })).toBeInTheDocument()
    expect(document.querySelector('.app-column[data-shell="member"]')).not.toBeNull()
    expect(screen.getByRole('navigation', { name: '주 메뉴' })).toHaveAttribute('data-layout', 'bottom')
    expect(document.querySelectorAll('[data-layout="side"], [data-presentation="side"], [data-presentation="dialog"]')).toHaveLength(0)
  })

  it('[AC-050] 시트는 PC 폭에서도 600px 열 너비의 하단 시트다(CMP-021 presentation=bottom, D2)', () => {
    render(
      <Sheet open title="참석 체크" onRequestClose={() => {}} testId="pc-sheet">
        내용
      </Sheet>,
    )
    const sheet = screen.getByTestId('pc-sheet')
    expect(sheet).toHaveAttribute('data-presentation', 'bottom')
    expect(sheet.className).toContain('max-w-[var(--size-content-member)]')
    expect(sheet.className).toContain('bottom-0')
    expect(sheet.className).toContain('rounded-t-sheet')
  })
})
