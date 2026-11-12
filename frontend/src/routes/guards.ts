import { redirect, type LoaderFunctionArgs } from 'react-router'

import { getPendingApprovalCount } from '../features/approval/api'
import { clearKakaoFailures, getDevLoginEnabled, getMe, hasSignupTicket, recordKakaoFailure } from '../features/auth/api'
import { isPersonaKey, setPersona } from '../features/auth/devPersona'
import { isAdmin, isRestricted, type Me } from '../features/auth/types'
import { dataSource } from '../lib/data/source'

// 접근 규칙(01 IA 4·5장). 화면 표시용 가드이며 최종 권한 판단은 서버(NFR-005).
// - 비로그인 → /login?next=원래 주소(로그인 뒤 돌아가며 다시 검사)
// - 계정 제한(승인 대기·거절·비활성) → /account-status
// - 회원이 /ops/* → /forbidden, 운영진이 /ops/roles → /forbidden
// - 돌아갈 주소가 없으면 모든 역할이 /tutorial(SCR-101)
const HOME = '/tutorial'

/** 서비스 안 경로만 허용(open redirect 방지) */
export function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

const currentPath = (request: Request) => {
  const u = new URL(request.url)
  return u.pathname + u.search
}

const toLogin = (request: Request) => redirect(`/login?next=${encodeURIComponent(currentPath(request))}`)

/**
 * 루트: 개발 빌드 + Mock 모드에서만 '?as=역할'로 Mock 역할 전환.
 * api 모드에서는 무시합니다(서버 세션이 기준이고, 이 값은 서버 권한과 무관 — 서버도 쿼리를 보지 않음).
 */
export async function rootLoader({ request }: LoaderFunctionArgs) {
  if (import.meta.env.DEV && dataSource === 'mock') {
    const u = new URL(request.url)
    const as = u.searchParams.get('as')
    if (isPersonaKey(as)) {
      setPersona(as)
      u.searchParams.delete('as')
      throw redirect(u.pathname + u.search)
    }
  }
  return null
}

/** '/': 상태에 맞는 첫 화면으로 */
export async function indexLoader() {
  const me = await getMe()
  if (!me) throw redirect('/login')
  if (isRestricted(me)) throw redirect('/account-status')
  throw redirect(HOME)
}

/** 로그인·가입: 이미 로그인했으면 반대 방향으로 */
export async function guestOnlyLoader({ request }: LoaderFunctionArgs) {
  const me = await getMe()
  if (!me) return null
  if (isRestricted(me)) throw redirect('/account-status')
  throw redirect(safeNext(new URL(request.url).searchParams.get('next')) ?? HOME)
}

export type LoginData = { failCount: number; next: string | null; devLogin: boolean }

/** SCR-001: 카카오 인증 실패로 돌아오면(?error=kakao_failed) 같은 기기 실패 횟수를 셈(UXD-019). loader는 이동마다 한 번 실행 */
export async function loginLoader(args: LoaderFunctionArgs): Promise<LoginData> {
  await guestOnlyLoader(args)
  const params = new URL(args.request.url).searchParams
  const failCount = params.get('error') === 'kakao_failed' ? recordKakaoFailure() : 0
  return { failCount, next: safeNext(params.get('next')), devLogin: await getDevLoginEnabled() }
}

/** SCR-002: 카카오 인증 완료·미가입(가입 티켓)일 때만 */
export async function signupLoader(args: LoaderFunctionArgs) {
  await guestOnlyLoader(args)
  if (!(await hasSignupTicket())) throw redirect('/login')
  clearKakaoFailures() // 카카오 인증 성공(api 모드는 백엔드 리다이렉트로 오므로 로그인 화면을 거치지 않음)
  return null
}

/** 계정 상태 안내: 계정 제한 상태만 */
export async function restrictedOnlyLoader() {
  const me = await getMe()
  if (!me) throw redirect('/login')
  clearKakaoFailures()
  if (!isRestricted(me)) throw redirect(HOME)
  return me
}

/** 로그인만 필요(권한 없음 화면) */
export async function signedInLoader({ request }: LoaderFunctionArgs) {
  const me = await getMe()
  if (!me) throw toLogin(request)
  return me
}

async function approved(request: Request): Promise<Me> {
  const me = await getMe()
  if (!me) throw toLogin(request)
  clearKakaoFailures() // 로그인 세션 확인 = 인증 성공(UXD-019 실패 횟수는 연속 실패만 셈)
  if (isRestricted(me)) throw redirect('/account-status')
  return me
}

export type ShellData = { me: Me; opsBadge?: number }

/** 운영 탭 승인 대기 배지(CMP-025 상태). 불러오지 못해도 화면은 열고 배지만 숨김(SCR-201-ST4와 같은 원칙) */
async function withBadge(me: Me): Promise<ShellData> {
  if (!isAdmin(me)) return { me }
  const opsBadge = await getPendingApprovalCount().catch(() => undefined)
  return { me, opsBadge }
}

/** 회원 셸(튜토리얼·청백전·마이) */
export async function memberLoader({ request }: LoaderFunctionArgs): Promise<ShellData> {
  return withBadge(await approved(request))
}

/** 운영 셸 /ops/* */
export async function adminLoader({ request }: LoaderFunctionArgs): Promise<ShellData> {
  const me = await approved(request)
  if (!isAdmin(me)) throw redirect('/forbidden')
  return withBadge(me)
}

/** 역할 관리 /ops/roles */
export async function superAdminLoader({ request }: LoaderFunctionArgs) {
  const me = await approved(request)
  if (me.role !== 'superAdmin') throw redirect('/forbidden')
  return me
}
