import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { updateDb, type MockDb, type MockStageProgress } from '../../lib/mock/db'
import { courseStageIds, MOCK_REGISTRY, MOCK_STAGE_META, releasedCourses, type CoursePassCount } from './mockRegistry'
import { mergeProgress, type StageProgress } from './progress'

// 튜토리얼 진행 기록(SCR-101·103, FR-026, C-23, AC-094, NFR-006). 본인 것만.
// - 저장 항목은 회원 × 스테이지마다 통과 여부·최고 점수·최초 통과 시각 3개뿐. 상황별 선택 기록·틀린 상황은 저장하지 않음
// - 저장은 결과 화면에서 한 번의 원자적 갱신(멱등: 통과 OR, 최고 MAX, 최초 통과 시각은 처음 한 번)
// - api 모드: backend/app/modules/tutorial. 저장은 회차 완료 PUT /stages/{id} {runId}만 — 점수·통과는 서버가 첫 판정으로 계산(D-T2, 6단계)
// - Mock 모드: 브라우저 저장소(로그인 사용자 id 기준), 서버와 같은 규칙(progress.ts). 콘텐츠·판정은 mock/server.ts(mock 빌드 전용)
const dataSource = featureSource('tutorial')

/** 서버 거부 코드: 스테이지 상황 수가 서버 레지스트리와 다름(콘텐츠 배포 불일치) */
export const CONTENT_MISMATCH = 'content_mismatch'

export type ProgressMap = Record<string, StageProgress>

// ── 과정·스테이지 목록(SCR-101, 서버 콘텐츠 — 사용자 결정 2026-11-19 D-T1) ──
// api 모드: GET /api/me/tutorial/courses. 진행 기록은 getMyTutorialProgress(GET /progress) 그대로 따로 불러옴
export type TutorialGrid = { id: string; cols: number; rows: number }
export type TutorialCourseStage = { id: string; no: number; version: number; title: string; minutes: number; thumbnail: string | null; situations: number }
export type TutorialCourse = {
  id: string
  name: string
  order: number
  grid: TutorialGrid
  released: boolean
  guided: boolean
  description: string | null
  icon: string | null
  /** 미출시 과정('준비 중')은 빈 목록 */
  stages: TutorialCourseStage[]
}
export type TutorialCourses = { courses: TutorialCourse[]; passRule: { numerator: number; denominator: number } }

function mockCourses(): TutorialCourses {
  const courses = [...MOCK_REGISTRY.courses]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const [, cols, rows] = /^grid-(\d+)x(\d+)$/.exec(c.grid)!
      const stages = c.released
        ? MOCK_REGISTRY.stages
            .filter((st) => st.course === c.id)
            .sort((a, b) => a.no - b.no)
            .map((st) => ({ id: st.id, no: st.no, version: Number(/-v(\d+)$/.exec(st.id)![1]), ...MOCK_STAGE_META[st.id]!, situations: st.situations }))
        : []
      return { ...c, grid: { id: c.grid, cols: Number(cols), rows: Number(rows) }, stages }
    })
  return { courses, passRule: { numerator: MOCK_REGISTRY.passNumerator, denominator: MOCK_REGISTRY.passDenominator } }
}

/** 과정 순서대로 과정·출시 스테이지 목록과 통과 기준(AC-093·120) */
export async function getTutorialCourses(): Promise<TutorialCourses> {
  if (dataSource === 'api') return api.get<TutorialCourses>('/api/me/tutorial/courses')
  await mockDelay(null)
  const fail = updateDb((db) => {
    const f = !!db.failNextTutorialCoursesLoad
    db.failNextTutorialCoursesLoad = false // 한 번만 실패
    return f
  })
  if (fail) throw new ApiError(503, { code: 'tutorial_courses_failed', message: '튜토리얼 목록을 불러오지 못했습니다' })
  return mockCourses()
}

const fail = (code: string, message: string) => new ApiError(503, { code, message })

