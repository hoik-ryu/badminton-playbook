import { Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router'

import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { SegmentedControl } from '../components/RadioButtons'
import { Sheet } from '../components/Sheet'
import { useSheetRoute } from '../components/sheetHooks'
import { StateView } from '../components/StateView'
import { TextField } from '../components/TextField'
import { createClubMatch, listClubMatches, METHOD_LABEL, type ClubMatchListItem as ClubMatchSummary, type ClubMethod } from '../features/clubmatch/api'
import { ClubMatchListItem } from '../features/clubmatch/ClubMatchListItem'
import { kstDate } from '../features/session/api'

// SCR-221 청백전 관리 목록(/ops/club-matches). US-014, FLOW-005-S1, AC-042, UXD-047·075
// - 최신순 목록(CMP-043): 날짜·이름, 방식 배지, 상태 배지('대진 미확정'·'진행 중'·'종료'), 진행 중 요약·미기록 수 / 종료 최종 결과
// - '만들기' → SCR-222 시트 / 항목 → SCR-223
// - ST1 / ST2 스켈레톤 / ST3 "아직 청백전이 없습니다" + '청백전 만들기' / ST4 블록 오류 / ST5 회원 → SCR-004(가드)
// - PC: 한 열 최대 960, 미기록 수 오른쪽 정렬
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; items: ClubMatchSummary[] }

export function ClubMatchesPage() {
  const { sheet, open, close } = useSheetRoute()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const refresh = useCallback(async () => {
    try {
      setLoad({ kind: 'ok', items: await listClubMatches() })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const st = load.kind === 'loading' ? 'SCR-221-ST2' : load.kind === 'error' ? 'SCR-221-ST4' : load.items.length === 0 ? 'SCR-221-ST3' : 'SCR-221-ST1'
  return (
    <section data-scr="SCR-221" data-st={st} className="flex w-full max-w-[960px] flex-col">
      <PageHeader
        title="청백전 관리"
        leading="back"
        backTo="/ops"
        trailing={
          <Button size="md" className="mr-3" onClick={() => open('create')}>
            <Plus aria-hidden />
            만들기
          </Button>
        }
      />
      <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
        {load.kind === 'loading' && <StateView kind="loading" rows={3} label="청백전을 불러오는 중" />}
        {load.kind === 'error' && <StateView kind="error" title="청백전을 불러오지 못했습니다" description="네트워크 상태를 확인하고 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} />}
        {load.kind === 'ok' && load.items.length === 0 && <StateView kind="empty" title="아직 청백전이 없습니다" action={<Button fullWidth onClick={() => open('create')}>청백전 만들기</Button>} />}
        {load.kind === 'ok' && load.items.length > 0 && (
          <ul aria-label="청백전" className="m-0 flex list-none flex-col gap-3 p-0">
            {load.items.map((m) => (
              <ClubMatchListItem
                key={m.id}
                to={`/ops/club-matches/${m.id}`}
                {...m}
                summary={
                  <>
                    {m.status === 'confirmed' && m.team && (
                      <span className="text-body font-bold tabular-nums">
                        청 {m.team.blue} : 백 {m.team.white}
                      </span>
                    )}
                    {m.winnerText && <span className="text-body font-bold">{m.winnerText}</span>}
                  </>
                }
                trailing={m.status === 'confirmed' ? <span className="shrink-0 text-body tabular-nums text-ink-muted">미기록 {m.unrecorded}</span> : undefined}
              />
            ))}
          </ul>
        )}
      </div>
      {sheet === 'create' && <CreateSheet onClose={close} />}
    </section>
  )
}

// SCR-222 청백전 만들기(모바일 하단 시트, PC 가운데 480). US-014, FLOW-005-S1, AC-042, UXD-034
// 방식(맨 위, 필수) · 날짜(기본값 오늘, 기기 날짜 선택기) · 이름(필수) → '만들기' → SCR-223(참가자 없음 상태, 패널 자동 열림)
function CreateSheet({ onClose }: { onClose: () => void }) {
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
      navigate(`/ops/club-matches/${id}`, { replace: true }) // 참가자 없음 → 상세 화면이 참가자 패널을 자동으로 엶(UXD-038)
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
