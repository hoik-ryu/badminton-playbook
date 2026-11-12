// 계정·역할(01 IA 4장, PRD FR-001–003). 서버 응답 형태의 기준입니다.
export type Role = 'member' | 'admin' | 'superAdmin'
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'inactive'
export type Gender = '남' | '여'

// 급수 8개(02 SCR-002, 표시 순서 그대로)
export const GRADES = ['자강조', 'A조', 'B조', 'C조', 'D조', '초심', '왕초심', '입문자'] as const
export type Grade = (typeof GRADES)[number]

export type Me = {
  id: string
  name: string
  role: Role
  status: AccountStatus
}

export type SignupInput = {
  name: string
  gender: Gender
  grade: Grade
  /** 누구의 지인(선택) */
  referrer?: string
}

export const isAdmin = (me: Me) => me.role === 'admin' || me.role === 'superAdmin'
export const isRestricted = (me: Me) => me.status !== 'approved'
