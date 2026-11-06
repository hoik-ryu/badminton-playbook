import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HealthStatus } from './HealthStatus'

describe('HealthStatus', () => {
  it('renders backend health on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ status: 'ok', app: 'app', version: '0.1.0', environment: 'test', database: 'ok' }),
            { status: 200 },
          ),
        ),
      ),
    )
    render(<HealthStatus />)
    expect(await screen.findByTestId('health-status')).toHaveTextContent('ok')
    expect(screen.getByTestId('health-database')).toHaveTextContent('ok')
  })

  it('renders an error when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    render(<HealthStatus />)
    expect(await screen.findByRole('alert')).toHaveTextContent('network_error')
  })
})
