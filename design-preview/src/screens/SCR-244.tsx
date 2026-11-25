import { AlertTriangle, ArrowLeftRight, ArrowUpDown, Grid2x2, Info, ListOrdered, ListPlus, LoaderCircle, Minus, Plus, RotateCcw, Scale, Shuffle, Trash2, UserRoundPen, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PickSheet, teamLabel } from '../components/smapsh/PickSheet'
import { RoundHead, RoundMoveSheet, Toast } from '../components/smapsh/Rounds'
import { Avatar, Dialog, SectionTitle, SetupScreen, StepBar, stepHref } from '../components/smapsh/Setup'
import { byRound, candidates, complete, counts, courtOf, dataset, defaultRounds, empties, gap, genRounds, noOf, perRound, repeats, roundDataset, roundPlay, roundsOf, sameMatch, type Cand, type Dataset, type EGame, type Target } from '../mock/editor'
import { person, sum } from '../mock/setup'

// SCR-244 청백전 생성 · 대진 설정 — UX Spec r11 02 SCR-244, UXD-100–104·106–109 / DD r14 VD-077–081·086(+ r13 VD-071–073·076, VD-066·068)
// (r14) 자동 생성 기준은 라운드 수(스테퍼 VD-077)와 미리보기 세 줄(VD-078). 대진은 라운드 구역(VD-079, 카드로 감싸지 않음)으로 묶고
//   카드 머리 줄은 '코트 m · n경기'(VD-080, 카드 높이 그대로). 구역 끝 '코트 m에 경기 추가'(빈 코트가 있을 때), 목록 끝 '라운드 추가', 카드의 '이동' → 라운드 이동 시트(VD-081)
// 편집은 동작마다 저장(프리뷰는 0.7초 저장 중을 흉내), 미완성 경기는 화면에만. 선수·빈 자리를 누르면 SCR-225 시트(같은 라운드 출전자는 선택 불가)
// 보기(끝 '-IND' 개인전 20명, 기본 팀전 18명 청 9·백 9 · 코트 4, '-IND4' 개인전 4명, '-TEAM2' 팀당 2명):
//   ST1 생성 전 · ST2 생성 중 · ST4 생성 실패 · ST6 충돌 · ST7 대진 편집(재진입) · ST8 대진 폐기 확인 · ST9 균등안 · ST10 직접 구성 빈 대진 · ST11 미완성 경기(2라운드 코트 4)
//   ST12 저장 중 · ST13 저장 실패 · ST14 다시 생성 확인 · ST15 직접 구성 전환 확인 · ST16 삭제 확인 · ST17 이탈 확인
//   (r14) ST18 경기를 만들 수 없음(k = 0) · ST19 평균 4경기 미달 안내 · ST20 라운드 이동 시트 · ST21 라운드 추가(저장 전) · ST22 라운드 정리 알림 · ST23 경기 200개 도달 · ST24 라운드 구역 접힘
export type SheetView = 'player' | 'team' | 'count' | 'empty' | 'error' | 'saving'
type Mode = 'auto' | 'manual' | null
type Ask =
  | { kind: 'discard'; apply: () => void }
  | { kind: 'regen' }
  | { kind: 'manual' }
  | { kind: 'delete'; key: number }
  | { kind: 'exit' }
  | { kind: 'count'; c: Cand }
  | { kind: 'conflict' }
type Fail = { text: string; retry: () => void }

const SAVE_MS = 700
const blank = (key: number, round: number): EGame => ({ key, round, t1: [null, null], t2: [null, null] })

function pickDataset(stateId: string) {
  if (stateId.endsWith('-IND4')) return { ds: dataset('ind4'), suffix: '-IND4' }
  if (stateId.endsWith('-TEAM2')) return { ds: dataset('team4'), suffix: '-TEAM2' }
  if (stateId.endsWith('-IND')) return { ds: roundDataset('individual'), suffix: '-IND' }
  return { ds: roundDataset('team'), suffix: '' }
}

/** 2라운드의 마지막 경기를 지우고 그 자리에 미완성 경기(두 자리만 참)를 둔 편집 대진 */
function withPartial(ds: Dataset) {
  const r2 = ds.games.filter((g) => g.round === 2)
  const drop = r2[r2.length - 1]
  const left = ds.games.filter((g) => g.key !== drop.key)
  const key = Math.max(...ds.games.map((g) => g.key)) + 1
  const partial: EGame = { key, round: 2, t1: [drop.t1[0], drop.t1[1]], t2: [null, null] }
  return { games: byRound([...left, partial]), drop }
}

