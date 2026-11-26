import { AlertTriangle, ArrowLeftRight, Ban, LoaderCircle, Plus, UserX } from 'lucide-react'
import { useState } from 'react'

import { Avatar } from '../../components/Avatar'
import { Badge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PersonMeta } from '../../components/PersonMeta'
import { personMetaText } from '../../lib/personMeta'
import { Sheet } from '../../components/Sheet'
import { isApiError } from '../../lib/api'
import { CLUB_ERRORS, swapClub, type ClubMatchView, type Person } from './api'
import { lineupsOf, pickCandidates, slotOf, teamLabelOf, type Lineup, type PickCandidate, type PickTarget } from './setup/pick'

// SCR-225 선수 선택·교체(청백전, 시트) — UX Spec r10 02 SCR-225(UXD-102·040·103), DD r13 VD-074·076, Preview r9
// - 머리글(바꿀 대상, 시트 안에서 고정): 선수면 아바타·이름·메타·'n경기 출전 · 팀', 빈 자리면 'n경기 빈 자리'
// - 구역: '같은 경기 맞교환'(개인전·확정 전·선수 자리) · '다른 참가자와 교체'(빈 자리면 '선수 선택')
// - 행: 참가자 설정 행(VD-064) + 오른쪽 정렬 'n경기 / 실력차 n'. 선택 가능 · 경고(배지) · 선택 불가(흐림·사유·포커스 가능)
// - 확정 후(청백전 상세에서 엶, ST7)는 같은 모양으로 교체 구역만: 같은 대진 후보 선택 불가, 경기 수 차이 2 이상은 확인 창(AC-079), 기능·권한 그대로
// - 결과가 기록된 경기에서는 열리지 않음(부모가 막음)
// - (r14, VD-081) 라운드 기반: 머리글에 'n라운드 코트 m', 같은 라운드 출전자는 선택 불가(SCR-225-ST13, pick.ts)

function TeamTag({ v, side }: { v: ClubMatchView; side: 0 | 1 }) {
  return (
    <span className="su-teamtag" data-team={v.method === 'team' ? (side === 0 ? 'blue' : 'white') : undefined}>
      {teamLabelOf(v, side)}
    </span>
  )
}

type PickSheetProps = {
  view: ClubMatchView
  lineups: Lineup[]
  target: PickTarget
  confirmed?: boolean
  /** 누른 행의 저장 중 표시(ST12) */
  busyKey?: string
  /** 저장 실패 안내(ST4, 시트는 열린 채) */
  error?: string | null
  onPick: (c: PickCandidate) => void
  onRetry?: () => void
  onClose: () => void
}

