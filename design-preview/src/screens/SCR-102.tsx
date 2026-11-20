import { ArrowRight, Check, ChevronRight, Play, Search, Snail, Waves, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { COLUMN } from '../components/smapsh/Layout'
import { StadiumCourt, type CourtMetrics, type ShuttleState } from '../components/smapsh/StadiumCourt'
import { cells, type CourtMode, type Grid, type Mark } from '../components/smapsh/TutorialCourt'
import { situation as S } from '../mock/tutorial'
import { setResult, stageByKey, type FlowResult } from '../mock/tutorialFlow'

// SCR-102 스테이지 플레이 — UX Spec r5(02 SCR-102, UXD-077 r6·078–081) + Design Direction r5 + game-storyboard 시각 참고(2026-11-19)
// 화면: 경기장 분위기 상단(헤더 56 · 상황 진행 5단계 · 상황 설명 카드) → 경기장판(game-images 레이어, 원근 좌표) → 아래 시트 160px 고정(UXD-081)
// 규칙은 그대로: 재생 중 격자·번호 숨김, 선택 대기부터 내 편 반 코트에만 6칸·9칸, 칸 번호로만 판정, 첫 시도 정답만 1점, 실제 칸 < 44px이면 확인 단계(ST12)
// 버튼(DD 4.1·VD-044): 큰 CTA = color.action.primary + 흰 22px 굵게, 학습 행동 = 외곽선(color.text.accent), 이동 = 글자 버튼, 모서리 radius.md
// 보기 항목: 02 상태 ID + 'SCR-102-PLAY'(상황 재생)·'SCR-102-ST1-G9'(ST1 9칸). 흐름 모드 'SCR-102-FLOW-<스테이지>'(프리뷰 전용, API·DB 없음)
const C6 = Object.fromEntries(cells(6).map((c) => [c.no, c]))
const at = (n: number): [number, number] => [C6[n].cx, C6[n].cy]
const OPPONENTS: [number, number][] = [[18, 26], [43, 38]]
/** 셔틀 높이(코트 단위): 상대가 치는 순간·선택 대기 중 멈춘 순간 */
const H_HIT = 22, H_STOP = 9

export function Scr102({ stateId }: { stateId: string }) {
  if (stateId.startsWith('SCR-102-FLOW-')) return <Flow key={stateId} stageKey={stateId.slice('SCR-102-FLOW-'.length)} />
  const v = VIEWS[stateId] ?? VIEWS['SCR-102-ST1']
  const sh: ShuttleState | undefined = v.shuttle && { at: v.shuttle, h: v.mode === 'choose' ? H_STOP : v.mode === 'playing' ? 16 : 0 }
  return (
    <Shell stateId={stateId} course={v.course ?? S.course} step={v.step ?? S.step} goal={v.goal ?? '담당 영역 나누기'} index={v.index ?? S.index} score={v.score ?? S.score}
      desc={v.desc ?? S.desc}
      court={<StadiumCourt grid={v.grid ?? 6} mode={v.mode} label={v.desc ?? S.desc} me={v.me ?? S.me} partner={v.partner ?? S.partner} opponents={OPPONENTS} shuttle={sh} marks={v.marks} ring={v.ring} routes={v.routes} selected={v.selected} />}
      foot={v.foot ?? <Playback />} />
  )
}

function Shell({ stateId, course, step, goal, index, score, retry, onExit, desc, court, foot, overlay }: {
  stateId: string; course: string; step: number; goal: string; index: number; score: number; retry?: boolean; onExit?: () => void
  desc: string; court: ReactNode; foot: ReactNode; overlay?: ReactNode
}) {
  return (
    <div className="smapsh flex h-dvh flex-col bg-surface [.pv-frame_&]:h-full" data-scr="SCR-102" data-st={stateId} data-platform="mobile">
      <div className={`${COLUMN} relative grid min-h-0 flex-1 grid-rows-[56px_auto_auto_minmax(0,1fr)_160px] overflow-hidden shadow-card`} data-testid="column">
        <div aria-hidden className="pl-atmo" />
        <TopBar course={course} step={step} goal={goal} index={index} score={score} retry={retry} onExit={onExit} />
        <Steps index={index} />
        <div className="relative z-[1] px-3 pb-2">
          <div data-testid="situation-card" className="tu-soft flex items-center gap-2.5 rounded-md bg-page px-3 py-2">
            <Search aria-hidden className="size-5 shrink-0 text-ink-accent" />
            <p className="text-body leading-snug font-bold">{desc}</p>
          </div>
        </div>
        <div className="relative z-[1] flex min-h-0" data-testid="play-main">{court}</div>
        <section data-testid="bottom-sheet" aria-live="polite" className="tu-sheet relative z-[2] flex flex-col gap-2 overflow-y-auto rounded-t-(--radius-sheet) bg-page px-4 py-3">
          {foot}
        </section>
        {overlay}
      </div>
    </div>
  )
}

// 상단 바(CMP-026 close): 경기장 위 어두운 띠 + 흰 글자. 상황 진행 n/5·점수, 재도전 표시
function TopBar({ course, step, goal, index, score, retry, onExit }: { course: string; step: number; goal: string; index: number; score: number; retry?: boolean; onExit?: () => void }) {
  return (
    <header data-cmp="CMP-026" data-variant="close" className="relative z-[1] flex items-center gap-1.5 pr-3 pl-1 text-on-action">
      <button type="button" onClick={onExit} className="flex h-11 shrink-0 items-center gap-0.5 rounded-md px-2 text-caption font-bold">
        <X aria-hidden className="size-5" />
        나가기
      </button>
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-body font-bold tracking-tight">{course} · {step}단계</span>
        <span className="truncate text-caption opacity-90">{goal}</span>
      </span>
      {retry && <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-caption font-bold whitespace-nowrap text-warning-fg">재도전 · 0점</span>}
      <span className="pl-pill inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-bold whitespace-nowrap tabular-nums">
        <span>상황 {index}/5</span>
        <span aria-hidden className="h-3 w-px bg-current opacity-50" />
        <span>{score}점</span>
      </span>
    </header>
  )
}

// 상황 진행 5단계(장식, 숫자 '상황 n/5'를 헤더에 늘 함께 표시)
function Steps({ index }: { index: number }) {
  return (
    <ol aria-hidden className="relative z-[1] mx-auto flex w-full max-w-[280px] items-center px-6 pb-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <li key={n} className="flex flex-1 items-center last:flex-none">
          <span className={`grid size-[22px] shrink-0 place-items-center rounded-full text-caption leading-none font-bold tabular-nums ${n < index ? 'bg-action text-on-action' : n === index ? 'bg-page text-ink-accent ring-2 ring-mint' : 'pl-step-next'}`}>
            {n < index ? <Check className="size-3.5" strokeWidth={3} /> : n}
          </span>
          {n < 5 && <span className={`mx-1 h-[3px] flex-1 rounded-full ${n < index ? 'bg-action' : 'pl-step-line'}`} />}
        </li>
      ))}
    </ol>
  )
}

