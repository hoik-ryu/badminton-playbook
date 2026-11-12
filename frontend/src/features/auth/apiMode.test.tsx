import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { getMe, startKakaoLogin } from './api'

// 실제 API 모드(VITE_DATA_SOURCE=api): 인증·승인·역할·본인 프로필·명단·튜토리얼·청백전은 서버, 오늘 운동(session)은 Mock 유지(lib/data/source.ts BACKEND_READY와 같게)
vi.mock('../../lib/data/source', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/data/source')>()
  return {
    ...actual,
    dataSource: 'api',
    featureSource: (f: string) => (['auth', 'approval', 'role', 'profile', 'roster', 'tutorial', 'clubmatch'].includes(f) ? 'api' : 'mock'),
  }
})

type Me = { id: string; name: string; role: string; status: string }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const unauth = () => json({ error: { code: 'unauthenticated', message: '로그인이 필요합니다' } }, 401)

/** 서버 흉내: 세션의 사용자(me)와 승인 대기 목록 */
function stubServer(me: Me | null, applicants: unknown[] = []) {
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost:5173').pathname // VITE_API_BASE_URL 유무와 무관하게 경로로 비교
    expect(init?.credentials).toBe('include') // httpOnly 세션 쿠키 포함
    if (url === '/api/auth/me') return Promise.resolve(me ? json(me) : unauth())
    if (url === '/api/approvals/count') return Promise.resolve(json({ count: applicants.length }))
    if (url === '/api/approvals') return Promise.resolve(json(applicants))
    return Promise.resolve(json({ error: { code: 'http_404', message: 'Not Found' } }, 404))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('real API mode (auth)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('getMe reads the server session; 401 means signed out', async () => {
    const fetchFn = stubServer(null)
    await expect(getMe()).resolves.toBeNull()
    expect(fetchFn).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/me$/), expect.any(Object))
    stubServer({ id: 'u1', name: '실회원', role: 'member', status: 'pending' })
    await expect(getMe()).resolves.toMatchObject({ name: '실회원', status: 'pending' })
  })

  it("'?as=admin' does not switch roles in API mode (no Mock session is created)", async () => {
    stubServer(null)
    const router = renderAt('/ops/approvals?as=admin')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/ops/approvals?as=admin')
    expect(readDb().session).toBeNull()
  })

  it('a member session from the server is blocked from /ops; pending goes to account status', async () => {
    stubServer({ id: 'u1', name: '회원', role: 'member', status: 'approved' })
    const r1 = renderAt('/ops/approvals')
    await waitFor(() => expect(r1.state.location.pathname).toBe('/forbidden'))
  })

  it('pending account is sent to account status', async () => {
    stubServer({ id: 'u2', name: '대기', role: 'member', status: 'pending' })
    const r = renderAt('/tutorial')
    await waitFor(() => expect(r.state.location.pathname).toBe('/account-status'))
  })

  it('an admin session lists applicants from the server (SCR-231)', async () => {
    stubServer({ id: 'a1', name: '운영진', role: 'admin', status: 'approved' }, [
      { id: 'p1', name: '실제신청자', gender: '여', grade: 'D조', referrer: null, appliedAt: '2026-11-11T07:00:00Z', duplicateName: false },
    ])
    renderAt('/ops/approvals')
    const list = await screen.findByRole('list', { name: '승인 대기 신청' })
    expect(within(list).getAllByText('실제신청자').length).toBeGreaterThan(0)
  })

  it("'카카오로 시작하기' navigates to the backend authorize start (same origin)", () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    void startKakaoLogin('/ops/approvals')
    expect(assign).toHaveBeenCalledWith('/api/auth/kakao/login?next=%2Fops%2Fapprovals')
  })

  it('roster reads members and guests from the server (I1)', async () => {
    const fetchFn = stubServer(null)
    const { listRoster } = await import('../roster/api')
    await expect(listRoster()).rejects.toMatchObject({ status: 404 }) // 스텁 서버에 /api/roster 없음 → 서버를 부름
    expect(fetchFn).toHaveBeenCalledWith(expect.stringMatching(/\/api\/roster$/), expect.any(Object))
  })
})

