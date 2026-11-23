// 청백전 목록 표시 상태·결과(SCR-111 r6, UXD-087·088, DD r8 VD-055) — 서버 backend/app/modules/clubmatch/display.py와 같은 규칙.
// api 모드에서는 서버가 계산한 displayStatus·result를 그대로 씁니다. 상태·결과 계산은 Mock 어댑터와 테스트에서만 씁니다(날짜 표시 formatMatchDate는 화면 공통).
// DB 상태(draft·confirmed·finished)와 표시 상태(pending·upcoming·live·ended)는 다른 값입니다.
import { kstDate } from '../session/api'

export type DisplayStatus = 'pending' | 'upcoming' | 'live' | 'ended'
export type ClubMatchResult = {
  method: 'individual' | 'team'
  /** 팀전 승리 팀(무승부 draw). 개인전은 null */
  outcome: 'blue' | 'white' | 'draw' | null
  /** 팀전 최종 승수(청 x : 백 y). 개인전은 null */
  final: { blue: number; white: number } | null
  /** '청팀 승리'·'백팀 승리'·'무승부' / '1위 이름'·'공동 1위 · n명' */
  text: string
  /** 개인전 1위 인원. 팀전은 null */
  tiedCount: number | null
}

/** 오늘(KST) 날짜 'YYYY-MM-DD' */
export const todayKst = (now = new Date()) => kstDate(now)

/** UXD-087: 준비 중(확정 전) / 진행 예정(확정 + 날짜가 오늘보다 뒤 + 기록된 결과 없음) / 진행 중 / 종료 */
export function displayStatusOf(status: 'draft' | 'confirmed' | 'finished', date: string, recorded: number, today: string): DisplayStatus {
  if (status === 'draft') return 'pending'
  if (status === 'finished') return 'ended'
  return date > today && recorded === 0 ? 'upcoming' : 'live'
}

export function teamResult(blue: number, white: number): ClubMatchResult {
  const outcome = blue === white ? 'draw' : blue > white ? 'blue' : 'white'
  return { method: 'team', outcome, final: { blue, white }, text: { draw: '무승부', blue: '청팀 승리', white: '백팀 승리' }[outcome], tiedCount: null }
}

export function individualResult(topNames: string[]): ClubMatchResult | null {
  if (topNames.length === 0) return null
  return { method: 'individual', outcome: null, final: null, text: topNames.length === 1 ? `1위 ${topNames[0]}` : `공동 1위 · ${topNames.length}명`, tiedCount: topNames.length }
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
/** '2026-11-15' → '11월 15일 (토)'(날짜만 계산, 시간대 영향 없음) */
export function formatMatchDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()
  return `${m}월 ${d}일 (${DAYS[day]})`
}
