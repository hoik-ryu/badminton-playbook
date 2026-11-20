// 튜토리얼 흐름 모드(프리뷰 전용). 실제 콘텐츠·판정 엔진이 아니라 화면 흐름 확인용 예시 데이터입니다(검수 전, 문구는 예시).
// 판정 규칙은 02 SCR-102 그대로: 고른 칸 번호로만 판정(정답·허용·오답), 첫 시도 정답만 1점, 재도전 정답 0점, 입문자는 허용 판정 없음.
// 통과 기준: 5개 중 4개(AC-092). 저장·진행 기록은 메모리(새로고침하면 사라짐)이며 API·DB를 쓰지 않습니다.
import type { Grid } from '../components/smapsh/TutorialCourt'
import { courses } from './tutorial'

type P = [number, number]
export type Situation = {
  desc: string
  question: string
  answer: number
  allow?: number
  shuttleFrom?: P
  shuttleStop?: P
  landing?: P
  partnerTo: number
  area: string
}
export type StageDef = { key: string; course: string; courseKey: string; step: number; goal: string; grid: Grid; guided: boolean; situations: Situation[] }

const OPP: P = [43, 38]
const s6 = (answer: number, allow: number, desc: string, area: string, stop: P, landing: P, partnerTo: number): Situation => ({
  desc, question: '어디로 이동해야 할까요?', answer, allow, shuttleFrom: OPP, shuttleStop: stop, landing, partnerTo, area,
})
const SIX: Situation[] = [
  s6(6, 4, '상대가 내 쪽 오른쪽 뒤로 높게 넘겼어요.', '오른쪽 뒤', [47, 82], [49, 126], 3),
  s6(5, 3, '상대가 내 쪽 왼쪽 뒤로 높게 넘겼어요.', '왼쪽 뒤', [16, 82], [12, 126], 4),
  s6(2, 4, '상대가 내 쪽 오른쪽 앞으로 짧게 떨어뜨렸어요.', '오른쪽 앞', [44, 66], [50, 74], 5),
  s6(1, 3, '상대가 내 쪽 왼쪽 앞으로 짧게 떨어뜨렸어요.', '왼쪽 앞', [18, 66], [11, 74], 6),
  s6(4, 6, '상대가 내 쪽 오른쪽 가운데로 빠르게 밀어 넣었어요.', '오른쪽 가운데', [46, 84], [50, 100], 3),
]
const s9 = (answer: number, allow: number, desc: string, area: string, stop: P, landing: P, partnerTo: number): Situation => ({
  desc, question: '어디로 이동해야 할까요?', answer, allow, shuttleFrom: OPP, shuttleStop: stop, landing, partnerTo, area,
})
const NINE: Situation[] = [
  s9(3, 2, '상대가 내 쪽 오른쪽 앞으로 짧게 떨어뜨렸어요.', '오른쪽 앞', [46, 64], [52, 74], 7),
  s9(9, 6, '상대가 내 쪽 오른쪽 뒤로 높게 넘겼어요.', '오른쪽 뒤', [48, 84], [52, 126], 4),
  s9(7, 4, '상대가 내 쪽 왼쪽 뒤로 높게 넘겼어요.', '왼쪽 뒤', [14, 84], [10, 126], 6),
  s9(1, 2, '상대가 내 쪽 왼쪽 앞으로 짧게 떨어뜨렸어요.', '왼쪽 앞', [16, 64], [9, 74], 9),
  s9(5, 8, '상대가 내 쪽 가운데로 빠르게 밀어 넣었어요.', '가운데', [30, 84], [30, 100], 1),
]
const GUIDED: Situation[] = [4, 1, 6, 3, 5].map((n) => ({ desc: '내 편 코트의 번호를 눌러 이동해요.', question: `${n}번 위치로 이동해 보세요`, answer: n, partnerTo: n % 2 === 0 ? n - 1 : n + 1, area: `${n}번` }))

const KEYS = { 입문자: 'intro', 왕초급: 'starter', 초급: 'basic' } as const
export const STAGES: StageDef[] = courses.flatMap((c) =>
  c.stages.map((s) => {
    const courseKey = KEYS[c.name as keyof typeof KEYS]
    const guided = courseKey === 'intro'
    const grid: Grid = courseKey === 'basic' ? 9 : 6
    return { key: `${courseKey}-${s.no}`, course: c.name, courseKey, step: s.no, goal: s.goal, grid, guided, situations: guided ? GUIDED : grid === 9 ? NINE : SIX }
  }),
)
export const stageByKey = (k: string) => STAGES.find((s) => s.key === k) ?? STAGES[3]
export const nextStage = (k: string) => STAGES[STAGES.findIndex((s) => s.key === k) + 1]

// 결과 전달(메모리). SCR-102 흐름이 끝나면 SCR-103 흐름이 읽습니다.
export type FlowResult = { stageKey: string; score: number; wrong: { no: number; kind: 'allow' | 'bad' }[] }
let last: FlowResult | null = null
export const setResult = (r: FlowResult) => { last = r }
export const getResult = (): FlowResult | null => last

// 프리뷰 세션 동안의 진행 기록(메모리): 통과 여부·최고 점수만(02 SCR-103 저장 규칙의 모양만 흉내)
const passed = new Set(courses.flatMap((c) => c.stages.filter((s) => s.status === 'passed').map((s) => `${KEYS[c.name as keyof typeof KEYS]}-${s.no}`)))
const best = new Map(courses.flatMap((c) => c.stages.map((s) => [`${KEYS[c.name as keyof typeof KEYS]}-${s.no}`, s.best] as [string, number])))
export function save(r: FlowResult) {
  const prev = best.get(r.stageKey) ?? 0
  const pass = r.score >= 4
  if (pass) passed.add(r.stageKey)
  best.set(r.stageKey, Math.max(prev, r.score))
  return { pass, best: Math.max(prev, r.score), bestNew: r.score > prev }
}
export const progress = (stageKey: string) => {
  const st = stageByKey(stageKey)
  const inCourse = STAGES.filter((s) => s.courseKey === st.courseKey)
  return { course: [inCourse.filter((s) => passed.has(s.key)).length, inCourse.length] as [number, number], overall: [STAGES.filter((s) => passed.has(s.key)).length, STAGES.length] as [number, number] }
}
export const flowHref = (stageKey: string) => `#SCR-102/SCR-102-FLOW-${stageKey}/mobile`

export const stageState = (k: string): { status: 'passed' | 'failed' | 'notPlayed'; best: number } => {
  const b = best.get(k) ?? 0
  return { status: passed.has(k) ? 'passed' : b > 0 ? 'failed' : 'notPlayed', best: b }
}
export const continueStage = () => STAGES.find((s) => !passed.has(s.key))
