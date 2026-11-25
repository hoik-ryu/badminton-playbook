import { CalendarDays, Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, FileText, Grid2x2, ListOrdered, PenLine, Pencil, Play, Shuffle, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Dialog, SetupScreen, StepBar, stepHref } from '../components/smapsh/Setup'
import { RoundHead } from '../components/smapsh/Rounds'
import { courtOf, noOf, roundDataset, roundPlay, roundsOf, type Dataset, type EGame } from '../mock/editor'
import { person, sum } from '../mock/setup'

// SCR-245 청백전 생성 · 확정 — UX Spec r9 02 SCR-245, UXD-097 / DD r12 VD-067, REF-005(확인 화면)
// 요약 묶음(기본정보·참가자·팀 구성·대진)마다 '수정', 검증 목록, 공개 안내, '확정' → 확인 창(ST8).
// 시안 문구 "생성 후에도 일부 설정은 수정할 수 있어요"는 승인 정책(확정 후 방식·재생성 불가)과 달라 쓰지 않습니다.
// 보기: ST1(모두 통과) · ST1-EDIT((r13) 편집한 대진: 실제 9경기 · 수동 변경 1, VD-075) · ST7(검증 실패) · ST8(확정 확인) — 개인전은 끝에 -IND
// (r14) 라운드 요약(VD-082): '코트·라운드' 행, '라운드별 대진 보기'(읽기 전용 구역, 기본 접힘), 라운드 검증 2개, 1라운드 시작 안내. ST9 라운드 검증 실패(서버 재검사)

