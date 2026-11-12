import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NoticeBox } from '../../components/NoticeBox'
import { SegmentedControl } from '../../components/RadioButtons'
import { StateView } from '../../components/StateView'
import { TextField } from '../../components/TextField'
import { isApiError } from '../../lib/api'
import { waGwa } from '../../lib/josa'
import { applyTeamProposal, CLUB_ERRORS, generateClub, setParticipating, setTeam, type ClubMatchView, type ClubRun, type ParticipantRow, type Team } from './api'

// SCR-224 참가자·팀 구성(모바일 하단 시트 70% / PC 옆 패널 400). US-014·015, FLOW-005-S2·S2a·S2b·S7, AC-057·058·071·072·078·107, UXD-023·030·038·039·048·070
// - 고정 요약(CMP-028): 개인전 '참가 n명 · 남 a 여 b' / 팀전 '청 n(남a 여b) · 백 m(남c 여d)'
// - 개인전 '참가' 체크 / 팀전 '청|백|불참'(각 44 이상). 이미 경기에 들어간 사람은 참가 해제 불가
// - 팀전 패널 처음 열기 → 알고리즘 배정안 채움(AC-072). 대진 생성 후 확정 전 팀 변경 → 확인 창 "팀을 바꾸면 대진을 다시 생성합니다"
// - 확정 후(ST8): 팀 선택·참가 해제 잠금 + 안내, 출전한 사람만 '이후 대진에서 제외'(→ SCR-226)
// - '출전'·'귀가' 표시, 점수 미설정 → SCR-214, 명단 비어 있음 → '명단으로'. 저장 실패는 행 되돌림 + 안내 상자
// - I3-d: 변경은 run(version)으로 순서대로(응답으로 갱신). 비활성 회원·삭제된 게스트(이미 참가한 기록)는 다시 넣을 수 없음(U6·P-5)
type Props = { view: ClubMatchView; run: ClubRun; onChanged: (what: 'participants' | 'teams') => void; onConflict: () => void; onScores: () => void; onExclude: (key: string) => void }

