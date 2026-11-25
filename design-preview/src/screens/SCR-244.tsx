import { AlertTriangle, ArrowLeftRight, ListOrdered, RotateCcw, Scale, Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog, SectionTitle, SetupScreen, StepBar, stepHref } from '../components/smapsh/Setup'
import { person, proposeTeams, SELECTED_16, sum, teamGames, type Game } from '../mock/setup'

// SCR-244 청백전 생성 · 대진 설정 — UX Spec r9 02 SCR-244, UXD-096·071 / DD r12 VD-066(시안 없음, REF-004·005 언어로 확장)
// 대진이 없으면 설정만 화면에 두고 '대진 생성'에서 함께 저장합니다. 대진이 있으면 경기 수·규칙을 바꿀 때 확인 창(ST8).
// 보기: ST1(생성 전) · ST2(생성 중) · ST4(생성 실패) · ST7(대진 검토) · ST8(대진 폐기 확인) · ST9(균등안 제안) — 개인전은 끝에 -IND
const IDS = SELECTED_16
const TEAMS = proposeTeams(IDS)
const N = IDS.length

function games(seed: number, count: number): Game[] {
  const base = teamGames(TEAMS)
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const g = base[i % base.length]
    const t2 = base[(i + seed * 3 + Math.floor(i / base.length)) % base.length].t2
    return { ...g, no: i + 1, t2, relaxed: i === 6 }
  })
}
const perPerson = (count: number) => {
  const slots = count * 4
  const lo = Math.floor(slots / N)
  const hi = slots % N
  return { lo, hi, nHi: hi, nLo: N - hi }
}

