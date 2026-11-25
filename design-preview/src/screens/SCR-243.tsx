import { AlertTriangle, ArrowLeftRight, Info, RotateCcw, Shuffle, Sparkles, Undo2, UserRoundPen, Users } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Dialog, PersonMeta, SectionTitle, SetupScreen, StepBar, stepHref } from '../components/smapsh/Setup'
import { person, proposeTeams, ROSTER, SELECTED_16, sum, type Team } from '../mock/setup'

// SCR-243 청백전 생성 · 팀 구성(팀전) — UX Spec r9 02 SCR-243, UXD-095 r9 / DD r12 VD-065, REF-005
// 팀 구성 방식(자동 배정·직접 구성)은 '행동'이라 저장하지 않습니다. 다시 들어오면 선택 표시 없이 저장된 배정을 복원합니다(ST1).
// 사람 행을 누르면 반대 팀으로 옮기고, 바로 아래 알림 줄의 '되돌리기'로 한 번 취소합니다. 미배정은 '청팀'·'백팀'을 직접 눌러야 배정됩니다.
// 보기: ST1(저장된 배정 복원) · ST7(처음 진입 자동 배정안) · ST8(미배정 2명) · ST9(백팀 1명) · ST10(인원 차이 경고) · ST11(대진 폐기 확인) · ST12(자동 배정 확인) · ST13(직접 구성 확인) · ST14(직접 구성, 모두 미배정)
type Assign = Record<string, Team | null>
type Method = 'auto' | 'manual'
// 목록 순서는 명단 순서(회원 이름순 → 게스트)
const IDS = ROSTER.map((p) => p.id).filter((id) => SELECTED_16.includes(id))
const PROPOSED = proposeTeams(IDS)
const TEAM_NAME: Record<Team, string> = { blue: '청팀', white: '백팀' }
const other = (t: Team): Team => (t === 'blue' ? 'white' : 'blue')

function startAssign(st: string): Assign {
  const a: Assign = { ...PROPOSED }
  if (st === 'SCR-243-ST1' || st === 'SCR-243-ST11' || st === 'SCR-243-ST12' || st === 'SCR-243-ST13') {
    // 저장된 배정: 알고리즘 배정안에서 직접 바꿔 둔 상태
    // 같은 성별 두 사람을 서로 바꿔 둔 상태(인원은 같음)
    const mate = IDS.find((id) => PROPOSED[id] !== PROPOSED.p05 && person(id).gender === person('p05').gender)!
    a.p05 = PROPOSED[mate]
    a[mate] = PROPOSED.p05
  }
  if (st === 'SCR-243-ST8') { a.p19 = null; a.g01 = null }
  if (st === 'SCR-243-ST9') IDS.forEach((id, i) => (a[id] = i === 3 ? 'white' : 'blue'))
  if (st === 'SCR-243-ST10') { const w = IDS.find((id) => a[id] === 'white')!; a[w] = 'blue' }
  if (st === 'SCR-243-ST14') IDS.forEach((id) => (a[id] = null))
  return a
}

