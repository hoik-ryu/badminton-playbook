import { readDb, updateDb } from '../../lib/mock/db'

// 개발용 역할 전환(Mock 인증). 실제 카카오 로그인 연결 전까지 화면을 역할별로 확인하는 용도입니다.
// 각 역할은 Mock 저장소의 샘플 사용자로 로그인한 상태(세션)를 만듭니다. 'guest'는 로그아웃.
export const PERSONAS = {
  guest: null,
  pending: 'u-pending',
  rejected: 'u-rejected',
  inactive: 'u-inactive',
  member: 'u-member',
  admin: 'u-admin',
  superAdmin: 'u-super',
} as const satisfies Record<string, string | null>

export type PersonaKey = keyof typeof PERSONAS

export const PERSONA_LABELS: Record<PersonaKey, string> = {
  guest: '비로그인',
  pending: '승인 대기',
  rejected: '거절됨',
  inactive: '비활성',
  member: '회원',
  admin: '운영진',
  superAdmin: '슈퍼 관리자',
}

export const isPersonaKey = (v: string | null): v is PersonaKey => v !== null && v in PERSONAS

/** 현재 세션이 어떤 샘플 역할인지(직접 가입한 사용자면 null) */
export function getPersona(): PersonaKey | null {
  const session = readDb().session
  const found = (Object.keys(PERSONAS) as PersonaKey[]).find((k) => PERSONAS[k] === session)
  return found ?? null
}

export function setPersona(key: PersonaKey) {
  updateDb((db) => {
    db.session = PERSONAS[key]
    db.signupTicket = null
  })
}
