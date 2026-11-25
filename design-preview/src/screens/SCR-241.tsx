import { CalendarDays, ChevronDown, PenLine, User, Users } from 'lucide-react'
import { useState } from 'react'
import { Dialog, SectionTitle, SetupScreen, ShuttleIcon, StepBar, stepHref, type Method } from '../components/smapsh/Setup'

// SCR-241 청백전 생성 · 기본정보 — UX Spec r9 02 SCR-241, UXD-090–092 / DD r12 VD-059–063, REF-004
// 보기: ST1(방식 팀전 선택, 입력 완료) · ST1-IND(개인전) · ST7(방식 미선택) · ST4(오류) · ST8(준비 중 편집, 더보기) · ST9(방식 변경 확인) · ST10(삭제 확인)
// 방식 타일을 누르면 진행 표시 칸 수가 바로 바뀝니다(5 ↔ 4).
export function Scr241({ stateId }: { stateId: string }) {
  const ind = stateId.endsWith('-IND')
  const st = stateId.replace(/-IND$/, '')
  const startMethod: Method | null = st === 'SCR-241-ST7' || st === 'SCR-241-ST4' ? null : ind ? 'individual' : 'team'
  const [method, setMethod] = useState<Method | null>(startMethod)
  const [name, setName] = useState(st === 'SCR-241-ST4' ? '2026년 12월 둘째 주 토요일 정기 운동 겸 청백전 대회' : st === 'SCR-241-ST7' ? '' : '12월 둘째 주 청백전')
  const draft = st === 'SCR-241-ST8' || st === 'SCR-241-ST9' || st === 'SCR-241-ST10'
  const [dialog, setDialog] = useState<'method' | 'delete' | null>(st === 'SCR-241-ST9' ? 'method' : st === 'SCR-241-ST10' ? 'delete' : null)
  const tooLong = name.trim().length > 30
  const err = st === 'SCR-241-ST4'
  const next = method ? stepHref('SCR-242', method) : undefined
  return (
    <SetupScreen
      scr="SCR-241"
      st={stateId}
      method={method}
      step="basic"
      title={draft ? '12월 둘째 주 청백전' : '새 청백전'}
      desc="청백전의 기본 정보를 입력해 주세요."
      draft={draft}
      card={
        <>
          <section className="su-sec" aria-labelledby="s241-m">
            <span id="s241-m">
              <SectionTitle icon={<ShuttleIcon />} req>
                경기 방식
              </SectionTitle>
            </span>
            <div className="su-tiles" role="radiogroup" aria-label="경기 방식" data-cmp="CMP-002">
              {([
                ['individual', '개인전', <User key="u" aria-hidden />],
                ['team', '팀전', <Users key="t" aria-hidden />],
              ] as const).map(([v, label, icon]) => (
                <button key={v} type="button" role="radio" aria-checked={method === v} className="su-tile" onClick={() => (draft && method && method !== v ? setDialog('method') : setMethod(v))}>
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            {err && !method && <p className="su-field-err">방식을 골라 주세요</p>}
          </section>
          <section className="su-sec">
            <SectionTitle icon={<PenLine aria-hidden />} req>
              청백전 이름
            </SectionTitle>
            <label className="su-input" data-cmp="CMP-006" data-error={tooLong || undefined}>
              <input aria-label="청백전 이름" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 12월 둘째 주 청백전" aria-describedby="s241-count" />
            </label>
            {tooLong ? <p className="su-field-err">이름은 30자 이내로 입력해 주세요</p> : null}
            <span id="s241-count" className="su-count" aria-live="polite">
              {name.trim().length} / 30
            </span>
          </section>
          <section className="su-sec">
            <SectionTitle icon={<CalendarDays aria-hidden />} req>
              날짜
            </SectionTitle>
            <button type="button" className="su-input" data-cmp="CMP-006" aria-label="날짜 2026년 12월 13일 일요일, 날짜 선택기 열기">
              <CalendarDays aria-hidden />
              <span style={{ flex: 1, textAlign: 'left' }}>2026. 12. 13 (일)</span>
              <ChevronDown aria-hidden />
            </button>
          </section>
        </>
      }
      bar={<StepBar next={next} nextLabel="다음" disabledReason={undefined} />}
      overlay={
        dialog === 'method' ? (
          <Dialog title="방식을 바꾸면 만든 대진과 팀 배정이 초기화됩니다" desc="참가자는 유지됩니다" ok="바꾸기" onCancel={() => setDialog(null)} onOk={() => { setMethod(method === 'team' ? 'individual' : 'team'); setDialog(null) }} />
        ) : dialog === 'delete' ? (
          <Dialog title="청백전을 삭제할까요?" desc="참가자와 대진도 함께 지워지고 되돌릴 수 없습니다" ok="삭제" tone="danger" onCancel={() => setDialog(null)} onOk={() => setDialog(null)} />
        ) : undefined
      }
    />
  )
}
