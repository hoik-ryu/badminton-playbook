import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../../lib/api'
import { fetchHealth, type HealthResponse } from './api'

type HealthState =
  | { status: 'loading' }
  | { status: 'success'; data: HealthResponse }
  | { status: 'error'; error: ApiError }

export function useHealth() {
  const [state, setState] = useState<HealthState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          error:
            error instanceof ApiError
              ? error
              : new ApiError(0, { code: 'unknown_error', message: String(error) }),
        })
      })
    return () => controller.abort()
  }, [reloadKey])

  const refetch = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  return { state, refetch }
}