describe('local dev admin login (SCR-001, API mode)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  /** 서버 흉내: 개발용 로그인 켜짐 여부, 올바른 ID/PW면 세션(이후 /me가 슈퍼 관리자) */
  function stubDevServer(enabled: boolean) {
    let me: Me | null = null
    const posts: unknown[] = []
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost:5173').pathname
      if (url === '/api/auth/me') return Promise.resolve(me ? json(me) : unauth())
      if (url === '/api/auth/dev-login' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { username: string; password: string }
        posts.push(body)
        if (body.username === 'super_admin' && body.password === 'server-checked') {
          me = { id: 'd1', name: '개발용 관리자', role: 'superAdmin', status: 'approved' }
          return Promise.resolve(json(me))
        }
        return Promise.resolve(json({ error: { code: 'invalid_credentials', message: 'x' } }, 401))
      }
      if (url === '/api/auth/dev-login') return Promise.resolve(json({ enabled }))
      if (url === '/api/approvals/count') return Promise.resolve(json({ count: 0 }))
      return Promise.resolve(json({ error: { code: 'http_404', message: 'Not Found' } }, 404))
    })
    return posts
  }

  it('shows only two buttons first; the ID/PW form expands in place', async () => {
    stubDevServer(true)
    renderAt('/login')
    const toggle = await screen.findByRole('button', { name: '운영진 로그인하기' })
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument()
    expect(screen.queryByLabelText('아이디')).toBeNull()
    expect(screen.queryByLabelText('비밀번호')).toBeNull()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const form = screen.getByRole('form', { name: '운영진 로그인' })
    expect(within(form).getByLabelText('아이디')).toHaveFocus()
    expect(within(form).getByLabelText('비밀번호')).toHaveAttribute('type', 'password')
  })

  it('wrong credentials show an error; correct ones go to /ops with the server session', async () => {
    const posts = stubDevServer(true)
    const router = renderAt('/login')
    fireEvent.click(await screen.findByRole('button', { name: '운영진 로그인하기' }))
    const form = screen.getByRole('form', { name: '운영진 로그인' })
    fireEvent.click(within(form).getByRole('button', { name: '로그인' }))
    expect(await within(form).findByText('아이디를 입력해 주세요')).toBeInTheDocument()
    expect(posts).toHaveLength(0)
    fireEvent.change(within(form).getByLabelText('아이디'), { target: { value: 'super_admin' } })
    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: 'wrong' } })
    fireEvent.click(within(form).getByRole('button', { name: '로그인' }))
    expect(await within(form).findByText('아이디 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument()
    expect(within(form).getByLabelText('비밀번호')).toHaveValue('')
    fireEvent.change(within(form).getByLabelText('비밀번호'), { target: { value: 'server-checked' } })
    fireEvent.click(within(form).getByRole('button', { name: '로그인' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/ops'))
    expect(posts).toHaveLength(2)
  })

  it('hides the admin login button when the server has it disabled', async () => {
    stubDevServer(false)
    renderAt('/login')
    await screen.findByRole('button', { name: '카카오로 시작하기' })
    expect(screen.queryByRole('button', { name: '운영진 로그인하기' })).toBeNull()
  })
})

describe('My Page logout (API mode)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  /** 서버 흉내: 세션이 있는 사용자, 로그아웃 POST(성공 시 세션 없앰 / fail이면 500) */
  function stubSession(me: Me, opts: { fail?: boolean } = {}) {
    let session: Me | null = me
    const calls: string[] = []
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost:5173').pathname
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (url === '/api/auth/logout' && init?.method === 'POST') {
        if (opts.fail) return Promise.resolve(json({ error: { code: 'internal_error', message: 'x' } }, 500))
        session = null
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (url === '/api/auth/me') return Promise.resolve(session ? json(session) : unauth())
      if (url === '/api/me/profile') return Promise.resolve(session ? json({ name: session.name, gender: '남', grade: 'A조' }) : unauth())
      if (url === '/api/me/record') return Promise.resolve(session ? json({ rank: null, gamesToRank: 10, games: 0, wins: 0, losses: 0, rate: null }) : unauth()) // I3-d4
      if (url === '/api/auth/dev-login') return Promise.resolve(json({ enabled: true }))
      if (url === '/api/approvals/count') return Promise.resolve(json({ count: 0 }))
      return Promise.resolve(json({ error: { code: 'http_404', message: 'Not Found' } }, 404))
    })
    return calls
  }

  it.each([
    ['dev super_admin', { id: 'd1', name: '개발용 관리자', role: 'superAdmin', status: 'approved' }],
    ['kakao member', { id: 'k1', name: '카카오회원', role: 'member', status: 'approved' }],
  ])('%s: calls the server logout, lands on /login and cannot reopen protected screens', async (_, me) => {
    const calls = stubSession(me)
    const router = renderAt('/me')
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-121]')).toHaveTextContent(`${me.name} · 남 · 급수 A조`))
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(calls).toContain('POST /api/auth/logout')
    await router.navigate('/ops')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    await router.navigate('/me')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    // 다시 카카오 로그인 → 새 인증 흐름(백엔드 인가 시작)
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    fireEvent.click(await screen.findByRole('button', { name: '카카오로 시작하기' }))
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/auth\/kakao\/login/))
  })

  it('a failed logout is not treated as success', async () => {
    stubSession({ id: 'd1', name: '개발용 관리자', role: 'superAdmin', status: 'approved' }, { fail: true })
    const router = renderAt('/me')
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }))
    expect(await screen.findByText('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/me')
    expect(screen.getByRole('button', { name: '로그아웃' })).not.toBeDisabled()
  })
})