function Question({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint-subtle text-ink-accent"><Search aria-hidden className="size-5" /></span>
      <div className="grid gap-0.5">
        {hint && <p className="text-caption font-bold text-ink-accent">{hint}</p>}
        <p className="text-title font-bold tracking-tight">{text}</p>
      </div>
    </div>
  )
}

// 상황 재생 중 아래 시트: 재생 진행 + 건너뛰기 안내(02에 표시 정보 정의 없음 → 상태 안내만, 보고 대상)
function Playback({ ms = 1100 }: { ms?: number }) {
  const [go, setGo] = useState(false)
  useEffect(() => { const t = window.setTimeout(() => setGo(true), 30); return () => window.clearTimeout(t) }, [])
  return (
    <div role="status" className="grid gap-2 pt-1">
      <p className="flex items-center gap-2 text-body font-bold"><Play aria-hidden className="size-5 fill-current text-action" />상황 재생 중</p>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface"><i className="block h-full rounded-full bg-action transition-[width] ease-linear motion-reduce:transition-none" style={{ width: go ? '100%' : '0%', transitionDuration: `${ms}ms` }} /></span>
      <p className="text-caption text-ink-muted">코트를 누르면 건너뛸 수 있어요</p>
    </div>
  )
}

const TONE = {
  ok: { Icon: Check, title: 'text-success-fg', bg: 'bg-success-bg' },
  allow: { Icon: Waves, title: 'text-warning-fg', bg: 'bg-warning-bg' },
  bad: { Icon: X, title: 'text-danger-fg', bg: 'bg-danger-bg' },
} as const

