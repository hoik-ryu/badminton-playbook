import { useRef, useState } from 'react'
import { useBlocker } from 'react-router'

import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NoticeBox } from '../../components/NoticeBox'
import { Sheet } from '../../components/Sheet'
import { isApiError } from '../../lib/api'
import { addGuest, addMember, INVALID_SCORE, type RosterPerson } from './api'
import { PersonFields } from './PersonFields'
import { focusFirstError, validatePerson, type PersonDraft, type PersonErrors } from './personForm'

// SCR-213 사람 추가(시트, PC 가운데 dialog). US-005·006, FLOW-003-S2·S2a·S3, AC-010·012·099, UXD-014·021·026·027·067
// - ST1 게스트 추가(기본) / ST7 회원 직접 추가: 제목 '회원 직접 추가', 지인 칸, 안내 "카카오로 가입하지 않는 회원만 직접 추가하세요"
// - 이름·성별·급수 필수, 점수 선택(다시 누르면 미설정), '추가' → 명단 반영(ST2 진행 표시, ST4 필드 오류·저장 실패 안내 상자)
// - 닫기(입력 있음) → 확인 창. SCR-203(참석 패널) 위 두 번째 시트·자동 참석 체크는 B3
type Props = { mode: 'guest' | 'member'; onClose: () => void; onAdded: (p: RosterPerson) => void }

const EMPTY: PersonDraft = { name: '', gender: null, grade: null, score: null, referrer: '' }

export function AddPersonSheet({ mode, onClose, onAdded }: Props) {
  const [draft, setDraft] = useState<PersonDraft>(EMPTY)
  const [errors, setErrors] = useState<PersonErrors>({})
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)
  const dirty = draft.name !== '' || draft.gender !== null || draft.grade !== null || draft.score !== null || draft.referrer !== ''
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !leaving.current && dirty && (currentLocation.state as { sheet?: string } | null)?.sheet !== (nextLocation.state as { sheet?: string } | null)?.sheet)

  const change = (patch: Partial<PersonDraft>, field: string) => {
    setDraft((d) => ({ ...d, ...patch }))
    setErrors((e) => (field in e ? { ...e, [field]: undefined } : e))
  }

  const submit = async () => {
    const e = validatePerson(draft)
    setErrors(e)
    setFailed(false)
    if (Object.values(e).some(Boolean)) return focusFirstError(formRef.current, e)
    if (!draft.gender || !draft.grade) return
    setSaving(true)
    try {
      const input = { name: draft.name.trim(), gender: draft.gender, grade: draft.grade, score: draft.score }
      const added = mode === 'member' ? await addMember({ ...input, referrer: draft.referrer }) : await addGuest(input)
      leaving.current = true
      onAdded(added)
      onClose()
    } catch (err) {
      if (isApiError(err) && err.code === INVALID_SCORE) setErrors({ score: '점수는 1–10 중에서 골라 주세요' })
      else setFailed(true)
      setSaving(false)
    }
  }

  const title = mode === 'member' ? '회원 직접 추가' : '게스트 추가'
  return (
    <>
      <Sheet
        open
        title={title}
        onRequestClose={onClose}
        testId="add-sheet"
        footer={
          <Button fullWidth loading={saving} onClick={() => void submit()}>
            추가
          </Button>
        }
      >
        <div ref={formRef} data-scr="SCR-213" data-st={failed || Object.values(errors).some(Boolean) ? 'SCR-213-ST4' : saving ? 'SCR-213-ST2' : mode === 'member' ? 'SCR-213-ST7' : 'SCR-213-ST1'} className="flex flex-col gap-5 pt-1">
          {mode === 'member' && <NoticeBox tone="info">카카오로 가입하지 않는 회원만 직접 추가하세요</NoticeBox>}
          {failed && <NoticeBox tone="danger">추가하지 못했습니다. 입력한 값은 그대로 있습니다. 다시 시도해 주세요</NoticeBox>}
          <PersonFields draft={draft} errors={errors} onChange={change} withReferrer={mode === 'member'} />
        </div>
      </Sheet>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        title="입력한 내용을 버릴까요?"
        tone="danger"
        confirmLabel="버리기"
        cancelLabel="계속 입력"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </>
  )
}
