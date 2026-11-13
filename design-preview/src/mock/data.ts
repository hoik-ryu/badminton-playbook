// 프리뷰 전용 가짜 데이터입니다. 실제 개인정보를 넣지 마세요.
// 가상 인물만 사용(docs/design-profile/figma.md 4장 SCR-211 샘플 세트).
export type Person = { name: string; gender: '남' | '여'; grade: string; score: number | null; inactive?: boolean }

export const roster: { members: Person[]; guests: Person[] } = {
  members: [
    { name: '권초록', gender: '여', grade: 'B조', score: 6 },
    { name: '김가람', gender: '남', grade: 'C조', score: 7 },
    { name: '박다온', gender: '남', grade: 'A조', score: 9 },
    { name: '서이든', gender: '남', grade: '입문자', score: null },
    { name: '신자람', gender: '여', grade: '왕초심', score: 2 },
    { name: '오아라', gender: '여', grade: 'D조', score: 5 },
    { name: '윤새벽', gender: '남', grade: '초심', score: 3 },
    { name: '이나래', gender: '여', grade: 'C조', score: null },
    { name: '정마루', gender: '남', grade: '자강조', score: 10 },
    { name: '최라온', gender: '여', grade: '초심', score: null },
    { name: '한바다', gender: '남', grade: 'B조', score: 8 },
    { name: '황하랑', gender: '남', grade: 'D조', score: 6, inactive: true },
  ],
  guests: [
    { name: '남보람', gender: '남', grade: 'C조', score: 7 },
    { name: '문솔빛', gender: '여', grade: '입문자', score: 4 },
  ],
}

// SCR-201 운영 홈(가상 값). 레이아웃 예시(02 SCR-201)대로 슈퍼 관리자·가입 승인 대기 3건, 오늘 세션 진행 중
export const opsHome: { role: 'admin' | 'superAdmin'; pendingApprovals: number; todaySessionInProgress: boolean } = {
  role: 'superAdmin',
  pendingApprovals: 3,
  todaySessionInProgress: true,
}

// SCR-202 오늘 운동(가상 값): 2라운드 대진 검토, 참석 18명, 레벨별
type P = { name: string; gender: '남' | '여'; score: number }
const p = (name: string, gender: '남' | '여', score: number): P => ({ name, gender, score })
export const session = {
  date: '11/09',
  round: 2,
  attendance: { total: 18, male: 10, female: 8, unset: 2 },
  option: '레벨별',
  relaxed: 2,
  courts: [
    { court: 1, diff: 0, t1: [p('김가람', '남', 7), p('권초록', '여', 6)], t2: [p('한바다', '남', 8), p('오아라', '여', 5)], relax: '성별 완화' },
    { court: 2, diff: 3, t1: [p('박다온', '남', 9), p('신자람', '여', 2)], t2: [p('정마루', '남', 10), p('문솔빛', '여', 4)], relax: undefined },
    { court: 3, diff: 0, t1: [p('윤새벽', '남', 3), p('남보람', '남', 7)], t2: [p('김하늘', '남', 5), p('조은결', '남', 5)], relax: '성별 완화' },
    { court: 4, diff: 1, t1: [p('이도윤', '남', 6), p('배하은', '여', 6)], t2: [p('송지후', '남', 7), p('임서아', '여', 4)], relax: undefined },
  ],
  waiting: [
    { name: '강세린', gender: '여' as const, games: 1 },
    { name: '홍유준', gender: '남' as const, games: 2 },
  ],
  pastRounds: 1,
}

// SCR-203 참석 체크(가상 값): 회원 이름순 + 게스트
export const attendance = {
  members: [
    { name: '권초록', gender: '여' as const, score: 6 as number | null, checked: true },
    { name: '김가람', gender: '남' as const, score: 7, checked: true },
    { name: '박다온', gender: '남' as const, score: 9, checked: true },
    { name: '서이든', gender: '남' as const, score: null, checked: true },
    { name: '신자람', gender: '여' as const, score: 2, checked: false },
    { name: '오아라', gender: '여' as const, score: 5, checked: true },
    { name: '이나래', gender: '여' as const, score: null, checked: true },
  ],
  guests: [{ name: '문솔빛', gender: '여' as const, score: 4 as number | null, checked: true }],
}

// SCR-223 청백전 운영 상세(가상 값): 가을 청백전, 팀전 14명(청 7·백 7), 10경기
export const clubMatch = {
  name: '가을 청백전',
  date: '11/08',
  participants: { total: 14, blue: 7, white: 7 },
  totalGames: 10,
  preview: '14명 · 10경기 → 12명 3경기, 2명 2경기',
  wins: { blue: 3, white: 2 },
  unrecorded: 5,
  games: [
    { no: 1, diff: 1, blue: [p('김가람', '남', 7), p('오아라', '여', 5)], white: [p('한바다', '남', 6), p('권초록', '여', 5)], result: 'blue' as const, relax: undefined as string | undefined },
    { no: 2, diff: 0, blue: [p('박다온', '남', 9), p('신자람', '여', 2)], white: [p('정마루', '남', 8), p('문솔빛', '여', 3)], result: 'white' as const, relax: '같은 대진 반복 · 대체 후보 소진' },
    { no: 3, diff: 2, blue: [p('윤새벽', '남', 3), p('남보람', '남', 7)], white: [p('서이든', '남', 4), p('최라온', '여', 4)], result: undefined, relax: '성별 규칙 완화 · 가능한 성별 조합 없음' },
  ],
}

export const mock = { roster, opsHome, session, attendance, clubMatch } as const
