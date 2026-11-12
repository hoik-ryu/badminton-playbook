// 튜토리얼 게임 데이터 형식(FR-025, C-22, NFR-009). 렌더링과 무관한 순수 데이터라 2D → 2.5D·3D로 바꿔도 그대로 씁니다.
// 좌표: 복식 코트 실제 비율의 단위계(가로 0–61, 세로 0–134, 1단위 = 10cm). 네트 y=67, 위쪽이 상대, 아래쪽이 내 편(UXD-064)
export type Pt = readonly [x: number, y: number]
export type Actor = 'me' | 'partner' | 'opp1' | 'opp2'
export type Frame = Record<Actor | 'shuttle', Pt>
export type Formation = Record<Actor, Pt>

/** 판정: 정답(득점, 첫 시도면 1점) · 허용(랠리 계속, 0점) · 오답(실점, 0점) */
export type Verdict = 'correct' | 'acceptable' | 'wrong'

export type Choice = {
  id: string
  /** 버튼 글자(앞으로·뒤로·옆으로·위치 유지 등) */
  label: string
  verdict: Verdict
  /** 이 선택으로 내가 가는 곳 */
  to: Pt
  /** 이 선택일 때 파트너가 가는 곳(없으면 그대로) */
  partnerTo?: Pt
  /** 한 줄 이유(결과 문구) */
  reason: string
}

export type Situation = {
  id: string
  /** 상황 설명 한 줄(코트 그림의 대체 정보) */
  prompt: string
  start: Formation
  /** 상대가 친 셔틀콕 출발점 → 멈춤(선택 대기) 지점 → 내 편에 떨어질 지점 */
  from: Pt
  pause: Pt
  contact: Pt
  /** 정답 움직임에서 셔틀콕을 받아 치는 사람 */
  hitter: 'me' | 'partner'
  /** 정답: 상대 코트 바닥(득점) / 허용: 상대에게 넘어가 랠리가 이어지는 지점 */
  win: Pt
  keep: Pt
  /** 허용 선택 뒤 '더 좋은 움직임은…' 설명 */
  better: string
  choices: Choice[]
}

export type LevelId = 'beginner' | 'novice' | 'intermediate' | 'advanced'
export type Level = { id: LevelId; name: string; available: boolean }

export type Stage = {
  /** 예: 'beginner-1' */
  id: string
  level: LevelId
  no: number
  title: string
  situations: Situation[]
}
