import { UserX } from 'lucide-react'
import { useState } from 'react'
import { RoundLive, leaveScenario } from '../components/smapsh/RoundLive'
import { Sheet } from '../components/smapsh/Sheet'
import { Avatar } from '../components/smapsh/Setup'
import { courtOf, filled, noOf, roundDataset, roundPlay, type Dataset, type EGame } from '../mock/editor'
import { person } from '../mock/setup'

// SCR-226 대체 선수 지정(시트) — UX Spec r12 02 SCR-226(ST1·ST8), UXD-048·112 / DD r15 VD-085(+ VD-025·074)
// (r14) 남은 경기 행에 'n라운드 코트 m', 후보는 그 라운드에 출전하지 않는 적격 참가자(팀전 같은 팀).
//   대체할 사람이 없는 경기는 '대체할 사람이 없음 — 이유' + '이 경기 취소' 체크(체크가 곧 확인, VD-085). 모두 체크해야 '반영'
//   (r15) 취소 경기 복원은 없습니다(ST9·ST10 폐기, 기획 r14)
// 보기: ST1 중도 귀가(대체 가능) · ST8 대체 불가 경기 취소 확인 — 부모는 SCR-112 라운드 진행 화면(끝 '-IND' 개인전)

/** 그 경기 라운드에 출전하지 않는 적격 후보(팀전은 같은 팀, 귀가자 제외) */
function subs(ds: Dataset, games: EGame[], g: EGame, out: string, left: string[]) {
  const rest = roundPlay(ds, games, g.round ?? 1).rest
  const team = ds.teams ? ds.teams[out] : null
  const own = filled(g)
  return rest.filter((id) => !left.includes(id) && !own.includes(id) && (!team || ds.teams![id] === team))
}
const where = (games: EGame[], g: EGame) => `${g.round}라운드 코트 ${courtOf(games, g)}`

export function LeaveSheet({ ds, games, current, leaver, left, onClose }: { ds: Dataset; games: EGame[]; current: number; leaver: string; left: string[]; onClose?: () => void }) {
  const remain = games.filter((g) => !g.cancelled && g.result == null && (g.round ?? 1) >= current && filled(g).includes(leaver))
  const opts = remain.map((g) => ({ g, c: subs(ds, games, g, leaver, left) }))
  const [pickd, setPickd] = useState<Record<number, string | undefined>>(() => Object.fromEntries(opts.map((o) => [o.g.key, o.c[0]])))
  const [cancel, setCancel] = useState<Record<number, boolean>>({})
  const need = opts.filter((o) => !o.c.length && !cancel[o.g.key]).length
  return (
    <Sheet
      title={`${person(leaver).name}의 남은 경기 ${remain.length}개`}
      height="70%"
      testId="sheet-226"
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-1">
          {need > 0 && <p className="m-0 text-caption text-ink-muted" id="leave-why">{need}경기 취소를 확인해 주세요</p>}
          <button type="button" data-cmp="CMP-001" disabled={need > 0} aria-describedby={need > 0 ? 'leave-why' : undefined} className="flex h-12 items-center justify-center rounded-md bg-action px-4 text-heading font-bold text-on-action disabled:bg-surface disabled:text-body disabled:text-ink-disabled" onClick={onClose}>
            반영
          </button>
        </div>
      }
    >
      <p className="su-dist" style={{ margin: '0 0 4px' }}>이후 대진에서 제외하고, 남은 경기마다 대체 선수를 정합니다. 기록된 경기와 결과는 그대로입니다</p>
      <div className="su su-list" data-cmp="CMP-030">
        {opts.map(({ g, c }) => (
          <div key={g.key} className="su-leaverow" data-testid="leave-row">
            <header>
              {noOf(games, g)}경기<small>{where(games, g)}</small>
            </header>
            {c.length ? (
              <button type="button" className="su-subpick" aria-label={`${noOf(games, g)}경기 대체 선수 ${person(pickd[g.key]!).name}, 바꾸기`} onClick={() => setPickd((p) => ({ ...p, [g.key]: c[(c.indexOf(p[g.key]!) + 1) % c.length] }))}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={person(pickd[g.key]!).name} />
                  <span>
                    대체: <b>{person(pickd[g.key]!).name}</b>
                    <span className="su-dist" style={{ display: 'block' }}>이 라운드 휴식 · 후보 {c.length}명</span>
                  </span>
                </span>
              </button>
            ) : (
              <>
                <p className="su-nosub" style={{ margin: 0 }}>
                  <UserX aria-hidden />
                  대체할 사람이 없음 — {ds.teams ? '같은 팀에서 이 라운드에 쉬는 사람이 없음' : '이 라운드 참가자가 모두 출전 중'}
                </p>
                <label className="su-cancelchk" data-on={!!cancel[g.key]} data-cmp="CMP-008">
                  <input type="checkbox" checked={!!cancel[g.key]} onChange={(e) => setCancel((s) => ({ ...s, [g.key]: e.target.checked }))} aria-label={`${noOf(games, g)}경기 취소, 대체할 사람이 없음`} />
                  이 경기 취소
                </label>
              </>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  )
}

export function Scr226({ stateId }: { stateId: string }) {
  const ind = stateId.endsWith('-IND')
  const st = stateId.replace(/-IND$/, '')
  const ds = roundDataset(ind ? 'individual' : 'team')
  const sc = leaveScenario(ds)
  const parent = <RoundLive stateId={`SCR-112-ST22${ind ? '-IND' : ''}`} />
  // ST1·ST8: 2라운드 진행 중, 다른 사람이 귀가(ST8은 마지막 남은 경기에 대체할 사람이 없는 경우)
  // ST1: 다른 귀가자가 없어 모든 라운드에 대체 후보가 있음 / ST8: 4라운드 휴식자들이 앞서 귀가해 4라운드 경기는 대체할 사람이 없음
  const base = sc.games.map((x) => ({ ...x, cancelled: false }))
  const r4 = base.filter((x) => x.round === 4).flatMap((x) => (ds.teams ? x.t1 : filled(x))) as string[]
  const leaver = r4.find((id) => id !== sc.f && base.some((x) => x.round === 2 && filled(x).includes(id)))!
  return (
    <>
      {parent}
      <LeaveSheet ds={ds} games={base} current={2} leaver={leaver} left={st === 'SCR-226-ST8' ? sc.qs : []} />
    </>
  )
}