export function Scr243({ stateId }: { stateId: string }) {
  const st = stateId
  const [assign, setAssign] = useState<Assign>(() => startAssign(st))
  const [saved] = useState<Assign>(() => startAssign(st === 'SCR-243-ST7' || st === 'SCR-243-ST14' ? 'SCR-243-ST1' : st))
  const [method, setMethod] = useState<Method | null>(st === 'SCR-243-ST7' ? 'auto' : st === 'SCR-243-ST14' ? 'manual' : null)
  const [note, setNote] = useState<string | null>(st === 'SCR-243-ST7' ? '알고리즘 배정안을 채웠습니다. 아직 저장 전입니다' : null)
  const [last, setLast] = useState<{ id: string; from: Team | null; to: Team } | null>(st === 'SCR-243-ST11' ? { id: 'p01', from: PROPOSED.p01, to: other(PROPOSED.p01) } : null)
  const [live, setLive] = useState('')
  const [gamesSaved, setGamesSaved] = useState(st === 'SCR-243-ST11')
  const [dialog, setDialog] = useState<'discard' | 'auto' | 'manual' | null>(st === 'SCR-243-ST11' ? 'discard' : st === 'SCR-243-ST12' ? 'auto' : st === 'SCR-243-ST13' ? 'manual' : null)
  // ST11: 첫 이동(김민수 → 반대 팀)을 한 직후 확인 창이 뜬 장면
  const [pending, setPending] = useState<Assign | null>(st === 'SCR-243-ST11' ? { ...startAssign(st), p01: other(PROPOSED.p01) } : null)
  const shownAssign = pending ?? assign

  const ids = (t: Team | null) => IDS.filter((id) => shownAssign[id] === t)
  const blue = ids('blue'), white = ids('white'), none = ids(null)
  const dirty = IDS.some((id) => assign[id] !== saved[id])
  const reason = none.length ? `미배정 ${none.length}명의 팀을 골라 주세요` : blue.length < 2 ? '청팀이 2명 이상이어야 합니다' : white.length < 2 ? '백팀이 2명 이상이어야 합니다' : undefined
  const gap = Math.abs(blue.length - white.length)

  const apply = (next: Assign, move: { id: string; from: Team | null; to: Team }) => {
    if (gamesSaved) { setPending(next); setLast(move); setDialog('discard'); return }
    setAssign(next)
    setLast(move)
    setNote(null)
    setLive(`${person(move.id).name}, ${TEAM_NAME[move.to]}으로 이동`)
  }
  const move = (id: string, to: Team) => apply({ ...assign, [id]: to }, { id, from: assign[id], to })
  const undo = () => {
    if (!last) return
    setAssign((a) => ({ ...a, [last.id]: last.from }))
    setLive(`${person(last.id).name}, 되돌림`)
    setLast(null)
  }
  const pickMethod = (m: Method) => {
    const anyAssigned = IDS.some((id) => assign[id])
    if (anyAssigned && !(m === 'auto' && method === 'auto')) { setDialog(m); return }
    runMethod(m)
  }
  const runMethod = (m: Method) => {
    setMethod(m)
    setLast(null)
    if (m === 'auto') { setAssign({ ...PROPOSED }); setNote('알고리즘 배정안으로 다시 나눴습니다. 아직 저장 전입니다'); setLive('알고리즘 배정안으로 나눔') }
    else { setAssign(Object.fromEntries(IDS.map((id) => [id, null]))); setNote('모든 참가자를 미배정으로 옮겼습니다. 사람마다 팀을 골라 주세요'); setLive('모든 참가자 미배정') }
  }

  const teamCard = (t: Team, list: string[]) => {
    const male = list.filter((id) => person(id).gender === '남').length
    return (
      <div className="su-team" data-team={t} aria-label={`${TEAM_NAME[t]} ${list.length}명, 남 ${male} 여 ${list.length - male}, 점수 합 ${sum(list)}`}>
        <h4>
          <Users aria-hidden />
          {TEAM_NAME[t]} <small>{list.length}명</small>
        </h4>
        <div className="su-stack" aria-hidden>
          {list.slice(0, 5).map((id) => <Avatar key={id} name={person(id).name} />)}
          {list.length > 5 && <span className="su-plus">+{list.length - 5}</span>}
          {list.length === 0 && <span className="su-team-meta">아직 없음</span>}
        </div>
        <span className="su-team-meta">
          남 {male} · 여 {list.length - male} · 점수 합 {sum(list)}
        </span>
      </div>
    )
  }

  const row = (id: string) => {
    const p = person(id)
    const t = shownAssign[id]
    if (!t)
      return (
        <li key={id}>
          <div className="su-row" data-cmp="CMP-024" data-mode="assign">
            <Avatar name={p.name} />
            <span className="su-who">
              <span className="su-name">{p.name}</span>
              <PersonMeta p={p} />
            </span>
            <span className="su-pick2" role="group" aria-label={`${p.name} 팀 고르기`}>
              <button type="button" data-team="blue" onClick={() => move(id, 'blue')} aria-label={`${p.name} 청팀에 배정`}>청팀</button>
              <button type="button" data-team="white" onClick={() => move(id, 'white')} aria-label={`${p.name} 백팀에 배정`}>백팀</button>
            </span>
          </div>
        </li>
      )
    return (
      <li key={id}>
        <button type="button" className="su-row" data-cmp="CMP-024" data-mode="move" onClick={() => move(id, other(t))} aria-label={`${p.name}, ${TEAM_NAME[t]}. 누르면 ${TEAM_NAME[other(t)]}으로 이동`}>
          <span className="su-band" data-team={t} aria-hidden />
          <Avatar name={p.name} />
          <span className="su-who">
            <span className="su-name">{p.name}</span>
            <PersonMeta p={p} />
          </span>
          <span className="su-teamrow-to" aria-hidden>
            {TEAM_NAME[other(t)]}으로
            <ArrowLeftRight />
          </span>
        </button>
      </li>
    )
  }

  return (
    <SetupScreen
      scr="SCR-243"
      st={stateId}
      method="team"
      step="teams"
      title="팀 구성"
      desc="참가자를 청팀과 백팀으로 나눠 주세요."
      compact
      card={
        <>
          <section className="su-sec" aria-labelledby="s243-m">
            <span id="s243-m">
              <SectionTitle icon={<Shuffle aria-hidden />}>팀 구성 방식</SectionTitle>
            </span>
            <div className="su-tiles" role="radiogroup" aria-label="팀 구성 방식" data-cmp="CMP-002" data-kind="action">
              {([
                ['auto', '자동 배정', <Shuffle key="a" aria-hidden />],
                ['manual', '직접 구성', <UserRoundPen key="m" aria-hidden />],
              ] as const).map(([v, label, icon]) => (
                <button key={v} type="button" role="radio" aria-checked={method === v} className="su-tile" onClick={() => pickMethod(v)}>
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            {note && (
              <p className="su-note" data-tone="mint" role="status">
                <Sparkles aria-hidden />
                <span>{note}</span>
              </p>
            )}
            {dirty && !note && (
              <button type="button" className="su-regen" onClick={() => { setAssign({ ...saved }); setLast(null); setMethod(null); setLive('저장된 배정으로 되돌림') }}>
                <RotateCcw aria-hidden />
                저장된 배정으로 되돌리기
              </button>
            )}
          </section>
          <section className="su-sec" aria-label="팀 현황" style={{ gap: 0 }}>
            <div className="su-sticky" data-testid="su-fixed-top" data-cmp="CMP-028" data-kind="teamBalance">
              <div className="su-teams">
                {teamCard('blue', blue)}
                {teamCard('white', white)}
              </div>
              <p className="su-balance">
                점수 합 차이 <b>{Math.abs(sum(blue) - sum(white))}</b> · 인원 차이 <b>{gap}</b>
                {none.length > 0 && <> · 미배정 <b>{none.length}</b></>}
              </p>
              {gap >= 2 && !reason && (
                <p className="su-note" data-tone="warning" role="status" style={{ margin: 0 }}>
                  <AlertTriangle aria-hidden />
                  <span>
                    두 팀 인원이 2명 이상 차이 납니다(청 {blue.length} · 백 {white.length})
                  </span>
                </p>
              )}
              {last && !dialog && (
                <div className="su-moved" role="status">
                  {person(last.id).name} → {TEAM_NAME[last.to]}
                  <button type="button" onClick={undo}>
                    <Undo2 aria-hidden />
                    되돌리기
                  </button>
                </div>
              )}
            </div>
            <span className="sr-only" aria-live="polite">{live}</span>
            <div className="su-teamlist" data-testid="su-rows">
              {none.length > 0 && (
                <div>
                  <h3>
                    <AlertTriangle aria-hidden className="size-4" />
                    미배정 {none.length}명 · 팀을 골라 주세요
                  </h3>
                  <ul className="su-list su-unassigned" aria-label="미배정">{none.map(row)}</ul>
                </div>
              )}
              {blue.length > 0 && (
                <div>
                  <h3>청팀 {blue.length}명</h3>
                  <ul className="su-list" aria-label="청팀">{blue.map(row)}</ul>
                </div>
              )}
              {white.length > 0 && (
                <div>
                  <h3>백팀 {white.length}명</h3>
                  <ul className="su-list" aria-label="백팀">{white.map(row)}</ul>
                </div>
              )}
            </div>
            <p className="su-dist" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <Info aria-hidden className="size-4" />
              다음 단계에서 대진을 설정할 수 있어요
            </p>
          </section>
        </>
      }
      bar={<StepBar prev={stepHref('SCR-242', 'team', 'SCR-242-ST8')} next={stepHref('SCR-244', 'team')} disabledReason={reason} />}
      overlay={
        dialog === 'discard' ? (
          <Dialog
            title="대진이 초기화됩니다"
            desc="팀 배정을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다"
            ok="바꾸기"
            onCancel={() => { setPending(null); setLast(null); setDialog(null) }}
            onOk={() => { if (pending) setAssign(pending); setPending(null); setGamesSaved(false); setDialog(null) }}
          />
        ) : dialog === 'auto' ? (
          <Dialog title="알고리즘 배정안으로 다시 나눌까요?" desc="직접 바꾼 팀 배정이 알고리즘 배정안으로 바뀝니다" ok="다시 나누기" onCancel={() => setDialog(null)} onOk={() => { setDialog(null); runMethod('auto') }} />
        ) : dialog === 'manual' ? (
          <Dialog title="직접 구성으로 바꿀까요?" desc="지금 팀 배정이 모두 지워지고 모든 참가자가 미배정이 됩니다" ok="바꾸기" onCancel={() => setDialog(null)} onOk={() => { setDialog(null); runMethod('manual') }} />
        ) : undefined
      }
    />
  )
}
