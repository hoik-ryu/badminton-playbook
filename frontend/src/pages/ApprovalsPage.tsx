import { TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRevalidator } from 'react-router'

import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Checkbox } from '../components/Checkbox'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { PersonRow } from '../components/PersonRow'
import { StateView } from '../components/StateView'
import { useToast } from '../components/toastContext'
import { ALREADY_PROCESSED, approve, approveMany, listApplicants, reject, type Applicant } from '../features/approval/api'
import { isApiError } from '../lib/api'

// SCR-231 가입 승인(/ops/approvals). US-003, FLOW-001-S2·S3·S3a, AC-006, AC-007, UXD-012·014·015
// - 신청 순서 목록: 이름·성별·급수·지인(입력한 경우)·신청일, 같은 이름·성별 경고(UXD-014, 승인은 그대로 가능)
// - '승인' 바로 승인 + 토스트 / 체크 후 '선택한 n명 승인'(확인 창 없음, UXD-012) / '거절'은 한 명씩 확인 창(AC-007)
// - ST1 기본 / ST2 행 스켈레톤 / ST3 "승인을 기다리는 신청이 없습니다" / ST4 블록 오류·처리 실패 안내('이미 처리된 신청입니다' 후 새로고침) / ST5 회원 → SCR-004(가드)
// - 반응형: 모바일은 행 + 선택 시 하단 고정 버튼(하단 탭 위), PC(≥1024)는 표 형태 행 + 일괄 승인 버튼은 목록 위
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; items: Applicant[] }

const monthDay = (iso: string) => {
  const parts = new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month')}/${get('day')}`
}