export function Scr244({ stateId }: { stateId: string }) {
  const ind = stateId.endsWith('-IND')
  const st = stateId.replace(/-IND$/, '')
  const method = ind ? 'individual' : 'team'
  const [count, setCount] = useState(st === 'SCR-244-ST9' ? 10 : 8)
  const [balance, setBalance] = useState(true)
  const [mixed, setMixed] = useState(true)
  const [phase, setPhase] = useState<'none' | 'loading' | 'done'>(st === 'SCR-244-ST2' ? 'loading' : st === 'SCR-244-ST7' || st === 'SCR-244-ST8' ? 'done' : 'none')
  const [seed, setSeed] = useState(0)
  const [dialog, setDialog] = useState<null | { apply: () => void }>(st === 'SCR-244-ST8' ? { apply: () => setCount(10) } : null)
  const [keep, setKeep] = useState(false)
  useEffect(() => {
    if (phase !== 'loading' || st === 'SCR-244-ST2') return
    const t = setTimeout(() => setPhase('done'), 900)
    return () => clearTimeout(t)
  }, [phase, st])

  const d = perPerson(count)
  const uneven = d.hi > 0
  const evenLo = Math.floor((count * 4) / N) * N / 4
  const evenHi = Math.ceil((count * 4) / N) * N / 4
  const guard = (fn: () => void) => (phase === 'done' ? setDialog({ apply: fn }) : fn())
  const list = games(seed, count)
  const err = st === 'SCR-244-ST4'
  const label = (id: string) => `${person(id).name}`

  return (
    <SetupScreen
      scr="SCR-244"
      st={stateId}
      method={method}
      step="games"
      title="대진 설정"
      desc="경기 수와 규칙을 정해 대진을 만들어요."
      compact
      card={
        <>
          {err && (
            <div className="su-note" data-tone="danger" role="alert" data-cmp="CMP-023">
              <AlertTriangle aria-hidden />
              <span>대진을 만들지 못했습니다. 설정은 그대로입니다</span>
              <button type="button" className="su-link" onClick={() => setPhase('loading')}>다시 시도</button>
            </div>
          )}
          <section className="su-sec">
            <SectionTitle icon={<ListOrdered aria-hidden />} req aside={`참가자 ${N}명`}>
              총 경기 수
            </SectionTitle>
            <label className="su-input" data-cmp="CMP-006" style={{ width: 140 }}>
              <input
                aria-label="총 경기 수"
                inputMode="numeric"
                value={count}
                disabled={phase === 'loading'}
                onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, '')) || 0; guard(() => { setCount(v); setPhase('none'); setKeep(false) }) }}
              />
              <span className="su-dist">경기</span>
            </label>
            {count < 1 ? (
              <p className="su-field-err">경기 수를 1 이상으로 입력해 주세요</p>
            ) : (
              <p className="su-dist" aria-live="polite">
                {uneven ? (
                  <>
                    <b>{d.nHi}명은 {d.lo + 1}경기</b>, {d.nLo}명은 {d.lo}경기를 합니다
                  </>
                ) : (
                  <>
                    모두 <b>{d.lo}경기</b>씩 합니다
                  </>
                )}
              </p>
            )}
            {uneven && !keep && count >= 1 && (
              <div className="su-optrow" role="group" aria-label="균등안" data-cmp="CMP-004">
                {[evenLo, evenHi].filter((v) => v >= 1).map((v) => (
                  <button key={v} type="button" className="su-chip" onClick={() => guard(() => { setCount(v); setPhase('none') })}>
                    {v}경기 (1인 {(v * 4) / N}경기)
                  </button>
                ))}
                <button type="button" className="su-chip" onClick={() => setKeep(true)}>입력값 유지</button>
              </div>
            )}
          </section>
          <section className="su-sec">
            <SectionTitle icon={<Scale aria-hidden />}>규칙</SectionTitle>
            <div>
              {([
                ['밸런스 맞추기', '점수 합 차이가 작은 조합을 먼저 고릅니다', balance, setBalance],
                ['성별 조합 맞추기', '남녀 섞인 복식은 상대도 섞인 복식으로', mixed, setMixed],
              ] as const).map(([t, s, on, set]) => (
                <div key={t} className="su-switch-row">
                  <span>
                    {t}
                    <small>{s}</small>
                  </span>
                  <button type="button" role="switch" aria-checked={on} aria-label={t} className="su-switch" data-cmp="CMP-007" disabled={phase === 'loading'} onClick={() => guard(() => { set(!on); setPhase('none') })} />
                </div>
              ))}
            </div>
          </section>
          {phase !== 'done' && (
            <button type="button" className="su-gen" disabled={phase === 'loading' || count < 1} aria-busy={phase === 'loading' || undefined} onClick={() => setPhase('loading')}>
              <Shuffle aria-hidden />
              {phase === 'loading' ? '대진 만드는 중…' : '대진 생성'}
            </button>
          )}
          {phase === 'loading' && (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="대진을 만드는 중">
              {Array.from({ length: 4 }, (_, i) => <div key={i} className="su-skel" style={{ height: 112 }} />)}
            </div>
          )}
          {phase === 'done' && (
            <>
              <section className="su-sec" aria-label="생성 요약">
                <div className="su-stats">
                  <div className="su-stat"><b>{count}경기</b><span>총 경기 수</span></div>
                  <div className="su-stat"><b>{uneven ? `${d.lo}–${d.lo + 1}` : d.lo}경기</b><span>1인 경기 수</span></div>
                  <div className="su-stat"><b>1경기</b><span>규칙 완화</span></div>
                </div>
              </section>
              <section className="su-sec" aria-label="사람별 경기 수">
                <SectionTitle icon={<ListOrdered aria-hidden />}>사람별 경기 수</SectionTitle>
                <div className="su-counts">
                  {IDS.map((id, i) => {
                    const n = uneven && i < d.nHi ? d.lo + 1 : d.lo
                    return (
                      <span key={id} className="su-cnt" data-odd={uneven && n !== d.lo}>
                        {person(id).name} {n}
                      </span>
                    )
                  })}
                </div>
              </section>
              <section className="su-sec" aria-label="대진 미리보기">
                <SectionTitle
                  icon={<Shuffle aria-hidden />}
                  aside={
                    <button type="button" className="su-regen" onClick={() => setSeed((s) => s + 1)}>
                      <RotateCcw aria-hidden />
                      다시 생성
                    </button>
                  }
                >
                  대진 미리보기
                </SectionTitle>
                <ol className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {list.map((g) => {
                    const side = (ids: [string, string], t: 'blue' | 'white', short: string) => (
                      <div className="su-tl" data-team={ind ? undefined : t}>
                        <b>{ind ? short : t === 'blue' ? '청' : '백'}</b>
                        <span className="su-players">
                          {ids.map((id) => (
                            <button key={id} type="button" aria-label={`${g.no}경기 ${label(id)} 교체`}>
                              {label(id)} <small>{person(id).gender} {person(id).score}</small>
                              <ArrowLeftRight aria-hidden />
                            </button>
                          ))}
                        </span>
                        <span className="su-sum">{sum(ids)}</span>
                      </div>
                    )
                    return (
                      <li key={g.no} className="su-game" data-cmp="CMP-041">
                        <header>
                          {g.no}경기
                          <small>실력차 {Math.abs(sum(g.t1) - sum(g.t2))}</small>
                        </header>
                        {side(g.t1, 'blue', 'A')}
                        {side(g.t2, 'white', 'B')}
                        {g.relaxed && (
                          <span className="su-badge su-relax" data-tone="warning" data-cmp="CMP-005">
                            규칙 완화: 성별 조합
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </section>
            </>
          )}
        </>
      }
      bar={
        <StepBar
          prev={ind ? stepHref('SCR-242', method, 'SCR-242-ST8') : stepHref('SCR-243', method)}
          next={stepHref('SCR-245', method)}
          disabledReason={phase === 'done' ? undefined : '대진을 먼저 만들어 주세요'}
        />
      }
      overlay={
        dialog ? (
          <Dialog
            title="대진이 초기화됩니다"
            desc="경기 수나 규칙을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다"
            ok="바꾸기"
            onCancel={() => setDialog(null)}
            onOk={() => { dialog.apply(); setPhase('none'); setDialog(null) }}
          />
        ) : undefined
      }
    />
  )
}
