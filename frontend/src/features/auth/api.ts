import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { newMockMember, readDb, updateDb, type MockUser } from '../../lib/mock/db'
import type { Me, SignupInput } from './types'

const dataSource = featureSource('auth')

// 계정·인증 데이터 접근(FLOW-001). 화면은 이 함수들만 부르고 출처(mock/api)를 모릅니다.
// api 모드: backend/app/modules/auth(카카오 OAuth·httpOnly 세션 쿠키). 설계는 docs/workflow-proposals/kakao-auth-workstream.md
const toMe = (u: MockUser): Me => ({ id: u.id, name: u.name, role: u.role, status: u.status })

/** 내 계정. 비로그인이면 null */
export async function getMe(): Promise<Me | null> {
  if (dataSource === 'mock') {
    const db = readDb()
    const user = db.users.find((x) => x.id === db.session)
    return mockDelay(user ? toMe(user) : null, 0)
  }
  try {
    return await api.get<Me>('/api/auth/me')
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

export type KakaoLoginResult = { kind: 'signup' } | { kind: 'signedIn'; me: Me } | { kind: 'failed' }

/**
 * '카카오로 시작하기'.
 * - api: 백엔드 인가 시작 주소로 페이지 이동(돌아오면 백엔드가 /signup·/account-status·원래 주소로 보냄. 실패는 /login?error=kakao_failed)
 * - mock: 이 기기의 가짜 카카오 회원번호로 인증을 흉내 냄(가입 여부에 따라 분기). 개발 도구에서 실패를 시뮬레이션할 수 있음
 */
export async function startKakaoLogin(next: string | null): Promise<KakaoLoginResult> {
  if (dataSource === 'api') {
    window.location.assign(`/api/auth/kakao/login${next ? `?next=${encodeURIComponent(next)}` : ''}`)
    return new Promise(() => {}) // 페이지 이동
  }
  const result = updateDb((db): KakaoLoginResult => {
    if (db.failNextKakao) {
      db.failNextKakao = false
      return { kind: 'failed' }
    }
    const user = db.users.find((x) => x.kakaoId === db.kakaoId)
    if (!user) {
      db.signupTicket = db.kakaoId // 카카오 인증만 됨(계정은 아직 만들지 않음)
      return { kind: 'signup' }
    }
    db.session = user.id
    return { kind: 'signedIn', me: toMe(user) }
  })
  return mockDelay(result, 600)
}

/** 같은 기기 카카오 로그인 실패 횟수(UXD-019: 2회 이상이면 다른 브라우저 안내) */
export function recordKakaoFailure(): number {
  try {
    const n = Number(window.localStorage.getItem('smapsh.kakaoFailCount') ?? '0') + 1
    window.localStorage.setItem('smapsh.kakaoFailCount', String(n))
    return n
  } catch {
    return 1
  }
}

export function clearKakaoFailures() {
  try {
    window.localStorage.removeItem('smapsh.kakaoFailCount')
  } catch {
    /* 무시 */
  }
}

/** 가입 정보 입력 화면에 들어올 수 있는지(카카오 인증 완료·미가입) */
export async function hasSignupTicket(): Promise<boolean> {
  if (dataSource === 'mock') return mockDelay(readDb().signupTicket !== null, 0)
  try {
    await api.get('/api/auth/signup/ticket')
    return true
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return false
    throw e
  }
}

/** 가입 신청(AC-001). 이미 가입된 카카오 계정이면 새로 만들지 않고 기존 계정으로 로그인(AC-002, SCR-002-ST7) */
export async function signup(input: SignupInput): Promise<Me> {
  if (dataSource === 'api') return api.post<Me>('/api/auth/signup', input)
  const me = updateDb((db) => {
    const kakaoId = db.signupTicket
    if (!kakaoId) throw new ApiError(401, { code: 'signup_ticket_missing', message: '카카오 인증이 만료되었습니다' })
    const existing = db.users.find((x) => x.kakaoId === kakaoId)
    const user: MockUser = existing ?? newMockMember({ kakaoId, name: input.name.trim(), gender: input.gender, grade: input.grade, referrer: input.referrer?.trim() || null, status: 'pending' })
    if (!existing) db.users.push(user)
    db.signupTicket = null
    db.session = user.id
    return toMe(user)
  })
  return mockDelay(me, 500)
}

/** 가입 그만두기: 카카오 인증만 된 상태는 저장하지 않음(SCR-002 뒤로 가기) */
export async function cancelSignup(): Promise<void> {
  if (dataSource === 'api') {
    await api.delete('/api/auth/signup/ticket')
    return
  }
  updateDb((db) => {
    db.signupTicket = null
  })
}

/** 로그아웃(AC-005) */
export async function logout(): Promise<void> {
  if (dataSource === 'api') {
    await api.post('/api/auth/logout')
    return
  }
  updateDb((db) => {
    db.session = null
  })
  await mockDelay(null, 200)
}

/** 로컬 개발용 운영진 ID/PW 로그인을 쓸 수 있는지(서버가 DEV_LOGIN_ENABLED + APP_ENV=local 일 때만 true). Mock 모드는 항상 false */
export async function getDevLoginEnabled(): Promise<boolean> {
  if (dataSource === 'mock') return false
  try {
    return (await api.get<{ enabled: boolean }>('/api/auth/dev-login')).enabled
  } catch {
    return false // 서버가 꺼져 있거나 오래된 버전이면 버튼을 숨김
  }
}

/** 개발용 운영진 로그인. 검증은 서버(FastAPI)가 하고 성공하면 기존과 같은 httpOnly 세션 쿠키. 틀리면 ApiError(invalid_credentials) */
export async function devLogin(username: string, password: string): Promise<Me> {
  return api.post<Me>('/api/auth/dev-login', { username, password })
}
