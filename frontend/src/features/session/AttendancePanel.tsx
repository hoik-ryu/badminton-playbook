import { useState } from 'react'

import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { NoticeBox } from '../../components/NoticeBox'
import { StateView } from '../../components/StateView'
import { TextField } from '../../components/TextField'
import { waGwa } from '../../lib/josa'
import { setAttendance, type AttendanceRow, type SessionView } from './api'

// SCR-203 참석 체크(모바일 하단 시트 70% / PC 옆 패널 '참석' 탭). US-008·006, FLOW-004-S2·S8·S8a, AC-012·019·020·021·058, UXD-004·023·027
// - 고정 요약(CMP-028): '참석 n명 · 남 a 여 b'(값이 바뀌면 aria-live)
// - '점수 미설정 N명'(있을 때) → SCR-214 / '게스트 추가' → SCR-213(저장 시 바로 참석 체크, UXD-027)
// - 이름순 회원(비활성 제외, AC-058) + '게스트' 구분, 행 전체 체크(48), 즉시 저장. 진행 중 경기 선수를 빼면 '다음 라운드부터 제외'
// - ST1 / ST2 목록 스켈레톤(부모 로딩) / ST3 명단 없음·검색 결과 없음 / ST4 체크 저장 실패: 행 되돌림 + 안내 상자
type Props = { view: SessionView; onChanged: () => void; onAddGuest: () => void; onScores: () => void }

export function AttendancePanel({ view, onChanged, onAddGuest, onScores }: Props) {
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Record<string, boolean>>({}) // 낙관적 표시
  const [failed, setFailed] = useState(false)
  const sessionId = view.session?.id
  const rows = view.attendance.map((r) => (r.key in pending ? { ...r, attending: pending[r.key]! } : r))
  const q = query.trim()
  const match = (r: AttendanceRow) => !q || r.name.includes(q)
  const byName = (a: AttendanceRow, b: AttendanceRow) => a.name.localeCompare(b.name, 'ko')
  const members = rows.filter((r) => r.kind === 'member' && match(r)).sort(byName)
  const guests = rows.filter((r) => r.kind === 'guest' && match(r)).sort(byName)
  const attending = rows.filter((r) => r.attending)
  const male = attending.filter((r) => r.gender === '남').length

  const toggle = async (r: AttendanceRow, on: boolean) => {
    if (!sessionId) return
    setFailed(false)
    setPending((p) => ({ ...p, [r.key]: on }))
    try {
      await setAttendance(sessionId, r.key, on)
      onChanged()
    } catch {
      setFailed(true) // 해당 행 체크 되돌림
    } finally {
      setPending((p) => {
        const { [r.key]: _, ...rest } = p
        return rest
      })
    }
  }

  const row = (r: AttendanceRow) => (
    <li key={r.key} className="border-b border-line">
      <Checkbox
        rowMode
        checked={r.attending}
        onChange={(on) => void toggle(r, on)}
        ariaLabel={`${r.name}, ${r.gender}, ${r.score === null ? '점수 미설정' : `${r.score}점`}`}
        label={
          <span className="flex items-center gap-2">
            <span className={r.attending ? 'font-bold text-ink' : 'text-ink'}>{r.name}</span>
            <span className="text-ink-muted">{r.gender}</span>
            {r.score === null ? <Badge tone="warning">미설정</Badge> : <span className="font-bold tabular-nums text-ink">{r.score}</span>}
            {r.excludedNext && <Badge tone="neutral">다음 라운드부터 제외</Badge>}
          </span>
        }
      />
    </li>
  )

  return (
    <div data-scr="SCR-203" data-st={failed ? 'SCR-203-ST4' : view.attendance.length === 0 ? 'SCR-203-ST3' : 'SCR-203-ST1'} className="flex flex-col gap-3">
      <p data-cmp="CMP-028" aria-live="polite" className="sticky top-0 z-10 m-0 bg-page py-2 text-body font-bold text-ink">
        참석 <span className="tabular-nums">{attending.length}</span>명 · 남 <span className="tabular-nums">{male}</span> 여 <span className="tabular-nums">{attending.length - male}</span>
      </p>
      {failed && <NoticeBox tone="danger">참석 저장에 실패해 되돌렸습니다. 다시 시도해 주세요</NoticeBox>}
      {view.summary.unscored.length > 0 && (
        <button type="button" onClick={onScores} className="w-full text-left">
          <NoticeBox tone="warning" action={<span aria-hidden className="text-title text-warning-fg">›</span>}>
            점수 미설정 {view.summary.unscored.length}명
          </NoticeBox>
        </button>
      )}
      <TextField label="이름 검색" hideLabel type="search" placeholder="이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      {view.attendance.length === 0 ? (
        <StateView kind="empty" title="명단이 비어 있습니다" action={<Button fullWidth onClick={onAddGuest}>게스트 추가</Button>} />
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
      <Button variant="secondary" fullWidth onClick={onAddGuest}>
        + 게스트 추가
      </Button>
    </div>
  )
}
