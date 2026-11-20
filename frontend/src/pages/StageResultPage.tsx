import { AlertCircle, Check, ChevronDown, LoaderCircle, Play, RotateCcw, Snail } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useBlocker, useLocation, useParams, useRouteLoaderData, useSearchParams } from 'react-router'

import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  completeTutorialRun,
  getMyTutorialProgress,
  getTutorialCourses,
  getTutorialRun,
  type ProgressMap,
  type ReviewSituation,
  type RunResult,
  type StageSave,
  type TutorialCourses,
} from '../features/tutorial/api'
import { StadiumCourt } from '../features/tutorial/court/StadiumCourt'
import { recoveryOf, type Recovery } from '../features/tutorial/play/logic'
import { ApiError } from '../lib/api'
import { passScore } from '../features/tutorial/progress'
import type { ShellData } from '../routes/guards'
import type { RunSummary } from './StagePlayPage'

// SCR-103 스테이지 결과(/tutorial/stages/:stageId/result?run=회차 ID, 탭바 숨김) — UX Spec r5(02 SCR-103), DD r6(VD-037·045·047·048), Preview r3 승인
// 셸 VD-045(V05-B 밴드·구획형): 가운데 점수 → 통과 표시·기준 → 구획(최고 점수 · 진행률 · 틀린 상황) → 아래 고정 버튼
// 저장(6단계, D-T2): 화면에 들어오면 PUT /stages/{id} {runId}(클라이언트 점수 없음, 멱등 — 다시 보내도 한 번만 반영)
//  - 표시는 서버 응답(score·total·passed·best·firstPassedAt) 기준. 저장 전에는 SCR-102가 넘긴 결과(state.run)를 바로 보여 주고 '기록 저장 중'(ST2)
//  - 저장 실패는 성공처럼 보이지 않음: 안내 상자 + '다시 저장'(ST4), 진행률 숨김, 저장 전 나가면 확인 창
//  - 새로고침·직접 접근: 주소의 회차 ID로 같은 PUT(이미 완료면 그대로 결과) + GET /runs/{runId}(완료된 본인 회차만)로 복구
//  - 틀린 상황 다시 보기: GET /runs/{runId}의 정답 데이터로 경기장 재생(새 판정 요청 없음, 고른 칸은 저장·표시하지 않음)
type Save = { kind: 'saving' } | { kind: 'saved'; value: StageSave } | { kind: 'error'; recovery: Recovery; code: string }
type Load<T> = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; value: T }

export function StageResultPage() {
  const { stageId = '' } = useParams()
  const [params] = useSearchParams()
  const runId = params.get('run')
  // 회차 없이 주소로 들어오면 결과가 없으므로 SCR-102로(02 SCR-103 '권한 없음')
  if (!runId) return <Navigate to={`/tutorial/stages/${stageId}`} replace />
  return <Result key={runId} stageId={stageId} runId={runId} />
}

