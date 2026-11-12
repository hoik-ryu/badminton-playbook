import { cn } from 'cn'
import { CircleCheck, CircleX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useBlocker, useLocation, useNavigate, useParams, useRouteLoaderData } from 'react-router'

import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { PageHeader } from '../components/PageHeader'
import { CONTENT_MISMATCH, getMyTutorialProgress, saveStageResult } from '../features/tutorial/api'
import { isApiError } from '../lib/api'
import { levelById, nextStageOf, stageById } from '../features/tutorial/content/stages'
import { bestChoice, outcomeTimeline } from '../features/tutorial/engine/animation'
import { passScore, type StageProgress, type StageResult } from '../features/tutorial/engine/logic'
import type { Situation } from '../features/tutorial/engine/types'
import { TutorialCourt } from '../features/tutorial/TutorialCourt'
import { usePlayback } from '../features/tutorial/usePlayback'
import type { ShellData } from '../routes/guards'

// SCR-103 스테이지 결과(/tutorial/stages/:stageId/result, 탭바 숨김). US-024·025, FLOW-006-S6·S6a, AC-092·094, UXD-061·065·069
// - 이번 점수·통과 여부(통과 기준 함께) → 최고 점수('최고 점수 갱신') → 틀린 상황(누르면 정답 움직임 재생, 다시 보기·0.5배속) → '다음 스테이지'·'다시 하기'·'홈'
// - 화면 진입 시 한 번 저장(회원 × 스테이지 한 건, 멱등). ST2 "기록 저장 중"(결과는 바로) / ST4 "기록을 저장하지 못했습니다" + '다시 저장'(저장 중 비활성)
//   저장 전 나가기 → "기록이 저장되지 않았습니다. 나가면 이번 결과는 반영되지 않습니다"
// - ST7 미통과: "통과까지 n점 남았어요" + '다시 하기' 강조. SCR-102를 거치지 않고 주소로 오면 결과가 없으므로 SCR-102로 이동
type Save = { kind: 'saving' } | { kind: 'saved'; record: StageProgress } | { kind: 'error'; mismatch?: boolean }

export function StageResultPage() {
  const { stageId = '' } = useParams()
  const location = useLocation()
  const result = (location.state as { result?: StageResult } | null)?.result
  const stage = stageById(stageId)
  if (!stage) return <Navigate to={`/tutorial/stages/${stageId}`} replace />
  if (!result || result.stageId !== stage.id) return <Navigate to={`/tutorial/stages/${stage.id}`} replace />
  return <Result key={location.key} stageId={stage.id} result={result} />
}