export function ParticipantsPanel({ view, run, onChanged, onConflict, onScores, onExclude }: Props) {
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, boolean | Team | null>>({})
  const [proposing, setProposing] = useState(false)
  const [proposed, setProposed] = useState(false)
  const [teamChange, setTeamChange] = useState<{ row: ParticipantRow; team: Team | null } | null>(null)
  const locked = view.status !== 'draft'
  const tried = useRef(false)

  // 팀전 패널 처음 열기 → 팀이 없는 참가자에게 배정안(AC-072, UXD-030)
  useEffect(() => {
    if (tried.current || locked || view.method !== 'team' || view.teamProposed) return
    if (!view.rows.some((r) => r.participating && r.team === null)) return
    tried.current = true
    setProposing(true)
    run((v) => applyTeamProposal(view.id, v))
      .then(() => {
        setProposed(true)
        onChanged('teams')
      })
      .catch((e: unknown) => (isApiError(e) && e.code === CLUB_ERRORS.conflict ? onConflict() : setNotice('팀 배정안을 만들지 못했습니다. 직접 청·백을 골라 주세요')))
      .finally(() => setProposing(false))
  }, [view, locked, onChanged, onConflict, run])

  const q = query.trim()
  const rows = view.rows.map((r) => (r.key in pending ? (view.method === 'team' ? { ...r, team: pending[r.key] as Team | null, participating: pending[r.key] !== null } : { ...r, participating: pending[r.key] as boolean }) : r))
  const byName = (a: ParticipantRow, b: ParticipantRow) => a.name.localeCompare(b.name, 'ko')
  const match = (r: ParticipantRow) => !q || r.name.includes(q)
  const members = rows.filter((r) => r.kind === 'member' && match(r)).sort(byName)
  // SCR-224(AC-107·AC-013): 삭제된 게스트는 참가자 명단에서 빠진 상태로 표시(지난 경기·순위에는 '삭제된 게스트'로 남음)
  const guests = rows.filter((r) => r.kind === 'guest' && r.available && match(r)).sort(byName)

  const save = async (r: ParticipantRow, value: boolean | Team | null, work: () => Promise<unknown>) => {
    setNotice(null)
    setPending((p) => ({ ...p, [r.key]: value }))
    try {
      await work()
      onChanged(view.method === 'team' ? 'teams' : 'participants')
    } catch (e) {
      if (isApiError(e) && e.code === CLUB_ERRORS.conflict) onConflict()
      else setNotice(isApiError(e) && (e.code === CLUB_ERRORS.inGames || e.code === CLUB_ERRORS.notEligible) ? e.message : '저장하지 못해 되돌렸습니다. 다시 시도해 주세요')
    } finally {
      setPending((p) => {
        const { [r.key]: _, ...rest } = p
        return rest
      })
    }
  }

  const changeTeam = (r: ParticipantRow, team: Team | null) => {
    if (view.games.length > 0) return setTeamChange({ row: r, team }) // 생성 후 확정 전
    void save(r, team, () => run((v) => setTeam(view.id, v, r.key, team)))
  }

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
          <Checkbox
            rowMode
            checked={r.participating}
            disabled={locked || (r.participating && r.games > 0) || (!r.participating && !r.available)}
            onChange={(on) => void save(r, on, () => run((v) => setParticipating(view.id, v, r.key, on)))}
            ariaLabel={`${r.name}${r.gender ? `, ${r.gender}` : ''}, ${r.score === null ? '점수 미설정' : `${r.score}점`}`}
            label={meta}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 py-1">
            {meta}
            <div className="w-48">
              <SegmentedControl
                label={`${r.name} 팀`}
                hideLabel
                size="sm"
                disabled={locked || !r.available}
                options={[{ value: 'blue', label: '청' }, { value: 'white', label: '백' }, { value: 'none', label: '불참' }] as const}
                value={r.participating ? (r.team ?? 'none') : 'none'}
                onChange={(v) => changeTeam(r, v === 'none' ? null : v)}
              />
            </div>
          </div>
        )}
        {view.method === 'individual' && r.participating && r.games > 0 && !locked && <p className="m-0 pl-9 text-caption text-ink-muted">경기에 출전한 선수는 참가를 해제할 수 없습니다</p>}
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
    <div data-scr="SCR-224" data-st={notice ? 'SCR-224-ST4' : proposing ? 'SCR-224-ST2' : view.rows.length === 0 ? 'SCR-224-ST3' : locked ? 'SCR-224-ST8' : view.method === 'team' ? 'SCR-224-ST7' : 'SCR-224-ST1'} className="flex flex-col gap-3">
      <p data-cmp="CMP-028" aria-live="polite" className="sticky top-0 z-10 m-0 bg-page py-2 text-body font-bold text-ink">
        {view.method === 'team'
          ? `청 ${s.blue.n}(남${s.blue.male} 여${s.blue.n - s.blue.male}) · 백 ${s.white.n}(남${s.white.male} 여${s.white.n - s.white.male})`
          : `참가 ${s.count}명 · 남 ${s.male} 여 ${s.female}`}
      </p>
      {notice && <NoticeBox tone="danger">{notice}</NoticeBox>}
      {proposing && <StateView kind="loading" rows={2} label="팀 배정안을 계산하는 중" />}
      {proposed && <NoticeBox tone="info">알고리즘 배정안을 채웠습니다</NoticeBox>}
      {locked && view.method === 'team' && <NoticeBox tone="info">대진 확정 후에는 같은 팀 안에서 선수 교체만 할 수 있습니다</NoticeBox>}
      {s.unscored.length > 0 && !locked && (
        <button type="button" onClick={onScores} className="w-full text-left">
          <NoticeBox tone="warning" action={<span aria-hidden className="text-title text-warning-fg">›</span>}>
            점수 미설정 {s.unscored.length}명
          </NoticeBox>
        </button>
      )}
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
      <ConfirmDialog
        open={teamChange !== null}
        onOpenChange={(o) => !o && setTeamChange(null)}
        title="팀을 바꾸면 대진을 다시 생성합니다"
        confirmLabel="바꾸기"
        onConfirm={async () => {
          if (!teamChange) return
          const { row: r, team } = teamChange
          await save(r, team, async () => {
            await run((v) => setTeam(view.id, v, r.key, team))
            await run((v) => generateClub(view.id, v))
          })
        }}
      />
    </div>
  )
}
