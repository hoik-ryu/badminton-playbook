import { useCallback, useMemo, useRef, useState } from 'react'

import { isApiError } from '../../../lib/api'
import { kstDate } from '../../session/api'
import { CLUB_ERRORS, settleSaveFailure, type ClubMatchView, type ClubMethod, type Team } from '../api'
import { participantsOf, sameSet } from './steps'

// 생성 페이지 상태(C-32·C-33): 단계 입력은 화면에 두었다가 '다음'에서 바뀐 값만 저장합니다. 이전 단계로 가도 입력은 유지(UXD-099).
// 저장 결과 처리(AC-133): 성공 → 최신 상세 / 409 confirm_required → 대진 폐기 확인 창 / 409 conflict → 다시 받아
// 보내려던 결과가 이미 반영됐으면 성공(응답 유실), 아니면 충돌 창 → 최신 상태로 다시 그림 / 그 밖 → 안내 상자 + '다시 시도'(입력 유지)

export type BasicDraft = { method: ClubMethod | null; name: string; date: string }
export type GamesDraft = { totalGames: string; balance: boolean; gender: boolean; keepUneven: boolean }
export type TeamMove = { key: string; from: Team | null; to: Team }
export type TeamUi = { method: 'auto' | 'manual' | null; note: string | null; lastMove: TeamMove | null; seeded: boolean }

export type Drafts = {
  basic: BasicDraft
  participants: string[]
  teams: Record<string, Team | null>
  teamUi: TeamUi
  games: GamesDraft
  /** 대진이 있을 때 참가자·팀 변경에 대한 폐기 확인을 받았는지(ST10·ST11, '다음' 저장 때 함께 보냄) */
  discard: { participants: boolean; teams: boolean }
}

export const savedBasic = (v: ClubMatchView): BasicDraft => ({ method: v.method, name: v.name, date: v.date })
export const savedParticipants = (v: ClubMatchView) => participantsOf(v).map((r) => r.key)
export const savedTeams = (v: ClubMatchView): Record<string, Team | null> => Object.fromEntries(participantsOf(v).map((r) => [r.key, r.team]))
export const savedGames = (v: ClubMatchView): GamesDraft => ({ totalGames: String(v.totalGames), balance: v.rules.balance, gender: v.rules.gender, keepUneven: false })

export function emptyDrafts(): Drafts {
  return {
    basic: { method: null, name: '', date: kstDate() },
    participants: [],
    teams: {},
    teamUi: { method: null, note: null, lastMove: null, seeded: false },
    games: { totalGames: '8', balance: true, gender: true, keepUneven: false },
    discard: { participants: false, teams: false },
  }
}

export function draftsFrom(v: ClubMatchView, prev?: Drafts): Drafts {
  return {
    basic: savedBasic(v),
    participants: savedParticipants(v),
    teams: savedTeams(v),
    teamUi: { method: null, note: null, lastMove: null, seeded: prev?.teamUi.seeded ?? false },
    games: savedGames(v),
    discard: { participants: false, teams: false },
  }
}

export const sameTeams = (a: Record<string, Team | null>, b: Record<string, Team | null>) => sameSet(Object.keys(a), Object.keys(b)) && Object.keys(a).every((k) => a[k] === b[k])
export const sameGames = (a: GamesDraft, b: GamesDraft) => Number(a.totalGames) === Number(b.totalGames) && a.balance === b.balance && a.gender === b.gender

/** 단계별 저장하지 않은 변경(이탈 확인·ST9) */
export function dirtyOf(v: ClubMatchView | null, d: Drafts) {
  if (!v) return { basic: d.basic.method !== null || d.basic.name !== '' || d.basic.date !== kstDate(), participants: false, teams: false, games: false }
  const b = savedBasic(v)
  return {
    basic: d.basic.method !== b.method || d.basic.name.trim() !== b.name || d.basic.date !== b.date,
    participants: !sameSet(d.participants, savedParticipants(v)),
    teams: v.method === 'team' && !sameTeams(d.teams, savedTeams(v)),
    games: !sameGames(d.games, savedGames(v)),
  }
}

export type SaveResult = { kind: 'ok'; view: ClubMatchView } | { kind: 'confirm'; details: { games?: number; teams?: boolean } } | { kind: 'failed'; error: unknown } | { kind: 'conflict' }

export function useSetup(initial?: ClubMatchView) {
  const [view, setViewState] = useState<ClubMatchView | null>(initial ?? null)
  const [drafts, setDrafts] = useState<Drafts>(() => (initial ? draftsFrom(initial) : emptyDrafts()))
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<{ message: string; retry: () => void } | null>(null)
  const [conflict, setConflict] = useState<ClubMatchView | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  /** 서버 응답 반영: 저장한 단계의 입력은 저장값으로 맞추고, 팀 배정 입력은 새 참가자 목록과 맞춤(빠진 사람 제거·새 사람은 저장값) */
  const accept = useCallback((v: ClubMatchView, reset: Partial<Record<'basic' | 'participants' | 'teams' | 'games', boolean>> = {}) => {
    setViewState(v)
    setDrafts((d) => {
      const teams: Record<string, Team | null> = {}
      const saved = savedTeams(v)
      for (const k of Object.keys(saved)) teams[k] = reset.teams || !(k in d.teams) ? saved[k]! : d.teams[k]!
      return {
        basic: reset.basic ? savedBasic(v) : d.basic,
        participants: reset.participants ? savedParticipants(v) : d.participants,
        teams: v.method === 'team' ? teams : {},
        teamUi: reset.teams ? { ...d.teamUi, lastMove: null } : d.teamUi,
        games: reset.games ? savedGames(v) : d.games,
        discard: { participants: reset.participants ? false : d.discard.participants, teams: reset.teams ? false : d.discard.teams },
      }
    })
  }, [])

  /** 충돌 뒤 최신 상태로 전부 다시 그림(저장하지 않은 입력은 버림, AC-133) */
  const resetTo = useCallback((v: ClubMatchView) => {
    setViewState(v)
    setDrafts((d) => draftsFrom(v, d))
  }, [])

  const save = useCallback(
    async (attempt: () => Promise<ClubMatchView>, applied: (latest: ClubMatchView) => boolean, retry: () => void): Promise<SaveResult> => {
      setSaving(true)
      setFailure(null)
      try {
        return { kind: 'ok', view: await attempt() }
      } catch (e) {
        if (isApiError(e) && e.code === CLUB_ERRORS.confirmRequired) return { kind: 'confirm', details: (e.details ?? {}) as { games?: number; teams?: boolean } }
        const id = viewRef.current?.id
        if (id && isApiError(e) && e.code === CLUB_ERRORS.conflict) {
          try {
            const o = await settleSaveFailure(id, e, applied)
            if (o.kind === 'applied') return { kind: 'ok', view: o.view }
            if (o.kind === 'conflict') {
              setConflict(o.view)
              return { kind: 'conflict' }
            }
          } catch (again) {
            setFailure({ message: '저장하지 못했습니다. 입력한 내용은 그대로입니다', retry })
            return { kind: 'failed', error: again }
          }
        }
        return { kind: 'failed', error: e }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  const dirty = useMemo(() => dirtyOf(view, drafts), [view, drafts])
  return { view, setView: setViewState, drafts, setDrafts, saving, setSaving, failure, setFailure, conflict, setConflict, accept, resetTo, save, dirty }
}

export type SetupController = ReturnType<typeof useSetup>
