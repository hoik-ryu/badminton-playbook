import { Play as PlayIcon, Search, Snail } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'

import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageHeader } from '../components/PageHeader'
import { StateView } from '../components/StateView'
import { getTutorialStage, judgeTutorialSituation, startTutorialRun, type Judgement, type TutorialStage } from '../features/tutorial/api'
import type { Pt } from '../features/tutorial/court/cells'
import { StadiumCourt, type CourtMetrics, type CourtMode, type Mark, type ShuttleState } from '../features/tutorial/court/StadiumCourt'
import { Chip, Cta, Judge, Outline, Playback, Question, Steps, TopBar } from '../features/tutorial/play/parts'
import { judgeReason, judgeTitle, record, RECOVERY_TEXT, recoveryOf, replayText, scoreOf, wrongOf, type Recovery, type RunLedger } from '../features/tutorial/play/logic'

// SCR-102 스테이지 플레이(/tutorial/stages/:stageId, 탭바 숨김) — UX Spec r5(02 SCR-102, UXD-077 r6·078–081), DD r6(VD-026–031·044·047·048), Preview r3 승인
// 화면: 경기장 분위기 상단(헤더 56 · 상황 진행 · 상황 설명 카드) → 경기장판(StadiumCourt) → 아래 시트 160px 고정(UXD-081)
// 데이터·판정(사용자 결정 2026-11-19·20, D-T1·D-T2·D-T4 (b)):
//  - 공개 콘텐츠 GET /stages/{id}(정답 없음) → 회차 POST /stages/{id}/runs → 칸 확정마다 POST /runs/{runId}/judge
//  - 점수는 서버의 firstVerdict·points만 누적(첫 시도 정답 1점, 재도전 0점). 고른 칸은 저장하지 않음(NFR-006)
//  - 판정 요청 중에는 입력을 막고(중복 방지), 네트워크 오류면 같은 선택으로 다시 보냄(서버 멱등 — 점수 불변)
//  - 회차 만료(410)·콘텐츠 변경(409)·회차 없음 → 처음부터 새 회차. 인증 만료 → 로그인. 오류로 점수를 만들거나 진행 기록을 바꾸지 않음
//  - 진행 기록 저장은 SCR-103에서 PUT /stages/{id} {runId}. 이 화면은 결과 주소(?run=회차 ID)와 결과 요약(state.run)을 넘김
// 규칙: 재생 중 격자·번호 숨김, 선택 대기부터 내 편 반 코트에만, 실제 칸 < 44px이면 확인 단계(ST12), 입문자는 재생 없음(ST11)
type Phase = 'play' | 'choose' | 'moving' | 'judged' | 'replay' | 'judgeError'
type Boot = { kind: 'loading' } | { kind: 'error'; recovery: Recovery } | { kind: 'ready'; stage: TutorialStage; runId: string }

/** SCR-103으로 넘기는 이번 회차 요약(6단계 결과 화면이 읽음) */
export type RunSummary = { runId: string; stageId: string; score: number; total: number; wrong: { no: number; kind: 'allow' | 'wrong' }[] }

const PLAY_MS = 1100
/** 셔틀 높이(코트 단위): 상대가 치는 순간·선택 대기 중 멈춘 순간 */
const H_HIT = 22
const H_STOP = 9
const reduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function StagePlayPage() {
  const { stageId = '' } = useParams()
  return <Boot key={stageId} stageId={stageId} />
}

