import { describe, expect, it, vi } from 'vitest'

import { apiRequest } from './client'
import { ApiError } from './errors'

function mockFetch(response: Response | Error) {
  const fn = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)))
  vi.stubGlobal('fetch', fn)
  return fn
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('apiRequest', () => {
  it('returns parsed JSON on success', async () => {
    const fetchFn = mockFetch(json({ ok: true }))
    await expect(apiRequest('/x')).resolves.toEqual({ ok: true })
    expect(fetchFn).toHaveBeenCalledWith(expect.stringMatching(/\/x$/), expect.any(Object))
  })

  it('throws ApiError from the backend error envelope', async () => {
    mockFetch(json({ error: { code: 'conflict', message: 'Already exists' } }, 409))
    const error = await apiRequest('/x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 'conflict', message: 'Already exists' })
  })

  it('falls back to http_<status> for non-envelope errors', async () => {
    mockFetch(new Response('boom', { status: 500, statusText: 'Internal Server Error' }))
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 500, code: 'http_500' })
  })

  it('maps network failures to network_error', async () => {
    mockFetch(new TypeError('Failed to fetch'))
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('serializes JSON bodies', async () => {
    const fetchFn = mockFetch(json({}))
    await apiRequest('/x', { method: 'POST', body: { a: 1 } })
    const init = fetchFn.mock.calls[0]?.[1] as RequestInit | undefined
    expect(init?.body).toBe('{"a":1}')
  })
})
