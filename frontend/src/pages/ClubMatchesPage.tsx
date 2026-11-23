import { useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router'

import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { SegmentedControl } from '../components/RadioButtons'
import { Sheet } from '../components/Sheet'
import { TextField } from '../components/TextField'
import { createClubMatch, METHOD_LABEL, type ClubMethod } from '../features/clubmatch/api'
import { kstDate } from '../features/session/api'

// (5-B2) 이전 SCR-221 청백전 관리 목록(/ops/club-matches)은 SCR-111 통합 목록(MemberClubMatchesPage)으로 바뀌어 지웠습니다.
// 이 파일에는 통합 목록이 쓰는 SCR-222 만들기 시트만 남깁니다.

// SCR-222 청백전 만들기(모바일 하단 시트, PC 가운데 480). US-014, FLOW-005-S1, AC-042, UXD-034
// 방식(맨 위, 필수) · 날짜(기본값 오늘, 기기 날짜 선택기) · 이름(필수) → '만들기' → SCR-112 통합 상세(참가자 없음 ST9, 참가자 시트 자동 열림)
export function CreateSheet({ onClose, detailPath = (id) => `/club-matches/${id}` }: { onClose: () => void; detailPath?: (id: string) => string }) {
  const navigate = useNavigate()
  const [method, setMethod] = useState<ClubMethod | null>(null)
  const [date, setDate] = useState(kstDate())
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<{ method?: string; date?: string; name?: string }>({})
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const leaving = useRef(false)
  const dirty = method !== null || name !== '' || date !== kstDate()
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !leaving.current && dirty && currentLocation.pathname === nextLocation.pathname && (currentLocation.state as { sheet?: string } | null)?.sheet !== (nextLocation.state as { sheet?: string } | null)?.sheet)

  const submit = async () => {
    const e: typeof errors = {}
    if (!method) e.method = '방식을 골라 주세요'
    if (!date) e.date = '날짜를 골라 주세요'
    if (!name.trim()) e.name = '이름을 입력해 주세요'
    setErrors(e)
    setFailed(false)
    if (Object.keys(e).length || !method) return
    setSaving(true)
    try {
      const id = await createClubMatch({ method, date, name })
      leaving.current = true
      navigate(detailPath(id), { replace: true }) // 참가자 없음 → 상세 화면이 참가자 패널을 자동으로 엶(UXD-038)
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }
  return (
    <>
      <Sheet open title="청백전 만들기" onRequestClose={onClose} testId="create-sheet" footer={<Button fullWidth loading={saving} onClick={() => void submit()}>만들기</Button>}>
        <div data-scr="SCR-222" data-st={failed || Object.values(errors).some(Boolean) ? 'SCR-222-ST4' : saving ? 'SCR-222-ST2' : 'SCR-222-ST1'} className="flex flex-col gap-5 pt-1">
          {failed && <NoticeBox tone="danger">청백전을 만들지 못했습니다. 다시 시도해 주세요</NoticeBox>}
          <SegmentedControl label="방식" options={(['individual', 'team'] as const).map((v) => ({ value: v, label: METHOD_LABEL[v] }))} value={method} onChange={(v) => { setMethod(v); setErrors((x) => ({ ...x, method: undefined })) }} error={errors.method} />
          <TextField label="날짜" type="date" value={date} onChange={(e) => { setDate(e.target.value); setErrors((x) => ({ ...x, date: undefined })) }} error={errors.date} />
          <TextField label="이름" name="name" value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })) }} error={errors.name} />
        </div>
      </Sheet>
      <ConfirmDialog open={blocker.state === 'blocked'} onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()} title="입력한 내용을 버릴까요?" tone="danger" confirmLabel="버리기" cancelLabel="계속 입력" onConfirm={() => { if (blocker.state === 'blocked') blocker.proceed() }} />
    </>
  )
}
