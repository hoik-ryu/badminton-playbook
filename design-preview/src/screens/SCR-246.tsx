import { UserX, X } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../components/smapsh/Sheet'
import { Avatar, PersonMeta } from '../components/smapsh/Setup'
import { ROSTER, SELECTED_16 } from '../mock/setup'
import { Scr242 } from './SCR-242'

// SCR-246 선택한 참가자(시트) — UX Spec r9 02 SCR-246, UXD-093 / DD r12 VD-064·068(CMP-021, 행 = VD-064, 해제 = X 아이콘 버튼 44)
// 저장하지 않는 시트입니다. 해제는 SCR-242 선택에 바로 반영되고, 닫으면 선택 요약 줄로 포커스를 돌려줍니다(제품 구현에서 검증).
// 보기: ST1(16명) · ST3(아무도 선택 안 함) — 개인전은 끝에 -IND
export function Scr246({ stateId }: { stateId: string }) {
  const ind = stateId.endsWith('-IND')
  const st = stateId.replace(/-IND$/, '')
  const [sel, setSel] = useState<string[]>(st === 'SCR-246-ST3' ? [] : SELECTED_16)
  const chosen = ROSTER.filter((p) => sel.includes(p.id))
  const male = chosen.filter((p) => p.gender === '남').length
  return (
    <>
      <Scr242 stateId={`${st === 'SCR-246-ST3' ? 'SCR-242-ST1-NONE' : 'SCR-242-ST8'}${ind ? '-IND' : ''}`} />
      <Sheet
        title={`선택한 참가자 ${chosen.length}명`}
        titleBadge={<span className="su-dist" style={{ fontWeight: 400 }}>남 {male} · 여 {chosen.length - male}</span>}
        testId="sheet-246"
      >
        {chosen.length === 0 ? (
          <div className="su-empty" data-cmp="CMP-027" role="status">
            <UserX aria-hidden />
            <p style={{ margin: 0 }}>아직 선택한 사람이 없습니다</p>
          </div>
        ) : (
          <ul className="su-list" aria-label="선택한 사람">
            {chosen.map((p) => (
              <li key={p.id}>
                <div className="su-row" data-cmp="CMP-024">
                  <Avatar name={p.name} />
                  <span className="su-who">
                    <span className="su-name" data-bold="true">{p.name}</span>
                    <PersonMeta p={p} />
                  </span>
                  <button type="button" className="su-icon-btn" aria-label={`${p.name} 선택 해제`} onClick={() => setSel((s) => s.filter((x) => x !== p.id))}>
                    <X aria-hidden className="size-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  )
}
