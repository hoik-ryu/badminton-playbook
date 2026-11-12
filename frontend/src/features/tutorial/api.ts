import { api, ApiError } from '../../lib/api'
import { featureSource, mockDelay } from '../../lib/data/source'
import { updateDb, type MockDb, type MockStageProgress } from '../../lib/mock/db'
import { STAGES, stagesOf } from './content/stages'
import { isPassed, mergeProgress, type StageProgress, type StageResult } from './engine/logic'

// 튜토리얼 진행 기록(SCR-101·103, FR-026, C-23, AC-094, NFR-006). 본인 것만.
// - 저장 항목은 회원 × 스테이지마다 통과 여부·최고 점수·최초 통과 시각 3개뿐. 상황별 선택 기록·틀린 상황은 저장하지 않음
// - 저장은 결과 화면에서 한 번의 원자적 갱신(멱등: 통과 OR, 최고 MAX, 최초 통과 시각은 처음 한 번)
// - api 모드: backend/app/modules/tutorial(I2). 요청은 {score, total}만 — 통과 여부·최고 점수는 서버가 다시 계산(클라이언트 값을 믿지 않음)
// - Mock 모드: 브라우저 저장소(로그인 사용자 id 기준), 같은 규칙으로 계산. 시나리오 콘텐츠는 앱에 포함된 정적 데이터
const dataSource = featureSource('tutorial')

/** 서버 거부 코드: 스테이지 상황 수가 서버 레지스트리와 다름(콘텐츠 배포 불일치) */
export const CONTENT_MISMATCH = 'content_mismatch'

export type ProgressMap = Record<string, StageProgress>

const fail = (code: string, message: string) => new ApiError(503, { code, message })

/** 샘플 회원의 '입문자 n · 왕초보 m 통과'를 스테이지 기록으로 펼침(처음 한 번) */
function ensureSeed(db: MockDb) {
  if (db.tutorialProgress) return
  db.tutorialProgress = {}
  for (const u of db.users) {
    const map: Record<string, MockStageProgress> = {}
    ;(['beginner', 'novice'] as const).forEach((level) => {
      stagesOf(level)
        .slice(0, u.tutorial[level])
        .forEach((s, i) => (map[s.id] = { passed: true, best: i % 2 ? 4 : 5, firstPassedAt: u.appliedAt }))
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

/** 스테이지 결과 저장(멱등). 저장 후의 기록을 돌려줌. 통과 여부는 점수·상황 수로 다시 계산 */
export async function saveStageResult(meId: string, result: Pick<StageResult, 'stageId' | 'score' | 'total'>): Promise<StageProgress> {
  if (dataSource === 'api') return api.put<StageProgress>(`/api/me/tutorial/stages/${encodeURIComponent(result.stageId)}`, { score: result.score, total: result.total })
  await mockDelay(null, 400)
  if (!STAGES.some((s) => s.id === result.stageId)) throw new ApiError(404, { code: 'stage_not_found', message: '준비 중인 스테이지입니다' })
  const out = updateDb((db) => {
    ensureSeed(db)
    if (db.failNextTutorialSave) {
      db.failNextTutorialSave = false // 한 번만 실패
      return null
    }
    // 회원 × 스테이지 한 건을 한 번에 갱신(멱등)
    const mine = (db.tutorialProgress![meId] ??= {})
    const merged = mergeProgress(mine[result.stageId], { score: result.score, passed: isPassed(result.score, result.total) }, new Date().toISOString())
    mine[result.stageId] = merged
    return merged
  })
  if (!out) throw fail('tutorial_save_failed', '기록을 저장하지 못했습니다')
  return out
}

/** 운영진 명단 현황(SCR-212, C-23): 난이도별 통과 스테이지 수 — 명단 api.ts가 같은 Mock 저장소에서 읽음 */
export function passedCountsOf(db: MockDb, userId: string): { beginner: number; novice: number } {
  ensureSeed(db)
  const map = db.tutorialProgress![userId] ?? {}
  const count = (level: 'beginner' | 'novice') => stagesOf(level).filter((s) => map[s.id]?.passed).length
  return { beginner: count('beginner'), novice: count('novice') }
}
