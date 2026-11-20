// 프리뷰 전용 가짜 데이터(튜토리얼). 실제 개인정보·콘텐츠 원본 아님.
// 스테이지 구성(입문자 2·왕초급 3·초급 3, 스테이지당 5상황)은 AC-093, 학습 목표 문구는 예시입니다.
export type StageStatus = 'passed' | 'failed' | 'notPlayed'
export type Stage = { no: number; goal: string; status: StageStatus; best: number; minutes: number; thumb: string }
export type Course = { name: string; desc: string; icon: string; stages: Stage[] }

export const courses: Course[] = [
  {
    name: '입문자',
    desc: '처음 시작하는 분을 위한 코트와 번호',
    icon: 'AST-035',
    stages: [
      { no: 1, goal: '코트와 번호 익히기', status: 'passed', best: 5, minutes: 2, thumb: 'AST-027' },
      { no: 2, goal: '기본 자리와 복귀', status: 'passed', best: 4, minutes: 2, thumb: 'AST-028' },
    ],
  },
  {
    name: '왕초급',
    desc: '기본 수비 대형과 위치 판단',
    icon: 'AST-036',
    stages: [
      { no: 1, goal: '나란히 수비 대형', status: 'passed', best: 4, minutes: 3, thumb: 'AST-029' },
      { no: 2, goal: '담당 영역 나누기', status: 'failed', best: 2, minutes: 3, thumb: 'AST-030' },
      { no: 3, goal: '셔틀콕을 받은 뒤 복귀', status: 'notPlayed', best: 0, minutes: 3, thumb: 'AST-031' },
    ],
  },
  {
    name: '초급',
    desc: '공격·수비 전환과 복귀 위치',
    icon: 'AST-037',
    stages: [
      { no: 1, goal: '앞뒤 공격 대형', status: 'notPlayed', best: 0, minutes: 4, thumb: 'AST-032' },
      { no: 2, goal: '공격에서 수비로 전환', status: 'notPlayed', best: 0, minutes: 4, thumb: 'AST-033' },
      { no: 3, goal: '수비에서 공격으로 전환과 좌우 수비', status: 'notPlayed', best: 0, minutes: 4, thumb: 'AST-034' },
    ],
  },
]

// SCR-101-ST7 전체 완료: 모든 스테이지 통과
export const allPassed: Course[] = courses.map((c) => ({ ...c, stages: c.stages.map((s) => ({ ...s, status: 'passed' as const, best: Math.max(s.best, 4) })) }))

export const assetUrl = (id: string) => `${import.meta.env.BASE_URL}assets/${id}.png`

// SCR-102 상황 예시(왕초급 2단계 상황 2). 좌표는 기존 코트 좌표계(0–61 × 0–134, 네트 y=67)
export const situation = {
  course: '왕초급',
  step: 2,
  index: 2,
  score: 1,
  desc: '상대가 내 쪽 오른쪽 뒤로 높게 넘겼어요.',
  desc9: '상대가 내 쪽 오른쪽 앞으로 짧게 떨어뜨렸어요.',
  opponents: [[18, 26], [43, 38]] as [number, number][],
  me: [40, 102] as [number, number],
  partner: [27, 80] as [number, number],
  shuttleInFlight: [36, 44] as [number, number],
  shuttleStop: [47, 82] as [number, number],
  shuttleStop9: [46, 64] as [number, number],
  landing: [49, 126] as [number, number],
  answer: 6,
}

// SCR-103 결과 예시
export const result = {
  course: '왕초급',
  step: 2,
  goal: '담당 영역 나누기',
  pass: { score: 4, best: 4, bestNew: true, wrong: [{ no: 3, kind: 'bad' as const }] },
  fail: { score: 2, best: 3, bestNew: false, need: 2, wrong: [{ no: 1, kind: 'allow' as const }, { no: 3, kind: 'bad' as const }, { no: 5, kind: 'bad' as const }] },
  progress: { course: [2, 3] as [number, number], overall: [4, 8] as [number, number] },
}
