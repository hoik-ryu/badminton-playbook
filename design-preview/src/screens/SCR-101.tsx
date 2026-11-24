import { Check, ChevronRight, Play, RotateCw } from 'lucide-react'
import { AppNav } from '../components/smapsh/AppNav'
import { Screen, ScrollSafeArea } from '../components/smapsh/Layout'
import { PageHeader } from '../components/smapsh/PageHeader'
import { allPassed, assetUrl, courses, type Course, type Stage } from '../mock/tutorial'
import { continueStage, flowHref, stageState } from '../mock/tutorialFlow'

const KEY: Record<string, string> = { 입문자: 'intro', 왕초급: 'starter', 초급: 'basic' }

// SCR-101 튜토리얼 목록 — UX Spec r5(02 SCR-101) + Design Direction r5(V04-A 채택 EXP-V04-A)
// VD-043 계층: 제목 → 소개 배너(VD-033, 전체 진행률 CMP-049) → 이어서 하기 흰 카드(VD-035) → 과정 카드(VD-032, 스테이지 행 VD-036) → 준비 중(VD-035)
// VD-046 일러스트: 썸네일 AST-027–034, 과정 장식 AST-035–037, 배너 셔틀 AST-046(장식, aria-hidden). VD-024 r4 개정안: 흰 카드 + 옅은 그림자
// 강조 글자 color.text.accent, 막대·아이콘 color.action.primary(UX Spec r4 역할 분리)
export function Scr101({ stateId }: { stateId: string }) {
  const empty = stateId === 'SCR-101-ST3'
  const error = stateId === 'SCR-101-ST4'
  const done = stateId === 'SCR-101-ST7'
  // ST1은 프리뷰 흐름 모드의 진행 기록(메모리)을 반영 — 흐름에서 통과하면 목록에 바로 보임
  const live: Course[] = courses.map((c) => ({ ...c, stages: c.stages.map((s) => ({ ...s, ...stageState(`${KEY[c.name]}-${s.no}`) })) }))
  const data: Course[] = done ? allPassed : empty ? courses.map((c) => ({ ...c, stages: c.stages.map((s) => ({ ...s, status: 'notPlayed' as const, best: 0 })) })) : live
  const total = data.reduce((n, c) => n + c.stages.length, 0)
  const passed = data.reduce((n, c) => n + c.stages.filter((s) => s.status === 'passed').length, 0)
  const cs = continueStage()
  const cst = cs && stageState(cs.key)
  const next = empty || !cs ? { key: 'intro-1', course: '입문자', goal: '코트와 번호 익히기', no: 1, minutes: 2, best: null as number | null }
    : { key: cs.key, course: cs.course, goal: cs.goal, no: cs.step, minutes: courses.find((c) => c.name === cs.course)!.stages[cs.step - 1].minutes, best: cst && cst.best > 0 ? cst.best : null }
  return (
    <Screen scr="SCR-101" st={stateId} platform="mobile">
      <PageHeader title="튜토리얼" leading="none" trailing="none" />
      <main className="flex flex-col px-3 pb-4">
        {/* VD-033 소개 배너 + 전체 진행률 */}
        <section data-testid="intro-banner" className="tu-banner relative overflow-hidden rounded-md px-4 pt-[18px] pb-3">
          <span aria-hidden className="tu-streaks pointer-events-none absolute inset-0" />
          <img src={assetUrl('AST-046')} alt="" aria-hidden className="tu-shuttle absolute top-1.5 right-2 w-[102px]" />
          <p className="relative text-caption font-bold text-ink-accent">SMAPSH 위치 학습</p>
          <h2 className="relative mt-1 text-heading leading-snug font-extrabold tracking-tight text-ink">
            코트 위 번호로
            <br />
            복식 위치를 익혀요
          </h2>
          <p className="relative mt-1.5 text-caption text-ink-muted">처음이라면 입문자부터 차근차근 시작해 보세요.</p>
          {error ? (
            <ProgressError />
          ) : (
            <div data-cmp="CMP-049" data-variant="overall" className="tu-soft relative mt-3.5 flex h-10 items-center gap-3 rounded-md bg-page px-3">
              <span className="text-caption font-bold whitespace-nowrap text-ink">전체 진행률</span>
              <span role="progressbar" aria-valuenow={passed} aria-valuemax={total} className="h-2 flex-1 overflow-hidden rounded-md bg-surface">
                <i className="block h-full rounded-md bg-action" style={{ width: `${(passed / total) * 100}%` }} />
              </span>
              <span className="text-caption font-bold whitespace-nowrap tabular-nums text-ink">
                {passed} / {total} 완료
              </span>
            </div>
          )}
        </section>

        {/* VD-035 이어서 하기(ST4 오류·ST7 전체 완료에서는 숨김, UXD-084·ASM-038) */}
        {!error && !done && cs !== undefined && (
          <a href={flowHref(next.key)} data-cmp="CMP-050" className="tu-soft-lg mt-3 flex items-center gap-3 rounded-md border border-line/70 bg-page px-3 py-2.5 text-ink no-underline">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink-accent bg-page text-ink-accent">
              <Play className="size-5 fill-current" />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="text-caption font-bold text-ink-accent">이어서 하기</span>
              <span className="truncate text-body font-extrabold tracking-tight">
                {next.course} · {next.goal}
              </span>
              <span className="text-caption text-ink-muted">
                스테이지 {next.no} · 약 {next.minutes}분{next.best !== null ? ` · 최고 ${next.best}/5` : ''}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-ink-muted" />
          </a>
        )}

        {/* VD-032 과정 카드 + VD-036 스테이지 행 */}
        <div className="mt-5 flex flex-col gap-[18px]">
          {data.map((c) => {
            const cp = c.stages.filter((s) => s.status === 'passed').length
            return (
              <section key={c.name} data-cmp="CMP-048" data-variant="available">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <img src={assetUrl(c.icon)} alt="" aria-hidden className="size-6 object-contain" />
                  <span className="grid flex-1">
                    <span className="text-title leading-tight font-extrabold tracking-tight text-ink">{c.name} 과정</span>
                    <span className="text-caption text-ink-muted">{c.desc}</span>
                  </span>
                  {!error && (
                    <span className="inline-flex h-[26px] items-center rounded-full bg-mint-subtle px-2.5 text-caption font-bold tabular-nums text-ink-accent">
                      {cp} / {c.stages.length}
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-[7px]">
                  {c.stages.map((s) => (
                    <StageRow key={s.no} s={s} error={error} href={flowHref(`${KEY[c.name]}-${s.no}`)} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>

        {/* 중급·고급 준비 중(누를 수 없음) */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {['중급', '고급'].map((n) => (
            <button key={n} type="button" disabled aria-disabled="true" aria-label={`${n} 과정, 준비 중, 선택할 수 없음`} data-cmp="CMP-048" data-variant="comingSoon" className="flex h-12 items-center justify-between rounded-md border border-dashed border-line bg-page pr-3 pl-3.5">
              <span className="text-body font-bold text-ink-disabled">{n} 과정</span>
              <span className="inline-flex h-[22px] items-center rounded-full bg-surface px-2 text-caption font-bold text-ink-muted">준비 중</span>
            </button>
          ))}
        </div>
        <ScrollSafeArea withBar={false} />
      </main>
      <AppNav active="tutorial" role="member" />
    </Screen>
  )
}

function StageRow({ s, error, href }: { s: Stage; error: boolean; href: string }) {
  const chip = s.status === 'passed' ? { t: '통과', c: 'bg-mint-subtle text-ink-accent' } : s.status === 'failed' ? { t: '미완료', c: 'bg-warning-bg text-warning-fg' } : { t: '아직 안 함', c: 'bg-surface text-ink-muted' }
  return (
    <li>
      <a href={href} data-cmp="CMP-047" data-variant={s.status} className="tu-soft flex min-h-14 items-center gap-3 rounded-md border border-line/70 bg-page py-1.5 pr-2.5 pl-1.5 text-ink no-underline">
        <img src={assetUrl(s.thumb)} alt="" aria-hidden className="h-12 w-20 shrink-0 rounded-sm bg-mint-subtle object-cover" />
        <span className="grid min-w-0 flex-1 overflow-hidden">
          <span className="flex items-center gap-1.5 text-body leading-tight font-extrabold tracking-tight whitespace-nowrap">
            스테이지 {s.no}
            {!error && (
              <span className={`inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-caption font-bold ${chip.c}`}>
                {s.status === 'passed' && <Check aria-hidden className="size-3.5" />}
                {chip.t}
              </span>
            )}
          </span>
          <span className="truncate text-caption text-ink-muted">
            {s.goal}
            {!error && s.status !== 'notPlayed' ? ` · 최고 ${s.best}/5` : ''}
          </span>
        </span>
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-mint-subtle px-2 text-caption font-bold tabular-nums text-ink-accent">약 {s.minutes}분</span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
      </a>
    </li>
  )
}

function ProgressError() {
  return (
    <div data-cmp="CMP-023" role="alert" className="relative mt-3.5 flex items-center justify-between gap-2 rounded-md bg-danger-bg py-1 pr-1 pl-3 text-caption font-bold text-danger-fg">
      진행 기록을 불러오지 못했습니다
      <button type="button" className="flex h-11 items-center gap-1 rounded-md px-3 text-body font-bold text-danger-fg underline">
        <RotateCw aria-hidden className="size-4" />
        다시 시도
      </button>
    </div>
  )
}
