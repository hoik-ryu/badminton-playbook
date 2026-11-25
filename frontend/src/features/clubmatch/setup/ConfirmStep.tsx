import { CalendarDays, Check, CircleCheck, FileText, ListOrdered, PenLine, Shuffle, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { NoticeBox } from '../../../components/NoticeBox'
import { SetupSummary } from '../../../components/SetupSummary'
import { StepActionBar } from '../../../components/StepActionBar'
import { ValidationList, type ValidationItem } from '../../../components/ValidationList'
import { isApiError } from '../../../lib/api'
import { CLUB_ERRORS, confirmClub, METHOD_LABEL, type ParticipantRow } from '../api'
import { dateLabel } from './format'
import { SetupFrame } from './SetupFrame'
import { completion, MIN_PARTICIPANTS, participantsOf, teamsProblem } from './steps'
import type { StepProps } from './types'

// SCR-245 청백전 생성 · 확정 — UX Spec r9 02 SCR-245(UXD-097·006·010·099), DD r12 VD-067, Preview r8
// 요약(CMP-056: 기본정보 → 참가자 → 팀 구성(팀전) → 대진, 묶음마다 '수정') · 검증 목록(CMP-055) · 공개 안내 · '확정' → 확인 창(ST8) → SCR-112
// 시안의 "생성 후에도 일부 설정은 수정할 수 있어요"는 승인 정책과 달라 쓰지 않음(VD-067)
const sumOf = (rows: ParticipantRow[]) => rows.reduce((s, r) => s + (r.score ?? 0), 0)
const genders = (rows: ParticipantRow[]) => `남 ${rows.filter((r) => r.gender === '남').length} · 여 ${rows.filter((r) => r.gender === '여').length}`

export function ConfirmStep({ c, frame, go }: StepProps) {
  const navigate = useNavigate()
  const v = c.view!
  const [ask, setAsk] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
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

  const checks: ValidationItem[] = [
    { key: 'count', ok: parts.length >= MIN_PARTICIPANTS, text: parts.length >= MIN_PARTICIPANTS ? `참가자 4명 이상(${parts.length}명)` : `참가자가 4명 미만입니다(${parts.length}명)`, onFix: () => go('participants') },
    { key: 'scores', ok: unscored.length === 0, text: unscored.length === 0 ? '점수 미설정 0명' : `점수 미설정 ${unscored.length}명(${unscored.map((r) => r.name).join(', ')})`, onFix: () => go('participants') },
    ...(v.method === 'team' ? [{ key: 'teams', ok: done.teams, text: done.teams ? '미배정 0명 · 팀당 2명 이상' : (teamsProblem(parts.map((r) => r.team)) ?? '팀 구성을 확인해 주세요'), onFix: () => go('teams') }] : []),
    { key: 'games', ok: v.games.length > 0, text: v.games.length > 0 ? `대진 있음(${v.games.length}경기)` : '대진 없음 — 대진을 다시 만들어 주세요', onFix: () => go('games') },
  ]
  const allOk = checks.every((x) => x.ok)

  const confirm = async () => {
    setFailed(null)
    const r = await c.save(() => confirmClub(v.id, v.version), (x) => x.status !== 'draft', () => setAsk(true))
    if (r.kind === 'ok') navigate(`/club-matches/${encodeURIComponent(v.id)}`, { replace: true, state: { confirmed: true } })
    else if (r.kind === 'failed') setFailed(isApiError(r.error) && [CLUB_ERRORS.noGames, CLUB_ERRORS.locked, CLUB_ERRORS.unscored, CLUB_ERRORS.unassigned].includes(r.error.code as never) ? r.error.message : '확정하지 못했습니다. 다시 시도해 주세요')
  }

  const st = ask ? 'SCR-245-ST8' : c.conflict ? 'SCR-245-ST6' : c.saving ? 'SCR-245-ST2' : failed ? 'SCR-245-ST4' : !allOk ? 'SCR-245-ST7' : 'SCR-245-ST1'
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
      notice={
        failed && (
          <NoticeBox tone="danger" action={<button type="button" className="su-link" onClick={() => setAsk(true)}>다시 시도</button>}>
            {failed}
          </NoticeBox>
        )
      }
      bar={<StepActionBar onPrev={() => go('games')} onNext={() => setAsk(true)} nextLabel="확정" nextIcon={<Check aria-hidden />} disabledReason={allOk ? undefined : '확인이 필요한 항목을 먼저 고쳐 주세요'} loading={c.saving} />}
      overlay={<ConfirmDialog open={ask} onOpenChange={setAsk} title="대진을 확정하고 회원에게 공개할까요?" description="확정 후에는 방식을 바꾸거나 다시 생성할 수 없습니다" confirmLabel="확정" onConfirm={confirm} />}
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
          {
            icon: <ListOrdered aria-hidden />,
            label: '대진',
            value: v.games.length ? `${v.games.length}경기` : '없음',
            sub: v.games.length ? [`1인 ${minN === maxN ? minN : `${minN}–${maxN}`}경기 · 밸런스 ${v.rules.balance ? '켬' : '끔'}·성별 조합 ${v.rules.gender ? '켬' : '끔'} · 규칙 완화 ${relaxed}경기`] : [],
          },
        ]}
      />
      <ValidationList title="확정 전 확인" items={checks} />
      <p className="su-note" data-tone="mint">
        <CircleCheck aria-hidden />
        <span>확정하면 회원에게 공개됩니다</span>
      </p>
    </SetupFrame>
  )
}
