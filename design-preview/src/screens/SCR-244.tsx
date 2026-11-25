import { AlertTriangle, ArrowLeftRight, ListOrdered, ListPlus, LoaderCircle, Plus, RotateCcw, Scale, Shuffle, Trash2, UserRoundPen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PickSheet, teamLabel } from '../components/smapsh/PickSheet'
import { Avatar, Dialog, SectionTitle, SetupScreen, StepBar, stepHref } from '../components/smapsh/Setup'
import { candidates, complete, counts, dataset, empties, gap, regenerate, repeats, sameMatch, type Cand, type Dataset, type EGame, type Target } from '../mock/editor'
import { person, sum } from '../mock/setup'

// SCR-244 청백전 생성 · 대진 설정 — UX Spec r10 02 SCR-244, UXD-100–104(+096·071·098·099) / DD r13 VD-071–073·076(+ VD-066·068)
// 대진 구성 방식(자동 생성·직접 구성, 팀 구성 방식 타일 재사용) → ('자동 생성'일 때) 설정 → 요약·사람별 경기 수 → 공통 대진 편집기(경기 카드 + '경기 추가')
// 편집은 동작마다 저장(프리뷰는 0.7초 저장 중을 흉내), 미완성 경기는 화면에만. 선수·빈 자리를 누르면 SCR-225 시트
// 보기(끝 '-IND' 개인전 16명, '-IND4' 개인전 4명, '-TEAM2' 팀당 2명): ST1 생성 전 · ST2 생성 중 · ST4 생성 실패 · ST6 충돌 · ST7 대진 검토·편집(재진입)
//   ST8 대진 폐기 확인 · ST9 균등안 · ST10 직접 구성 빈 대진 · ST11 미완성 경기 · ST12 저장 중 · ST13 저장 실패 · ST14 다시 생성 확인 · ST15 직접 구성 전환 확인 · ST16 삭제 확인 · ST17 이탈 확인
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
const blank = (key: number): EGame => ({ key, t1: [null, null], t2: [null, null] })

function pickDataset(stateId: string) {
  if (stateId.endsWith('-IND4')) return { ds: dataset('ind4'), suffix: '-IND4' }
  if (stateId.endsWith('-TEAM2')) return { ds: dataset('team4'), suffix: '-TEAM2' }
  if (stateId.endsWith('-IND')) return { ds: dataset('ind16'), suffix: '-IND' }
  return { ds: dataset('team16'), suffix: '' }
}