function Result({ stageId, result }: { stageId: string; result: StageResult }) {
  const stage = stageById(stageId)!
  const level = levelById(stage.level)
  const nextStage = nextStageOf(stage)
  const navigate = useNavigate()
  const data = useRouteLoaderData('member') as ShellData | undefined
  const meId = data?.me.id ?? ''
  const [save, setSave] = useState<Save>({ kind: 'saving' })
  const [prevBest, setPrevBest] = useState<number | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const started = useRef(false)
  const leaving = useRef(false)

  const doSave = useCallback(async () => {
    setSave({ kind: 'saving' })
    try {
      setSave({ kind: 'saved', record: await saveStageResult(meId, result) })
    } catch (e) {
      setSave({ kind: 'error', mismatch: isApiError(e) && e.code === CONTENT_MISMATCH })
    }
  }, [meId, result])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      // 이전 최고 점수('최고 점수 갱신' 표시용). 못 불러와도 저장은 진행
      const before = await getMyTutorialProgress(meId).catch(() => null)
      setPrevBest(before?.[stageId]?.best ?? 0)
      await doSave()
    })()
  }, [meId, stageId, doSave])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => !leaving.current && save.kind !== 'saved' && currentLocation.pathname !== nextLocation.pathname)
  // 저장 중에 이동을 누르면 저장이 끝난 뒤 이동(실패하면 이동하지 않고 오류 안내를 남김)
  const [pendingTo, setPendingTo] = useState<string | null>(null)
  const go = (to: string) => {
    if (save.kind === 'saving') return setPendingTo(to)
    if (save.kind === 'saved') leaving.current = true
    navigate(to)
  }
  useEffect(() => {
    if (!pendingTo || save.kind === 'saving') return
    setPendingTo(null)
    if (save.kind === 'saved') {
      leaving.current = true
      navigate(pendingTo)
    }
  }, [pendingTo, save.kind, navigate])

  const need = passScore(result.total)
  const best = save.kind === 'saved' ? save.record.best : Math.max(prevBest ?? 0, result.score)
  const newBest = prevBest !== null && result.score > prevBest
  const missed = result.missed.map((id) => stage.situations.find((s) => s.id === id)).filter((s): s is Situation => !!s)
  const st = save.kind === 'error' ? 'SCR-103-ST4' : save.kind === 'saving' ? 'SCR-103-ST2' : result.passed ? 'SCR-103-ST1' : 'SCR-103-ST7'

  return (
    <section data-scr="SCR-103" data-st={st} className="flex w-full max-w-[600px] flex-1 flex-col">
      <PageHeader title={`${level.name} · 스테이지 ${stage.no}`} />
      <div className="flex flex-col gap-4 px-4 pb-6">
        {save.kind === 'error' &&
          (save.mismatch ? (
            // 서버와 스테이지 내용이 다름(배포 불일치) — 다시 저장해도 같으므로 새로고침 안내
            <NoticeBox tone="danger">기록을 저장하지 못했습니다. 스테이지 내용이 바뀌었습니다. 새로고침한 뒤 다시 해 주세요</NoticeBox>
          ) : (
            <NoticeBox tone="danger" action={<Button variant="text" size="md" onClick={() => void doSave()}>다시 저장</Button>}>
              기록을 저장하지 못했습니다
            </NoticeBox>
          ))}
        <section aria-label="이번 결과" className="flex flex-col items-center gap-2 rounded-md border border-line bg-surface px-4 py-5 text-center">
          <p className="m-0 text-display font-bold tabular-nums text-ink">
            {result.score} <span className="text-title text-ink-muted">/ {result.total}</span>
          </p>
          {result.passed ? (
            <Badge tone="success" className="text-body">
              <CircleCheck aria-hidden className="size-4" />
              통과
            </Badge>
          ) : (
            <Badge tone="neutral" className="text-body">
              <CircleX aria-hidden className="size-4" />
              미통과
            </Badge>
          )}
          <p className="m-0 text-caption text-ink-muted">
            통과 기준: {result.total}개 중 {need}개(70%)
          </p>
          {!result.passed && <p className="m-0 text-body font-bold text-ink">통과까지 {need - result.score}점 남았어요</p>}
          <p className="m-0 text-body text-ink">
            최고 점수 <span className="font-bold tabular-nums">{best}/{result.total}</span>
            {newBest && <Badge tone="info" className="ml-2">최고 점수 갱신</Badge>}
          </p>
          <p className="m-0 h-5 text-caption text-ink-muted" aria-live="polite">
            {save.kind === 'saving' ? '기록 저장 중' : save.kind === 'saved' ? '기록을 저장했습니다' : ''}
          </p>
        </section>

        {missed.length > 0 && (
          <section aria-labelledby="missed-title" className="flex flex-col gap-2">
            <h2 id="missed-title" className="m-0 text-body font-bold text-ink">
              틀린 상황
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {missed.map((s) => {
                const no = stage.situations.indexOf(s) + 1
                const expanded = open === s.id
                return (
                  <li key={s.id} data-cmp="CMP-030" className="rounded-md border border-line">
                    <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : s.id)} className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-body text-ink">
                      <span className="font-bold">상황 {no}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-muted">{s.prompt}</span>
                      <span className="shrink-0 text-action">{expanded ? '닫기' : '정답 보기'}</span>
                    </button>
                    {expanded && <AnswerReplay situation={s} />}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-2 pt-2">
          {nextStage ? (
            <Button className="h-14" variant={result.passed ? 'primary' : 'secondary'} fullWidth loading={pendingTo === `/tutorial/stages/${nextStage.id}`} onClick={() => go(`/tutorial/stages/${nextStage.id}`)}>
              다음 스테이지
            </Button>
          ) : (
            <Button className="h-14" variant={result.passed ? 'primary' : 'secondary'} fullWidth loading={pendingTo === '/tutorial'} onClick={() => go('/tutorial')}>
              튜토리얼 홈으로
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button className={cn('h-14', !result.passed && 'col-span-2')} variant={result.passed ? 'secondary' : 'primary'} loading={pendingTo === `/tutorial/stages/${stage.id}`} onClick={() => go(`/tutorial/stages/${stage.id}`)}>
              다시 하기
            </Button>
            <Button asChild variant="secondary" className={cn('h-14', !result.passed && 'col-span-2')}>
              <Link to="/tutorial" onClick={() => save.kind === 'saved' && (leaving.current = true)}>
                홈
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        title="기록이 저장되지 않았습니다"
        description="나가면 이번 결과는 반영되지 않습니다"
        tone="danger"
        confirmLabel="나가기"
        cancelLabel="머무르기"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </section>
  )
}

// 틀린 상황의 정답 움직임 재생(SCR-102 ST10과 같은 컨트롤: 다시 보기·느리게 보기)
function AnswerReplay({ situation }: { situation: Situation }) {
  const [playKey, setPlayKey] = useState(0)
  const [slow, setSlow] = useState(false)
  const best = bestChoice(situation)
  // 타임라인은 같은 객체로 유지(렌더마다 새로 만들면 재생이 끝없이 다시 시작됨)
  const timeline = useMemo(() => outcomeTimeline(situation, best), [situation, best])
  const { frame, playing, skip } = usePlayback(timeline, playKey, slow ? 0.5 : 1, noop)
  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-4">
      <div className="flex h-72 flex-col">
        <TutorialCourt frame={frame} label={`${situation.prompt} 정답 움직임: ${best.label}`} playing={playing} onSkip={skip} />
      </div>
      <p className="m-0 text-body text-ink">
        <span className="font-bold">정답 움직임 · {best.label}</span> — {best.reason}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={playing} onClick={() => setPlayKey((k) => k + 1)}>
          다시 보기
        </Button>
        <Button variant={slow ? 'primary' : 'secondary'} aria-pressed={slow} onClick={() => { setSlow((v) => !v); setPlayKey((k) => k + 1) }}>
          느리게 보기(0.5배속)
        </Button>
      </div>
    </div>
  )
}
const noop = () => {}
