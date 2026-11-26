import { render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/api/errors'
import { routes } from '../../routes/router'
import { setPersona } from '../auth/devPersona'
import type { GameView, Person } from './api'
import { isMalformedMatchId } from './detailErrors'
import { CmMemberGameCard, CmOpsGameCard } from './ui/DetailCards'

// 5-B1 회귀: D-1(운영 경기 카드 긴 이름 겹침), D-2(운영진 상세의 잘못된 주소 식별자 → ST5)
// 실제 배치(겹침 여부)는 브라우저 E2E(check-clubmatch-api.mjs 'long-names-no-overlap', 360·390·1440)에서 측정하고, 여기서는 줄바꿈 규칙의 구조를 고정합니다.

// D-2 화면 시험용: 운영 상세 조회만 바꿔 끼움(나머지 Mock API는 그대로)
const nextViewError: { current: unknown } = { current: null }
vi.mock('./api', async (orig) => {
  const mod = await orig<typeof import('./api')>()
  return { ...mod, getClubMatchView: (id: string) => (nextViewError.current ? Promise.reject(nextViewError.current) : mod.getClubMatchView(id)) }
})

const person = (i: number, name: string, score: number | null, kind: Person['kind'] = 'member'): Person => ({ key: `${kind}:p${i}`, id: `p${i}`, kind, name, gender: i % 2 ? '여' : '남', grade: 'B조', score })
const LONG = ['김수한무거북이와두루미', '할머니댁강아지복실이', '오렌지주스한잔해요', '게스트최장이름선수']
const game: GameView = {
  no: 1,
  team1: [person(1, LONG[0]!, 10), person(2, LONG[1]!, 9)],
  team2: [person(3, LONG[2]!, 10), person(4, LONG[3]!, 7, 'guest')],
  winner: 1, gap: 2, genderRelaxed: false, repeatedMatchup: false, relaxations: [], manual: false, changed: false, resultChanged: false, round: null, court: null, cancelled: null,
}
const pathErr = new ApiError(422, { code: 'validation_error', message: 'Request validation failed', details: [{ loc: ['path', 'match_id'], msg: 'Input should be a valid UUID', type: 'uuid_parsing' }] })
const bodyErr = new ApiError(422, { code: 'validation_error', message: 'Request validation failed', details: [{ loc: ['body', 'totalGames'], msg: 'too large', type: 'less_than_equal' }] })

describe('5-B1 D-1: long names wrap inside the name column', () => {
  it('names column can shrink and wrap; each person is a shrinkable item; tail (gender+score) and separator stay together', () => {
    render(<CmOpsGameCard game={game} method="individual" showResult onPlayer={() => undefined} onResult={() => undefined} />)
    const card = screen.getByRole('article', { name: '1경기' })
    const columns = card.querySelectorAll('[data-names]')
    expect(columns).toHaveLength(2)
    for (const col of columns) expect(col).toHaveClass('min-w-0', 'flex-1', 'flex-wrap') // 팀 합·결과 버튼 자리를 침범하지 않게 줄어듦
    // 교체 버튼: 이름이 길면 버튼 안에서 줄바꿈, 누름 영역 높이 44 이상, 접근 이름 그대로
    const btn = within(card).getByRole('button', { name: `1경기 ${LONG[0]} 교체` })
    expect(btn).toHaveClass('min-h-11', 'min-w-0', 'max-w-full', '[overflow-wrap:anywhere]')
    expect(btn).not.toHaveClass('whitespace-nowrap')
    // 꼬리((여10) + 구분점)는 한 묶음 → '·'만 다음 줄로 떨어지지 않음. 마지막 사람에게는 구분점 없음
    const tail = btn.querySelector('.whitespace-nowrap')!
    expect(tail.textContent).toBe('(여10)\u00a0·')
    const last = within(card).getByRole('button', { name: `1경기 ${LONG[1]} 교체` })
    expect(last.textContent).toBe(`${LONG[1]}(남9)`)
    // 이름 글자는 줄바꿈 금지 묶음 밖(필요하면 글자 단위로 줄바꿈)
    for (const name of LONG) expect(within(card).getByText(name, { exact: false }).closest('.whitespace-nowrap')).toBeNull()
    // 팀 합·결과 버튼은 줄어들지 않음
    expect(within(card).getAllByText(/^=\d+$/)[0]).toHaveClass('shrink-0')
    expect(within(card).getByRole('button', { name: '1팀 승' })).toHaveClass('shrink-0')
  })

  it('without swap (recorded game) the same wrapping item is a span', () => {
    render(<CmOpsGameCard game={game} method="team" showResult={false} />)
    const item = screen.getByText(LONG[2]!, { exact: false })
    expect(item.tagName).toBe('SPAN')
    expect(item).toHaveClass('min-w-0', 'max-w-full', '[overflow-wrap:anywhere]')
  })

  it('member card: (나)·(게스트) tail with the separator, name bold and wrappable', () => {
    render(
      <CmMemberGameCard
        method="individual"
        game={{ no: 2, winner: null, changed: false, resultChanged: false, mySide: 1, round: null, court: null, cancelled: false, team1: [{ key: 'a', name: LONG[0]!, guest: false, me: true }, { key: 'b', name: LONG[3]!, guest: true, me: false }], team2: [{ key: 'c', name: '짧은이', guest: false, me: false }, { key: 'd', name: LONG[1]!, guest: false, me: false }] }}
      />,
    )
    const meName = screen.getByText(LONG[0]!)
    expect(meName).toHaveClass('font-bold')
    expect(meName.closest('.whitespace-nowrap')).toBeNull()
    expect(meName.parentElement!.querySelector('.whitespace-nowrap')!.textContent).toBe('(나)\u00a0·')
    expect(screen.getByText('(게스트)').closest('.whitespace-nowrap')!.textContent).toBe('(게스트)') // 마지막 사람: 구분점 없음
  })
})

describe('5-B1 D-2: malformed match id', () => {
  it('only a 422 for the path match_id counts as not found', () => {
    expect(isMalformedMatchId(pathErr)).toBe(true)
    expect(isMalformedMatchId(bodyErr)).toBe(false) // 다른 입력 검증 오류는 그대로
    expect(isMalformedMatchId(new ApiError(422, { code: 'validation_error', message: '', details: [{ loc: ['path', 'match_id'] }, { loc: ['body', 'x'] }] }))).toBe(false)
    expect(isMalformedMatchId(new ApiError(422, { code: 'min_players', message: '' }))).toBe(false)
    expect(isMalformedMatchId(new ApiError(404, { code: 'club_match_not_found', message: '' }))).toBe(false)
    expect(isMalformedMatchId(new Error('x'))).toBe(false)
  })

  describe('admin unified detail', () => {
    beforeEach(() => {
      window.localStorage.clear()
      nextViewError.current = null
    })
    const open = (path: string) => {
      setPersona('admin')
      render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
    }
    const st = () => document.querySelector('[data-scr="SCR-112"]')?.getAttribute('data-st')

    it('/club-matches/not-a-uuid (422 path match_id) → ST5 "찾을 수 없음"', async () => {
      nextViewError.current = pathErr
      open('/club-matches/not-a-uuid')
      expect(await screen.findByText('청백전을 찾을 수 없습니다')).toBeInTheDocument()
      expect(st()).toBe('SCR-112-ST5')
      expect(screen.getByRole('link', { name: '청백전 목록으로' })).toHaveAttribute('href', '/club-matches')
    })

    it('other 422 on the detail request stays ST4 (불러오기 실패 + 다시 시도)', async () => {
      nextViewError.current = bodyErr
      open('/club-matches/cm-1')
      expect(await screen.findByText('청백전을 불러오지 못했습니다')).toBeInTheDocument()
      await waitFor(() => expect(st()).toBe('SCR-112-ST4'))
    })
  })
})