export function Scr245({ stateId }: { stateId: string }) {
  const ind = stateId.endsWith('-IND')
  const st = stateId.replace(/-IND$/, '')
  const method = ind ? 'individual' : 'team'
  const ds = roundDataset(method)
  const IDS = ds.ids
  const TEAMS = ds.teams ?? {}
  const [showRounds, setShowRounds] = useState(false)
  const [folded, setFolded] = useState<Set<number>>(new Set())
  const roundFail = st === 'SCR-245-ST9'
  const rounds = roundsOf(ds.games)
  const plays = rounds.map((r) => roundPlay(ds, ds.games, r.round))
  const sameEvery = plays.every((p) => p.playing.length === plays[0].playing.length)
  const [dialog, setDialog] = useState(st === 'SCR-245-ST8')
  const fail = st === 'SCR-245-ST7'
  const edit = st === 'SCR-245-ST1-EDIT'
  const games = edit ? ds.games.length - 1 : ds.games.length
  const male = IDS.filter((id) => person(id).gender === '남').length
  const guests = IDS.filter((id) => person(id).guest).length
  const blue = IDS.filter((id) => TEAMS[id] === 'blue')
  const white = IDS.filter((id) => TEAMS[id] === 'white')
  const g = (ids: string[]) => `남 ${ids.filter((id) => person(id).gender === '남').length} · 여 ${ids.filter((id) => person(id).gender === '여').length}`
  const checks: { ok: boolean; text: string; fix?: string }[] = [
    { ok: true, text: `참가자 4명 이상(${IDS.length}명)` },
    fail ? { ok: false, text: '점수 미설정 1명(조민재)', fix: stepHref('SCR-242', method, 'SCR-242-ST7') } : { ok: true, text: '점수 미설정 0명' },
    ...(ind ? [] : [{ ok: true, text: '미배정 0명 · 팀당 2명 이상' }]),
    fail ? { ok: false, text: '대진 없음 — 대진을 다시 만들어 주세요', fix: stepHref('SCR-244', method) } : { ok: true, text: `대진 있음(${games}경기)` },
    ...(fail ? [] : [
      roundFail ? { ok: false, text: '같은 라운드 중복 출전 — 3라운드에 김민수가 두 경기에 있습니다', fix: stepHref('SCR-244', method, 'SCR-244-ST7') } : { ok: true, text: '같은 라운드 중복 출전 없음' },
      { ok: true, text: `라운드마다 경기 수 ≤ 코트 수(${ds.courts})` },
    ]),
  ]
  const allOk = checks.every((c) => c.ok)
  const group = (title: string, href: string, rows: ReactNode) => (
    <section className="su-sum-group" data-cmp="CMP-056" aria-label={title}>
      <div className="su-sum-head">
        <h3>{title}</h3>
        <a className="su-edit" href={href} aria-label={`${title} 수정`}>
          <Pencil aria-hidden />
          수정
        </a>
      </div>
      {rows}
    </section>
  )
  const kv = (icon: ReactNode, k: string, v: ReactNode) => (
    <div className="su-kv">
      {icon}
      <span>{k}</span>
      <b>{v}</b>
    </div>
  )
  return (
    <SetupScreen
      scr="SCR-245"
      st={stateId}
      method={method}
      step="confirm"
      title="확정"
      desc="설정을 확인하고 청백전을 확정해 주세요."
      compact
      card={
        <>
          {group('기본정보', stepHref('SCR-241', method, 'SCR-241-ST8'), <>
            {kv(<FileText aria-hidden />, '경기 방식', ind ? '개인전' : '팀전')}
            {kv(<PenLine aria-hidden />, '이름', '12월 둘째 주 청백전')}
            {kv(<CalendarDays aria-hidden />, '날짜', '2026. 12. 13 (일)')}
          </>)}
          {group('참가자', stepHref('SCR-242', method, 'SCR-242-ST8'), kv(<Users aria-hidden />, '참가 인원', <>{IDS.length}명<small>남 {male} · 여 {IDS.length - male} · 게스트 {guests}</small></>))}
          {!ind &&
            group('팀 구성', stepHref('SCR-243', method), kv(<Shuffle aria-hidden />, '팀 구성', <>
              청팀 {blue.length}명 · 백팀 {white.length}명
              <small>청 {g(blue)} · 점수 합 {sum(blue)}</small>
              <small>백 {g(white)} · 점수 합 {sum(white)}</small>
            </>))}
          {group('대진', stepHref('SCR-244', method, 'SCR-244-ST7'), <>
            {!fail && kv(<Grid2x2 aria-hidden />, '코트·라운드', <>코트 {ds.courts} · {edit ? rounds.length : rounds.length}라운드<small>{sameEvery ? (ind ? `라운드마다 출전 ${plays[0].playing.length} · 휴식 ${plays[0].rest.length}` : `라운드마다 청 ${plays[0].blueIn}·백 ${plays[0].whiteIn} 출전 · 휴식 청 ${plays[0].blueRest}·백 ${plays[0].whiteRest}`) : '라운드별 출전 12–16'}</small></>)}
            {kv(<ListOrdered aria-hidden />, '대진', fail ? <>없음<small>라운드 수를 바꿔 대진이 초기화됨</small></> : <>{games}경기<small>{edit ? '1인 3–4경기 · 밸런스·성별 조합 켬 · 규칙 완화 2경기 · 수동 변경 1경기' : `1인 ${ind ? '4' : '4–5'}경기 · 밸런스·성별 조합 켬 · 규칙 완화 1경기`}</small></>)}
            {!fail && (
              <button type="button" className="su-edit" style={{ alignSelf: 'flex-start' }} aria-expanded={showRounds} onClick={() => setShowRounds((v) => !v)} data-testid="show-rounds">
                {showRounds ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
                라운드별 대진 {showRounds ? '접기' : '보기'}
              </button>
            )}
            {showRounds && <ReadonlyRounds ds={ds} folded={folded} onFold={(r) => setFolded((s) => (s.has(r) ? new Set([...s].filter((x) => x !== r)) : new Set([...s, r])))} />}
          </>)}
          <section className="su-sec" aria-label="확정 전 확인" data-cmp="CMP-055">
            <h3 className="su-dist" style={{ margin: '4px 0 0', fontWeight: 700 }}>확정 전 확인</h3>
            <ul className="su-checks">
              {checks.map((c) => (
                <li key={c.text} data-ok={c.ok}>
                  {c.ok ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
                  <span>
                    <span className="sr-only">{c.ok ? '통과: ' : '확인 필요: '}</span>
                    {c.text}
                  </span>
                  {c.fix && <a href={c.fix}>수정</a>}
                </li>
              ))}
            </ul>
          </section>
          <div className="su-note" data-tone="mint" style={{ flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', gap: 8 }}><CircleCheck aria-hidden />확정하면 회원에게 공개됩니다</span>
            <span style={{ display: 'flex', gap: 8 }}><Play aria-hidden />확정하면 1라운드가 바로 시작됩니다</span>
          </div>
        </>
      }
      bar={
        <StepBar
          prev={stepHref('SCR-244', method, 'SCR-244-ST7')}
          next={`#SCR-245/SCR-245-ST8${ind ? '-IND' : ''}/mobile`}
          nextLabel="확정"
          nextIcon={<Check aria-hidden />}
          disabledReason={allOk ? undefined : '확인이 필요한 항목을 먼저 고쳐 주세요'}
        />
      }
      overlay={dialog ? <Dialog title="대진을 확정하고 회원에게 공개할까요?" desc="확정 후에는 방식을 바꾸거나 다시 생성할 수 없습니다. 확정하면 1라운드가 바로 시작됩니다" ok="확정" onCancel={() => setDialog(false)} onOk={() => { window.location.hash = `#SCR-112/SCR-112-ST16${ind ? '-IND' : ''}-NEW/mobile` }} /> : undefined}
    />
  )
}

/** 라운드별 대진(읽기 전용, CMP-059 phase=readonly) */
function ReadonlyRounds({ ds, folded, onFold }: { ds: Dataset; folded: Set<number>; onFold: (r: number) => void }) {
  const ind = ds.kind === 'individual'
  const line = (g: EGame, side: 0 | 1) => {
    const ids = (side === 0 ? g.t1 : g.t2) as string[]
    return (
      <div className="su-tl" data-team={ind ? undefined : side === 0 ? 'blue' : 'white'}>
        <b>{ind ? (side === 0 ? '1팀' : '2팀') : side === 0 ? '청' : '백'}</b>
        <span className="su-players" style={{ minHeight: 36, alignItems: 'center' }}>{ids.map((id) => person(id).name).join(' · ')}</span>
        <span className="su-sum">{sum(ids)}</span>
      </div>
    )
  }
  return (
    <div className="su-rounds" style={{ marginTop: 4 }} data-testid="readonly-rounds">
      {roundsOf(ds.games).map(({ round, games }) => {
        const p = roundPlay(ds, ds.games, round)
        const f = folded.has(round)
        return (
          <section key={round} className="su-round" data-cmp="CMP-059" data-phase="readonly" aria-labelledby={`ro-${round}`}>
            <RoundHead id={`ro-${round}`} round={round} caption={ind ? `코트 ${games.length}/${ds.courts} · 출전 ${p.playing.length} · 휴식 ${p.rest.length}` : `코트 ${games.length}/${ds.courts} · 청 ${p.blueIn}·백 ${p.whiteIn} · 휴식 ${p.rest.length}`} folded={f} onFold={() => onFold(round)} />
            {!f && (
              <ol className="su-round-list">
                {games.map((g) => (
                  <li key={g.key} className="su-game" data-cmp="CMP-041" data-phase="review">
                    <header>
                      <span className="su-gno">코트 {courtOf(ds.games, g)}<small> · {noOf(ds.games, g)}경기</small></span>
                    </header>
                    {line(g, 0)}
                    {line(g, 1)}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}
