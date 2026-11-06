import { api } from '../../lib/api'

export interface HealthResponse {
  status: 'ok' | 'degraded'
  app: string
  version: string
  environment: string
  database: 'ok' | 'unavailable'
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return api.get<HealthResponse>('/health', { signal })
}
