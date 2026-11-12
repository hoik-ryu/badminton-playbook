import { cn } from 'cn'
import { CircleAlert, CircleCheck, Repeat } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'

import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageHeader } from '../components/PageHeader'
import { StateView } from '../components/StateView'
import { levelById, stageById } from '../features/tutorial/content/stages'
import { bestChoice, incomingTimeline, outcomeTimeline, type Timeline } from '../features/tutorial/engine/animation'
import { choose, isFinished, isRetrying, next, retry, scoreOf, startRun, summarize, type Run } from '../features/tutorial/engine/logic'
import type { Choice, Verdict } from '../features/tutorial/engine/types'
import { TutorialCourt } from '../features/tutorial/TutorialCourt'
import { usePlayback } from '../features/tutorial/usePlayback'

// SCR-102 스테이지 플레이(/tutorial/stages/:stageId, 탭바 숨김). US-024, FLOW-006-S2–S5, AC-090·091·092·095, UXD-059·060·061·064·069
// - 위: '나가기'(✕) · '입문자 · 1' · '상황 n/5 · n점'(재도전이면 '재도전 · 0점') → 상황 설명 한 줄 → 세로 코트(CMP-046) → 결과 문구(aria-live) → 아래 버튼(56px)
// - 상태: ST2 준비 → 상황 재생 → ST1 멈춤·선택(시간 제한 없음) → 결과 재생(버튼 잠금, 눌러서 건너뛰기) → ST7 정답 / ST8 허용 / ST9 오답 → ST10 정답 움직임 보기
// - 진행은 메모리에만(C-23). '나가기'·뒤로 가기 → 확인 창 "지금 나가면 이번 진행은 저장되지 않습니다". 새로고침·창 닫기 → 브라우저 기본 경고 후 폐기
// - 마지막 상황 뒤 → SCR-103(결과는 이동 상태로 전달, 저장은 SCR-103에서만)
type Phase = 'incoming' | 'choose' | 'outcome' | 'result' | 'answer'

const VERDICT: Record<Verdict, { st: string; title: string; tone: string; Icon: typeof CircleCheck }> = {
  correct: { st: 'SCR-102-ST7', title: '득점', tone: 'bg-success-bg text-success-fg', Icon: CircleCheck },
  acceptable: { st: 'SCR-102-ST8', title: '랠리 계속', tone: 'bg-info-bg text-ink', Icon: Repeat },
  wrong: { st: 'SCR-102-ST9', title: '실점', tone: 'bg-danger-bg text-danger-fg', Icon: CircleAlert },
}

export function StagePlayPage() {
  const { stageId = '' } = useParams()
  const stage = stageById(stageId)
  const level = stage ? levelById(stage.level) : null
  if (!stage || !level?.available) return <NotAvailable />
  return <Play key={stage.id} stageId={stage.id} />
}

