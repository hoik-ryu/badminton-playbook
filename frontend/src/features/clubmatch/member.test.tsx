import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { readDb, updateDb } from '../../lib/mock/db'
import { routes } from '../../routes/router'
import { setPersona, type PersonaKey } from '../auth/devPersona'
import { listRoster } from '../roster/api'
import { read } from './api'
import { getPublicClubMatch, listPublicClubMatches } from './memberApi'

// B5 회원 청백전(SCR-111·112)·마이페이지(SCR-121·122) — Mock
function renderAt(path: string, persona: PersonaKey = 'member') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
const seed = () => read() // 청백전 샘플 생성(cm-1 진행 중 팀전, cm-2 미확정, cm-3 종료 개인전)

describe('B5 member club matches (SCR-111·112)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    seed()
  })

  it('SCR-111 / AC-069·087 / UXD-075: only confirmed matches, latest first, with summary or final result', async () => {
    renderAt('/club-matches')
    const list = await screen.findByRole('list', { name: '청백전' })
    const items = within(list).getAllByRole('link')
    expect(items.map((a) => a.getAttribute('data-match'))).toEqual(['cm-1', 'cm-3'])
    expect(list).not.toHaveTextContent('연말 청백전') // 미확정은 이름도 없음
    expect(list).not.toHaveTextContent('대진 미확정')
    expect(items[0]).toHaveTextContent(/팀전.*진행 중.*청 \d+ : 백 \d+ · 미기록 4/)
    expect(items[1]).toHaveTextContent(/개인전.*종료.*(공동 )?1위/)
    expect(items[0]).toHaveAttribute('href', '/club-matches/cm-1')
  })

  it('SCR-111-ST3 / AC-089: no ongoing match → notice + past matches', async () => {
    updateDb((db) => void (db.clubMatches!.find((m) => m.id === 'cm-1')!.status = 'draft'))
    renderAt('/club-matches')
    expect(await screen.findByText('아직 공개된 청백전이 없습니다')).toBeInTheDocument()
    const past = screen.getByRole('list', { name: '지난 청백전' })
    expect(within(past).getAllByRole('link').map((a) => a.getAttribute('data-match'))).toEqual(['cm-3'])
  })

  it('SCR-112-ST5 / AC-069: unconfirmed and missing matches look the same', async () => {
    setPersona('member')
    for (const id of ['cm-2', 'nope']) {
      const { unmount } = render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [`/club-matches/${id}`] })} />)
      expect(await screen.findByText('청백전을 찾을 수 없습니다')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '청백전 목록으로' })).toHaveAttribute('href', '/club-matches')
      unmount()
    }
  })

  it('SCR-112 / AC-087·017·066·068: next game first, my games highlighted, no scores/gaps/grades/ranks', async () => {
    renderAt('/club-matches/cm-1')
    const next = await screen.findByRole('region', { name: '다음 경기' })
    const card = within(next).getByRole('article')
    expect(card).toHaveAttribute('data-mine', 'true')
    expect(card).toHaveAttribute('data-recorded', 'false')
    expect(within(card).getByText('김가람')).toHaveClass('font-bold')
    expect(within(card).getByText('나')).toBeInTheDocument()
    expect(within(card).getByText(/청팀|백팀/, { selector: 'h3 span' })).toBeInTheDocument()
    // 팀 승수, 전체 대진
    expect(screen.getByRole('region', { name: '팀 승수' })).toHaveTextContent(/청 \d+ : 백 \d+/)
    fireEvent.click(screen.getByText(/전체 대진 · 9경기/))
    const page = document.querySelector('[data-scr=SCR-112]')!
    expect(page.querySelectorAll('[data-cmp=CMP-041]').length).toBeGreaterThanOrEqual(9)
    // 운영 정보 없음
    expect(page.textContent).not.toMatch(/실력차|성별 규칙 완화|\(\d+\)|급수|점수/)
    expect(screen.queryByText('관리 화면으로 ›')).toBeNull()
    expect(page.getAttribute('data-st')).toBe('SCR-112-ST1')
  })

  it('AC-017·066·068 (API contract): member responses have no ops-only fields', async () => {
    const list = JSON.stringify(await listPublicClubMatches())
    const one = JSON.stringify(await getPublicClubMatch('cm-1', 'u-member'))
    for (const json of [list, one]) for (const key of ['"score"', '"gap"', '"grade"', '"genderRelaxed"', '"referrer"', '"gender"', '"version"', 'tutorial']) expect(json).not.toContain(key)
    await expect(getPublicClubMatch('cm-2', 'u-member')).rejects.toMatchObject({ status: 404, code: 'club_match_not_found' })
  })

  it('SCR-112-ST7 / AC-088: modified schedule shows banner with time and changed badge', async () => {
    updateDb((db) => {
      const m = db.clubMatches!.find((x) => x.id === 'cm-1')!
      m.modifiedAt = '2026-11-08T05:05:00.000Z' // 14:05 KST
      m.games.find((g) => !g.winner)!.changed = true
    })
    renderAt('/club-matches/cm-1')
    expect(await screen.findByText('대진이 수정되었습니다(14:05)')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/전체 대진/))
    expect(screen.getAllByText('변경됨').length).toBeGreaterThan(0)
  })

  it('SCR-112-ST8 / AC-084 / UXD-072: finished match shows final card on top and no next game', async () => {
    renderAt('/club-matches/cm-3')
    expect(await screen.findByRole('region', { name: '최종 순위' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '다음 경기' })).toBeNull()
    expect(document.querySelector('[data-scr=SCR-112]')).toHaveAttribute('data-st', 'SCR-112-ST8')
    // 내 순위 행 강조
    expect(document.querySelector('[data-cmp=CMP-042] li[data-me=true]')).toHaveTextContent('김가람')
  })

  it('SCR-112-ST3 / UXD-047: an admin who did not play sees the notice and the management link', async () => {
    renderAt('/club-matches/cm-3', 'superAdmin') // 정마루는 cm-3에 없음
    expect(await screen.findByText('이번 청백전에는 참가하지 않았어요')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '관리 화면으로 ›' })).toHaveAttribute('href', '/ops/club-matches/cm-3')
  })

  it('SCR-111-ST5: signed-out and pending users are redirected', async () => {
    const r1 = renderAt('/club-matches', 'guest')
    await waitFor(() => expect(r1.state.location.pathname).toBe('/login'))
  })
})

