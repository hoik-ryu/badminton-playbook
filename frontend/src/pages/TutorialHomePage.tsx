import { Check, ChevronRight, Play, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useRouteLoaderData } from 'react-router'

import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { StateView } from '../components/StateView'
import { getMyTutorialProgress, getTutorialCourses, type ProgressMap, type TutorialCourse, type TutorialCourseStage, type TutorialCourses } from '../features/tutorial/api'
import type { ShellData } from '../routes/guards'

// SCR-101 튜토리얼 목록(/tutorial, 로그인 후 첫 화면) — UX Spec r5(02 SCR-101) + Design Direction r6(V04-A, VD-032–036·043·046), Preview r3 승인
// 계층(VD-043): 제목 → 소개 배너 + 전체 진행률(VD-033, CMP-049) → 이어서 하기(VD-035, CMP-050) → 과정 카드(VD-032, CMP-048) + 스테이지 행(VD-036, CMP-047) → 준비 중(CMP-048 comingSoon)
// 데이터(사용자 결정 2026-11-19 D-T1): 과정·스테이지 목록은 GET /api/me/tutorial/courses, 본인 진행은 GET /progress(AC-067) — 둘을 따로 불러옴
// 상태(사용자 결정 2026-11-20, SCR-101 안에서 처리):
//  - ST2 로딩: 카드 배치를 유지한 스켈레톤(목록을 받았으면 진행 표시 자리만 스켈레톤)
//  - ST4 목록 실패(data-error=courses): 안내 + 다시 시도
//  - ST4 진행 실패(data-error=progress): 카드·스테이지 행은 보이고 누를 수 있음, 진행 표시 자리에 오류 안내 + 다시 시도. 0점·미통과로 꾸며 보여 주지 않음(UXD-084), 이어서 하기 숨김
//  - ST3 기록 없음, ST7 모두 통과(이어서 하기 숨김, ASM-038)
// 튜토리얼 난이도는 회원 급수와 별개(AC-093). 이어서 하기 = 과정 순서대로 아직 통과하지 않은 첫 스테이지(C-29, ASM-038)
type Load<T> = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; value: T }

const assetUrl = (id: string) => `${import.meta.env.BASE_URL}assets/${id}.png`