function Result({ stageId, runId }: { stageId: string; runId: string }) {
  const data = useRouteLoaderData('member') as ShellData | undefined
  const meId = data?.me.id ?? ''
  const summary = (useLocation().state as { run?: RunSummary } | null)?.run
  const fresh = summary?.runId === runId ? summary : undefined
  const [save, setSave] = useState<Save>({ kind: 'saving' })
  const [prevBest, setPrevBest] = useState<number | null>(null)
  const [courses, setCourses] = useState<Load<TutorialCourses>>({ kind: 'loading' })
  const [progress, setProgress] = useState<Load<ProgressMap>>({ kind: 'loading' })
  const [review, setReview] = useState<Load<ReviewSituation[]>>({ kind: 'loading' })
  const saving = useRef(false)
  const prevChecked = useRef(false)

  const doSave = useCallback(async () => {
    if (saving.current) return // 저장 중 중복 요청 막음('다시 저장' 비활성과 같은 뜻)
    saving.current = true
    setSave({ kind: 'saving' })
    try {
      // 최고 점수 갱신 표시용: 처음 들어왔을 때만 저장 전 기록을 한 번 읽음(실패해도 저장은 진행)
      if (fresh && !prevChecked.current) {
        prevChecked.current = true
        try {
          setPrevBest((await getMyTutorialProgress(meId))[stageId]?.best ?? 0)
        } catch {
          setPrevBest(null)
        }
      }
      const saved = await completeTutorialRun(meId, stageId, runId)
      setSave({ kind: 'saved', value: saved })
      // 저장 뒤: 진행률(본인 기록)·틀린 상황 정답 데이터
      void getMyTutorialProgress(meId).then(
        (v) => setProgress({ kind: 'ok', value: v }),
        () => setProgress({ kind: 'error' }),
      )
      void loadReview()
    } catch (e) {
      setSave({ kind: 'error', recovery: recoveryOf(e), code: e instanceof ApiError ? e.code : '' })
    } finally {
      saving.current = false
    }
  }, [meId, stageId, runId, fresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadReview = useCallback(async () => {
    setReview({ kind: 'loading' })
    try {
      setReview({ kind: 'ok', value: (await getTutorialRun(runId)).review })
    } catch {
      setReview({ kind: 'error' })
    }
  }, [runId])

  useEffect(() => {
    void doSave()
    getTutorialCourses().then(
      (v) => setCourses({ kind: 'ok', value: v }),
      () => setCourses({ kind: 'error' }),
    )
  }, [doSave])

  // 저장 전 나가면 확인(02 SCR-103-ST4). 저장이 끝났으면 막지 않음
  const saved = save.kind === 'saved'
  // 회차 상세가 지워진 경우(새로고침·직접 접근): 저장할 결과가 없으므로 나가기를 막지 않음
  const gone = save.kind === 'error' && save.code === 'run_not_found' && !fresh
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !saved && !gone && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search)

  // 표시할 결과: 저장 뒤에는 서버 값, 저장 전에는 SCR-102가 넘긴 값(서버 판정 점수의 합)
  const run: RunResult | null = saved ? save.value.run : fresh ? { score: fresh.score, total: fresh.total, passed: fresh.score >= passScore(fresh.total), wrong: fresh.wrong } : null
  const coursesOk = courses.kind === 'ok' ? courses.value : null
  const released = coursesOk ? coursesOk.courses.filter((c) => c.released) : []
  const all = released.flatMap((c) => c.stages.map((s) => ({ course: c, stage: s })))
  const here = all.findIndex((x) => x.stage.id === stageId)
  const meta = here >= 0 ? all[here] : undefined
  // 다음 스테이지: 같은 과정의 다음, 마지막이면 다음 과정의 첫 스테이지, 초급 3단계 뒤에는 없음(02 SCR-103)
  const next = here >= 0 ? all[here + 1] : undefined
  const passed = run?.passed ?? false
  const st = !run ? 'SCR-103-ST2' : save.kind === 'error' ? 'SCR-103-ST4' : save.kind === 'saving' ? 'SCR-103-ST2' : passed ? 'SCR-103-ST1' : 'SCR-103-ST7'
  const bestNew = saved && prevBest !== null && save.value.run.score > prevBest

  return (
    <section data-scr="SCR-103" data-st={st} data-save={save.kind} className="tutorial-theme flex min-h-dvh w-full flex-col bg-page">
      <header data-cmp="CMP-026" data-variant="none" className="flex h-14 shrink-0 items-center justify-between px-4">
        <h1 className="m-0 text-body font-bold">스테이지 결과</h1>
        {save.kind === 'saving' && (
          <p role="status" className="m-0 inline-flex items-center gap-1 text-caption text-ink-muted">
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            기록 저장 중
          </p>
        )}
      </header>
      <main className="flex flex-1 flex-col px-5">
        {!run ? (
          save.kind === 'error' ? (
            gone ? (
              <RunGone stageId={stageId} />
            ) : (
              <SaveError recovery={save.recovery} stageId={stageId} runId={runId} onRetry={() => void doSave()} />
            )
          ) : (
            <div aria-busy="true" aria-label="결과를 불러오는 중" data-testid="result-skeleton" className="grid justify-items-center gap-3 pt-4">
              <div className="h-4 w-40 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
              <div className="h-10 w-24 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
              <div className="h-7 w-20 animate-pulse rounded-full bg-surface motion-reduce:animate-none" />
            </div>
          )
        ) : (
          <>
            <section data-testid="score" aria-label="이번 결과" className="grid justify-items-center gap-2 pt-2 pb-[18px] text-center">
              {meta && (
                <p className="m-0 text-caption font-bold text-ink-accent">
                  {meta.course.name} · {meta.stage.no}단계 {meta.stage.title}
                </p>
              )}
              <p className="m-0 flex items-baseline gap-1.5 tabular-nums">
                <b className="text-display leading-tight">{run.score}</b>
                <span className="text-title font-bold text-ink-muted">/ {run.total}</span>
              </p>
              {passed ? (
                <Pill tone="success" icon={<Check aria-hidden className="size-4" />}>
                  통과
                </Pill>
              ) : (
                <Pill tone="warning" icon={<RotateCcw aria-hidden className="size-4" />}>
                  미통과
                </Pill>
              )}
              <p className="m-0 text-caption text-ink-muted">
                통과 기준: {run.total}개 중 {passScore(run.total)}개(70%)
              </p>
              {!passed && <p className="m-0 text-body font-bold text-warning-fg">통과까지 {passScore(run.total) - run.score}점 남았어요</p>}
            </section>
            {saved && (
              <section data-testid="best" className="tu-divider flex items-center justify-center gap-2 border-t py-3">
                <span className="text-caption font-bold text-ink-muted">최고 점수</span>
                <b className="tabular-nums">
                  {save.value.best} / {run.total}
                </b>
                {bestNew && <span className="inline-flex h-6 items-center rounded-full bg-mint-subtle px-2.5 text-caption font-bold text-ink-accent">최고 점수 갱신</span>}
              </section>
            )}
            {save.kind === 'error' && <SaveError recovery={save.recovery} stageId={stageId} runId={runId} onRetry={() => void doSave()} inline />}
            {saved && progress.kind === 'ok' && coursesOk && meta && (
              <section data-testid="progress" className="tu-divider grid gap-2.5 border-t py-3.5">
                <Bar label={`${meta.course.name} 진행`} scope="course" v={[meta.course.stages.filter((s) => progress.value[s.id]?.passed).length, meta.course.stages.length]} />
                <Bar label="전체 진행" scope="overall" v={[all.filter((x) => progress.value[x.stage.id]?.passed).length, all.length]} />
              </section>
            )}
            {run.wrong.length > 0 && (
              <WrongList wrong={run.wrong} review={review} cols={meta?.course.grid.cols ?? 2} rows={meta?.course.grid.rows ?? 3} saved={saved} onReload={() => void loadReview()} />
            )}
          </>
        )}
      </main>
      {!gone && (
        <div data-testid="result-actions" className="tu-divider sticky bottom-0 z-[2] mt-auto grid gap-2 border-t bg-page px-5 pt-2.5 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Actions passed={passed} stageId={stageId} next={next?.stage.id} />
        </div>
      )}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset()
        }}
        title="기록이 저장되지 않았습니다"
        description="나가면 이번 결과는 반영되지 않습니다."
        tone="danger"
        confirmLabel="나가기"
        cancelLabel="취소"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </section>
  )
}

