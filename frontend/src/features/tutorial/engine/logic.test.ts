import { describe, expect, it } from 'vitest'

import { LEVELS, STAGES, stageById } from '../content/stages'
import { bestChoice, finalFrame, frameAt, incomingTimeline, outcomeTimeline, totalDuration } from './animation'
import { choose, isFinished, isPassed, isRetrying, mergeProgress, next, passScore, retry, scoreOf, startRun, summarize } from './logic'
import type { Stage, Verdict } from './types'

// AC-096: 화면 렌더링 없이 게임 로직에 상황과 선택을 넣어 판정·점수·통과를 확인
const pick = (stage: Stage, i: number, v: Verdict) => stage.situations[i]!.choices.find((c) => c.verdict === v)!.id
const stage = stageById('beginner-1')!

describe('tutorial content (C-22, AC-093)', () => {
  it('MVP1: beginner·novice 3 stages × 5 situations, other levels coming soon', () => {
    expect(LEVELS.filter((l) => l.available).map((l) => l.id)).toEqual(['beginner', 'novice'])
    expect(LEVELS.filter((l) => !l.available).map((l) => l.name)).toEqual(['초보', 'D조 이상'])
    for (const level of ['beginner', 'novice'] as const) {
      const list = STAGES.filter((s) => s.level === level)
      expect(list.map((s) => s.no)).toEqual([1, 2, 3])
      for (const s of list) expect(s.situations).toHaveLength(5)
    }
    expect(STAGES.flatMap((s) => s.situations)).toHaveLength(30)
  })

  it('every situation has 2–4 choices, exactly one correct, at most one acceptable, unique ids', () => {
    const ids = new Set<string>()
    for (const s of STAGES.flatMap((x) => x.situations)) {
      expect(s.choices.length).toBeGreaterThanOrEqual(2)
      expect(s.choices.length).toBeLessThanOrEqual(4)
      expect(s.choices.filter((c) => c.verdict === 'correct')).toHaveLength(1)
      expect(s.choices.filter((c) => c.verdict === 'acceptable').length).toBeLessThanOrEqual(1)
      expect(new Set(s.choices.map((c) => c.label)).size).toBe(s.choices.length)
      for (const id of [s.id, ...s.choices.map((c) => c.id)]) {
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }
      // 코트 안 좌표, 내 편은 아래(UXD-064)
      for (const p of [s.from, s.pause, s.contact, s.win, s.keep, ...Object.values(s.start), ...s.choices.map((c) => c.to)]) {
        expect(p[0]).toBeGreaterThanOrEqual(0)
        expect(p[0]).toBeLessThanOrEqual(61)
        expect(p[1]).toBeGreaterThanOrEqual(0)
        expect(p[1]).toBeLessThanOrEqual(134)
      }
      expect(s.contact[1]).toBeGreaterThan(67)
      expect(s.win[1]).toBeLessThan(67)
    }
  })
})

