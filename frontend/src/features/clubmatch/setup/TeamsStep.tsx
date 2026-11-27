import { ArrowLeftRight, Info, RotateCcw, Shuffle, Sparkles, TriangleAlert, Undo2, UserRoundPen, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { NoticeBox } from '../../../components/NoticeBox'
import { StepActionBar } from '../../../components/StepActionBar'
import { StickySummary } from '../../../components/StickySummary'
import { saveTeams, type ParticipantRow, type Team } from '../api'
import { proposeTeams } from '../schedule'
import { personLabel } from './format'
import { Avatar, MethodTiles, PersonMeta, SectionTitle } from './parts'
import { SetupFrame } from './SetupFrame'
import { participantsOf, teamsProblem } from './steps'
import type { StepProps } from './types'
import { savedTeams, sameTeams } from './useSetup'

// SCR-243 청백전 생성 · 팀 구성(팀전) — UX Spec r9 02 SCR-243(UXD-095 r9·098·099), DD r12 VD-064·065, Preview r8
// 팀 구성 방식(자동 배정·직접 구성)은 실행하는 행동이며 저장하지 않음(C-34 r10). 저장된 배정이 하나도 없을 때 처음 들어오면
// 자동 배정안을 채움(ST7, 이 페이지 안에서 한 번). 사람 행을 누르면 반대 팀, 알림 줄 '되돌리기'로 한 번 취소(aria-live로 읽음).
// 미배정은 '청팀'·'백팀'을 직접 눌러야 배정. '다음'에서 팀 배정 전체를 한 번에 저장(AC-127). 대진이 있으면 첫 변경 때 폐기 확인(ST11)
type Ask = { kind: 'discard'; run: () => void } | { kind: 'auto' } | { kind: 'manual' } | null
const NAME: Record<Team, string> = { blue: '청팀', white: '백팀' }
const other = (t: Team): Team => (t === 'blue' ? 'white' : 'blue')
const sumOf = (rows: ParticipantRow[]) => rows.reduce((s, r) => s + (r.score ?? 0), 0)

export function TeamsStep({ c, frame, go }: StepProps) {
  const v = c.view!
  const parts = participantsOf(v).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'ko') : a.kind === 'member' ? -1 : 1))
  const teams = c.drafts.teams
  const ui = c.drafts.teamUi
  const [ask, setAsk] = useState<Ask>(null)
  const [live, setLive] = useState('')
  const setUi = (patch: Partial<typeof ui>) => c.setDrafts((d) => ({ ...d, teamUi: { ...d.teamUi, ...patch } }))
  const proposal = () => proposeTeams(parts.filter((r) => r.gender !== null).map((r) => ({ key: r.key, gender: r.gender!, score: r.score })))

  // ST7: 저장된 배정이 하나도 없는 상태로 처음 들어오면 알고리즘 배정안을 채움(아직 저장 전). 페이지 안에서 다시 들어오면 실행하지 않음
  useEffect(() => {
    if (ui.seeded) return
    const noneSaved = Object.values(savedTeams(v)).every((t) => t === null)
    if (noneSaved && parts.length > 0 && Object.values(teams).every((t) => t === null)) {
      const p = proposal()
      c.setDrafts((d) => ({ ...d, teams: { ...d.teams, ...p }, teamUi: { method: 'auto', note: '알고리즘 배정안을 채웠습니다. 아직 저장 전입니다', lastMove: null, seeded: true } }))
    } else setUi({ seeded: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 들어올 때 한 번만
  }, [])

  const keys = parts.map((r) => r.key)
  const ids = (t: Team | null) => parts.filter((r) => (teams[r.key] ?? null) === t)
  const blue = ids('blue')
  const white = ids('white')
  const none = ids(null)
  const problem = teamsProblem(keys.map((k) => teams[k] ?? null))
  const gap = Math.abs(blue.length - white.length)
  const dirty = !sameTeams(Object.fromEntries(keys.map((k) => [k, teams[k] ?? null])), savedTeams(v))

  /** 대진이 저장돼 있으면 첫 팀 변경 전에 폐기 확인(ST11). 취소하면 그 변경을 하지 않음 */
  const guard = (change: () => void) => {
    if (v.games.length > 0 && !c.drafts.discard.teams) setAsk({ kind: 'discard', run: change })
    else change()
  }
  const move = (key: string, to: Team) =>
    guard(() => {
      const from = teams[key] ?? null
      c.setDrafts((d) => ({ ...d, teams: { ...d.teams, [key]: to }, teamUi: { ...d.teamUi, lastMove: { key, from, to }, note: null } }))
      const name = parts.find((r) => r.key === key)?.name ?? ''
      setLive(`${name}, ${NAME[to]}으로 이동`)
    })
  const undo = () => {
    const m = ui.lastMove
    if (!m) return
    c.setDrafts((d) => ({ ...d, teams: { ...d.teams, [m.key]: m.from }, teamUi: { ...d.teamUi, lastMove: null } }))
    setLive(`${parts.find((r) => r.key === m.key)?.name ?? ''}, 되돌림`)
  }
  const runMethod = (m: 'auto' | 'manual') => {
    if (m === 'auto') {
      const p = proposal()
      c.setDrafts((d) => ({ ...d, teams: Object.fromEntries(keys.map((k) => [k, p[k] ?? null])), teamUi: { ...d.teamUi, method: 'auto', note: '알고리즘 배정안으로 다시 나눴습니다. 아직 저장 전입니다', lastMove: null } }))
      setLive('알고리즘 배정안으로 나눔')
    } else {
      c.setDrafts((d) => ({ ...d, teams: Object.fromEntries(keys.map((k) => [k, null])), teamUi: { ...d.teamUi, method: 'manual', note: '모든 참가자를 미배정으로 옮겼습니다. 사람마다 팀을 골라 주세요', lastMove: null } }))
      setLive('모든 참가자 미배정')
    }
  }
  const pickMethod = (m: 'auto' | 'manual') =>
    guard(() => {
      const anyAssigned = keys.some((k) => teams[k])
      if (anyAssigned) setAsk({ kind: m })
      else runMethod(m)
    })
  const revert = () => {
    c.setDrafts((d) => ({ ...d, teams: savedTeams(v), teamUi: { ...d.teamUi, method: null, note: null, lastMove: null } }))
    setLive('저장된 배정으로 되돌림')
  }

  async function next(forceDiscard = false) {
    if (problem) return
    if (!dirty) return go('games')
    const assign = Object.fromEntries(keys.map((k) => [k, teams[k] as Team]))
    const r = await c.save(
      () => saveTeams(v.id, v.version, assign, forceDiscard || c.drafts.discard.teams),
      (x) => participantsOf(x).every((p) => assign[p.key] === p.team),
      () => void next(),
    )
    if (r.kind === 'ok') {
      c.accept(r.view, { teams: true })
      go('games')
    } else if (r.kind === 'confirm') setAsk({ kind: 'discard', run: () => void next(true) })
    else if (r.kind === 'failed') c.setFailure({ message: '저장하지 못했습니다. 입력한 내용은 그대로입니다', retry: () => void next() })
  }

  const st =
    ask?.kind === 'discard' ? 'SCR-243-ST11' : ask?.kind === 'auto' ? 'SCR-243-ST12' : ask?.kind === 'manual' ? 'SCR-243-ST13' : c.conflict ? 'SCR-243-ST6' : c.saving ? 'SCR-243-ST2' : c.failure ? 'SCR-243-ST4' : ui.method === 'manual' && none.length === parts.length ? 'SCR-243-ST14' : none.length ? 'SCR-243-ST8' : problem ? 'SCR-243-ST9' : ui.method === 'auto' && ui.note && !ui.lastMove ? 'SCR-243-ST7' : gap >= 2 ? 'SCR-243-ST10' : 'SCR-243-ST1'

  const teamCard = (t: Team, list: ParticipantRow[]) => {
    const male = list.filter((r) => r.gender === '남').length
    return (
      <div className="su-team" data-team={t} aria-label={`${NAME[t]} ${list.length}명, 남 ${male} 여 ${list.length - male}, 점수 합 ${sumOf(list)}`}>
        <h4>
          <Users aria-hidden />
          {NAME[t]} <small>{list.length}명</small>
        </h4>
        <div className="su-stack" aria-hidden>
          {list.slice(0, 5).map((r) => (
            <Avatar key={r.key} name={r.name} />
          ))}
          {list.length > 5 && <span className="su-plus">+{list.length - 5}</span>}
          {list.length === 0 && <span className="su-team-meta">아직 없음</span>}
        </div>
        <span className="su-team-meta">
          남 {male} · 여 {list.length - male} · 점수 합 {sumOf(list)}
        </span>
      </div>
    )
  }
  const row = (r: ParticipantRow) => {
    const t = teams[r.key] ?? null
    if (!t)
      return (
        <li key={r.key}>
          <div className="su-row" data-mode="assign">
            <Avatar name={r.name} />
            <span className="su-who">
              <span className="su-name">{r.name}</span>
              <PersonMeta p={r} />
            </span>
            <span className="su-pick2" role="group" aria-label={`${r.name} 팀 고르기`}>
              <button type="button" data-team="blue" onClick={() => move(r.key, 'blue')} aria-label={`${r.name} 청팀에 배정`}>
                청팀
              </button>
              <button type="button" data-team="white" onClick={() => move(r.key, 'white')} aria-label={`${r.name} 백팀에 배정`}>
                백팀
              </button>
            </span>
          </div>
        </li>
      )
    return (
      <li key={r.key}>
        <button type="button" className="su-row" data-mode="move" onClick={() => move(r.key, other(t))} aria-label={`${personLabel(r)}, ${NAME[t]}. 누르면 ${NAME[other(t)]}으로 이동`}>
          <span className="su-band" data-team={t} aria-hidden />
          <Avatar name={r.name} />
          <span className="su-who">
            <span className="su-name">{r.name}</span>
            <PersonMeta p={r} />
          </span>
          <span className="su-teamrow-to" aria-hidden>
            {NAME[other(t)]}으로
            <ArrowLeftRight />
          </span>
        </button>
      </li>
    )
  }

  return (
    <SetupFrame
      scr="SCR-243"
      st={st}
      method="team"
      title="팀 구성"
      desc="참가자를 청팀과 백팀으로 나눠 주세요."
      compact
      steps={frame.steps}
      current="teams"
      onStep={frame.onStep}
      onExit={frame.onExit}
      onMore={frame.onMore}
      moreNotice={frame.moreNotice}
      notice={
        c.failure && (
          <NoticeBox tone="danger" action={<button type="button" className="su-link" onClick={c.failure.retry}>다시 시도</button>}>
            {c.failure.message}
          </NoticeBox>
        )
      }
      bar={<StepActionBar onPrev={() => go('participants')} onNext={() => void next()} disabledReason={problem ?? undefined} loading={c.saving} />}
      overlay={
        <>
          <ConfirmDialog
            open={ask?.kind === 'discard'}
            onOpenChange={(o) => !o && setAsk((a) => (a?.kind === 'discard' ? null : a))}
            title="대진이 초기화됩니다"
            description="팀 배정을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다"
            confirmLabel="바꾸기"
            onConfirm={() => {
              const run = ask?.kind === 'discard' ? ask.run : null
              c.setDrafts((d) => ({ ...d, discard: { ...d.discard, teams: true } }))
              setAsk(null)
              run?.() // 자동 배정·직접 구성이면 이어서 그 확인 창(ST12·ST13)
            }}
          />
          <ConfirmDialog open={ask?.kind === 'auto'} onOpenChange={(o) => !o && setAsk(null)} title="알고리즘 배정안으로 다시 나눌까요?" description="직접 바꾼 팀 배정이 알고리즘 배정안으로 바뀝니다" confirmLabel="다시 나누기" onConfirm={() => runMethod('auto')} />
          <ConfirmDialog open={ask?.kind === 'manual'} onOpenChange={(o) => !o && setAsk(null)} title="직접 구성으로 바꿀까요?" description="지금 팀 배정이 모두 지워지고 모든 참가자가 미배정이 됩니다" confirmLabel="바꾸기" onConfirm={() => runMethod('manual')} />
        </>
      }
    >
      <section className="su-sec" aria-labelledby="s243-m">
        <SectionTitle id="s243-m" icon={<Shuffle aria-hidden />}>
          팀 구성 방식
        </SectionTitle>
        <MethodTiles<'auto' | 'manual'>
          label="팀 구성 방식"
          value={ui.method}
          onChange={pickMethod}
          options={[
            { value: 'auto', label: '자동 배정', icon: <Shuffle aria-hidden /> },
            { value: 'manual', label: '직접 구성', icon: <UserRoundPen aria-hidden /> },
          ]}
        />
        {ui.note && (
          <p className="su-note" data-tone="mint" role="status">
            <Sparkles aria-hidden />
            <span>{ui.note}</span>
          </p>
        )}
        {dirty && !ui.note && (
          <button type="button" className="su-regen" onClick={revert}>
            <RotateCcw aria-hidden />
            저장된 배정으로 되돌리기
          </button>
        )}
      </section>
      <section className="su-sec" aria-label="팀 현황" style={{ gap: 0 }}>
        <StickySummary kind="teamBalance">
          <div className="su-teams">
            {teamCard('blue', blue)}
            {teamCard('white', white)}
          </div>
          <p className="su-balance">
            점수 합 차이 <b>{Math.abs(sumOf(blue) - sumOf(white))}</b> · 인원 차이 <b>{gap}</b>
            {none.length > 0 && (
              <>
                {' '}
                · 미배정 <b>{none.length}</b>
              </>
            )}
          </p>
          {gap >= 2 && !problem && (
            <p className="su-note" data-tone="warning" role="status" style={{ margin: 0 }}>
              <TriangleAlert aria-hidden />
              <span>
                두 팀 인원이 2명 이상 차이 납니다(청 {blue.length} · 백 {white.length})
              </span>
            </p>
          )}
          {ui.lastMove && (
            <div className="su-moved" role="status">
              {parts.find((r) => r.key === ui.lastMove!.key)?.name} → {NAME[ui.lastMove.to]}
              <button type="button" onClick={undo}>
                <Undo2 aria-hidden />
                되돌리기
              </button>
            </div>
          )}
        </StickySummary>
        <span className="sr-only" aria-live="polite">
          {live}
        </span>
        <div className="su-teamlist" data-testid="su-rows">
          {none.length > 0 && (
            <div>
              <h3>
                <TriangleAlert aria-hidden className="size-4" />
                미배정 {none.length}명 · 팀을 골라 주세요
              </h3>
              <ul className="su-list su-unassigned" aria-label="미배정">
                {none.map(row)}
              </ul>
            </div>
          )}
          {blue.length > 0 && (
            <div>
              <h3>청팀 {blue.length}명</h3>
              <ul className="su-list" aria-label="청팀">
                {blue.map(row)}
              </ul>
            </div>
          )}
          {white.length > 0 && (
            <div>
              <h3>백팀 {white.length}명</h3>
              <ul className="su-list" aria-label="백팀">
                {white.map(row)}
              </ul>
            </div>
          )}
        </div>
        <p className="su-dist" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Info aria-hidden className="size-4" />
          다음 단계에서 대진을 설정할 수 있어요
        </p>
      </section>
    </SetupFrame>
  )
}

