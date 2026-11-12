import { useEffect, useState } from 'react'

import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { PersonRow } from '../../components/PersonRow'
import { ChoiceGrid } from '../../components/RadioButtons'
import { Sheet } from '../../components/Sheet'
import { isApiError } from '../../lib/api'
import { INVALID_SCORE, ROSTER_CONFLICT, setScore, type RosterPerson } from './api'
import { SCORES } from './personForm'

// SCR-214 점수 입력(시트; 실제로는 SCR-203·SCR-224 위 두 번째 시트 — B3·B4에서 연결). US-007, FLOW-003-S4·S4a, FLOW-005-S2b, AC-016, AC-071, UXD-021·023
// - 점수 버튼 → 그 사람 점수 즉시 저장, '완료' 표시. 모두 끝나면 시트 자동 닫힘(onAllDone: 부모 화면 생성 버튼 활성)
// - ST2 누른 행만 저장 중 / ST4 해당 행 저장 실패 + 다시 시도("점수는 1–10 중에서 골라 주세요"는 서버 거부 시)
// - 점수 버튼 5열 × 2줄, 최소 44×44(UXD-021)
type RowState = { saving?: string | null; done?: number; error?: { message: string; value: string } }

/** save: 저장 방법(기본은 명단 API, 이전 점수와 함께). 아직 Mock인 오늘 운동(I4 전) 화면은 Mock 저장(setMockScore)을 넘김 */
type SaveScore = (p: RosterPerson, score: number) => Promise<void>
const saveToRoster: SaveScore = (p, score) => setScore(p.kind, p.id, score, p.score)

export function ScoreEntrySheet({ people, onClose, onAllDone, save: saveScore = saveToRoster }: { people: RosterPerson[]; onClose: () => void; onAllDone: () => void; save?: SaveScore }) {
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const remaining = people.filter((p) => rows[p.id]?.done === undefined).length

  useEffect(() => {
    if (people.length > 0 && remaining === 0) {
      const t = setTimeout(onAllDone, 600) // '완료' 표시를 잠깐 보여 준 뒤 닫힘
      return () => clearTimeout(t)
    }
  }, [remaining, people.length, onAllDone])

  const save = async (p: RosterPerson, value: string) => {
    setRows((r) => ({ ...r, [p.id]: { ...r[p.id], saving: value, error: undefined } }))
    try {
      await saveScore(p, Number(value))
      setRows((r) => ({ ...r, [p.id]: { done: Number(value), saving: null } }))
    } catch (e) {
      const message = isApiError(e) && e.code === INVALID_SCORE ? '점수는 1–10 중에서 골라 주세요' : isApiError(e) && e.code === ROSTER_CONFLICT ? '다른 사람이 먼저 점수를 바꿨습니다. 명단에서 확인해 주세요' : '저장하지 못했습니다'
      setRows((r) => ({ ...r, [p.id]: { ...r[p.id], saving: null, error: { message, value } } }))
    }
  }

  return (
    <Sheet open title={`점수 미설정 ${remaining}명`} onRequestClose={onClose} testId="score-sheet" height="70%">
      <ul data-scr="SCR-214" data-st={Object.values(rows).some((r) => r.error) ? 'SCR-214-ST4' : Object.values(rows).some((r) => r.saving) ? 'SCR-214-ST2' : 'SCR-214-ST1'} className="m-0 flex list-none flex-col gap-4 p-0">
        {people.map((p) => {
          const st = rows[p.id] ?? {}
          return (
            <li key={p.id} data-person={p.id} className="flex flex-col gap-2 border-b border-line pb-4">
              <PersonRow name={p.name} meta={[p.gender, p.grade]} trailing={st.done !== undefined ? <Badge tone="success">완료 · {st.done}점</Badge> : undefined} />
              <ChoiceGrid
                label={`${p.name} 점수`}
                hideLabel
                kind="score"
                options={SCORES}
                value={st.done !== undefined ? (String(st.done) as (typeof SCORES)[number]) : null}
                busyValue={(st.saving ?? null) as (typeof SCORES)[number] | null}
                disabled={!!st.saving}
                onChange={(v) => void save(p, v)}
              />
              {st.error && (
                <div role="alert" className="flex items-center justify-between gap-2 text-caption font-bold text-danger-fg">
                  {st.error.message}
                  <Button variant="text" size="md" onClick={() => void save(p, st.error!.value)}>
                    다시 시도
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
