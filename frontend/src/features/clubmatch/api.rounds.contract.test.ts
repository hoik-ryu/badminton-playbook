import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// (B15) api 모드 라운드 요청이 서버 계약(backend/app/modules/clubmatch/router.py·schemas.py)과 같은지: 경로·메서드·본문(version 포함)
vi.mock('../../lib/data/source', async (orig) => ({ ...(await orig<typeof import('../../lib/data/source')>()), featureSource: () => 'api' }))

type Call = { method: string; path: string; body: unknown }
let calls: Call[] = []
const VIEW = { id: 'x', version: 8, games: [] }

beforeEach(() => {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ method: init.method ?? 'GET', path: String(url).replace(/^https?:\/\/[^/]+/, ''), body: init.body ? JSON.parse(String(init.body)) : undefined })
      return new Response(JSON.stringify(init.method === 'POST' && String(url).endsWith('/api/club-matches') ? { id: 'new' } : VIEW), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('club match rounds API contract (api mode, B15)', () => {
  it('[AC-144, AC-149, AC-152, AC-155, AC-156, AC-159, AC-164] round requests use the server paths and bodies', async () => {
    const a = await import('./api')
    const rules = { balance: true, gender: false }
    expect(await a.createClubMatch({ method: 'team', date: '2026-12-20', name: '라운드', courtCount: 3 })).toBe('new')
    await a.saveBasic('m1', 3, { name: '라운드', date: '2026-12-20', method: 'team', courtCount: 2 }, true)
    await a.setSettings('m1', 3, { rounds: 5, rules })
    await a.generateClub('m1', 3, { rounds: 5, rules })
    await a.addClubGame('m1', 3, ['member:a', 'member:b'], ['member:c', 'member:d'], 2)
    await a.addClubGame('m1', 3, ['member:a', 'member:b'], ['member:c', 'member:d'])
    await a.moveClubGame('m1', 3, 4, 1)
    await a.nextRound('m1', 3)
    await a.undoRound('m1', 3)
    await a.excludeWithSubstitutes('m1', 3, 'member:a', [{ gameNo: 4, to: 'member:e' }], [2])
    await a.excludeWithSubstitutes('m1', 3, 'member:a', [{ gameNo: 4, to: 'member:e' }])
    await a.restoreClubGame('m1', 3, 2, { 'member:a': 'member:f' })
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/club-matches',
      'PUT /api/club-matches/m1/basic',
      'PUT /api/club-matches/m1/settings',
      'POST /api/club-matches/m1/games',
      'POST /api/club-matches/m1/games/manual',
      'POST /api/club-matches/m1/games/manual',
      'POST /api/club-matches/m1/games/4/move',
      'POST /api/club-matches/m1/rounds/next',
      'POST /api/club-matches/m1/rounds/undo',
      'POST /api/club-matches/m1/participants/member%3Aa/leave',
      'POST /api/club-matches/m1/participants/member%3Aa/leave',
      'POST /api/club-matches/m1/games/2/restore',
    ])
    expect(calls.map((c) => c.body)).toEqual([
      { method: 'team', date: '2026-12-20', name: '라운드', courtCount: 3 },
      { name: '라운드', date: '2026-12-20', method: 'team', courtCount: 2, version: 3, discard: true },
      { rounds: 5, rules, version: 3 },
      { version: 3, rounds: 5, rules },
      { team1: ['member:a', 'member:b'], team2: ['member:c', 'member:d'], version: 3, round: 2 },
      { team1: ['member:a', 'member:b'], team2: ['member:c', 'member:d'], version: 3 }, // 라운드 정보 없는 청백전: 기존 본문 그대로
      { round: 1, version: 3 },
      { version: 3 },
      { version: 3 },
      { assignments: [{ gameNo: 4, to: 'member:e' }], version: 3, cancel: [2] },
      { assignments: [{ gameNo: 4, to: 'member:e' }], version: 3 }, // 취소 없으면 기존 본문 그대로
      { replacements: { 'member:a': 'member:f' }, version: 3 },
    ])
  })
})