export function ApprovalsPage() {
  const toast = useToast()
  const revalidator = useRevalidator()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null) // 처리 중인 행 id 또는 'bulk'
  const [notice, setNotice] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Applicant | null>(null)

  const refresh = useCallback(async () => {
    try {
      const items = await listApplicants()
      setLoad({ kind: 'ok', items })
      setSelected((prev) => new Set([...prev].filter((id) => items.some((a) => a.id === id))))
    } catch {
      setLoad({ kind: 'error' })
    }
    revalidator.revalidate() // 운영 탭 배지 갱신
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revalidator 객체는 렌더마다 바뀜
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const items = useMemo(() => (load.kind === 'ok' ? load.items : []), [load])
  const allChecked = items.length > 0 && selected.size === items.length
  const toggleAll = (on: boolean) => setSelected(on ? new Set(items.map((a) => a.id)) : new Set())
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key)
    setNotice(null)
    try {
      await work()
    } catch (e) {
      setNotice(isApiError(e) && e.code === ALREADY_PROCESSED ? '이미 처리된 신청입니다' : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요')
    } finally {
      setBusy(null)
      await refresh()
    }
  }

  const onApprove = (a: Applicant) =>
    run(a.id, async () => {
      await approve(a.id)
      toast(`${a.name} 님을 승인했습니다`)
    })

  const onBulk = () => {
    const ids = [...selected]
    return run('bulk', async () => {
      const n = await approveMany(ids)
      toast(`${n}명을 승인했습니다`)
    })
  }

  const onReject = async () => {
    const a = rejecting
    if (!a) return
    await run(a.id, async () => {
      await reject(a.id)
      toast(`${a.name} 님의 가입을 거절했습니다`)
    })
  }

  const st = load.kind === 'loading' ? 'SCR-231-ST2' : load.kind === 'error' || notice ? 'SCR-231-ST4' : items.length === 0 ? 'SCR-231-ST3' : 'SCR-231-ST1'
  const bulkLabel = `선택한 ${selected.size}명 승인`

  return (
    <section data-scr="SCR-231" data-st={st} className="flex flex-1 flex-col">
      <PageHeader title="가입 승인" leading="back" backTo="/ops" badge={load.kind === 'ok' && items.length > 0 ? <Badge tone="warning" shape="count" aria-label={`대기 ${items.length}건`}>{items.length}</Badge> : undefined} />
      {notice && (
        <div className="px-4 pb-2">
          <NoticeBox tone="danger">{notice}</NoticeBox>
        </div>
      )}
      {load.kind === 'loading' && <StateView kind="loading" rows={4} label="신청 목록을 불러오는 중" />}
      {load.kind === 'error' && (
        <StateView
          kind="error"
          title="신청 목록을 불러오지 못했습니다"
          description="네트워크 상태를 확인하고 다시 시도해 주세요"
          action={
            <Button variant="secondary" fullWidth onClick={() => { setLoad({ kind: 'loading' }); void refresh() }}>
              다시 시도
            </Button>
          }
        />
      )}
      {load.kind === 'ok' && items.length === 0 && <StateView kind="empty" title="승인을 기다리는 신청이 없습니다" />}
      {load.kind === 'ok' && items.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4">
            <Checkbox checked={allChecked} indeterminate={selected.size > 0 && !allChecked} onChange={toggleAll} label="전체 선택" />
            {/* PC: 일괄 승인 버튼은 목록 위 */}
            {selected.size > 0 && (
              <Button size="md" className="hidden" loading={busy === 'bulk'} onClick={() => void onBulk()}>
                {bulkLabel}
              </Button>
            )}
          </div>
          {/* PC 표 머리 */}
          <div aria-hidden className="hidden grid-cols-[2.5rem_minmax(0,1.2fr)_3.5rem_4.5rem_minmax(0,1fr)_5rem_11rem] gap-3 border-b border-line px-4 py-2 text-caption font-bold text-ink-muted">
            <span />
            <span>이름</span>
            <span>성별</span>
            <span>급수</span>
            <span>지인</span>
            <span>신청일</span>
            <span className="text-right">처리</span>
          </div>
          <ul aria-label="승인 대기 신청" className="m-0 list-none p-0">
            {items.map((a) => {
              const actions = (
                <div className="flex gap-2">
                  <Button variant="secondary" size="md" disabled={busy !== null} onClick={() => setRejecting(a)}>
                    거절
                  </Button>
                  <Button size="md" loading={busy === a.id} disabled={busy !== null && busy !== a.id} onClick={() => void onApprove(a)}>
                    승인
                  </Button>
                </div>
              )
              const warning = a.duplicateName && (
                <p className="m-0 flex items-center gap-1 text-caption font-bold text-warning-fg">
                  <TriangleAlert aria-hidden className="size-4 shrink-0" />
                  명단에 같은 이름이 있습니다
                </p>
              )
              const check = <Checkbox checked={selected.has(a.id)} onChange={(on) => toggle(a.id, on)} label={<span className="sr-only">{a.name} 선택</span>} />
              return (
                <li key={a.id} className="border-b border-line px-4" data-applicant={a.id}>
                  {/* 모바일 */}
                  <PersonRow
                    leading={check}
                    name={a.name}
                    meta={[a.gender, a.grade, a.referrer && `지인: ${a.referrer}`]}
                    sub={`${monthDay(a.appliedAt)} 신청`}
                    trailing={actions}
                    warning={warning}
                  />
                  {/* PC 표 형태 행 */}
                  <div className="hidden min-h-14 grid-cols-[2.5rem_minmax(0,1.2fr)_3.5rem_4.5rem_minmax(0,1fr)_5rem_11rem] items-center gap-3 py-2 text-body">
                    {check}
                    <div className="min-w-0">
                      <p className="m-0 truncate font-bold text-ink">{a.name}</p>
                      {warning}
                    </div>
                    <span className="text-ink-muted">{a.gender}</span>
                    <span className="text-ink-muted">{a.grade}</span>
                    <span className="truncate text-ink-muted">{a.referrer ?? '-'}</span>
                    <span className="text-ink-muted tabular-nums">{monthDay(a.appliedAt)}</span>
                    <div className="flex justify-end">{actions}</div>
                  </div>
                </li>
              )
            })}
          </ul>
          {/* 모바일: 선택이 있을 때 하단 고정(하단 탭 위) */}
          {selected.size > 0 && (
            <>
              <div aria-hidden className="h-20" />
              <div className="app-fixed-bar bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-20 bg-page px-4 py-3 shadow-sheet">
                <Button fullWidth loading={busy === 'bulk'} onClick={() => void onBulk()}>
                  {bulkLabel}
                </Button>
              </div>
            </>
          )}
        </>
      )}
      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={rejecting ? `${rejecting.name} 님의 가입을 거절할까요?` : ''}
        tone="danger"
        confirmLabel="거절"
        onConfirm={onReject}
      />
    </section>
  )
}
