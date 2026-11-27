import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useBlocker, useNavigate, useParams, useRouteLoaderData } from 'react-router'

import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoticeBox } from '../components/NoticeBox'
import { StateView } from '../components/StateView'
import { useToast } from '../components/toastContext'
import { isAdmin } from '../features/auth/types'
import { CLUB_ERRORS, deleteClubMatch, getClubMatchView } from '../features/clubmatch/api'
import { deleteTitle } from '../features/clubmatch/display'
import { BasicStep } from '../features/clubmatch/setup/BasicStep'
import { ConfirmStep } from '../features/clubmatch/setup/ConfirmStep'
import { GamesStep } from '../features/clubmatch/setup/GamesStep'
import { ParticipantsStep } from '../features/clubmatch/setup/ParticipantsStep'
import { SetupFrame } from '../features/clubmatch/setup/SetupFrame'
import { completion, isStepKey, reachable, resumeStep, setupPath, STEP_NAMES, STEP_SCR, stepsFor, type StepKey } from '../features/clubmatch/setup/steps'
import { TeamsStep } from '../features/clubmatch/setup/TeamsStep'
import type { FrameCommon } from '../features/clubmatch/setup/types'
import { useSetup } from '../features/clubmatch/setup/useSetup'
import { ClubMatchScope } from '../features/clubmatch/ui/ClubMatchBadge'
import { isApiError } from '../lib/api'
import type { ShellData } from '../routes/guards'

// 청백전 생성 페이지(SCR-241–246) — /club-matches/new(만들기 전 기본정보) · /club-matches/:matchId/setup/:step
// UX Spec r9 01 IA(생성 페이지 주소)·02 '생성 페이지 공통', 기획 r10 C-31–C-34, DD r12, Preview r8. 운영진·슈퍼 관리자 전용(탭바 숨김)
// - 회원: /new는 SCR-004(/forbidden), setup 주소는 존재를 드러내지 않는 "청백전을 찾을 수 없습니다"(SCR-112-ST5, AC-069)
// - 준비 중이 아닌 청백전은 상세(SCR-112)로. 단계 주소가 없거나 아직 갈 수 없는 단계면 저장된 데이터로 계산한 단계로(AC-131, C-32)
// - 저장하지 않은 변경이 있는 채로 페이지 밖으로 나가면 이탈 확인(UXD-099). 단계 사이 이동은 입력 유지
// - (CP-001, UXD-114) 만든 뒤에는 모든 단계(개인전 4·팀전 5) 머리글 더보기 → '청백전 삭제'(사용자 지시 2026-11-27: 기본정보만 → 전 단계).
//   확인 창·실패 안내는 페이지가 소유하고 frame으로 단계 화면에 넘김
type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'notFound' } | { kind: 'ok' }

export function ClubMatchSetupPage() {
  const { matchId, step: stepParam } = useParams()
  const shell = useRouteLoaderData('member') as ShellData | undefined
  const me = shell?.me ?? null
  if (me && !isAdmin(me)) {
    if (!matchId) return <Navigate to="/forbidden" replace />
    return <NotFoundView />
  }
  return <SetupScreen key={matchId ?? 'new'} matchId={matchId ?? null} stepParam={stepParam} />
}

function NotFoundView() {
  return (
    <ClubMatchScope data-scr="SCR-112" data-st="SCR-112-ST5" className="flex w-full flex-1 flex-col px-4 pt-6">
      <StateView
        kind="notFound"
        title="청백전을 찾을 수 없습니다"
        action={
          <Button asChild variant="secondary" fullWidth>
            <Link to="/club-matches">청백전 목록으로</Link>
          </Button>
        }
      />
    </ClubMatchScope>
  )
}

