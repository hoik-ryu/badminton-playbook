import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { routes } from './router'

describe('routes', () => {
  it('renders the not found page for unknown paths', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const router = createMemoryRouter(routes, { initialEntries: ['/missing'] })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
