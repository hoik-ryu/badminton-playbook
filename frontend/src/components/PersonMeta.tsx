import { Badge } from './Badge'
import { personMetaText, type PersonMetaInfo } from '../lib/personMeta'

// CMP-058 PersonMeta — UX Spec r10 04, DD r13 VD-076: 이름 아래 한 줄 '남 · A조 · 8점'(구분자 ' · ') + 점수 미설정·게스트 배지(CMP-005).
// 운영진 화면 전용(점수·급수는 회원 화면에 쓰지 않음, NFR-005).

export function PersonMeta({ p, badges = true }: { p: PersonMetaInfo; badges?: boolean }) {
  return (
    <span className="su-meta" data-cmp="CMP-058">
      {personMetaText(p)}
      {badges && p.score === null && (
        <Badge tone="warning" className="su-badge" data-tone="warning">
          점수 미설정
        </Badge>
      )}
      {badges && p.kind === 'guest' && (
        <Badge tone="neutral" className="su-badge" data-tone="neutral">
          게스트
        </Badge>
      )}
    </span>
  )
}
