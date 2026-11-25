import { CalendarDays, ChevronDown, Grid2x2, Info, Minus, PenLine, Plus, User, Users } from 'lucide-react'
import { useState } from 'react'
import { Dialog, SectionTitle, SetupScreen, ShuttleIcon, StepBar, stepHref, type Method } from '../components/smapsh/Setup'

// SCR-241 청백전 생성 · 기본정보 — UX Spec r9 02 SCR-241, UXD-090–092 / DD r12 VD-059–063, REF-004
// 보기: ST1(방식 팀전 선택, 입력 완료) · ST1-IND(개인전) · ST7(방식 미선택) · ST4(오류) · ST8(준비 중 편집, 더보기) · ST9(방식 변경 확인) · ST10(삭제 확인)
// 방식 타일을 누르면 진행 표시 칸 수가 바로 바뀝니다(5 ↔ 4).
// (r14) 날짜 아래 '사용 코트 수' 스테퍼(1–8, 기본 4, VD-077, UXD-105). ST11 코트 수 변경 확인(대진 있음) · ST12 라운드 정보 없는 준비 중 청백전
export function Scr241({ stateId }: { stateId: string }) {
  const ind = stateId.endsWith('-IND')
  const st = stateId.replace(/-IND$/, '')
  const startMethod: Method | null = st === 'SCR-241-ST7' || st === 'SCR-241-ST4' ? null : ind ? 'individual' : 'team'
  const [method, setMethod] = useState<Method | null>(startMethod)
  const [name, setName] = useState(st === 'SCR-241-ST4' ? '2026년 12월 둘째 주 토요일 정기 운동 겸 청백전 대회' : st === 'SCR-241-ST7' ? '' : '12월 둘째 주 청백전')
  const draft = st === 'SCR-241-ST8' || st === 'SCR-241-ST9' || st === 'SCR-241-ST10' || st === 'SCR-241-ST11' || st === 'SCR-241-ST12'
  const legacy = st === 'SCR-241-ST12'
  const savedCourts = 4
  const [courts, setCourts] = useState(st === 'SCR-241-ST11' ? 3 : 4)
  const hasGames = draft // 준비 중 편집 보기는 대진이 저장된 청백전
  const [dialog, setDialog] = useState<'method' | 'delete' | 'courts' | null>(st === 'SCR-241-ST9' ? 'method' : st === 'SCR-241-ST10' ? 'delete' : st === 'SCR-241-ST11' ? 'courts' : null)
  const tooLong = name.trim().length > 30
  const err = st === 'SCR-241-ST4'
  const next = method ? stepHref('SCR-242', method) : undefined
  const courtChanged = hasGames && (legacy || courts !== savedCourts)
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
          <section className="su-sec">
            <SectionTitle icon={<Grid2x2 aria-hidden />} req>
              사용 코트 수
            </SectionTitle>
            {legacy && (
              <div className="su-note" data-tone="mint" role="status" data-cmp="CMP-023">
                <Info aria-hidden />
                <span>라운드 정보가 없는 청백전입니다. 코트 수를 정하면 기존 대진은 버리고 라운드로 다시 구성합니다</span>
              </div>
            )}
            <div className="su-stepper" data-cmp="CMP-006" data-variant="stepper">
              <button type="button" aria-label="코트 수 줄이기" disabled={courts <= 1} onClick={() => setCourts((c) => Math.max(1, c - 1))}>
                <Minus aria-hidden />
              </button>
              <input aria-label="사용 코트 수" inputMode="numeric" value={courts} onChange={(e) => setCourts(Math.min(8, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} />
              <span className="su-unit">면</span>
              <button type="button" aria-label="코트 수 늘리기" disabled={courts >= 8} onClick={() => setCourts((c) => Math.min(8, c + 1))}>
                <Plus aria-hidden />
              </button>
            </div>
            <p className="su-help" aria-live="polite">한 라운드에 최대 {courts}경기를 동시에 진행합니다</p>
          </section>
        </>
      }
      bar={courtChanged ? <StepBar next={`#SCR-241/SCR-241-ST11${ind ? '-IND' : ''}/mobile`} nextLabel="다음" /> : <StepBar next={next} nextLabel="다음" disabledReason={undefined} />}
      overlay={
        dialog === 'method' ? (
          <Dialog title="방식을 바꾸면 만든 대진과 팀 배정이 초기화됩니다" desc="참가자는 유지됩니다" ok="바꾸기" onCancel={() => setDialog(null)} onOk={() => { setMethod(method === 'team' ? 'individual' : 'team'); setDialog(null) }} />
        ) : dialog === 'courts' ? (
          <Dialog title="코트 수를 바꾸면 만든 대진이 초기화됩니다" desc="대진 설정 단계에서 다시 만들어야 합니다" ok="바꾸기" tone="danger" onCancel={() => { setCourts(savedCourts); setDialog(null) }} onOk={() => { window.location.hash = stepHref('SCR-242', method ?? 'team') }} />
        ) : dialog === 'delete' ? (
          <Dialog title="청백전을 삭제할까요?" desc="참가자와 대진도 함께 지워지고 되돌릴 수 없습니다" ok="삭제" tone="danger" onCancel={() => setDialog(null)} onOk={() => setDialog(null)} />
        ) : undefined
      }
    />
  )
}
