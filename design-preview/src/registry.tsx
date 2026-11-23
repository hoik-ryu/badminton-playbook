import type { ReactElement } from 'react'
import { Scr101 } from './screens/SCR-101'
import { Scr102 } from './screens/SCR-102'
import { Scr103 } from './screens/SCR-103'
import { Scr111 } from './screens/SCR-111'
import { Scr112 } from './screens/SCR-112'
import { Scr121 } from './screens/SCR-121'
import { Scr122 } from './screens/SCR-122'
import { Scr201 } from './screens/SCR-201'
import { Scr202 } from './screens/SCR-202'
import { Scr203 } from './screens/SCR-203'
import { Scr211 } from './screens/SCR-211'
import { Scr212 } from './screens/SCR-212'
import { Scr213 } from './screens/SCR-213'

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
// 렌더 범위: Design Direction r8 6장(13개 화면, 38개 상태). 폭 390·1440(600px 한 열), 튜토리얼은 360×560·360×640도 확인
// SCR-102의 'SCR-102-PLAY'(상황 재생, 상태 ID 없음)·'SCR-102-ST1-G9'(ST1 9칸)은 07 6장이 요구한 보기 항목이며 manifest에는 02 상태 ID만 적습니다.
// SCR-111의 'SCR-111-ST1-OPS'는 같은 ST1의 운영진 보기('새 청백전'·준비 중 카드·4탭, UXD-086·089)입니다(manifest에는 02 상태 ID만).
export const screens: Record<string, ScreenDef> = {
  "SCR-101": { id: 'SCR-101', title: '튜토리얼 목록', platform: 'mobile', states: [{ id: 'SCR-101-ST1', label: '기본' }, { id: 'SCR-101-ST3', label: '빈 상태' }, { id: 'SCR-101-ST4', label: '오류' }, { id: 'SCR-101-ST7', label: '전체 완료' }], render: (s) => <Scr101 stateId={s} /> },
  "SCR-102": { id: 'SCR-102', title: '스테이지 플레이', platform: 'mobile', states: [{ id: 'SCR-102-PLAY', label: '상황 재생(격자 숨김)' }, { id: 'SCR-102-ST1', label: '선택 대기 6칸' }, { id: 'SCR-102-ST1-G9', label: '선택 대기 9칸' }, { id: 'SCR-102-ST11', label: '입문자 안내형' }, { id: 'SCR-102-ST12', label: '확정 대기' }, { id: 'SCR-102-ST7', label: '정답' }, { id: 'SCR-102-ST8', label: '허용' }, { id: 'SCR-102-ST9', label: '오답' }, { id: 'SCR-102-ST10', label: '정답 움직임' }], render: (s) => <Scr102 stateId={s} /> },
  "SCR-103": { id: 'SCR-103', title: '스테이지 결과', platform: 'mobile', states: [{ id: 'SCR-103-ST1', label: '통과' }, { id: 'SCR-103-ST2', label: '저장 중' }, { id: 'SCR-103-ST4', label: '저장 실패' }, { id: 'SCR-103-ST7', label: '미통과' }], render: (s) => <Scr103 stateId={s} /> },
  "SCR-111": { id: 'SCR-111', title: '청백전 목록', platform: 'mobile', states: [{ id: 'SCR-111-ST1', label: '기본(회원)' }, { id: 'SCR-111-ST1-OPS', label: '기본(운영진)' }, { id: 'SCR-111-ST3', label: '빈 상태(회원)' }, { id: 'SCR-111-ST4', label: '오류' }], render: (s) => <Scr111 stateId={s} /> },
  "SCR-112": { id: 'SCR-112', title: '청백전 상세', platform: 'mobile', states: [{ id: 'SCR-112-ST1', label: '진행 중(회원)' }, { id: 'SCR-112-ST3', label: '참가 안 함' }, { id: 'SCR-112-ST7', label: '대진 수정됨' }, { id: 'SCR-112-ST8', label: '종료' }, { id: 'SCR-112-ST12', label: '대진 검토(운영진)' }, { id: 'SCR-112-ST13', label: '확정·결과 입력(운영진)' }], render: (s) => <Scr112 stateId={s} /> },
  "SCR-121": { id: 'SCR-121', title: '마이페이지', platform: 'mobile', states: [{ id: 'SCR-121-ST1', label: '기본' }, { id: 'SCR-121-ST3', label: '기록 없음' }, { id: 'SCR-121-ST7', label: '랭크 없음' }], render: (s) => <Scr121 stateId={s} /> },
  "SCR-122": { id: 'SCR-122', title: '프로필 수정(시트)', platform: 'mobile', states: [{ id: 'SCR-122-ST1', label: '기본' }, { id: 'SCR-122-ST4', label: '오류' }], render: (s) => <Scr122 stateId={s} /> },
  "SCR-201": { id: 'SCR-201', title: '운영 홈', platform: 'responsive', states: [{ id: 'SCR-201-ST1', label: '기본' }], render: (s) => <Scr201 stateId={s} /> },
  "SCR-202": { id: 'SCR-202', title: '오늘 운동', platform: 'responsive', states: [{ id: 'SCR-202-ST1', label: '생성 전' }, { id: 'SCR-202-ST7', label: '대진 검토' }], render: (s) => <Scr202 stateId={s} /> },
  "SCR-203": { id: 'SCR-203', title: '참석 체크(시트)', platform: 'responsive', states: [{ id: 'SCR-203-ST1', label: '기본' }], render: (s) => <Scr203 stateId={s} /> },
  "SCR-211": { id: 'SCR-211', title: '명단', platform: 'responsive', states: [{ id: 'SCR-211-ST1', label: '기본' }], render: (s) => <Scr211 stateId={s} /> },
  "SCR-212": { id: 'SCR-212', title: '회원·게스트 편집(시트)', platform: 'responsive', states: [{ id: 'SCR-212-ST1', label: '회원' }, { id: 'SCR-212-ST7', label: '게스트' }], render: (s) => <Scr212 stateId={s} /> },
  "SCR-213": { id: 'SCR-213', title: '사람 추가(시트)', platform: 'responsive', states: [{ id: 'SCR-213-ST1', label: '게스트 추가(중첩)' }, { id: 'SCR-213-ST7', label: '회원 직접 추가' }], render: (s) => <Scr213 stateId={s} /> },
}
