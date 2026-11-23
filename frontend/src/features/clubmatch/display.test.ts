import { describe, expect, it } from 'vitest'

import { displayStatusOf, formatMatchDate, individualResult, teamResult, todayKst } from './display'

// SCR-111 r6 표시 상태·결과(UXD-087·088) — Mock 계산이 서버(backend/app/modules/clubmatch/display.py)와 같은 규칙인지
describe('UXD-087 display status', () => {
  it('pending / upcoming / live / ended', () => {
    expect(displayStatusOf('draft', '2026-11-15', 0, '2026-12-01')).toBe('pending')
    expect(displayStatusOf('finished', '2026-11-15', 3, '2026-11-01')).toBe('ended')
    expect(displayStatusOf('confirmed', '2026-11-15', 0, '2026-11-14')).toBe('upcoming')
    expect(displayStatusOf('confirmed', '2026-11-15', 0, '2026-11-15')).toBe('live') // 당일은 진행 중
    expect(displayStatusOf('confirmed', '2026-11-15', 1, '2026-11-14')).toBe('live') // 기록된 결과가 있으면 진행 중
  })

  it('today is the KST date (KST midnight = UTC 15:00)', () => {
    expect(todayKst(new Date('2026-11-14T14:59:59Z'))).toBe('2026-11-14')
    expect(todayKst(new Date('2026-11-14T15:00:00Z'))).toBe('2026-11-15')
  })
})

describe('UXD-088 result text', () => {
  it('team: winner text + final score', () => {
    expect(teamResult(8, 5)).toEqual({ method: 'team', outcome: 'blue', final: { blue: 8, white: 5 }, text: '청팀 승리', tiedCount: null })
    expect(teamResult(5, 5).text).toBe('무승부')
    expect(teamResult(1, 3).text).toBe('백팀 승리')
  })
  it("individual: '1위 이름' or '공동 1위 · n명'", () => {
    expect(individualResult(['김가람'])?.text).toBe('1위 김가람')
    expect(individualResult(['김가람', '박다온'])).toMatchObject({ text: '공동 1위 · 2명', tiedCount: 2, final: null })
    expect(individualResult([])).toBeNull()
  })
  it('date label', () => {
    expect(formatMatchDate('2026-11-15')).toBe('11월 15일 (일)')
    expect(formatMatchDate('2026-10-24')).toBe('10월 24일 (토)')
  })
})
