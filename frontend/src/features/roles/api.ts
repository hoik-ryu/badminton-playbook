import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { readDb, updateDb } from '../../lib/mock/db'
import type { Role } from '../auth/types'

const dataSource = featureSource('role')

// 역할 관리(SCR-232, FLOW-002, AC-008·009, UXD-018). 슈퍼 관리자만(서버도 거부, AC-009).
export type RoleMember = { id: string; name: string; role: Role }

/** 승인된 회원과 역할 */
export async function listRoleMembers(): Promise<RoleMember[]> {
  if (dataSource === 'api') return api.get<RoleMember[]>('/api/roles')
  const list = readDb()
    .users.filter((u) => u.status === 'approved')
    .map((u) => ({ id: u.id, name: u.name, role: u.role }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return mockDelay(list)
}

/** 운영진 지정·해제. 슈퍼 관리자 역할은 바꾸지 않음(행동 없음) */
export async function setAdmin(id: string, admin: boolean): Promise<void> {
  if (dataSource === 'api') {
    await api.put(`/api/roles/${encodeURIComponent(id)}`, { role: admin ? 'admin' : 'member' })
    return
  }
  await mockDelay(null, 300)
  updateDb((db) => {
    const u = db.users.find((x) => x.id === id && x.status === 'approved')
    if (!u || u.role === 'superAdmin') throw new ApiError(409, { code: 'role_change_not_allowed', message: '역할을 바꿀 수 없습니다' })
    if ((u.role === 'admin') === admin) throw new ApiError(409, { code: 'already_processed', message: '이미 처리된 요청입니다' })
    u.role = admin ? 'admin' : 'member'
  })
}
