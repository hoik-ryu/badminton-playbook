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

export const mock = { roster, opsHome } as const