describe('B5 My Page (SCR-121·122)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    seed()
  })

  it('SCR-121 / AC-053·017 / UXD-054: rank → record → profile → logout, no 1–10 score', async () => {
    renderAt('/me')
    const page = await screen.findByText('청백전 전적')
    const root = page.closest('[data-scr=SCR-121]') as HTMLElement
    await waitFor(() => expect(root).toHaveAttribute('data-st', 'SCR-121-ST1'))
    expect(within(root).getByLabelText(/^랭크 [SABC]$/)).toBeInTheDocument()
    expect(root).toHaveTextContent(/승률 \d+%/)
    expect(root).toHaveTextContent(/\d+경기 \d+승 \d+패 · 승률 \d+%/)
    expect(root).toHaveTextContent('김가람 · 남 · 급수 C조')
    expect(root.textContent).not.toMatch(/7점|점수/)
    const headings = within(root).getAllByRole('heading').map((h) => h.textContent)
    expect(headings).toEqual(['마이페이지', '랭크', '청백전 전적', '프로필'])
    expect(within(root).getByRole('link', { name: '청백전 기록 보기 ›' })).toHaveAttribute('href', '/club-matches')
    expect(within(root).getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
  })

  it('SCR-121-ST3 / AC-055·046: no records → notice and "랭크까지 10경기"', async () => {
    updateDb((db) => {
      db.users.find((u) => u.id === 'u-member')!.record = { games: 0, wins: 0, losses: 0 }
      db.clubMatches = []
    })
    renderAt('/me')
    expect(await screen.findByText('청백전 기록이 없습니다')).toBeInTheDocument()
    expect(screen.getByText(/랭크까지 10경기/)).toBeInTheDocument()
  })

  it('AC-046: fewer than 10 games → no rank with remaining games', async () => {
    updateDb((db) => {
      db.users.find((u) => u.id === 'u-member')!.record = { games: 0, wins: 0, losses: 0 }
      db.clubMatches = db.clubMatches!.filter((m) => m.id === 'cm-3') // cm-3에서 몇 경기만
    })
    renderAt('/me')
    expect(await screen.findByText(/랭크까지 \d경기/)).toBeInTheDocument()
    expect(document.querySelector('[data-scr=SCR-121]')).toHaveAttribute('data-st', 'SCR-121-ST7')
  })

  it("UXD-056: '?' opens the rank criteria sheet", async () => {
    renderAt('/me')
    fireEvent.click(await screen.findByRole('button', { name: '랭크 기준 보기' }))
    const sheet = await screen.findByTestId('rank-help-sheet')
    expect(sheet).toHaveTextContent('승률 70% 이상')
    expect(sheet).toHaveTextContent('개인전·팀전 모든 청백전 경기의 승패가 반영됩니다')
  })

  it('SCR-122 / AC-054·098: edit name and grade → saved, toast, roster reflects it', async () => {
    renderAt('/me')
    fireEvent.click(await screen.findByRole('button', { name: '프로필 수정' }))
    const sheet = await screen.findByTestId('profile-sheet')
    expect(within(sheet).getByLabelText('이름')).toHaveValue('김가람')
    fireEvent.change(within(sheet).getByLabelText('이름'), { target: { value: '   ' } })
    fireEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await within(sheet).findByText('이름을 입력해 주세요')).toBeInTheDocument()
    fireEvent.change(within(sheet).getByLabelText('이름'), { target: { value: '김가람새' } })
    fireEvent.click(within(sheet).getByRole('radio', { name: 'B조' }))
    fireEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('profile-sheet')).toBeNull())
    await waitFor(() => expect(document.querySelector('[data-scr=SCR-121]')).toHaveTextContent('김가람새 · 남 · 급수 B조'))
    const roster = await listRoster()
    expect(roster.members.find((m) => m.id === 'u-member')).toMatchObject({ name: '김가람새', grade: 'B조' })
  })

  it('SCR-122: closing with changes asks "변경 내용을 버릴까요?"', async () => {
    renderAt('/me')
    fireEvent.click(await screen.findByRole('button', { name: '프로필 수정' }))
    const sheet = await screen.findByTestId('profile-sheet')
    fireEvent.click(within(sheet).getByRole('radio', { name: '여' }))
    fireEvent.click(within(sheet).getByRole('button', { name: '닫기' }))
    const dialog = await screen.findByRole('alertdialog', { name: '변경 내용을 버릴까요?' })
    fireEvent.click(within(dialog).getByRole('button', { name: '버리기' }))
    await waitFor(() => expect(screen.queryByTestId('profile-sheet')).toBeNull())
    expect(readDb().users.find((u) => u.id === 'u-member')!.gender).toBe('남')
  })
})