function Judge({ kind, title, reason, onRetry, onNext }: { kind: keyof typeof TONE; title: string; reason: string; onRetry?: () => void; onNext?: () => void }) {
  const t = TONE[kind]
  const trail = onRetry || onNext
  return (
    <div role="status" className="grid gap-0.5">
      <div className={`flex items-center gap-2 text-title font-bold ${t.title}`}>
        <span className={`grid size-8 place-items-center rounded-full ${t.bg}`}>
          <t.Icon aria-hidden className="size-5" strokeWidth={2.6} />
        </span>
        <span className="flex-1">{title}</span>
        {trail && (
          <span className="-my-2 -mr-2 flex">
            {onRetry && <TextBtn onClick={onRetry}>다시 도전</TextBtn>}
            {onNext && <TextBtn onClick={onNext} icon={<ArrowRight aria-hidden className="size-4" />}>다음 상황</TextBtn>}
          </span>
        )}
      </div>
      <p className="max-h-[2.8em] overflow-y-auto text-caption leading-snug text-ink-muted">{reason}</p>
    </div>
  )
}

const btnBase = 'flex h-14 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 font-bold whitespace-nowrap'
function Cta({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} data-cmp="CMP-001" data-variant="primary-lg" className={`${btnBase} pl-cta bg-action text-heading tracking-tight text-on-action`}>{children}<ChevronRight aria-hidden className="size-6" /></button>
}
function Outline({ children, icon, onClick }: { children: ReactNode; icon?: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} data-cmp="CMP-001" data-variant="outline" className={`${btnBase} border-[1.5px] border-ink-accent bg-page text-body text-ink-accent`}>{icon}{children}</button>
}
function Chip({ children, icon, pressed, onClick }: { children: ReactNode; icon: ReactNode; pressed?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={pressed} data-cmp="CMP-001" data-variant="chip" className={`${btnBase} text-caption text-ink-accent ${pressed ? 'border-[1.5px] border-ink-accent bg-mint-subtle' : 'bg-mint-subtle'}`}>{icon}{children}</button>
}
function TextBtn({ children, icon, onClick }: { children: ReactNode; icon?: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} data-cmp="CMP-001" data-variant="text" className="flex h-11 items-center gap-0.5 rounded-md px-2 text-caption font-bold text-ink-accent">{children}{icon}</button>
}

// CMP-022 나가기·뒤로 가기 확인 창
function ExitDialog({ onCancel, onExit }: { onCancel: () => void; onExit: () => void }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-ink/40 p-6">
      <div role="alertdialog" aria-modal="true" aria-labelledby="exit-t" data-cmp="CMP-022" className="w-full max-w-[340px] rounded-(--radius-sheet) bg-page px-5 pt-5 pb-4 shadow-sheet">
        <p id="exit-t" className="text-title font-bold">스테이지에서 나갈까요?</p>
        <p className="mt-1.5 text-body text-ink-muted">지금 나가면 이번 진행은 저장되지 않습니다.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" autoFocus onClick={onCancel} className="h-12 flex-1 rounded-md bg-surface text-body font-bold">취소</button>
          <button type="button" onClick={onExit} className="h-12 flex-1 rounded-md bg-danger-fg text-body font-bold text-on-action">나가기</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- 흐름 모드(프리뷰 전용 상호작용) — 게임 로직은 이전과 같음 ----------------
type Phase = 'play' | 'choose' | 'moving' | 'judged' | 'replay'
const eunNeun = (w: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0 ? '은' : '는' }
const reduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const PLAY_MS = 1100

function Flow({ stageKey }: { stageKey: string }) {
  const st = stageByKey(stageKey)
  const grid: Grid = st.grid
  const CELLS = Object.fromEntries(cells(grid).map((c) => [c.no, c]))
  const center = (n: number): [number, number] => [CELLS[n].cx, CELLS[n].cy]
  const START_ME: [number, number] = [40, 102]
  const START_PT: [number, number] = [24, 84]

  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>(st.guided ? 'choose' : 'play')
  const [retry, setRetry] = useState(false)
  const [picked, setPicked] = useState<number | undefined>()
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState<FlowResult['wrong']>([])
  const sit = st.situations[i]
  const hitShuttle = (): ShuttleState | undefined => (sit.shuttleFrom ? { at: sit.shuttleFrom, h: H_HIT } : undefined)
  const [shuttle, setShuttle] = useState<ShuttleState | undefined>(hitShuttle())
  const [flyMs, setFlyMs] = useState(PLAY_MS)
  const [slow, setSlow] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [exit, setExit] = useState(false)
  const [metrics, setMetrics] = useState<CourtMetrics | null>(null)
  const [moved, setMoved] = useState(false)
  // UXD-078: 그려진 코트의 실제 칸 크기(가장 작은 칸의 너비·높이)가 44px 미만이면 확인 단계(ST12)
  const confirmMode = !!metrics && (metrics.minCellW < 44 || metrics.minCellH < 44)

  // 상황 재생: 상대 쪽에서 셔틀이 날아와 내 편 위에서 멈춘 뒤 선택 대기. 입문자(ST11)는 재생 없음
  useEffect(() => {
    if (phase !== 'play') return
    setFlyMs(PLAY_MS)
    const stop = sit.shuttleStop && { at: sit.shuttleStop, h: H_STOP }
    if (reduce()) { setShuttle(stop); setPhase('choose'); return }
    const a = window.setTimeout(() => setShuttle(stop), 40)
    const b = window.setTimeout(() => setPhase('choose'), PLAY_MS + 120)
    return () => { window.clearTimeout(a); window.clearTimeout(b) }
  }, [phase, sit]) // eslint-disable-line react-hooks/exhaustive-deps

  // 정답 움직임 보기(ST10): 누를 때마다 시작 위치 → 정답 칸으로 다시 재생(느리게 보기면 0.5배속)
  useEffect(() => {
    if (phase !== 'replay') return
    setMoved(false)
    const t = window.setTimeout(() => setMoved(true), reduce() ? 0 : 80)
    return () => window.clearTimeout(t)
  }, [phase, replayKey])

  const kindOf = (n: number): 'ok' | 'allow' | 'bad' => (n === sit.answer ? 'ok' : !st.guided && n === sit.allow ? 'allow' : 'bad')
  const confirm = (n: number) => {
    // 확정은 한 번만(AC-115): 이동 중에는 누름 영역 없음
    setPicked(n)
    setPhase('moving')
    if (!st.guided && sit.landing) { setFlyMs(600); setShuttle({ at: sit.landing, h: 0 }) }
    window.setTimeout(() => {
      const k = kindOf(n)
      if (k === 'ok' && !retry) setScore((s) => s + 1)
      if (k !== 'ok' && !retry) setWrong((w) => (w.some((x) => x.no === i + 1) ? w : [...w, { no: i + 1, kind: k }]))
      setPhase('judged')
    }, reduce() ? 0 : 650)
  }
  const onCell = (n: number) => (confirmMode ? setPicked(n) : (setPicked(n), window.setTimeout(() => confirm(n), reduce() ? 0 : 120)))
  const goNext = () => {
    if (i === 4) {
      setResult({ stageKey: st.key, score, wrong })
      window.location.hash = `#SCR-103/SCR-103-FLOW/mobile`
      return
    }
    const nx = st.situations[i + 1]
    setI(i + 1); setRetry(false); setPicked(undefined); setSlow(false)
    setFlyMs(0); setShuttle(nx.shuttleFrom ? { at: nx.shuttleFrom, h: H_HIT } : undefined)
    setPhase(st.guided ? 'choose' : 'play')
  }
  const doRetry = () => { setRetry(true); setPicked(undefined); setSlow(false); setFlyMs(0); setShuttle(hitShuttle()); setPhase(st.guided ? 'choose' : 'play') }

  const k = picked ? kindOf(picked) : undefined
  const judged = phase === 'judged' || phase === 'replay'
  const meAt: [number, number] = (phase === 'moving' || phase === 'judged') && picked ? center(picked) : phase === 'replay' && moved ? center(sit.answer) : START_ME
  // 파트너는 확정 뒤 판정과 관계없이 데이터대로 자동 이동(02 SCR-102, AC-114)
  const ptAt: [number, number] = (phase === 'moving' || phase === 'judged') && picked ? center(sit.partnerTo) : phase === 'replay' && moved ? center(sit.partnerTo) : START_PT
  const marks: Mark[] = []
  // 선택 강조는 StadiumCourt의 선택 영역 바닥 면(selected)이 맡음 — 이동이 시작되면 흐려지며 사라짐
  if (judged) {
    marks.push({ cell: sit.answer, kind: 'ok' })
    if (picked && k !== 'ok' && phase === 'judged') marks.push({ cell: picked, kind: k!, mine: true })
  }
  const mode: CourtMode = phase === 'play' ? 'playing' : phase === 'choose' ? 'choose' : phase === 'replay' ? 'replay' : 'result'
  const showDir = judged && !st.guided && sit.landing ? sit.landing : undefined
  const routes = phase === 'replay' ? [{ from: START_ME, to: center(sit.answer) }, { from: START_PT, to: center(sit.partnerTo), partner: true }] : undefined

  let foot: ReactNode = null
  if (phase === 'play') foot = <Playback key={`${i}-${retry}`} ms={PLAY_MS} />
  else if (phase === 'choose') {
    foot = confirmMode && picked ? (
      <><Question text={`${picked}번 칸을 골랐어요. 다른 칸을 누르면 바뀌어요`} /><div className="flex"><Cta onClick={() => confirm(picked)}>이 칸으로 이동</Cta></div></>
    ) : (
      <Question hint={st.guided && st.step === 1 && i === 0 ? '코트 위 숫자는 내 편 자리 번호예요' : undefined} text={sit.question} />
    )
  } else if (phase === 'judged' && k) {
    const reason = k === 'ok' ? (st.guided ? `맞아요. ${sit.answer}번 위치예요.${retry ? ' 다시 도전해 맞힌 상황은 0점이에요.' : ''}` : `${sit.area}${eunNeun(sit.area)} 내 담당 영역이라 그 칸으로 가서 받았어요.${retry ? ' 다시 도전해 맞힌 상황은 0점이에요.' : ''}`)
      : k === 'allow' ? `괜찮은 위치예요. 더 좋은 위치는 ${sit.answer}번이에요.`
      : st.guided ? `${picked}번이 아니라 ${sit.answer}번 위치예요.` : `셔틀은 ${sit.area}로 왔어요. ${sit.answer}번으로 가야 해요.`
    foot = k === 'ok' ? (
      <><Judge kind="ok" title={st.guided ? '정답' : retry ? '득점(재도전 · 0점)' : '득점! +1점'} reason={reason} /><div className="flex"><Cta onClick={goNext}>다음 상황</Cta></div></>
    ) : (
      <><Judge kind={k} title={k === 'allow' ? '랠리 계속' : st.guided ? '오답' : '실점'} reason={reason} onRetry={doRetry} onNext={goNext} />
        <div className="flex"><Outline onClick={() => { setPhase('replay'); setReplayKey((x) => x + 1) }} icon={<Play aria-hidden className="size-5" />}>{k === 'allow' ? '최선 위치 보기' : '올바른 움직임 보기'}</Outline></div></>
    )
  } else if (phase === 'replay') {
    foot = (
      <><Judge kind="ok" title="올바른 움직임" reason={`나는 ${sit.answer}번으로${st.guided ? '' : `, 파트너는 ${sit.partnerTo}번`}으로 움직여요.`} onRetry={doRetry} onNext={goNext} />
        <div className="flex gap-2"><Chip onClick={() => setReplayKey((x) => x + 1)} icon={<Play aria-hidden className="size-[18px]" />}>다시 보기</Chip><Chip pressed={slow} onClick={() => { setSlow(!slow); setReplayKey((x) => x + 1) }} icon={<Snail aria-hidden className="size-[18px]" />}>느리게 보기(0.5배속)</Chip></div></>
    )
  }

  return (
    <Shell
      stateId={`SCR-102-FLOW-${st.key}`} course={st.course} step={st.step} goal={st.goal} index={i + 1} score={score} retry={retry} onExit={() => setExit(true)}
      desc={sit.desc}
      court={
        <div className="flex min-h-0 flex-1" data-phase={phase} data-confirm-mode={confirmMode ? 'true' : 'false'}>
          <StadiumCourt key={phase === 'replay' ? `r${replayKey}` : 'c'} grid={grid} mode={mode} label={sit.desc} me={meAt} partner={ptAt} opponents={OPPONENTS}
            shuttle={st.guided ? undefined : shuttle} flyMs={flyMs} marks={marks} ring={showDir} routes={routes} onCell={phase === 'choose' ? onCell : undefined}
            onSkip={() => { setFlyMs(0); setShuttle(sit.shuttleStop && { at: sit.shuttleStop, h: H_STOP }); setPhase('choose') }} selected={picked} slow={slow} onMetrics={setMetrics} />
        </div>
      }
      foot={foot}
      overlay={exit && <ExitDialog onCancel={() => setExit(false)} onExit={() => { window.location.hash = '#SCR-101/SCR-101-ST1/mobile' }} />}
    />
  )
}

type View = {
  mode: CourtMode; grid?: Grid; desc?: string; course?: string; step?: number; goal?: string; index?: number; score?: number
  me?: [number, number]; partner?: [number, number]; shuttle?: [number, number]; marks?: Mark[]; ring?: [number, number]; selected?: number
  routes?: { from: [number, number]; to: [number, number]; partner?: boolean }[]; foot?: ReactNode
}

const NOOP = () => undefined
export const VIEWS: Record<string, View> = {
  'SCR-102-PLAY': { mode: 'playing', shuttle: S.shuttleInFlight },
  'SCR-102-ST11': { mode: 'choose', course: '입문자', step: 1, goal: '코트와 번호 익히기', index: 1, score: 0, desc: '내 편 코트의 번호를 눌러 이동해요.', foot: <Question hint="코트 위 숫자는 내 편 자리 번호예요" text="4번 위치로 이동해 보세요" /> },
  'SCR-102-ST1': { mode: 'choose', shuttle: S.shuttleStop, foot: <Question text="어디로 이동해야 할까요?" /> },
  'SCR-102-ST1-G9': { mode: 'choose', grid: 9, course: '초급', step: 1, goal: '앞뒤 공격 대형', index: 3, score: 2, desc: S.desc9, shuttle: S.shuttleStop9, foot: <Question text="어디로 이동해야 할까요?" /> },
  'SCR-102-ST12': {
    mode: 'choose', grid: 9, course: '초급', step: 1, goal: '앞뒤 공격 대형', index: 3, score: 2, desc: S.desc9, shuttle: S.shuttleStop9, selected: 3,
    foot: (<><Question text="3번 칸을 골랐어요. 다른 칸을 누르면 바뀌어요" /><div className="flex"><Cta>이 칸으로 이동</Cta></div></>),
  },
  'SCR-102-ST7': {
    mode: 'result', score: 2, me: at(6), partner: at(3), ring: S.landing, shuttle: S.landing, marks: [{ cell: 6, kind: 'ok' }],
    foot: (<><Judge kind="ok" title="득점! +1점" reason="오른쪽 뒤는 내 담당 영역이라 빠르게 뒤로 가서 받았어요." /><div className="flex"><Cta>다음 상황</Cta></div></>),
  },
  'SCR-102-ST8': {
    mode: 'result', me: at(4), partner: at(3), ring: S.landing, shuttle: S.landing, marks: [{ cell: 6, kind: 'ok' }, { cell: 4, kind: 'allow', mine: true }],
    foot: (<><Judge kind="allow" title="랠리 계속" reason="괜찮은 위치예요. 더 좋은 위치는 6번이에요(셔틀이 뒤로 깊게 와요)." onRetry={NOOP} onNext={NOOP} /><div className="flex"><Outline icon={<Play aria-hidden className="size-5" />}>최선 위치 보기</Outline></div></>),
  },
  'SCR-102-ST9': {
    mode: 'result', me: at(3), partner: at(1), ring: S.landing, shuttle: S.landing, marks: [{ cell: 6, kind: 'ok' }, { cell: 3, kind: 'bad', mine: true }],
    foot: (<><Judge kind="bad" title="실점" reason="셔틀은 오른쪽 뒤로 왔어요. 오른쪽 뒤는 내 담당 영역이에요." onRetry={NOOP} onNext={NOOP} /><div className="flex"><Outline icon={<Play aria-hidden className="size-5" />}>올바른 움직임 보기</Outline></div></>),
  },
  'SCR-102-ST10': {
    mode: 'replay', shuttle: S.landing, marks: [{ cell: 6, kind: 'ok' }], me: at(6), partner: at(3), routes: [{ from: S.me, to: at(6) }, { from: S.partner, to: at(3), partner: true }],
    foot: (<><Judge kind="ok" title="올바른 움직임" reason="나는 오른쪽 뒤(6번)로, 파트너는 왼쪽 가운데(3번)로 움직여요." onRetry={NOOP} onNext={NOOP} /><div className="flex gap-2"><Chip icon={<Play aria-hidden className="size-[18px]" />}>다시 보기</Chip><Chip pressed={false} icon={<Snail aria-hidden className="size-[18px]" />}>느리게 보기(0.5배속)</Chip></div></>),
  },
}