function Boot({ stageId }: { stageId: string }) {
  const [boot, setBoot] = useState<Boot>({ kind: 'loading' })
  const [slowStart, setSlowStart] = useState(false)
  const booting = useRef(false)

  const load = useCallback(async () => {
    if (booting.current) return // 같은 진입에서 회차를 두 번 만들지 않음(개발 모드 이중 실행 포함)
    booting.current = true
    setBoot({ kind: 'loading' })
    try {
      const stage = await getTutorialStage(stageId)
      const run = await startTutorialRun(stageId)
      setBoot({ kind: 'ready', stage, runId: run.runId })
    } catch (e) {
      setBoot({ kind: 'error', recovery: recoveryOf(e) })
    } finally {
      booting.current = false
    }
  }, [stageId])
  useEffect(() => {
    void load()
  }, [load])
  // ST2: 3초가 지나면 '준비 중입니다…' 유지(AC-095)
  useEffect(() => {
    if (boot.kind !== 'loading') return
    const t = window.setTimeout(() => setSlowStart(true), 3000)
    return () => window.clearTimeout(t)
  }, [boot.kind])

  if (boot.kind === 'ready') return <Game key={boot.runId} stage={boot.stage} runId={boot.runId} onRestart={() => void load()} />
  if (boot.kind === 'error' && boot.recovery === 'notFound') return <NotAvailable />
  return (
    <section data-scr="SCR-102" data-st={boot.kind === 'loading' ? 'SCR-102-ST2' : 'SCR-102-ST4'} className="flex flex-1 flex-col bg-page">
      <PageHeader title="튜토리얼" leading="back" backTo="/tutorial" />
      {boot.kind === 'loading' ? (
        <StateView kind="loading" rows={4} label={slowStart ? '준비 중입니다…' : '스테이지를 준비하는 중'} />
      ) : (
        <StateView
          kind="error"
          title={boot.recovery === 'login' ? '로그인이 만료되었어요' : '스테이지를 불러오지 못했습니다'}
          description={boot.recovery === 'login' ? '다시 로그인한 뒤 이어서 해 주세요.' : '네트워크를 확인한 뒤 다시 시도해 주세요.'}
          action={
            <div className="flex flex-col gap-2">
              {boot.recovery === 'login' ? (
                <Button asChild fullWidth>
                  <Link to={`/login?next=${encodeURIComponent(`/tutorial/stages/${stageId}`)}`}>다시 로그인</Link>
                </Button>
              ) : (
                <Button variant="secondary" fullWidth onClick={() => void load()}>
                  다시 시도
                </Button>
              )}
              <Button asChild variant="text" fullWidth>
                <Link to="/tutorial">튜토리얼 홈으로</Link>
              </Button>
            </div>
          }
        />
      )}
    </section>
  )
}

function NotAvailable() {
  return (
    <section data-scr="SCR-102" data-st="SCR-102-ST5" className="flex flex-1 flex-col bg-page">
      <PageHeader title="튜토리얼" leading="back" backTo="/tutorial" />
      <StateView
        kind="notFound"
        title="준비 중인 스테이지입니다"
        action={
          <Button asChild variant="secondary" fullWidth>
            <Link to="/tutorial">튜토리얼 홈으로</Link>
          </Button>
        }
      />
    </section>
  )
}

