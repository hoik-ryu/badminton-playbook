import { ArrowLeftRight, ListOrdered, RotateCcw, Scale, Shuffle } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '../../../components/Badge'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { NoticeBox } from '../../../components/NoticeBox'
import { StateView } from '../../../components/StateView'
import { StepActionBar } from '../../../components/StepActionBar'
import { Switch } from '../../../components/Switch'
import { TextField } from '../../../components/TextField'
import { isApiError } from '../../../lib/api'
import { CLUB_ERRORS, generateClub, getClubMatchView, setSettings, type ClubMatchView, type GameView, type Person } from '../api'
import { ClubSwapSheet } from '../ClubSwapSheet'
import { distribution, evenProposals } from '../schedule'
import { SectionTitle } from './parts'
import { SetupFrame } from './SetupFrame'
import { participantsOf } from './steps'
import type { StepProps } from './types'
import type { GamesDraft } from './useSetup'

// SCR-244 청백전 생성 · 대진 설정 — UX Spec r9 02 SCR-244(UXD-096·071·043·007·098·099), DD r12 VD-066, Preview r8
// 대진이 없으면 설정은 화면 입력(생성 때 함께 저장, C-32). 대진이 있으면 총 경기 수·규칙을 바꿀 때 확인 창(ST8) → 확인 즉시 설정 저장 + 대진 폐기(AC-132).
// '대진 생성'(설정 + 생성 한 번에) → 요약·사람별 경기 수·미리보기(선수 누르면 기존 SCR-225 교체 시트) · '다시 생성'(새 시드, AC-076)
// 생성 거부(점수 미설정·인원 부족·미배정)는 서버 문구 그대로(ST4)
const SHOWN_ERRORS = new Set<string>([CLUB_ERRORS.unscored, CLUB_ERRORS.minPlayers, CLUB_ERRORS.unassigned])
type Pending = { patch: Partial<GamesDraft>; label: string }

