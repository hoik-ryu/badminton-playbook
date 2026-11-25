import { X } from 'lucide-react'

import { Sheet } from '../../../components/Sheet'
import { StateView } from '../../../components/StateView'
import type { ParticipantRow } from '../api'
import { Avatar, PersonMeta } from './parts'

// SCR-246 선택한 참가자(시트) — UX Spec r9 02 SCR-246(UXD-093), DD r12 VD-064·068, Preview r8
// 저장하지 않는 시트: 해제는 SCR-242 선택에 바로 반영. 해제 행동 레이블 "김민수 선택 해제". 닫으면 선택 요약 줄로 포커스(Radix 기본 복원)
export function SelectedSheet({ people, onRemove, onClose }: { people: ParticipantRow[]; onRemove: (key: string) => void; onClose: () => void }) {
  const male = people.filter((p) => p.gender === '남').length
  return (
    <Sheet open title={`선택한 참가자 ${people.length}명`} titleBadge={<span className="su-dist" style={{ fontWeight: 400 }}>남 {male} · 여 {people.length - male}</span>} onRequestClose={onClose} testId="selected-sheet">
      <div data-scr="SCR-246" data-st={people.length ? 'SCR-246-ST1' : 'SCR-246-ST3'} className="su">
        {people.length === 0 ? (
          <StateView kind="empty" title="아직 선택한 사람이 없습니다" />
        ) : (
          <ul className="su-list" aria-label="선택한 사람">
            {people.map((p) => (
              <li key={p.key}>
                <div className="su-row">
                  <Avatar name={p.name} />
                  <span className="su-who">
                    <span className="su-name" data-bold="true">
                      {p.name}
                    </span>
                    <PersonMeta p={p} />
                  </span>
                  <button type="button" className="su-icon-btn" aria-label={`${p.name} 선택 해제`} onClick={() => onRemove(p.key)}>
                    <X aria-hidden className="size-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
