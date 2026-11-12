/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// /api·/health 는 백엔드로 프록시합니다(같은 출처 → httpOnly 세션 쿠키가 그대로 동작).
// 카카오 Redirect URI(http://localhost:5173/api/auth/kakao/callback)도 이 프록시를 거쳐 FastAPI로 갑니다.
// API_PROXY_TARGET: 호스트 실행은 http://localhost:8000(기본), Docker Compose는 http://backend:8000
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:8000'
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': { target },
        '/health': { target },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // 테스트 전용 환경(로컬 frontend/.env보다 우선): API는 같은 출처 경로, 데이터 출처는 Mock.
      // 실제 네트워크 요청은 src/test/setup.ts가 기본 차단
      env: { VITE_API_BASE_URL: '', VITE_DATA_SOURCE: 'mock' },
    },
  }
})