describe('Kakao failure count (UXD-019, API mode)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('a successful login through the backend redirect resets the failure count', async () => {
    window.localStorage.setItem('smapsh.kakaoFailCount', '2')
    stubServer({ id: 'k1', name: '카카오회원', role: 'member', status: 'approved' })
    const router = renderAt('/tutorial') // 콜백이 보낸 첫 화면
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutorial'))
    await waitFor(() => expect(window.localStorage.getItem('smapsh.kakaoFailCount')).toBeNull())
  })

  it('arriving at sign-up with a ticket also resets it', async () => {
    window.localStorage.setItem('smapsh.kakaoFailCount', '3')
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost:5173').pathname
      if (url === '/api/auth/signup/ticket') return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(unauth())
    })
    const router = renderAt('/signup')
    await waitFor(() => expect(router.state.location.pathname).toBe('/signup'))
    await waitFor(() => expect(window.localStorage.getItem('smapsh.kakaoFailCount')).toBeNull())
  })
})

describe('My Page profile (SCR-122, API mode)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('reads and saves the profile through /api/me/profile; record stays on Mock (no records for a real account)', async () => {
    let profile = { name: '실회원', gender: '여', grade: 'D조' }
    const puts: unknown[] = []
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost:5173').pathname
      if (url === '/api/auth/me') return Promise.resolve(json({ id: 'real-uuid', name: profile.name, role: 'member', status: 'approved' }))
      if (url === '/api/me/profile' && init?.method === 'PUT') {
        puts.push(JSON.parse(String(init.body)))
        profile = JSON.parse(String(init.body)) as typeof profile
        return Promise.resolve(json(profile))
      }
      if (url === '/api/me/profile') return Promise.resolve(json(profile))
      // I3-d4: 전적·랭크는 서버 계산(기록 없음)
      if (url === '/api/me/record') return Promise.resolve(json({ rank: null, gamesToRank: 10, games: 0, wins: 0, losses: 0, rate: null }))
      return Promise.resolve(json({ error: { code: 'http_404', message: 'Not Found' } }, 404))
    })
    renderAt('/me')
    expect(await screen.findByText('청백전 기록이 없습니다')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '프로필 수정' }))
    const sheet = await screen.findByTestId('profile-sheet')
    fireEvent.click(within(sheet).getByRole('radio', { name: 'C조' }))
    fireEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    await waitFor(() => expect(puts).toEqual([{ name: '실회원', gender: '여', grade: 'C조' }]))
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-121]')).toHaveTextContent('실회원 · 여 · 급수 C조'))
  })
})

