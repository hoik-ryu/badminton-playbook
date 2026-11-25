import { Search, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { NoticeBox } from '../../../components/NoticeBox'
import { StateView } from '../../../components/StateView'
import { StepActionBar } from '../../../components/StepActionBar'
import { StickySummary } from '../../../components/StickySummary'
import { TextField } from '../../../components/TextField'
import { isApiError } from '../../../lib/api'
import { ScoreEntrySheet } from '../../roster/ScoreEntrySheet'
import type { RosterPerson } from '../../roster/api'
import { CLUB_ERRORS, getClubMatchView, saveParticipants, type ParticipantRow } from '../api'
import { CheckMark, PersonPickRow } from './parts'
import { SelectedSheet } from './SelectedSheet'
import { SetupFrame } from './SetupFrame'
import { participantsOf, participantsProblem, sameSet } from './steps'
import type { StepProps } from './types'

// SCR-242 청백전 생성 · 참가자 설정 — UX Spec r9 02 SCR-242(UXD-093·094·074·098·099), DD r12 VD-064, Preview r8
// 고정 영역: 검색칸 + 필터 칩 한 줄(성별·급수·점수 미설정, 가로 스크롤). 목록: 회원(이름순) → '게스트' → 게스트(이름순)
// 검색·필터를 바꿔도 선택 유지, '표시된 n명 모두 선택/해제'는 현재 결과에만(C-34·AC-124·125). 선택 요약 줄 → SCR-246 시트
// 점수 미설정 → 기존 SCR-214 점수 시트(명단 점수로 저장 안내, AC-126). '다음'에서 참가자 목록 한 번에 저장(C-32)
// 대진이 있을 때 첫 선택 변경: 폐기 확인(ST10) — 확인하면 '다음' 저장 때 폐기를 함께 보냄(AC-132)
const GRADES = ['자강조', 'A조', 'B조', 'C조', 'D조', '초심', '왕초심', '입문자'] as const
const byName = (a: ParticipantRow, b: ParticipantRow) => a.name.localeCompare(b.name, 'ko')

export function ParticipantsStep({ c, frame, go }: StepProps) {
  const navigate = useNavigate()
  const v = c.view!
  const selected = c.drafts.participants
  const sel = useMemo(() => new Set(selected), [selected])
  const [q, setQ] = useState('')
  const [gender, setGender] = useState<'전체' | '남' | '여'>('전체')
  const [grades, setGrades] = useState<Set<string>>(new Set())
  const [unscoredOnly, setUnscoredOnly] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [ineligible, setIneligible] = useState<Set<string>>(new Set())

  // 고를 수 있는 사람: 승인 회원·삭제 안 된 게스트(available) + 이미 참가 중인 사람(자격을 잃어도 표시, ST4)
  const rows = useMemo(() => v.rows.filter((r) => r.available || r.participating), [v.rows])
  const members = rows.filter((r) => r.kind === 'member').sort(byName)
  const guests = rows.filter((r) => r.kind === 'guest').sort(byName)
  const filtering = q.trim() !== '' || gender !== '전체' || grades.size > 0 || unscoredOnly
  const match = (r: ParticipantRow) => (!q.trim() || r.name.includes(q.trim())) && (gender === '전체' || r.gender === gender) && (grades.size === 0 || (r.grade !== null && grades.has(r.grade))) && (!unscoredOnly || r.score === null)
  const shownMembers = members.filter(match)
  const shownGuests = guests.filter(match)
  const shown = [...shownMembers, ...shownGuests]
  const allShownOn = shown.length > 0 && shown.every((r) => sel.has(r.key))
  const chosen = rows.filter((r) => sel.has(r.key))
  const male = chosen.filter((r) => r.gender === '남').length
  const unscored = chosen.filter((r) => r.score === null)
  const lost = chosen.filter((r) => !r.available || ineligible.has(r.key))
  const problem = participantsProblem(chosen)

  /** 대진이 있으면 첫 변경 전에 폐기 확인(ST10). 취소하면 그 변경을 하지 않음 */
  const guard = (change: () => void) => {
    if (v.games.length > 0 && !c.drafts.discard.participants) setPending(() => change)
    else change()
  }
  const setSelected = (fn: (s: Set<string>) => void) =>
    guard(() =>
      c.setDrafts((d) => {
        const next = new Set(d.participants)
        fn(next)
        const order = [...d.participants.filter((k) => next.has(k)), ...[...next].filter((k) => !d.participants.includes(k))]
        return { ...d, participants: order }
      }),
    )
  const toggle = (key: string) => setSelected((s) => (s.has(key) ? s.delete(key) : s.add(key)))
  const bulk = () => setSelected((s) => shown.forEach((r) => (allShownOn ? s.delete(r.key) : s.add(r.key))))

  async function next(forceDiscard = false) {
    if (problem) return
    if (sameSet(selected, participantsOf(v).map((r) => r.key))) return go(v.method === 'team' ? 'teams' : 'games')
    const r = await c.save(
      () => saveParticipants(v.id, v.version, selected, forceDiscard || c.drafts.discard.participants),
      (x) => sameSet(participantsOf(x).map((p) => p.key), selected),
      () => void next(),
    )
    if (r.kind === 'ok') {
      setIneligible(new Set())
      c.accept(r.view, { participants: true })
      go(r.view.method === 'team' ? 'teams' : 'games')
    } else if (r.kind === 'confirm') setPending(() => () => void next(true)) // 다른 운영진이 그사이 대진을 만듦: 확인 후 폐기와 함께 다시 저장
    else if (r.kind === 'failed') {
      if (isApiError(r.error) && r.error.code === CLUB_ERRORS.notEligible) {
        const keys = ((r.error.details as { keys?: string[] } | null)?.keys ?? []) as string[]
        setIneligible(new Set(keys))
        c.setFailure({ message: `참가할 수 없는 사람이 ${keys.length || '있'}${keys.length ? '명 있습니다' : '습니다'}. 선택을 해제해 주세요`, retry: () => void next() })
      } else c.setFailure({ message: '저장하지 못했습니다. 입력한 내용은 그대로입니다', retry: () => void next() })
    }
  }

  const rosterPeople: RosterPerson[] = unscored
    .filter((r) => r.gender !== null && r.grade !== null)
    .map((r) => ({ id: r.id, kind: r.kind, name: r.name, gender: r.gender!, grade: r.grade!, score: r.score, tutorialRecommendedUnpassed: false }))
  const reloadScores = async () => {
    setScoring(false)
    try {
      c.accept(await getClubMatchView(v.id))
    } catch {
      c.setFailure({ message: '점수를 다시 불러오지 못했습니다', retry: () => void reloadScores() })
    }
  }

  const loading = c.saving
  const st = pending ? 'SCR-242-ST10' : c.conflict ? 'SCR-242-ST6' : loading ? 'SCR-242-ST2' : c.failure || lost.length ? 'SCR-242-ST4' : rows.length === 0 || shown.length === 0 ? 'SCR-242-ST3' : unscored.length && chosen.length >= 4 ? 'SCR-242-ST7' : c.dirty.participants ? 'SCR-242-ST9' : problem === null ? 'SCR-242-ST8' : 'SCR-242-ST1'
  const row = (r: ParticipantRow) => (
    <li key={r.key}>
      <PersonPickRow p={r} checked={sel.has(r.key)} onToggle={() => toggle(r.key)} problem={!r.available || ineligible.has(r.key) ? '참가할 수 없는 사람입니다' : undefined} />
    </li>
  )
  return (
    <SetupFrame
      scr="SCR-242"
      st={st}
      method={v.method}
      title="참가자 설정"
      desc="경기에 참여할 멤버를 선택해 주세요."
      compact
      steps={frame.steps}
      current="participants"
      onStep={frame.onStep}
      onExit={frame.onExit}
      notice={
        c.failure && (
          <NoticeBox tone="danger" action={<button type="button" className="su-link" onClick={c.failure.retry}>다시 시도</button>}>
            {c.failure.message}
          </NoticeBox>
        )
      }
      bar={
        <StepActionBar
          onPrev={() => go('basic')}
          onNext={() => void next()}
          disabledReason={problem ?? undefined}
          quietReason={chosen.length >= 4 && unscored.length > 0}
          loading={loading}
          above={
            <>
              {unscored.length > 0 && <StickySummary kind="warning" text={`점수 미설정 ${unscored.length}명`} action="점수 매기기" onAction={() => setScoring(true)} />}
              <div style={{ marginBottom: 8 }}>
                <StickySummary kind="selection" count={chosen.length} male={male} female={chosen.length - male} onOpen={() => setSheet(true)} />
              </div>
            </>
          }
        />
      }
      overlay={
        <>
          <ConfirmDialog
            open={!!pending}
            onOpenChange={(o) => !o && setPending(null)}
            title="대진이 초기화됩니다"
            description="참가자를 바꾸면 만든 대진을 버리고 다시 생성해야 합니다"
            confirmLabel="바꾸기"
            onConfirm={() => {
              c.setDrafts((d) => ({ ...d, discard: { ...d.discard, participants: true } }))
              pending?.()
              setPending(null)
            }}
          />
          {sheet && <SelectedSheet people={chosen} onRemove={(key) => toggle(key)} onClose={() => setSheet(false)} />}
          {scoring && rosterPeople.length > 0 && (
            <ScoreEntrySheet
              people={rosterPeople}
              onClose={() => void reloadScores()}
              onAllDone={() => void reloadScores()}
              notice={<NoticeBox tone="info">명단 점수로 저장되어 다른 청백전과 대진에도 쓰입니다</NoticeBox>}
            />
          )}
        </>
      }
    >
      <section className="su-sec" aria-label="참가자 선택" style={{ gap: 0 }}>
        <div className="su-sticky" data-testid="su-fixed-top">
          <div className="su-search">
            <TextField label="이름으로 검색" hideLabel type="search" placeholder="이름으로 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            <Search aria-hidden />
            {q && (
              <button type="button" aria-label="검색어 지우기" onClick={() => setQ('')} className="su-icon-btn su-clear" style={{ width: 36, height: 36 }}>
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
          <div className="su-chips" role="group" aria-label="필터">
            {(['전체', '남', '여'] as const).map((g) => (
              <button key={g} type="button" className="su-chip" aria-pressed={gender === g} onClick={() => setGender(g)}>
                {g === '전체' ? '성별 전체' : g}
              </button>
            ))}
            <span aria-hidden className="su-chip-sep" />
            {GRADES.map((g) => (
              <button key={g} type="button" className="su-chip" aria-pressed={grades.has(g)} onClick={() => setGrades((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n })}>
                {g}
              </button>
            ))}
            <span aria-hidden className="su-chip-sep" />
            <button type="button" className="su-chip" aria-pressed={unscoredOnly} onClick={() => setUnscoredOnly((x) => !x)}>
              <TriangleAlert aria-hidden />
              점수 미설정
            </button>
          </div>
        </div>
        <div className="su-listhead">
          <b>
            {filtering ? '검색 결과' : '전체 회원'} <span>({shown.length})</span>
          </b>
          {shown.length > 0 && (
            <button type="button" role="checkbox" aria-checked={allShownOn} className="su-check-all" onClick={bulk}>
              <CheckMark on={allShownOn} />
              {allShownOn ? `표시된 ${shown.length}명 모두 해제` : `표시된 ${shown.length}명 모두 선택`}
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <StateView kind="empty" title="명단에 선택할 수 있는 사람이 없습니다" action={<Button variant="secondary" onClick={() => navigate('/ops/roster')}>명단으로</Button>} />
        ) : shown.length === 0 ? (
          <StateView
            kind="empty"
            title={`'${q.trim() || '조건'}'과 일치하는 사람이 없습니다`}
            action={
              <Button variant="secondary" onClick={() => { setQ(''); setGender('전체'); setGrades(new Set()); setUnscoredOnly(false) }}>
                검색·필터 지우기
              </Button>
            }
          />
        ) : (
          <>
            {shownMembers.length > 0 && (
              <ul className="su-list" aria-label="회원" data-testid="su-rows">
                {shownMembers.map(row)}
              </ul>
            )}
            {shownGuests.length > 0 && (
              <>
                <p className="su-group">게스트</p>
                <ul className="su-list" aria-label="게스트">
                  {shownGuests.map(row)}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </SetupFrame>
  )
}
