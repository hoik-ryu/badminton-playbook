import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// 테스트에서 실제 네트워크 요청 차단(로컬 개발 서버·원본 DB로 새지 않게).
// 서버 응답이 필요한 테스트는 각자 vi.stubGlobal('fetch', ...)로 대신함(이 기본값을 덮어씀)
export const NETWORK_BLOCKED = 'network blocked in tests'
const describeTarget = (input: unknown) => (input instanceof Request ? input.url : String(input))
const blockedFetch = (input: RequestInfo | URL) => Promise.reject(new TypeError(`${NETWORK_BLOCKED}: ${describeTarget(input)}`))
class BlockedXMLHttpRequest {
  open(_method: string, url: string) {
    throw new Error(`${NETWORK_BLOCKED}: ${url}`)
  }
}
class BlockedWebSocket {
  constructor(url: string) {
    throw new Error(`${NETWORK_BLOCKED}: ${url}`)
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', blockedFetch)
  vi.stubGlobal('XMLHttpRequest', BlockedXMLHttpRequest)
  vi.stubGlobal('WebSocket', BlockedWebSocket)
  vi.stubGlobal('EventSource', BlockedWebSocket)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