function Game({ stage, runId, onRestart }: { stage: TutorialStage; runId: string; onRestart: () => void }) {
  const navigate = useNavigate()
  const { cols, rows } = stage.grid
  const total = stage.situations.length

  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>(stage.guided ? 'choose' : 'play')
  const [retry, setRetry] = useState(false)
  const [picked, setPicked] = useState<number | undefined>()
  const [judgement, setJudgement] = useState<Judgement | null>(null)
  const [ledger, setLedger] = useState<RunLedger>({})
  const [judgeError, setJudgeError] = useState<Recovery | null>(null)
  const sit = stage.situations[i]!
  const hitShuttle = (): ShuttleState | undefined => (sit.shuttle ? { at: sit.shuttle.from, h: H_HIT } : undefined)
  const [shuttle, setShuttle] = useState<ShuttleState | undefined>(hitShuttle())
  const [flyMs, setFlyMs] = useState(PLAY_MS)
  const [slow, setSlow] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [askExit, setAskExit] = useState(false)
  const [metrics, setMetrics] = useState<CourtMetrics | null>(null)
  const [moved, setMoved] = useState(false)
  const inFlight = useRef(false)
  const leaving = useRef(false)
  // UXD-078: 그려진 코트의 실제 칸 크기(가장 작은 칸의 너비·높이)가 44px 미만이면 확인 단계(ST12)
  const confirmMode = !!metrics && (metrics.minCellW < 44 || metrics.minCellH < 44)

  // 상황 재생: 상대 쪽에서 셔틀이 날아와 내 편 위에서 멈춘 뒤 선택 대기. 입문자(ST11)는 재생 없음
  useEffect(() => {
    if (phase !== 'play') return
    setFlyMs(PLAY_MS)
    const stop = sit.shuttle ? { at: sit.shuttle.stop, h: H_STOP } : undefined
    if (reduce()) {
      setShuttle(stop)
      setPhase('choose')
      return
    }
    const a = window.setTimeout(() => setShuttle(stop), 40)
    const b = window.setTimeout(() => setPhase('choose'), PLAY_MS + 120)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [phase, sit])

  // 정답 움직임 보기(ST10): 누를 때마다 시작 위치 → 정답 칸으로 다시 재생(느리게 보기면 0.5배속)
  useEffect(() => {
    if (phase !== 'replay') return
    setMoved(false)
    const t = window.setTimeout(() => setMoved(true), reduce() ? 0 : 80)
    return () => window.clearTimeout(t)
  }, [phase, replayKey])

  // 나가기 확인(뒤로 가기 포함). 결과 화면으로 갈 때는 막지 않음
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !leaving.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (leaving.current) return
      e.preventDefault()
      e.returnValue = '' // 브라우저 기본 경고(문구 변경 불가)
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // 확정 → 서버 판정(한 번에 하나만). 응답이 오면 이동·셔틀 착지 → 판정 표시
  const confirm = async (n: number) => {
    if (inFlight.current) return
    inFlight.current = true
    setPicked(n)
    setJudgeError(null)
    setPhase('moving')
    try {
      const j = await judgeTutorialSituation(runId, sit.no, n)
      setJudgement(j)
      setLedger((l) => record(l, j))
      if (!stage.guided && j.landing) {
        setFlyMs(600)
        setShuttle({ at: j.landing, h: 0 })
      }
      window.setTimeout(() => setPhase('judged'), reduce() ? 0 : 650)
    } catch (e) {
      setJudgeError(recoveryOf(e))
      setPhase('judgeError')
    } finally {
      inFlight.current = false
    }
  }
  const onCell = (n: number) => {
    if (inFlight.current) return
    if (confirmMode) setPicked(n)
    else {
      setPicked(n)
      window.setTimeout(() => void confirm(n), reduce() ? 0 : 120)
    }
  }
  const resetSituation = () => {
    setPicked(undefined)
    setJudgement(null)
    setJudgeError(null)
    setSlow(false)
    setFlyMs(0)
  }
  const goNext = () => {
    if (i === total - 1) {
      leaving.current = true
      const run: RunSummary = { runId, stageId: stage.id, score: scoreOf(ledger), total, wrong: wrongOf(ledger) }
      // 결과 주소에 회차 ID(새로고침·직접 접근 복구, 6단계). state.run은 저장 전 결과를 바로 보여 주는 데만 씀(ST2)
      navigate(`/tutorial/stages/${stage.id}/result?run=${encodeURIComponent(runId)}`, { replace: true, state: { run } })
      return
    }
    const nx = stage.situations[i + 1]!
    setI(i + 1)
    setRetry(false)
    resetSituation()
    setShuttle(nx.shuttle ? { at: nx.shuttle.from, h: H_HIT } : undefined)
    setPhase(stage.guided ? 'choose' : 'play')
  }
  const doRetry = () => {
    setRetry(true)
    resetSituation()
    setShuttle(hitShuttle())
    setPhase(stage.guided ? 'choose' : 'play')
  }
  const skip = () => {
    setFlyMs(0)
    setShuttle(sit.shuttle ? { at: sit.shuttle.stop, h: H_STOP } : undefined)
    setPhase('choose')
  }

  const j = judgement
  const judged = (phase === 'judged' || phase === 'replay') && j !== null
  const start = sit.start
  const meAt: Pt = j && (phase === 'moving' || phase === 'judged') ? j.move.me : phase === 'replay' && moved && j ? j.correctMove.me : start.me
  // 파트너는 확정 뒤 판정과 관계없이 데이터대로 자동 이동(02 SCR-102, AC-114)
  const ptAt: Pt = j && (phase === 'moving' || phase === 'judged') ? j.move.partner : phase === 'replay' && moved && j ? j.correctMove.partner : start.partner
  const marks: Mark[] = []
  if (phase === 'judgeError' && picked) marks.push({ cell: picked, kind: 'selectWait' })
  if (judged && j) {
    marks.push({ cell: j.answer, kind: 'ok' })
    if (picked && j.verdict !== 'correct' && phase === 'judged') marks.push({ cell: picked, kind: j.verdict === 'allow' ? 'allow' : 'bad', mine: true })
  }
  const mode: CourtMode = phase === 'play' ? 'playing' : phase === 'choose' ? 'choose' : phase === 'replay' ? 'replay' : 'result'
  const ring = judged && !stage.guided && j?.landing ? j.landing : undefined
  const routes = phase === 'replay' && j ? [{ from: start.me, to: j.correctMove.me }, { from: start.partner, to: j.correctMove.partner, partner: true }] : undefined
  const score = scoreOf(ledger)

  const st =
    phase === 'play'
      ? 'SCR-102-PLAY'
      : phase === 'choose'
        ? stage.guided && !picked
          ? 'SCR-102-ST11'
          : confirmMode && picked
            ? 'SCR-102-ST12'
            : 'SCR-102-ST1'
        : phase === 'judged' && j
          ? j.verdict === 'correct'
            ? 'SCR-102-ST7'
            : j.verdict === 'allow'
              ? 'SCR-102-ST8'
              : 'SCR-102-ST9'
          : phase === 'replay'
            ? 'SCR-102-ST10'
            : phase === 'judgeError'
              ? 'SCR-102-ST4'
              : 'SCR-102-ST1'

  // 마지막 상황이면 정답·허용·오답과 관계없이 다음 이동은 '결과 보기'(다시 도전·올바른 움직임 보기는 그대로 둠, 7단계)
  const nextLabel = i === total - 1 ? '결과 보기' : '다음 상황'
  let foot: ReactNode = null
  if (phase === 'play') foot = <Playback key={`${i}-${retry}`} ms={PLAY_MS} />
  else if (phase === 'choose') {
    foot =
      confirmMode && picked ? (
        <>
          <Question text={`${picked}번 칸을 골랐어요. 다른 칸을 누르면 바뀌어요`} />
          <div className="flex">
            <Cta onClick={() => void confirm(picked)}>이 칸으로 이동</Cta>
          </div>
        </>
      ) : (
        <Question hint={stage.guided && stage.no === 1 && i === 0 ? '코트 위 숫자는 내 편 자리 번호예요' : undefined} text={sit.question} />
      )
  } else if (phase === 'moving') {
    foot = (
      <div role="status" aria-busy="true" className="grid gap-2 pt-1">
        <p className="m-0 text-body font-bold">{picked}번 칸으로 이동하는 중…</p>
        <span className="h-1.5 animate-pulse rounded-full bg-mint-subtle motion-reduce:animate-none" />
      </div>
    )
  } else if (phase === 'judgeError' && judgeError) {
    const rec = judgeError === 'notFound' ? 'restart' : judgeError
    foot = (
      <div role="alert" className="grid gap-2">
        <p className="m-0 text-body font-bold text-danger-fg">판정을 받지 못했어요</p>
        <p className="m-0 text-caption text-ink-muted">{RECOVERY_TEXT[rec]}</p>
        <div className="flex">
          {rec === 'retry' && picked ? (
            <Cta onClick={() => void confirm(picked)}>다시 보내기</Cta>
          ) : rec === 'login' ? (
            <Button asChild fullWidth>
              <Link to={`/login?next=${encodeURIComponent(`/tutorial/stages/${stage.id}`)}`} onClick={() => (leaving.current = true)}>
                다시 로그인
              </Link>
            </Button>
          ) : (
            <Cta onClick={() => { leaving.current = true; onRestart() }}>처음부터 다시 하기</Cta>
          )}
        </div>
      </div>
    )
  } else if (phase === 'judged' && j) {
    const kind = j.verdict === 'correct' ? 'ok' : j.verdict === 'allow' ? 'allow' : 'bad'
    foot =
      j.verdict === 'correct' ? (
        <>
          <Judge kind="ok" title={judgeTitle(j, stage.guided)} reason={judgeReason(j)} />
          <div className="flex">
            <Cta onClick={goNext}>{nextLabel}</Cta>
          </div>
        </>
      ) : (
        <>
          <Judge kind={kind} title={judgeTitle(j, stage.guided)} reason={judgeReason(j)} onRetry={doRetry} onNext={goNext} nextLabel={nextLabel} />
          <div className="flex">
            <Outline onClick={() => { setPhase('replay'); setReplayKey((x) => x + 1) }} icon={<PlayIcon aria-hidden className="size-5" />}>
              {j.verdict === 'allow' ? '최선 위치 보기' : '올바른 움직임 보기'}
            </Outline>
          </div>
        </>
      )
  } else if (phase === 'replay' && j) {
    foot = (
      <>
        <Judge kind="ok" title="올바른 움직임" reason={replayText(j, stage.guided)} onRetry={doRetry} onNext={goNext} nextLabel={nextLabel} />
        <div className="flex gap-2">
          <Chip onClick={() => setReplayKey((x) => x + 1)} icon={<PlayIcon aria-hidden className="size-[18px]" />}>
            다시 보기
          </Chip>
          <Chip pressed={slow} onClick={() => { setSlow(!slow); setReplayKey((x) => x + 1) }} icon={<Snail aria-hidden className="size-[18px]" />}>
            느리게 보기(0.5배속)
          </Chip>
        </div>
      </>
    )
  }

  return (
    <section
      data-scr="SCR-102"
      data-st={st}
      data-phase={phase}
      data-confirm-mode={confirmMode ? 'true' : 'false'}
      aria-label={`${stage.courseName} ${stage.no}단계 플레이`}
      className="relative grid h-dvh w-full grid-rows-[56px_auto_auto_minmax(0,1fr)_160px] overflow-hidden bg-surface"
    >
      <div aria-hidden className="pl-atmo" />
      <TopBar course={stage.courseName} step={stage.no} goal={stage.title} index={i + 1} total={total} score={score} retry={retry} onExit={() => setAskExit(true)} />
      <Steps index={i + 1} total={total} />
      <div className="relative z-[1] px-3 pb-2">
        <div data-testid="situation-card" className="tu-soft flex items-center gap-2.5 rounded-md bg-page px-3 py-2">
          <Search aria-hidden className="size-5 shrink-0 text-ink-accent" />
          <p className="m-0 text-body leading-snug font-bold">{sit.description}</p>
        </div>
      </div>
      <div className="relative z-[1] flex min-h-0" data-testid="play-main">
        <StadiumCourt
          key={phase === 'replay' ? `r${replayKey}` : `c${i}`}
          cols={cols}
          rows={rows}
          mode={mode}
          label={sit.description}
          me={meAt}
          partner={ptAt}
          opponents={start.opponents}
          shuttle={stage.guided ? undefined : shuttle}
          flyMs={flyMs}
          marks={marks}
          ring={ring}
          routes={routes}
          onCell={phase === 'choose' ? onCell : undefined}
          onSkip={skip}
          selected={picked}
          slow={slow}
          onMetrics={setMetrics}
        />
      </div>
      <section data-testid="bottom-sheet" aria-live="polite" className="tu-sheet relative z-[2] flex flex-col gap-2 overflow-y-auto rounded-t-(--radius-sheet) bg-page px-4 py-3">
        {foot}
      </section>
      <ConfirmDialog
        open={askExit || blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (o) return
          setAskExit(false)
          if (blocker.state === 'blocked') blocker.reset()
        }}
        title="스테이지에서 나갈까요?"
        description="지금 나가면 이번 진행은 저장되지 않습니다."
        tone="danger"
        confirmLabel="나가기"
        cancelLabel="취소"
        onConfirm={() => {
          leaving.current = true
          if (blocker.state === 'blocked') blocker.proceed()
          else navigate('/tutorial')
        }}
      />
    </section>
  )
}

