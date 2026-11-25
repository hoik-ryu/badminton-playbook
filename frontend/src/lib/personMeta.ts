// CMP-058 PersonMeta의 글자 규칙(VD-076): '남 · A조 · 8점'. 행 레이블(aria-label)에도 같은 순서로 씁니다.
export type PersonMetaInfo = { gender: string | null; grade: string | null; score: number | null; kind: 'member' | 'guest' }

export function personMetaText(p: Pick<PersonMetaInfo, 'gender' | 'grade' | 'score'>) {
  return [p.gender, p.grade, p.score === null ? null : `${p.score}점`].filter(Boolean).join(' · ')
}
