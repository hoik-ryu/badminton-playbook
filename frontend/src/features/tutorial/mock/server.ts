// 튜토리얼 서버 판정 Mock(VITE_DATA_SOURCE=mock 전용). backend/app/modules/tutorial/router.py의 회차·판정 규칙을 같은 모양으로 흉내 냄.
// 정답 데이터가 들어 있어 api 모드 빌드에는 포함되면 안 됨 → api.ts가 `import.meta.env.VITE_DATA_SOURCE === 'mock'`일 때만 동적으로 불러옴.
// 콘텐츠는 서버 파일 사본(./content/*.json) — content/registry.test.ts가 서버 파일과 같은지 확인.
import { ApiError } from '../../../lib/api'
import { readDb, updateDb } from '../../../lib/mock/db'
import { cellCenter } from '../court/cells'
import { MOCK_REGISTRY } from '../mockRegistry'
import type { Judgement, Move, RunResult, RunReview, RunStart, TutorialStage, Verdict } from '../api'

type Pt = [number, number]
type ServerSituation = {
  no: number
  description: string
  question: string
  start: { me: Pt; partner: Pt; opponents: Pt[] }
  shuttle: { from: Pt; stop: Pt; landing: Pt; landingCell: number } | null
  answer: number
  allow: number[]
  partnerCell: number
  partnerByCell?: Record<string, number>
  targets?: Record<string, Pt>
  explanation: { correct: string; better: string | null; wrong: string; wrongByCell?: Record<string, string> }
}
type ServerStage = { id: string; course: string; no: number; version: number; title: string; minutes: number; thumbnail: string | null; situations: ServerSituation[] }

const FILES = import.meta.glob<ServerStage>('./content/*.json', { eager: true, import: 'default' })
const CONTENT: Record<string, ServerStage> = Object.fromEntries(Object.values(FILES).map((s) => [s.id, s]))

const notFound = () => new ApiError(404, { code: 'stage_not_found', message: '준비 중인 스테이지입니다' })
const course = (id: string) => MOCK_REGISTRY.courses.find((c) => c.id === id)!
const gridOf = (c: ReturnType<typeof course>) => {
  const [, cols, rows] = /^grid-(\d+)x(\d+)$/.exec(c.grid)!
  return { id: c.grid, cols: Number(cols), rows: Number(rows) }
}

function released(stageId: string): ServerStage {
  const reg = MOCK_REGISTRY.stages.find((s) => s.id === stageId)
  if (!reg || !course(reg.course).released || !CONTENT[stageId]) throw notFound()
  return CONTENT[stageId]
}

export function getStage(stageId: string): TutorialStage {
  const st = released(stageId)
  const c = course(st.course)
  return {
    id: st.id, course: c.id, courseName: c.name, no: st.no, version: st.version, title: st.title, minutes: st.minutes, thumbnail: st.thumbnail,
    guided: c.guided, grid: gridOf(c), passRule: { numerator: MOCK_REGISTRY.passNumerator, denominator: MOCK_REGISTRY.passDenominator },
    // 공개 모양만(정답·허용 칸·떨어지는 지점·파트너 목표·해설 없음)
    situations: st.situations.map((s) => ({ no: s.no, description: s.description, question: s.question, start: s.start, shuttle: s.shuttle && { from: s.shuttle.from, stop: s.shuttle.stop } })),
  }
}

type Run = { id: string; stageId: string; userId: string; verdicts: string[]; expiresAt: number; completed: boolean }
// 회차는 Mock 저장소(브라우저 localStorage)에 둠 → 결과 화면 새로고침에도 복구(서버 tutorial_runs 흉내). 본인(Mock 세션) 회차만
const me = () => readDb().session ?? ''
const getRun = (id: string): Run | undefined => {
  const r = readDb().tutorialRuns?.[id]
  return r && r.userId === me() ? { id, ...r } : undefined
}
const putRun = (r: Run) => updateDb((db) => void ((db.tutorialRuns ??= {})[r.id] = { stageId: r.stageId, userId: r.userId, verdicts: r.verdicts, expiresAt: r.expiresAt, completed: r.completed }))
const CODE: Record<string, Verdict> = { c: 'correct', a: 'allow', w: 'wrong' }
const CHAR: Record<Verdict, string> = { correct: 'c', allow: 'a', wrong: 'w' }

export function startRun(stageId: string): RunStart {
  const st = released(stageId)
  const user = me()
  updateDb((db) => {
    // 같은 회원·스테이지의 끝나지 않은 회차는 대체, 만료 + 1일 지난 회차는 정리(서버와 같은 정책)
    for (const [k, r] of Object.entries(db.tutorialRuns ?? {}))
      if ((r.userId === user && r.stageId === stageId && !r.completed) || r.expiresAt < Date.now() - 24 * 60 * 60 * 1000) delete db.tutorialRuns![k]
  })
  const id = crypto.randomUUID()
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000
  putRun({ id, stageId, userId: user, verdicts: st.situations.map(() => '-'), expiresAt, completed: false })
  return { runId: id, stageId, situations: st.situations.length, expiresAt: new Date(expiresAt).toISOString() }
}

/** 테스트 도우미: 회차를 만료시킴(서버의 410 run_expired 흉내) */
export function expireRun(runId: string) {
  const r = getRun(runId)
  if (r) putRun({ ...r, expiresAt: Date.now() - 1 })
}

