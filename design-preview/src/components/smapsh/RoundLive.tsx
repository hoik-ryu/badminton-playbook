import { AlertTriangle, ChevronRight, Lock, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppNav } from './AppNav'
import { Badge } from './GameCard'
import { ActionBar, Screen, ScrollSafeArea, Section } from './Layout'
import { PageHeader } from './PageHeader'
import { RoundHead, RoundProgressCard, Toast } from './Rounds'
import { Avatar, Dialog } from './Setup'
import { complete, courtOf, filled, gap, noOf, roundDataset, roundPlay, roundsOf, type Dataset, type EGame } from '../../mock/editor'
import { person } from '../../mock/setup'
import { LeaveSheet, RestoreSheet } from '../../screens/SCR-226'

// (r14) SCR-112 라운드 진행(운영진) — UX Spec r11 02 SCR-112 ST16–ST23, UXD-110–112 / DD r14 VD-079·080·083·084·086
// 운영 표시 줄 → 진행 라운드 카드(CMP-060) → 결과 요약 → 라운드 구역(CMP-059 phase=live). 지난 라운드는 접힘, 진행 중·시작 전은 펼침, 열면 진행 중 구역으로 스크롤
// 이 보기는 운영진이 선수로 참가하지 않은 경우(공개 영역 '다음 경기·내 경기'가 없음)를 그려 진행 화면 밀도(VD-086)를 잽니다
// 보기: ST16(2라운드 진행 중, 처리 3/4) · ST16-NEW(확정 직후 1라운드, 토스트) · ST17(모두 처리 → 시작 가능) · ST18(처리 2/4 → 시작 불가)
//   ST19(3라운드 시작 직후 '라운드 시작 취소' 확인) · ST20(시작 전 라운드 결과 요청 거부 안내) · ST21(지난 라운드 펼침 · 미기록 되돌리기 거부 안내)
//   ST22(중도 귀가로 취소된 경기 · 복원) · ST23(마지막 라운드 · 종료 조건) — 끝 '-IND'는 개인전

type Live = { games: EGame[]; current: number; left: string[] }

/** 진행 데이터: current 라운드 앞은 모두 기록, current 라운드는 앞 `doneNow`경기만 기록 */
function liveData(ds: Dataset, current: number, doneNow: number): Live {
  const games = ds.games.map((g) => {
    if ((g.round ?? 0) < current) return { ...g, result: (g.key % 2) as 0 | 1 }
    if (g.round === current) {
      const idx = ds.games.filter((x) => x.round === current).indexOf(g)
      return { ...g, result: idx < doneNow ? ((g.key % 2) as 0 | 1) : null }
    }
    return { ...g, result: null }
  })
  return { games, current, left: [] }
}

/** 중도 귀가 재현(ST22): 청팀(개인전은 아무나) 한 명 F가 귀가, 3라운드·4라운드 경기 취소. 4라운드 휴식자들도 앞서 귀가해 4라운드는 복원 불가 */
export function leaveScenario(ds: Dataset) {
  const base = liveData(ds, 2, 4)
  const r4 = base.games.filter((g) => g.round === 4)
  // 4라운드 휴식자(팀전은 청팀 휴식자)도 앞서 귀가 → 4라운드는 대체할 사람이 없음
  const qs = roundPlay(ds, base.games, 4).rest.filter((id) => !ds.teams || ds.teams[id] === 'blue')
  const f = r4[0].t1[0]!
  const games = base.games.map((g) => ((g.round === 3 || g.round === 4) && filled(g).includes(f) ? { ...g, cancelled: true } : g))
  return { ...base, games, left: [...qs, f], f, qs }
}

