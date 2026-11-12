import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { finalFrame, frameAt, totalDuration, type Timeline } from './engine/animation'
import type { Frame } from './engine/types'

// 타임라인 재생(CMP-046): requestAnimationFrame으로 위치만 계산(frameAt)해 그림. 속도 1.0 / 0.5(UXD-069, 04 motion.tutorial.speed)
// - 움직임 줄이기(prefers-reduced-motion)·테스트 환경: 처음부터 결과 위치로 바로 표시(02 SCR-102)
// - skip(): 화면을 누르면 결과까지 건너뜀
export function prefersReducedMotion() {
  if (import.meta.env.MODE === 'test') return true
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function usePlayback(timeline: Timeline | null, playKey: number, speed: number, onDone: () => void) {
  const [frame, setFrame] = useState<Frame | null>(timeline ? timeline.start : null)
  const [playing, setPlaying] = useState(false)
  const raf = useRef<number | null>(null)
  const done = useRef(onDone)
  useLayoutEffect(() => {
    done.current = onDone
  })
  const finished = useRef(false)

  const finish = useCallback((tl: Timeline) => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    setFrame(finalFrame(tl))
    setPlaying(false)
    if (!finished.current) {
      finished.current = true
      done.current()
    }
  }, [])

  useEffect(() => {
    if (!timeline) return
    finished.current = false
    if (prefersReducedMotion()) {
      const id = window.setTimeout(() => finish(timeline), 0)
      return () => window.clearTimeout(id)
    }
    const total = totalDuration(timeline) / speed
    const t0 = performance.now()
    setPlaying(true)
    setFrame(timeline.start)
    const tick = (now: number) => {
      const t = now - t0
      if (t >= total) return finish(timeline)
      setFrame(frameAt(timeline, t * speed))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      raf.current = null
    }
    // playKey: 같은 타임라인을 다시 재생(다시 보기)
  }, [timeline, playKey, speed, finish])

  const skip = useCallback(() => {
    if (timeline && playing) finish(timeline)
  }, [timeline, playing, finish])

  return { frame, playing, skip }
}
