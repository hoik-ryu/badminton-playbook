import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { RosterPerson } from './api'
import { ScoreEntrySheet } from './ScoreEntrySheet'

// SCR-214 점수 입력: 같은 사람의 점수를 다시 고르면 '이전 점수'는 방금 저장한 값이어야 함
// (처음 받은 미설정 값을 계속 보내면 서버가 409 conflict로 거부 — 청백전 참가자 시트에서 재현된 결함)
const person = (id: string, name: string): RosterPerson => ({ id, kind: 'member', name, gender: '남', grade: 'C조', score: null, tutorialRecommendedUnpassed: false, version: 'v' })

describe('ScoreEntrySheet previous score', () => {
  it('re-selecting a score for the same person sends the just-saved score as previous', async () => {
    const calls: [string, number | null, number][] = []
    const save = vi.fn(async (p: RosterPerson, score: number) => {
      calls.push([p.id, p.score, score])
    })
    render(<ScoreEntrySheet people={[person('a', '가나'), person('b', '다라')]} onClose={() => {}} onAllDone={() => {}} save={save} />)
    const row = screen.getByRole('radiogroup', { name: '가나 점수' })
    fireEvent.click(within(row).getByRole('radio', { name: '1' }))
    await waitFor(() => expect(screen.getByText('완료 · 1점')).toBeInTheDocument())
    fireEvent.click(within(row).getByRole('radio', { name: '7' }))
    await waitFor(() => expect(screen.getByText('완료 · 7점')).toBeInTheDocument())
    expect(calls).toEqual([
      ['a', null, 1], // 처음: 미설정 → 1
      ['a', 1, 7], // 다시 고름: 이전 점수 = 방금 저장한 1
    ])
  })
})