/** 시트 본체(표현): 생성 페이지 편집기(SCR-244)와 확정 후 교체(SCR-112)가 같이 씀 */
export function PickSheet({ view, lineups, target, confirmed = view.status !== 'draft', busyKey, error, onPick, onRetry, onClose }: PickSheetProps) {
  const l = lineups.find((x) => x.id === target.id)
  if (!l) return null
  const me = slotOf(l, target.side, target.idx)
  const meRow = me ? view.rows.find((r) => r.key === me) : undefined
  const list = pickCandidates(view, lineups, target, confirmed)
  const swaps = list.filter((c) => c.section === 'swap')
  const reps = list.filter((c) => c.section === 'replace')
  const anyOk = list.some((c) => c.state !== 'off')
  const repOk = reps.some((c) => c.state !== 'off')
  const roundBusy = list.some((c) => c.state === 'off' && c.reason?.startsWith('이 라운드에 이미 출전'))
  const st = error ? 'SCR-225-ST4' : busyKey ? 'SCR-225-ST12' : confirmed ? 'SCR-225-ST7' : !me ? 'SCR-225-ST9' : !anyOk ? 'SCR-225-ST3' : roundBusy ? 'SCR-225-ST13' : 'SCR-225-ST1'
  const where = l.round != null ? `${l.round}라운드 코트 ${l.court}` : null

  const row = (c: PickCandidate) => {
    const off = c.state === 'off'
    const busy = busyKey === c.row.key
    const gapText = c.gapAfter === null ? '실력차 계산 불가' : `실력차 ${c.gapAfter}`
    const label = off
      ? `${c.row.name}, 선택할 수 없음: ${c.reason}`
      : `${c.row.name}, ${personMetaText(c.row) || '정보 없음'}, ${c.games}경기, ${c.section === 'swap' ? '맞바꾸면' : '바꾸면'} ${gapText}${c.warns.length ? `, 경고: ${c.warns.join(', ')}` : ''}`
    return (
      <li key={`${c.section}-${c.row.key}`}>
        <button
          type="button"
          className="su-row su-pick"
          data-cmp="CMP-044"
          data-state={c.state}
          data-busy={busy || undefined}
          aria-disabled={off || !!busyKey || undefined}
          aria-label={label}
          onClick={() => !off && !busyKey && onPick(c)}
        >
          <Avatar name={c.row.name} />
          <span className="su-who">
            <span className="su-name" data-bold="true">
              {c.row.name}
            </span>
            {off ? (
              <span className="su-meta su-off-reason">
                <Ban aria-hidden />
                {c.reason}
              </span>
            ) : (
              <span className="su-meta su-meta-line">
                <span className="su-meta-text">{personMetaText(c.row)}</span>
                {c.warns.map((w) => (
                  <Badge key={w} tone="warning" className="su-badge" data-tone="warning">
                    {w.startsWith('경기 수 차이') ? '경기 수 차이 2' : w}
                  </Badge>
                ))}
              </span>
            )}
          </span>
          {!off && (
            <span className="su-num" aria-hidden>
              {busy ? (
                <LoaderCircle className="su-spin" />
              ) : (
                <>
                  <b>{c.games}경기</b>
                  <small>{gapText}</small>
                </>
              )}
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    <Sheet open title={me ? '선수 바꾸기' : '빈 자리 채우기'} onRequestClose={onClose} height="70%" testId="club-swap-sheet">
      <div data-scr="SCR-225" data-st={st} className="su-pickwrap">
        <div className="su-pickhead" data-testid="pick-head">
          {me ? (
            <>
              <Avatar name={meRow?.name ?? '?'} size="md" />
              <span className="su-who">
                <span className="su-name su-pickname">{meRow?.name ?? '선수'}</span>
                {meRow && <PersonMeta p={meRow} />}
                <span className="su-pickpos">
                  {where ? `${where} · ${l.no}경기` : `${l.no}경기 출전`} · <TeamTag v={view} side={target.side} />
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="su-avatar su-slotdot" data-size="md" aria-hidden>
                <Plus />
              </span>
              <span className="su-who">
                <span className="su-name su-pickname">{l.no}경기 빈 자리</span>
                {where && <span className="su-pickpos">{where}</span>}
                <span className="su-pickpos">
                  <TeamTag v={view} side={target.side} /> 자리에 들어갈 사람을 고릅니다
                </span>
              </span>
            </>
          )}
        </div>
        {error && (
          <div className="su-sheetnote" role="alert" data-cmp="CMP-023">
            <AlertTriangle aria-hidden />
            <span>{error}</span>
            {onRetry && (
              <button type="button" className="su-link" onClick={onRetry}>
                다시 시도
              </button>
            )}
          </div>
        )}
        {!anyOk && (
          <div className="su-empty" data-cmp="CMP-027" role="status">
            <UserX aria-hidden />
            <p style={{ margin: 0 }}>{me ? '바꿀 수 있는 사람이 없습니다' : '고를 수 있는 사람이 없습니다'}</p>
          </div>
        )}
        {swaps.length > 0 && (
          <section className="su-picksec" aria-labelledby="pick-swap">
            <h3 id="pick-swap" className="su-pickh">
              <ArrowLeftRight aria-hidden />
              같은 경기 맞교환
            </h3>
            <ul className="su-list">{swaps.map(row)}</ul>
          </section>
        )}
        {reps.length > 0 && (
          <section className="su-picksec" aria-labelledby="pick-rep">
            <h3 id="pick-rep" className="su-pickh">
              {me ? '다른 참가자와 교체' : '선수 선택'}
            </h3>
            {anyOk && !repOk && <p className="su-dist m-0">다른 참가자가 없습니다</p>}
            <ul className="su-list">{reps.map(row)}</ul>
          </section>
        )}
      </div>
    </Sheet>
  )
}

// ── 확정 후(청백전 상세 SCR-112) 선수 교체: 기존 진입점·기능·권한 그대로, 시각만 VD-074 ──
type Props = { view: ClubMatchView; gameNo: number; target: Person; onClose: () => void; onDone: (view: ClubMatchView) => void; onConflict: () => void }
// 서버 문구를 그대로 보여 주는 오류: 결과 기록됨(locked)·같은 대진(same_matchup, P-4)·대상 아님(not_eligible, P-5)
const SHOWN = new Set<string>([CLUB_ERRORS.locked, CLUB_ERRORS.sameMatchup, CLUB_ERRORS.notEligible])

export function ClubSwapSheet({ view, gameNo, target, onClose, onDone, onConflict }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | undefined>(undefined)
  const [warn, setWarn] = useState<PickCandidate | null>(null)
  const lineups = lineupsOf(view)
  const l = lineups.find((x) => x.no === gameNo)
  const side = l ? (l.t1.includes(target.key) ? 0 : 1) : 0
  const idx = l ? ((side === 0 ? l.t1 : l.t2).indexOf(target.key) as 0 | 1) : 0

  const swap = async (c: PickCandidate) => {
    setBusy(c.row.key)
    setFailed(null)
    try {
      const next = await swapClub(view.id, view.version, gameNo, target.key, c.row.key)
      onClose() // 닫기 먼저(시트는 key=version으로 다시 마운트됨)
      onDone(next)
    } catch (e) {
      if (isApiError(e) && e.code === CLUB_ERRORS.conflict) {
        onClose()
        onConflict()
      } else setFailed(isApiError(e) && SHOWN.has(e.code) ? e.message : '교체하지 못했습니다. 대진은 그대로입니다')
    } finally {
      setBusy(undefined)
    }
  }
  if (!l) return null
  return (
    <>
      <PickSheet
        view={view}
        lineups={lineups}
        target={{ id: l.id, side, idx: idx < 0 ? 0 : idx }}
        busyKey={busy}
        error={failed}
        onPick={(c) => (c.diffAfter >= 2 ? setWarn(c) : void swap(c))}
        onClose={onClose}
      />
      <ConfirmDialog
        open={warn !== null}
        onOpenChange={(o) => !o && setWarn(null)}
        title={`경기 수 차이가 ${warn?.diffAfter ?? 2}가 됩니다. 그래도 바꿀까요?`}
        confirmLabel="바꾸기"
        onConfirm={() => (warn ? swap(warn) : undefined)}
      />
    </>
  )
}
