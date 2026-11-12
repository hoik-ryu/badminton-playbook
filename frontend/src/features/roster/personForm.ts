import type { Gender, Grade } from '../auth/types'

// 사람 입력 값·검증(SCR-212·213 공통)
export type PersonDraft = { name: string; gender: Gender | null; grade: Grade | null; score: number | null; referrer: string }
export type PersonErrors = Partial<Record<'name' | 'gender' | 'grade' | 'score', string>>

export const SCORES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const

export function validatePerson(d: PersonDraft): PersonErrors {
  const e: PersonErrors = {}
  if (!d.name.trim()) e.name = '이름을 입력해 주세요'
  if (!d.gender) e.gender = '성별을 골라 주세요'
  if (!d.grade) e.grade = '급수를 골라 주세요'
  return e
}

/** 첫 오류 칸으로 포커스 */
export function focusFirstError(root: HTMLElement | null, e: PersonErrors) {
  const key = (['name', 'gender', 'grade', 'score'] as const).find((k) => e[k])
  if (!root || !key) return
  root.querySelector<HTMLElement>(`[data-field="${key}"] input, [data-field="${key}"] [role=radio]`)?.focus()
}
