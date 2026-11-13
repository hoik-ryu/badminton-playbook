import { ActionButton, ChoiceGrid, Field, GRADES, SCORES, Segmented, TextField } from '../components/smapsh/Form'
import { Badge } from '../components/smapsh/GameCard'
import { Sheet } from '../components/smapsh/Sheet'
import { Scr211 } from './SCR-211'

// SCR-212 회원·게스트 편집 — UX Spec r2(02 SCR-212, 형태 '시트', PC 옆 패널 없음) + Design Direction r2(VD-025)
// ST1 회원: 편집 + 현황(CMP-045 RecordSummary는 카드, VD-024) / ST7 게스트: 현황 없음, 아래쪽 '게스트 삭제'
// 시트: 최대 90%, 내부 스크롤, '저장'은 아래 고정·안전 영역 위. 위험 행동은 저장과 떨어진 아래쪽(02 메모)
export function Scr212({ stateId }: { stateId: string }) {
  const guest = stateId === 'SCR-212-ST7'
  const person = guest ? { name: '남보람', gender: '남', grade: 'C조', score: 7 } : { name: '김가람', gender: '남', grade: 'C조', score: 7 }
  return (
    <Scr211
      stateId="SCR-211-ST1"
      scr="SCR-212"
      overlay={
        <div data-st={stateId}>
          <Sheet
            title={person.name}
            titleBadge={<Badge tone="neutral">{guest ? '게스트' : '회원'}</Badge>}
            height="full"
            testId="sheet-212"
            footer={<ActionButton testId="sheet-save">저장</ActionButton>}
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <Field label="이름">
                  <TextField value={person.name} />
                </Field>
                <Field label="성별">
                  <Segmented options={['남', '여']} value={person.gender} />
                </Field>
                <Field label="급수">
                  <ChoiceGrid options={GRADES} value={person.grade} cols={4} />
                </Field>
                <Field label="점수">
                  <ChoiceGrid options={SCORES} value={person.score} cols={5} />
                </Field>
              </div>
              {!guest && (
                <section className="flex flex-col gap-2" aria-label="현황">
                  <h3 className="text-body font-bold text-ink">현황</h3>
                  {/* CMP-045 RecordSummary(audience=ops) — 카드 대상(VD-024) */}
                  <div data-cmp="CMP-045" data-testid="record-card" className="flex flex-col gap-1 rounded-md border border-line bg-page p-3 text-body text-ink">
                    <p>지인: 이나래</p>
                    <p className="tabular-nums">
                      랭크 <b>A</b> · 24경기 14승 10패
                    </p>
                    <p className="tabular-nums text-ink-muted">튜토리얼: 입문자 2/3 · 왕초보 0/3 · 권장 대상</p>
                  </div>
                </section>
              )}
              <div className="border-t border-line pt-3">
                <ActionButton variant="danger-text" grow={false}>
                  {guest ? '게스트 삭제' : '회원 비활성 처리'}
                </ActionButton>
              </div>
            </div>
          </Sheet>
        </div>
      }
    />
  )
}
