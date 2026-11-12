import { cn } from 'cn'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { OverflowMenu } from '../components/OverflowMenu'
import { PageHeader } from '../components/PageHeader'
import { Sheet, SidePanel } from '../components/Sheet'
import { useSheetRoute, useWideLayout } from '../components/sheetHooks'
import { StateView } from '../components/StateView'
import { isApiError } from '../lib/api'
import { eulReul } from '../lib/josa'
import { AddPersonSheet } from '../features/roster/AddPersonSheet'
import { ScoreEntrySheet } from '../features/roster/ScoreEntrySheet'
import { setMockScore, type RosterPerson } from '../features/roster/api'
import { AttendancePanel } from '../features/session/AttendancePanel'
import { closeSession, completeRound, confirmRound, generateRound, getSessionView, METHOD_LABEL, RELAX_LABEL, SESSION_ERRORS, setAttendance, startToday, type RoundView, type SessionPerson, type SessionView } from '../features/session/api'
import { CourtCard } from '../features/session/CourtCard'
import type { Relaxation } from '../features/session/lineup'
import { OptionsPanel } from '../features/session/OptionsPanel'
import { SwapSheet } from '../features/session/SwapSheet'

// SCR-202 오늘 운동(실시간 대진, /ops/session). US-008·010·011·012·013·022, FLOW-004, AC-019·024–026·034·036–039·041·056·061–063·101–104, UXD-001·002·003·005·006·007·010·023·076
// 대진 중심 한 화면(UXD-002): 라운드 번호·단계 → 참석·옵션 패널 버튼(요약) → 완화 요약 → 코트 카드 → 대기자 → 지난 라운드(접힘) → 하단 고정 행동 바(모바일) / 위쪽 오른쪽(PC)
// 상태: ST3 세션 없음 → ST1 생성 전(첫 라운드면 참석 패널 자동) → ST2 생성 중 → ST7 대진 검토 → ST8 진행 중 → ST1 다음 라운드 … → ST9 종료. ST4 오류, ST6 충돌, ST10 이전 날짜 미종료 배너
// 패널: 모바일 하단 시트(참석 70%·옵션 내용 높이), PC 오른쪽 옆 패널 400(참석/옵션 탭, 항상 열어 둘 수 있음)
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; view: SessionView }
type Confirm = 'confirm' | 'complete' | 'close' | 'closeStale' | null

