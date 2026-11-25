import { useState } from 'react'
import { Link } from 'react-router'

import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { NoticeBox } from '../../components/NoticeBox'
import { SegmentedControl } from '../../components/RadioButtons'
import { StateView } from '../../components/StateView'
import { TextField } from '../../components/TextField'
import { waGwa } from '../../lib/josa'
import type { ClubMatchView, ParticipantRow } from './api'

// SCR-224 참가자 확인(확정 이후, 모바일·PC 공통 하단 시트 70%). US-015, FLOW-005-S7, AC-058·078·107, UXD-048
// (B12, UX Spec r9) 확정 전 참가자 선정·팀 구성은 생성 페이지(SCR-242·243)로 옮겨, 이 패널은 확정 이후 확인과 '이후 대진에서 제외'(→ SCR-226)만 합니다.
// - 고정 요약(CMP-028): 개인전 '참가 n명 · 남 a 여 b' / 팀전 '청 n(남a 여b) · 백 m(남c 여d)'
// - 팀 선택·참가 체크는 잠금 표시(바꿀 수 없음) + 안내, 출전한 사람만 '이후 대진에서 제외'
// - '출전'·'귀가'·'비활성' 표시, 명단 비어 있음 → '명단으로'. 비활성 회원·삭제된 게스트(이미 참가한 기록)는 다시 넣을 수 없음(U6·P-5)
type Props = { view: ClubMatchView; onExclude: (key: string) => void }

export function ParticipantsPanel({ view, onExclude }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim()
  const rows = view.rows
  const byName = (a: ParticipantRow, b: ParticipantRow) => a.name.localeCompare(b.name, 'ko')
  const match = (r: ParticipantRow) => !q || r.name.includes(q)
  const members = rows.filter((r) => r.kind === 'member' && match(r)).sort(byName)
  // SCR-224(AC-107·AC-013): 삭제된 게스트는 참가자 명단에서 빠진 상태로 표시(지난 경기·순위에는 '삭제된 게스트'로 남음)
  const guests = rows.filter((r) => r.kind === 'guest' && r.available && match(r)).sort(byName)
  const noop = () => undefined

  const row = (r: ParticipantRow) => {
    const meta = (
      <span className="flex flex-wrap items-center gap-2">
        <span className={r.participating ? 'font-bold text-ink' : 'text-ink'}>{r.name}</span>
        {r.gender && <span className="text-ink-muted">{r.gender}</span>}
        {r.score === null ? <Badge tone="warning">미설정</Badge> : <span className="font-bold tabular-nums text-ink">{r.score}</span>}
        {r.games > 0 && !r.left && <Badge tone="info">출전</Badge>}
        {r.left && <Badge tone="neutral">귀가</Badge>}
        {!r.available && <Badge tone="neutral">비활성</Badge>}
      </span>
    )
    const canExclude = view.status === 'confirmed' && r.participating && r.games > 0 && !r.left
    // SCR-224 비활성 회원 행(남은 경기 있음, AC-058·UXD-048): 안내 + '이후 대진에서 제외'로 바로 이동(대진 자동 변경 없음)
    const inactiveLeft = canExclude && !r.available && r.inUnrecorded > 0
    return (
      <li key={r.key} data-participant={r.key} className="flex flex-col gap-1 border-b border-line py-1">
        {view.method === 'individual' ? (
          <Checkbox rowMode checked={r.participating} disabled onChange={noop} ariaLabel={`${r.name}${r.gender ? `, ${r.gender}` : ''}, ${r.score === null ? '점수 미설정' : `${r.score}점`}`} label={meta} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 py-1">
            {meta}
            <div className="w-48">
              <SegmentedControl
                label={`${r.name} 팀`}
                hideLabel
                size="sm"
                disabled
                options={[{ value: 'blue', label: '청' }, { value: 'white', label: '백' }, { value: 'none', label: '불참' }] as const}
                value={r.participating ? (r.team ?? 'none') : 'none'}
                onChange={noop}
              />
            </div>
          </div>
        )}
        {inactiveLeft && <p className="m-0 pl-9 text-caption text-warning-fg">남은 경기 {r.inUnrecorded}개 · 대체 선수를 정하세요</p>}
        {canExclude && (
          <Button variant="text" size="md" className="self-start px-0 pl-9" onClick={() => onExclude(r.key)}>
            이후 대진에서 제외
          </Button>
        )}
      </li>
    )
  }

  const s = view.summary
  return (
    <div data-scr="SCR-224" data-st={view.rows.length === 0 ? 'SCR-224-ST3' : 'SCR-224-ST8'} className="flex flex-col gap-3">
      <p data-cmp="CMP-028" aria-live="polite" className="sticky top-0 z-10 m-0 bg-page py-2 text-body font-bold text-ink">
        {view.method === 'team'
          ? `청 ${s.blue.n}(남${s.blue.male} 여${s.blue.n - s.blue.male}) · 백 ${s.white.n}(남${s.white.male} 여${s.white.n - s.white.male})`
          : `참가 ${s.count}명 · 남 ${s.male} 여 ${s.female}`}
      </p>
      {view.method === 'team' && <NoticeBox tone="info">대진 확정 후에는 같은 팀 안에서 선수 교체만 할 수 있습니다</NoticeBox>}
      <TextField label="이름 검색" hideLabel type="search" placeholder="이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      {view.rows.length === 0 ? (
        <StateView kind="empty" title="명단이 비어 있습니다" action={<Button asChild variant="secondary" fullWidth><Link to="/ops/roster">명단으로</Link></Button>} />
      ) : members.length + guests.length === 0 ? (
        <StateView kind="empty" title={`'${q}'${waGwa(q).slice(q.length)} 일치하는 사람이 없습니다`} />
      ) : (
        <>
          <ul aria-label="회원" className="m-0 list-none p-0">
            {members.map(row)}
          </ul>
          {guests.length > 0 && (
            <>
              <div role="heading" aria-level={3} className="-mx-4 flex h-8 items-center bg-surface px-4 text-caption font-bold text-ink-muted">
                게스트
              </div>
              <ul aria-label="게스트" className="m-0 list-none p-0">
                {guests.map(row)}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
