import { useHealth } from './useHealth'

export function HealthStatus() {
  const { state, refetch } = useHealth()

  return (
    <section aria-labelledby="health-title">
      <h2 id="health-title">Backend status</h2>
      {state.status === 'loading' && <p role="status">Checking…</p>}
      {state.status === 'success' && (
        <dl>
          <dt>Status</dt>
          <dd data-testid="health-status">{state.data.status}</dd>
          <dt>Database</dt>
          <dd data-testid="health-database">{state.data.database}</dd>
          <dt>Version</dt>
          <dd>{state.data.version}</dd>
          <dt>Environment</dt>
          <dd>{state.data.environment}</dd>
        </dl>
      )}
      {state.status === 'error' && (
        <p role="alert">
          Error ({state.error.code}): {state.error.message}
        </p>
      )}
      <button type="button" onClick={refetch} disabled={state.status === 'loading'}>
        Refresh
      </button>
    </section>
  )
}