export function GamesStep({ c, frame, go }: StepProps) {
  const v = c.view!
  const d = c.drafts.games
  const [countText, setCountText] = useState(d.totalGames)
  const [pending, setPending] = useState<Pending | null>(null)
  const [generating, setGenerating] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [swap, setSwap] = useState<{ gameNo: number; target: Person } | null>(null)
  const hasGames = v.games.length > 0
  const count = Number(d.totalGames)
  const countError = !Number.isInteger(count) || count < 1 ? '경기 수를 1 이상으로 입력해 주세요' : undefined

  const inPlay = participantsOf(v).filter((r) => v.method === 'individual' || r.team)
  const sizes = { all: inPlay.length, blue: inPlay.filter((r) => r.team === 'blue').length, white: inPlay.filter((r) => r.team === 'white').length }
  const dist = countError ? null : distribution(v.method, sizes, count)
  const even = countError ? [] : evenProposals(v.method, sizes, count)
  const uneven = !!dist && !dist.even

  const setDraft = (patch: Partial<GamesDraft>) => c.setDrafts((x) => ({ ...x, games: { ...x.games, ...patch } }))
  /** 설정 변경: 대진이 있으면 확인(ST8) 후 즉시 저장+폐기, 없으면 화면 입력 */
  const change = (patch: Partial<GamesDraft>, label: string) => {
    if (hasGames) setPending({ patch, label })
    else setDraft(patch)
  }
  const applyNow = async (patch: Partial<GamesDraft>) => {
    const next = { ...d, ...patch }
    const settings = { totalGames: Number(next.totalGames), rules: { balance: next.balance, gender: next.gender } }
    const r = await c.save(
      () => setSettings(v.id, v.version, settings, true),
      (x) => x.totalGames === settings.totalGames && x.rules.balance === settings.rules.balance && x.rules.gender === settings.rules.gender && x.games.length === 0,
      () => void applyNow(patch),
    )
    if (r.kind === 'ok') {
      c.accept(r.view, { games: true })
      setCountText(String(r.view.totalGames))
    } else if (r.kind === 'failed') c.setFailure({ message: '설정을 저장하지 못했습니다. 대진은 그대로입니다', retry: () => void applyNow(patch) })
  }

  const generate = async () => {
    if (countError) return
    setRefused(null)
    setGenerating(true)
    const settings = { totalGames: count, rules: { balance: d.balance, gender: d.gender } }
    const before = v.games
    const r = await c.save(
      () => generateClub(v.id, v.version, settings),
      (x) => x.games.length > 0 && x.games !== before,
      () => void generate(),
    )
    setGenerating(false)
    if (r.kind === 'ok') c.accept(r.view, { games: true })
    else if (r.kind === 'failed') {
      if (isApiError(r.error) && SHOWN_ERRORS.has(r.error.code)) setRefused(r.error.message)
      else c.setFailure({ message: '대진을 만들지 못했습니다. 설정은 그대로입니다', retry: () => void generate() })
    }
  }

  const counts = new Map<string, number>()
  for (const g of v.games) for (const p of [...g.team1, ...g.team2]) counts.set(p.key, (counts.get(p.key) ?? 0) + 1)
  const perPerson = inPlay.map((r) => ({ r, n: counts.get(r.key) ?? 0 }))
  const nums = perPerson.map((x) => x.n)
  const minN = nums.length ? Math.min(...nums) : 0
  const maxN = nums.length ? Math.max(...nums) : 0
  const relaxed = v.games.filter((g) => g.genderRelaxed || g.repeatedMatchup || g.relaxations.length > 0).length

  const loading = generating || (c.saving && !pending)
  const st = pending ? 'SCR-244-ST8' : c.conflict ? 'SCR-244-ST6' : generating ? 'SCR-244-ST2' : c.failure || refused || countError ? 'SCR-244-ST4' : hasGames ? 'SCR-244-ST7' : uneven ? 'SCR-244-ST9' : 'SCR-244-ST1'

  return (
    <SetupFrame
      scr="SCR-244"
      st={st}
      method={v.method}
      title="대진 설정"
      desc="경기 수와 규칙을 정해 대진을 만들어요."
      compact
      steps={frame.steps}
      current="games"
      onStep={frame.onStep}
      onExit={frame.onExit}
      notice={
        <>
          {c.failure && (
            <NoticeBox tone="danger" action={<button type="button" className="su-link" onClick={c.failure.retry}>다시 시도</button>}>
              {c.failure.message}
            </NoticeBox>
          )}
          {refused && <NoticeBox tone="danger">{refused}</NoticeBox>}
        </>
      }
      bar={<StepActionBar onPrev={() => go(v.method === 'team' ? 'teams' : 'participants')} onNext={() => go('confirm')} disabledReason={hasGames ? undefined : '대진을 먼저 만들어 주세요'} disabled={loading} />}
      overlay={
        <>
          <ConfirmDialog
            open={!!pending}
            onOpenChange={(o) => {
              if (!o) {
                setPending(null)
                setCountText(d.totalGames) // 취소하면 원래 값
              }
            }}
            title="대진이 초기화됩니다"
            description="경기 수나 규칙을 바꾸면 만든 대진을 버리고 다시 생성해야 합니다"
            confirmLabel="바꾸기"
            onConfirm={async () => {
              const p = pending
              if (p) await applyNow(p.patch)
            }}
          />
          {swap && (
            <ClubSwapSheet
              key={v.version}
              view={v}
              gameNo={swap.gameNo}
              target={swap.target}
              onClose={() => setSwap(null)}
              onDone={(next: ClubMatchView) => c.accept(next)}
              onConflict={() => void getClubMatchView(v.id).then((latest) => c.setConflict(latest))}
            />
          )}
        </>
      }
    >
      <section className="su-sec">
        <SectionTitle icon={<ListOrdered aria-hidden />} req aside={`참가자 ${inPlay.length}명`}>
          총 경기 수
        </SectionTitle>
        <TextField
          className="su-namefield"
          label="총 경기 수"
          hideLabel
          inputMode="numeric"
          value={countText}
          style={{ width: 140 }}
          disabled={loading}
          error={countError && countText !== '' ? countError : countText === '' ? '경기 수를 1 이상으로 입력해 주세요' : undefined}
          onChange={(e) => {
            const t = e.target.value.replace(/\D/g, '')
            setCountText(t)
            if (!hasGames) setDraft({ totalGames: t, keepUneven: false })
          }}
          onBlur={() => {
            if (hasGames && countText !== d.totalGames && Number(countText) >= 1) change({ totalGames: countText, keepUneven: false }, '총 경기 수')
            else if (hasGames) setCountText(d.totalGames)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        />
        {dist && (
          <p className="su-dist" aria-live="polite">
            {dist.even ? (
              <>
                모두 <b>{dist.groups[0]?.games ?? 0}경기</b>씩 합니다
              </>
            ) : (
              dist.groups.map((g, i) => (
                <span key={g.games}>
                  {i > 0 && ', '}
                  {i === 0 ? <b>{g.people}명은 {g.games}경기</b> : `${g.people}명은 ${g.games}경기`}
                </span>
              ))
            )}
            {!dist.even && '를 합니다'}
          </p>
        )}
        {uneven && !d.keepUneven && even.length > 0 && (
          <div className="su-optrow" role="group" aria-label="균등안">
            {even.map((p) => (
              <button key={p.totalGames} type="button" className="su-chip" onClick={() => { setCountText(String(p.totalGames)); change({ totalGames: String(p.totalGames) }, '총 경기 수') }}>
                {p.totalGames}경기 (1인 {p.each.blue === p.each.white ? p.each.blue : `청 ${p.each.blue}·백 ${p.each.white}`}경기)
              </button>
            ))}
            <button type="button" className="su-chip" onClick={() => setDraft({ keepUneven: true })}>
              입력값 유지
            </button>
          </div>
        )}
      </section>
      <section className="su-sec">
        <SectionTitle icon={<Scale aria-hidden />}>규칙</SectionTitle>
        <div className="su-switches">
          <Switch label="밸런스 맞추기" description="점수 합 차이가 작은 조합을 먼저 고릅니다" checked={d.balance} disabled={loading} onCheckedChange={(on) => change({ balance: on }, '밸런스')} />
          <Switch label="성별 조합 맞추기" description="남녀 섞인 복식은 상대도 섞인 복식으로" checked={d.gender} disabled={loading} onCheckedChange={(on) => change({ gender: on }, '성별 조합')} />
        </div>
      </section>
      {!hasGames && (
        <button type="button" className="su-gen" disabled={loading || !!countError} aria-busy={generating || undefined} onClick={() => void generate()} data-testid="su-generate">
          <Shuffle aria-hidden />
          {generating ? '대진 만드는 중…' : '대진 생성'}
        </button>
      )}
      {generating && <StateView kind="loading" rows={4} label="대진을 만드는 중" className="px-0" />}
      {hasGames && !generating && (
        <>
          <section className="su-sec" aria-label="생성 요약">
            <div className="su-stats">
              <div className="su-stat">
                <b>{v.games.length}경기</b>
                <span>총 경기 수</span>
              </div>
              <div className="su-stat">
                <b>{minN === maxN ? minN : `${minN}–${maxN}`}경기</b>
                <span>1인 경기 수</span>
              </div>
              <div className="su-stat">
                <b>{relaxed}경기</b>
                <span>규칙 완화</span>
              </div>
            </div>
          </section>
          <section className="su-sec" aria-label="사람별 경기 수">
            <SectionTitle icon={<ListOrdered aria-hidden />}>사람별 경기 수</SectionTitle>
            <div className="su-counts">
              {perPerson.map(({ r, n }) => (
                <span key={r.key} className="su-cnt" data-odd={minN !== maxN && n !== minN}>
                  {r.name} {n}
                </span>
              ))}
            </div>
          </section>
          <section className="su-sec" aria-label="대진 미리보기">
            <SectionTitle
              icon={<Shuffle aria-hidden />}
              aside={
                <button type="button" className="su-regen" onClick={() => void generate()} disabled={loading}>
                  <RotateCcw aria-hidden />
                  다시 생성
                </button>
              }
            >
              대진 미리보기
            </SectionTitle>
            <ol className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {v.games.map((g) => (
                <SetupGameCard key={g.no} g={g} team={v.method === 'team'} onPick={(target) => !g.winner && setSwap({ gameNo: g.no, target })} />
              ))}
            </ol>
          </section>
        </>
      )}
    </SetupFrame>
  )
}

/** 대진 미리보기 경기 카드(CMP-041 표현, VD-066 — 원장 POL-002): 청·백(개인전 A·B) 줄, 선수 누름 영역 + 교체 단서, 점수 합·실력차·규칙 완화 */
function SetupGameCard({ g, team, onPick }: { g: GameView; team: boolean; onPick: (p: Person) => void }) {
  const sum = (ps: Person[]) => ps.reduce((s, p) => s + (p.score ?? 0), 0)
  const side = (ps: Person[], t: 'blue' | 'white', short: string) => (
    <div className="su-tl" data-team={team ? t : undefined}>
      <b>{team ? (t === 'blue' ? '청' : '백') : short}</b>
      <span className="su-players">
        {ps.map((p) => (
          <button key={p.key} type="button" aria-label={`${g.no}경기 ${p.name} 교체`} onClick={() => onPick(p)}>
            {p.name} <small>{[p.gender, p.score].filter((x) => x !== null).join(' ')}</small>
            <ArrowLeftRight aria-hidden />
          </button>
        ))}
      </span>
      <span className="su-sum">{sum(ps)}</span>
    </div>
  )
  const relaxed = g.genderRelaxed || g.relaxations.some((x) => x.rule === 'gender')
  return (
    <li className="su-game">
      <header>
        {g.no}경기
        <small>실력차 {g.gap ?? '-'}</small>
      </header>
      {side(g.team1, 'blue', 'A')}
      {side(g.team2, 'white', 'B')}
      {(relaxed || g.repeatedMatchup) && (
        <Badge tone="warning" className="su-badge su-relax" data-tone="warning">
          {g.repeatedMatchup ? '규칙 완화: 같은 대진 반복' : '규칙 완화: 성별 조합'}
        </Badge>
      )}
    </li>
  )
}