function initial(st: string, ds: Dataset) {
  const g = ds.games
  switch (st) {
    case 'SCR-244-ST1':
    case 'SCR-244-ST2':
    case 'SCR-244-ST4':
    case 'SCR-244-ST9':
    case 'SCR-244-ST18':
    case 'SCR-244-ST19':
      return { mode: 'auto' as Mode, games: [] as EGame[], gen: null as number | null }
    case 'SCR-244-ST10':
      return { mode: 'manual' as Mode, games: [], gen: null }
    case 'SCR-244-ST11':
    case 'SCR-244-ST17':
    case 'SCR-244-ST6':
    case 'SCR-244-ST24':
      return { mode: null, games: withPartial(ds).games, gen: ds.base }
    case 'SCR-244-ST21': {
      const key = Math.max(...g.map((x) => x.key)) + 1
      const last = Math.max(...g.map((x) => x.round ?? 1))
      return { mode: null, games: [...g, { ...blank(key, last + 1), t1: [ds.ids[0], null] as [string | null, string | null] }], gen: ds.base }
    }
    case 'SCR-244-ST20': {
      // 2라운드의 한 경기를 6라운드로 따로 둔 편집 대진: 이 경기를 2라운드(빈 코트 1, 출전 겹침 없음)로 옮길 수 있음
      const r2 = g.filter((x) => x.round === 2)
      const d = r2[r2.length - 1]
      return { mode: null, games: [...g.filter((x) => x.key !== d.key), { ...d, round: 6 }], gen: ds.base }
    }
    case 'SCR-244-ST22': {
      // 3라운드를 한 경기만 남긴 뒤 그 경기를 지운 결과: 3라운드가 사라지고 4·5라운드가 3·4라운드로 당겨짐
      const left = g.filter((x) => x.round !== 3).map((x) => ((x.round ?? 0) > 3 ? { ...x, round: (x.round ?? 0) - 1 } : x))
      return { mode: null, games: left, gen: ds.base }
    }
    case 'SCR-244-ST8':
    case 'SCR-244-ST14': {
      if (st === 'SCR-244-ST8') return { mode: 'auto' as Mode, games: g, gen: ds.base }
      const { games } = withPartial(ds)
      return { mode: 'auto' as Mode, games: games.filter(complete), gen: ds.base }
    }
    default:
      return { mode: null, games: g, gen: ds.base }
  }
}

