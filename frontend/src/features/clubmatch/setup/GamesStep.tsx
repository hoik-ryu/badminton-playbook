import { ArrowLeftRight, ArrowUpDown, ListOrdered, ListPlus, LoaderCircle, Plus, RotateCcw, Scale, Shuffle, Trash2, UserRoundPen } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Avatar } from '../../../components/Avatar'
import { Badge } from '../../../components/Badge'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { NoticeBox } from '../../../components/NoticeBox'
import { StateView } from '../../../components/StateView'
import { StepActionBar } from '../../../components/StepActionBar'
import { Switch } from '../../../components/Switch'
import { TextField } from '../../../components/TextField'
import { isApiError } from '../../../lib/api'
import { addClubGame, CLUB_ERRORS, deleteClubGame, discardClubGames, exchangeClubGame, generateClub, setSettings, swapClub, type ClubMatchView } from '../api'
import { PickSheet } from '../ClubSwapSheet'
import { distribution, evenProposals, gap } from '../schedule'
import { MethodTiles, SectionTitle } from './parts'
import { RoundGamesStep } from './RoundGamesStep'
import { filled, gameCounts, isComplete, lineupKey, lineupsOf, slotOf, teamLabelOf, type Lineup, type PickCandidate, type PickTarget } from './pick'
import { SetupFrame } from './SetupFrame'
import { participantsOf } from './steps'
import type { StepProps } from './types'
import type { GamesDraft, GamesUi } from './useSetup'

// SCR-244 청백전 생성 · 대진 설정 — UX Spec r10 02 SCR-244(UXD-100–104·096·071·007·098·099), DD r13 VD-071–073·076(+VD-066), Preview r9
// - 대진 구성 방식(팀 구성 방식 타일 재사용, 저장 안 함): 대진이 없으면 '자동 생성', 다시 들어오면 선택 없음. '자동 생성'일 때만 설정
// - 공통 대진 편집기: 저장된 경기 + 화면에만 있는 미완성 경기. 경기 추가(빈 자리 4개 + 첫 빈 자리 시트), 빈 자리·선수 → SCR-225 시트,
//   경기 삭제(완성 경기는 확인 창), 편집 동작마다 바로 저장(C-35), 실패하면 동작 전 상태 + '다시 시도', 충돌은 페이지 충돌 창(UXD-010)
// - 확인 창: 대진 폐기(ST8) · 편집 후 다시 생성(ST14) · 직접 구성 전환(ST15) · 완성 경기 삭제(ST16). 이탈 확인(ST17)은 페이지(ClubMatchSetupPage)
const SHOWN_ERRORS = new Set<string>([CLUB_ERRORS.unscored, CLUB_ERRORS.minPlayers, CLUB_ERRORS.unassigned])
const SHEET_SHOWN = new Set<string>([CLUB_ERRORS.duplicatePlayer, CLUB_ERRORS.teamViolation, CLUB_ERRORS.notEligible, CLUB_ERRORS.notTwoVsTwo, CLUB_ERRORS.maxGames, CLUB_ERRORS.locked])
type Pending = { patch: Partial<GamesDraft>; label: string }
type Ask = { kind: 'regen' } | { kind: 'manual' } | { kind: 'delete'; no: number }
type Busy = { key: string } | null

/** (r14) 라운드 기반 청백전(코트 수 있음)은 라운드 편집(RoundGamesStep), 라운드 정보 없는 청백전은 기존 편집기 */
export function GamesStep(props: StepProps) {
  return props.c.view?.courtCount != null ? <RoundGamesStep {...props} /> : <LegacyGamesStep {...props} />
}

