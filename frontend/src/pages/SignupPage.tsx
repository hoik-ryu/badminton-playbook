import { useRef, useState, type FormEvent } from 'react'
import { useBlocker, useNavigate } from 'react-router'

import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { ChoiceGrid, SegmentedControl } from '../components/RadioButtons'
import { TextField } from '../components/TextField'
import { cancelSignup, signup } from '../features/auth/api'
import { GRADES, isRestricted, type Gender, type Grade } from '../features/auth/types'

// SCR-002 가입 정보 입력(/signup). US-001, FLOW-001-S1·S1a·S1b, AC-001, AC-002, AC-099, UXD-067
// - ST1 기본('가입 신청' 활성, 제출할 때 검증) / ST2 로딩 / ST4 오류(필수 칸 아래 문구 + 첫 오류 칸 포커스, 제출 실패는 위쪽 안내 상자)
// - ST7 이미 가입됨: 새 계정을 만들지 않고 기존 계정 상태로 이동(화면 표시 없음)
// - 뒤로 가기(헤더·브라우저): 확인 창 "가입 신청을 그만둘까요?" → SCR-001(카카오 인증만 된 상태는 저장하지 않음)
// - 이름 최대 길이: 명세상 백엔드 스키마를 따름(백엔드 미구현이라 화면 제한 없음)
type Errors = Partial<Record<'name' | 'gender' | 'grade', string>>

export function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [referrer, setReferrer] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const done = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const genderRef = useRef<HTMLDivElement>(null)
  const gradeRef = useRef<HTMLDivElement>(null)

  // 가입 중 다른 화면으로 나가려 하면 확인(제출 성공 뒤에는 막지 않음)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !done.current && currentLocation.pathname !== nextLocation.pathname)

  // 고친 칸의 오류 문구는 바로 지움(다른 칸 오류는 다음 제출까지 유지)
  const clearError = (key: keyof Errors) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  const validate = (): Errors => {
    const e: Errors = {}
    if (!name.trim()) e.name = '이름을 입력해 주세요'
    if (!gender) e.gender = '성별을 골라 주세요'
    if (!grade) e.grade = '급수를 골라 주세요'
    return e
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    setFailed(false)
    if (e.name) return nameRef.current?.focus()
    if (e.gender) return genderRef.current?.querySelector<HTMLElement>('[role=radio]')?.focus()
    if (e.grade) return gradeRef.current?.querySelector<HTMLElement>('[role=radio]')?.focus()
    if (!gender || !grade) return
    setSubmitting(true)
    try {
      const me = await signup({ name: name.trim(), gender, grade, referrer: referrer.trim() || undefined })
      done.current = true
      navigate(isRestricted(me) ? '/account-status' : '/tutorial', { replace: true })
    } catch {
      setFailed(true)
      setSubmitting(false)
    }
  }

  const leave = async () => {
    done.current = true
    await cancelSignup().catch(() => {})
    if (blocker.state === 'blocked') blocker.proceed()
    else navigate('/login', { replace: true })
  }

  return (
    <section data-scr="SCR-002" data-st={failed || Object.values(errors).some(Boolean) ? 'SCR-002-ST4' : submitting ? 'SCR-002-ST2' : 'SCR-002-ST1'} className="flex flex-1 flex-col">
      <PageHeader title="가입 신청" leading="back" backTo="/login" />
      <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-6">
          {failed && <NoticeBox tone="danger">가입 신청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요</NoticeBox>}
          <TextField ref={nameRef} label="이름" name="name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); clearError('name') }} error={errors.name} />
          <div ref={genderRef}>
            <SegmentedControl label="성별" options={['남', '여'] as const} value={gender} onChange={(v) => { setGender(v); clearError('gender') }} error={errors.gender} />
          </div>
          <div ref={gradeRef}>
            <ChoiceGrid label="급수" kind="grade" options={GRADES} value={grade} onChange={(v) => { setGrade(v); clearError('grade') }} error={errors.grade} />
          </div>
          <TextField label="누구의 지인" optional name="referrer" value={referrer} onChange={(e) => setReferrer(e.target.value)} />
        </div>
        {/* 하단 고정 */}
        <div className="sticky bottom-0 bg-page px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <Button type="submit" fullWidth loading={submitting}>
            가입 신청
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.state === 'blocked' && blocker.reset()}
        title="가입 신청을 그만둘까요?"
        description="입력한 내용은 저장되지 않습니다."
        tone="danger"
        confirmLabel="그만두기"
        cancelLabel="계속 입력"
        onConfirm={leave}
      />
    </section>
  )
}