export function RoundLive({ stateId }: { stateId: string }) {
  const ind = stateId.includes('-IND')
  const st = stateId.replace(/-IND/, '').replace(/-NEW$/, '')
  const fresh = stateId.endsWith('-NEW')
  const ds = roundDataset(ind ? 'individual' : 'team')
  const last = Math.max(...ds.games.map((g) => g.round ?? 1))
  const init = (): Live => {
    if (fresh) return liveData(ds, 1, 0)
    switch (st) {
      case 'SCR-112-ST17':
        return liveData(ds, 2, 4)
      case 'SCR-112-ST18':
        return liveData(ds, 2, 2)
      case 'SCR-112-ST19':
        return liveData(ds, 3, 0)
      case 'SCR-112-ST22':
        return leaveScenario(ds)
      case 'SCR-112-ST23':
        return liveData(ds, last, 2)
      default:
        return liveData(ds, 2, 3)
    }
  }
  const [live, setLive] = useState<Live>(init)
  const [folded, setFolded] = useState<Set<number>>(() => new Set(Array.from({ length: live.current - 1 }, (_, i) => i + 1).filter((r) => !(st === 'SCR-112-ST21' && r === 1))))
  const [toast, setToast] = useState<string | null>(fresh ? '1라운드를 시작했습니다' : null)
  const [ask, setAsk] = useState<'undo' | null>(st === 'SCR-112-ST19' ? 'undo' : null)
  const [notice, setNotice] = useState<string | null>(
    st === 'SCR-112-ST20' ? '아직 시작하지 않은 라운드입니다. 결과는 라운드를 시작한 뒤 기록할 수 있습니다' : st === 'SCR-112-ST21' ? "지난 라운드의 결과는 미기록으로 되돌릴 수 없습니다. 승패 바꾸기는 할 수 있습니다" : null,
  )
  const [restore, setRestore] = useState<number | null>(null)
  const [leave, setLeave] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    // 열면 진행 중 구역으로 스크롤(UXD-111)
    const el = document.getElementById(`live-r${live.current}`)
    if (el && live.current > 1) el.scrollIntoView({ block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번
  }, [])

  const { games, current } = live
  const curGames = games.filter((g) => g.round === current)
  const processed = curGames.filter((g) => g.cancelled || g.result != null).length
  const cancelledN = curGames.filter((g) => g.cancelled).length
  const canUndo = current >= 2 && curGames.every((g) => g.result == null && !g.cancelled)
  const unprocessedAll = games.filter((g) => !g.cancelled && g.result == null).length
  const endReason = current < last ? '마지막 라운드를 시작해야 종료할 수 있습니다' : unprocessedAll ? `처리되지 않은 경기 ${unprocessedAll}개` : undefined
  const wins = games.reduce((a, g) => (g.cancelled || g.result == null ? a : { ...a, [g.result]: a[g.result] + 1 }), { 0: 0, 1: 0 } as Record<0 | 1, number>)

  const setResult = (key: number, r: 0 | 1 | null) => setLive((l) => ({ ...l, games: l.games.map((g) => (g.key === key ? { ...g, result: r } : g)) }))
  const nextRound = () => {
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setLive((l) => ({ ...l, current: l.current + 1 }))
      setFolded((f) => new Set([...f, current]))
      setToast(`${current + 1}라운드를 시작했습니다`)
      setTimeout(() => document.getElementById(`live-r${current + 1}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50)
    }, 600)
  }
  const undoStart = () => {
    setAsk(null)
    setLive((l) => ({ ...l, current: l.current - 1 }))
    setFolded((f) => new Set([...f].filter((r) => r !== current - 1)))
    setToast(`${current}라운드 시작을 취소했습니다`)
  }
  const jump = () => {
    const g = curGames.find((x) => !x.cancelled && x.result == null)
    if (g) document.getElementById(`live-g${g.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const label = (side: 0 | 1) => (ind ? (side === 0 ? '1팀' : '2팀') : side === 0 ? '청' : '백')
  const card = (g: EGame) => {
    const r = g.round ?? 1
    const no = noOf(games, g)
    const court = courtOf(games, g)
    const future = r > current
    const past = r < current
    const gp = gap(g)
    const restorable = g.cancelled && !past
    const line = (side: 0 | 1) => {
      const ids = (side === 0 ? g.t1 : g.t2) as string[]
      const won = g.result === side
      return (
        <div className="su-tl" data-team={ind ? undefined : side === 0 ? 'blue' : 'white'}>
          <b>{label(side)}</b>
          <span className="su-players" style={{ alignItems: 'center' }}>
            {ids.map((id) => (
              <span key={id} className="su-slot" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 36 }}>
                <Avatar name={person(id).name} size="sm" />
                {person(id).name}
                {live.left.includes(id) && <span className="su-badge" data-tone="neutral">귀가</span>}
              </span>
            ))}
          </span>
          {!g.cancelled &&
            (future ? (
              side === 0 ? (
                <span className="su-locked" style={{ minHeight: 36 }} aria-label="시작 전, 결과를 기록할 수 없음">
                  <Lock aria-hidden />
                  시작 전
                </span>
              ) : null
            ) : (
              <span className="su-res">
                <button type="button" aria-pressed={won} aria-label={`${no}경기 ${label(side)} 승`} onClick={() => setResult(g.key, won ? g.result! : side)}>
                  {ind ? '승' : `${label(side)} 승`}
                </button>
              </span>
            ))}
        </div>
      )
    }
    return (
      <li key={g.key} id={`live-g${g.key}`} className="su-game" data-cmp="CMP-041" data-phase={future ? 'locked' : 'live'} data-cancelled={g.cancelled || undefined} data-testid="live-card" aria-label={`${r}라운드 코트 ${court}, ${no}경기${g.cancelled ? ', 취소됨' : future ? ', 시작 전' : ''}`}>
        <header>
          <span className="su-gno">
            코트 {court}
            <small> · {no}경기</small>
          </span>
          {g.relax && !g.cancelled && <span className="su-badge" data-tone="warning">규칙 완화: 성별 조합</span>}
          {g.cancelled ? (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {restorable && (
                <button type="button" className="su-restore" onClick={() => setRestore(g.key)} data-testid="restore-btn">
                  <RotateCcw aria-hidden />
                  복원
                </button>
              )}
              <span className="su-badge" data-tone="neutral" data-cmp="CMP-005">취소 · 중도 귀가</span>
            </span>
          ) : (
            <small className="su-ggap">{gp === null ? '' : `실력차 ${gp}`}</small>
          )}
        </header>
        {line(0)}
        {line(1)}
        {!g.cancelled && r === current && g.result != null && (
          <button type="button" className="su-undo" onClick={() => setResult(g.key, null)}>
            <Undo2 aria-hidden />
            미기록으로 되돌리기
          </button>
        )}
      </li>
    )
  }

  return (
    <Screen scr="SCR-112" st={stateId} platform="mobile">
      <PageHeader title="12월 둘째 주 청백전" trailing="none" badge={<span className="flex gap-1"><Badge tone="neutral">{ind ? '개인전' : '팀전'}</Badge><Badge tone="success">진행 중</Badge></span>} />
      <main className="flex flex-col gap-4 pt-2">
        <Section>
          <h2 className="flex items-center gap-2 text-title font-bold text-ink">
            운영<span className="text-body font-normal text-ink-muted">· 회원 공개됨</span>
          </h2>
          <button type="button" data-testid="open-participants" onClick={() => setLeave(true)} className="flex h-11 items-center justify-between rounded-md border border-line-strong bg-page px-3 text-body text-ink">
            <span className="tabular-nums">참가자 {ds.ids.length}명{ds.teams ? ` · 청 ${ds.ids.filter((id) => ds.teams![id] === 'blue').length} 백 ${ds.ids.filter((id) => ds.teams![id] === 'white').length}` : ''} · 코트 {ds.courts}</span>
            <ChevronRight aria-hidden className="size-5 text-ink-muted" />
          </button>
          {notice && (
            <div className="su-note" data-tone="warning" role="alert" data-cmp="CMP-023">
              <AlertTriangle aria-hidden />
              <span>{notice}</span>
              <button type="button" className="su-link" onClick={() => setNotice(null)}>닫기</button>
            </div>
          )}
          <RoundProgressCard round={current} done={processed} total={curGames.length} cancelled={cancelledN} last={current === last} canUndo={canUndo} busy={busy} onNext={nextRound} onUndo={() => setAsk('undo')} onJump={jump} />
          <div data-cmp="CMP-042" data-testid="standings-card" className="flex items-center justify-between rounded-md border border-line bg-page px-3 py-2">
            <span className="text-title font-bold tabular-nums text-ink">{ind ? `기록 ${wins[0] + wins[1]}경기` : `청 ${wins[0]} : 백 ${wins[1]}`}</span>
            <span className="text-caption tabular-nums text-ink-muted">전체 {games.filter((g) => !g.cancelled).length}경기{games.some((g) => g.cancelled) ? ` · 취소 ${games.filter((g) => g.cancelled).length}` : ''}</span>
          </div>
        </Section>
        <Section>
          <div className="su su-rounds" data-testid="rounds">
            {roundsOf(games).map(({ round, games: gs }) => {
              const f = folded.has(round)
              const done = gs.filter((g) => g.cancelled || g.result != null).length
              const status = round < current ? <span className="su-badge" data-tone="neutral">완료</span> : round === current ? <span className="su-badge" data-tone="live">진행 중</span> : <span className="su-badge" data-tone="pending">시작 전</span>
              return (
                <section key={round} id={`live-r${round}`} className="su-round" data-cmp="CMP-059" data-phase="live" aria-labelledby={`lh-${round}`} style={{ scrollMarginTop: 8 }}>
                  <RoundHead id={`lh-${round}`} round={round} status={status} current={round === current} caption={`처리 ${done}/${gs.length}`} folded={f} onFold={() => setFolded((s) => (s.has(round) ? new Set([...s].filter((x) => x !== round)) : new Set([...s, round])))} />
                  {!f && <ol className="su-round-list">{gs.map(card)}</ol>}
                </section>
              )
            })}
          </div>
        </Section>
        <ScrollSafeArea withBar />
      </main>
      <ActionBar>
        <div className="flex w-full flex-col gap-1">
          {endReason && <p className="m-0 text-caption text-ink-muted" id="end-why">{endReason}</p>}
          <button type="button" data-cmp="CMP-001" disabled={!!endReason} aria-describedby={endReason ? 'end-why' : undefined} className="flex h-12 items-center justify-center rounded-md bg-action px-4 text-heading font-bold text-on-action disabled:bg-surface disabled:text-body disabled:text-ink-disabled">
            청백전 종료
          </button>
        </div>
      </ActionBar>
      <AppNav active="match" role="admin" />
      {toast && <Toast text={toast} />}
      {ask === 'undo' && <Dialog title={`${current}라운드 시작을 취소하고 ${current - 1}라운드로 돌아갈까요?`} desc={`${current - 1}라운드 경기를 다시 고치거나 미기록으로 되돌릴 수 있습니다`} ok="시작 취소" onCancel={() => setAsk(null)} onOk={undoStart} />}
      {restore !== null && (
        <RestoreSheet
          ds={ds}
          games={games}
          gameKey={restore}
          left={live.left}
          onClose={() => setRestore(null)}
          onDone={(next) => {
            setLive((l) => ({ ...l, games: l.games.map((g) => (g.key === next.key ? next : g)) }))
            setRestore(null)
            setToast(`${noOf(games, next)}경기를 복원했습니다`)
          }}
        />
      )}
      {leave && <LeaveSheet ds={ds} games={games} current={current} leaver={games.filter((g) => g.round === current && !g.cancelled).flatMap(filled)[4]} left={live.left} onClose={() => setLeave(false)} />}
    </Screen>
  )
}

export const isRoundState = (st: string) => /^SCR-112-ST(1[6-9]|2[0-3])/.test(st)
export { complete }
