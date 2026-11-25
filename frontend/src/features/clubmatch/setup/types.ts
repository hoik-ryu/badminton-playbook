import type { StepItem } from '../../../components/StepProgress'
import type { StepKey } from './steps'
import type { SetupController } from './useSetup'

/** 페이지가 단계 화면에 넘기는 공통 값 */
export type FrameCommon = {
  steps: StepItem[] | null
  current: StepKey
  onStep: (key: string) => void
  onExit: () => void
}

export type StepProps = {
  c: SetupController
  frame: FrameCommon
  /** 다음·이전 단계로(진행 표시와 같은 이동) */
  go: (step: StepKey) => void
}
