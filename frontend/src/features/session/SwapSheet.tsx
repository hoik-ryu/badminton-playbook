import { cn } from 'cn'
import { useState } from 'react'

import { Badge } from '../../components/Badge'
import { NoticeBox } from '../../components/NoticeBox'
import { Sheet } from '../../components/Sheet'
import { isApiError } from '../../lib/api'
import { waGwa } from '../../lib/josa'
import { RELAX_LABEL, SESSION_ERRORS, swapCandidates, swapPlayers, type SessionPerson, type SessionView } from './api'

// SCR-205 선수 교체(실시간 대진, Should). US-021·022, FLOW-004-S5, AC-035·064, UXD-008·009. 확정 전(ST7)에만 열림
// - 후보: 대기자 먼저, 다음 다른 경기 선수 — 이름·성별·점수·교체 후 예상 실력차(CMP-044 sessionSwap)
// - 같은 날 같은 경기가 되는 후보는 비활성 + 사유(포커스 가능), 규칙 위반은 허용하고 경고 배지
// - 후보 누르기 → 맞바꾸고 시트 닫힘, 코트 카드 실력차 즉시 갱신 / ST3 "바꿀 수 있는 사람이 없습니다" / ST4 저장 실패, 대진 그대로
// - 모바일·PC 모두 하단 시트(PC 가운데 480)
type Props = { view: SessionView; target: SessionPerson; onClose: () => void; onSwapped: () => void; onConflict: () => void }

export function SwapSheet({ view, target, onClose, onSwapped, onConflict }: Props) {
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const list = swapCandidates(view, target.key)
  const waiting = list.filter((c) => c.from === 'waiting')
  const others = list.filter((c) => c.from !== 'waiting')

  const pick = async (key: string) => {
    if (!view.session) return
    setBusy(key)
    setFailed(false)
    try {
      await swapPlayers(view.session.id, view.session.version, target.key, key)
      onSwapped()
      onClose()
    } catch (e) {
      if (isApiError(e) && e.code === SESSION_ERRORS.conflict) {
        onClose()
        onConflict()
      } else setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  const section = (label: string, items: typeof list) =>
    items.length > 0 && (
      <section className="flex flex-col">
        <h3 className="m-0 py-2 text-caption font-bold text-ink-muted">{label}</h3>
        <ul data-cmp="CMP-044" className="m-0 list-none p-0">
          {items.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                aria-disabled={c.disabledReason ? true : undefined}
                disabled={busy !== null}
                onClick={() => !c.disabledReason && void pick(c.key)}
                className={cn('flex min-h-14 w-full flex-col items-start justify-center gap-1 border-b border-line py-2 text-left text-body', c.disabledReason ? 'cursor-not-allowed text-ink-disabled' : 'text-ink active:bg-surface')}
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {typeof c.from === 'object' && <span className="text-ink-muted">코트{c.from.court}</span>}
                  <span className="font-bold">{c.person.name}</span>
                  <span>
                    {c.person.gender}
                    <span className="font-bold tabular-nums">{c.person.score ?? '-'}</span>
                  </span>
                  <span className={c.disabledReason ? '' : 'text-ink-muted'}>· {c.gapAfter === null ? '실력차 계산 불가' : `교체 후 실력차 ${c.gapAfter}점`}</span>
                  {!c.disabledReason && c.warnings.map((w) => <Badge key={w} tone="warning">{RELAX_LABEL[w]}</Badge>)}
                </span>
                {c.disabledReason && <span className="text-caption">{c.disabledReason}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
    )

  const who = `${target.name}(${target.gender}${target.score ?? ''})`
  return (
    <Sheet open title={`${who}${waGwa(target.name).slice(target.name.length)} 바꿀 사람`} onRequestClose={onClose} testId="swap-sheet">
      <div data-scr="SCR-205" data-st={failed ? 'SCR-205-ST4' : list.length === 0 ? 'SCR-205-ST3' : 'SCR-205-ST1'} className="flex flex-col gap-2">
        {failed && <NoticeBox tone="danger">교체하지 못했습니다. 대진은 그대로입니다</NoticeBox>}
        {list.length === 0 && <p className="m-0 py-6 text-center text-body text-ink-muted">바꿀 수 있는 사람이 없습니다</p>}
        {section('대기자', waiting)}
        {section('다른 경기', others)}
      </div>
    </Sheet>
  )
}
