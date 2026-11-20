import { AlertCircle, Check, ChevronDown, LoaderCircle, Play, RotateCcw, Snail } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { COLUMN } from '../components/smapsh/Layout'
import { cells } from '../components/smapsh/TutorialCourt'
import { StadiumCourt } from '../components/smapsh/StadiumCourt'
import { result as R } from '../mock/tutorial'
import { flowHref, getResult, nextStage, progress, save, stageByKey } from '../mock/tutorialFlow'

// SCR-103 스테이지 결과 — UX Spec r5(02 SCR-103) + Design Direction r5
// 셸 VD-045(V05-B 밴드·구획형, EXP-V05-MIX SCR-103=B): 가운데 점수(font.size.display 32) → 통과 표시·기준 → 구분선 구획(최고 점수 · 진행률 VD-037 · 틀린 상황 CMP-030)
// 버튼 영역은 화면 아래 고정(목록만 스크롤). 버튼 모서리 radius.md(VD-044와 통일), 갱신 배지 글자 color.text.accent, 안내 상자 radius.md
// 상태: ST1 통과 · ST2 저장 중(결과 먼저, 진행률은 저장 뒤) · ST4 저장 실패 · ST7 미통과('다시 하기' 강조)
// 흐름 모드 'SCR-103-FLOW': SCR-102 흐름의 결과를 받아 저장 중(ST2) → 통과(ST1)·미통과(ST7). 틀린 상황을 누르면 이 화면 안에서 정답 움직임 재생(UXD-065·069·079)
type Wrong = { no: number; kind: 'allow' | 'bad' }
type Data = {
  stateId: string; course: string; step: number; goal: string; score: number; best: number; bestNew: boolean
  passed: boolean; saving?: boolean; saveError?: boolean; wrong: Wrong[]; prog?: { course: [number, number]; overall: [number, number] }
  next?: string; retry: string; list: string; stageKey?: string
}

export function Scr103({ stateId }: { stateId: string }) {
  if (stateId === 'SCR-103-FLOW') return <FlowResultView />
  const failed = stateId === 'SCR-103-ST7'
  const d = failed ? R.fail : R.pass
  return (
    <View d={{ stateId, course: R.course, step: R.step, goal: R.goal, score: d.score, best: d.best, bestNew: d.bestNew, passed: !failed, saving: stateId === 'SCR-103-ST2', saveError: stateId === 'SCR-103-ST4', wrong: d.wrong, prog: R.progress, next: flowHref('starter-3'), retry: flowHref('starter-2'), list: '#SCR-101/SCR-101-ST1/mobile' }} />
  )
}

function FlowResultView() {
  const r = getResult()
  const [saved, setSaved] = useState<ReturnType<typeof save> | null>(null)
  useEffect(() => {
    if (!r) return
    const t = window.setTimeout(() => setSaved(save(r)), 900) // 저장 요청 흉내(ST2). 실제 API 없음
    return () => window.clearTimeout(t)
  }, [r])
  if (!r) {
    return (
      <div className="pv-missing" role="status">
        <p className="pv-badge">프리뷰 안내 · 제품 화면 아님</p>
        <h2>흐름 결과가 없습니다</h2>
        <p>튜토리얼 목록(SCR-101)에서 스테이지를 골라 5개 상황을 끝내면 이 화면으로 옵니다.</p>
        <a href="#SCR-101/SCR-101-ST1/mobile">튜토리얼 목록으로</a>
      </div>
    )
  }
  const st = stageByKey(r.stageKey)
  const nx = nextStage(r.stageKey)
  return (
    <View d={{ stateId: saved ? (saved.pass ? 'SCR-103-ST1' : 'SCR-103-ST7') : 'SCR-103-ST2', course: st.course, step: st.step, goal: st.goal, score: r.score, best: saved?.best ?? r.score, bestNew: saved?.bestNew ?? false,
      passed: r.score >= 4, saving: !saved, wrong: r.wrong, prog: saved ? progress(r.stageKey) : undefined, next: nx ? flowHref(nx.key) : undefined, retry: flowHref(r.stageKey), list: '#SCR-101/SCR-101-ST1/mobile', stageKey: r.stageKey }} />
  )
}

