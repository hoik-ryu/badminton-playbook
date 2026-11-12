// 시네마틱 인트로 재생 정책(사용자 결정 2026-11-11, 실험 범위 — 승인 UX Spec에는 인트로 화면이 없음: docs/workflow-proposals/brand-experience-deviations.md)
// - 최초 방문에서 루트('/')로 들어올 때만 한 번 재생. 새로고침·재방문·직접 진입 링크·인증 콜백 착지 경로에서는 생략
// - 움직임 줄이기 설정이면 재생하지 않고 본 것으로 기록
// - 저장소를 쓸 수 없으면(시크릿 모드·차단) 재생하지 않음(반복 재생 방지)
// - 개발 빌드에서만 '/?intro=replay'로 강제 재생(재생 확인용)
export const INTRO_SEEN_KEY = 'smapsh.introSeen.v1'

export type IntroReason = 'first-visit' | 'dev-replay' | 'deep-link' | 'seen' | 'reduced-motion' | 'storage-unavailable' | 'unsupported'

export type IntroDecision = { play: boolean; reason: IntroReason }

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function decideIntro(input: {
  pathname: string
  search: string
  reducedMotion: boolean | null // null = matchMedia 없음(지원 안 하는 환경)
  storage: StorageLike | null
  dev: boolean
}): IntroDecision {
  if (input.reducedMotion === null) return { play: false, reason: 'unsupported' }
  if (input.dev && new URLSearchParams(input.search).get('intro') === 'replay') return { play: !input.reducedMotion, reason: input.reducedMotion ? 'reduced-motion' : 'dev-replay' }
  if (input.pathname !== '/') return { play: false, reason: 'deep-link' }
  if (!input.storage) return { play: false, reason: 'storage-unavailable' }
  try {
    if (input.storage.getItem(INTRO_SEEN_KEY)) return { play: false, reason: 'seen' }
  } catch {
    return { play: false, reason: 'storage-unavailable' }
  }
  if (input.reducedMotion) {
    markIntroSeen(input.storage)
    return { play: false, reason: 'reduced-motion' }
  }
  return { play: true, reason: 'first-visit' }
}

export function markIntroSeen(storage: StorageLike | null) {
  try {
    storage?.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    /* 저장 실패는 무시 */
  }
}

/** 브라우저 환경에서 현재 진입 정보로 결정합니다(앱 시작 시 한 번). */
export function decideIntroForWindow(): IntroDecision {
  let storage: Storage | null = null
  try {
    storage = window.localStorage
  } catch {
    storage = null
  }
  const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : null
  return decideIntro({ pathname: window.location.pathname, search: window.location.search, reducedMotion, storage, dev: import.meta.env.DEV })
}