export function judge(runId: string, situation: number, cell: number): Judgement {
  const run = getRun(runId)
  if (!run) throw new ApiError(404, { code: 'run_not_found', message: '진행 중인 회차를 찾을 수 없습니다. 처음부터 다시 해 주세요' })
  if (run.completed) throw new ApiError(409, { code: 'run_completed', message: '이미 결과를 저장한 회차입니다' })
  if (run.expiresAt <= Date.now()) throw new ApiError(410, { code: 'run_expired', message: '회차 시간이 지났습니다. 처음부터 다시 해 주세요' })
  const st = released(run.stageId)
  const c = course(st.course)
  const { cols, rows } = gridOf(c)
  if (situation < 1 || situation > st.situations.length) throw new ApiError(422, { code: 'invalid_situation', message: '상황 번호가 올바르지 않습니다' })
  if (cell < 1 || cell > cols * rows) throw new ApiError(422, { code: 'invalid_cell', message: '칸 번호가 올바르지 않습니다' })
  const idx = situation - 1
  const s = st.situations[idx]!
  const verdict: Verdict = cell === s.answer ? 'correct' : s.allow.includes(cell) ? 'allow' : 'wrong'
  if (run.verdicts[idx] === '-') {
    if (run.verdicts.slice(0, idx).includes('-')) throw new ApiError(409, { code: 'out_of_order', message: '앞 상황부터 차례로 진행해 주세요', details: { next: run.verdicts.indexOf('-') + 1 } })
    run.verdicts[idx] = CHAR[verdict]
    putRun(run)
  }
  const first = CODE[run.verdicts[idx]!]!
  const move = (n: number): Move => {
    const p = s.partnerByCell?.[String(n)] ?? s.partnerCell
    return { cell: n, me: s.targets?.[String(n)] ?? cellCenter(n, cols, rows), partnerCell: p, partner: cellCenter(p, cols, rows) }
  }
  const e = s.explanation
  return {
    situation, verdict, firstVerdict: first, points: first === 'correct' ? 1 : 0, answer: s.answer, allow: s.allow,
    landing: s.shuttle?.landing ?? null, landingCell: s.shuttle?.landingCell ?? null, move: move(cell), correctMove: move(s.answer),
    reason: verdict === 'correct' ? e.correct : verdict === 'allow' ? (e.better ?? e.correct) : (e.wrongByCell?.[String(cell)] ?? e.wrong),
    correctReason: e.correct, judged: run.verdicts.filter((v) => v !== '-').length,
  }
}

/** 회차 완료(서버 PUT /stages/{id} {runId} 흉내). firstTime이면 진행 기록을 한 번 갱신, 다시 보내면 같은 결과(멱등) */
export function completeRun(runId: string, stageId: string): { result: RunResult; firstTime: boolean } {
  const run = getRun(runId)
  if (!run || run.stageId !== stageId) throw new ApiError(404, { code: 'run_not_found', message: '진행 중인 회차를 찾을 수 없습니다. 처음부터 다시 해 주세요' })
  released(stageId)
  const firstTime = !run.completed
  if (firstTime) {
    if (run.expiresAt <= Date.now()) throw new ApiError(410, { code: 'run_expired', message: '회차 시간이 지났습니다. 처음부터 다시 해 주세요' })
    if (run.verdicts.includes('-')) throw new ApiError(409, { code: 'run_incomplete', message: '아직 판정하지 않은 상황이 있습니다', details: { next: run.verdicts.indexOf('-') + 1 } })
    run.completed = true
    putRun(run)
  }
  return { result: resultOf(run), firstTime }
}

function resultOf(run: Run): RunResult {
  const v = run.verdicts.map((c) => CODE[c]!)
  const score = v.filter((x) => x === 'correct').length
  return {
    score, total: v.length, passed: score * MOCK_REGISTRY.passDenominator >= v.length * MOCK_REGISTRY.passNumerator,
    wrong: v.map((x, i) => ({ no: i + 1, x })).filter((r) => r.x !== 'correct').map((r) => ({ no: r.no, kind: r.x === 'allow' ? ('allow' as const) : ('wrong' as const) })),
  }
}

/** 완료된 본인 회차 조회(서버 GET /runs/{runId} 흉내). 틀린 상황만 정답 데이터 */
export function reviewRun(runId: string): RunReview {
  const run = getRun(runId)
  if (!run) throw new ApiError(404, { code: 'run_not_found', message: '진행 중인 회차를 찾을 수 없습니다. 처음부터 다시 해 주세요' })
  if (!run.completed) throw new ApiError(409, { code: 'run_incomplete', message: '아직 결과를 저장하지 않은 회차입니다' })
  const st = released(run.stageId)
  const { cols, rows } = gridOf(course(st.course))
  const review = st.situations
    .filter((_, i) => run.verdicts[i] !== 'c')
    .map((s) => {
      const p = s.partnerCell
      return {
        no: s.no, kind: run.verdicts[s.no - 1] === 'a' ? ('allow' as const) : ('wrong' as const), description: s.description, start: s.start,
        shuttle: s.shuttle && { from: s.shuttle.from, stop: s.shuttle.stop }, answer: s.answer, allow: s.allow,
        landing: s.shuttle?.landing ?? null, landingCell: s.shuttle?.landingCell ?? null,
        correctMove: { cell: s.answer, me: s.targets?.[String(s.answer)] ?? cellCenter(s.answer, cols, rows), partnerCell: s.partnerByCell?.[String(s.answer)] ?? p, partner: cellCenter(s.partnerByCell?.[String(s.answer)] ?? p, cols, rows) },
        correctReason: s.explanation.correct,
      }
    })
  return { runId, stageId: run.stageId, run: resultOf(run), review }
}