/** 통과: '다음 스테이지'(없으면 '목록으로') 강조, 미통과: '다시 하기' 강조(02 SCR-103 ST1·ST7) */
function Actions({ passed, stageId, next }: { passed: boolean; stageId: string; next?: string }) {
  const list = '/tutorial'
  const retry = `/tutorial/stages/${stageId}`
  const nextTo = next ? `/tutorial/stages/${next}` : undefined
  const primary = passed ? (nextTo ? { t: '다음 스테이지', to: nextTo } : { t: '목록으로', to: list }) : { t: '다시 하기', to: retry }
  const second = passed ? { t: '다시 하기', to: retry } : nextTo ? { t: '다음 스테이지', to: nextTo } : undefined
  return (
    <>
      <Link to={primary.to} data-cmp="CMP-001" data-variant="primary-lg" className="flex h-[52px] items-center justify-center rounded-md bg-action text-heading font-bold tracking-tight text-on-action no-underline">
        {primary.t}
      </Link>
      <div className="flex gap-2">
        {second && (
          <Link to={second.to} data-cmp="CMP-001" data-variant="outline" className="flex h-[52px] flex-1 items-center justify-center rounded-md border-[1.5px] border-ink-accent bg-page text-body font-bold text-ink-accent no-underline">
            {second.t}
          </Link>
        )}
        <Link to={list} data-cmp="CMP-001" data-variant="secondary" className="flex h-[52px] flex-1 items-center justify-center rounded-md bg-surface text-body font-bold text-ink no-underline">
          목록
        </Link>
      </div>
    </>
  )
}

