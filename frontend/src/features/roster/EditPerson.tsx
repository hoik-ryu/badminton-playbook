import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker } from 'react-router'

import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NoticeBox } from '../../components/NoticeBox'
import { RecordSummary } from '../../components/RecordSummary'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toastContext'
import { isApiError } from '../../lib/api'
import { eulReul } from '../../lib/josa'
import { deleteGuest, getGuestDeleteInfo, getMemberStatus, INVALID_SCORE, ROSTER_CONFLICT, updatePerson, type GuestDeleteInfo, type MemberStatus, type RosterPerson } from './api'
import { PersonFields } from './PersonFields'
import { focusFirstError, validatePerson, type PersonDraft, type PersonErrors } from './personForm'

// SCR-212 회원·게스트 편집(패널: 모바일 하단 시트 최대 90%, PC 명단 옆 패널 400).
// - 편집: 이름·성별·급수(필수)·점수(1–10, 미설정 허용). '저장' → 토스트·명단 갱신(AC-010, AC-098)
// - 회원 현황(RecordSummary audience=ops): 지인·랭크·전적·튜토리얼·권장 대상(ST2는 현황만 스켈레톤). 게스트는 현황 없음(ST7, AC-015)
// - 게스트 삭제 분기(C-26, UXD-022 r4): ① 진행 중 라운드 출전·② 확정된 청백전 미기록 경기 → ST8 비활성+안내 / ③ 확정 전 대진 → ST10 폐기 확인 / ④ 청백전 참가자로만 → ST11 / ⑤ 그 밖 → 확인 창
// - 닫기·다른 행(바뀐 값 있음) → 확인 창 "변경 내용을 버릴까요?"
// - 회원 비활성 처리·다시 활성화(ST9, US-020)는 후순위(B2 범위 밖)
type Props = { person: RosterPerson; onClose: () => void; onChanged: () => void }

const toDraft = (p: RosterPerson): PersonDraft => ({ name: p.name, gender: p.gender, grade: p.grade, score: p.score, referrer: '' })