export function Scr244({ stateId, sheetView }: { stateId: string; sheetView?: SheetView }) {
  const { ds, suffix } = pickDataset(stateId)
  const st = stateId.slice(0, stateId.length - suffix.length)
  const method = ds.kind
  const ind = method === 'individual'
  const N = ds.ids.length
  const courts = ds.courts ?? 4
  const zeroK = st === 'SCR-244-ST18' // 프리뷰: 라운드당 경기 수 0인 참가 구성을 흉내(실제로는 앞 단계 검증으로 드묾)
  const capped = st === 'SCR-244-ST19' // 프리뷰: 200경기 상한에 걸린 경우를 흉내(1코트·참가 많은 청백전)
  const atMax = st === 'SCR-244-ST23' // 프리뷰: 저장된 경기가 200개인 경우를 흉내
  const k = zeroK ? 0 : perRound(ds, courts)
  const init = initial(st, ds)
  const [mode, setMode] = useState<Mode>(init.mode)
  const [games, setGames] = useState<EGame[]>(init.games)
  const [gen, setGen] = useState<number | null>(init.gen) // 마지막 자동 생성 기준 라운드 수(편집 표시용)
  const [edited, setEdited] = useState(st === 'SCR-244-ST14' || st === 'SCR-244-ST22')
  const [rounds, setRounds] = useState(st === 'SCR-244-ST9' ? 3 : defaultRounds(ds, k))
  const [balance, setBalance] = useState(true)
  const [mixed, setMixed] = useState(true)
  const [loading, setLoading] = useState(st === 'SCR-244-ST2')
  const [genErr, setGenErr] = useState(st === 'SCR-244-ST4')
  const [seed, setSeed] = useState(0)
  const [keep, setKeep] = useState(false)
  const [saving, setSaving] = useState<number | null>(st === 'SCR-244-ST12' ? ds.games[2].key : null)
  const [fail, setFail] = useState<Fail | null>(null)
  const failNext = useRef(st === 'SCR-244-ST13')
  const [live, setLive] = useState('')
  const [toast, setToast] = useState<string | null>(st === 'SCR-244-ST22' ? '3라운드가 비어 지웠습니다. 뒤 라운드 번호가 하나씩 당겨졌습니다' : null)
  const [folded, setFolded] = useState<Set<number>>(() => new Set(st === 'SCR-244-ST24' ? [1, 2, 3] : []))
  const [restOpen, setRestOpen] = useState<Set<number>>(() => new Set(st === 'SCR-244-ST7' || st === 'SCR-244-ST7-IND' ? [1] : []))
  const [move, setMove] = useState<number | null>(st === 'SCR-244-ST20' ? init.games.find((g) => g.round === 6)!.key : null)
  const [moveBusy, setMoveBusy] = useState<number | null>(null)
  const [ask, setAsk] = useState<Ask | null>(() =>
    st === 'SCR-244-ST8' ? { kind: 'discard', apply: () => setRounds((r) => r + 1) } : st === 'SCR-244-ST14' ? { kind: 'regen' } : st === 'SCR-244-ST15' ? { kind: 'manual' } : st === 'SCR-244-ST16' ? { kind: 'delete', key: ds.games[2].key } : st === 'SCR-244-ST17' ? { kind: 'exit' } : st === 'SCR-244-ST6' ? { kind: 'conflict' } : null,
  )
  // 시트(SCR-225)
  const sheetTarget = (): Target | null => {
    if (!sheetView) return null
    if (sheetView === 'empty') return { key: init.games.find((g) => !complete(g))!.key, side: 1, idx: 0 }
    if (ds.ids.length === 4) return { key: 1, side: 0, idx: 0 }
    const g = byRound(init.games)[5]
    return { key: g.key, side: ind ? 1 : 0, idx: ind ? 1 : 0 }
  }
  const [sheet, setSheet] = useState<Target | null>(sheetTarget)
  const [sheetBusy, setSheetBusy] = useState<string | undefined>(() => (sheetView === 'saving' && sheetTarget() ? candidates(ds, init.games, sheetTarget()!).find((c) => c.state === 'ok')?.id : undefined))
  const [sheetErr, setSheetErr] = useState<Cand | null>(() => (sheetView === 'error' && sheetTarget() ? candidates(ds, init.games, sheetTarget()!).find((c) => c.state === 'ok') ?? null : null))
  useEffect(() => {
    if (sheetView === 'count' && sheet) {
      const c = candidates(ds, games, sheet).find((x) => x.warns.some((w) => w.startsWith('경기 수 차이')))
      if (c) setAsk({ kind: 'count', c })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번(보기 재현)
  }, [])
  useEffect(() => {
    if (!loading || st === 'SCR-244-ST2') return
    const t = setTimeout(() => {
      setLoading(false)
      setGames(genRounds(ds, courts, rounds, seed))
      setGen(rounds)
      setEdited(false)
      setLive(`대진을 만들었습니다. ${rounds}라운드 ${rounds * k}경기`)
    }, 900)
    return () => clearTimeout(t)
  }, [loading, st, ds, seed, rounds, courts, k])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const sorted = byRound(games)
  const saved = sorted.filter(complete)
  const partials = sorted.filter((g) => !complete(g))
  const has = saved.length > 0
  const groups = roundsOf(games)
  const roundCount = new Set(saved.map((g) => g.round)).size
  const cnt = counts(ds, games)
  const vals = Object.values(cnt)
  const lo = vals.length ? Math.min(...vals) : 0
  const hi = vals.length ? Math.max(...vals) : 0
  const relaxN = saved.filter((g) => g.relax).length
  const manualN = saved.filter((g) => g.relax === 'manual').length
  const no = (key: number) => noOf(games, games.find((g) => g.key === key)!)
  const totalShown = atMax ? 200 : saved.length

  // 미리보기(VD-078): 예상 경기 수·1인 경기 수(팀전 팀별)·라운드별 출전·휴식
  const maxRounds = k > 0 ? Math.floor(200 / k) : 0
  const est = rounds * k
  const slotsPer = (n: number, per: number) => ({ lo: Math.floor((rounds * per) / n), hi: Math.ceil((rounds * per) / n) })
  const blueN = ds.teams ? ds.ids.filter((id) => ds.teams![id] === 'blue').length : 0
  const whiteN = N - blueN
  const indRange = slotsPer(N, 4 * k)
  const bRange = slotsPer(blueN || 1, 2 * k)
  const wRange = slotsPer(whiteN || 1, 2 * k)
  const fmt = (r: { lo: number; hi: number }) => (r.lo === r.hi ? `${r.lo}` : `${r.lo}–${r.hi}`)
  const uneven = ind ? (rounds * 4 * k) % N !== 0 : (rounds * 2 * k) % blueN !== 0 || (rounds * 2 * k) % whiteN !== 0
  const evenPlans = (() => {
    if (!ind || k <= 0) return []
    const out: number[] = []
    for (let r = 1; r <= maxRounds && out.length < 2; r++) if ((r * 4 * k) % N === 0 && r !== rounds) out.push(r)
    return out
  })()
  const guard = (fn: () => void) => (has ? setAsk({ kind: 'discard', apply: fn }) : fn())

  /** 저장 흉내: 0.7초 뒤 반영(실패 모드면 한 번 실패하고 동작 전 상태 유지) */
  const save = (key: number, apply: () => void, failText: string, retry: () => void) => {
    setSaving(key)
    setFail(null)
    setTimeout(() => {
      setSaving(null)
      if (failNext.current) {
        failNext.current = false
        setFail({ text: failText, retry })
        return
      }
      apply()
      setEdited(true)
    }, SAVE_MS)
  }
  /** 빈 라운드를 지우고 뒤 라운드 번호를 당김(D5) */
  const compact = (gs: EGame[]) => {
    const used = [...new Set(byRound(gs).map((g) => g.round ?? 1))]
    const gone = used.length ? Array.from({ length: Math.max(...used) }, (_, i) => i + 1).filter((r) => !used.includes(r)) : []
    if (!gone.length) return { gs, gone }
    return { gs: gs.map((g) => ({ ...g, round: used.indexOf(g.round ?? 1) + 1 })), gone }
  }

  const applyCand = (c: Cand) => {
    setGames((gs) => {
      const after = gs.map((g) => (g.key === c.next.key ? c.next : g))
      if (!complete(c.next)) return after
      if (!repeats(after, c.next)) return after
      return after.map((g) => (g.key === c.next.key || sameMatch(g, c.next) ? { ...g, relax: 'manual' } : g))
    })
  }
  const commit = (c: Cand) => {
    const target = c.next
    if (!complete(target)) {
      applyCand(c)
      setSheet(null)
      setLive(`${no(target.key)}경기 자리에 ${person(c.id).name}`)
      return
    }
    setSheetBusy(c.id)
    setTimeout(() => {
      setSheetBusy(undefined)
      if (failNext.current) {
        failNext.current = false
        setSheetErr(c)
        return
      }
      setSheetErr(null)
      applyCand(c)
      setEdited(true)
      setSheet(null)
      setLive(`${no(target.key)}경기를 저장했습니다`)
    }, SAVE_MS)
  }
  const pick = (c: Cand) => (c.warns.some((w) => w.startsWith('경기 수 차이')) ? setAsk({ kind: 'count', c }) : commit(c))

  const doDelete = (key: number) => {
    const n = no(key)
    const run = () =>
      save(
        key,
        () => {
          setGames((gs) => {
            const { gs: left, gone } = compact(gs.filter((g) => g.key !== key))
            if (gone.length) setToast(`${gone[0]}라운드가 비어 지웠습니다. 뒤 라운드 번호가 하나씩 당겨졌습니다`)
            if (!left.length) setMode('manual')
            return left
          })
          setLive(`${n}경기를 삭제했습니다. 코트와 경기 번호를 다시 정리했습니다. 전체 ${saved.length - 1}경기`)
        },
        `${n}경기를 삭제하지 못했습니다. 연결이 불안정합니다`,
        () => {
          setFail(null)
          run()
        },
      )
    run()
  }
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (st === 'SCR-244-ST13') doDelete(ds.games[2].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번(보기 재현)
  }, [])
  const addGame = (round: number) => {
    const key = Math.max(0, ...games.map((g) => g.key)) + 1
    setGames((gs) => [...gs, blank(key, round)])
    setSheet({ key, side: 0, idx: 0 })
    setSheetErr(null)
    setFolded((f) => new Set([...f].filter((r) => r !== round)))
    setLive(`${round}라운드에 경기를 추가했습니다. 빈 자리 4`)
  }
  const lastRound = groups.length ? Math.max(...groups.map((x) => x.round)) : 0
  const addRound = () => addGame(lastRound + 1)
  const doMove = (key: number, to: number) => {
    setMoveBusy(to)
    setTimeout(() => {
      setMoveBusy(null)
      setMove(null)
      setGames((gs) => {
        const nk = Math.max(...gs.map((g) => g.key)) + 1
        const moved = gs.map((g) => (g.key === key ? { ...g, key: nk, round: to } : g))
        const { gs: left, gone } = compact(moved)
        const g2 = left.find((g) => g.key === nk)!
        setToast(`${g2.round}라운드 코트 ${courtOf(left, g2)}${[3, 6].includes(courtOf(left, g2)) ? '으로' : '로'} 옮겼습니다${gone.length ? `. ${gone[0]}라운드가 비어 지웠습니다` : ''}`)
        return left
      })
      setEdited(true)
    }, SAVE_MS)
  }
  const startGen = () => {
    setGenErr(false)
    setLoading(true)
  }
  const pickMethod = (m: 'auto' | 'manual') => {
    if (m === 'auto') return setMode('auto')
    if (has) return setAsk({ kind: 'manual' })
    setMode('manual')
    setGames([])
  }
  const onExit = () => (partials.length ? setAsk({ kind: 'exit' }) : (window.location.hash = '#SCR-111/SCR-111-ST1-OPS/mobile'))

  const nextReason = loading
    ? '대진을 먼저 만들어 주세요'
    : !has
      ? '대진이 없습니다. 라운드를 추가하거나 자동 생성해 주세요'
      : partials.length
        ? `${partials.map((g) => no(g.key)).join('·')}경기에 빈 자리가 있습니다`
        : undefined

  const slot = (g: EGame, side: 0 | 1, idx: 0 | 1) => {
    const id = (side === 0 ? g.t1 : g.t2)[idx]
    const n = no(g.key)
    const tl = teamLabel(ds, side)
    const open = () => {
      setSheetErr(null)
      setSheet({ key: g.key, side, idx })
    }
    const busy = saving === g.key
    if (!id)
      return (
        <button key={idx} type="button" className="su-slot-empty" disabled={busy} aria-label={`${g.round}라운드 코트 ${courtOf(games, g)}, ${n}경기 ${tl} 빈 자리 선택`} onClick={open}>
          <Plus aria-hidden />
          빈 자리
        </button>
      )
    const p = person(id)
    return (
      <button key={idx} type="button" className="su-slot" disabled={busy} aria-label={`${n}경기 ${tl} ${p.name} 바꾸기`} onClick={open}>
        <Avatar name={p.name} size="sm" />
        {p.name} <small>{p.score}</small>
        <ArrowLeftRight aria-hidden />
      </button>
    )
  }
  const card = (g: EGame) => {
    const n = no(g.key)
    const court = courtOf(games, g)
    const e = empties(g)
    const gp = gap(g)
    const busy = saving === g.key
    const line = (side: 0 | 1) => {
      const ids = side === 0 ? g.t1 : g.t2
      const full = ids.every(Boolean)
      return (
        <div className="su-tl" data-team={ind ? undefined : side === 0 ? 'blue' : 'white'}>
          <b>{ind ? teamLabel(ds, side) : side === 0 ? '청' : '백'}</b>
          <span className="su-players">
            {slot(g, side, 0)}
            {slot(g, side, 1)}
          </span>
          <span className="su-sum">{full ? sum(ids as string[]) : ''}</span>
        </div>
      )
    }
    return (
      <li key={g.key} className="su-game" data-cmp="CMP-041" data-phase="edit" data-incomplete={e > 0 || undefined} aria-busy={busy || undefined} data-testid="game-card" aria-label={`${g.round}라운드 코트 ${court}, ${n}경기`}>
        <header>
          <span className="su-gno">
            코트 {court}
            <small> · {n}경기</small>
          </span>
          {e > 0 && (
            <span className="su-badge" data-tone="warning" data-cmp="CMP-005">
              빈 자리 {e}
            </span>
          )}
          {g.relax && (
            <span className="su-badge su-relax" data-tone="warning" data-cmp="CMP-005">
              {g.relax === 'manual' ? '규칙 완화: 운영진 수동 변경' : '규칙 완화: 성별 조합'}
            </span>
          )}
          <small className="su-ggap">{gp === null ? '실력차 계산 불가' : `실력차 ${gp}`}</small>
          {busy ? (
            <span className="su-gbusy" role="status" aria-label={`${n}경기 저장 중`}>
              <LoaderCircle aria-hidden className="su-spin" />
            </span>
          ) : (
            <>
              {complete(g) && (
                <button type="button" className="su-gdel" aria-label={`${n}경기 다른 라운드로 이동`} disabled={saving !== null} onClick={() => setMove(g.key)} data-testid="move-btn">
                  <ArrowUpDown aria-hidden />
                </button>
              )}
              <button type="button" className="su-gdel" aria-label={`${n}경기 삭제`} disabled={saving !== null} onClick={() => (complete(g) ? setAsk({ kind: 'delete', key: g.key }) : setGames((gs) => compact(gs.filter((x) => x.key !== g.key)).gs))}>
                <Trash2 aria-hidden />
              </button>
            </>
          )}
        </header>
        {line(0)}
        {line(1)}
      </li>
    )
  }

  const askEl = (() => {
    if (!ask) return undefined
    const close = () => setAsk(null)
    switch (ask.kind) {
      case 'discard':
        return <Dialog title="대진이 초기화됩니다" desc="라운드 수나 규칙을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다" ok="바꾸기" tone="danger" onCancel={close} onOk={() => { ask.apply(); setGames([]); setGen(null); setEdited(false); close() }} />
      case 'regen':
        return <Dialog title="편집한 대진이 사라집니다" desc={`기준 ${rounds}라운드로 새로 만듭니다`} ok="다시 생성" tone="danger" onCancel={close} onOk={() => { close(); setSeed((s) => s + 1); startGen() }} />
      case 'manual':
        return <Dialog title="대진이 초기화됩니다" desc="빈 대진에서 직접 구성합니다" ok="바꾸기" tone="danger" onCancel={close} onOk={() => { close(); setGames([]); setGen(null); setEdited(false); setMode('manual'); setLive('직접 구성: 경기가 없습니다') }} />
      case 'delete':
        return <Dialog title={`${no(ask.key)}경기를 삭제할까요?`} desc="삭제하면 코트·경기 번호와 경기 수가 다시 계산됩니다" ok="삭제" tone="danger" onCancel={close} onOk={() => { close(); doDelete(ask.key) }} />
      case 'exit':
        return <Dialog title="완성하지 않은 경기가 있습니다" desc="나가면 사라집니다" cancel="계속 편집" ok="나가기" tone="danger" onCancel={close} onOk={() => { window.location.hash = '#SCR-111/SCR-111-ST1-OPS/mobile' }} />
      case 'count':
        return <Dialog title="경기 수 차이가 2가 됩니다. 그래도 바꿀까요?" ok="바꾸기" onCancel={close} onOk={() => { close(); commit(ask.c) }} />
      case 'conflict':
        return (
          <Dialog
            single
            title="다른 운영진이 대진을 변경했습니다"
            desc="방금 한 작업은 처리되지 않았습니다. 확인하면 최신 대진을 보여 줍니다"
            ok="확인"
            onOk={() => {
              close()
              setGames((gs) => {
                const done = byRound(gs).filter(complete)
                const last = done[done.length - 1]
                return compact(gs.filter((g) => g.key !== last.key)).gs
              })
              setLive('최신 대진으로 다시 그렸습니다')
            }}
          />
        )
    }
  })()

  const stepper = (
    <div className="su-stepper" data-cmp="CMP-006" data-variant="stepper">
      <button type="button" aria-label="라운드 수 줄이기" disabled={loading || rounds <= 1 || k <= 0} onClick={() => guard(() => { setRounds((r) => Math.max(1, r - 1)); setKeep(false) })}>
        <Minus aria-hidden />
      </button>
      <input
        aria-label="자동 생성 기준 라운드 수"
        inputMode="numeric"
        value={k <= 0 ? '' : rounds}
        disabled={loading || k <= 0}
        onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, '')) || 0; guard(() => { setRounds(v); setKeep(false) }) }}
      />
      <span className="su-unit">라운드</span>
      <button type="button" aria-label="라운드 수 늘리기" disabled={loading || rounds >= maxRounds || k <= 0} onClick={() => guard(() => { setRounds((r) => Math.min(maxRounds, r + 1)); setKeep(false) })}>
        <Plus aria-hidden />
      </button>
    </div>
  )
  const roundErr = k > 0 && (rounds < 1 || rounds > maxRounds)

  return (
    <SetupScreen
      scr="SCR-244"
      st={stateId}
      method={method}
      step="games"
      title="대진 설정"
      desc="라운드마다 코트를 채워 만들거나 직접 구성하고, 경기와 선수를 편집해요."
      compact
      onExit={onExit}
      card={
        <>
          <p className="sr-only" aria-live="polite">{live}</p>
          {genErr && (
            <div className="su-note" data-tone="danger" role="alert" data-cmp="CMP-023">
              <AlertTriangle aria-hidden />
              <span>대진을 만들지 못했습니다. 설정은 그대로입니다</span>
              <button type="button" className="su-link" onClick={startGen}>다시 시도</button>
            </div>
          )}
          {fail && (
            <div className="su-note" data-tone="danger" role="alert" data-cmp="CMP-023">
              <AlertTriangle aria-hidden />
              <span>{fail.text}</span>
              <button type="button" className="su-link" onClick={fail.retry}>다시 시도</button>
            </div>
          )}
          <section className="su-sec">
            <SectionTitle icon={<Shuffle aria-hidden />}>대진 구성 방식</SectionTitle>
            <div className="su-tiles" role="radiogroup" aria-label="대진 구성 방식" data-cmp="CMP-002" data-kind="action">
              {([
                ['auto', '자동 생성', <Shuffle key="a" aria-hidden />],
                ['manual', '직접 구성', <UserRoundPen key="m" aria-hidden />],
              ] as const).map(([v, label, icon]) => (
                <button key={v} type="button" role="radio" aria-checked={mode === v} className="su-tile" disabled={loading || saving !== null} onClick={() => pickMethod(v)}>
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </section>
          {mode === 'auto' && (
            <>
              <section className="su-sec">
                <SectionTitle icon={<ListOrdered aria-hidden />} req aside={`참가자 ${N}명 · 코트 ${courts}`}>
                  자동 생성 기준
                </SectionTitle>
                {stepper}
                {k > 0 && <p className="su-dist" style={{ margin: 0 }}>1–{maxRounds}라운드</p>}
                {roundErr && <p className="su-field-err">라운드 수는 1–{maxRounds} 사이로 입력해 주세요</p>}
                {k <= 0 ? (
                  <div className="su-note" data-tone="warning" role="status" data-cmp="CMP-023" data-testid="k0">
                    <AlertTriangle aria-hidden />
                    <span>팀마다 2명 이상, 전체 4명 이상이어야 경기를 만들 수 있습니다</span>
                  </div>
                ) : (
                  <ul className="su-plan" aria-live="polite" data-testid="round-preview">
                    <li><Grid2x2 aria-hidden /><span>라운드당 <b>{k}경기</b> · 코트 {courts} · 참가 {N}명</span></li>
                    <li>
                      <ListOrdered aria-hidden />
                      {ind ? (
                        <span>예상 <b>{est}경기</b> · 1인 <b>{fmt(indRange)}경기</b></span>
                      ) : (
                        <span>예상 <b>{est}경기</b> · <i className="su-tdot" data-team="blue" />청팀 1인 <b>{fmt(bRange)}경기</b> · <i className="su-tdot" data-team="white" />백팀 1인 <b>{fmt(wRange)}경기</b></span>
                      )}
                    </li>
                    <li>
                      <Users aria-hidden />
                      {ind ? (
                        <span>라운드마다 출전 <b>{4 * k}명</b> · 휴식 <b>{N - 4 * k}명</b></span>
                      ) : (
                        <span>청 <b>{2 * k}</b>·백 <b>{2 * k}</b> 출전 · 휴식 청 <b>{blueN - 2 * k}</b>·백 <b>{whiteN - 2 * k}</b></span>
                      )}
                    </li>
                    {capped && (
                      <li className="su-plan-note"><Info aria-hidden /><span>200경기 제한으로 1인 평균 3경기입니다</span></li>
                    )}
                  </ul>
                )}
                {uneven && !keep && k > 0 && evenPlans.length > 0 && (
                  <div className="su-optrow" role="group" aria-label="균등안" data-cmp="CMP-004">
                    {evenPlans.map((r) => (
                      <button key={r} type="button" className="su-chip" onClick={() => guard(() => setRounds(r))}>
                        {r}라운드 · 모두 {(r * 4 * k) / N}경기
                      </button>
                    ))}
                    <button type="button" className="su-chip" onClick={() => setKeep(true)}>입력값 유지</button>
                  </div>
                )}
              </section>
              <section className="su-sec">
                <SectionTitle icon={<Scale aria-hidden />}>규칙</SectionTitle>
                <div>
                  {([
                    ['밸런스 맞추기', '점수 합 차이가 작은 조합을 먼저 고릅니다', balance, setBalance],
                    ['성별 조합 맞추기', '남녀 섞인 복식은 상대도 섞인 복식으로', mixed, setMixed],
                  ] as const).map(([t, s, on, set]) => (
                    <div key={t} className="su-switch-row">
                      <span>{t}<small>{s}</small></span>
                      <button type="button" role="switch" aria-checked={on} aria-label={t} className="su-switch" data-cmp="CMP-007" disabled={loading} onClick={() => guard(() => set(!on))} />
                    </div>
                  ))}
                </div>
              </section>
              {!has && (
                <button type="button" className="su-gen" disabled={loading || k <= 0 || roundErr} aria-busy={loading || undefined} onClick={startGen}>
                  <Shuffle aria-hidden />
                  {loading ? '대진 만드는 중…' : '대진 생성'}
                </button>
              )}
            </>
          )}
          {loading && (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="대진을 만드는 중">
              {Array.from({ length: 4 }, (_, i) => <div key={i} className="su-skel" style={{ height: 112 }} />)}
            </div>
          )}
          {!loading && has && (
            <>
              <section className="su-sec" aria-label="대진 요약">
                <div className="su-stats">
                  <div className="su-stat"><b>{totalShown}경기</b><span>{roundCount}라운드 · 코트 {courts}</span></div>
                  <div className="su-stat"><b>{lo === hi ? lo : `${lo}–${hi}`}경기</b><span>1인 경기 수</span></div>
                  <div className="su-stat"><b>{relaxN}경기</b><span>규칙 완화{manualN ? ` · 수동 변경 ${manualN}` : ''}</span></div>
                </div>
                {gen !== null && roundCount !== gen && <p className="su-dist" style={{ margin: 0 }}>기준 {gen}라운드에서 편집됨</p>}
              </section>
              <section className="su-sec" aria-label="사람별 경기 수">
                <SectionTitle icon={<ListOrdered aria-hidden />}>사람별 경기 수</SectionTitle>
                <div className="su-counts">
                  {ds.ids.map((id) => (
                    <span key={id} className="su-cnt" data-odd={cnt[id] !== lo}>
                      {person(id).name} {cnt[id]}
                    </span>
                  ))}
                </div>
              </section>
            </>
          )}
          {!loading && (has || games.length > 0) && (
            <section className="su-sec" aria-label="대진">
              <SectionTitle
                icon={<Shuffle aria-hidden />}
                aside={
                  mode === 'auto' && has ? (
                    <button type="button" className="su-regen" disabled={saving !== null} onClick={() => (edited ? setAsk({ kind: 'regen' }) : (setSeed((s) => s + 1), startGen()))}>
                      <RotateCcw aria-hidden />
                      다시 생성
                    </button>
                  ) : undefined
                }
              >
                대진
              </SectionTitle>
              <div className="su-rounds" data-testid="rounds">
                {groups.map(({ round, games: gs }) => {
                  const play = roundPlay(ds, games, round)
                  const isFolded = folded.has(round)
                  const unsaved = !gs.some(complete)
                  const freeCourt = gs.length < courts
                  return (
                    <section key={round} className="su-round" data-cmp="CMP-059" data-phase="edit" aria-labelledby={`rh-${round}`}>
                      <RoundHead
                        id={`rh-${round}`}
                        round={round}
                        caption={ind ? `코트 ${gs.length}/${courts} · 출전 ${play.playing.length} · ` : `코트 ${gs.length}/${courts} · 청 ${play.blueIn}·백 ${play.whiteIn} · `}
                        restLabel={`휴식 ${play.rest.length}`}
                        restNames={play.rest.map((id) => (ds.teams ? `${ds.teams[id] === 'blue' ? '청' : '백'} ${person(id).name}` : person(id).name))}
                        restOpen={restOpen.has(round)}
                        onRest={() => setRestOpen((s) => (s.has(round) ? new Set([...s].filter((x) => x !== round)) : new Set([...s, round])))}
                        folded={isFolded}
                        onFold={() => setFolded((s) => (s.has(round) ? new Set([...s].filter((x) => x !== round)) : new Set([...s, round])))}
                        tags={
                          <>
                            {unsaved && <span className="su-badge" data-tone="pending" data-cmp="CMP-005">저장 전</span>}
                            {isFolded && gs.some((g) => !complete(g)) && <span className="su-badge" data-tone="warning" data-cmp="CMP-005">빈 자리 있음</span>}
                          </>
                        }
                      />
                      {!isFolded && (
                        <>
                          <ol className="su-round-list">{gs.map(card)}</ol>
                          {freeCourt && !atMax && (
                            <button type="button" className="su-add" data-size="sm" disabled={saving !== null} onClick={() => addGame(round)}>
                              <Plus aria-hidden />
                              코트 {gs.length + 1}에 경기 추가
                            </button>
                          )}
                        </>
                      )}
                    </section>
                  )
                })}
              </div>
              <button type="button" className="su-add" disabled={saving !== null || atMax} aria-describedby={atMax ? 'max-reason' : undefined} onClick={addRound}>
                <ListPlus aria-hidden />
                라운드 추가
              </button>
              {atMax && <p id="max-reason" className="su-dist" style={{ margin: 0 }}>경기는 200개까지 만들 수 있습니다</p>}
            </section>
          )}
          {!loading && mode === 'manual' && games.length === 0 && (
            <div className="su-empty" data-cmp="CMP-027" role="status">
              <ListPlus aria-hidden />
              <p style={{ margin: 0, fontWeight: 700 }}>경기가 없습니다</p>
              <p className="su-dist" style={{ margin: 0 }}>라운드를 추가하거나 자동 생성해 주세요</p>
              <button type="button" className="su-add" onClick={addRound}>
                <ListPlus aria-hidden />
                라운드 추가
              </button>
            </div>
          )}
        </>
      }
      bar={
        <StepBar
          prev={ind ? stepHref('SCR-242', method, 'SCR-242-ST8') : stepHref('SCR-243', method)}
          next={stepHref('SCR-245', method, manualN || (gen !== null && roundCount !== gen) ? 'SCR-245-ST1-EDIT' : 'SCR-245-ST1')}
          disabledReason={nextReason}
          loading={saving !== null}
        />
      }
      overlay={
        <>
          {toast && <Toast text={toast} />}
          {sheet && games.some((g) => g.key === sheet.key) && (
            <PickSheet
              ds={ds}
              games={games}
              target={sheet}
              savingId={sheetBusy}
              error={!!sheetErr}
              onPick={pick}
              onRetry={() => sheetErr && commit(sheetErr)}
              onClose={() => { setSheet(null); setSheetErr(null) }}
            />
          )}
          {move !== null && games.some((g) => g.key === move) && (
            <RoundMoveSheet
              games={games}
              gameKey={move}
              courts={courts}
              busyRound={moveBusy}
              onPick={(r) => doMove(move, r)}
              onClose={() => setMove(null)}
            />
          )}
          {askEl}
        </>
      }
    />
  )
}