/** 샘플 회원의 과정별 통과 수를 새 스테이지 ID 기록으로 펼침(처음 한 번, PRD r7 ASM-033) */
function ensureSeed(db: MockDb) {
  if (db.tutorialProgress) return
  db.tutorialProgress = {}
  for (const u of db.users) {
    const map: Record<string, MockStageProgress> = {}
    ;(['intro', 'starter', 'basic'] as const).forEach((course) => {
      courseStageIds(course)
        .slice(0, u.tutorial[course])
        .forEach((id, i) => (map[id] = { passed: true, best: i % 2 ? 4 : 5, firstPassedAt: u.appliedAt }))
    })
    db.tutorialProgress[u.id] = map
  }
}

export async function getMyTutorialProgress(meId: string): Promise<ProgressMap> {
  if (dataSource === 'api') return api.get<ProgressMap>('/api/me/tutorial/progress')
  await mockDelay(null)
  const out = updateDb((db) => {
    ensureSeed(db)
    if (db.failNextTutorialLoad) {
      db.failNextTutorialLoad = false // 한 번만 실패(저장소에 반영된 뒤 던짐)
      return null
    }
    return { ...(db.tutorialProgress![meId] ?? {}) }
  })
  if (!out) throw fail('tutorial_load_failed', '진행 기록을 불러오지 못했습니다')
  return out
}

/** 회차 결과(서버가 첫 판정으로 계산) */
export type RunResult = { score: number; total: number; passed: boolean; wrong: { no: number; kind: 'allow' | 'wrong' }[] }
/** 저장 후 진행 기록(기존 키) + 이번 회차 결과 */
export type StageSave = StageProgress & { run: RunResult }
export type ReviewSituation = {
  no: number
  kind: 'allow' | 'wrong'
  description: string
  start: { me: [number, number]; partner: [number, number]; opponents: [number, number][] }
  shuttle: { from: [number, number]; stop: [number, number] } | null
  answer: number
  allow: number[]
  landing: [number, number] | null
  landingCell: number | null
  correctMove: Move
  correctReason: string
}
/** 완료된 본인 회차(SCR-103 새로고침 복구·틀린 상황 다시 보기). 틀린 상황만 정답 데이터 포함 */
export type RunReview = { runId: string; stageId: string; run: RunResult; review: ReviewSituation[] }

/** 회차 완료 = 진행 기록 저장(SCR-103 진입·'다시 저장'). 요청은 {runId}만, 같은 요청은 같은 결과(멱등, 두 번 반영되지 않음) */
export async function completeTutorialRun(meId: string, stageId: string, runId: string): Promise<StageSave> {
  if (dataSource === 'api') return api.put<StageSave>(`/api/me/tutorial/stages/${encodeURIComponent(stageId)}`, { runId })
  await mockDelay(null, 400)
  const fail = updateDb((db) => {
    const f = !!db.failNextTutorialSave
    db.failNextTutorialSave = false // 한 번만 실패
    return f
  })
  if (fail) throw new ApiError(503, { code: 'tutorial_save_failed', message: '기록을 저장하지 못했습니다' })
  const { result, firstTime } = (await mockServer()).completeRun(runId, stageId)
  const progress = updateDb((db) => {
    ensureSeed(db)
    const mine = (db.tutorialProgress![meId] ??= {})
    if (firstTime) mine[stageId] = mergeProgress(mine[stageId], result, new Date().toISOString()) // 회원 × 스테이지 한 건을 한 번만 갱신
    return mine[stageId]!
  })
  return { ...progress, run: result }
}

/** 완료된 본인 회차 조회. 끝나지 않은 회차 409, 없거나 남의 회차 404. 읽기만 함 */
export async function getTutorialRun(runId: string): Promise<RunReview> {
  if (dataSource === 'api') return api.get<RunReview>(`/api/me/tutorial/runs/${encodeURIComponent(runId)}`)
  await mockDelay(null)
  return (await mockServer()).reviewRun(runId)
}

