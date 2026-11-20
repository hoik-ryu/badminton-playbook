// 서버 스테이지 레지스트리(backend/app/modules/tutorial/stage_registry.json)의 Mock 사본.
// Mock 모드의 진행 기록 씨앗·운영진 통과 현황 계산에만 씁니다. registry.test.ts가 서버 파일과 같은지 확인합니다.
// (사용자 결정 2026-11-19, docs/workflow-proposals/tutorial-mvp-implementation-plan.md) 콘텐츠·과정 목록은 서버 API로 옮겨 가며,
// 그때 이 파일은 Mock 픽스처로 대체됩니다.
export type RegistryCourse = {
  id: string
  name: string
  order: number
  grid: string
  released: boolean
  guided: boolean
  description: string | null
  icon: string | null
}
export type RegistryStage = { id: string; course: string; no: number; situations: number }

export const MOCK_REGISTRY: { passNumerator: number; passDenominator: number; courses: RegistryCourse[]; stages: RegistryStage[] } = {
  passNumerator: 7,
  passDenominator: 10,
  courses: [
    { id: 'intro', name: '입문자', order: 1, grid: 'grid-2x3', released: true, guided: true, description: '처음 시작하는 분을 위한 코트와 번호', icon: 'AST-035' },
    { id: 'starter', name: '왕초급', order: 2, grid: 'grid-2x3', released: true, guided: false, description: '기본 수비 대형과 위치 판단', icon: 'AST-036' },
    { id: 'basic', name: '초급', order: 3, grid: 'grid-3x3', released: true, guided: false, description: '공격·수비 전환과 복귀 위치', icon: 'AST-037' },
    { id: 'mid', name: '중급', order: 4, grid: 'grid-5x3', released: false, guided: false, description: null, icon: null },
    { id: 'high', name: '고급', order: 5, grid: 'grid-5x3', released: false, guided: false, description: null, icon: null },
  ],
  stages: [
    { id: 'intro-1-v1', course: 'intro', no: 1, situations: 5 },
    { id: 'intro-2-v1', course: 'intro', no: 2, situations: 5 },
    { id: 'starter-1-v1', course: 'starter', no: 1, situations: 5 },
    { id: 'starter-2-v1', course: 'starter', no: 2, situations: 5 },
    { id: 'starter-3-v1', course: 'starter', no: 3, situations: 5 },
    { id: 'basic-1-v1', course: 'basic', no: 1, situations: 5 },
    { id: 'basic-2-v1', course: 'basic', no: 2, situations: 5 },
    { id: 'basic-3-v1', course: 'basic', no: 3, situations: 5 },
  ],
}

export const releasedCourses = () => [...MOCK_REGISTRY.courses].filter((c) => c.released).sort((a, b) => a.order - b.order)
export const courseStageIds = (course: string) =>
  MOCK_REGISTRY.stages.filter((s) => s.course === course).sort((a, b) => a.no - b.no).map((s) => s.id)

/** 운영진 회원 현황의 과정별 통과 수(서버 CoursePassCount와 같은 모양, AC-100 r7) */
export type CoursePassCount = { course: string; name: string; passed: number; total: number }

/** 스테이지 목록 정보(서버 content/<id>.json의 title·minutes·thumbnail 사본, Mock 모드 SCR-101용). registry.test.ts가 서버 파일과 비교 */
export const MOCK_STAGE_META: Record<string, { title: string; minutes: number; thumbnail: string | null }> = {
  'intro-1-v1': { title: '코트와 번호 익히기', minutes: 2, thumbnail: 'AST-027' },
  'intro-2-v1': { title: '기본 자리와 복귀', minutes: 2, thumbnail: 'AST-028' },
  'starter-1-v1': { title: '나란히 수비 대형', minutes: 3, thumbnail: 'AST-029' },
  'starter-2-v1': { title: '담당 영역 나누기', minutes: 3, thumbnail: 'AST-030' },
  'starter-3-v1': { title: '셔틀콕을 받은 뒤 복귀', minutes: 3, thumbnail: 'AST-031' },
  'basic-1-v1': { title: '앞뒤 공격 대형', minutes: 4, thumbnail: 'AST-032' },
  'basic-2-v1': { title: '공격에서 수비로 전환', minutes: 4, thumbnail: 'AST-033' },
  'basic-3-v1': { title: '수비에서 공격으로 전환과 좌우 수비', minutes: 4, thumbnail: 'AST-034' },
}