function View({ d }: { d: Data }) {
  const divider = 'border-t tu-divider'
  const [open, setOpen] = useState<number | null>(null)
  const primary = d.passed ? (d.next ? { t: '다음 스테이지', h: d.next } : { t: '목록으로', h: d.list }) : { t: '다시 하기', h: d.retry }
  const second = d.passed ? { t: '다시 하기', h: d.retry } : d.next ? { t: '다음 스테이지', h: d.next } : undefined
  return (
    <div className="smapsh flex h-dvh flex-col bg-surface [.pv-frame_&]:h-full" data-scr="SCR-103" data-st={d.stateId} data-platform="mobile">
      <div className={`${COLUMN} flex min-h-0 flex-1 flex-col overflow-y-auto bg-page shadow-card`} data-testid="column">
        <header data-cmp="CMP-026" data-variant="none" className="flex h-14 shrink-0 items-center justify-between px-4">
          <h1 className="text-body font-bold">스테이지 결과</h1>
          {d.saving && (
            <p role="status" className="inline-flex items-center gap-1 text-caption text-ink-muted">
              <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
              기록 저장 중
            </p>
          )}
        </header>
        <main className="flex flex-1 flex-col px-5">
          <section data-testid="score" className="grid justify-items-center gap-2 pt-2 pb-[18px] text-center">
            <p className="text-caption font-bold text-ink-accent">
              {d.course} · {d.step}단계 {d.goal}
            </p>
            <p className="flex items-baseline gap-1.5 tabular-nums">
              <b className="text-display leading-tight">{d.score}</b>
              <span className="text-title font-bold text-ink-muted">/ 5</span>
            </p>
            {d.passed ? <Pill tone="success" icon={<Check aria-hidden className="size-4" />}>통과</Pill> : <Pill tone="warning" icon={<RotateCcw aria-hidden className="size-4" />}>미통과</Pill>}
            <p className="text-caption text-ink-muted">통과 기준: 5개 중 4개(70%)</p>
            {!d.passed && <p className="text-body font-bold text-warning-fg">통과까지 {4 - d.score}점 남았어요</p>}
          </section>
          <section data-testid="best" className={`flex items-center justify-center gap-2 py-3 ${divider}`}>
            <span className="text-caption font-bold text-ink-muted">최고 점수</span>
            <b className="tabular-nums">{d.best} / 5</b>
            {d.bestNew && <span className="inline-flex h-6 items-center rounded-full bg-mint-subtle px-2.5 text-caption font-bold text-ink-accent">최고 점수 갱신</span>}
          </section>
          {d.saveError && (
            <div data-cmp="CMP-023" role="alert" className="mt-1 mb-3 flex items-center gap-2 rounded-md bg-danger-bg py-2.5 pr-3 pl-3.5 text-caption font-bold text-danger-fg">
              <AlertCircle aria-hidden className="size-5 shrink-0" />
              <span className="flex-1">기록을 저장하지 못했습니다</span>
              <button type="button" className="min-h-11 rounded-md bg-page px-3 font-bold text-danger-fg">다시 저장</button>
            </div>
          )}
          {!d.saving && !d.saveError && d.prog && (
            <section data-testid="progress" className={`grid gap-2.5 py-3.5 ${divider}`}>
              <Bar label={`${d.course} 진행`} v={d.prog.course} scope="course" />
              <Bar label="전체 진행" v={d.prog.overall} scope="overall" />
            </section>
          )}
          {d.wrong.length > 0 && (
            <section data-testid="wrong" className={`pt-3 ${divider}`}>
              <p className="pb-1 text-caption font-bold text-ink-muted">틀린 상황 {d.wrong.length}개</p>
              <ul>
                {d.wrong.map((w) => (
                  <li key={w.no}>
                    <button type="button" aria-expanded={open === w.no} onClick={() => setOpen(open === w.no ? null : w.no)} data-cmp="CMP-030" className="flex h-12 w-full items-center gap-2 border-b border-line/40 px-0.5 text-left">
                      <span className="font-bold">상황 {w.no}</span>
                      <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${w.kind === 'bad' ? 'bg-danger-bg text-danger-fg' : 'bg-warning-bg text-warning-fg'}`}>{w.kind === 'bad' ? '오답' : '허용'}</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-caption font-bold text-ink-accent">
                        정답 위치 보기
                        {open === w.no ? <ChevronDown aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
                      </span>
                    </button>
                    {open === w.no && <InlineReplay stageKey={d.stageKey ?? 'starter-2'} no={w.no} />}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
        <div data-testid="result-actions" className={`sticky bottom-0 z-[2] mt-auto grid gap-2 bg-page px-5 pt-2.5 pb-[calc(16px+var(--safe-bottom))] ${divider}`}>
          <a href={primary.h} data-cmp="CMP-001" data-variant="primary-lg" className="flex h-[52px] items-center justify-center rounded-md bg-action text-heading font-bold tracking-tight text-on-action no-underline">
            {primary.t}
          </a>
          <div className="flex gap-2">
            {second && (
              <a href={second.h} data-cmp="CMP-001" data-variant="outline" className="flex h-[52px] flex-1 items-center justify-center rounded-md border-[1.5px] border-ink-accent bg-page text-body font-bold text-ink-accent no-underline">
                {second.t}
              </a>
            )}
            <a href={d.list} data-cmp="CMP-001" data-variant="secondary" className="flex h-[52px] flex-1 items-center justify-center rounded-md bg-surface text-body font-bold text-ink no-underline">
              목록
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// 틀린 상황: 이 화면 안에서 정답 칸·동선과 정답 움직임 재생(다시 보기·0.5배속, 02 SCR-103 행동 표)
function InlineReplay({ stageKey, no }: { stageKey: string; no: number }) {
  const st = stageByKey(stageKey)
  const sit = st.situations[no - 1]
  const C = Object.fromEntries(cells(st.grid).map((c) => [c.no, c]))
  const c = (n: number): [number, number] => [C[n].cx, C[n].cy]
  const [k, setK] = useState(0)
  const [slow, setSlow] = useState(false)
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    setMoved(false)
    const t = window.setTimeout(() => setMoved(true), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 80)
    return () => window.clearTimeout(t)
  }, [k])
  const start: [number, number] = [40, 102], pstart: [number, number] = [24, 84]
  return (
    <div className="flex flex-col gap-2 border-b border-line/40 py-2">
      <div className="relative flex h-[240px] overflow-hidden rounded-md">
        <div aria-hidden className="pl-atmo" />
        {/* DD r6 VD-047·048: 틀린 상황 다시 보기도 SCR-102와 같은 경기장 컴포넌트 */}
        <StadiumCourt key={k} grid={st.grid} mode="replay" label={`상황 ${no} 정답 움직임`} me={moved ? c(sit.answer) : start} partner={moved ? c(sit.partnerTo) : pstart} opponents={[[18, 26], [43, 38]]}
          shuttle={sit.landing && { at: sit.landing, h: 0 }} flyMs={0} ring={sit.landing} marks={[{ cell: sit.answer, kind: 'ok' }]} routes={[{ from: start, to: c(sit.answer) }, { from: pstart, to: c(sit.partnerTo), partner: true }]} slow={slow} />
      </div>
      <div className="flex gap-2">
        <Ctl onClick={() => setK(k + 1)} icon={<Play aria-hidden className="size-4" />}>다시 보기</Ctl>
        <Ctl pressed={slow} onClick={() => { setSlow(!slow); setK(k + 1) }} icon={<Snail aria-hidden className="size-4" />}>느리게 보기(0.5배속)</Ctl>
      </div>
    </div>
  )
}

function Ctl({ children, icon, onClick, pressed }: { children: ReactNode; icon: ReactNode; onClick: () => void; pressed?: boolean }) {
  return <button type="button" aria-pressed={pressed} onClick={onClick} className={`flex h-11 flex-1 items-center justify-center gap-1 rounded-md bg-mint-subtle text-caption font-bold text-ink-accent ${pressed ? 'border-[1.5px] border-ink-accent' : ''}`}>{icon}{children}</button>
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
      <span role="progressbar" aria-valuenow={v[0]} aria-valuemax={v[1]} aria-label={label} className="h-2 flex-1 overflow-hidden rounded-md bg-surface">
        <i className="block h-full rounded-md bg-action" style={{ width: `${(v[0] / v[1]) * 100}%` }} />
      </span>
      <span className="text-caption font-bold tabular-nums">
        {v[0]} / {v[1]}
      </span>
    </div>
  )
}
