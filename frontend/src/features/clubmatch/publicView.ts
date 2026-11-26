// SCR-112 통합 상세: 운영진은 운영 응답(ClubMatchView) 하나로 공개 영역까지 그립니다(요청 중복·두 응답 사이 불일치 없음).
// 공개 영역에 필요한 값만 골라 회원 상세(PublicClubMatch)와 같은 모양으로 바꿉니다 — 점수·급수·성별·실력차·규칙 완화는 옮기지 않음.
// 사람 키는 운영 키(member:/guest:) 그대로 쓰되 화면 밖으로 나가지 않습니다(React key 전용).
// 머리글 표시 상태(UXD-087)는 운영 응답 계약을 바꾸지 않기 위해 같은 규칙(display.ts, KST)으로 계산합니다. 회원은 서버 값을 씁니다.
import type { ClubMatchView, Person } from './api'
import { displayStatusOf, todayKst, type DisplayStatus } from './display'
import type { MemberGame, MemberPlayer, PublicClubMatch } from './memberApi'

export function displayStatusOfView(view: Pick<ClubMatchView, 'status' | 'date' | 'games'>, today = todayKst()): DisplayStatus {
  return displayStatusOf(view.status, view.date, view.games.filter((g) => g.winner).length, today)
}

export function publicFromOps(view: ClubMatchView, meId: string | null): PublicClubMatch {
  const isMe = (p: Person) => p.kind === 'member' && p.id === meId
  const player = (p: Person): MemberPlayer => ({ key: p.key, name: p.name, guest: p.kind === 'guest', me: isMe(p) })
  const games = view.games.map((g): MemberGame => ({
    no: g.no,
    team1: g.team1.map(player),
    team2: g.team2.map(player),
    winner: g.winner,
    changed: g.changed,
    resultChanged: g.resultChanged,
    mySide: g.team1.some(isMe) ? 1 : g.team2.some(isMe) ? 2 : null,
    // (B15, C-37·AC-162) 라운드·코트·취소 여부만(취소 사유·처리자는 옮기지 않음)
    round: g.round,
    court: g.court,
    cancelled: g.cancelled !== null,
  }))
  const meKey = meId ? `member:${meId}` : null
  const shown = displayStatusOfView(view)
  return {
    id: view.id,
    name: view.name,
    date: view.date,
    method: view.method,
    // 공개 영역은 확정 후에만 그립니다(준비 중은 운영 기능 영역만, 02 SCR-112)
    status: view.status === 'finished' ? 'finished' : 'confirmed',
    modifiedAt: view.modifiedAt,
    resultModifiedAt: view.resultModifiedAt,
    games,
    standings: view.standings.map((s) => ({ ...s, me: s.key === meKey })),
    team: view.team,
    unrecorded: view.unrecorded,
    participating: games.some((g) => g.mySide !== null),
    displayStatus: shown === 'pending' ? 'live' : shown,
    currentRound: view.currentRound,
  }
}

/** 공개 영역 상태 ID(02 SCR-112): ST8 종료 > ST7 대진 수정 > ST15 진행 예정 > ST3 참가 안 함 > ST1 */
export function publicStateId(m: PublicClubMatch) {
  return m.status === 'finished' ? 'SCR-112-ST8' : m.modifiedAt ? 'SCR-112-ST7' : m.displayStatus === 'upcoming' ? 'SCR-112-ST15' : !m.participating ? 'SCR-112-ST3' : 'SCR-112-ST1'
}
