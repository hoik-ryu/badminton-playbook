import type { Choice, Frame, Pt, Situation } from './types'

// 애니메이션 타임라인(CMP-046) — 순수 계산. 렌더러는 frameAt(t)만 그리면 됨(2D SVG, 이후 다른 렌더러로 교체 가능)
export type Segment = { duration: number; to: Partial<Frame> }
export type Timeline = { start: Frame; segments: Segment[] }

const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)

export const totalDuration = (tl: Timeline) => tl.segments.reduce((s, x) => s + x.duration, 0)

/** t(ms) 시점의 위치. 구간마다 앞 구간 끝 위치에서 to로 이동 */
export function frameAt(tl: Timeline, t: number): Frame {
  let cur: Frame = { ...tl.start }
  let elapsed = 0
  for (const seg of tl.segments) {
    const end = elapsed + seg.duration
    const k = seg.duration === 0 ? 1 : Math.min(1, Math.max(0, (t - elapsed) / seg.duration))
    const next: Frame = { ...cur }
    for (const key of Object.keys(seg.to) as (keyof Frame)[]) next[key] = lerp(cur[key], seg.to[key]!, ease(k))
    if (t < end) return next
    cur = { ...cur, ...seg.to }
    elapsed = end
  }
  return cur
}

export const finalFrame = (tl: Timeline) => frameAt(tl, Number.POSITIVE_INFINITY)

const startFrame = (s: Situation): Frame => ({ ...s.start, shuttle: s.from })

/** 상황 재생: 상대 타구가 날아와 멈춤 지점에서 정지(ST2/재도전 → ST1) */
export function incomingTimeline(s: Situation): Timeline {
  return { start: startFrame(s), segments: [{ duration: 700, to: { shuttle: s.pause } }] }
}

/** 선택 결과: 선수가 움직이고 셔틀콕이 내려옴 → 정답은 받아 쳐서 상대 바닥(득점), 허용은 상대에게 넘어감(랠리 계속), 오답은 내 편 바닥(실점) */
export function outcomeTimeline(s: Situation, choice: Choice): Timeline {
  const start: Frame = { ...startFrame(s), shuttle: s.pause }
  const move: Segment = { duration: 650, to: { me: choice.to, partner: choice.partnerTo ?? s.start.partner, shuttle: s.contact } }
  if (choice.verdict === 'wrong') return { start, segments: [move, { duration: 350, to: {} }] }
  return { start, segments: [move, { duration: 550, to: { shuttle: choice.verdict === 'correct' ? s.win : s.keep } }] }
}

export const bestChoice = (s: Situation) => s.choices.find((c) => c.verdict === 'correct')!