function LegacyGamesStep({ c, frame, go }: StepProps) {
  const v = c.view!
  const d = c.drafts.games
  const ui = c.drafts.gamesUi
  const [countText, setCountText] = useState(d.totalGames)
  const [pending, setPending] = useState<Pending | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [generating, setGenerating] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [sheet, setSheet] = useState<PickTarget | null>(null)
  const [sheetBusy, setSheetBusy] = useState<Busy>(null)
  const [sheetErr, setSheetErr] = useState<{ message: string; retry: () => void } | null>(null)
  const [countAsk, setCountAsk] = useState<PickCandidate | null>(null)
  const [cardBusy, setCardBusy] = useState<number | null>(null)

  const saved = lineupsOf(v)
  const partials = ui.partials.map((l, i) => ({ ...l, no: saved.length + i + 1 }))
  const lineups: Lineup[] = [...saved, ...partials]
  const hasGames = saved.length > 0
  const mode: GamesUi['mode'] = ui.mode ?? (!hasGames && !partials.length ? 'auto' : null)
  const count = Number(d.totalGames)
  const countError = !Number.isInteger(count) || count < 1 ? '경기 수를 1 이상으로 입력해 주세요' : undefined

  const inPlay = participantsOf(v).filter((r) => v.method === 'individual' || r.team)
  const sizes = { all: inPlay.length, blue: inPlay.filter((r) => r.team === 'blue').length, white: inPlay.filter((r) => r.team === 'white').length }
  const dist = countError ? null : distribution(v.method, sizes, count)
  const even = countError ? [] : evenProposals(v.method, sizes, count)
  const uneven = !!dist && !dist.even

  const setDraft = (patch: Partial<GamesDraft>) => c.setDrafts((x) => ({ ...x, games: { ...x.games, ...patch } }))
  const setUi = (patch: Partial<GamesUi> | ((u: GamesUi) => Partial<GamesUi>)) => c.setDrafts((x) => ({ ...x, gamesUi: { ...x.gamesUi, ...(typeof patch === 'function' ? patch(x.gamesUi) : patch) } }))
  /** 설정 변경: 대진이 있으면 확인(ST8) 후 즉시 저장+폐기, 없으면 화면 입력 */
  const change = (patch: Partial<GamesDraft>, label: string) => {
    if (hasGames) setPending({ patch, label })
    else setDraft(patch)
  }
  const applyNow = async (patch: Partial<GamesDraft>) => {
    const next = { ...d, ...patch }
    const settings = { totalGames: Number(next.totalGames), rules: { balance: next.balance, gender: next.gender } }
    const r = await c.save(
      () => setSettings(v.id, v.version, settings, true),
      (x) => x.totalGames === settings.totalGames && x.rules.balance === settings.rules.balance && x.rules.gender === settings.rules.gender && x.games.length === 0,
      () => void applyNow(patch),
    )
    if (r.kind === 'ok') {
      c.accept(r.view, { games: true })
      setUi({ base: null, edited: false })
      setCountText(String(r.view.totalGames))
    } else if (r.kind === 'failed') c.setFailure({ message: '설정을 저장하지 못했습니다. 대진은 그대로입니다', retry: () => void applyNow(patch) })
  }

  const generate = async (discard = false) => {
    if (countError) return
    setRefused(null)
    setGenerating(true)
    const settings = { totalGames: count, rules: { balance: d.balance, gender: d.gender } }
    const before = v.games
    const r = await c.save(
      () => generateClub(v.id, v.version, settings, discard),
      (x) => x.games.length > 0 && x.games !== before,
      () => void generate(discard),
    )
    setGenerating(false)
    if (r.kind === 'ok') {
      c.accept(r.view, { games: true })
      setUi({ mode: 'auto', base: r.view.games.length, edited: false })
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
    } else if (r.kind === 'failed') c.setFailure({ message: '대진을 비우지 못했습니다. 대진은 그대로입니다', retry: () => void toManual() })
  }

  const addGame = () => {
    const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setUi((u) => ({ partials: [...u.partials, { id, no: 0, t1: [null, null], t2: [null, null], saved: false }] }))
    setSheetErr(null)
    setSheet({ id, side: 0, idx: 0 })
  }
  const removePartial = (id: string) => setUi((u) => ({ partials: u.partials.filter((x) => x.id !== id) }))

  const doDelete = async (no: number) => {
    setCardBusy(no)
    const before = v.games.length
    const gone = saved.find((l) => l.no === no)
    // 응답을 잃은 재시도 판정: 지우려던 그 경기(같은 4명·같은 조)가 최신 대진에 없고 경기 수가 하나 줄었을 때만 반영된 것으로 봄
    const r = await c.save(
      () => deleteClubGame(v.id, v.version, no),
      (x) => x.games.length === before - 1 && !!gone && !lineupsOf(x).some((l) => lineupKey(l) === lineupKey(gone)),
      () => void doDelete(no),
    )
    setCardBusy(null)
    if (r.kind === 'ok') {
      c.accept(r.view)
      setUi((u) => ({ edited: true, mode: r.view.games.length === 0 && !u.partials.length ? 'manual' : u.mode }))
    } else if (r.kind === 'failed') c.setFailure({ message: `${no}경기를 삭제하지 못했습니다. 대진은 그대로입니다`, retry: () => void doDelete(no) })
  }

  /** 시트에서 고름: 저장된 경기는 교체·맞교환을 바로 저장, 미완성 경기는 화면에서 채우고 네 자리가 차면 경기 추가 저장 */
  const commit = async (cand: PickCandidate) => {
    const t = sheet
    if (!t) return
    const l = lineups.find((x) => x.id === t.id)
    if (!l) return
    if (!l.saved && !isComplete(cand.next)) {
      setUi((u) => ({ partials: u.partials.map((x) => (x.id === l.id ? { ...cand.next, no: 0 } : x)) }))
      setSheet(null)
      return
    }
    const me = slotOf(l, t.side, t.idx)
    setSheetBusy({ key: cand.row.key })
    setSheetErr(null)
    const attempt = (): Promise<ClubMatchView> => {
      if (!l.saved) return addClubGame(v.id, v.version, cand.next.t1 as [string, string], cand.next.t2 as [string, string])
      if (cand.section === 'swap') return exchangeClubGame(v.id, v.version, l.no, me!, cand.row.key)
      return swapClub(v.id, v.version, l.no, me!, cand.row.key)
    }
    const want = new Set(filled(cand.next))
    const r = await c.save(
      attempt,
      (x) => (l.saved ? x.games.some((g) => g.no === l.no && [...g.team1, ...g.team2].every((p) => want.has(p.key))) : x.games.length === saved.length + 1 && lineupsOf(x).some((y) => y.no === x.games.length && lineupKey(y) === lineupKey(cand.next))),
      () => void commit(cand),
    )
    setSheetBusy(null)
    if (r.kind === 'ok') {
      c.accept(r.view)
      setUi((u) => ({ edited: true, partials: l.saved ? u.partials : u.partials.filter((x) => x.id !== l.id) }))
      setSheet(null)
    } else if (r.kind === 'conflict') setSheet(null)
    else if (r.kind === 'failed') {
      const message = isApiError(r.error) && SHEET_SHOWN.has(r.error.code) ? r.error.message : '변경을 저장하지 못했습니다. 연결이 불안정합니다'
      setSheetErr({ message, retry: () => void commit(cand) })
    }
  }
  const onPick = (cand: PickCandidate) => (cand.warns.some((w) => w.startsWith('경기 수 차이')) ? setCountAsk(cand) : void commit(cand))

  const counts = gameCounts(v.rows, saved)
  const perPerson = inPlay.map((r) => ({ r, n: counts.get(r.key) ?? 0 }))
  const nums = perPerson.map((x) => x.n)
  const minN = nums.length ? Math.min(...nums) : 0
  const maxN = nums.length ? Math.max(...nums) : 0
  const relaxed = v.games.filter((g) => g.genderRelaxed || g.repeatedMatchup || g.relaxations.length > 0).length
  const manualN = v.games.filter((g) => g.relaxations.some((x) => x.reason === 'manual')).length
  const incompleteNos = partials.map((p) => p.no)

  const loading = generating || (c.saving && !pending)
  const busy = loading || cardBusy !== null || sheetBusy !== null
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
              : cardBusy !== null
                ? 'SCR-244-ST12'
                : c.failure && hasGames
                  ? 'SCR-244-ST13'
                  : c.failure || refused || (mode === 'auto' && countError)
                    ? 'SCR-244-ST4'
                    : partials.length
                      ? 'SCR-244-ST11'
                      : !hasGames && mode === 'manual'
                        ? 'SCR-244-ST10'
                        : hasGames
                          ? 'SCR-244-ST7'
                          : uneven
                            ? 'SCR-244-ST9'
                            : 'SCR-244-ST1'
  const nextReason = generating ? '대진을 먼저 만들어 주세요' : partials.length ? `${incompleteNos.join('·')}경기에 빈 자리가 있습니다` : !hasGames ? '대진이 없습니다. 경기를 추가하거나 자동 생성해 주세요' : undefined
  const onStep = (k: string) => (k === 'confirm' && nextReason ? undefined : frame.onStep(k))

  return (
    <SetupFrame
      scr="SCR-244"
      st={st}
      method={v.method}
      title="대진 설정"
      desc="자동으로 만들거나 직접 구성하고, 경기와 선수를 편집해요."
      compact
      steps={frame.steps}
      current="games"
      onStep={onStep}
      onExit={frame.onExit}
      notice={
        <>
          <p className="sr-only" aria-live="polite">{`전체 ${saved.length}경기${partials.length ? `, 빈 자리가 있는 경기 ${partials.length}개` : ''}`}</p>
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
                setCountText(d.totalGames) // 취소하면 원래 값
              }
            }}
            tone="danger"
            title="대진이 초기화됩니다"
            description="경기 수나 규칙을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다"
            confirmLabel="바꾸기"
            onConfirm={async () => {
              const p = pending
              if (p) await applyNow(p.patch)
            }}
          />
          <ConfirmDialog open={ask?.kind === 'regen'} onOpenChange={(o) => !o && setAsk(null)} tone="danger" title="편집한 대진이 사라집니다" description={`총 경기 수 ${count}으로 새로 만듭니다`} confirmLabel="다시 생성" onConfirm={() => { setAsk(null); void generate(true) }} />
          <ConfirmDialog open={ask?.kind === 'manual'} onOpenChange={(o) => !o && setAsk(null)} tone="danger" title="대진이 초기화됩니다" description="빈 대진에서 직접 구성합니다" confirmLabel="바꾸기" onConfirm={toManual} />
          <ConfirmDialog
            open={ask?.kind === 'delete'}
            onOpenChange={(o) => !o && setAsk(null)}
            tone="danger"
            title={`${ask?.kind === 'delete' ? ask.no : ''}경기를 삭제할까요?`}
            description="삭제하면 경기 번호와 경기 수가 다시 계산됩니다"
            confirmLabel="삭제"
            onConfirm={() => {
              const no = ask?.kind === 'delete' ? ask.no : 0
              setAsk(null)
              void doDelete(no)
            }}
          />
          <ConfirmDialog open={countAsk !== null} onOpenChange={(o) => !o && setCountAsk(null)} title={`경기 수 차이가 ${countAsk?.diffAfter ?? 2}가 됩니다. 그래도 바꿀까요?`} confirmLabel="바꾸기" onConfirm={() => { const x = countAsk; setCountAsk(null); if (x) void commit(x) }} />
          {sheet && lineups.some((l) => l.id === sheet.id) && (
            <PickSheet
              view={v}
              lineups={lineups}
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
            <SectionTitle icon={<ListOrdered aria-hidden />} req aside={`참가자 ${inPlay.length}명`}>
              자동 생성 기준
            </SectionTitle>
            <TextField
              className="su-namefield"
              label="총 경기 수"
              hideLabel
              inputMode="numeric"
              value={countText}
              style={{ width: 140 }}
              disabled={loading}
              error={countError && countText !== '' ? countError : countText === '' ? '경기 수를 1 이상으로 입력해 주세요' : undefined}
              onChange={(e) => {
                const t = e.target.value.replace(/\D/g, '')
                setCountText(t)
                if (!hasGames) setDraft({ totalGames: t, keepUneven: false })
              }}
              onBlur={() => {
                if (hasGames && countText !== d.totalGames && Number(countText) >= 1) change({ totalGames: countText, keepUneven: false }, '총 경기 수')
                else if (hasGames) setCountText(d.totalGames)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            />
            {dist && (
              <p className="su-dist" aria-live="polite">
                {dist.even ? (
                  <>
                    모두 <b>{dist.groups[0]?.games ?? 0}경기</b>씩 합니다
                  </>
                ) : (
                  dist.groups.map((g, i) => (
                    <span key={g.games}>
                      {i > 0 && ', '}
                      {i === 0 ? <b>{g.people}명은 {g.games}경기</b> : `${g.people}명은 ${g.games}경기`}
                    </span>
                  ))
                )}
                {!dist.even && '를 합니다'}
              </p>
            )}
            {uneven && !d.keepUneven && even.length > 0 && (
              <div className="su-optrow" role="group" aria-label="균등안">
                {even.map((p) => (
                  <button key={p.totalGames} type="button" className="su-chip" onClick={() => { setCountText(String(p.totalGames)); change({ totalGames: String(p.totalGames) }, '총 경기 수') }}>
                    {p.totalGames}경기 (1인 {p.each.blue === p.each.white ? p.each.blue : `청 ${p.each.blue}·백 ${p.each.white}`}경기)
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
              <Switch label="밸런스 맞추기" description="점수 합 차이가 작은 조합을 먼저 고릅니다" checked={d.balance} disabled={loading} onCheckedChange={(on) => change({ balance: on }, '밸런스')} />
              <Switch label="성별 조합 맞추기" description="남녀 섞인 복식은 상대도 섞인 복식으로" checked={d.gender} disabled={loading} onCheckedChange={(on) => change({ gender: on }, '성별 조합')} />
            </div>
          </section>
          {!hasGames && (
            <button type="button" className="su-gen" disabled={loading || !!countError} aria-busy={generating || undefined} onClick={() => void generate()} data-testid="su-generate">
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
                <span>총 경기 수</span>
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
            {ui.base !== null && saved.length !== ui.base && <p className="su-dist m-0">기준 {ui.base}경기에서 편집됨</p>}
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
      {!generating && lineups.length > 0 && (
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
          <ol className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {lineups.map((l) => (
              <EditGameCard
                key={l.id}
                l={l}
                v={v}
                busy={cardBusy === l.no && l.saved}
                locked={busy}
                onSlot={(side, idx) => {
                  setSheetErr(null)
                  setSheet({ id: l.id, side, idx })
                }}
                onDelete={() => (l.saved ? setAsk({ kind: 'delete', no: l.no }) : removePartial(l.id))}
              />
            ))}
          </ol>
          <button type="button" className="su-add" disabled={busy} onClick={addGame}>
            <Plus aria-hidden />
            경기 추가
          </button>
        </section>
      )}
      {!generating && mode === 'manual' && lineups.length === 0 && (
        <div className="su-empty" data-cmp="CMP-027" role="status">
          <ListPlus aria-hidden />
          <p className="m-0 font-bold">경기가 없습니다</p>
          <p className="su-dist m-0">경기를 추가하거나 자동 생성해 주세요</p>
          <button type="button" className="su-add" onClick={addGame}>
            <Plus aria-hidden />
            경기 추가
          </button>
        </div>
      )}
    </SetupFrame>
  )
}

/** 편집 경기 카드(CMP-041 phase=edit, VD-072): 기존 카드 + 머리 줄(번호·배지·실력차·삭제), 빈 자리 점선.
 * (r14, VD-080) 라운드 기반: 머리 줄 '코트 m · n경기'(label), 저장된 완성 경기에 '이동'(onMove). gameNo = 서버 경기 번호(화면 번호와 다를 수 있음) */
export function EditGameCard({ l, v, busy, locked, onSlot, onDelete, label, gameNo, onMove, ariaLabel }: { l: Lineup; v: ClubMatchView; busy: boolean; locked: boolean; onSlot: (side: 0 | 1, idx: 0 | 1) => void; onDelete: () => void; label?: ReactNode; gameNo?: number; onMove?: () => void; ariaLabel?: string }) {
  const team = v.method === 'team'
  const rows = new Map(v.rows.map((r) => [r.key, r]))
  const g = l.saved ? v.games.find((x) => x.no === (gameNo ?? l.no)) : undefined
  const empties = 4 - filled(l).length
  const score = (k: string | null) => (k ? (rows.get(k)?.score ?? null) : null)
  const gp = empties ? null : (g?.gap ?? gap(l.t1.map(score), l.t2.map(score)))
  const relax = g && (g.relaxations.length || g.genderRelaxed || g.repeatedMatchup) ? (g.relaxations.some((x) => x.reason === 'manual') ? '규칙 완화: 운영진 수동 변경' : g.repeatedMatchup ? '규칙 완화: 같은 대진 반복' : '규칙 완화: 성별 조합') : null
  const line = (side: 0 | 1) => {
    const ids = side === 0 ? l.t1 : l.t2
    const full = ids.every(Boolean)
    const tl = teamLabelOf(v, side)
    return (
      <div className="su-tl" data-team={team ? (side === 0 ? 'blue' : 'white') : undefined}>
        <b>{team ? (side === 0 ? '청' : '백') : tl}</b>
        <span className="su-players">
          {ids.map((k, i) => {
            const idx = i as 0 | 1
            const r = k ? rows.get(k) : undefined
            return k ? (
              <button key={idx} type="button" className="su-slot" disabled={locked} aria-label={`${l.no}경기 ${tl} ${r?.name ?? '선수'} 교체`} onClick={() => onSlot(side, idx)}>
                <Avatar name={r?.name ?? '?'} size="sm" />
                {r?.name ?? '선수'} <small>{r?.score ?? ''}</small>
                <ArrowLeftRight aria-hidden />
              </button>
            ) : (
              <button key={idx} type="button" className="su-slot-empty" disabled={locked} aria-label={`${l.round != null ? `${l.round}라운드 코트 ${l.court}, ` : ''}${l.no}경기 ${tl} 빈 자리 선택`} onClick={() => onSlot(side, idx)}>
                <Plus aria-hidden />
                빈 자리
              </button>
            )
          })}
        </span>
        <span className="su-sum">{full ? ids.reduce((s, k) => s + (score(k) ?? 0), 0) : ''}</span>
      </div>
    )
  }
  return (
    <li className="su-game" data-cmp="CMP-041" data-phase="edit" data-incomplete={empties > 0 || undefined} aria-busy={busy || undefined} aria-label={ariaLabel} data-testid="game-card">
      <header>
        <span className="su-gno">{label ?? `${l.no}경기`}</span>
        {empties > 0 && (
          <Badge tone="warning" className="su-badge" data-tone="warning">
            빈 자리 {empties}
          </Badge>
        )}
        {relax && (
          <Badge tone="warning" className="su-badge su-relax" data-tone="warning">
            {relax}
          </Badge>
        )}
        <small className="su-ggap">{gp === null ? '실력차 계산 불가' : `실력차 ${gp}`}</small>
        {busy ? (
          <span className="su-gbusy" role="status" aria-label={`${l.no}경기 저장 중`}>
            <LoaderCircle aria-hidden className="su-spin" />
          </span>
        ) : (
          <>
            {onMove && (
              <button type="button" className="su-gdel" aria-label={`${l.no}경기 다른 라운드로 이동`} disabled={locked} onClick={onMove} data-testid="move-btn">
                <ArrowUpDown aria-hidden />
              </button>
            )}
            <button type="button" className="su-gdel" aria-label={`${l.no}경기 삭제`} disabled={locked} onClick={onDelete}>
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
