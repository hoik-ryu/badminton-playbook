import { isApiError } from '../../lib/api'

// 5-B1 D-2: 운영 상세 조회(GET /api/club-matches/{match_id})의 경로 식별자 형식 오류(예: /club-matches/not-a-uuid)는
// 서버가 422 validation_error(loc = ['path', 'match_id'])로 답합니다(API 계약은 그대로). 화면에서는 '찾을 수 없음'(ST5)으로 보여 줍니다.
// 회원 상세 API는 같은 경우 404를 돌려주므로 회원·운영진이 같은 결과를 봅니다. 그 밖의 422(요청 본문 검증 등)는 이 판정에 해당하지 않습니다.
type ValidationDetail = { loc?: unknown }

export function isMalformedMatchId(error: unknown): boolean {
  if (!isApiError(error) || error.status !== 422 || error.code !== 'validation_error') return false
  const details = error.details
  return (
    Array.isArray(details) &&
    details.length > 0 &&
    details.every((d: ValidationDetail) => Array.isArray(d?.loc) && d.loc[0] === 'path' && d.loc[1] === 'match_id')
  )
}
