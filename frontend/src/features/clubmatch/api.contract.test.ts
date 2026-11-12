import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// I3-d3: api 모드 요청 형태가 서버 계약(backend/app/modules/clubmatch/router.py·member.py)과 같은지.
// 실제 전환(BACKEND_READY에 clubmatch)은 I3-d4 — 여기서는 출처만 바꿔 요청 경로·메서드·본문(version 포함)과 응답 사용을 확인합니다.
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
      return new Response(JSON.stringify(VIEW), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('club match API contract (api mode)', () => {
  it('ops changes send the seen version and return the server view', async () => {
    const a = await import('./api')
    const results = [
      await a.setMethod('m1', 3, 'team'),
      await a.setSettings('m1', 3, { totalGames: 6, rules: { balance: true, gender: false } }),
      await a.setParticipating('m1', 3, 'member:u1', true),
      await a.setTeam('m1', 3, 'guest:g1', null),
      await a.applyTeamProposal('m1', 3),
      await a.generateClub('m1', 3),
      await a.confirmClub('m1', 3),
      await a.recordResult('m1', 3, 2, null),
      await a.finishClub('m1', 3),
      await a.swapClub('m1', 3, 4, 'member:u1', 'member:u2'),
      await a.excludeWithSubstitutes('m1', 3, 'member:u1', [{ gameNo: 4, to: 'member:u2' }]),
    ]
    expect(results.every((r) => r.version === 8)).toBe(true)
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'PUT /api/club-matches/m1/method',
      'PUT /api/club-matches/m1/settings',
      'PUT /api/club-matches/m1/participants/member%3Au1',
      'PUT /api/club-matches/m1/teams/guest%3Ag1',
      'POST /api/club-matches/m1/teams/propose',
      'POST /api/club-matches/m1/games',
      'POST /api/club-matches/m1/confirm',
      'PUT /api/club-matches/m1/games/2/result',
      'POST /api/club-matches/m1/finish',
      'POST /api/club-matches/m1/games/4/swap',
      'POST /api/club-matches/m1/participants/member%3Au1/leave',
    ])
    expect(calls.every((c) => (c.body as { version?: number }).version === 3)).toBe(true)
    expect(calls.map((c) => c.body)).toEqual([
      { method: 'team', version: 3 },
      { totalGames: 6, rules: { balance: true, gender: false }, version: 3 },
      { participating: true, version: 3 },
      { team: null, version: 3 },
      { version: 3 },
      { version: 3 },
      { version: 3 },
      { winner: null, version: 3 },
      { version: 3 },
      { from: 'member:u1', to: 'member:u2', version: 3 },
      { assignments: [{ gameNo: 4, to: 'member:u2' }], version: 3 },
    ])
  })

  it('member and record reads use the member-only endpoints', async () => {
    const m = await import('./memberApi')
    const me = await import('../me/api')
    await m.listPublicClubMatches()
    await m.getPublicClubMatch('m1', 'ignored-on-server')
    await me.getMyRecord('ignored-on-server')
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /api/member/club-matches', 'GET /api/member/club-matches/m1', 'GET /api/me/record'])
  })
})

describe('auth errors reach the screens as ApiError (api mode)', () => {
  it.each([
    [401, 'unauthenticated', '로그인이 필요합니다'],
    [403, 'forbidden', '권한이 없습니다'],
  ])('%i %s', async (status, code, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code, message, details: null } }), { status, headers: { 'Content-Type': 'application/json' } })))
    const a = await import('./api')
    const m = await import('./memberApi')
    const me = await import('../me/api')
    for (const p of [a.getClubMatchView('x'), a.recordResult('x', 1, 1, null), m.listPublicClubMatches(), me.getMyRecord('x')]) {
      await expect(p).rejects.toMatchObject({ status, code })
    }
  })
})
