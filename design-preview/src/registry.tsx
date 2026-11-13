import type { ReactElement } from 'react'
import { Scr201 } from './screens/SCR-201'
import { Scr202 } from './screens/SCR-202'
import { Scr203 } from './screens/SCR-203'
import { Scr211 } from './screens/SCR-211'
import { Scr212 } from './screens/SCR-212'
import { Scr213 } from './screens/SCR-213'
import { Scr223 } from './screens/SCR-223'

export type Platform = 'mobile' | 'responsive' | '공통'

export type ScreenDef = {
  /** docs/design/02-screens.md의 화면 ID (예: "SCR-001") */
  id: string
  title: string
  platform: Platform
  /** 프리뷰에서 보여 줄 상태. id는 02-screens.md의 상태 ID(예: "SCR-001-ST1") */
  states: { id: string; label: string }[]
  render: (stateId: string) => ReactElement
}

// 화면을 추가할 때마다 여기에 등록합니다. 키 형식 "SCR-001"을 유지해야 스크립트가 등록 여부를 확인할 수 있습니다.
// 렌더 범위: Design Direction r2 6장(7개 화면, 11개 상태). 폭 390·1440(600px 한 열)
export const screens: Record<string, ScreenDef> = {
  "SCR-201": { id: 'SCR-201', title: '운영 홈', platform: 'responsive', states: [{ id: 'SCR-201-ST1', label: '기본' }], render: (s) => <Scr201 stateId={s} /> },
  "SCR-202": { id: 'SCR-202', title: '오늘 운동', platform: 'responsive', states: [{ id: 'SCR-202-ST1', label: '생성 전' }, { id: 'SCR-202-ST7', label: '대진 검토' }], render: (s) => <Scr202 stateId={s} /> },
  "SCR-203": { id: 'SCR-203', title: '참석 체크(시트)', platform: 'responsive', states: [{ id: 'SCR-203-ST1', label: '기본' }], render: (s) => <Scr203 stateId={s} /> },
  "SCR-211": { id: 'SCR-211', title: '명단', platform: 'responsive', states: [{ id: 'SCR-211-ST1', label: '기본' }], render: (s) => <Scr211 stateId={s} /> },
  "SCR-212": { id: 'SCR-212', title: '회원·게스트 편집(시트)', platform: 'responsive', states: [{ id: 'SCR-212-ST1', label: '회원' }, { id: 'SCR-212-ST7', label: '게스트' }], render: (s) => <Scr212 stateId={s} /> },
  "SCR-213": { id: 'SCR-213', title: '사람 추가(시트)', platform: 'responsive', states: [{ id: 'SCR-213-ST1', label: '게스트 추가(중첩)' }, { id: 'SCR-213-ST7', label: '회원 직접 추가' }], render: (s) => <Scr213 stateId={s} /> },
  "SCR-223": { id: 'SCR-223', title: '청백전 운영 상세', platform: 'responsive', states: [{ id: 'SCR-223-ST7', label: '대진 검토' }, { id: 'SCR-223-ST8', label: '확정' }], render: (s) => <Scr223 stateId={s} /> },
}
