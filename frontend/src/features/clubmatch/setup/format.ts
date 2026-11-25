import type { ParticipantRow } from '../api'

// 생성 페이지 표시 문구(부품 파일과 분리: Fast Refresh 규칙)

/** 화면 읽기용 사람 설명 '김민수, 남, A조, 8점(, 게스트)' */
export const personLabel = (p: Pick<ParticipantRow, 'name' | 'gender' | 'grade' | 'score' | 'kind'>) =>
  [p.name, p.gender, p.grade, p.score === null ? '점수 미설정' : `${p.score}점`, p.kind === 'guest' ? '게스트' : null].filter(Boolean).join(', ')

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
/** '2026. 12. 13 (일)' */
export function dateLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const w = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${y}. ${String(m).padStart(2, '0')}. ${String(d).padStart(2, '0')} (${w})`
}
