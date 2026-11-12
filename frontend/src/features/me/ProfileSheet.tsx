import { useRef, useState } from 'react'
import { useBlocker } from 'react-router'

import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NoticeBox } from '../../components/NoticeBox'
import { ChoiceGrid, SegmentedControl } from '../../components/RadioButtons'
import { Sheet } from '../../components/Sheet'
import { TextField } from '../../components/TextField'
import { useToast } from '../../components/toastContext'
import { GRADES, type Gender, type Grade } from '../auth/types'
import { focusFirstError, validatePerson, type PersonErrors } from '../roster/personForm'
import { updateMyProfile, type Profile } from './api'

// SCR-122 프로필 수정(SCR-121 위 하단 시트, PC 가운데). US-019, FLOW-007-S2, AC-054·098, UXD-055·067
// - 가입 화면과 같은 입력: 이름, 성별 두 버튼, 급수 8개 버튼(4×2). 현재 값으로 채움
// - 저장 → 시트 닫힘 + 토스트 "저장했습니다"(운영진 명단에도 반영). 실패 → 위쪽 안내 상자, 입력값 유지
// - 바뀐 값이 있는 채로 닫기 → "변경 내용을 버릴까요?"
type Props = { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }

export function ProfileSheet({ profile, onClose, onSaved }: Props) {
  const toast = useToast()
  const [name, setName] = useState(profile.name)
  const [gender, setGender] = useState<Gender | null>(profile.gender)
  const [grade, setGrade] = useState<Grade | null>(profile.grade)
  const [errors, setErrors] = useState<PersonErrors>({})
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)
  const dirty = name !== profile.name || gender !== profile.gender || grade !== profile.grade
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !leaving.current && dirty && (currentLocation.state as { sheet?: string } | null)?.sheet !== (nextLocation.state as { sheet?: string } | null)?.sheet)

  const save = async () => {
    const e = validatePerson({ name, gender, grade, score: null, referrer: '' })
    setErrors(e)
    setFailed(false)
    if (Object.values(e).some(Boolean) || !gender || !grade) return focusFirstError(formRef.current, e)
    setSaving(true)
    try {
      const saved = await updateMyProfile({ name, gender, grade })
      leaving.current = true
      onSaved(saved)
      toast('저장했습니다')
      onClose()
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        open
        title="프로필 수정"
        onRequestClose={onClose}
        testId="profile-sheet"
        footer={
          <Button fullWidth loading={saving} onClick={() => void save()}>
            저장
          </Button>
        }
      >
        <div ref={formRef} data-scr="SCR-122" data-st={failed || Object.values(errors).some(Boolean) ? 'SCR-122-ST4' : saving ? 'SCR-122-ST2' : 'SCR-122-ST1'} className="flex flex-col gap-5 pt-1">
          {failed && <NoticeBox tone="danger">저장하지 못했습니다. 잠시 후 다시 시도해 주세요</NoticeBox>}
          <div data-field="name">
            <TextField label="이름" name="name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })) }} error={errors.name} />
          </div>
          <div data-field="gender">
            <SegmentedControl label="성별" options={['남', '여'] as const} value={gender} onChange={(v) => { setGender(v); setErrors((x) => ({ ...x, gender: undefined })) }} error={errors.gender} />
          </div>
          <div data-field="grade">
            <ChoiceGrid label="급수" kind="grade" options={GRADES} value={grade} onChange={(v) => { setGrade(v); setErrors((x) => ({ ...x, grade: undefined })) }} error={errors.grade} />
          </div>
        </div>
      </Sheet>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        title="변경 내용을 버릴까요?"
        tone="danger"
        confirmLabel="버리기"
        cancelLabel="계속 수정"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </>
  )
}