function initial(st: string, ds: Dataset) {
  const g = ds.games
  const next = Math.max(...g.map((x) => x.key)) + 1
  const partial: EGame = { key: next, t1: [ds.ids[0], ds.ids[ds.kind === 'team' ? 2 : 5]], t2: [null, null] }
  if (ds.kind === 'team') partial.t1 = [ds.ids.find((id) => ds.teams![id] === 'blue')!, ds.ids.filter((id) => ds.teams![id] === 'blue')[3]]
  switch (st) {
    case 'SCR-244-ST1':
    case 'SCR-244-ST2':
    case 'SCR-244-ST4':
    case 'SCR-244-ST9':
      return { mode: 'auto' as Mode, games: [] as EGame[], gen: null as number | null }
    case 'SCR-244-ST10':
      return { mode: 'manual' as Mode, games: [], gen: null }
    case 'SCR-244-ST11':
    case 'SCR-244-ST17':
      return { mode: null, games: [...g, partial], gen: ds.base }
    case 'SCR-244-ST6':
      return { mode: null, games: [...g, partial], gen: ds.base }
    case 'SCR-244-ST8':
    case 'SCR-244-ST14':
      return { mode: 'auto' as Mode, games: st === 'SCR-244-ST14' ? [...g, { ...g[1], key: next, t2: g[2].t2 }] : g, gen: ds.base }
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
  const init = initial(st, ds)
  const [mode, setMode] = useState<Mode>(init.mode)
  const [games, setGames] = useState<EGame[]>(init.games)
  const [gen, setGen] = useState<number | null>(init.gen) // 마지막 자동 생성 기준값(편집 표시용)
  const [edited, setEdited] = useState(st === 'SCR-244-ST14')
  const [count, setCount] = useState(st === 'SCR-244-ST9' ? 10 : ds.base)
  const [balance, setBalance] = useState(true)
  const [mixed, setMixed] = useState(true)
  const [loading, setLoading] = useState(st === 'SCR-244-ST2')
  const [genErr, setGenErr] = useState(st === 'SCR-244-ST4')
  const [seed, setSeed] = useState(0)
  const [keep, setKeep] = useState(false)
  const [saving, setSaving] = useState<number | null>(st === 'SCR-244-ST12' ? ds.games[2].key : null)
  const [fail, setFail] = useState<Fail | null>(null)
  const failNext = useRef(st === 'SCR-244-ST13') // ST13은 시작하자마자 한 번 실패(아래 효과). 시트 실패 보기(SCR-225-ST4)는 실패가 이미 표시된 상태
  const [live, setLive] = useState('')
  const [ask, setAsk] = useState<Ask | null>(() =>
    st === 'SCR-244-ST8' ? { kind: 'discard', apply: () => setCount(10) } : st === 'SCR-244-ST14' ? { kind: 'regen' } : st === 'SCR-244-ST15' ? { kind: 'manual' } : st === 'SCR-244-ST16' ? { kind: 'delete', key: ds.games[2].key } : st === 'SCR-244-ST17' ? { kind: 'exit' } : st === 'SCR-244-ST6' ? { kind: 'conflict' } : null,
  )
  // 시트(SCR-225)
  const sheetTarget = (): Target | null => {
    if (!sheetView) return null
    if (sheetView === 'empty') return { key: init.games[init.games.length - 1].key, side: 1, idx: 0 }
    if (ds.ids.length === 4) return { key: 1, side: 0, idx: 0 }
    if (ind) return { key: 9, side: 1, idx: 1 }
    return { key: 1, side: 0, idx: 0 }
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
      setGames(regenerate(ds, seed, count))
      setGen(count)
      setEdited(false)
      setLive(`대진을 만들었습니다. 전체 ${count}경기`)
    }, 900)
    return () => clearTimeout(t)
  }, [loading, st, ds, seed, count])

  const saved = games.filter(complete)
  const partials = games.filter((g) => !complete(g))
  const has = saved.length > 0
  const cnt = counts(ds, games)
  const vals = Object.values(cnt)
  const lo = vals.length ? Math.min(...vals) : 0
  const hi = vals.length ? Math.max(...vals) : 0
  const relaxN = saved.filter((g) => g.relax).length
  const manualN = saved.filter((g) => g.relax === 'manual').length
  const noOf = (key: number) => games.findIndex((g) => g.key === key) + 1

  // 설정 분포(자동 생성 기준)
  const slots = count * 4
  const dLo = Math.floor(slots / N)
  const nHi = slots % N
  const uneven = nHi > 0
  const evenLo = (Math.floor(slots / N) * N) / 4
  const evenHi = (Math.ceil(slots / N) * N) / 4
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

  const applyCand = (c: Cand) => {
    setGames((gs) => {
      const after = gs.map((g) => (g.key === c.next.key ? c.next : g))
      if (!complete(c.next)) return after
      // 같은 대진 반복이면 두 경기 모두 '운영진 수동 변경'(AC-140)
      if (!repeats(after, c.next)) return after
      return after.map((g) => (g.key === c.next.key || sameMatch(g, c.next) ? { ...g, relax: 'manual' } : g))
    })
  }
  const commit = (c: Cand) => {
    const target = c.next
    if (!complete(target)) {
      applyCand(c)
      setSheet(null)
      setLive(`${noOf(target.key)}경기 자리에 ${person(c.id).name}`)
      return
    }
    // 시트에서 고르면 그 행에 저장 중, 성공하면 시트를 닫음(SCR-225-ST12 → 닫힘)
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
      setLive(`${noOf(target.key)}경기를 저장했습니다`)
    }, SAVE_MS)
  }
  const pick = (c: Cand) => (c.warns.some((w) => w.startsWith('경기 수 차이')) ? setAsk({ kind: 'count', c }) : commit(c))

  const doDelete = (key: number) => {
    const no = noOf(key)
    const run = () =>
      save(
        key,
        () => {
          setGames((gs) => {
            const left = gs.filter((g) => g.key !== key)
            if (!left.some(complete) && !left.length) setMode('manual')
            return left
          })
          setLive(`${no}경기를 삭제했습니다. 전체 ${saved.length - 1}경기`)
        },
        `${no}경기를 삭제하지 못했습니다. 연결이 불안정합니다`,
        () => {
          setFail(null)
          run()
        },
      )
    run()
  }
  // ST13 보기: 3경기 삭제가 한 번 실패한 상태로 시작(안내 상자 + '다시 시도')
  const started = useRef(false) // 개발 모드(StrictMode)에서 효과가 두 번 실행돼도 한 번만
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (st === 'SCR-244-ST13') doDelete(ds.games[2].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번(보기 재현)
  }, [])
  const addGame = () => {
    const key = Math.max(0, ...games.map((g) => g.key)) + 1
    setGames((gs) => [...gs, blank(key)])
    setSheet({ key, side: 0, idx: 0 })
    setSheetErr(null)
    setLive(`${games.length + 1}경기를 추가했습니다. 빈 자리 4`)
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
      ? '대진이 없습니다. 경기를 추가하거나 자동 생성해 주세요'
      : partials.length
        ? `${partials.map((g) => noOf(g.key)).join('·')}경기에 빈 자리가 있습니다`
        : undefined

  const slot = (g: EGame, side: 0 | 1, idx: 0 | 1) => {
    const id = (side === 0 ? g.t1 : g.t2)[idx]
    const no = noOf(g.key)
    const tl = teamLabel(ds, side)
    const open = () => {
      setSheetErr(null)
      setSheet({ key: g.key, side, idx })
    }
    const busy = saving === g.key
    if (!id)
      return (
        <button key={idx} type="button" className="su-slot-empty" disabled={busy} aria-label={`${no}경기 ${tl} 빈 자리 선택`} onClick={open}>
          <Plus aria-hidden />
          빈 자리
        </button>
      )
    const p = person(id)
    return (
      <button key={idx} type="button" className="su-slot" disabled={busy} aria-label={`${no}경기 ${tl} ${p.name} 바꾸기`} onClick={open}>
        <Avatar name={p.name} size="sm" />
        {p.name} <small>{p.score}</small>
        <ArrowLeftRight aria-hidden />
      </button>
    )
  }
  const card = (g: EGame, i: number) => {
    const no = i + 1
    const n = empties(g)
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
      <li key={g.key} className="su-game" data-cmp="CMP-041" data-phase="edit" data-incomplete={n > 0 || undefined} aria-busy={busy || undefined}>
        <header>
          <span className="su-gno">{no}경기</span>
          {n > 0 && (
            <span className="su-badge" data-tone="warning" data-cmp="CMP-005">
              빈 자리 {n}
            </span>
          )}
          {g.relax && (
            <span className="su-badge su-relax" data-tone="warning" data-cmp="CMP-005">
              {g.relax === 'manual' ? '규칙 완화: 운영진 수동 변경' : '규칙 완화: 성별 조합'}
            </span>
          )}
          <small className="su-ggap">{gp === null ? '실력차 계산 불가' : `실력차 ${gp}`}</small>
          {busy ? (
            <span className="su-gbusy" role="status" aria-label={`${no}경기 저장 중`}>
              <LoaderCircle aria-hidden className="su-spin" />
            </span>
          ) : (
            <button type="button" className="su-gdel" aria-label={`${no}경기 삭제`} disabled={saving !== null} onClick={() => (complete(g) ? setAsk({ kind: 'delete', key: g.key }) : setGames((gs) => gs.filter((x) => x.key !== g.key)))}>
              <Trash2 aria-hidden />
            </button>
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
        return <Dialog title="대진이 초기화됩니다" desc="경기 수나 규칙을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다" ok="바꾸기" tone="danger" onCancel={close} onOk={() => { ask.apply(); setGames([]); setGen(null); setEdited(false); close() }} />
      case 'regen':
        return <Dialog title="편집한 대진이 사라집니다" desc={`총 경기 수 ${count}으로 새로 만듭니다`} ok="다시 생성" tone="danger" onCancel={close} onOk={() => { close(); setSeed((s) => s + 1); startGen() }} />
      case 'manual':
        return <Dialog title="대진이 초기화됩니다" desc="빈 대진에서 직접 구성합니다" ok="바꾸기" tone="danger" onCancel={close} onOk={() => { close(); setGames([]); setGen(null); setEdited(false); setMode('manual'); setLive('직접 구성: 경기가 없습니다') }} />
      case 'delete':
        return <Dialog title={`${noOf(ask.key)}경기를 삭제할까요?`} desc="삭제하면 경기 번호와 경기 수가 다시 계산됩니다" ok="삭제" tone="danger" onCancel={close} onOk={() => { close(); doDelete(ask.key) }} />
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
              // 최신 상태 재현: 다른 운영진이 마지막 경기를 지움. 화면에만 있던 미완성 경기는 그대로
              setGames((gs) => {
                const done = gs.filter(complete)
                const last = done[done.length - 1]
                return gs.filter((g) => g.key !== last.key)
              })
              setLive('최신 대진으로 다시 그렸습니다')
            }}
          />
        )
    }
  })()

  return (
    <SetupScreen
      scr="SCR-244"
      st={stateId}
      method={method}
      step="games"
      title="대진 설정"
      desc="자동으로 만들거나 직접 구성하고, 경기와 선수를 편집해요."
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
          {/* VD-071: 팀 구성 방식 타일 재사용 */}
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
                <SectionTitle icon={<ListOrdered aria-hidden />} req aside={`참가자 ${N}명`}>
                  자동 생성 기준
                </SectionTitle>
                <label className="su-input" data-cmp="CMP-006" style={{ width: 140 }}>
                  <input
                    aria-label="총 경기 수(자동 생성 기준)"
                    inputMode="numeric"
                    value={count}
                    disabled={loading}
                    onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, '')) || 0; guard(() => { setCount(v); setKeep(false) }) }}
                  />
                  <span className="su-dist">경기</span>
                </label>
                {count < 1 ? (
                  <p className="su-field-err">경기 수를 1 이상으로 입력해 주세요</p>
                ) : (
                  <p className="su-dist" aria-live="polite">
                    {uneven ? (<><b>{nHi}명은 {dLo + 1}경기</b>, {N - nHi}명은 {dLo}경기를 합니다</>) : (<>모두 <b>{dLo}경기</b>씩 합니다</>)}
                  </p>
                )}
                {uneven && !keep && count >= 1 && (
                  <div className="su-optrow" role="group" aria-label="균등안" data-cmp="CMP-004">
                    {[evenLo, evenHi].filter((v) => v >= 1).map((v) => (
                      <button key={v} type="button" className="su-chip" onClick={() => guard(() => setCount(v))}>
                        {v}경기 (1인 {(v * 4) / N}경기)
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
                <button type="button" className="su-gen" disabled={loading || count < 1} aria-busy={loading || undefined} onClick={startGen}>
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
                  <div className="su-stat"><b>{saved.length}경기</b><span>총 경기 수</span></div>
                  <div className="su-stat"><b>{lo === hi ? lo : `${lo}–${hi}`}경기</b><span>1인 경기 수</span></div>
                  <div className="su-stat"><b>{relaxN}경기</b><span>규칙 완화{manualN ? ` · 수동 변경 ${manualN}` : ''}</span></div>
                </div>
                {gen !== null && saved.length !== gen && <p className="su-dist" style={{ margin: 0 }}>기준 {gen}경기에서 편집됨</p>}
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
              <ol className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {games.map(card)}
              </ol>
              <button type="button" className="su-add" disabled={saving !== null} onClick={addGame}>
                <Plus aria-hidden />
                경기 추가
              </button>
            </section>
          )}
          {!loading && mode === 'manual' && games.length === 0 && (
            <div className="su-empty" data-cmp="CMP-027" role="status">
              <ListPlus aria-hidden />
              <p style={{ margin: 0, fontWeight: 700 }}>경기가 없습니다</p>
              <p className="su-dist" style={{ margin: 0 }}>경기를 추가하거나 자동 생성해 주세요</p>
              <button type="button" className="su-add" onClick={addGame}>
                <Plus aria-hidden />
                경기 추가
              </button>
            </div>
          )}
        </>
      }
      bar={
        <StepBar
          prev={ind ? stepHref('SCR-242', method, 'SCR-242-ST8') : stepHref('SCR-243', method)}
          next={stepHref('SCR-245', method, manualN || (gen !== null && saved.length !== gen) ? 'SCR-245-ST1-EDIT' : 'SCR-245-ST1')}
          disabledReason={nextReason}
          loading={saving !== null}
        />
      }
      overlay={
        <>
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
          {askEl}
        </>
      }
    />
  )
}
