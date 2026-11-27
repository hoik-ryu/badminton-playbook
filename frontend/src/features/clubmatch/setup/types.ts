import type { ReactNode } from 'react'

import type { StepItem } from '../../../components/StepProgress'
import type { StepKey } from './steps'
import type { SetupController } from './useSetup'

/** 페이지가 단계 화면에 넘기는 공통 값 */
export type FrameCommon = {
  steps: StepItem[] | null
  current: StepKey
  onStep: (key: string) => void
  onExit: () => void
  /** (CP-001) 머리글 더보기 → '청백전 삭제'. 만든 뒤에만, 모든 단계 */
  onMore?: () => void
  /** 삭제 확인 창이 열려 있음(상태 표시용) */
  deleting?: boolean
  /** 삭제 실패 안내(카드 위쪽) */
  moreNotice?: ReactNode
}

export type StepProps = {
  c: SetupController
  frame: FrameCommon
  /** 다음·이전 단계로(진행 표시와 같은 이동) */
  go: (step: StepKey) => void
}