describe('judging and scoring (AC-091·092)', () => {
  it('AC-091: correct / acceptable / wrong verdicts', () => {
    let run = startRun(stage)
    run = choose(run, stage, pick(stage, 0, 'correct'))
    expect(run.last).toBe('correct')
    expect(() => retry(run)).toThrow() // 정답 뒤에는 다시 도전 없음
    run = next(run)
    run = choose(run, stage, pick(stage, 1, 'acceptable'))
    expect(run.last).toBe('acceptable')
    run = retry(run)
    expect(isRetrying(run)).toBe(true)
    run = choose(run, stage, pick(stage, 1, 'wrong'))
    expect(run.last).toBe('wrong')
  })

  it('AC-092: 4 first-try correct + 1 correct on retry = 4/5 (80%) pass; retried correct is 0', () => {
    let run = startRun(stage)
    for (let i = 0; i < 4; i++) run = next(choose(run, stage, pick(stage, i, 'correct')))
    run = choose(run, stage, pick(stage, 4, 'wrong'))
    run = retry(run)
    run = choose(run, stage, pick(stage, 4, 'correct'))
    expect(run.last).toBe('correct')
    run = next(run)
    expect(isFinished(run, stage)).toBe(true)
    const r = summarize(run, stage)
    expect(r).toMatchObject({ score: 4, total: 5, passed: true, missed: [stage.situations[4]!.id] })
  })

  it('AC-092: 3 first-try correct = 3/5 (60%) not passed; moving on without retry is 0', () => {
    let run = startRun(stage)
    for (let i = 0; i < 3; i++) run = next(choose(run, stage, pick(stage, i, 'correct')))
    run = next(choose(run, stage, pick(stage, 3, 'acceptable')))
    run = next(choose(run, stage, pick(stage, 4, 'wrong')))
    expect(scoreOf(run)).toBe(3)
    expect(summarize(run, stage)).toMatchObject({ score: 3, passed: false })
    expect(summarize(run, stage).missed).toHaveLength(2)
  })

  it('70% threshold', () => {
    expect(passScore(5)).toBe(4)
    expect([0, 1, 2, 3, 4, 5].map((s) => isPassed(s, 5))).toEqual([false, false, false, false, true, true])
    expect(isPassed(7, 10)).toBe(true)
    expect(isPassed(6, 10)).toBe(false)
  })

  it('guards: cannot choose twice without retry/next, cannot go next before choosing', () => {
    const run = choose(startRun(stage), stage, pick(stage, 0, 'wrong'))
    expect(() => choose(run, stage, pick(stage, 0, 'correct'))).toThrow()
    expect(() => next(startRun(stage))).toThrow()
  })
})

describe('saving (AC-094, C-23): idempotent merge of only 3 fields', () => {
  const t1 = '2026-11-11T01:00:00.000Z'
  const t2 = '2026-11-12T01:00:00.000Z'
  it('pass with 4 then replay with 3: still passed, best 4, first pass time kept', () => {
    const a = mergeProgress(undefined, { score: 4, passed: true }, t1)
    expect(a).toEqual({ passed: true, best: 4, firstPassedAt: t1 })
    const b = mergeProgress(a, { score: 3, passed: false }, t2)
    expect(b).toEqual({ passed: true, best: 4, firstPassedAt: t1 })
    expect(Object.keys(b).sort()).toEqual(['best', 'firstPassedAt', 'passed'])
  })
  it('same result sent twice gives the same record (retry / timeout resend)', () => {
    const once = mergeProgress(undefined, { score: 5, passed: true }, t1)
    expect(mergeProgress(once, { score: 5, passed: true }, t2)).toEqual(once)
  })
  it('fail first, pass later: first pass time is the later save', () => {
    const a = mergeProgress(undefined, { score: 2, passed: false }, t1)
    expect(a).toEqual({ passed: false, best: 2, firstPassedAt: null })
    expect(mergeProgress(a, { score: 4, passed: true }, t2)).toEqual({ passed: true, best: 4, firstPassedAt: t2 })
  })
})

describe('animation timeline (CMP-046, renderer-independent)', () => {
  const s = stage.situations[0]!
  it('incoming stops the shuttle at the pause point', () => {
    const tl = incomingTimeline(s)
    expect(frameAt(tl, 0).shuttle).toEqual(s.from)
    expect(finalFrame(tl).shuttle).toEqual(s.pause)
    expect(totalDuration(tl)).toBeGreaterThan(0)
  })
  it('correct: shuttle ends on the opponent floor (point); wrong: on my side (lost); acceptable: back to opponent', () => {
    const correct = finalFrame(outcomeTimeline(s, bestChoice(s)))
    expect(correct.shuttle).toEqual(s.win)
    expect(correct.me).toEqual(bestChoice(s).to)
    const wrong = finalFrame(outcomeTimeline(s, s.choices.find((c) => c.verdict === 'wrong')!))
    expect(wrong.shuttle).toEqual(s.contact)
    const ok = finalFrame(outcomeTimeline(s, s.choices.find((c) => c.verdict === 'acceptable')!))
    expect(ok.shuttle).toEqual(s.keep)
  })
  it('positions are interpolated between keyframes', () => {
    const tl = outcomeTimeline(s, bestChoice(s))
    const mid = frameAt(tl, tl.segments[0]!.duration / 2).shuttle
    expect(mid[1]).toBeGreaterThan(Math.min(s.pause[1], s.contact[1]))
    expect(mid[1]).toBeLessThan(Math.max(s.pause[1], s.contact[1]))
  })
})
