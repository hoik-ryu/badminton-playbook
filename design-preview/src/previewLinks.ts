import manifest from '../preview.manifest.json'

// 프리뷰 안에서 화면 사이를 이동하는 주소. 제품 라우트가 아니라 프리뷰 해시(#화면/상태/폭)입니다.
// manifest에 상태가 등록된 화면이면 첫 상태로, 아직 skip인 화면이면 화면 ID만 넘겨 프리뷰 셸이 '미구현' 안내를 보여 줍니다.
type Entry = { states?: string[]; skip?: string }
const entries = manifest.screens as Record<string, Entry>

export function isImplemented(screenId: string): boolean {
  return Boolean(entries[screenId]?.states?.length)
}

export function previewHref(screenId: string): string {
  const states = entries[screenId]?.states
  return states?.length ? `#${screenId}/${states[0]}/mobile` : `#${screenId}`
}

export function skipReason(screenId: string): string | undefined {
  return entries[screenId]?.skip
}
