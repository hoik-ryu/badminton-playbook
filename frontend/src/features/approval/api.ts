import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { readDb, updateDb } from '../../lib/mock/db'
import type { Gender, Grade } from '../auth/types'

const dataSource = featureSource('approval')

// 가입 승인(SCR-231, FLOW-001-S2·S3, AC-006·AC-007, UXD-012·UXD-014). 운영진 이상만(서버가 최종 검사, NFR-005).
export type Applicant = {
  id: string
  name: string
  gender: Gender
  grade: Grade
  /** 누구의 지인(입력한 경우, 운영진만 열람 AC-099) */
  referrer: string | null
  appliedAt: string
  /** 명단에 같은 이름·성별의 회원이 있음(UXD-014 경고) */
  duplicateName: boolean
}

/** 다른 운영진이 이미 처리한 신청(SCR-231-ST4) */
export const ALREADY_PROCESSED = 'already_processed'

export async function getPendingApprovalCount(): Promise<number> {
  if (dataSource === 'api') return (await api.get<{ count: number }>('/api/approvals/count')).count
  return mockDelay(readDb().users.filter((u) => u.status === 'pending').length, 0)
}

/** 승인 대기 신청자(신청 순서) */
export async function listApplicants(): Promise<Applicant[]> {
  if (dataSource === 'api') return api.get<Applicant[]>('/api/approvals')
  const { users } = readDb()
  const roster = users.filter((u) => u.status === 'approved' || u.status === 'inactive')
  const list = users
    .filter((u) => u.status === 'pending')
    .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt))
    .map((u) => ({
      id: u.id,
      name: u.name,
      gender: u.gender,
      grade: u.grade,
      referrer: u.referrer,
      appliedAt: u.appliedAt,
      duplicateName: roster.some((r) => r.name === u.name && r.gender === u.gender),
    }))
  return mockDelay(list)
}

function decide(ids: string[], status: 'approved' | 'rejected') {
  return updateDb((db) => {
    const targets = ids.map((id) => db.users.find((u) => u.id === id))
    if (targets.some((u) => !u || u.status !== 'pending')) {
      throw new ApiError(409, { code: ALREADY_PROCESSED, message: '이미 처리된 신청입니다' })
    }
    for (const u of targets) if (u) u.status = status
    return targets.length
  })
}

/** 승인(개별) */
export async function approve(id: string): Promise<void> {
  if (dataSource === 'api') {
    await api.post(`/api/approvals/${encodeURIComponent(id)}/approve`)
    return
  }
  await mockDelay(null, 300)
  decide([id], 'approved')
}

/** 선택 일괄 승인(확인 창 없음, UXD-012) */
export async function approveMany(ids: string[]): Promise<number> {
  if (dataSource === 'api') return (await api.post<{ approved: number }>('/api/approvals/approve', { ids })).approved
  await mockDelay(null, 400)
  return decide(ids, 'approved')
}

/** 거절(AC-007) */
export async function reject(id: string): Promise<void> {
  if (dataSource === 'api') {
    await api.post(`/api/approvals/${encodeURIComponent(id)}/reject`)
    return
  }
  await mockDelay(null, 300)
  decide([id], 'rejected')
}
