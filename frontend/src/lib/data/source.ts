// 데이터 출처 선택: 'mock'(기본, 저장소 안 가짜 어댑터) | 'api'(실제 백엔드).
// 기능별 api.ts가 이 값으로 Mock 어댑터와 api.get/post 호출 중 하나를 고릅니다. 화면 코드는 출처를 모릅니다.
export type DataSource = 'mock' | 'api'

export const dataSource: DataSource = import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'mock'

// 백엔드가 준비된 기능만 VITE_DATA_SOURCE를 따릅니다. 나머지는 api 모드에서도 Mock(브라우저 저장소)으로 동작합니다.
// (2026-11-12: 인증·가입 승인·역할·본인 프로필·명단(I1)·튜토리얼 진행(I2)·청백전(운영진·회원 조회·마이페이지 전적, I3-d4) DB 전환.
//  오늘 운동(session)은 I4 전까지 Mock — 실제 회원과 연결되지 않음)
export type Feature = 'auth' | 'approval' | 'role' | 'profile' | 'roster' | 'session' | 'clubmatch' | 'tutorial'
const BACKEND_READY: readonly Feature[] = ['auth', 'approval', 'role', 'profile', 'roster', 'tutorial', 'clubmatch']

export function featureSource(feature: Feature): DataSource {
  return dataSource === 'api' && BACKEND_READY.includes(feature) ? 'api' : 'mock'
}

/** Mock 응답에 약간의 지연을 줘 로딩 상태가 실제처럼 보이게 합니다(테스트에서는 항상 0). */
export function mockDelay<T>(value: T, ms = 150): Promise<T> {
  const wait = import.meta.env.MODE === 'test' ? 0 : ms
  return new Promise((resolve) => setTimeout(() => resolve(value), wait))
}
