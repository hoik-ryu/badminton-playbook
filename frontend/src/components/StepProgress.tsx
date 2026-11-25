import { Check } from 'lucide-react'

// CMP-053 StepProgress — 04 r8(UXD-091), Design Direction r12 VD-060, Preview r8.
// 번호 원 + 선, 글자는 현재 단계 이름만('2/5 참가자 설정'). 완료 단계 원은 누르면 그 단계로(진행 가능한 단계만).
// 방식을 아직 고르지 않았으면(steps=null) '1 기본정보'와 안내만. 스타일은 styles/clubmatch-setup.css(.su 범위)
export type StepItem = { key: string; name: string; done: boolean; reachable: boolean }

export function StepProgress({ steps, current, onSelect }: { steps: StepItem[] | null; current: string; onSelect?: (key: string) => void }) {
  if (!steps)
    return (
      <div className="su-steps" data-cmp="CMP-053" data-steps="unknown">
        <ol aria-label="진행 단계">
          <li>
            <span className="su-step" data-s="current" aria-current="step" aria-label="1단계 기본정보, 현재">
              <span>1</span>
            </span>
          </li>
        </ol>
        <span className="su-step-label">1 기본정보 · 방식을 고르면 단계가 정해집니다</span>
      </div>
    )
  const idx = Math.max(0, steps.findIndex((s) => s.key === current))
  const pct = steps.length > 1 ? (idx / (steps.length - 1)) * 100 : 0
  return (
    <div className="su-steps" data-cmp="CMP-053" data-steps={steps.length}>
      <ol aria-label={`진행 단계 ${steps.length}개`}>
        {steps.map((s, i) => {
          const state = i === idx ? 'current' : s.done && i < idx ? 'done' : i < idx ? 'done' : 'todo'
          const label = `${i + 1}단계 ${s.name}, ${state === 'done' ? '완료' : state === 'current' ? '현재' : '남음'}`
          const clickable = state !== 'current' && s.reachable && !!onSelect
          return (
            <li key={s.key}>
              {i > 0 && <span aria-hidden className="su-step-line" data-done={i <= idx} />}
              {clickable ? (
                <button type="button" className="su-step" data-s={state} aria-label={`${label}. 이 단계로 이동`} onClick={() => onSelect(s.key)}>
                  <span>{state === 'done' ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}</span>
                </button>
              ) : (
                <span className="su-step" data-s={state} aria-current={state === 'current' ? 'step' : undefined} aria-label={label}>
                  <span>{state === 'done' ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {/* 현재 원 아래에 두되 카드 밖으로 나가지 않게: 왼쪽 여백 p%와 자기 폭의 -p% 이동 */}
      <span className="su-step-label" style={{ marginLeft: `${pct}%`, transform: `translateX(-${pct}%)` }}>
        {idx + 1}/{steps.length} {steps[idx]?.name}
      </span>
    </div>
  )
}
