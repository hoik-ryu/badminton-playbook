import { AlertTriangle, Grid2x2, Info, ListOrdered, ListPlus, Plus, RotateCcw, Scale, Shuffle, UserRoundPen, Users } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { NoticeBox } from '../../../components/NoticeBox'
import { RoundSection } from '../../../components/RoundSection'
import { StateView } from '../../../components/StateView'
import { StepActionBar } from '../../../components/StepActionBar'
import { Switch } from '../../../components/Switch'
import { TextField } from '../../../components/TextField'
import { useToast } from '../../../components/toastContext'
import { isApiError } from '../../../lib/api'
import { addClubGame, CLUB_ERRORS, deleteClubGame, discardClubGames, exchangeClubGame, generateClub, moveClubGame, setSettings, swapClub, type ClubMatchView } from '../api'
import { PickSheet } from '../ClubSwapSheet'
import { defaultRounds, MAX_GAMES, maxRounds, perRound, roundPreview } from '../schedule'
import { EditGameCard } from './GamesStep'
import { MethodTiles, SectionTitle } from './parts'
import { filled, gameCounts, isComplete, lineupKey, lineupsOf, moveOptions, slotOf, type Lineup, type PickCandidate, type PickTarget } from './pick'
import { RoundMoveSheet } from './RoundMoveSheet'
import { SetupFrame } from './SetupFrame'
import { participantsOf } from './steps'
import type { StepProps } from './types'
import type { GamesDraft, GamesUi } from './useSetup'

// SCR-244 청백전 생성 · 대진 설정(라운드 기반) — UX Spec r11 02 SCR-244(UXD-100–104·106–109), DD r14 VD-077–081·086(+ r13 VD-071–073·076), Preview r11
// - 자동 생성 기준은 라운드 수(스테퍼 VD-077)와 미리보기 세 줄(VD-078: 라운드당 경기·예상 경기 수와 1인 경기 수(팀전 팀별)·라운드별 출전·휴식).
//   k = 0이면 안내 상자(ST18), 200경기 상한에 걸려 평균 4경기 미달이면 안내(ST19), 균등안(라운드 수)·'입력값 유지'
// - 대진은 라운드 구역(CMP-059, 카드로 감싸지 않음)으로 묶고 카드 머리 '코트 m · n경기'(VD-080), 저장된 경기의 '이동' → 라운드 이동 시트(ST20)
// - 구역 끝 '코트 m에 경기 추가'(빈 코트가 있을 때), 목록 끝 '라운드 추가'(ST21, 저장 전 라운드), 200개면 둘 다 비활성(ST23), 구역 접기(ST24)
// - 삭제·이동으로 라운드가 비거나 코트가 당겨지면 서버가 돌려준 라운드·코트·번호로 다시 그리고 토스트·aria-live(ST22)
// - 편집 동작마다 바로 저장, 미완성 경기(화면 상태)·실패 다시 시도·충돌(페이지 충돌 창)·확인 창(ST8·ST14–16)은 기존 정책(UXD-103) 그대로
const SHOWN_ERRORS = new Set<string>([CLUB_ERRORS.unscored, CLUB_ERRORS.minPlayers, CLUB_ERRORS.unassigned, CLUB_ERRORS.invalidRound])
const SHEET_SHOWN = new Set<string>([CLUB_ERRORS.duplicatePlayer, CLUB_ERRORS.teamViolation, CLUB_ERRORS.notEligible, CLUB_ERRORS.notTwoVsTwo, CLUB_ERRORS.maxGames, CLUB_ERRORS.locked, CLUB_ERRORS.roundConflict, CLUB_ERRORS.courtFull, CLUB_ERRORS.invalidRound])
type Pending = { patch: Partial<GamesDraft> }
type Ask = { kind: 'regen' } | { kind: 'manual' } | { kind: 'delete'; id: string }
type Busy = { key: string } | null
/** 화면 줄: 서버 번호(srv)와 화면 번호(no·court, 라운드 → 코트 순, 미완성 경기 포함) */
type Row = Lineup & { srv: number | null }
const toggle = (s: Set<number>, r: number) => (s.has(r) ? new Set([...s].filter((x) => x !== r)) : new Set([...s, r]))
const josa = (court: number) => ([3, 6].includes(court) ? '으로' : '로')

