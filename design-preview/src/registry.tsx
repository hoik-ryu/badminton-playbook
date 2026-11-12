import type { ReactElement } from 'react'
import { Scr201 } from './screens/SCR-201'
import { Scr211 } from './screens/SCR-211'

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
export const screens: Record<string, ScreenDef> = {
  "SCR-201": { id: 'SCR-201', title: '운영 홈', platform: 'responsive', states: [{ id: 'SCR-201-ST1', label: '기본' }], render: (s) => <Scr201 stateId={s} /> },
  "SCR-211": { id: 'SCR-211', title: '명단', platform: 'responsive', states: [{ id: 'SCR-211-ST1', label: '기본' }], render: (s) => <Scr211 stateId={s} /> },
}
