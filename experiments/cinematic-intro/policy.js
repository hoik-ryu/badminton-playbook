// 최초 방문 1회 정책(실제 앱 반영용 설계). PoC 기본 재생에는 쓰지 않고 ?policy=first-visit 일 때만 적용합니다.
// - 저장 값: 기기 안에만 두는 표시 하나(개인 식별 정보 아님, 서버로 보내지 않음 → NFR-006 최소 수집과 충돌 없음)
// - 저장소를 못 쓰면(시크릿 모드·차단) 재생하지 않음: 매번 반복 재생보다 생략이 덜 불편
// - 루트('/') 진입에서만 재생: 초대 링크·돌아갈 주소처럼 특정 주소로 들어오면 가로막지 않음(01 IA 5장)
export const INTRO_KEY = 'smapsh.introSeen.v1'

export function shouldPlayIntro({ pathname, reducedMotion, storage }) {
  if (pathname !== '/') return { play: false, reason: 'deep-link' }
  if (reducedMotion) return { play: false, reason: 'reduced-motion', markSeen: true }
  try {
    if (storage.getItem(INTRO_KEY)) return { play: false, reason: 'seen' }
  } catch {
    return { play: false, reason: 'storage-unavailable' }
  }
  return { play: true, reason: 'first-visit' }
}

export function markIntroSeen(storage) {
  try {
    storage.setItem(INTRO_KEY, '1')
  } catch {
    /* 저장 실패는 무시(다음 방문에서 storage-unavailable로 생략) */
  }
}
