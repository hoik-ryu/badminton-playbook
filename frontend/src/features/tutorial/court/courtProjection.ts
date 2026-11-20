// 경기장 이미지(game-images/경기장.png, 1086×1448) ↔ 기존 코트 좌표계(가로 0–61 × 세로 0–134 단위, 네트 y=67) 원근 변환.
// 프리뷰 전용(제품 코드 아님). 판정·칸 정의는 바꾸지 않고, 그림을 그릴 위치만 계산합니다.
//
// 보정 방법(2026-11-19, 이미지 픽셀 분석):
//  - 흰 코트 라인 픽셀(R,G,B > 215)을 행별로 찾아 세로 라인 5개(복식 사이드라인 2·단식 사이드라인 2·센터 라인)를 직선 x = m·y + b로 맞춤(잔차 ≤ 2.1px).
//  - 가로 라인 y: 먼 엔드라인 395, 먼 롱 서비스 427, 가까운 숏 서비스 839, 가까운 롱 서비스 1145, 가까운 엔드라인 1217(px).
//  - 대응점 16개(바깥 사이드라인 × 가로 라인 5개, 단식·센터 라인 × 엔드라인 2개)로 최소제곱 호모그래피(DLT)를 구함.
//    평균 오차 4.5px, 최대 13px(가까운 숏 서비스 라인 — 이미지가 실제 규격보다 약 1.5단위 뒤에 그려 있음).
//  - 네트(y=67) → 이미지 y≈703(그물 아래 띠 y≈693과 2단위 이내).
// 다른 경기장 이미지를 쓰려면 STADIUM만 바꾸면 됩니다(네 모서리 + 라인으로 같은 방식 보정).
export const STADIUM = {
  src: 'game/stadium.webp',
  w: 1086,
  h: 1448,
  /** 코트 단위(x, y, 1) → 이미지 픽셀 동차 좌표 */
  H: [
    [10.420269, -1.653808, 224.524197],
    [-0.006682, 2.425883, 397.157602],
    [-0.000007, -0.003049, 1.0],
  ],
  /** 화면에 꼭 보여야 하는 이미지 세로 범위(px): 상대 선수 머리 ~ 가까운 엔드라인 아래. 이 범위를 기준으로 맞춤(벽·바닥 여분은 잘림) */
  focus: { top: 300, bottom: 1250 },
} as const

export type Pt = readonly [number, number]

export function project([x, y]: Pt): [number, number] {
  const m = STADIUM.H
  const w = m[2][0] * x + m[2][1] * y + m[2][2]
  return [(m[0][0] * x + m[0][1] * y + m[0][2]) / w, (m[1][0] * x + m[1][1] * y + m[1][2]) / w]
}

/** 그 지점에서 1코트 단위가 이미지에서 몇 px인지(가로·세로). 원근 크기 조절에 씀 */
export function unitScale([x, y]: Pt): { h: number; v: number } {
  const a = project([x - 0.5, y]), b = project([x + 0.5, y])
  const c = project([x, y - 0.5]), d = project([x, y + 0.5])
  return { h: Math.hypot(b[0] - a[0], b[1] - a[1]), v: Math.hypot(d[0] - c[0], d[1] - c[1]) }
}

/** 이미지 픽셀 → 무대(이미지 상자) 백분율 */
export const pctX = (px: number) => `${(px / STADIUM.w) * 100}%`
export const pctY = (py: number) => `${(py / STADIUM.h) * 100}%`
