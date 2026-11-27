import { CalendarDays, Check, ChevronDown, ChevronUp, CircleCheck, FileText, Grid2x2, ListOrdered, PenLine, Play, Shuffle, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { NoticeBox } from '../../../components/NoticeBox'
import { RoundSection } from '../../../components/RoundSection'
import { SetupSummary } from '../../../components/SetupSummary'
import { StepActionBar } from '../../../components/StepActionBar'
import { ValidationList, type ValidationItem } from '../../../components/ValidationList'
import { isApiError } from '../../../lib/api'
import { CLUB_ERRORS, confirmClub, METHOD_LABEL, type ClubMatchView, type ParticipantRow } from '../api'
import { dateLabel } from './format'
import { SetupFrame } from './SetupFrame'
import { completion, MIN_PARTICIPANTS, participantsOf, teamsProblem } from './steps'
import type { StepProps } from './types'

// SCR-245 청백전 생성 · 확정 — UX Spec r9 02 SCR-245(UXD-097·006·010·099), DD r12 VD-067, Preview r8
// 요약(CMP-056: 기본정보 → 참가자 → 팀 구성(팀전) → 대진, 묶음마다 '수정') · 검증 목록(CMP-055) · 공개 안내 · '확정' → 확인 창(ST8) → SCR-112
// 시안의 "생성 후에도 일부 설정은 수정할 수 있어요"는 승인 정책과 달라 쓰지 않음(VD-067)
// (r14, UX Spec r11 SCR-245·DD r14 VD-082) 라운드 기반: 대진 묶음에 '코트·라운드' 행, '라운드별 대진 보기'(CMP-059 readonly, 기본 접힘),
//   검증 2항목(같은 라운드 중복 출전 없음·라운드마다 경기 수 ≤ 코트 수), 공개 안내 '확정하면 1라운드가 바로 시작됩니다',
//   서버 라운드 재검사 실패(round_conflict 등)는 라운드 항목을 실패로 바꾸고 사유·'수정'(ST9, AC-153)
const ROUND_ERRORS = new Set<string>([CLUB_ERRORS.roundConflict, CLUB_ERRORS.courtFull, CLUB_ERRORS.invalidRound])
const sumOf = (rows: ParticipantRow[]) => rows.reduce((s, r) => s + (r.score ?? 0), 0)
const genders = (rows: ParticipantRow[]) => `남 ${rows.filter((r) => r.gender === '남').length} · 여 ${rows.filter((r) => r.gender === '여').length}`

export function ConfirmStep({ c, frame, go }: StepProps) {
  const navigate = useNavigate()
  const v = c.view!
  const [ask, setAsk] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [roundFail, setRoundFail] = useState<string | null>(null)
  const [showRounds, setShowRounds] = useState(false)
  const [folded, setFolded] = useState<Set<number>>(() => new Set())
  const rd = v.courtCount != null ? roundFacts(v) : null
  const parts = participantsOf(v)
  const blue = parts.filter((r) => r.team === 'blue')
  const white = parts.filter((r) => r.team === 'white')
  const unscored = parts.filter((r) => r.score === null)
  const done = completion(v)
  const counts = new Map<string, number>()
  for (const g of v.games) for (const p of [...g.team1, ...g.team2]) counts.set(p.key, (counts.get(p.key) ?? 0) + 1)
  const nums = parts.filter((r) => v.method === 'individual' || r.team).map((r) => counts.get(r.key) ?? 0)
  const minN = nums.length ? Math.min(...nums) : 0
  const maxN = nums.length ? Math.max(...nums) : 0
  const relaxed = v.games.filter((g) => g.genderRelaxed || g.repeatedMatchup || g.relaxations.length > 0).length
  // (r13, VD-075·AC-130 r11) 실제 경기 수와 운영진 수동 변경(같은 대진 반복 포함) 경기 수. 0이면 생략
  const manualN = v.games.filter((g) => g.relaxations.some((x) => x.reason === 'manual')).length

  const checks: ValidationItem[] = [
    { key: 'count', ok: parts.length >= MIN_PARTICIPANTS, text: parts.length >= MIN_PARTICIPANTS ? `참가자 4명 이상(${parts.length}명)` : `참가자가 4명 미만입니다(${parts.length}명)`, onFix: () => go('participants') },
    { key: 'scores', ok: unscored.length === 0, text: unscored.length === 0 ? '점수 미설정 0명' : `점수 미설정 ${unscored.length}명(${unscored.map((r) => r.name).join(', ')})`, onFix: () => go('participants') },
    ...(v.method === 'team' ? [{ key: 'teams', ok: done.teams, text: done.teams ? '미배정 0명 · 팀당 2명 이상' : (teamsProblem(parts.map((r) => r.team)) ?? '팀 구성을 확인해 주세요'), onFix: () => go('teams') }] : []),
    { key: 'games', ok: v.games.length > 0, text: v.games.length > 0 ? `대진 있음(${v.games.length}경기)` : '대진 없음 — 대진을 다시 만들어 주세요', onFix: () => go('games') },
    ...(rd && v.games.length > 0
      ? [
          roundFail || rd.dup
            ? { key: 'round-dup', ok: false, text: roundFail ?? rd.dup!, onFix: () => go('games') }
            : { key: 'round-dup', ok: true, text: '같은 라운드 중복 출전 없음', onFix: () => go('games') },
          { key: 'round-courts', ok: rd.courtsOk, text: rd.courtsOk ? `라운드마다 경기 수 ≤ 코트 수(${v.courtCount})` : `코트 수(${v.courtCount})보다 경기가 많은 라운드가 있습니다`, onFix: () => go('games') },
        ]
      : []),
  ]
  const allOk = checks.every((x) => x.ok)

  const confirm = async () => {
    setFailed(null)
    setRoundFail(null)
    const r = await c.save(() => confirmClub(v.id, v.version), (x) => x.status !== 'draft', () => setAsk(true))
    if (r.kind === 'ok') navigate(`/club-matches/${encodeURIComponent(v.id)}`, { replace: true, state: { confirmed: true } })
    else if (r.kind === 'failed' && isApiError(r.error) && ROUND_ERRORS.has(r.error.code)) setRoundFail(`${r.error.message} — 대진을 수정해 주세요`)
    else if (r.kind === 'failed') setFailed(isApiError(r.error) && [CLUB_ERRORS.noGames, CLUB_ERRORS.locked, CLUB_ERRORS.unscored, CLUB_ERRORS.unassigned].includes(r.error.code as never) ? r.error.message : '확정하지 못했습니다. 다시 시도해 주세요')
  }

  const st = ask ? 'SCR-245-ST8' : c.conflict ? 'SCR-245-ST6' : c.saving ? 'SCR-245-ST2' : failed ? 'SCR-245-ST4' : roundFail ? 'SCR-245-ST9' : !allOk ? 'SCR-245-ST7' : 'SCR-245-ST1'
  return (
    <SetupFrame
      scr="SCR-245"
      st={st}
      method={v.method}
      title="확정"
      desc="설정을 확인하고 청백전을 확정해 주세요."
      compact
      steps={frame.steps}
      current="confirm"
      onStep={frame.onStep}
      onExit={frame.onExit}
      onMore={frame.onMore}
      moreNotice={frame.moreNotice}
      notice={
        failed && (
          <NoticeBox tone="danger" action={<button type="button" className="su-link" onClick={() => setAsk(true)}>다시 시도</button>}>
            {failed}
          </NoticeBox>
        )
      }
      bar={<StepActionBar onPrev={() => go('games')} onNext={() => setAsk(true)} nextLabel="확정" nextIcon={<Check aria-hidden />} disabledReason={allOk ? undefined : '확인이 필요한 항목을 먼저 고쳐 주세요'} loading={c.saving} />}
      overlay={<ConfirmDialog open={ask} onOpenChange={setAsk} title="대진을 확정하고 회원에게 공개할까요?" description={rd ? '확정 후에는 방식을 바꾸거나 다시 생성할 수 없습니다. 확정하면 1라운드가 바로 시작됩니다' : '확정 후에는 방식을 바꾸거나 다시 생성할 수 없습니다'} confirmLabel="확정" onConfirm={confirm} />}
    >
      <SetupSummary
        title="기본정보"
        onEdit={() => go('basic')}
        rows={[
          { icon: <FileText aria-hidden />, label: '경기 방식', value: METHOD_LABEL[v.method] },
          { icon: <PenLine aria-hidden />, label: '이름', value: v.name },
          { icon: <CalendarDays aria-hidden />, label: '날짜', value: dateLabel(v.date) },
        ]}
      />
      <SetupSummary
        title="참가자"
        onEdit={() => go('participants')}
        rows={[{ icon: <Users aria-hidden />, label: '참가 인원', value: `${parts.length}명`, sub: [`${genders(parts)} · 게스트 ${parts.filter((r) => r.kind === 'guest').length}`] }]}
      />
      {v.method === 'team' && (
        <SetupSummary
          title="팀 구성"
          onEdit={() => go('teams')}
          rows={[{ icon: <Shuffle aria-hidden />, label: '팀 구성', value: `청팀 ${blue.length}명 · 백팀 ${white.length}명`, sub: [`청 ${genders(blue)} · 점수 합 ${sumOf(blue)}`, `백 ${genders(white)} · 점수 합 ${sumOf(white)}`] }]}
        />
      )}
      <SetupSummary
        title="대진"
        onEdit={() => go('games')}
        rows={[
          ...(rd && v.games.length
            ? [{ icon: <Grid2x2 aria-hidden />, label: '코트·라운드', value: `코트 ${v.courtCount} · ${rd.rounds.length}라운드`, sub: [rd.playText] }]
            : []),
          {
            icon: <ListOrdered aria-hidden />,
            label: '대진',
            value: v.games.length ? `${v.games.length}경기` : '없음',
            sub: v.games.length ? [`1인 ${minN === maxN ? minN : `${minN}–${maxN}`}경기 · 밸런스 ${v.rules.balance ? '켬' : '끔'}·성별 조합 ${v.rules.gender ? '켬' : '끔'} · 규칙 완화 ${relaxed}경기${manualN ? ` · 수동 변경 ${manualN}경기` : ''}`] : [],
          },
        ]}
      />
      {rd && v.games.length > 0 && (
        <>
          <button type="button" className="su-edit" style={{ alignSelf: 'flex-start' }} aria-expanded={showRounds} onClick={() => setShowRounds((x) => !x)} data-testid="show-rounds">
            {showRounds ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
            라운드별 대진 {showRounds ? '접기' : '보기'}
          </button>
          {showRounds && (
            <div className="su-rounds" data-testid="readonly-rounds">
              {rd.rounds.map((r) => (
                <RoundSection key={r.round} id={`ro-${r.round}`} round={r.round} phase="readonly" caption={r.caption} folded={folded.has(r.round)} onFold={() => setFolded((f) => (f.has(r.round) ? new Set([...f].filter((x) => x !== r.round)) : new Set([...f, r.round])))}>
                  <ol className="su-round-list">
                    {r.games.map((g) => (
                      <ReviewCard key={g.no} v={v} g={g} />
                    ))}
                  </ol>
                </RoundSection>
              ))}
            </div>
          )}
        </>
      )}
      <ValidationList title="확정 전 확인" items={checks} />
      <div className="su-note" data-tone="mint" style={{ flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
        <span style={{ display: 'flex', gap: 8 }}>
          <CircleCheck aria-hidden />
          확정하면 회원에게 공개됩니다
        </span>
        {rd && (
          <span style={{ display: 'flex', gap: 8 }}>
            <Play aria-hidden />
            확정하면 1라운드가 바로 시작됩니다
          </span>
        )}
      </div>
    </SetupFrame>
  )
}

type Game = ClubMatchView['games'][number]

/** (r14) 라운드 요약 계산: 라운드별 경기·출전·휴식, 같은 라운드 중복 출전, 코트 수 초과 */
function roundFacts(v: ClubMatchView) {
  const inPlay = participantsOf(v).filter((r) => v.method === 'individual' || r.team)
  const names = new Map(v.rows.map((r) => [r.key, r.name]))
  const byRound = new Map<number, Game[]>()
  for (const g of v.games) byRound.set(g.round ?? 1, [...(byRound.get(g.round ?? 1) ?? []), g])
  let dup: string | null = null
  let courtsOk = true
  const rounds = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, games]) => {
      const keys = games.filter((g) => !g.cancelled).flatMap((g) => [...g.team1, ...g.team2].map((p) => p.key))
      const twice = keys.find((k, i) => keys.indexOf(k) !== i)
      if (twice && !dup) dup = `같은 라운드 중복 출전 — ${round}라운드에 ${names.get(twice) ?? '선수'}가 두 경기에 있습니다`
      if (games.length > (v.courtCount ?? 0)) courtsOk = false
      const playing = new Set(keys)
      const rest = inPlay.filter((r) => !playing.has(r.key))
      const blueIn = inPlay.filter((r) => r.team === 'blue' && playing.has(r.key)).length
      const whiteIn = inPlay.filter((r) => r.team === 'white' && playing.has(r.key)).length
      const caption = v.method === 'individual' ? `코트 ${games.length}/${v.courtCount} · 출전 ${playing.size} · 휴식 ${rest.length}` : `코트 ${games.length}/${v.courtCount} · 청 ${blueIn}·백 ${whiteIn} · 휴식 ${rest.length}`
      return { round, games: [...games].sort((a, b) => (a.court ?? 0) - (b.court ?? 0)), playing: playing.size, restN: rest.length, blueIn, whiteIn, blueRest: rest.filter((r) => r.team === 'blue').length, whiteRest: rest.filter((r) => r.team === 'white').length, caption }
    })
  const first = rounds[0]
  const same = !!first && rounds.every((r) => r.playing === first.playing && r.blueIn === first.blueIn)
  const plays = rounds.map((r) => r.playing)
  const playText = !first
    ? ''
    : same
      ? v.method === 'individual'
        ? `라운드마다 출전 ${first.playing} · 휴식 ${first.restN}`
        : `라운드마다 청 ${first.blueIn}·백 ${first.whiteIn} 출전 · 휴식 청 ${first.blueRest}·백 ${first.whiteRest}`
      : `라운드별 출전 ${Math.min(...plays)}–${Math.max(...plays)}`
  return { rounds, dup: dup as string | null, courtsOk, playText }
}

/** 읽기 전용 경기 카드(CMP-041 표현, phase=review): '코트 m · n경기' + 양 팀 이름 */
function ReviewCard({ v, g }: { v: ClubMatchView; g: Game }) {
  const team = v.method === 'team'
  const line = (side: 0 | 1) => {
    const ps = side === 0 ? g.team1 : g.team2
    return (
      <div className="su-tl" data-team={team ? (side === 0 ? 'blue' : 'white') : undefined}>
        <b>{team ? (side === 0 ? '청' : '백') : side === 0 ? '1팀' : '2팀'}</b>
        <span className="su-players" style={{ minHeight: 36, alignItems: 'center' }}>
          {ps.map((p) => p.name).join(' · ')}
        </span>
        <span className="su-sum">{ps.reduce((n, p) => n + (p.score ?? 0), 0)}</span>
      </div>
    )
  }
  return (
    <li className="su-game" data-cmp="CMP-041" data-phase="review" aria-label={`${g.round}라운드 코트 ${g.court}, ${g.no}경기`}>
      <header>
        <span className="su-gno">
          코트 {g.court}
          <small> · {g.no}경기</small>
        </span>
      </header>
      {line(0)}
      {line(1)}
    </li>
  )
}