function SetupScreen({ matchId, stepParam }: { matchId: string | null; stepParam?: string }) {
  const navigate = useNavigate()
  const toast = useToast()
  const c = useSetup()
  const [load, setLoad] = useState<Load>(matchId ? { kind: 'loading' } : { kind: 'ok' })
  const leaving = useRef(false)
  const [askDelete, setAskDelete] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const fetchView = useCallback(async () => {
    if (!matchId) return
    setLoad({ kind: 'loading' })
    try {
      c.resetTo(await getClubMatchView(matchId))
      setLoad({ kind: 'ok' })
    } catch (e) {
      setLoad(isApiError(e) && (e.status === 404 || e.status === 403) ? { kind: 'notFound' } : { kind: 'error' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 청백전이 바뀔 때만 다시 불러옴
  }, [matchId])
  useEffect(() => {
    void fetchView()
  }, [fetchView])

  const v = c.view
  const step: StepKey = !matchId ? 'basic' : isStepKey(stepParam) ? stepParam : 'basic'

  // 단계가 바뀌면 맨 위에서 시작하고 단계 제목으로 초점(화면 읽기: 새 단계 안내). 첫 진입은 그대로
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    if (!navigator.userAgent.includes('jsdom')) window.scrollTo(0, 0)
    document.querySelector<HTMLElement>('.su-title')?.focus({ preventScroll: true })
  }, [step])

  // 이탈 확인: 저장하지 않은 변경이 있는 채로 생성 페이지 밖으로(머리글 나가기·라우트 이동·브라우저 뒤로 가기 = useBlocker)
  // (r13, UXD-103·B-23) 미완성 경기가 있으면 문구 '완성하지 않은 경기가 있습니다', 새로고침·창 닫기는 브라우저 기본 확인(beforeunload)
  const anyDirty = Object.values(c.dirty).some(Boolean)
  const partialsLeft = c.dirty.partials
  useEffect(() => {
    if (!anyDirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyDirty])
  const blocker = useBlocker(({ nextLocation }) => {
    if (leaving.current || !anyDirty) return false
    const inside = matchId ? nextLocation.pathname.startsWith(setupPath(matchId)) : nextLocation.pathname === '/club-matches/new'
    return !inside
  })

  const go = useCallback((s: StepKey) => {
    if (matchId) navigate(setupPath(matchId, s))
  }, [matchId, navigate])

  const frame: FrameCommon = useMemo(() => {
    const method = step === 'basic' ? c.drafts.basic.method : (v?.method ?? null)
    const done = v ? completion(v) : null
    const reach = v ? reachable(v) : new Set<StepKey>(['basic'])
    return {
      steps: method ? stepsFor(method).map((k) => ({ key: k, name: STEP_NAMES[k], done: !!done?.[k], reachable: reach.has(k) })) : null,
      current: step,
      onStep: (k: string) => isStepKey(k) && go(k),
      onExit: () => navigate('/club-matches'),
      // 만든 뒤(v 있음)에만 더보기 메뉴. 단계와 무관
      onMore: v ? () => setAskDelete(true) : undefined,
      deleting: askDelete,
      moreNotice: deleteFailed ? <NoticeBox tone="danger">청백전을 삭제하지 못했습니다. 다시 시도해 주세요</NoticeBox> : null,
    }
  }, [step, c.drafts.basic.method, v, go, navigate, askDelete, deleteFailed])

  const removeMatch = async () => {
    if (!v) return
    setDeleteFailed(false)
    try {
      await deleteClubMatch(v.id, v.version)
      leaving.current = true // 삭제 뒤 목록 이동은 이탈 확인 없이
      toast('청백전을 삭제했습니다') // (CP-001, UXD-114) 목록으로 돌아가 완료 알림
      navigate('/club-matches', { replace: true, state: { deleted: v.name } })
    } catch (e) {
      if (isApiError(e) && e.status === 404) {
        leaving.current = true
        navigate('/club-matches', { replace: true })
      } else if (isApiError(e) && e.code === CLUB_ERRORS.conflict) c.setConflict(await getClubMatchView(v.id))
      else setDeleteFailed(true)
    }
  }

  if (load.kind === 'notFound') return <NotFoundView />
  if (matchId && v && v.status !== 'draft') return <Navigate to={`/club-matches/${encodeURIComponent(matchId)}`} replace />
  // 단계 주소가 없거나 갈 수 없는 단계·개인전 팀 구성이면 계산된 단계로(재진입, AC-131)
  if (matchId && v && load.kind === 'ok') {
    const want = !isStepKey(stepParam) ? resumeStep(v) : !stepsFor(v.method).includes(stepParam) ? 'games' : !reachable(v).has(stepParam) ? resumeStep(v) : null
    if (want && want !== stepParam) return <Navigate to={setupPath(matchId, want)} replace />
  }

  const loadingOrError = load.kind === 'loading' || load.kind === 'error' || (matchId && !v)
  const scr = STEP_SCR[step]
  const body = loadingOrError ? (
    <SetupFrame scr={scr} st={load.kind === 'error' ? `${scr}-ST4` : `${scr}-ST2`} method="none" title={STEP_NAMES[step]} desc="청백전을 불러오는 중입니다." compact={step !== 'basic'} steps={null} current={step} onExit={frame.onExit}>
      {load.kind === 'error' ? (
        <StateView kind="error" title="청백전을 불러오지 못했습니다" description="연결이 불안정합니다. 다시 시도해 주세요" action={<Button variant="secondary" fullWidth onClick={() => void fetchView()}>다시 시도</Button>} />
      ) : (
        <StateView kind="loading" rows={4} label="청백전을 불러오는 중" />
      )}
    </SetupFrame>
  ) : step === 'basic' ? (
    <BasicStep
      c={c}
      frame={frame}
      go={go}
      onCreated={(id) => {
        leaving.current = true
        // 만든 뒤 주소를 /setup/basic으로 바꾸고 참가자 설정으로(02 SCR-241 '다음'(만들기 전))
        navigate(setupPath(id, 'basic'), { replace: true })
        navigate(setupPath(id, 'participants'))
      }}
    />
  ) : step === 'participants' ? (
    <ParticipantsStep c={c} frame={frame} go={go} />
  ) : step === 'teams' ? (
    <TeamsStep c={c} frame={frame} go={go} />
  ) : step === 'games' ? (
    <GamesStep c={c} frame={frame} go={go} />
  ) : (
    <ConfirmStep c={c} frame={frame} go={go} />
  )

  return (
    <ClubMatchScope className="flex w-full flex-1 flex-col" data-role="admin">
      {body}
      <ConfirmDialog
        open={askDelete}
        onOpenChange={(o) => !o && setAskDelete(false)}
        tone="danger"
        title={v ? deleteTitle(v.name) : '청백전을 삭제할까요?'}
        description="참가자와 대진도 함께 지워지고 되돌릴 수 없습니다"
        confirmLabel="삭제"
        onConfirm={removeMatch}
      />
      <ConfirmDialog
        open={!!c.conflict}
        onOpenChange={() => undefined}
        tone="conflict"
        title="다른 운영진이 청백전을 변경했습니다"
        description="방금 한 작업은 처리되지 않았습니다. 닫으면 최신 상태를 보여 줍니다"
        onConfirm={() => {
          const latest = c.conflict
          c.setConflict(null)
          c.setFailure(null)
          if (latest) c.resetTo(latest) // 최신 상태로 다시 그리고 단계 완료 여부를 다시 판정(위 계산된 단계 이동)
        }}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        tone="danger"
        title={partialsLeft ? '완성하지 않은 경기가 있습니다' : v ? '저장하지 않은 변경이 있습니다' : '입력한 내용을 버릴까요?'}
        description={partialsLeft ? '나가면 사라집니다' : v ? '나가면 이 단계에서 바꾼 내용이 사라집니다' : undefined}
        cancelLabel={v ? '계속 편집' : '계속 입력'}
        confirmLabel={v ? '나가기' : '버리기'}
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </ClubMatchScope>
  )
}