describe('Tutorial in API mode (I2)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('progress comes from the server; saving sends only score and total (server recomputes pass)', async () => {
    const calls: { method: string; url: string; body?: unknown }[] = []
    let stored: Record<string, { passed: boolean; best: number; firstPassedAt: string | null }> = {}
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost:5173').pathname
      const method = init?.method ?? 'GET'
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (url === '/api/auth/me') return Promise.resolve(json({ id: 'real-uuid', name: '실회원', role: 'member', status: 'approved' }))
      if (url === '/api/me/tutorial/progress') return Promise.resolve(json(stored))
      if (url === '/api/me/tutorial/stages/beginner-1' && method === 'PUT') {
        stored = { 'beginner-1': { passed: true, best: 5, firstPassedAt: '2026-11-12T00:00:00Z' } }
        return Promise.resolve(json(stored['beginner-1']))
      }
      return Promise.resolve(json({ error: { code: 'http_404', message: 'Not Found' } }, 404))
    })
    renderAt('/tutorial')
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-101]')).toHaveAttribute('data-st', 'SCR-101-ST3'))
    expect(calls.some((c) => c.url === '/api/me/tutorial/progress')).toBe(true)
    const { saveStageResult } = await import('../tutorial/api')
    await expect(saveStageResult('real-uuid', { stageId: 'beginner-1', score: 5, total: 5 })).resolves.toMatchObject({ passed: true, best: 5 })
    const put = calls.find((c) => c.method === 'PUT')!
    expect(put.body).toEqual({ score: 5, total: 5 }) // passed·best는 보내지 않음
  })
})

describe('Roster in API mode (I1)', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  const admin = { id: 'a1', name: '운영진', role: 'admin', status: 'approved' }
  const person = (over: Record<string, unknown> = {}) => ({ id: 'm1', kind: 'member', name: '실회원', gender: '남', grade: 'C조', score: 5, tutorialRecommendedUnpassed: false, version: 'v1', ...over })

  /** 서버 흉내: 명단 + PUT 처리(첫 저장은 충돌로 응답하고 최신 값으로 바꿀 수 있게) */
  function stubRoster(opts: { conflictOnce?: boolean } = {}) {
    let current = person()
    let conflict = opts.conflictOnce ?? false
    const writes: { url: string; body: unknown }[] = []
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost:5173').pathname
      if (url === '/api/auth/me') return Promise.resolve(json(admin))
      if (url === '/api/approvals/count') return Promise.resolve(json({ count: 0 }))
      if (url === '/api/roster') return Promise.resolve(json({ members: [current], guests: [] }))
      if (url === '/api/roster/members/m1/status') return Promise.resolve(json({ referrer: null, rank: null, gamesToRank: 10, record: { games: 0, wins: 0, losses: 0 }, tutorial: { beginner: 0, novice: 0, total: 3 }, recommended: false }))
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        writes.push({ url, body })
        if (conflict) {
          conflict = false
          current = person({ grade: 'A조', version: 'v2' }) // 다른 운영진이 먼저 A조로
          return Promise.resolve(json({ error: { code: 'conflict', message: 'x' } }, 409))
        }
        current = person({ ...body, version: 'v3' })
        return Promise.resolve(json(current))
      }
      return Promise.resolve(json({ error: { code: 'http_404', message: 'Not Found' } }, 404))
    })
    return writes
  }

  it('saving an edit sends the version; a conflict reloads the latest values and keeps a notice', async () => {
    const writes = stubRoster({ conflictOnce: true })
    renderAt('/ops/roster')
    fireEvent.click(await screen.findByRole('button', { name: /실회원/ }))
    const sheet = await screen.findByRole('dialog')
    fireEvent.click(within(sheet).getByRole('radio', { name: 'B조' }))
    fireEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await within(sheet).findByText('다른 사람이 먼저 수정해 최신 내용으로 바꿨습니다. 확인한 뒤 다시 저장해 주세요')).toBeInTheDocument()
    expect(writes[0]).toMatchObject({ url: '/api/roster/members/m1', body: { grade: 'B조', version: 'v1' } })
    expect(within(sheet).getByRole('radio', { name: 'A조' })).toHaveAttribute('aria-checked', 'true') // 최신 값으로 바뀜
    // 다시 저장하면 새 version으로
    fireEvent.click(within(sheet).getByRole('radio', { name: 'B조' }))
    fireEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    await waitFor(() => expect(writes[1]).toMatchObject({ body: { grade: 'B조', version: 'v2' } }))
  })

  it('score-only entry sends the previous score; Mock screens (session) keep saving to Mock', async () => {
    const writes = stubRoster()
    const { setScore, setMockScore } = await import('../roster/api')
    await setScore('member', 'm1', 6, null)
    expect(writes[0]).toEqual({ url: '/api/roster/members/m1/score', body: { score: 6, previous: null } })
    await setMockScore('member', 'u-member', 4) // 오늘 운동(I4 전 Mock)의 사람
    expect(writes).toHaveLength(1)
  })
})
