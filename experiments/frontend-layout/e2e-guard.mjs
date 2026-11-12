// API 모드 브라우저 E2E 보호(check-*-api.mjs 공용). 조건을 하나라도 어기면 브라우저를 띄우기 전에 중단합니다.
// 1) BASE는 로컬 루프백이고, 사용자 개발 서버 포트(5173)·백엔드 포트(8000)가 아님
// 2) BASE의 Vite 프록시를 거친 /health가 APP_ENV=e2e 백엔드 응답(= 프록시 대상이 E2E 전용 서버)
//    E2E 서버는 시작할 때 DATABASE_URL이 임시 테스트 DB인지 스스로 검사(backend/app/core/dbguard.py)
// 3) (선택) E2E_BACKEND(백엔드 직접 주소)도 같은 e2e 서버인지
// 4) 브라우저: BASE와 다른 출처로 가는 API 성격의 요청(fetch·XHR·EventSource)은 모두 차단·기록(WebSocket은 route 대상 아님)
//    → 로컬 frontend/.env의 VITE_API_BASE_URL이 원본 서버를 가리켜도 요청이 나가지 않음
// 5) psql 직접 확인을 쓰는 스크립트: PSQL_ARGS가 임시 테스트 DB(포트 5432 아님, 이름 *_test·*_e2e)
export const RESERVED_PORTS = new Set(['5173', '8000'])
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])
const TEST_DB_NAME = /^(test|e2e)_[a-z0-9_]+$|^[a-z0-9_]+_(test|e2e)$/

export class E2EGuardError extends Error {}

async function healthEnv(url) {
  let res
  try {
    res = await fetch(url, { redirect: 'manual' })
  } catch (e) {
    throw new E2EGuardError(`${url}에 연결할 수 없습니다(${e.message})`)
  }
  if (!res.ok) throw new E2EGuardError(`${url} 응답이 ${res.status}입니다`)
  const body = await res.json().catch(() => ({}))
  return body.environment
}

export async function assertE2ETarget(base, { backend = process.env.E2E_BACKEND } = {}) {
  const u = new URL(base)
  if (!LOOPBACK.has(u.hostname)) throw new E2EGuardError(`BASE는 로컬 주소여야 합니다: ${u.origin}`)
  if (RESERVED_PORTS.has(u.port)) throw new E2EGuardError(`BASE 포트 ${u.port}는 개발 서버용이라 E2E에 쓰지 않습니다`)
  const viaProxy = await healthEnv(`${u.origin}/health`)
  if (viaProxy !== 'e2e') throw new E2EGuardError(`Vite 프록시 대상이 E2E 서버가 아닙니다(/health environment=${JSON.stringify(viaProxy)}). API_PROXY_TARGET을 APP_ENV=e2e 백엔드로 지정하세요`)
  if (backend) {
    const b = new URL(backend)
    if (!LOOPBACK.has(b.hostname) || RESERVED_PORTS.has(b.port)) throw new E2EGuardError(`E2E_BACKEND는 로컬의 별도 포트여야 합니다: ${b.origin}`)
    const direct = await healthEnv(`${b.origin}/health`)
    if (direct !== 'e2e') throw new E2EGuardError(`E2E_BACKEND가 APP_ENV=e2e가 아닙니다(environment=${JSON.stringify(direct)})`)
  }
  return { origin: u.origin }
}

export function assertTestPsqlArgs(args) {
  const parts = args.split(' ').filter(Boolean)
  const port = parts[parts.indexOf('-p') + 1]
  const host = parts[parts.indexOf('-h') + 1]
  const name = parts[parts.length - 1]
  if (parts.indexOf('-p') < 0 || port === '5432') throw new E2EGuardError('PSQL_ARGS는 기본 포트 5432(개발 DB 서버)가 아닌 임시 DB 포트를 -p로 지정해야 합니다')
  if (parts.indexOf('-h') < 0 || !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new E2EGuardError('PSQL_ARGS 호스트는 로컬 루프백(-h 127.0.0.1)이어야 합니다')
  if (!TEST_DB_NAME.test(name) || name === 'smapsh') throw new E2EGuardError(`PSQL_ARGS DB 이름은 *_test·*_e2e 형식이어야 합니다(현재 ${name})`)
}

const API_TYPES = new Set(['fetch', 'xhr', 'eventsource'])
/** 브라우저 컨텍스트에서 BASE 밖으로 가는 API 요청을 막고 기록. 끝에 blocked가 비어 있어야 통과 */
export async function lockToBase(context, base, blocked) {
  const origin = new URL(base).origin
  await context.route('**/*', (route) => {
    const req = route.request()
    const url = req.url()
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:') || !API_TYPES.has(req.resourceType())) return route.continue()
    blocked.push(`${req.method()} ${url}`)
    return route.abort('blockedbyclient')
  })
  return blocked
}

/** 이 브라우저에서 만드는 모든 컨텍스트에 lockToBase 적용. 반환한 배열에 차단 기록이 쌓임 */
export function guardBrowser(browser, base) {
  const blocked = []
  const open = browser.newContext.bind(browser)
  browser.newContext = async (options) => {
    const ctx = await open(options)
    await lockToBase(ctx, base, blocked)
    return ctx
  }
  return blocked
}

/** 끝에 호출: 차단된 외부 요청이 있으면 실패 처리 */
export function reportBlocked(blocked) {
  if (blocked.length) {
    console.log(`E2E GUARD FAILED: BASE 밖 API 요청 ${blocked.length}건 차단`, blocked.slice(0, 10))
    process.exitCode = 1
  } else console.log('E2E GUARD: BASE 밖 API 요청 0건')
}
