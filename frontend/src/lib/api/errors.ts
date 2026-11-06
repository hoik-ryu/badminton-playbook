/** Error envelope returned by the backend: {"error": {"code", "message", "details"}}. */
export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

/** status 0 means the request never reached the server (network error, CORS, abort). */
export const NETWORK_ERROR_STATUS = 0

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
