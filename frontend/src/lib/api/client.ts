import { ApiError, NETWORK_ERROR_STATUS, type ApiErrorBody } from './errors'

const DEFAULT_BASE_URL = 'http://localhost:8000'

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }

function isErrorEnvelope(value: unknown): value is { error: ApiErrorBody } {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Minimal fetch wrapper. Resolves with the parsed JSON body on 2xx and
 * throws ApiError otherwise (including network failures).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options
  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, init)
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(NETWORK_ERROR_STATUS, {
      code: 'network_error',
      message: 'Unable to reach the server',
      details: cause instanceof Error ? cause.message : cause,
    })
  }

  const data = await parseBody(response)
  if (!response.ok) {
    if (isErrorEnvelope(data)) throw new ApiError(response.status, data.error)
    throw new ApiError(response.status, {
      code: `http_${response.status}`,
      message: response.statusText || 'Request failed',
      details: data,
    })
  }
  return data as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
}
