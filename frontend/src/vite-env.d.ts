/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** 'mock'(기본) | 'api' — 기능별 데이터 접근 계층의 출처(src/lib/data/source.ts) */
  readonly VITE_DATA_SOURCE?: 'mock' | 'api'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
