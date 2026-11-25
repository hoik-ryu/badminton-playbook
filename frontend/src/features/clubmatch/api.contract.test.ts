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

// (B10) 단계형 생성 API: 경로·메서드·본문(version, 확인했을 때만 discard)
describe('club match setup API contract (api mode, B10)', () => {
  it('[AC-123, AC-125, AC-127, AC-132, AC-134] basic·participants·teams·settings·games·delete requests', async () => {
    const a = await import('./api')
    await a.saveBasic('m1', 3, { name: '12월 청백전', date: '2026-12-13', method: 'team' })
    await a.saveBasic('m1', 3, { name: '12월 청백전', date: '2026-12-13', method: 'individual' }, true)
    await a.saveParticipants('m1', 3, ['member:u1', 'guest:g1'])
    await a.saveParticipants('m1', 3, ['member:u1'], true)
    await a.saveTeams('m1', 3, { 'member:u1': 'blue', 'guest:g1': 'white' })
    await a.setSettings('m1', 3, { totalGames: 6, rules: { balance: true, gender: true } }, true)
    await a.generateClub('m1', 3, { totalGames: 8, rules: { balance: false, gender: true } })
    await a.setParticipating('m1', 3, 'member:u2', false, true)
    await a.deleteClubMatch('m1', 3)
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'PUT /api/club-matches/m1/basic',
      'PUT /api/club-matches/m1/basic',
      'PUT /api/club-matches/m1/participants',
      'PUT /api/club-matches/m1/participants',
      'PUT /api/club-matches/m1/teams',
      'PUT /api/club-matches/m1/settings',
      'POST /api/club-matches/m1/games',
      'PUT /api/club-matches/m1/participants/member%3Au2',
      'DELETE /api/club-matches/m1?version=3',
    ])
    expect(calls.map((c) => c.body)).toEqual([
      { name: '12월 청백전', date: '2026-12-13', method: 'team', version: 3 },
      { name: '12월 청백전', date: '2026-12-13', method: 'individual', version: 3, discard: true },
      { keys: ['member:u1', 'guest:g1'], version: 3 },
      { keys: ['member:u1'], version: 3, discard: true },
      { assignments: { 'member:u1': 'blue', 'guest:g1': 'white' }, version: 3 },
      { totalGames: 6, rules: { balance: true, gender: true }, version: 3, discard: true },
      { version: 3, totalGames: 8, rules: { balance: false, gender: true } },
      { participating: false, version: 3, discard: true },
      undefined,
    ])
  })

  it('[AC-123] server name rule error is read as the name field message', async () => {
    const a = await import('./api')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'validation_error', message: 'Request validation failed', details: [{ type: 'value_error', loc: ['body', 'name'], msg: 'Value error, 이름은 30자 이내로 입력해 주세요' }] } }), { status: 422, headers: { 'Content-Type': 'application/json' } })))
    const e = await a.saveBasic('m1', 3, { name: '가'.repeat(31), date: '2026-12-13', method: 'team' }).catch((x: unknown) => x)
    expect(a.nameErrorOf(e)).toBe('이름은 30자 이내로 입력해 주세요')
    expect(a.nameProblem('  ')).toBe('이름을 입력해 주세요')
    expect(a.nameProblem(` ${'가'.repeat(30)} `)).toBeNull()
  })
})