export function RoundGamesStep({ c, frame, go }: StepProps) {
  const v = c.view!
  const d = c.drafts.games
  const ui = c.drafts.gamesUi
  const toast = useToast()
  const courts = v.courtCount ?? 1
  const [pending, setPending] = useState<Pending | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [generating, setGenerating] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [sheet, setSheet] = useState<PickTarget | null>(null)
  const [sheetBusy, setSheetBusy] = useState<Busy>(null)
  const [sheetErr, setSheetErr] = useState<{ message: string; retry: () => void } | null>(null)
  const [countAsk, setCountAsk] = useState<PickCandidate | null>(null)
  const [cardBusy, setCardBusy] = useState<string | null>(null)
  const [move, setMove] = useState<string | null>(null)
  const [moveBusy, setMoveBusy] = useState<number | null>(null)
  const [moveErr, setMoveErr] = useState<{ message: string; retry: () => void } | null>(null)
  const [folded, setFolded] = useState<Set<number>>(() => new Set())
  const [restOpen, setRestOpen] = useState<Set<number>>(() => new Set())
  const [live, setLive] = useState('')
  const [reorg, setReorg] = useState(false)

  // ── 참가자·라운드 계산(서버 schedule.py와 같은 식) ──
  const inPlay = participantsOf(v).filter((r) => v.method === 'individual' || r.team)
  const blueN = inPlay.filter((r) => r.team === 'blue').length
  const whiteN = inPlay.filter((r) => r.team === 'white').length
  const sizes = { all: inPlay.length, blue: blueN, white: whiteN }
  const k = perRound(v.method, sizes, courts)
  const top = maxRounds(k)
  const roundsText = d.rounds !== '' ? d.rounds : k > 0 ? String(defaultRounds(v.method, sizes, k)) : ''
  const rounds = Number(roundsText)
  const roundsErr = k > 0 && (!Number.isInteger(rounds) || rounds < 1 || rounds > top) ? `라운드 수는 1–${top} 사이로 입력해 주세요` : undefined
  const plan = k > 0 && !roundsErr ? roundPreview(v.method, sizes, courts, rounds) : null
  const [inputText, setInputText] = useState(roundsText)

  // ── 화면 줄(저장된 경기 + 미완성 경기) ──
  const saved = lineupsOf(v)
  const hasGames = saved.length > 0
  const rows = arrange(saved, ui.partials)
  const partials = rows.filter((l) => !l.saved)
  const roundNos = [...new Set(rows.map((l) => l.round ?? 1))].sort((a, b) => a - b)
  const savedRounds = new Set(saved.map((l) => l.round ?? 1))
  const roundCount = savedRounds.size
  const lastRound = roundNos.length ? Math.max(...roundNos) : 0
  const atMax = saved.length >= MAX_GAMES
  const mode: GamesUi['mode'] = ui.mode ?? (!hasGames && !partials.length ? 'auto' : null)
  const rowById = new Map(rows.map((l) => [l.id, l]))

  const setDraft = (patch: Partial<GamesDraft>) => c.setDrafts((x) => ({ ...x, games: { ...x.games, ...patch } }))
  const setUi = (patch: Partial<GamesUi> | ((u: GamesUi) => Partial<GamesUi>)) => c.setDrafts((x) => ({ ...x, gamesUi: { ...x.gamesUi, ...(typeof patch === 'function' ? patch(x.gamesUi) : patch) } }))
  /** 설정 변경: 대진이 있으면 확인(ST8) 후 즉시 저장+폐기, 없으면 화면 입력 */
  const change = (patch: Partial<GamesDraft>) => {
    setReorg(false)
    if (hasGames) setPending({ patch })
    else setDraft(patch)
  }
  const applyNow = async (patch: Partial<GamesDraft>) => {
    const next = { ...d, rounds: roundsText, ...patch }
    const settings = { rounds: Number(next.rounds), rules: { balance: next.balance, gender: next.gender } }
    const r = await c.save(
      () => setSettings(v.id, v.version, settings, true),
      (x) => x.plannedRounds === settings.rounds && x.rules.balance === settings.rules.balance && x.rules.gender === settings.rules.gender && x.games.length === 0,
      () => void applyNow(patch),
    )
    if (r.kind === 'ok') {
      c.accept(r.view, { games: true })
      setUi({ base: null, edited: false, partials: [] })
      setInputText(String(r.view.plannedRounds ?? next.rounds))
    } else if (r.kind === 'failed') c.setFailure({ message: '설정을 저장하지 못했습니다. 대진은 그대로입니다', retry: () => void applyNow(patch) })
  }

  const generate = async (discard = false) => {
    if (roundsErr || k <= 0) return
    setRefused(null)
    setReorg(false)
    setGenerating(true)
    const settings = { rounds, rules: { balance: d.balance, gender: d.gender } }
    const before = v.games
    const r = await c.save(
      () => generateClub(v.id, v.version, settings, discard),
      (x) => x.games.length > 0 && x.games !== before,
      () => void generate(discard),
    )
    setGenerating(false)
    if (r.kind === 'ok') {
      c.accept(r.view, { games: true })
      setUi({ mode: 'auto', base: new Set(r.view.games.map((g) => g.round)).size, edited: false, partials: [] })
      setLive(`대진을 만들었습니다. ${new Set(r.view.games.map((g) => g.round)).size}라운드 ${r.view.games.length}경기`)
    } else if (r.kind === 'confirm') setAsk({ kind: 'regen' })
    else if (r.kind === 'failed') {
      if (isApiError(r.error) && SHOWN_ERRORS.has(r.error.code)) setRefused(r.error.message)
      else c.setFailure({ message: '대진을 만들지 못했습니다. 설정은 그대로입니다', retry: () => void generate(discard) })
    }
  }
  const regenerate = () => (ui.edited || v.games.some((g) => g.manual) ? setAsk({ kind: 'regen' }) : void generate())

  const pickMethod = (m: 'auto' | 'manual') => {
    if (m === 'auto') return setUi({ mode: 'auto' })
    if (hasGames) return setAsk({ kind: 'manual' })
    setUi({ mode: 'manual' })
  }
  const toManual = async () => {
    const r = await c.save(
      () => discardClubGames(v.id, v.version),
      (x) => x.games.length === 0,
      () => void toManual(),
    )
    if (r.kind === 'ok') {
      c.accept(r.view)
      setUi({ mode: 'manual', base: null, edited: false, partials: [] })
      setLive('직접 구성: 경기가 없습니다')
    } else if (r.kind === 'failed') c.setFailure({ message: '대진을 비우지 못했습니다. 대진은 그대로입니다', retry: () => void toManual() })
  }

  /** 라운드에 빈 경기 추가(화면에만): 그 라운드 다음 코트, 첫 빈 자리 시트(ST11·ST21) */
  const addGame = (round: number) => {
    const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setReorg(false)
    setUi((u) => ({ partials: [...u.partials, { id, no: 0, round, court: 0, t1: [null, null], t2: [null, null], saved: false }] }))
    setFolded((f) => new Set([...f].filter((r) => r !== round)))
    setSheetErr(null)
    setSheet({ id, side: 0, idx: 0 })
    setLive(`${round}라운드에 경기를 추가했습니다. 빈 자리 4`)
  }
  const removePartial = (id: string) => setUi((u) => ({ partials: u.partials.filter((x) => x.id !== id) }))

  /** 서버 응답 뒤 라운드 정리 알림(ST22): 빈 라운드가 지워졌는지·코트가 당겨졌는지. 사라진 라운드 뒤의 미완성 경기는 번호를 당김 */
  const afterReorg = (latest: ClubMatchView, round: number, message: string) => {
    const before = roundCount
    const after = new Set(latest.games.map((g) => g.round)).size
    let text = message
    if (after < before) {
      text = lastRound > round ? `${round}라운드가 비어 지웠습니다. 뒤 라운드 번호가 하나씩 당겨졌습니다` : `${round}라운드가 비어 지웠습니다`
      setUi((u) => ({ partials: u.partials.map((p) => ((p.round ?? 1) > round ? { ...p, round: (p.round ?? 1) - 1 } : p)) }))
    }
    if (text) {
      toast(text, 'neutral')
      setReorg(true)
    }
    setLive(`${text ? `${text} ` : ''}전체 ${latest.games.length}경기`)
  }

  const doDelete = async (id: string) => {
    const l = rowById.get(id)
    if (!l || l.srv === null) return
    const srv = l.srv
    setCardBusy(id)
    const before = v.games.length
    const shifted = saved.filter((x) => x.round === l.round).length > (l.court ?? 0)
    // 응답을 잃은 재시도 판정: 지우려던 그 경기(같은 4명·같은 조)가 최신 대진에 없고 경기 수가 하나 줄었을 때만 반영된 것으로 봄
    const r = await c.save(
      () => deleteClubGame(v.id, v.version, srv),
      (x) => x.games.length === before - 1 && !lineupsOf(x).some((y) => lineupKey(y) === lineupKey(l)),
      () => void doDelete(id),
    )
    setCardBusy(null)
    if (r.kind === 'ok') {
      c.accept(r.view)
      setUi((u) => ({ edited: true, mode: r.view.games.length === 0 && !u.partials.length ? 'manual' : u.mode }))
      afterReorg(r.view, l.round ?? 1, shifted ? `${l.round}라운드 코트를 다시 정리했습니다` : '')
    } else if (r.kind === 'failed') c.setFailure({ message: `${l.no}경기를 삭제하지 못했습니다. 대진은 그대로입니다`, retry: () => void doDelete(id) })
  }

  const doMove = async (id: string, round: number) => {
    const l = rowById.get(id)
    if (!l || l.srv === null) return
    const srv = l.srv
    setMoveBusy(round)
    setMoveErr(null)
    const key = lineupKey(l)
    const r = await c.save(
      () => moveClubGame(v.id, v.version, srv, round),
      (x) => lineupsOf(x).some((y) => lineupKey(y) === key && y.round !== l.round),
      () => void doMove(id, round),
    )
    setMoveBusy(null)
    if (r.kind === 'ok') {
      c.accept(r.view)
      setMove(null)
      setUi({ edited: true })
      const moved = lineupsOf(r.view).find((y) => lineupKey(y) === key)
      const court = moved?.court ?? 1
      const gone = new Set(r.view.games.map((g) => g.round)).size < roundCount
      afterReorg(r.view, l.round ?? 1, `${moved?.round ?? round}라운드 코트 ${court}${josa(court)} 옮겼습니다${gone ? `. ${l.round}라운드가 비어 지웠습니다` : ''}`)
    } else if (r.kind === 'conflict') setMove(null)
    else if (r.kind === 'failed') {
      const message = isApiError(r.error) && SHEET_SHOWN.has(r.error.code) ? r.error.message : '경기를 옮기지 못했습니다. 대진은 그대로입니다'
      setMoveErr({ message, retry: () => void doMove(id, round) })
    }
  }

  /** 시트에서 고름: 저장된 경기는 교체·맞교환을 바로 저장, 미완성 경기는 화면에서 채우고 네 자리가 차면 그 라운드에 경기 추가 저장 */
  const commit = async (cand: PickCandidate) => {
    const t = sheet
    if (!t) return
    const l = rowById.get(t.id)
    if (!l) return
    if (!l.saved && !isComplete(cand.next)) {
      setUi((u) => ({ partials: u.partials.map((x) => (x.id === l.id ? { ...x, t1: cand.next.t1, t2: cand.next.t2 } : x)) }))
      setSheet(null)
      setLive(`${l.no}경기 자리에 ${cand.row.name}`)
      return
    }
    const me = slotOf(l, t.side, t.idx)
    setSheetBusy({ key: cand.row.key })
    setSheetErr(null)
    setReorg(false)
    const srv = l.srv
    const attempt = (): Promise<ClubMatchView> => {
      if (!l.saved || srv === null) return addClubGame(v.id, v.version, cand.next.t1 as [string, string], cand.next.t2 as [string, string], l.round ?? 1)
      if (cand.section === 'swap') return exchangeClubGame(v.id, v.version, srv, me!, cand.row.key)
      return swapClub(v.id, v.version, srv, me!, cand.row.key)
    }
    const want = new Set(filled(cand.next))
    const r = await c.save(
      attempt,
      (x) => (l.saved ? x.games.some((g) => g.no === srv && [...g.team1, ...g.team2].every((p) => want.has(p.key))) : x.games.length === saved.length + 1 && lineupsOf(x).some((y) => y.round === l.round && lineupKey(y) === lineupKey(cand.next))),
      () => void commit(cand),
    )
    setSheetBusy(null)
    if (r.kind === 'ok') {
      c.accept(r.view)
      setUi((u) => ({ edited: true, partials: l.saved ? u.partials : u.partials.filter((x) => x.id !== l.id) }))
      setSheet(null)
      setLive(`${l.no}경기를 저장했습니다`)
    } else if (r.kind === 'conflict') setSheet(null)
    else if (r.kind === 'failed') {
      const message = isApiError(r.error) && SHEET_SHOWN.has(r.error.code) ? r.error.message : '변경을 저장하지 못했습니다. 연결이 불안정합니다'
      setSheetErr({ message, retry: () => void commit(cand) })
    }
  }
  const onPick = (cand: PickCandidate) => (cand.warns.some((w) => w.startsWith('경기 수 차이')) ? setCountAsk(cand) : void commit(cand))

  // ── 요약 ──
  const counts = gameCounts(v.rows, saved)
  const perPerson = inPlay.map((r) => ({ r, n: counts.get(r.key) ?? 0 }))
  const nums = perPerson.map((x) => x.n)
  const minN = nums.length ? Math.min(...nums) : 0
  const maxN = nums.length ? Math.max(...nums) : 0
  const relaxed = v.games.filter((g) => g.genderRelaxed || g.repeatedMatchup || g.relaxations.length > 0).length
  const manualN = v.games.filter((g) => g.relaxations.some((x) => x.reason === 'manual')).length
  const avgBelow = plan?.belowTarget ? Math.floor(v.method === 'team' ? (plan.games * 2) / Math.max(blueN, whiteN, 1) : (plan.games * 4) / Math.max(inPlay.length, 1)) : null
  const proposals = plan && !d.keepUneven ? plan.proposals : []

  const loading = generating || (c.saving && !pending)
  const busy = loading || cardBusy !== null || sheetBusy !== null || moveBusy !== null
  const unsavedRound = roundNos.some((rd) => !savedRounds.has(rd))
  const st = pending
    ? 'SCR-244-ST8'
    : ask?.kind === 'regen'
      ? 'SCR-244-ST14'
      : ask?.kind === 'manual'
        ? 'SCR-244-ST15'
        : ask?.kind === 'delete'
          ? 'SCR-244-ST16'
          : c.conflict
            ? 'SCR-244-ST6'
            : generating
              ? 'SCR-244-ST2'
              : move
                ? 'SCR-244-ST20'
                : cardBusy !== null
                  ? 'SCR-244-ST12'
                  : c.failure && hasGames
                    ? 'SCR-244-ST13'
                    : c.failure || refused || (mode === 'auto' && !!roundsErr)
                      ? 'SCR-244-ST4'
                      : mode === 'auto' && !hasGames && k <= 0
                        ? 'SCR-244-ST18'
                        : unsavedRound
                          ? 'SCR-244-ST21'
                          : partials.length
                            ? 'SCR-244-ST11'
                            : reorg
                              ? 'SCR-244-ST22'
                              : atMax
                                ? 'SCR-244-ST23'
                                : folded.size > 0
                                  ? 'SCR-244-ST24'
                                  : !hasGames && mode === 'manual'
                                    ? 'SCR-244-ST10'
                                    : hasGames
                                      ? 'SCR-244-ST7'
                                      : avgBelow !== null
                                        ? 'SCR-244-ST19'
                                        : proposals.length
                                          ? 'SCR-244-ST9'
                                          : 'SCR-244-ST1'
  const nextReason = generating ? '대진을 먼저 만들어 주세요' : partials.length ? `${partials.map((p) => p.no).join('·')}경기에 빈 자리가 있습니다` : !hasGames ? '대진이 없습니다. 라운드를 추가하거나 자동 생성해 주세요' : undefined
  const onStep = (key: string) => (key === 'confirm' && nextReason ? undefined : frame.onStep(key))
  const moving = move ? rowById.get(move) : undefined

  const stepRounds = (n: number) => {
    setInputText(String(n))
    change({ rounds: String(n), keepUneven: false })
  }

  return (
    <SetupFrame
      scr="SCR-244"
      st={st}
      method={v.method}
      title="대진 설정"
      desc="라운드마다 코트를 채워 만들거나 직접 구성하고, 경기와 선수를 편집해요."
      compact
      steps={frame.steps}
      current="games"
      onStep={onStep}
      onExit={frame.onExit}
      notice={
        <>
          <p className="sr-only" aria-live="polite">
            {live || `전체 ${saved.length}경기, ${roundCount}라운드${partials.length ? `, 빈 자리가 있는 경기 ${partials.length}개` : ''}`}
          </p>
          {c.failure && (
            <NoticeBox tone="danger" action={<button type="button" className="su-link" onClick={c.failure.retry}>다시 시도</button>}>
              {c.failure.message}
            </NoticeBox>
          )}
          {refused && <NoticeBox tone="danger">{refused}</NoticeBox>}
        </>
      }
      bar={<StepActionBar onPrev={() => go(v.method === 'team' ? 'teams' : 'participants')} onNext={() => go('confirm')} disabledReason={nextReason} disabled={busy} />}
      overlay={
        <>
          <ConfirmDialog
            open={!!pending}
            onOpenChange={(o) => {
              if (!o) {
                setPending(null)
                setInputText(roundsText) // 취소하면 원래 값
              }
            }}
            tone="danger"
            title="대진이 초기화됩니다"
            description="라운드 수나 규칙을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다"
            confirmLabel="바꾸기"
            onConfirm={async () => {
              const p = pending
              if (p) await applyNow(p.patch)
            }}
          />
          <ConfirmDialog open={ask?.kind === 'regen'} onOpenChange={(o) => !o && setAsk(null)} tone="danger" title="편집한 대진이 사라집니다" description={`기준 ${rounds}라운드로 새로 만듭니다`} confirmLabel="다시 생성" onConfirm={() => { setAsk(null); void generate(true) }} />
          <ConfirmDialog open={ask?.kind === 'manual'} onOpenChange={(o) => !o && setAsk(null)} tone="danger" title="대진이 초기화됩니다" description="빈 대진에서 직접 구성합니다" confirmLabel="바꾸기" onConfirm={toManual} />
          <ConfirmDialog
            open={ask?.kind === 'delete'}
            onOpenChange={(o) => !o && setAsk(null)}
            tone="danger"
            title={`${ask?.kind === 'delete' ? (rowById.get(ask.id)?.no ?? '') : ''}경기를 삭제할까요?`}
            description="삭제하면 코트·경기 번호와 경기 수가 다시 계산됩니다"
            confirmLabel="삭제"
            onConfirm={() => {
              const id = ask?.kind === 'delete' ? ask.id : ''
              setAsk(null)
              void doDelete(id)
            }}
          />
          <ConfirmDialog open={countAsk !== null} onOpenChange={(o) => !o && setCountAsk(null)} title={`경기 수 차이가 ${countAsk?.diffAfter ?? 2}가 됩니다. 그래도 바꿀까요?`} confirmLabel="바꾸기" onConfirm={() => { const x = countAsk; setCountAsk(null); if (x) void commit(x) }} />
          {sheet && rowById.has(sheet.id) && (
            <PickSheet
              view={v}
              lineups={rows}
              target={sheet}
              confirmed={false}
              busyKey={sheetBusy?.key}
              error={sheetErr?.message}
              onRetry={sheetErr?.retry}
              onPick={onPick}
              onClose={() => {
                setSheet(null)
                setSheetErr(null)
              }}
            />
          )}
          {moving && (
            <RoundMoveSheet
              no={moving.no}
              options={moveOptions(v, saved, moving, courts)}
              busyRound={moveBusy}
              error={moveErr?.message}
              onRetry={moveErr?.retry}
              onPick={(round) => void doMove(moving.id, round)}
              onClose={() => {
                setMove(null)
                setMoveErr(null)
              }}
            />
          )}
        </>
      }
    >
      {/* VD-071: 팀 구성 방식 타일(MethodTiles) 재사용 */}
      <section className="su-sec">
        <SectionTitle icon={<Shuffle aria-hidden />}>대진 구성 방식</SectionTitle>
        <MethodTiles
          label="대진 구성 방식"
          value={mode}
          options={[
            { value: 'auto', label: '자동 생성', icon: <Shuffle aria-hidden /> },
            { value: 'manual', label: '직접 구성', icon: <UserRoundPen aria-hidden /> },
          ]}
          onChange={(m) => !busy && m !== mode && pickMethod(m)}
        />
      </section>
      {mode === 'auto' && (
        <>
          <section className="su-sec">
            <SectionTitle icon={<ListOrdered aria-hidden />} req aside={`참가자 ${inPlay.length}명 · 코트 ${courts}`}>
              자동 생성 기준
            </SectionTitle>
            <TextField
              label="자동 생성 기준 라운드 수"
              hideLabel
              value={k <= 0 ? '' : inputText}
              disabled={loading || k <= 0}
              error={k > 0 && inputText !== roundsText ? undefined : roundsErr}
              stepper={{ min: 1, max: Math.max(1, top), unit: '라운드', decLabel: '라운드 수 줄이기', incLabel: '라운드 수 늘리기', onStep: stepRounds }}
              onChange={(e) => {
                const t = e.target.value.replace(/\D/g, '').slice(0, 3)
                setInputText(t)
                if (!hasGames) setDraft({ rounds: t, keepUneven: false })
              }}
              onBlur={() => {
                if (hasGames && inputText !== roundsText && Number(inputText) >= 1 && Number(inputText) <= top) change({ rounds: inputText, keepUneven: false })
                else if (hasGames) setInputText(roundsText)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            />
            {k > 0 && <p className="su-dist m-0">1–{top}라운드</p>}
            {k <= 0 ? (
              <NoticeBox tone="warning">팀마다 2명 이상, 전체 4명 이상이어야 경기를 만들 수 있습니다</NoticeBox>
            ) : (
              plan && (
                <ul className="su-plan" aria-live="polite" data-testid="round-preview">
                  <li>
                    <Grid2x2 aria-hidden />
                    <span>
                      라운드당 <b>{k}경기</b> · 코트 {courts} · 참가 {inPlay.length}명
                    </span>
                  </li>
                  <li>
                    <ListOrdered aria-hidden />
                    {v.method === 'individual' ? (
                      <span>
                        예상 <b>{plan.games}경기</b> · 1인 <b>{range(plan.each.all)}경기</b>
                      </span>
                    ) : (
                      <span>
                        예상 <b>{plan.games}경기</b> · <i className="su-tdot" data-team="blue" />
                        청팀 1인 <b>{range(plan.each.blue)}경기</b> · <i className="su-tdot" data-team="white" />
                        백팀 1인 <b>{range(plan.each.white)}경기</b>
                      </span>
                    )}
                  </li>
                  <li>
                    <Users aria-hidden />
                    {v.method === 'individual' ? (
                      <span>
                        라운드마다 출전 <b>{plan.playing.all}명</b> · 휴식 <b>{plan.resting.all}명</b>
                      </span>
                    ) : (
                      <span>
                        청 <b>{plan.playing.blue}</b>·백 <b>{plan.playing.white}</b> 출전 · 휴식 청 <b>{plan.resting.blue}</b>·백 <b>{plan.resting.white}</b>
                      </span>
                    )}
                  </li>
                  {avgBelow !== null && (
                    <li className="su-plan-note">
                      <Info aria-hidden />
                      <span>200경기 제한으로 1인 평균 {avgBelow}경기입니다</span>
                    </li>
                  )}
                </ul>
              )
            )}
            {proposals.length > 0 && (
              <div className="su-optrow" role="group" aria-label="균등안">
                {proposals.map((p) => (
                  <button key={p.rounds} type="button" className="su-chip" onClick={() => stepRounds(p.rounds)}>
                    {p.rounds}라운드 · {v.method === 'individual' ? `모두 ${p.all}경기` : `청 ${p.blue}·백 ${p.white}경기`}
                  </button>
                ))}
                <button type="button" className="su-chip" onClick={() => setDraft({ keepUneven: true })}>
                  입력값 유지
                </button>
              </div>
            )}
          </section>
          <section className="su-sec">
            <SectionTitle icon={<Scale aria-hidden />}>규칙</SectionTitle>
            <div className="su-switches">
              <Switch label="밸런스 맞추기" description="점수 합 차이가 작은 조합을 먼저 고릅니다" checked={d.balance} disabled={loading} onCheckedChange={(on) => change({ balance: on })} />
              <Switch label="성별 조합 맞추기" description="남녀 섞인 복식은 상대도 섞인 복식으로" checked={d.gender} disabled={loading} onCheckedChange={(on) => change({ gender: on })} />
            </div>
          </section>
          {!hasGames && (
            <button type="button" className="su-gen" disabled={loading || k <= 0 || !!roundsErr} aria-busy={generating || undefined} onClick={() => void generate()} data-testid="su-generate">
              <Shuffle aria-hidden />
              {generating ? '대진 만드는 중…' : '대진 생성'}
            </button>
          )}
        </>
      )}
      {generating && <StateView kind="loading" rows={4} label="대진을 만드는 중" className="px-0" />}
      {!generating && hasGames && (
        <>
          <section className="su-sec" aria-label="대진 요약">
            <div className="su-stats">
              <div className="su-stat">
                <b>{saved.length}경기</b>
                <span>
                  {roundCount}라운드 · 코트 {courts}
                </span>
              </div>
              <div className="su-stat">
                <b>{minN === maxN ? minN : `${minN}–${maxN}`}경기</b>
                <span>1인 경기 수</span>
              </div>
              <div className="su-stat">
                <b>{relaxed}경기</b>
                <span>규칙 완화{manualN ? ` · 수동 변경 ${manualN}` : ''}</span>
              </div>
            </div>
            {ui.base !== null && roundCount !== ui.base && <p className="su-dist m-0">기준 {ui.base}라운드에서 편집됨</p>}
          </section>
          <section className="su-sec" aria-label="사람별 경기 수">
            <SectionTitle icon={<ListOrdered aria-hidden />}>사람별 경기 수</SectionTitle>
            <div className="su-counts">
              {perPerson.map(({ r, n }) => (
                <span key={r.key} className="su-cnt" data-odd={minN !== maxN && n !== minN}>
                  {r.name} {n}
                </span>
              ))}
            </div>
          </section>
        </>
      )}
      {!generating && rows.length > 0 && (
        <section className="su-sec" aria-label="대진">
          <SectionTitle
            icon={<Shuffle aria-hidden />}
            aside={
              mode === 'auto' && hasGames ? (
                <button type="button" className="su-regen" onClick={regenerate} disabled={busy}>
                  <RotateCcw aria-hidden />
                  다시 생성
                </button>
              ) : undefined
            }
          >
            대진
          </SectionTitle>
          <div className="su-rounds" data-testid="rounds">
            {roundNos.map((round) => {
              const gs = rows.filter((l) => (l.round ?? 1) === round)
              const playing = new Set(gs.filter((l) => l.saved && isComplete(l) && !l.cancelled).flatMap(filled))
              const rest = inPlay.filter((r) => !playing.has(r.key))
              const blueIn = inPlay.filter((r) => r.team === 'blue' && playing.has(r.key)).length
              const whiteIn = inPlay.filter((r) => r.team === 'white' && playing.has(r.key)).length
              const isFolded = folded.has(round)
              const unsaved = !gs.some((l) => l.saved)
              return (
                <RoundSection
                  key={round}
                  id={`rh-${round}`}
                  round={round}
                  phase="edit"
                  caption={v.method === 'individual' ? `코트 ${gs.length}/${courts} · 출전 ${playing.size} · ` : `코트 ${gs.length}/${courts} · 청 ${blueIn}·백 ${whiteIn} · `}
                  restLabel={`휴식 ${rest.length}`}
                  restNames={rest.map((r) => (v.method === 'team' ? `${r.team === 'blue' ? '청' : '백'} ${r.name}` : r.name))}
                  restOpen={restOpen.has(round)}
                  onRest={() => setRestOpen((s) => toggle(s, round))}
                  folded={isFolded}
                  onFold={() => setFolded((s) => toggle(s, round))}
                  tags={
                    <>
                      {unsaved && (
                        <span className="su-badge" data-tone="pending" data-cmp="CMP-005">
                          저장 전
                        </span>
                      )}
                      {isFolded && gs.some((l) => !isComplete(l)) && (
                        <span className="su-badge" data-tone="warning" data-cmp="CMP-005">
                          빈 자리 있음
                        </span>
                      )}
                    </>
                  }
                >
                  <ol className="su-round-list">
                    {gs.map((l) => (
                      <EditGameCard
                        key={l.id}
                        l={l}
                        v={v}
                        gameNo={l.srv ?? undefined}
                        label={
                          <>
                            코트 {l.court}
                            <small> · {l.no}경기</small>
                          </>
                        }
                        ariaLabel={`${round}라운드 코트 ${l.court}, ${l.no}경기`}
                        busy={cardBusy === l.id}
                        locked={busy}
                        onSlot={(side, idx) => {
                          setSheetErr(null)
                          setSheet({ id: l.id, side, idx })
                        }}
                        onMove={l.saved && isComplete(l) ? () => { setMoveErr(null); setMove(l.id) } : undefined}
                        onDelete={() => (l.saved ? setAsk({ kind: 'delete', id: l.id }) : removePartial(l.id))}
                      />
                    ))}
                  </ol>
                  {gs.length < courts && !atMax && (
                    <button type="button" className="su-add" data-size="sm" disabled={busy} onClick={() => addGame(round)}>
                      <Plus aria-hidden />
                      코트 {gs.length + 1}에 경기 추가
                    </button>
                  )}
                </RoundSection>
              )
            })}
          </div>
          <button type="button" className="su-add" disabled={busy || atMax} aria-describedby={atMax ? 'max-reason' : undefined} onClick={() => addGame(lastRound + 1)}>
            <ListPlus aria-hidden />
            라운드 추가
          </button>
          {atMax && (
            <p id="max-reason" className="su-dist m-0">
              <AlertTriangle aria-hidden className="mr-1 inline size-3.5" />
              경기는 {MAX_GAMES}개까지 만들 수 있습니다
            </p>
          )}
        </section>
      )}
      {!generating && mode === 'manual' && rows.length === 0 && (
        <div className="su-empty" data-cmp="CMP-027" role="status">
          <ListPlus aria-hidden />
          <p className="m-0 font-bold">경기가 없습니다</p>
          <p className="su-dist m-0">라운드를 추가하거나 자동 생성해 주세요</p>
          <button type="button" className="su-add" onClick={() => addGame(1)}>
            <ListPlus aria-hidden />
            라운드 추가
          </button>
        </div>
      )}
    </SetupFrame>
  )
}

const range = (r?: { min: number; max: number }) => (!r ? '0' : r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`)

/** 저장된 경기와 미완성 경기를 라운드 → 코트 순으로 늘어놓고 화면 번호·코트를 매김(서버 번호는 srv에 보관, D10) */
function arrange(saved: Lineup[], partials: Lineup[]): Row[] {
  const all: Row[] = [...saved.map((l) => ({ ...l, srv: l.no })), ...partials.map((l) => ({ ...l, srv: null }))]
  const courtOf = new Map<string, number>()
  const used = new Map<number, number>()
  for (const l of saved) used.set(l.round ?? 1, Math.max(used.get(l.round ?? 1) ?? 0, l.court ?? 0))
  for (const l of partials) {
    const rd = l.round ?? 1
    const next = (used.get(rd) ?? 0) + 1
    used.set(rd, next)
    courtOf.set(l.id, next)
  }
  const sorted = all
    .map((l) => (l.saved ? l : { ...l, court: courtOf.get(l.id) ?? 1 }))
    .sort((a, b) => (a.round ?? 1) - (b.round ?? 1) || (a.court ?? 0) - (b.court ?? 0))
  return sorted.map((l, i) => ({ ...l, no: i + 1 }))
}
