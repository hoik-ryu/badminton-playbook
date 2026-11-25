import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect } from 'vitest'

import { ApiError } from '../../../lib/api'
import { readDb, updateDb } from '../../../lib/mock/db'
import { routes } from '../../../routes/router'
import { setPersona, type PersonaKey } from '../../auth/devPersona'
import { createClubMatch, generateClub, saveParticipants, saveTeams, type ClubMethod } from '../api'

// 생성 페이지 테스트 공용(Mock). 실제 라우터(routes)와 역할 전환(setPersona)으로 띄웁니다.
export function renderAt(path: string, persona: PersonaKey = 'admin') {
  setPersona(persona)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(createElement(RouterProvider, { router }))
  return router
}
export const match = (id: string) => readDb().clubMatches!.find((m) => m.id === id)!
export const page = () => document.querySelector('.su[data-scr]') as HTMLElement | null
export const st = () => page()?.getAttribute('data-st') ?? null
export const waitSt = (id: string) => waitFor(() => expect(st()).toBe(id))
export const next = () => screen.getByTestId('su-next')
/** '다음'이 누를 수 있게 될 때까지 기다렸다가 누름(저장 직후 화면 전환 중의 비활성 상태를 피함) */
export async function clickNext() {
  await waitFor(() => expect(screen.getByTestId('su-next')).toBeEnabled(), { timeout: 3000 })
  fireEvent.click(screen.getByTestId('su-next'))
}
/** 점수 있는 승인 회원(Mock 샘플): 김가람 7·박다온 9·정마루 10·권초록 6·오아라 5·한바다 8·신자람 2·윤새벽 3·정마음 9·김민결 10 */
export const SCORED = ['u-member', 'u-admin', 'u-super', 'm-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-8', 'm-10'].map((x) => `member:${x}`)
export const halves = (keys: string[]) => Object.fromEntries(keys.map((k, i) => [k, i % 2 ? 'white' : 'blue'] as const))
export const networkError = () => new ApiError(0, { code: 'network_error', message: 'Unable to reach the server' })
/** 다른 운영진이 먼저 바꾼 것처럼 version만 올림(충돌 재현) */
export const bumpVersion = (id: string) => updateDb((db) => void db.clubMatches!.find((m) => m.id === id)!.version++)

/** 준비 중 청백전을 API(Mock)로 만들어 둠: 참가자 → (팀전) 팀 → (선택) 대진 */
export async function seedDraft(opts: { method: ClubMethod; keys?: string[]; teams?: 'halves' | 'none'; games?: number; name?: string }) {
  const id = await createClubMatch({ method: opts.method, date: '2026-12-13', name: opts.name ?? '준비 중 테스트' })
  let v = { version: 1 }
  const keys = opts.keys ?? SCORED.slice(0, 8)
  if (keys.length) v = await saveParticipants(id, v.version, keys)
  if (opts.method === 'team' && opts.teams !== 'none' && keys.length) v = await saveTeams(id, v.version, halves(keys))
  if (opts.games) await generateClub(id, v.version, { totalGames: opts.games, rules: { balance: true, gender: true } })
  return id
}
