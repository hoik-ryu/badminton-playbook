import { cn } from 'cn'
import { useState } from 'react'

import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NoticeBox } from '../../components/NoticeBox'
import { Sheet } from '../../components/Sheet'
import { isApiError } from '../../lib/api'
import { waGwa } from '../../lib/josa'
import { candidatesFor, CLUB_ERRORS, swapClub, TEAM_LABEL, type Candidate, type ClubMatchView, type Person } from './api'

// SCR-225 선수 교체(청백전). US-015·022, FLOW-005-S3·S3a·S3d·S6b, AC-043·064·077·079, UXD-040·043
// - 후보: 경기 수 적은 순(같으면 이름순) — 이름·팀·이 청백전 경기 수·교체 후 예상 실력차(CMP-044). 팀전은 같은 팀만
// - 비활성 사유(포커스 가능): 같은 경기 중복, 같은 4명·같은 팀 구성
// - 후보 누르기 → 경기 수 차이가 2 이상이면 경고 확인 창, 아니면 바로 교체. 확정 후 교체면 회원 화면 수정 표시(서버)
// - ST3 "바꿀 수 있는 사람이 없습니다" / ST4 저장 실패, 대진 그대로 / ST6 충돌 → 시트 닫고 최신 상태
// - 모바일·PC 모두 하단 시트(PC 가운데 480). 결과가 기록된 경기에서는 열리지 않음
type Props = { view: ClubMatchView; gameNo: number; target: Person; onClose: () => void; onDone: (view: ClubMatchView) => void; onConflict: () => void }
// 서버 문구를 그대로 보여 주는 오류: 결과 기록됨(locked)·같은 대진(same_matchup, P-4)·대상 아님(not_eligible, P-5)
const SHOWN = new Set<string>([CLUB_ERRORS.locked, CLUB_ERRORS.sameMatchup, CLUB_ERRORS.notEligible])

export function ClubSwapSheet({ view, gameNo, target, onClose, onDone, onConflict }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState<Candidate | null>(null)
  const list = candidatesFor(view, gameNo, target.key)
  const targetTeam = view.rows.find((r) => r.key === target.key)?.team

  const swap = async (c: Candidate) => {
    setBusy(true)
    setFailed(null)
    try {
      const next = await swapClub(view.id, view.version, gameNo, target.key, c.person.key)
      onClose() // 닫기 먼저(시트는 key=version으로 다시 마운트됨)
      onDone(next)
    } catch (e) {
      if (isApiError(e) && e.code === CLUB_ERRORS.conflict) {
        onClose()
        onConflict()
      } else setFailed(isApiError(e) && SHOWN.has(e.code) ? e.message : '교체하지 못했습니다. 대진은 그대로입니다')
    } finally {
      setBusy(false)
    }
  }
  const pick = (c: Candidate) => {
    if (c.disabledReason) return
    if (c.diffAfter >= 2) setWarn(c)
    else void swap(c)
  }

  const who = `${target.name}${view.method === 'team' && targetTeam ? `(${TEAM_LABEL[targetTeam]})` : ''}`
  return (
    <>
      <Sheet open title={`${gameNo}경기 ${who}${waGwa(target.name).slice(target.name.length)} 바꿀 사람`} onRequestClose={onClose} desktop="bottom" testId="club-swap-sheet">
        <div data-scr="SCR-225" data-st={failed ? 'SCR-225-ST4' : list.length === 0 ? 'SCR-225-ST3' : 'SCR-225-ST1'} className="flex flex-col gap-2">
          {failed && <NoticeBox tone="danger">{failed}</NoticeBox>}
          {list.length === 0 ? (
            <p className="m-0 py-6 text-center text-body text-ink-muted">바꿀 수 있는 사람이 없습니다</p>
          ) : (
            <>
              <p className="m-0 text-caption font-bold text-ink-muted">경기 수 적은 순</p>
              <ul data-cmp="CMP-044" className="m-0 list-none p-0">
                {list.map((c) => (
                  <li key={c.person.key}>
                    <button
                      type="button"
                      aria-disabled={c.disabledReason ? true : undefined}
                      disabled={busy}
                      onClick={() => pick(c)}
                      className={cn('flex min-h-14 w-full flex-col items-start justify-center gap-1 border-b border-line py-2 text-left text-body', c.disabledReason ? 'cursor-not-allowed text-ink-disabled' : 'text-ink active:bg-surface')}
                    >
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-bold">{c.person.name}</span>
                        {c.team && <span>{TEAM_LABEL[c.team]}</span>}
                        <span className="tabular-nums">· {c.games}경기</span>
                        <span className={c.disabledReason ? '' : 'text-ink-muted'}>· {c.gapAfter === null ? '실력차 계산 불가' : `실력차 ${c.gapAfter}점`}</span>
                      </span>
                      {c.disabledReason && <span className="text-caption">{c.disabledReason}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Sheet>
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
