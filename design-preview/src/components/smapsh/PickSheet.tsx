import { AlertTriangle, ArrowLeftRight, Ban, LoaderCircle, Plus, UserX } from 'lucide-react'
import { Sheet } from './Sheet'
import { Avatar, PersonMeta } from './Setup'
import { at, candidates, courtOf, noOf, type Cand, type Dataset, type EGame, type Target } from '../../mock/editor'
import { person } from '../../mock/setup'

// (r13) SCR-225 선수 선택·교체 시트 — UX Spec r10 02 SCR-225, UXD-102·040·103 / DD r13 VD-074·076(+ VD-025·064·068)
// 머리글(바꿀 대상, 시트 안에서 고정) → 구역 '같은 경기 맞교환'(개인전·확정 전·선수 자리) · '다른 참가자와 교체'(빈 자리면 '선수 선택')
// 행 = 참가자 설정 행(VD-064) + 오른쪽 정렬 'n경기 / 실력차 n'. 상태: 선택 가능 · 경고(배지, 고를 수 있음) · 선택 불가(흐림·사유, 구역 맨 아래)
// 확정 후(SCR-112에서 엶)는 같은 모양으로 교체 구역만. 같은 대진이 되는 후보는 선택 불가(기존 정책 그대로)

export const teamLabel = (ds: Dataset, side: 0 | 1) => (ds.kind === 'team' ? (side === 0 ? '청팀' : '백팀') : side === 0 ? '1팀' : '2팀')

function TeamTag({ ds, side }: { ds: Dataset; side: 0 | 1 }) {
  return (
    <span className="su-teamtag" data-team={ds.kind === 'team' ? (side === 0 ? 'blue' : 'white') : undefined}>
      {teamLabel(ds, side)}
    </span>
  )
}

export function PickSheet({
  ds,
  games,
  target,
  confirmed = false,
  savingId,
  error,
  onPick,
  onRetry,
  onClose,
}: {
  ds: Dataset
  games: EGame[]
  target: Target
  confirmed?: boolean
  /** 누른 행의 저장 중 표시(ST12) */
  savingId?: string
  /** 저장 실패 안내(ST4) */
  error?: boolean
  onPick?: (c: Cand) => void
  onRetry?: () => void
  onClose?: () => void
}) {
  const g = games.find((x) => x.key === target.key)!
  const no = noOf(games, g)
  // (r14) 라운드 기반: 머리글에 'n라운드 코트 m'(VD-081)
  const where = g.round ? `${g.round}라운드 코트 ${courtOf(games, g)} · ` : ''
  const me = at(g, target)
  const list = candidates(ds, games, target, confirmed)
  const swaps = list.filter((c) => c.section === 'swap')
  const reps = list.filter((c) => c.section === 'replace')
  const anyOk = list.some((c) => c.state !== 'off')
  const repOk = reps.some((c) => c.state !== 'off')
  const row = (c: Cand) => {
    const p = person(c.id)
    const off = c.state === 'off'
    const busy = savingId === c.id
    const gapText = c.gap === null ? '실력차 계산 불가' : `실력차 ${c.gap}`
    const label = off
      ? `${p.name}, 선택할 수 없음: ${c.reason}`
      : `${p.name}, ${p.gender} ${p.grade} ${p.score ?? '점수 미설정'}${p.score === null ? '' : '점'}, ${c.games}경기, ${c.section === 'swap' ? '맞바꾸면' : '바꾸면'} ${gapText}${c.warns.length ? `, 경고: ${c.warns.join(', ')}` : ''}`
    return (
      <li key={`${c.section}-${c.id}`}>
        <button
          type="button"
          className="su-row su-pick"
          data-cmp="CMP-044"
          data-state={c.state}
          data-busy={busy || undefined}
          aria-disabled={off || !!savingId || undefined}
          aria-label={label}
          onClick={() => !off && !savingId && onPick?.(c)}
        >
          <Avatar name={p.name} />
          <span className="su-who">
            <span className="su-name" data-bold="true">{p.name}</span>
            {off ? (
              <span className="su-meta su-off-reason">
                <Ban aria-hidden />
                {c.reason}
              </span>
            ) : (
              <span className="su-meta su-meta-line">
                <span className="su-meta-text">{`${p.gender} · ${p.grade} · ${p.score === null ? '점수 미설정' : `${p.score}점`}`}</span>
                {c.warns.map((w) => (
                  <span key={w} className="su-badge" data-tone="warning" data-cmp="CMP-005">
                    {w.startsWith('경기 수 차이') ? '경기 수 차이 2' : w}
                  </span>
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
    <Sheet title={me ? '선수 바꾸기' : '빈 자리 채우기'} height="70%" testId="sheet-225" onClose={onClose}>
      <div className="su-pickhead" data-testid="pick-head">
        {me ? (
          <>
            <Avatar name={person(me).name} size="md" />
            <span className="su-who">
              <span className="su-name su-pickname">{person(me).name}</span>
              <PersonMeta p={person(me)} />
              <span className="su-pickpos">
                {where ? `${where}${no}경기` : `${no}경기 출전`} · <TeamTag ds={ds} side={target.side} />
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="su-avatar su-slotdot" data-size="md" aria-hidden>
              <Plus />
            </span>
            <span className="su-who">
              <span className="su-name su-pickname">{no}경기 빈 자리</span>
              {where && <span className="su-pickpos">{where.replace(/ · $/, '')}</span>}
              <span className="su-pickpos">
                <TeamTag ds={ds} side={target.side} /> 자리에 들어갈 사람을 고릅니다
              </span>
            </span>
          </>
        )}
      </div>
      {error && (
        <div className="su-note" data-tone="danger" role="alert" data-cmp="CMP-023" style={{ marginTop: 12 }}>
          <AlertTriangle aria-hidden />
          <span>변경을 저장하지 못했습니다. 연결이 불안정합니다</span>
          <button type="button" className="su-link" onClick={onRetry}>
            다시 시도
          </button>
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
          {anyOk && !repOk && <p className="su-dist" style={{ margin: 0 }}>다른 참가자가 없습니다</p>}
          <ul className="su-list">{reps.map(row)}</ul>
        </section>
      )}
    </Sheet>
  )
}

