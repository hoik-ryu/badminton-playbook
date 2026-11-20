// 내 편 반 코트의 학습 칸(C-27 번호 규칙, ASM-035 균등 분할). 렌더링과 분리된 순수 계산(NFR-009).
// 좌표는 기존 코트 좌표계(가로 0–61 × 세로 0–134단위, 네트 y=67, 내 편 y 67–134).
// 번호는 왼쪽 → 오른쪽, 위(네트 쪽) → 아래로 커짐: 6칸 1 2 / 3 4 / 5 6, 9칸 1 2 3 / … , 15칸 1–5 / 6–10 / 11–15.
// 칸 수는 서버 응답의 grid(cols × rows)로 정하므로 새 분할도 코드 변경 없이 동작합니다(AC-116).
export type Pt = readonly [number, number]
export type Cell = { no: number; x0: number; x1: number; y0: number; y1: number; cx: number; cy: number; label: string }

export const COURT = { width: 61, length: 134, net: 67 } as const

const ROW_NAME = ['앞', '가운데', '뒤']
const colName = (c: number, cols: number) =>
  cols === 2 ? ['왼쪽', '오른쪽'][c]! : cols === 3 ? ['왼쪽', '가운데', '오른쪽'][c]! : `왼쪽에서 ${c + 1}번째`

export function cells(cols: number, rows = 3): Cell[] {
  const w = COURT.width / cols
  const h = (COURT.length - COURT.net) / rows
  const out: Cell[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const no = r * cols + c + 1
      const x0 = w * c
      const y0 = COURT.net + h * r
      out.push({ no, x0, x1: x0 + w, y0, y1: y0 + h, cx: x0 + w / 2, cy: y0 + h / 2, label: `${no}번 칸, 내 편 ${ROW_NAME[r] ?? `${r + 1}번째`} 줄 ${colName(c, cols)}` })
    }
  return out
}

/** 칸 번호 → 칸 중심(이동 목표점 기본값, ASM-036) */
export function cellCenter(no: number, cols: number, rows = 3): [number, number] {
  const c = cells(cols, rows)[no - 1]!
  return [c.cx, c.cy]
}