export function TutorialHomePage() {
  const data = useRouteLoaderData('member') as ShellData | undefined
  const meId = data?.me.id ?? null
  const [courses, setCourses] = useState<Load<TutorialCourses>>({ kind: 'loading' })
  const [progress, setProgress] = useState<Load<ProgressMap>>({ kind: 'loading' })

  const loadProgress = useCallback(async () => {
    if (!meId) return
    setProgress({ kind: 'loading' })
    try {
      setProgress({ kind: 'ok', value: await getMyTutorialProgress(meId) })
    } catch {
      setProgress({ kind: 'error' })
    }
  }, [meId])
  const loadCourses = useCallback(async () => {
    setCourses({ kind: 'loading' })
    try {
      setCourses({ kind: 'ok', value: await getTutorialCourses() })
    } catch {
      setCourses({ kind: 'error' })
    }
  }, [])
  const loadAll = useCallback(() => {
    void loadCourses()
    void loadProgress()
  }, [loadCourses, loadProgress])
  useEffect(() => {
    loadAll()
  }, [loadAll])

  const released = courses.kind === 'ok' ? courses.value.courses.filter((c) => c.released) : []
  const comingSoon = courses.kind === 'ok' ? courses.value.courses.filter((c) => !c.released) : []
  const allStages = released.flatMap((c) => c.stages.map((s) => ({ course: c, stage: s })))
  const map = progress.kind === 'ok' ? progress.value : null
  const passedCount = map ? allStages.filter(({ stage }) => map[stage.id]?.passed).length : 0
  const anyRecord = map ? allStages.some(({ stage }) => map[stage.id]) : false
  const next = map ? allStages.find(({ stage }) => !map[stage.id]?.passed) : undefined

  const st =
    courses.kind === 'loading' || (courses.kind === 'ok' && progress.kind === 'loading')
      ? 'SCR-101-ST2'
      : courses.kind === 'error' || progress.kind === 'error'
        ? 'SCR-101-ST4'
        : !anyRecord
          ? 'SCR-101-ST3'
          : !next
            ? 'SCR-101-ST7'
            : 'SCR-101-ST1'
  const errorKind = courses.kind === 'error' ? 'courses' : progress.kind === 'error' ? 'progress' : undefined

  return (
    <section data-scr="SCR-101" data-st={st} data-error={errorKind} className="flex w-full max-w-[600px] flex-1 flex-col bg-page">
      <PageHeader title="튜토리얼" />
      <div className="flex flex-col px-3 pb-6">
        {courses.kind === 'loading' ? (
          <ListSkeleton />
        ) : courses.kind === 'error' ? (
          <>
            <Banner>{null}</Banner>
            <StateView
              kind="error"
              title="튜토리얼 목록을 불러오지 못했습니다"
              description="네트워크를 확인한 뒤 다시 시도해 주세요."
              action={<Button variant="secondary" size="md" onClick={loadAll}>다시 시도</Button>}
            />
          </>
        ) : (
          <>
            <Banner>
              {progress.kind === 'loading' ? (
                <div aria-busy="true" aria-label="진행 기록을 불러오는 중" className="tu-soft relative mt-3.5 h-10 animate-pulse rounded-md bg-page motion-reduce:animate-none" />
              ) : progress.kind === 'error' ? (
                <ProgressError onRetry={() => void loadProgress()} />
              ) : (
                <div data-cmp="CMP-049" data-variant="overall" className="tu-soft relative mt-3.5 flex h-10 items-center gap-3 rounded-md bg-page px-3">
                  <span className="text-caption font-bold whitespace-nowrap text-ink">전체 진행률</span>
                  <span role="progressbar" aria-label="전체 진행률" aria-valuenow={passedCount} aria-valuemin={0} aria-valuemax={allStages.length} className="h-2 flex-1 overflow-hidden rounded-md bg-surface">
                    <i className="block h-full rounded-md bg-action" style={{ width: `${allStages.length ? (passedCount / allStages.length) * 100 : 0}%` }} />
                  </span>
                  <span className="text-caption font-bold whitespace-nowrap tabular-nums text-ink">
                    {passedCount} / {allStages.length} 완료
                  </span>
                </div>
              )}
            </Banner>

            {progress.kind === 'loading' && <div aria-hidden className="tu-soft-lg mt-3 h-[66px] animate-pulse rounded-md border border-line/70 bg-page motion-reduce:animate-none" />}
            {map && next && <ContinueCard course={next.course} stage={next.stage} best={map[next.stage.id]?.best ?? null} />}

            <div className="mt-5 flex flex-col gap-[18px]">
              {released.map((c) => (
                <CourseCard key={c.id} course={c} progress={progress} />
              ))}
            </div>

            {comingSoon.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {comingSoon.map((c) => (
                  <button key={c.id} type="button" disabled aria-disabled="true" aria-label={`${c.name} 과정, 준비 중, 선택할 수 없음`} data-cmp="CMP-048" data-variant="comingSoon" className="flex h-12 items-center justify-between rounded-md border border-dashed border-line bg-page pr-3 pl-3.5">
                    <span className="text-body font-bold text-ink-disabled">{c.name} 과정</span>
                    <span className="inline-flex h-[22px] items-center rounded-full bg-surface px-2 text-caption font-bold text-ink-muted">준비 중</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** VD-033 소개 배너(공통 안내 '처음이라면 입문자부터' 포함, C-22·23). children = 전체 진행률 자리 */
function Banner({ children }: { children: ReactNode }) {
  return (
    <section data-testid="intro-banner" aria-labelledby="tutorial-banner-title" className="tu-banner relative overflow-hidden rounded-md px-4 pt-[18px] pb-3">
      <span aria-hidden className="tu-streaks pointer-events-none absolute inset-0" />
      <img src={assetUrl('AST-046')} alt="" aria-hidden className="tu-shuttle absolute top-1.5 right-2 w-[102px]" />
      <p className="relative m-0 text-caption font-bold text-ink-accent">SMAPSH 위치 학습</p>
      <h2 id="tutorial-banner-title" className="relative m-0 mt-1 text-heading leading-snug font-extrabold tracking-tight text-ink">
        코트 위 번호로
        <br />
        복식 위치를 익혀요
      </h2>
      <p className="relative m-0 mt-1.5 text-caption text-ink-muted">처음이라면 입문자부터 차근차근 시작해 보세요.</p>
      {children}
    </section>
  )
}

function ContinueCard({ course, stage, best }: { course: TutorialCourse; stage: TutorialCourseStage; best: number | null }) {
  return (
    <Link to={`/tutorial/stages/${stage.id}`} data-cmp="CMP-050" className="tu-soft-lg mt-3 flex items-center gap-3 rounded-md border border-line/70 bg-page px-3 py-2.5 text-ink no-underline">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink-accent bg-page text-ink-accent">
        <Play className="size-5 fill-current" />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="text-caption font-bold text-ink-accent">이어서 하기</span>
        <span className="truncate text-body font-extrabold tracking-tight">
          {course.name} · {stage.title}
        </span>
        <span className="text-caption text-ink-muted">
          스테이지 {stage.no} · 약 {stage.minutes}분{best !== null ? ` · 최고 ${best}/${stage.situations}` : ''}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 text-ink-muted" />
    </Link>
  )
}

function CourseCard({ course, progress }: { course: TutorialCourse; progress: Load<ProgressMap> }) {
  const map = progress.kind === 'ok' ? progress.value : null
  const cp = map ? course.stages.filter((s) => map[s.id]?.passed).length : null
  return (
    <section data-cmp="CMP-048" data-variant="available" data-course={course.id} aria-labelledby={`course-${course.id}`}>
      <div className="mb-2 flex items-center gap-2 px-1">
        {course.icon && <img src={assetUrl(course.icon)} alt="" aria-hidden className="size-6 object-contain" />}
        <span className="grid flex-1">
          <h2 id={`course-${course.id}`} className="m-0 text-title leading-tight font-extrabold tracking-tight text-ink">
            {course.name} 과정
          </h2>
          {course.description && <span className="text-caption text-ink-muted">{course.description}</span>}
        </span>
        {progress.kind === 'loading' && <span aria-hidden className="h-[26px] w-12 animate-pulse rounded-full bg-surface motion-reduce:animate-none" />}
        {cp !== null && (
          <span aria-label={`${course.stages.length}개 중 ${cp}개 통과`} className="inline-flex h-[26px] items-center rounded-full bg-mint-subtle px-2.5 text-caption font-bold tabular-nums text-ink-accent">
            {cp} / {course.stages.length}
          </span>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col gap-[7px] p-0" aria-label={`${course.name} 스테이지`}>
        {course.stages.map((s) => (
          <StageRow key={s.id} stage={s} progress={progress} />
        ))}
      </ul>
    </section>
  )
}

function StageRow({ stage, progress }: { stage: TutorialCourseStage; progress: Load<ProgressMap> }) {
  const rec = progress.kind === 'ok' ? progress.value[stage.id] : undefined
  const known = progress.kind === 'ok'
  const status = !known ? 'unknown' : rec ? (rec.passed ? 'passed' : 'failed') : 'notPlayed'
  const chip =
    status === 'passed' ? { t: '통과', c: 'bg-mint-subtle text-ink-accent' } : status === 'failed' ? { t: '미완료', c: 'bg-warning-bg text-warning-fg' } : { t: '아직 안 함', c: 'bg-surface text-ink-muted' }
  const label = [
    `스테이지 ${stage.no}`,
    stage.title,
    ...(known ? [chip.t] : []),
    ...(known && rec ? [`최고 점수 ${stage.situations}점 중 ${rec.best}점`] : []),
    `약 ${stage.minutes}분`,
  ].join(', ')
  return (
    <li>
      <Link to={`/tutorial/stages/${stage.id}`} aria-label={label} data-cmp="CMP-047" data-variant={status} className="tu-soft flex min-h-14 items-center gap-3 rounded-md border border-line/70 bg-page py-1.5 pr-2.5 pl-1.5 text-ink no-underline">
        {stage.thumbnail ? <img src={assetUrl(stage.thumbnail)} alt="" aria-hidden className="h-12 w-20 shrink-0 rounded-sm bg-mint-subtle object-cover" /> : <span aria-hidden className="h-12 w-20 shrink-0 rounded-sm bg-mint-subtle" />}
        <span className="grid min-w-0 flex-1 overflow-hidden">
          <span className="flex items-center gap-1.5 text-body leading-tight font-extrabold tracking-tight whitespace-nowrap">
            스테이지 {stage.no}
            {progress.kind === 'loading' && <span aria-hidden className="h-5 w-12 animate-pulse rounded-full bg-surface motion-reduce:animate-none" />}
            {known && (
              <span className={`inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-caption font-bold ${chip.c}`}>
                {status === 'passed' && <Check aria-hidden className="size-3.5" />}
                {chip.t}
              </span>
            )}
          </span>
          <span className="truncate text-caption text-ink-muted">
            {stage.title}
            {known && rec ? ` · 최고 ${rec.best}/${stage.situations}` : ''}
          </span>
        </span>
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-mint-subtle px-2 text-caption font-bold tabular-nums text-ink-accent">약 {stage.minutes}분</span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
      </Link>
    </li>
  )
}

/** 진행 기록 실패: 0점·미통과로 꾸미지 않고 안내 + 다시 시도(UXD-084, 사용자 결정 2026-11-20) */
function ProgressError({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-cmp="CMP-023" role="alert" className="relative mt-3.5 flex items-center justify-between gap-2 rounded-md bg-danger-bg py-1 pr-1 pl-3 text-caption font-bold text-danger-fg">
      진행 기록을 불러오지 못했습니다
      <button type="button" onClick={onRetry} className="flex h-11 items-center gap-1 rounded-md px-3 text-body font-bold text-danger-fg underline">
        <RotateCw aria-hidden className="size-4" />
        다시 시도
      </button>
    </div>
  )
}

/** ST2: 배너·이어서 하기·과정 카드 배치를 유지한 스켈레톤 */
function ListSkeleton() {
  const pulse = 'animate-pulse motion-reduce:animate-none'
  return (
    <div aria-busy="true" aria-label="튜토리얼을 불러오는 중" data-testid="tutorial-skeleton" className="flex flex-col">
      <div className={`h-[178px] rounded-md bg-mint-subtle ${pulse}`} />
      <div className={`mt-3 h-[66px] rounded-md border border-line/70 bg-surface ${pulse}`} />
      {[2, 3, 3].map((n, i) => (
        <div key={i} className="mt-5 flex flex-col gap-[7px]">
          <div className={`mb-1 h-9 w-2/3 rounded-md bg-surface ${pulse}`} />
          {Array.from({ length: n }, (_, j) => (
            <div key={j} className={`h-[62px] rounded-md border border-line/70 bg-surface ${pulse}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
