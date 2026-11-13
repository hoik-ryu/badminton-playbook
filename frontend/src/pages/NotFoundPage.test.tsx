import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from './NotFoundPage'

// B0-T4: 범위 밖 공통 화면 SCR-005(페이지 없음)의 화면 상태 태그 테스트. 근거 AC가 없어 AC 증거가 아님(02 SCR-005 '추적').
// 02 SCR-005-ST1 기본: 고정 안내 + '처음 화면으로'(CMP-027 StateView kind=notFound, CMP-001 Button)
function renderNotFound() {
  const router = createMemoryRouter([{ path: '*', element: <NotFoundPage /> }], { initialEntries: ['/no-such-page'] })
  render(<RouterProvider router={router} />)
}

describe('SCR-005 페이지 없음', () => {
  it('[SCR-005-ST1] 고정 안내와 처음 화면으로 링크를 보여 준다', () => {
    renderNotFound()
    expect(screen.getByText('페이지를 찾을 수 없습니다')).toBeInTheDocument()
    const home = screen.getByRole('link', { name: '처음 화면으로' })
    expect(home).toHaveAttribute('href', '/')
    // 대응표의 공통 부품 재사용(CMP-027 notFound, CMP-001)
    expect(document.querySelector('[data-cmp="CMP-027"][data-kind="notFound"]')).not.toBeNull()
    expect(document.querySelector('[data-scr="SCR-005"][data-st="SCR-005-ST1"]')).not.toBeNull()
  })
})