/** 회차 상세가 남아 있지 않음(보관 기간이 지나 정리됐거나 다른 기기에서 새로 시작해 대체됨, 7단계 보관 정책).
 * 저장된 최고 점수·통과 기록은 tutorial_progress에 영구 보존 — 이 화면은 저장 실패가 아님 */
function RunGone({ stageId }: { stageId: string }) {
  return (
    <div data-testid="run-gone" role="status" className="mt-6 grid justify-items-center gap-3 text-center">
      <p className="m-0 text-title font-bold">이 결과는 더 이상 볼 수 없어요</p>
      <p className="m-0 text-body text-ink-muted">상세 결과와 다시 보기는 잠시만 보관돼요. 저장된 최고 점수와 통과 기록은 튜토리얼 목록에서 볼 수 있어요.</p>
      <div className="flex w-full gap-2">
        <Link to={`/tutorial/stages/${stageId}`} className="flex h-[52px] flex-1 items-center justify-center rounded-md border-[1.5px] border-ink-accent bg-page text-body font-bold text-ink-accent no-underline">
          다시 하기
        </Link>
        <Link to="/tutorial" className="flex h-[52px] flex-1 items-center justify-center rounded-md bg-surface text-body font-bold text-ink no-underline">
          목록으로
        </Link>
      </div>
    </div>
  )
}

/** 저장 실패(ST4): 같은 요청을 다시 보내도 결과가 같음. 회차를 이어 갈 수 없으면 다시 하기, 인증 만료면 로그인 */
function SaveError({ recovery, stageId, runId, onRetry, inline = false }: { recovery: Recovery; stageId: string; runId: string; onRetry: () => void; inline?: boolean }) {
  const text = recovery === 'login' ? '로그인이 만료되어 기록을 저장하지 못했습니다' : recovery === 'retry' ? '기록을 저장하지 못했습니다' : '이번 결과를 저장할 수 없습니다. 다시 해 주세요'
  const action =
    recovery === 'retry' ? (
      <button type="button" onClick={onRetry} className="min-h-11 rounded-md bg-page px-3 font-bold text-danger-fg">
        다시 저장
      </button>
    ) : recovery === 'login' ? (
      <Link to={`/login?next=${encodeURIComponent(`/tutorial/stages/${stageId}/result?run=${runId}`)}`} className="flex min-h-11 items-center rounded-md bg-page px-3 font-bold text-danger-fg no-underline">
        다시 로그인
      </Link>
    ) : (
      <Link to={`/tutorial/stages/${stageId}`} className="flex min-h-11 items-center rounded-md bg-page px-3 font-bold text-danger-fg no-underline">
        다시 하기
      </Link>
    )
  return (
    <div data-cmp="CMP-023" role="alert" className={`${inline ? 'mt-1 mb-3' : 'mt-4'} flex items-center gap-2 rounded-md bg-danger-bg py-2.5 pr-3 pl-3.5 text-caption font-bold text-danger-fg`}>
      <AlertCircle aria-hidden className="size-5 shrink-0" />
      <span className="flex-1">{text}</span>
      {action}
    </div>
  )
}

