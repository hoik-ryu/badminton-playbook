import { cn } from 'cn'
import { useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router'

import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NoticeBox } from '../../components/NoticeBox'
import { Sheet } from '../../components/Sheet'
import { isApiError } from '../../lib/api'
import { matchupKey } from '../session/lineup'
import { candidatesFor, CLUB_ERRORS, excludeWithSubstitutes, SAME_MATCHUP_REASON, TEAM_LABEL, type Candidate, type ClubMatchView } from './api'
import { substituteDecision } from './schedule'

// SCR-226 대체 선수 지정(SCR-224 위 두 번째 시트). US-015, FLOW-005-S7, AC-078, UXD-040·048
// - 결과 없는 남은 경기마다 대체 후보(경기 수 적은 참가자 추천, 팀전은 같은 팀) — 추천 1순위 미리 선택, 행 단위 버튼으로 후보 목록 열기
// - '반영' → 제외와 모든 남은 경기 교체를 한 번에 저장(회원 화면 '대진이 수정되었습니다'). 모든 경기 필수 "대체 선수를 모두 골라 주세요"
// - 반영하지 않고 닫기 → 확인 창 "대체 선수를 정하지 않으면 제외가 취소됩니다"(제외 자체를 되돌림 — 저장 전이라 서버는 그대로)
// - ST3 남은 경기 없음 "남은 경기가 없습니다. 이후 대진에서만 제외됩니다" + '확인' / ST4 미선택·저장 실패 / ST6 충돌 → 최신 남은 경기로 다시 표시
// - I3-d P-4-b: 같은 4명·같은 팀 구성 판정은 다른 경기의 대체까지 반영한 최종 대진 기준(서버와 같은 substituteDecision).
//   그 경기에 중복 없는 후보가 하나도 없을 때만 중복 후보를 고를 수 있고(서버가 다시 확인, 사유 '대체 후보 없음'),
//   대체할 사람이 아무도 없는 경기가 있으면 반영할 수 없음(ST4, 서버 422 no_substitute와 같은 안내).
//   ST7(D-9 사용자 결정): 중복 후보만 고를 수 있는 경기가 있음. 승인 UX 명세 미반영 → deviation ledger
// - (B17, r11·r12 UXD-112·AC-159) 라운드 기반: 행에 'n라운드 코트 m', 후보는 그 라운드에 출전하지 않는 사람(같은 라운드 다른 경기 출전자 제외, 취소 경기는 출전 아님).
//   후보가 없는 경기(ST8)는 사유 + '이 경기 취소' 체크(CMP-008). 모두 체크해야 '반영'. 반영하면 제외·대체·취소를 한 번에(서버 cancel).
//   서버 거절: no_substitute → 해당 행 강조 + 같은 안내, cancel_not_allowed·round_conflict → 위쪽 안내 상자. 선택은 그대로라 다시 '반영'할 수 있음.
//   취소한 경기는 되돌리지 않음(r12, 복원 없음). 라운드 정보 없는 청백전은 기존 그대로(ST4 처리 불가 포함)
type Props = { view: ClubMatchView; leaverKey: string; onClose: () => void; onDone: (view: ClubMatchView) => void; onConflict: () => void }
type Option = Candidate & { forced: boolean }
type Seats = [[string, string], [string, string]]
const FORCED_NOTE = '다른 후보가 없어 고를 수 있습니다'
const NO_SUBSTITUTE = '대체할 수 있는 선수가 없는 경기가 있어 중도 귀가를 처리할 수 없습니다'
const CONFIRM_CANCEL = '대체할 사람이 없는 경기를 취소할지 확인해 주세요'

