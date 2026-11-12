import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLoaderData, useNavigate } from 'react-router'

import symbolUrl from '../assets/brand/smapsh-symbol.svg'
import { Button } from '../components/Button'
import { NoticeBox } from '../components/NoticeBox'
import { TextField } from '../components/TextField'
import { clearKakaoFailures, devLogin, startKakaoLogin } from '../features/auth/api'
import { isApiError } from '../lib/api'
import { dataSource } from '../lib/data/source'
import { isRestricted } from '../features/auth/types'
import type { LoginData } from '../routes/guards'
import './LoginPage.css'

// SCR-001 로그인(/login). 비로그인 사용자의 첫 화면(UX Spec 01 5장). FLOW-001-S1·S1b·S1c, AC-005, AC-060, UXD-019
// - ST1 기본 / ST2 로딩(인증 확인 동안 버튼 진행 표시) / ST4 오류(위쪽 안내 상자 + '다시 시도', 같은 기기 2회 이상이면 다른 브라우저 안내)
// - 브랜드: 위 심볼(v4 B안 Geo Shuttle, 사용자 확정 2026-11-11, 투명 SVG·배경 상자 없음) + 아래 'SMAPSH' HTML 글자(teal #006D68 = color.action.primary)
//   자산: experiments/brand-assets/v4/final. 인트로는 v3 로고 그대로(이번에 바꾸지 않음)
// - 한 줄 소개: 02에 문구가 없어 넣지 않음(명세 공백)
// - 카카오 인증: Mock 모드는 가짜 인증으로 분기, api 모드는 백엔드 OAuth(/api/auth/kakao/login)
// - 운영진 로그인하기(로컬 개발 전용, 명세 밖): 서버가 켜 둔 경우(DEV_LOGIN_ENABLED + APP_ENV=local)에만 버튼 표시.
//   누르면 아래에 아이디·비밀번호 폼이 펼쳐짐 → FastAPI가 검증 → 기존 세션 쿠키 → /ops
export function LoginPage() {
  const { failCount, next, devLogin: devLoginAvailable } = useLoaderData() as LoginData
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [devOpen, setDevOpen] = useState(false)

  const start = async () => {
    setLoading(true)
    const result = await startKakaoLogin(next)
    if (result.kind === 'failed') {
      setLoading(false)
      navigate(`/login?error=kakao_failed${next ? `&next=${encodeURIComponent(next)}` : ''}`, { replace: true })
      return
    }
    clearKakaoFailures()
    if (result.kind === 'signup') navigate('/signup', { replace: true })
    else navigate(isRestricted(result.me) ? '/account-status' : (next ?? '/tutorial'), { replace: true })
  }

  return (
    <section className="login" aria-labelledby="login-title" data-scr="SCR-001" data-st={failCount ? 'SCR-001-ST4' : loading ? 'SCR-001-ST2' : 'SCR-001-ST1'}>
      {failCount > 0 && (
        <NoticeBox
          tone="danger"
          action={
            <Button variant="text" size="md" onClick={() => void start()} disabled={loading}>
              다시 시도
            </Button>
          }
        >
          <p className="m-0">카카오 로그인이 완료되지 않았습니다</p>
          {failCount >= 2 && <p className="m-0 mt-1 text-caption">카카오톡 안에서 열렸다면 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요</p>}
        </NoticeBox>
      )}
      <div className="login__brand">
        <img className="login__symbol" src={symbolUrl} alt="" width={120} height={120} />
        <h1 id="login-title" className="login__title">
          SMAPSH
        </h1>
      </div>
      <div className="login__actions">
        <Button variant="kakao" fullWidth loading={loading} onClick={() => void start()} aria-describedby={import.meta.env.DEV && dataSource === 'mock' ? 'login-dev-note' : undefined}>
          카카오로 시작하기
        </Button>
        {devLoginAvailable && (
          <>
            <Button variant="secondary" fullWidth aria-expanded={devOpen} aria-controls="dev-login-form" onClick={() => setDevOpen((o) => !o)}>
              운영진 로그인하기
            </Button>
            {devOpen && <DevLoginForm onDone={() => navigate('/ops', { replace: true })} />}
          </>
        )}
        {import.meta.env.DEV && dataSource === 'mock' && (
          <p id="login-dev-note" className="login__note">
            개발 단계: Mock 카카오 인증입니다(실제 카카오 로그인 미연결)
          </p>
        )}
      </div>
    </section>
  )
}

// 로컬 개발용 운영진 로그인 폼(서버 검증). 틀리면 위쪽 안내 상자, 빈 칸은 칸 아래 오류
function DevLoginForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const idRef = useRef<HTMLInputElement>(null)
  useEffect(() => idRef.current?.focus(), [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next = { username: username.trim() ? undefined : '아이디를 입력해 주세요', password: password ? undefined : '비밀번호를 입력해 주세요' }
    setErrors(next)
    setFailed(null)
    if (next.username || next.password) return
    setSubmitting(true)
    try {
      await devLogin(username.trim(), password)
      onDone()
    } catch (err) {
      setFailed(isApiError(err) && err.code === 'invalid_credentials' ? '아이디 또는 비밀번호가 올바르지 않습니다' : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요')
      setPassword('')
      setSubmitting(false)
    }
  }

  return (
    <form id="dev-login-form" aria-label="운영진 로그인" noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 pt-2">
      {failed && <NoticeBox tone="danger">{failed}</NoticeBox>}
      <TextField ref={idRef} label="아이디" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} error={errors.username} />
      <TextField label="비밀번호" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
      <Button type="submit" fullWidth loading={submitting}>
        로그인
      </Button>
      <p className="login__note">로컬 개발 전용 로그인입니다</p>
    </form>
  )
}