function WrongList({ wrong, review, cols, rows, saved, onReload }: { wrong: RunResult['wrong']; review: Load<ReviewSituation[]>; cols: number; rows: number; saved: boolean; onReload: () => void }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section data-testid="wrong" aria-label="틀린 상황" className="tu-divider border-t pt-3">
      <p className="m-0 pb-1 text-caption font-bold text-ink-muted">틀린 상황 {wrong.length}개</p>
      <ul className="m-0 list-none p-0">
        {wrong.map((w) => {
          const item = review.kind === 'ok' ? review.value.find((r) => r.no === w.no) : undefined
          return (
            <li key={w.no}>
              <button
                type="button"
                aria-expanded={open === w.no}
                disabled={!saved}
                onClick={() => setOpen(open === w.no ? null : w.no)}
                data-cmp="CMP-030"
                className="flex h-12 w-full items-center gap-2 border-b border-line/40 px-0.5 text-left disabled:opacity-60"
              >
                <span className="font-bold">상황 {w.no}</span>
                <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${w.kind === 'wrong' ? 'bg-danger-bg text-danger-fg' : 'bg-warning-bg text-warning-fg'}`}>{w.kind === 'wrong' ? '오답' : '허용'}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-caption font-bold text-ink-accent">
                  정답 위치 보기
                  {open === w.no ? <ChevronDown aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
                </span>
              </button>
              {open === w.no &&
                (item ? (
                  <InlineReplay item={item} cols={cols} rows={rows} />
                ) : review.kind === 'error' ? (
                  <p role="alert" className="m-0 flex items-center justify-between gap-2 py-2 text-caption text-danger-fg">
                    정답 움직임을 불러오지 못했습니다
                    <button type="button" onClick={onReload} className="min-h-11 rounded-md px-3 font-bold text-danger-fg underline">
                      다시 시도
                    </button>
                  </p>
                ) : (
                  <div aria-busy="true" aria-label="정답 움직임을 불러오는 중" className="my-2 h-[240px] animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
                ))}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// 틀린 상황: 이 화면 안에서 정답 칸·동선과 정답 움직임 재생(다시 보기·0.5배속). 새 판정 요청 없음
function InlineReplay({ item, cols, rows }: { item: ReviewSituation; cols: number; rows: number }) {
  const [k, setK] = useState(0)
  const [slow, setSlow] = useState(false)
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    setMoved(false)
    const t = window.setTimeout(() => setMoved(true), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 80)
    return () => window.clearTimeout(t)
  }, [k])
  const { start, correctMove: cm } = item
  return (
    <div className="flex flex-col gap-2 border-b border-line/40 py-2" data-testid="replay">
      <p className="m-0 text-caption text-ink-muted">
        {item.description} {item.correctReason}
      </p>
      <div className="relative flex h-[240px] overflow-hidden rounded-md">
        <div aria-hidden className="pl-atmo" />
        <StadiumCourt
          key={k}
          cols={cols}
          rows={rows}
          mode="replay"
          label={`상황 ${item.no} 정답 움직임`}
          me={moved ? cm.me : start.me}
          partner={moved ? cm.partner : start.partner}
          opponents={start.opponents}
          shuttle={item.landing ? { at: item.landing, h: 0 } : undefined}
          flyMs={0}
          ring={item.landing ?? undefined}
          marks={[{ cell: item.answer, kind: 'ok' }]}
          routes={[{ from: start.me, to: cm.me }, { from: start.partner, to: cm.partner, partner: true }]}
          slow={slow}
        />
      </div>
      <div className="flex gap-2">
        <Ctl onClick={() => setK(k + 1)} icon={<Play aria-hidden className="size-4" />}>
          다시 보기
        </Ctl>
        <Ctl pressed={slow} onClick={() => { setSlow(!slow); setK(k + 1) }} icon={<Snail aria-hidden className="size-4" />}>
          느리게 보기(0.5배속)
        </Ctl>
      </div>
    </div>
  )
}

function Ctl({ children, icon, onClick, pressed }: { children: ReactNode; icon: ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`flex h-11 flex-1 items-center justify-center gap-1 rounded-md bg-mint-subtle text-caption font-bold text-ink-accent ${pressed ? 'border-[1.5px] border-ink-accent' : ''}`}>
      {icon}
      {children}
    </button>
  )
}

function Pill({ tone, icon, children }: { tone: 'success' | 'warning'; icon: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-caption font-bold ${tone === 'success' ? 'bg-success-bg text-success-fg' : 'bg-warning-bg text-warning-fg'}`}>
      {icon}
      {children}
    </span>
  )
}

function Bar({ label, v, scope }: { label: string; v: [number, number]; scope: 'course' | 'overall' }) {
  return (
    <div data-cmp="CMP-049" data-variant={scope} className="flex items-center gap-2.5">
      <span className="w-[72px] shrink-0 text-caption font-bold">{label}</span>
      <span role="progressbar" aria-valuenow={v[0]} aria-valuemin={0} aria-valuemax={v[1]} aria-label={label} className="h-2 flex-1 overflow-hidden rounded-md bg-surface">
        <i className="block h-full rounded-md bg-action" style={{ width: `${v[1] ? (v[0] / v[1]) * 100 : 0}%` }} />
      </span>
      <span className="text-caption font-bold tabular-nums">
        {v[0]} / {v[1]}
      </span>
    </div>
  )
}