/** 운영진 명단 현황(SCR-212, C-23·28, AC-100 r7): 출시된 과정별 통과 스테이지 수 / 스테이지 수.
 * 레지스트리의 현재 스테이지만 셈 — 개편 전 스테이지 기록은 들어가지 않음(AC-118). 명단 api.ts가 같은 Mock 저장소에서 읽음 */
export function passedCountsOf(db: MockDb, userId: string): CoursePassCount[] {
  ensureSeed(db)
  const map = db.tutorialProgress![userId] ?? {}
  return releasedCourses().map((c) => {
    const ids = courseStageIds(c.id)
    return { course: c.id, name: c.name, passed: ids.filter((id) => map[id]?.passed).length, total: ids.length }
  })
}

// ── SCR-102 서버 판정 회차(5단계, D-T2·D-T4 (b)) ──
// 공개 콘텐츠: GET /stages/{id}(정답·허용 칸·해설 없음) → 회차: POST /stages/{id}/runs → 판정: POST /runs/{runId}/judge
// 점수는 서버 응답(firstVerdict·points)만 씀(첫 시도 정답 1점, 재도전 0점). 고른 칸은 판정 요청에만 쓰고 저장하지 않음(NFR-006)
type Pt = [number, number]
export type TutorialSituation = {
  no: number
  description: string
  question: string
  start: { me: Pt; partner: Pt; opponents: Pt[] }
  /** 재생 연출: 상대가 치는 지점과 선택 대기 중 멈추는 지점(입문자는 null). 떨어지는 지점은 판정 뒤에만 */
  shuttle: { from: Pt; stop: Pt } | null
}
export type TutorialStage = {
  id: string
  course: string
  courseName: string
  no: number
  version: number
  title: string
  minutes: number
  thumbnail: string | null
  guided: boolean
  grid: TutorialGrid
  passRule: { numerator: number; denominator: number }
  situations: TutorialSituation[]
}
export type RunStart = { runId: string; stageId: string; situations: number; expiresAt: string }
export type Verdict = 'correct' | 'allow' | 'wrong'
export type Move = { cell: number; me: Pt; partnerCell: number; partner: Pt }
export type Judgement = {
  situation: number
  /** 이번 선택의 판정 */
  verdict: Verdict
  /** 점수에 반영되는 첫 판정(재도전해도 바뀌지 않음) */
  firstVerdict: Verdict
  /** 이 상황의 점수(첫 판정이 정답이면 1, 아니면 0) */
  points: number
  answer: number
  allow: number[]
  landing: Pt | null
  landingCell: number | null
  move: Move
  correctMove: Move
  reason: string
  correctReason: string
  judged: number
}

// Mock 판정 서버는 정답 데이터를 담고 있어 mock 빌드에서만 불러옴(api 빌드에서는 빌드 상수 비교로 코드·파일이 빠짐)
const mockServer = () =>
  import.meta.env.VITE_DATA_SOURCE === 'mock' ? import('./mock/server') : Promise.reject(new ApiError(0, { code: 'network_error', message: 'Mock 서버 없음' }))

export async function getTutorialStage(stageId: string): Promise<TutorialStage> {
  if (dataSource === 'api') return api.get<TutorialStage>(`/api/me/tutorial/stages/${encodeURIComponent(stageId)}`)
  await mockDelay(null)
  return (await mockServer()).getStage(stageId)
}

export async function startTutorialRun(stageId: string): Promise<RunStart> {
  if (dataSource === 'api') return api.post<RunStart>(`/api/me/tutorial/stages/${encodeURIComponent(stageId)}/runs`)
  await mockDelay(null)
  return (await mockServer()).startRun(stageId)
}

/** 같은 요청을 다시 보내도 같은 응답(서버 멱등) — 네트워크 오류 뒤 같은 칸으로 다시 보내도 안전 */
export async function judgeTutorialSituation(runId: string, situation: number, cell: number): Promise<Judgement> {
  if (dataSource === 'api') return api.post<Judgement>(`/api/me/tutorial/runs/${encodeURIComponent(runId)}/judge`, { situation, cell })
  await mockDelay(null, 250)
  return (await mockServer()).judge(runId, situation, cell)
}
