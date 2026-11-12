import { describe, expect, it } from 'vitest'

import { decideIntro, INTRO_SEEN_KEY } from './introPolicy'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data }
}

const base = { pathname: '/', search: '', reducedMotion: false, dev: false }

describe('decideIntro', () => {
  it('plays once on the first visit to the root path', () => {
    expect(decideIntro({ ...base, storage: memoryStorage() })).toEqual({ play: true, reason: 'first-visit' })
  })

  it('skips after it was seen (refresh, revisit)', () => {
    expect(decideIntro({ ...base, storage: memoryStorage({ [INTRO_SEEN_KEY]: '1' }) }).reason).toBe('seen')
  })

  it('skips on direct links and auth callback landing paths', () => {
    for (const pathname of ['/login', '/signup', '/tutorial', '/club-matches/12', '/account-status']) {
      expect(decideIntro({ ...base, pathname, storage: memoryStorage() })).toEqual({ play: false, reason: 'deep-link' })
    }
  })

  it('skips with reduced motion and remembers it', () => {
    const storage = memoryStorage()
    expect(decideIntro({ ...base, reducedMotion: true, storage }).reason).toBe('reduced-motion')
    expect(storage.data[INTRO_SEEN_KEY]).toBe('1')
  })

  it('skips when storage is unavailable or the environment is unsupported', () => {
    expect(decideIntro({ ...base, storage: null }).reason).toBe('storage-unavailable')
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => {} }
    expect(decideIntro({ ...base, storage: throwing }).reason).toBe('storage-unavailable')
    expect(decideIntro({ ...base, reducedMotion: null, storage: memoryStorage() }).reason).toBe('unsupported')
  })

  it('allows a forced replay only in development builds', () => {
    const seen = memoryStorage({ [INTRO_SEEN_KEY]: '1' })
    expect(decideIntro({ ...base, pathname: '/login', search: '?intro=replay', dev: true, storage: seen }).play).toBe(true)
    expect(decideIntro({ ...base, search: '?intro=replay', dev: false, storage: seen }).play).toBe(false)
  })
})
