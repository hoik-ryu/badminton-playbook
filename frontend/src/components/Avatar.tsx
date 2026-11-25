// CMP-057 Avatar — UX Spec r10 04, DD r13 VD-076: 이름 첫 글자 이니셜 원(사진 없음, NFR-006).
// size: sm 24(경기 카드 자리) · 기본 32(목록 행) · md 40(시트 머리글). 장식이라 aria-hidden(이름은 옆 글자로 읽힘).
// 표현은 생성 페이지와 같은 .su-avatar(styles/clubmatch-setup.css) — 팀 카드 겹침(.su-stack)·팀 색 변형도 이 클래스를 씁니다.
export function Avatar({ name, size, className }: { name: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={className ? `su-avatar ${className}` : 'su-avatar'} data-size={size} data-cmp="CMP-057" aria-hidden>
      {name.slice(0, 1)}
    </span>
  )
}