export function SubstituteSheet({ view, leaverKey, onClose, onDone, onConflict }: Props) {
  const leaver = view.rows.find((r) => r.key === leaverKey)
  const rounds = view.courtCount != null
  const live = useMemo(() => view.games.filter((g) => g.cancelled === null), [view])
  const remaining = useMemo(() => live.filter((g) => !g.winner && [...g.team1, ...g.team2].some((p) => p.key === leaverKey)), [live, leaverKey])
  const seats = useMemo(() => new Map(live.map((g) => [g.no, [[g.team1[0]!.key, g.team1[1]!.key], [g.team2[0]!.key, g.team2[1]!.key]] as Seats])), [live])
  // (B17) 그 경기 라운드의 다른 (취소 안 된) 경기 출전자 — 서버 _round_busy와 같음
  const busyOf = (no: number) => {
    const g = live.find((x) => x.no === no)
    if (!rounds || !g) return new Set<string>()
    return new Set(live.filter((x) => x.no !== no && x.round === g.round).flatMap((x) => [...x.team1, ...x.team2].map((p) => p.key)))
  }
  // 이 경기를 뺀 다른 경기들의 최종 대진(다른 경기 대체 반영)
  const otherKeys = (no: number, picks: Record<number, string>) => {
    const out = new Set<string>()
    for (const [o, [t1, t2]] of seats) {
      if (o === no) continue
      const to = picks[o]
      const sub = (t: [string, string]) => t.map((k) => (to && k === leaverKey ? to : k))
      out.add(matchupKey(sub(t1), sub(t2)))
    }
    return out
  }
  const countsExcept = (no: number, picks: Record<number, string>) => {
    const m = new Map<string, number>()
    for (const [k, v] of Object.entries(picks)) if (Number(k) !== no) m.set(v, (m.get(v) ?? 0) + 1)
    return m
  }
  const optionsFor = (no: number, picks: Record<number, string>): Option[] => {
    const busy = busyOf(no)
    const list = candidatesFor(view, no, leaverKey, { exclude: [leaverKey], extraCounts: countsExcept(no, picks), otherKeys: otherKeys(no, picks) }).filter((c) => !busy.has(c.person.key))
    const fresh = list.some((c) => !c.inGame && !c.sameMatchup)
    return list.map((c) => (c.sameMatchup && !fresh ? { ...c, disabledReason: null, forced: true } : { ...c, forced: false }))
  }
  // 추천: 경기 수 적은 참가자부터, 앞 경기 배정을 반영해 차례로(중복 없는 후보 우선)
  // (시트는 view.version이 바뀌면 다시 열리므로 처음 한 번만 계산)
  const [picks, setPicks] = useState<Record<number, string>>(() => {
    const pick: Record<number, string> = {}
    for (const g of remaining) {
      const c = optionsFor(g.no, pick).find((x) => !x.disabledReason)
      if (c) pick[g.no] = c.person.key
    }
    return pick
  })
  const [openNo, setOpenNo] = useState<number | null>(null)
  const [missing, setMissing] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cancels, setCancels] = useState<Set<number>>(() => new Set())
  const [flagged, setFlagged] = useState<number[]>([]) // 서버 no_substitute가 가리킨 경기
  const leaving = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !leaving.current && (currentLocation.state as { sheet?: string } | null)?.sheet !== (nextLocation.state as { sheet?: string } | null)?.sheet)

  const stuck = remaining.filter((g) => !optionsFor(g.no, picks).some((c) => !c.inGame)).map((g) => g.no)
  // ST7(D-9): 중복되지 않는 대체 후보가 모두 소진되어 중복 후보만 고를 수 있는 경기가 있음. 대체 후보 자체가 없으면 ST4(stuck)
  const exhausted = remaining.filter((g) => optionsFor(g.no, picks).some((c) => c.forced)).map((g) => g.no)
  // 고른 조합 전체 판정(서버와 같음): 피할 수 있는 중복이 남아 있으면 반영 전에 알려 줌
  const decision = substituteDecision(seats, leaverKey, new Map(Object.entries(picks).map(([k, v]) => [Number(k), v])), (no) => optionsFor(no, picks).filter((c) => !c.inGame).map((c) => c.person.key))

  // (B17, ST8) 라운드 기반: 대체 불가 경기는 체크로 취소 확인. 기존 청백전은 처리 불가(ST4)
  const unchecked = rounds ? stuck.filter((no) => !cancels.has(no)) : []
  const blocked = rounds ? unchecked.length > 0 : stuck.length > 0
  const subs = remaining.filter((g) => !(rounds && stuck.includes(g.no)))

  const apply = async () => {
    if (blocked) return
    if (subs.some((g) => !picks[g.no])) return setMissing(true)
    if (decision.avoidable.length) return setFailed(`${decision.avoidable.join('·')}경기: ${SAME_MATCHUP_REASON}. 다른 대체 선수를 골라 주세요`)
    setSaving(true)
    setFailed(null)
    setFlagged([])
    try {
      const cancel = rounds ? stuck.filter((no) => cancels.has(no)) : []
      const next = await excludeWithSubstitutes(view.id, view.version, leaverKey, subs.map((g) => ({ gameNo: g.no, to: picks[g.no]! })), cancel)
      leaving.current = true
      onClose()
      onDone(next)
    } catch (e) {
      if (isApiError(e) && e.code === CLUB_ERRORS.conflict) onConflict()
      else if (isApiError(e) && e.code === CLUB_ERRORS.noSubstitute) {
        const games = (e.details as { games?: number[] } | null)?.games ?? []
        setFlagged(games)
        setFailed(rounds ? CONFIRM_CANCEL : e.message)
      } else if (isApiError(e) && (e.code === CLUB_ERRORS.sameMatchup || e.code === CLUB_ERRORS.notEligible || e.code === CLUB_ERRORS.cancelNotAllowed || e.code === CLUB_ERRORS.roundConflict)) setFailed(e.message)
      else setFailed('반영하지 못했습니다. 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  const name = (key: string) => view.rows.find((r) => r.key === key)?.name ?? ''

  return (
    <>
      <Sheet
        open
        title={remaining.length ? `${leaver?.name ?? ''}의 남은 경기 ${remaining.length}개` : `${leaver?.name ?? ''} 이후 대진에서 제외`}
        onRequestClose={onClose}
        testId="substitute-sheet"
        footer={
          remaining.length ? (
            <div className="flex w-full flex-col gap-1">
              {rounds && blocked && (
                <p id="sub-why" className="m-0 text-caption text-ink-muted">
                  {CONFIRM_CANCEL}
                </p>
              )}
              <Button fullWidth loading={saving} disabled={blocked} aria-describedby={rounds && blocked ? 'sub-why' : undefined} onClick={() => void apply()}>
                반영
              </Button>
            </div>
          ) : (
            <Button fullWidth loading={saving} onClick={() => void apply()}>
              확인
            </Button>
          )
        }
      >
        <div data-scr="SCR-226" data-st={missing || failed || (!rounds && stuck.length) ? 'SCR-226-ST4' : rounds && stuck.length ? 'SCR-226-ST8' : remaining.length === 0 ? 'SCR-226-ST3' : exhausted.length ? 'SCR-226-ST7' : 'SCR-226-ST1'} className="flex flex-col gap-2">
          {!rounds && stuck.length > 0 && <NoticeBox tone="danger">{`${NO_SUBSTITUTE}(${stuck.join('·')}경기)`}</NoticeBox>}
          {stuck.length === 0 && exhausted.length > 0 && <NoticeBox tone="warning">{`${exhausted.join('·')}경기: 대체 후보 소진. 같은 4명·같은 팀 구성이 되는 후보만 고를 수 있습니다`}</NoticeBox>}
          {failed && <NoticeBox tone="danger">{failed}</NoticeBox>}
          {missing && <NoticeBox tone="danger">대체 선수를 모두 골라 주세요</NoticeBox>}
          {remaining.length === 0 && <p className="m-0 py-4 text-body text-ink">남은 경기가 없습니다. 이후 대진에서만 제외됩니다</p>}
          <ul className="m-0 list-none p-0">
            {remaining.map((g) => {
              const chosen = picks[g.no]
              const cands = optionsFor(g.no, picks)
              const chosenForced = cands.find((c) => c.person.key === chosen)?.forced
              const where = rounds && g.round != null ? `${g.round}라운드 코트 ${g.court}` : null
              if (rounds && stuck.includes(g.no)) {
                // (ST8) 대체 불가: 팀전에서 같은 팀 사람이 아예 없으면 팀 사유, 아니면 라운드 사유
                const sameTeamLeft = view.rows.some((r) => r.participating && !r.left && r.available && r.key !== leaverKey && (view.method === 'individual' || r.team === leaver?.team) && ![...g.team1, ...g.team2].some((p) => p.key === r.key))
                const why = view.method === 'team' && !sameTeamLeft ? '같은 팀에 남은 사람이 없음' : '이 라운드 참가자가 모두 출전 중'
                const hot = flagged.includes(g.no) || (failed !== null && !cancels.has(g.no))
                return (
                  <li key={g.no} data-cmp="CMP-030" data-stuck="true" className={cn('border-b border-line py-1', hot && 'rounded-sm bg-danger-bg px-2')}>
                    <div className="flex min-h-11 flex-wrap items-center gap-x-2 text-body text-ink">
                      <span className="font-bold">{g.no}경기</span>
                      {where && <span className="text-caption text-ink-muted">· {where}</span>}
                      {leaver?.team && <span className="text-ink-muted">({TEAM_LABEL[leaver.team]})</span>}
                    </div>
                    <p className="m-0 text-caption text-ink-muted">대체할 사람이 없음 — {why}</p>
                    <Checkbox
                      checked={cancels.has(g.no)}
                      onChange={(on) => {
                        setCancels((c) => {
                          const n = new Set(c)
                          if (on) n.add(g.no)
                          else n.delete(g.no)
                          return n
                        })
                        setFlagged((f) => f.filter((x) => x !== g.no))
                      }}
                      label="이 경기 취소"
                      ariaLabel={`${g.no}경기 취소, 대체할 사람이 없음`}
                    />
                  </li>
                )
              }
              return (
                <li key={g.no} data-cmp="CMP-030" className="border-b border-line">
                  <button
                    type="button"
                    aria-expanded={openNo === g.no}
                    aria-label={where ? `${g.no}경기, ${where}, 대체: ${chosen ? name(chosen) : '고르기'}` : undefined}
                    onClick={() => setOpenNo(openNo === g.no ? null : g.no)}
                    className={cn('flex min-h-12 w-full flex-wrap items-center gap-x-2 text-left text-body', !chosen && missing ? 'text-danger-fg' : 'text-ink')}
                  >
                    <span className="font-bold">{g.no}경기</span>
                    {where && <span className="text-caption text-ink-muted">· {where}</span>}
                    {leaver?.team && <span className="text-ink-muted">({TEAM_LABEL[leaver.team]})</span>}
                    <span className="ml-auto">대체: {chosen ? <span className="font-bold">{name(chosen)}</span> : '고르기'}</span>
                  </button>
                  {chosenForced && <p className="m-0 pb-2 text-caption text-warning-fg">{SAME_MATCHUP_REASON} · {FORCED_NOTE}</p>}
                  {openNo === g.no && (
                    <ul data-cmp="CMP-044" className="m-0 mb-2 list-none rounded-md bg-surface p-0 px-3">
                      {cands.map((c) => (
                        <li key={c.person.key}>
                          <button
                            type="button"
                            aria-disabled={c.disabledReason ? true : undefined}
                            aria-pressed={chosen === c.person.key}
                            onClick={() => {
                              if (c.disabledReason) return
                              setPicks((p) => ({ ...p, [g.no]: c.person.key }))
                              setOpenNo(null)
                            }}
                            className={cn('flex min-h-11 w-full flex-col items-start justify-center py-1 text-left text-body', c.disabledReason ? 'text-ink-disabled' : 'text-ink')}
                          >
                            <span>
                              <span className="font-bold">{c.person.name}</span> · <span className="tabular-nums">{c.games}경기</span> · {c.gapAfter === null ? '실력차 계산 불가' : `실력차 ${c.gapAfter}점`}
                            </span>
                            {c.disabledReason && <span className="text-caption">{c.disabledReason}</span>}
                            {c.forced && <span className="text-caption text-warning-fg">{SAME_MATCHUP_REASON} · {FORCED_NOTE}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </Sheet>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        title="대체 선수를 정하지 않으면 제외가 취소됩니다"
        tone="danger"
        confirmLabel="닫기"
        cancelLabel="계속 정하기"
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </>
  )
}
