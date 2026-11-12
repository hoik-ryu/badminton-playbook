import { HealthStatus } from '../features/health/HealthStatus'

// 개발용 백엔드 상태 확인(/dev/health). 서비스 화면이 아님(02 화면 목록 밖). API 동작은 기존 HealthStatus 그대로.
export function DevHealthPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>개발용 · 백엔드 상태</h1>
      <HealthStatus />
    </div>
  )
}