export function EditPerson({ person, onClose, onChanged }: Props) {
  const toast = useToast()
  const [draft, setDraft] = useState<PersonDraft>(() => toDraft(person))
  const [errors, setErrors] = useState<PersonErrors>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [status, setStatus] = useState<MemberStatus | 'loading' | 'error' | null>(person.kind === 'member' ? 'loading' : null)
  const [deleteInfo, setDeleteInfo] = useState<GuestDeleteInfo | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const leaving = useRef(false) // 저장·삭제 성공 후 닫을 때는 확인하지 않음
  const original = toDraft(person)
  const dirty = draft.name !== original.name || draft.gender !== original.gender || draft.grade !== original.grade || draft.score !== original.score

  // 같은 사람을 다시 불러오면(저장 후·충돌 후) 값 갱신. 충돌로 다시 불러온 경우에는 안내를 남김
  const conflicted = useRef(false)
  useEffect(() => {
    setDraft(toDraft(person))
    setErrors({})
    setNotice(conflicted.current ? '다른 사람이 먼저 수정해 최신 내용으로 바꿨습니다. 확인한 뒤 다시 저장해 주세요' : null)
    conflicted.current = false
  }, [person])

  useEffect(() => {
    let alive = true
    if (person.kind === 'member') {
      setStatus('loading')
      getMemberStatus(person.id).then((s) => alive && setStatus(s), () => alive && setStatus('error'))
    } else {
      getGuestDeleteInfo(person.id).then((i) => alive && setDeleteInfo(i), () => alive && setDeleteInfo(null))
    }
    return () => {
      alive = false
    }
  }, [person.id, person.kind])

  // 바뀐 값이 있을 때 시트를 닫거나(✕·바깥·Esc·뒤로) 다른 행으로 바꾸면 확인
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !leaving.current && dirty && (currentLocation.state as { sheet?: string } | null)?.sheet !== (nextLocation.state as { sheet?: string } | null)?.sheet)

  const change = (patch: Partial<PersonDraft>, field: string) => {
    setDraft((d) => ({ ...d, ...patch }))
    setErrors((e) => (field in e ? { ...e, [field]: undefined } : e))
  }

  const save = async () => {
    const e = validatePerson(draft)
    setErrors(e)
    setNotice(null)
    if (Object.values(e).some(Boolean)) return focusFirstError(formRef.current, e)
    if (!draft.gender || !draft.grade) return
    setSaving(true)
    try {
      await updatePerson(person.kind, person.id, { name: draft.name.trim(), gender: draft.gender, grade: draft.grade, score: draft.score }, person.version)
      toast('저장했습니다')
      onChanged()
      leaving.current = true
      onClose() // 저장 후 시트를 닫음(PC·모바일 공통 하단 시트, UXD-022 r6)
    } catch (err) {
      if (isApiError(err) && err.code === INVALID_SCORE) setErrors({ score: '점수는 1–10 중에서 골라 주세요' })
      else if (isApiError(err) && err.code === ROSTER_CONFLICT) {
        // 동시 수정: 최신 명단을 다시 불러오면 위 효과가 입력을 최신 값으로 바꾸고 안내를 남김
        conflicted.current = true
        setNotice('다른 사람이 먼저 수정했습니다. 최신 내용을 불러오는 중입니다')
        onChanged()
      } else setNotice('저장하지 못했습니다. 입력한 값은 그대로 있습니다. 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await deleteGuest(person.id)
      toast(`${person.name} 게스트를 삭제했습니다`)
      leaving.current = true
      onChanged()
      onClose()
    } catch {
      setNotice(
        deleteInfo?.kind === 'draftLineup'
          ? '삭제하지 못했습니다. 대진과 게스트는 바뀌지 않았습니다'
          : deleteInfo?.kind === 'participantOnly'
            ? '삭제하지 못했습니다. 청백전 참가자와 게스트는 바뀌지 않았습니다'
            : '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요',
      )
    }
  }

  const blocked = deleteInfo?.kind === 'inRound' || deleteInfo?.kind === 'confirmedMatch'
  const deleteText = (() => {
    const who = eulReul(person.name)
    if (deleteInfo?.kind === 'draftLineup') return { title: `${who} 삭제하면 '${deleteInfo.place}'의 확정하지 않은 대진이 폐기됩니다. 삭제할까요?`, description: undefined }
    if (deleteInfo?.kind === 'participantOnly') return { title: `${who} 삭제할까요?`, description: `지난 기록에는 '삭제된 게스트'로 남습니다. '${deleteInfo.matchName}' 참가자 명단에서도 빠집니다` }
    return { title: `${who} 삭제할까요?`, description: "지난 기록에는 '삭제된 게스트'로 남습니다" }
  })()

  const st = notice || Object.values(errors).some(Boolean) ? 'SCR-212-ST4' : person.kind === 'guest' ? (blocked ? 'SCR-212-ST8' : 'SCR-212-ST7') : status === 'loading' ? 'SCR-212-ST2' : 'SCR-212-ST1'
  const titleBadge = <Badge tone={person.kind === 'member' ? 'info' : 'neutral'}>{person.kind === 'member' ? '회원' : '게스트'}</Badge>

  const body = (
    <div ref={formRef} data-scr="SCR-212" data-st={st} className="flex flex-col gap-6 pt-1">
      {notice && <NoticeBox tone="danger">{notice}</NoticeBox>}
      <PersonFields draft={draft} errors={errors} onChange={change} />
      {person.kind === 'member' && (
        <section aria-label="현황" className="flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="m-0 text-body font-bold text-ink">현황</h3>
          {status === 'loading' && (
            <div aria-busy="true" aria-label="현황을 불러오는 중" className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded-sm bg-surface motion-reduce:animate-none" />
              ))}
            </div>
          )}
          {status === 'error' && <NoticeBox tone="warning">현황을 불러오지 못했습니다</NoticeBox>}
          {status && typeof status === 'object' && <RecordSummary status={status} />}
        </section>
      )}
      {person.kind === 'guest' && (
        <section aria-label="게스트 삭제" className="flex flex-col items-start gap-2 border-t border-line pt-4">
          {deleteInfo?.kind === 'inRound' && <p className="m-0 text-body text-ink-muted">라운드가 끝난 뒤 삭제하세요</p>}
          {deleteInfo?.kind === 'confirmedMatch' && (
            <p className="m-0 text-body text-ink-muted">
              '{deleteInfo.matchName}'의 남은 경기 {deleteInfo.remaining}개에 포함되어 있습니다. 먼저 대체 선수를 정하세요{' '}
              <Link to={`/ops/club-matches/${deleteInfo.matchId}`} className="font-bold text-action">
                청백전으로
              </Link>
            </p>
          )}
          <Button variant="text" size="md" className="px-0 text-danger-fg" disabled={!deleteInfo || blocked} onClick={() => setConfirmDelete(true)}>
            게스트 삭제
          </Button>
        </section>
      )}
    </div>
  )
  const footer = (
    <Button fullWidth loading={saving} onClick={() => void save()}>
      저장
    </Button>
  )

  return (
    <>
      <Sheet open title={person.name} titleBadge={titleBadge} onRequestClose={onClose} footer={footer} testId="edit-sheet">
        {body}
      </Sheet>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        title="변경 내용을 버릴까요?"
        tone="danger"
        confirmLabel="버리기"
        cancelLabel="계속 편집"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={deleteText.title} description={deleteText.description} tone="danger" confirmLabel="삭제" onConfirm={remove} />
    </>
  )
}
