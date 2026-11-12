import { describe, expect, it, vi } from 'vitest'

import { api, apiBaseUrl } from '../lib/api'
import { featureSource } from '../lib/data/source'

// 테스트 격리: 로컬 frontend/.env(예: VITE_API_BASE_URL=http://localhost:8000)와 무관하게
// 테스트는 같은 출처 경로·Mock을 쓰고, 스텁하지 않은 실제 네트워크 요청은 차단된다.
describe('test isolation', () => {
  it('ignores the local .env API address and data source', () => {
    expect(import.meta.env.VITE_API_BASE_URL).toBe('')
    expect(apiBaseUrl).toBe('')
    expect(featureSource('clubmatch')).toBe('mock')
  })

  it('blocks unstubbed fetch (reported as network_error, never sent)', async () => {
    await expect(api.get('/api/auth/me')).rejects.toMatchObject({ status: 0, code: 'network_error', details: expect.stringContaining('network blocked in tests') })
    await expect(fetch('http://localhost:8000/health')).rejects.toThrow('network blocked in tests: http://localhost:8000/health')
  })

  it('blocks XMLHttpRequest and WebSocket too', () => {
    expect(() => new XMLHttpRequest().open('GET', 'http://localhost:8000/api')).toThrow('network blocked in tests')
    expect(() => new WebSocket('ws://localhost:8000/ws')).toThrow('network blocked in tests')
  })

  it('a test can still provide its own fetch stub', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await expect(api.get('/api/x')).resolves.toEqual({ ok: true })
  })
})