const RELAX_TEXT: Record<Relaxation, string> = {
  gender: '성별 조합(혼복 우선)을 맞출 수 없어 이 경기는 남녀 구성이 맞지 않는 팀으로 묶였습니다. 수동 교체로 생긴 경우도 같은 표시를 씁니다.',
  balance: '더 앞선 규칙(게임 수 공평성·중복 회피·성별 조합)을 지키느라 이 경기의 두 팀 점수 합 차이를 가장 작게 맞추지 못했습니다.',
  noRepeat: '같은 날 이미 짝이었던 사람이 다시 같은 팀이 되었습니다. 다른 조합으로는 규칙을 지킬 수 없었거나 수동 교체로 생겼습니다.',
}
const mmdd = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}`
const mmddWeek = (d: string) => `${mmdd(d)}(${new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${d}T12:00:00+09:00`))})`
const toRosterPerson = (p: SessionPerson): RosterPerson => ({ id: p.id, kind: p.kind, name: p.name, gender: p.gender, grade: p.grade, score: p.score, tutorialRecommendedUnpassed: false })

export function SessionPage() {
  const desktop = useWideLayout() // 운영 셸은 PC에서도 모바일 배치(사용자 결정 2026-11-12)
  const { sheet, open, close } = useSheetRoute()
  const [viewingId, setViewingId] = useState<string | undefined>(undefined)
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [changedSinceDraft, setChangedSinceDraft] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [conflict, setConflict] = useState(false)
  const [panel, setPanel] = useState<'attendance' | 'options' | null>('attendance') // PC 옆 패널

  const refresh = useCallback(async () => {
    try {
      setLoad({ kind: 'ok', view: await getSessionView(viewingId) })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [viewingId])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const view = load.kind === 'ok' ? load.view : null
  const s = view?.session ?? null
  const phase = view?.phase
  const errorText = (e: unknown, fallback: string) => {
    if (!isApiError(e)) return fallback
    if (e.code === SESSION_ERRORS.minPlayers) return '최소 4명이 필요합니다'
    if (e.code === SESSION_ERRORS.roundInProgress) return e.message
    if (e.code === SESSION_ERRORS.closed) return '오늘 세션은 종료되었습니다'
    return fallback
  }
  const act = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setNotice(null)
    try {
      await work()
    } catch (e) {
      if (isApiError(e) && e.code === SESSION_ERRORS.conflict) setConflict(true)
      else setNotice(errorText(e, fallback))
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  const start = () =>
    act(async () => {
      const v = await startToday()
      setViewingId(undefined)
      if (v.phase === 'ready' && v.nextRoundNo === 1) {
        if (desktop) setPanel('attendance')
        else open('attendance') // 첫 라운드면 참석 패널 자동 열림(UXD-002)
      }
    }, '오늘 운동을 시작하지 못했습니다. 다시 시도해 주세요')

  const generate = async () => {
    if (!s) return
    setGenerating(true)
    setChangedSinceDraft(false)
    await act(() => generateRound(s.id), '대진을 만들지 못했습니다. 다시 시도해 주세요')
    setGenerating(false)
  }
  const onPanelChanged = () => {
    if (phase === 'review') setChangedSinceDraft(true)
    void refresh()
  }

  // ── 시트·패널 ──
  const attendanceOpen = !desktop && !!sheet?.startsWith('attendance')
  const scoresOpen = sheet === 'scores' || sheet === 'attendance/scores'
  const addOpen = sheet === 'attendance/add'
  const swapKey = sheet?.startsWith('swap:') ? sheet.slice(5) : null
  const swapTarget = swapKey && view?.current ? view.current.courts.flatMap((c) => [...c.team1, ...c.team2]).find((p) => p.key === swapKey) ?? null : null
  const relax = sheet?.startsWith('relax:') ? (sheet.slice(6) as Relaxation) : null
  const openAttendance = () => (desktop ? setPanel('attendance') : open('attendance'))
  const openOptions = () => (desktop ? setPanel('options') : open('options'))
  const openScores = () => (sheet?.startsWith('attendance') ? open('attendance/scores', { stack: true }) : open('scores'))

  const attendanceContent = view && <AttendancePanel view={view} onChanged={onPanelChanged} onAddGuest={() => open('attendance/add', { stack: true })} onScores={openScores} />
  const optionsContent = view && s && <OptionsPanel key={s.id} sessionId={s.id} options={s.options} onChanged={onPanelChanged} />

  // ── 표시 ──
  const st = load.kind === 'loading' ? 'SCR-202-ST2' : generating ? 'SCR-202-ST2' : conflict ? 'SCR-202-ST6' : notice ? 'SCR-202-ST4' : phase === 'noSession' ? 'SCR-202-ST3' : phase === 'closed' ? 'SCR-202-ST9' : phase === 'review' ? 'SCR-202-ST7' : phase === 'inProgress' ? 'SCR-202-ST8' : 'SCR-202-ST1'
  const roundNo = view?.current?.no ?? view?.nextRoundNo ?? 1
  const stage = phase === 'review' ? '대진 검토' : phase === 'inProgress' ? '진행 중' : '생성 전'
  const relaxedCount = view?.current?.courts.filter((c) => c.relaxations.length > 0).length ?? 0
  const unscored = view?.summary.unscored.length ?? 0
  const lastWaiting = view?.completed[0]?.waiting.filter((w) => view.attendance.some((a) => a.key === w.key && a.attending)) ?? []

  const actions = (
    <div className="flex w-full gap-2">
      {phase === 'ready' && (
        <Button className="flex-1" disabled={unscored > 0 || busy} loading={generating} onClick={() => void generate()} aria-describedby={unscored > 0 ? 'unscored-reason' : undefined}>
          대진 생성
        </Button>
      )}
      {phase === 'review' && (
        <>
          <Button variant="secondary" className="flex-1" disabled={busy} loading={generating} onClick={() => void generate()}>
            다시 생성
          </Button>
          <Button className="flex-1" disabled={busy || generating} onClick={() => setConfirm('confirm')}>
            확정
          </Button>
        </>
      )}
      {phase === 'inProgress' && (
        <Button className="flex-1" disabled={busy} onClick={() => setConfirm('complete')}>
          라운드 완료
        </Button>
      )}
    </div>
  )

  const roundBlock = (r: RoundView, live: boolean) => (
    <div className="grid gap-3">
      {r.courts.map((c) => (
        <CourtCard
          key={c.no}
          court={c}
          excluded={live && r.status === 'inProgress' ? view!.attendance.filter((a) => a.excludedNext).map((a) => a.key) : []}
          onPlayer={live && r.status === 'draft' ? (p) => open(`swap:${p.key}`) : undefined}
          onRelax={live ? (x) => open(`relax:${x}`) : undefined}
        />
      ))}
    </div>
  )

  const header = (
    <PageHeader
      title={s ? `${s.isToday ? '오늘 운동' : '운동'} ${mmdd(s.date)}` : '오늘 운동'}
      leading="back"
      backTo="/ops"
      badge={s && !s.isToday ? <Badge tone="info">{mmddWeek(s.date)} 세션</Badge> : undefined}
      trailing={
        s && s.status === 'open' ? (
          <OverflowMenu items={[{ label: '세션 종료', onSelect: () => setConfirm('close'), disabled: phase === 'inProgress', reason: '진행 중인 라운드를 먼저 완료하세요' }]} />
        ) : undefined
      }
    />
  )

  const main = (
    <div data-scr="SCR-202" data-st={st} className="flex min-w-0 flex-1 flex-col">
      {header}
      {view?.stale && (
        <div className="sticky top-0 z-20 px-4 pb-2">
          <NoticeBox
            tone="warning"
            action={
              <span className="flex shrink-0 gap-1">
                <Button variant="text" size="md" onClick={() => setViewingId(view.stale!.id)}>
                  이어서 열기
                </Button>
                <Button variant="text" size="md" onClick={() => setConfirm('closeStale')}>
                  종료
                </Button>
              </span>
            }
          >
            종료되지 않은 {mmddWeek(view.stale.date)} 세션이 있습니다
          </NoticeBox>
        </div>
      )}
      {s && !s.isToday && (
        <div className="px-4 pb-2">
          <Button variant="text" size="md" className="px-0" onClick={() => setViewingId(undefined)}>
            오늘 세션으로
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3 px-4 pb-4">
        {notice && <NoticeBox tone="danger" action={<Button variant="text" size="md" onClick={() => setNotice(null)}>닫기</Button>}>{notice}</NoticeBox>}
        {load.kind === 'loading' && <StateView kind="loading" rows={4} label="세션을 불러오는 중" />}
        {load.kind === 'error' && (
          <StateView kind="error" title="세션을 불러오지 못했습니다" description="네트워크 상태를 확인하고 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void refresh()}>다시 시도</Button>} />
        )}
        {phase === 'noSession' && (
          <StateView kind="empty" title="오늘 운동을 시작하세요" action={<Button fullWidth loading={busy} onClick={() => void start()}>오늘 운동 시작</Button>} />
        )}
        {phase === 'closed' && <NoticeBox tone="info">오늘 세션이 종료되었습니다. 오늘은 새 세션을 만들 수 없습니다</NoticeBox>}
        {view && s && phase !== 'closed' && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-title font-bold text-ink">
                {roundNo}라운드 · {stage}
              </p>
              {desktop && actions}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="md" onClick={openAttendance} aria-label={`참석 ${view.summary.count}명, 참석 체크 열기`}>
                참석 {view.summary.count}명 ›
              </Button>
              <Button variant="secondary" size="md" onClick={openOptions} aria-label={`옵션 ${METHOD_LABEL[s.options.method]}, 대진 옵션 열기`}>
                옵션: {METHOD_LABEL[s.options.method]} ›
              </Button>
            </div>
            {phase === 'ready' && unscored > 0 && (
              <button type="button" onClick={openScores} className="w-full text-left" id="unscored-reason">
                <NoticeBox tone="warning" action={<span aria-hidden className="text-title text-warning-fg">›</span>}>
                  점수 미설정 {unscored}명 · 점수를 매기면 대진을 만들 수 있습니다
                </NoticeBox>
              </button>
            )}
            {phase === 'ready' && view.nextRoundNo > 1 && lastWaiting.length > 0 && <NoticeBox tone="info">지난 라운드 대기자 {eulReul(lastWaiting.map((w) => w.name).join(', '))} 먼저 배정합니다</NoticeBox>}
            {phase === 'inProgress' && <NoticeBox tone="info">현재 라운드를 먼저 완료하세요</NoticeBox>}
            {changedSinceDraft && phase === 'review' && <NoticeBox tone="info">참석·옵션이 바뀌었습니다. 다시 생성하면 반영됩니다</NoticeBox>}
            {relaxedCount > 0 && <NoticeBox tone="warning">{relaxedCount}경기에서 규칙 완화</NoticeBox>}
            {generating ? (
              <div aria-busy="true" aria-label="대진을 만드는 중" className="grid gap-3">
                {Array.from({ length: Math.max(1, Math.min(view.courtCount, Math.floor(view.summary.count / 4))) }, (_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
                ))}
              </div>
            ) : (
              view.current && roundBlock(view.current, true)
            )}
            {view.current && view.current.waiting.length > 0 && !generating && (
              <section aria-label="대기자" className="rounded-md bg-surface px-4 py-3">
                <h3 className="m-0 mb-1 text-body font-bold text-ink">대기자 {view.current.waiting.length}명</h3>
                <p className="m-0 text-body text-ink">
                  {view.current.waiting.map((w, i) => (
                    <span key={w.key}>
                      {i > 0 && ' · '}
                      {w.name}({w.gender}, {w.games}게임)
                    </span>
                  ))}
                </p>
              </section>
            )}
          </>
        )}
        {view && view.completed.length > 0 && (
          <details className="rounded-md border border-line px-4 py-2" open={phase === 'closed'}>
            <summary className="flex min-h-11 cursor-pointer items-center text-body font-bold text-ink">지난 라운드 ({view.completed.length})</summary>
            <div className="flex flex-col gap-4 pb-2">
              {view.completed.map((r) => (
                <div key={r.no} className="flex flex-col gap-2">
                  <p className="m-0 text-body font-bold text-ink-muted">{r.no}라운드</p>
                  {roundBlock(r, false)}
                </div>
              ))}
            </div>
          </details>
        )}
        {!desktop && view && (phase === 'ready' || phase === 'review' || phase === 'inProgress') && <div aria-hidden className="h-20" />}
      </div>
      {!desktop && view && (phase === 'ready' || phase === 'review' || phase === 'inProgress') && (
        <div className="app-fixed-bar bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-20 border-t border-line bg-page px-4 py-3">{actions}</div>
      )}
    </div>
  )

  const staleView = view?.stale
  return (
    <div className="flex min-w-0">
      {main}
      {desktop && view && s && s.status === 'open' && panel && (
        <SidePanel
          title={panel === 'attendance' ? '참석 체크' : '대진 옵션'}
          onRequestClose={() => setPanel(null)}
          testId="session-panel"
        >
          <div role="tablist" aria-label="패널" className="mb-3 grid grid-cols-2 gap-2">
            {(['attendance', 'options'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={panel === t} onClick={() => setPanel(t)} className={cn('h-11 rounded-md border text-body', panel === t ? 'border-action bg-action font-bold text-on-action' : 'border-line-strong bg-page text-ink')}>
                {t === 'attendance' ? '참석' : '옵션'}
              </button>
            ))}
          </div>
          {panel === 'attendance' ? attendanceContent : optionsContent}
        </SidePanel>
      )}
      {attendanceOpen && view && (
        <Sheet open title="참석 체크" onRequestClose={close} height="70%" testId="attendance-sheet">
          {attendanceContent}
        </Sheet>
      )}
      {!desktop && sheet === 'options' && optionsContent && (
        <Sheet open title="대진 옵션" onRequestClose={close} testId="options-sheet">
          {optionsContent}
        </Sheet>
      )}
      {scoresOpen && view && view.summary.unscored.length > 0 && (
        <ScoreEntrySheet
          save={(p, score) => setMockScore(p.kind, p.id, score)} // 오늘 운동은 아직 Mock(I4 전): 사람도 Mock 샘플
         
          people={view.summary.unscored.map(toRosterPerson)}
          onClose={close}
          onAllDone={() => {
            close()
            void refresh() // 부모 화면 생성 버튼 활성
          }}
        />
      )}
      {addOpen && s && (
        <AddPersonSheet
          mode="guest"
          onClose={close}
          onAdded={(p) => {
            // UXD-027: 참석 패널에서 추가한 게스트는 바로 참석 체크
            void setAttendance(s.id, `guest:${p.id}`, true).then(onPanelChanged, () => setNotice('게스트는 추가했지만 참석 체크를 저장하지 못했습니다'))
          }}
        />
      )}
      {swapTarget && view && (
        <SwapSheet view={view} target={swapTarget} onClose={close} onSwapped={() => void refresh()} onConflict={() => setConflict(true)} />
      )}
      {relax && (
        <Sheet open title={RELAX_LABEL[relax]} onRequestClose={close} testId="relax-sheet">
          <p className="m-0 pb-2 text-body text-ink">{RELAX_TEXT[relax]}</p>
        </Sheet>
      )}
      <ConfirmDialog
        open={confirm === 'confirm'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`${roundNo}라운드 대진을 확정할까요?`}
        description="확정하면 바꿀 수 없습니다"
        confirmLabel="확정"
        onConfirm={() => (s ? act(() => confirmRound(s.id, s.version), '확정하지 못했습니다. 다시 시도해 주세요') : undefined)}
      />
      <ConfirmDialog
        open={confirm === 'complete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`${roundNo}라운드를 완료할까요?`}
        description="출전 기록이 오늘 이력에 쌓이고 다음 라운드를 만들 수 있습니다"
        confirmLabel="완료"
        onConfirm={() => (s ? act(() => completeRound(s.id), '라운드를 완료하지 못했습니다. 다시 시도해 주세요') : undefined)}
      />
      <ConfirmDialog
        open={confirm === 'close' || confirm === 'closeStale'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'closeStale' && staleView ? `${mmddWeek(staleView.date)} 세션을 종료할까요?` : '오늘 세션을 종료할까요?'}
        description={`종료한 세션은 복구할 수 없고, ${confirm === 'closeStale' ? '그 날짜에는' : '오늘은'} 새 세션을 만들 수 없습니다.${confirm === 'close' && phase === 'review' ? ' 확정하지 않은 대진은 폐기됩니다' : ''}`}
        tone="danger"
        confirmLabel="종료"
        onConfirm={() => {
          const id = confirm === 'closeStale' ? staleView?.id : s?.id
          return id ? act(() => closeSession(id), '세션을 종료하지 못했습니다. 다시 시도해 주세요') : undefined
        }}
      />
      <ConfirmDialog
        open={conflict}
        onOpenChange={(o) => !o && setConflict(false)}
        title="다른 운영진이 대진을 변경했습니다"
        description="확정은 처리되지 않았습니다. 닫으면 최신 상태를 보여 줍니다"
        tone="conflict"
        onConfirm={() => {
          setConflict(false)
          void refresh()
        }}
      />
    </div>
  )
}