function NotAvailable() {
  return (
    <section data-scr="SCR-102" data-st="SCR-102-ST5" className="flex flex-1 flex-col">
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

function Play({ stageId }: { stageId: string }) {
  const stage = stageById(stageId)!
  const level = levelById(stage.level)
  const navigate = useNavigate()
  const [run, setRun] = useState<Run>(() => startRun(stage))
  const [phase, setPhase] = useState<Phase>('incoming')
  const [choice, setChoice] = useState<Choice | null>(null)
  const [slow, setSlow] = useState(false)
  const [playKey, setPlayKey] = useState(0)
  const [askExit, setAskExit] = useState(false)
  const leaving = useRef(false)
  const situation = stage.situations[Math.min(run.index, stage.situations.length - 1)]!
  const total = stage.situations.length

  const timeline: Timeline = useMemo(() => {
    if (phase === 'incoming' || phase === 'choose') return incomingTimeline(situation)
    if (phase === 'answer') return outcomeTimeline(situation, bestChoice(situation))
    return outcomeTimeline(situation, choice ?? bestChoice(situation))
  }, [phase, situation, choice])

  const onDone = useCallback(() => {
    setPhase((p) => (p === 'incoming' ? 'choose' : p === 'outcome' ? 'result' : p))
  }, [])
  const { frame, playing, skip } = usePlayback(timeline, playKey, phase === 'answer' && slow ? 0.5 : 1, onDone)

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

  const pick = (c: Choice) => {
    if (phase !== 'choose') return
    setRun((r) => choose(r, stage, c.id))
    setChoice(c)
    setPhase('outcome')
  }
  const again = () => {
    setRun((r) => retry(r))
    setChoice(null)
    setSlow(false)
    setPhase('incoming')
    setPlayKey((k) => k + 1)
  }
  const goNext = () => {
    const moved = next(run)
    if (isFinished(moved, stage)) {
      leaving.current = true
      navigate(`/tutorial/stages/${stage.id}/result`, { replace: true, state: { result: summarize(moved, stage) } })
      return
    }
    setRun(moved)
    setChoice(null)
    setSlow(false)
    setPhase('incoming')
    setPlayKey((k) => k + 1)
  }
  const showAnswer = () => {
    setPhase('answer')
    setPlayKey((k) => k + 1)
  }

  const verdict = phase === 'result' || phase === 'answer' ? run.last : null
  const retrying = isRetrying(run) || (run.attempts > 1 && verdict !== null)
  const st = phase === 'answer' ? 'SCR-102-ST10' : verdict ? VERDICT[verdict].st : 'SCR-102-ST1'
  const last = run.index === total - 1
  const nextLabel = last ? '결과 보기' : '다음 상황'
  const score = scoreOf(run)

  return (
    <section data-scr="SCR-102" data-st={st} data-phase={phase} className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden">
      <PageHeader
        title={`${level.name} · ${stage.no}`}
        leading="close"
        onClose={() => setAskExit(true)}
        trailing={
          <p className="m-0 pr-3 text-body tabular-nums text-ink" aria-live="polite">
            상황 {run.index + 1}/{total} · {retrying ? <span className="font-bold text-warning-fg">재도전 · 0점</span> : <span className="font-bold">{score}점</span>}
          </p>
        }
      />
      <p className="m-0 px-4 pb-2 text-body text-ink">{situation.prompt}</p>
      <div className="flex min-h-0 flex-1 flex-col px-4">
        <TutorialCourt frame={frame} label={situation.prompt} playing={playing} onSkip={skip} />
      </div>
      <div className="flex flex-col gap-2 px-4 pt-2 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        <div aria-live="polite" className="min-h-0">
          {verdict && choice && phase === 'result' && (
            <div data-verdict={verdict} className={cn('flex items-start gap-2 rounded-md px-3 py-2 text-body', VERDICT[verdict].tone)}>
              {(() => {
                const { Icon } = VERDICT[verdict]
                return <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
              })()}
              <p className="m-0">
                <span className="font-bold">{VERDICT[verdict].title}</span> · {choice.reason}
                {verdict === 'acceptable' && <span className="mt-1 block">괜찮은 선택이에요. 더 좋은 움직임은… {situation.better}</span>}
              </p>
            </div>
          )}
          {phase === 'answer' && (
            <p className="m-0 rounded-md bg-surface px-3 py-2 text-body text-ink">
              <span className="font-bold">정답 움직임 · {bestChoice(situation).label}</span> — {bestChoice(situation).reason}
            </p>
          )}
        </div>
        {(phase === 'choose' || phase === 'incoming' || phase === 'outcome') && (
          <div role="group" aria-label="움직임 고르기" className="grid grid-cols-2 gap-2">
            {situation.choices.map((c) => (
              <Button key={c.id} variant="secondary" className="h-14" disabled={phase !== 'choose'} onClick={() => pick(c)}>
                {c.label}
              </Button>
            ))}
          </div>
        )}
        {phase === 'result' && verdict === 'correct' && (
          <Button className="h-14" fullWidth onClick={goNext}>
            {nextLabel}
          </Button>
        )}
        {phase === 'result' && verdict && verdict !== 'correct' && (
          <div className="grid grid-cols-2 gap-2">
            <Button className="col-span-2 h-14" onClick={showAnswer}>
              {verdict === 'acceptable' ? '최선 움직임 보기' : '올바른 움직임 보기'}
            </Button>
            <Button variant="secondary" className="h-14" onClick={again}>
              다시 도전
            </Button>
            <Button variant="secondary" className="h-14" onClick={goNext}>
              {nextLabel}
            </Button>
          </div>
        )}
        {phase === 'answer' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-14" disabled={playing} onClick={() => setPlayKey((k) => k + 1)}>
              다시 보기
            </Button>
            <Button variant={slow ? 'primary' : 'secondary'} className="h-14" aria-pressed={slow} onClick={() => { setSlow((v) => !v); setPlayKey((k) => k + 1) }}>
              느리게 보기(0.5배속)
            </Button>
            <Button variant="secondary" className="h-14" onClick={again}>
              다시 도전
            </Button>
            <Button className="h-14" onClick={goNext}>
              {nextLabel}
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={askExit || blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (o) return
          setAskExit(false)
          if (blocker.state === 'blocked') blocker.reset()
        }}
        title="지금 나가면 이번 진행은 저장되지 않습니다"
        tone="danger"
        confirmLabel="나가기"
        cancelLabel="계속하기"
        onConfirm={() => {
          leaving.current = true
          if (blocker.state === 'blocked') blocker.proceed()
          else navigate('/tutorial')
        }}
      />
    </section>
  )
}
