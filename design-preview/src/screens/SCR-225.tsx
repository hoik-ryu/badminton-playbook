import { useState } from 'react'
import { PickSheet } from '../components/smapsh/PickSheet'
import { Dialog } from '../components/smapsh/Setup'
import { dataset, type Cand, type Target } from '../mock/editor'
import { person } from '../mock/setup'
import { Scr112 } from './SCR-112'
import { Scr244 } from './SCR-244'

// SCR-225 선수 교체(청백전, 시트) 보기 — 시트 부품은 components/smapsh/PickSheet.tsx(UXD-102 / VD-074)
// 확정 전 보기는 부모 SCR-244 위에 열린 상태(같은 편집기 상태로 직접 조작 가능), 확정 후(ST7)는 SCR-112 위
// ---- 화면 보기(registry) ----
// ST1 개인전 선수 자리(맞교환 + 교체, '같은 대진 반복' 경고 후보 포함) · ST1-TEAM 팀전(같은 팀 교체만, '경기 수 차이 2' 경고)
// ST3 팀당 2명 팀전(고를 수 있는 사람 없음) · ST3-IND4 개인전 4명(교체 후보 없이 맞교환만, AC-139)
// ST4 저장 실패 · ST7 확정 후 교체(SCR-112 위) · ST8 경기 수 차이 확인 · ST9 빈 자리 선택 · ST10 경고 후보 · ST11 선택 불가 후보 · ST12 저장 중
export function Scr225({ stateId }: { stateId: string }) {
  const st = stateId
  if (st === 'SCR-225-ST7') return <ConfirmedView />
  const view: { parent: string; sheet: string } =
    st === 'SCR-225-ST1-TEAM' || st === 'SCR-225-ST10' || st === 'SCR-225-ST8' || st === 'SCR-225-ST13'
      ? { parent: 'SCR-244-ST7', sheet: st === 'SCR-225-ST8' ? 'count' : 'team' }
      : st === 'SCR-225-ST3'
        ? { parent: 'SCR-244-ST7-TEAM2', sheet: 'player' }
        : st === 'SCR-225-ST3-IND4'
          ? { parent: 'SCR-244-ST7-IND4', sheet: 'player' }
          : st === 'SCR-225-ST9'
            ? { parent: 'SCR-244-ST11-IND', sheet: 'empty' }
            : { parent: 'SCR-244-ST7-IND', sheet: st === 'SCR-225-ST4' ? 'error' : st === 'SCR-225-ST12' ? 'saving' : 'player' }
  return <Scr244 key={stateId} stateId={view.parent} sheetView={view.sheet as never} />
}

function ConfirmedView() {
  const ds = dataset('confirmed')
  const [games, setGames] = useState(ds.games)
  const [ask, setAsk] = useState<Cand | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const target: Target = { key: 3, side: 0, idx: 0 }
  const apply = (c: Cand) => {
    setGames((gs) => gs.map((g) => (g.key === c.next.key ? c.next : g)))
    setDone(person(c.id).name)
  }
  return (
    <>
      <Scr112 stateId="SCR-112-ST13" />
      {done ? (
        <div className="su-dim" style={{ alignItems: 'end', paddingBottom: 32 }}>
          <p className="su-note" data-tone="mint" role="status" style={{ width: '100%', maxWidth: 560 }}>
            {done} 선수로 바꿨습니다. 회원 화면에 '변경됨'으로 표시됩니다(프리뷰: 새로고침하면 처음으로)
          </p>
        </div>
      ) : (
        <PickSheet ds={ds} games={games} target={target} confirmed onPick={(c) => (c.warns.length ? setAsk(c) : apply(c))} />
      )}
      {ask && (
        <Dialog
          title="경기 수 차이가 2가 됩니다. 그래도 바꿀까요?"
          ok="바꾸기"
          onCancel={() => setAsk(null)}
          onOk={() => {
            apply(ask)
            setAsk(null)
          }}
        />
      )}
    </>
  )
}
