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
import { Scr241 } from './screens/SCR-241'
import { Scr242 } from './screens/SCR-242'
import { Scr243 } from './screens/SCR-243'
import { Scr225 } from './screens/SCR-225'
import { Scr244 } from './screens/SCR-244'
import { Scr245 } from './screens/SCR-245'
import { Scr246 } from './screens/SCR-246'
import { Scr226 } from './screens/SCR-226'

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
// (r12) 청백전 생성 페이지 SCR-241–246: 끝이 '-IND'인 보기는 같은 상태의 개인전 흐름(4단계), '-FEW'·'-FILTER'·'-NONE'은 같은 상태의 보조 보기입니다(manifest에는 02 상태 ID만).
//   상태 ID가 바뀌면 화면 안 상태를 새로 시작하도록 key를 줍니다(화면 안 링크로 같은 화면의 다른 상태로 갈 때).
// (r13) SCR-244 대진 편집기·SCR-225 시트(DD r13 VD-071–076): SCR-225 확정 전 보기는 SCR-244 위에 열린 시트(같은 편집 상태로 직접 조작), ST7은 SCR-112 위.
//   '-TEAM'·'-TEAM2'·'-IND4'·'-EDIT'는 같은 상태의 보조 보기(팀전, 팀당 2명, 개인전 4명, 편집한 대진)입니다(manifest에는 02 상태 ID만).
// (r14) 라운드·코트(DD r14 VD-077–086): SCR-244 기본 데이터는 팀전 18명(청 9·백 9)·코트 4·5라운드, '-IND'는 개인전 20명·코트 4·5라운드.
//   SCR-112 ST16–ST23은 운영진 라운드 진행(RoundLive), '-NEW'는 확정 직후, '-MEMBER'는 회원 화면 취소 표시. SCR-226은 SCR-112 위 시트(중도 귀가·복원)
export const screens: Record<string, ScreenDef> = {
  "SCR-101": { id: 'SCR-101', title: '튜토리얼 목록', platform: 'mobile', states: [{ id: 'SCR-101-ST1', label: '기본' }, { id: 'SCR-101-ST3', label: '빈 상태' }, { id: 'SCR-101-ST4', label: '오류' }, { id: 'SCR-101-ST7', label: '전체 완료' }], render: (s) => <Scr101 stateId={s} /> },
  "SCR-102": { id: 'SCR-102', title: '스테이지 플레이', platform: 'mobile', states: [{ id: 'SCR-102-PLAY', label: '상황 재생(격자 숨김)' }, { id: 'SCR-102-ST1', label: '선택 대기 6칸' }, { id: 'SCR-102-ST1-G9', label: '선택 대기 9칸' }, { id: 'SCR-102-ST11', label: '입문자 안내형' }, { id: 'SCR-102-ST12', label: '확정 대기' }, { id: 'SCR-102-ST7', label: '정답' }, { id: 'SCR-102-ST8', label: '허용' }, { id: 'SCR-102-ST9', label: '오답' }, { id: 'SCR-102-ST10', label: '정답 움직임' }], render: (s) => <Scr102 stateId={s} /> },
  "SCR-103": { id: 'SCR-103', title: '스테이지 결과', platform: 'mobile', states: [{ id: 'SCR-103-ST1', label: '통과' }, { id: 'SCR-103-ST2', label: '저장 중' }, { id: 'SCR-103-ST4', label: '저장 실패' }, { id: 'SCR-103-ST7', label: '미통과' }], render: (s) => <Scr103 stateId={s} /> },
  "SCR-111": { id: 'SCR-111', title: '청백전 목록', platform: 'mobile', states: [{ id: 'SCR-111-ST1', label: '기본(회원)' }, { id: 'SCR-111-ST1-OPS', label: '기본(운영진)' }, { id: 'SCR-111-ST3', label: '빈 상태(회원)' }, { id: 'SCR-111-ST4', label: '오류' }], render: (s) => <Scr111 stateId={s} /> },
  "SCR-112": { id: 'SCR-112', title: '청백전 상세', platform: 'mobile', states: [{ id: 'SCR-112-ST1', label: '진행 중(회원)' }, { id: 'SCR-112-ST3', label: '참가 안 함' }, { id: 'SCR-112-ST7', label: '대진 수정됨' }, { id: 'SCR-112-ST8', label: '종료' }, { id: 'SCR-112-ST12', label: '대진 검토(운영진)' }, { id: 'SCR-112-ST13', label: '확정·결과 입력(운영진)' }, { id: 'SCR-112-ST16-NEW', label: '확정 직후 1라운드(운영진)' }, { id: 'SCR-112-ST16', label: '라운드 진행(팀전)' }, { id: 'SCR-112-ST16-IND', label: '라운드 진행(개인전)' }, { id: 'SCR-112-ST17', label: '다음 라운드 시작 가능' }, { id: 'SCR-112-ST18', label: '다음 라운드 시작 불가' }, { id: 'SCR-112-ST19', label: '라운드 시작 취소 확인' }, { id: 'SCR-112-ST20', label: '시작 전 라운드' }, { id: 'SCR-112-ST21', label: '지난 라운드' }, { id: 'SCR-112-ST22', label: '취소된 경기(운영진)' }, { id: 'SCR-112-ST22-MEMBER', label: '취소된 경기(회원)' }, { id: 'SCR-112-ST23', label: '마지막 라운드 · 종료 조건' }, { id: 'SCR-112-ST24', label: '라운드 정보 없는 청백전' }], render: (s) => <Scr112 key={s} stateId={s} /> },
  "SCR-121": { id: 'SCR-121', title: '마이페이지', platform: 'mobile', states: [{ id: 'SCR-121-ST1', label: '기본' }, { id: 'SCR-121-ST3', label: '기록 없음' }, { id: 'SCR-121-ST7', label: '랭크 없음' }], render: (s) => <Scr121 stateId={s} /> },
  "SCR-122": { id: 'SCR-122', title: '프로필 수정(시트)', platform: 'mobile', states: [{ id: 'SCR-122-ST1', label: '기본' }, { id: 'SCR-122-ST4', label: '오류' }], render: (s) => <Scr122 stateId={s} /> },
  "SCR-201": { id: 'SCR-201', title: '운영 홈', platform: 'responsive', states: [{ id: 'SCR-201-ST1', label: '기본' }], render: (s) => <Scr201 stateId={s} /> },
  "SCR-202": { id: 'SCR-202', title: '오늘 운동', platform: 'responsive', states: [{ id: 'SCR-202-ST1', label: '생성 전' }, { id: 'SCR-202-ST7', label: '대진 검토' }], render: (s) => <Scr202 stateId={s} /> },
  "SCR-203": { id: 'SCR-203', title: '참석 체크(시트)', platform: 'responsive', states: [{ id: 'SCR-203-ST1', label: '기본' }], render: (s) => <Scr203 stateId={s} /> },
  "SCR-241": { id: 'SCR-241', title: '청백전 생성 · 기본정보', platform: 'responsive', states: [{ id: 'SCR-241-ST1', label: '기본(팀전)' }, { id: 'SCR-241-ST1-IND', label: '기본(개인전)' }, { id: 'SCR-241-ST7', label: '방식 미선택' }, { id: 'SCR-241-ST4', label: '오류' }, { id: 'SCR-241-ST8', label: '준비 중 편집' }, { id: 'SCR-241-ST9', label: '방식 변경 확인' }, { id: 'SCR-241-ST10', label: '삭제 확인' }, { id: 'SCR-241-ST11', label: '코트 수 변경 확인' }, { id: 'SCR-241-ST12', label: '라운드 정보 없는 준비 중' }], render: (s) => <Scr241 key={s} stateId={s} /> },
  "SCR-242": { id: 'SCR-242', title: '청백전 생성 · 참가자 설정', platform: 'responsive', states: [{ id: 'SCR-242-ST1', label: '기본(14명)' }, { id: 'SCR-242-ST1-IND', label: '기본(개인전)' }, { id: 'SCR-242-ST1-FILTER', label: '필터 적용' }, { id: 'SCR-242-ST1-FEW', label: '4명 미만' }, { id: 'SCR-242-ST2', label: '로딩' }, { id: 'SCR-242-ST3', label: '검색 결과 없음' }, { id: 'SCR-242-ST4', label: '저장 실패' }, { id: 'SCR-242-ST7', label: '점수 미설정' }, { id: 'SCR-242-ST8', label: '진행 가능' }, { id: 'SCR-242-ST10', label: '대진 폐기 확인' }], render: (s) => <Scr242 key={s} stateId={s} /> },
  "SCR-243": { id: 'SCR-243', title: '청백전 생성 · 팀 구성', platform: 'responsive', states: [{ id: 'SCR-243-ST1', label: '기본(저장된 배정)' }, { id: 'SCR-243-ST7', label: '자동 배정안 채움' }, { id: 'SCR-243-ST8', label: '미배정 있음' }, { id: 'SCR-243-ST9', label: '팀 인원 부족' }, { id: 'SCR-243-ST10', label: '인원 차이 경고' }, { id: 'SCR-243-ST11', label: '대진 폐기 확인' }, { id: 'SCR-243-ST12', label: '자동 배정 확인' }, { id: 'SCR-243-ST13', label: '직접 구성 확인' }, { id: 'SCR-243-ST14', label: '직접 구성(모두 미배정)' }], render: (s) => <Scr243 key={s} stateId={s} /> },
  "SCR-244": { id: 'SCR-244', title: '청백전 생성 · 대진 설정', platform: 'responsive', states: [{ id: 'SCR-244-ST1', label: '자동 생성 · 생성 전' }, { id: 'SCR-244-ST1-IND', label: '자동 생성 · 생성 전(개인전)' }, { id: 'SCR-244-ST2', label: '생성 중' }, { id: 'SCR-244-ST4', label: '생성 실패' }, { id: 'SCR-244-ST7', label: '대진 편집(재진입·팀전)' }, { id: 'SCR-244-ST7-IND', label: '대진 편집(재진입·개인전)' }, { id: 'SCR-244-ST8', label: '대진 폐기 확인' }, { id: 'SCR-244-ST9', label: '균등안 제안' }, { id: 'SCR-244-ST10', label: '직접 구성 · 빈 대진(0경기)' }, { id: 'SCR-244-ST10-IND', label: '직접 구성 · 빈 대진(개인전)' }, { id: 'SCR-244-ST11', label: '미완성 경기' }, { id: 'SCR-244-ST11-IND', label: '미완성 경기(개인전)' }, { id: 'SCR-244-ST12', label: '저장 중' }, { id: 'SCR-244-ST13', label: '저장 실패' }, { id: 'SCR-244-ST6', label: '충돌' }, { id: 'SCR-244-ST14', label: '다시 생성 확인(편집 있음)' }, { id: 'SCR-244-ST15', label: '직접 구성 전환 확인' }, { id: 'SCR-244-ST16', label: '경기 삭제 확인' }, { id: 'SCR-244-ST17', label: '이탈 확인' }, { id: 'SCR-244-ST18', label: '경기를 만들 수 없음(k = 0)' }, { id: 'SCR-244-ST19', label: '평균 4경기 미달 안내' }, { id: 'SCR-244-ST20', label: '라운드 이동 시트' }, { id: 'SCR-244-ST21', label: '라운드 추가(저장 전)' }, { id: 'SCR-244-ST22', label: '라운드 정리 알림' }, { id: 'SCR-244-ST23', label: '경기 200개 도달' }, { id: 'SCR-244-ST24', label: '라운드 구역 접힘' }], render: (s) => <Scr244 key={s} stateId={s} /> },
  "SCR-225": { id: 'SCR-225', title: '선수 교체(청백전, 시트)', platform: 'responsive', states: [{ id: 'SCR-225-ST1', label: '개인전 선수 자리(맞교환+교체)' }, { id: 'SCR-225-ST1-TEAM', label: '팀전 선수 자리(같은 팀 교체)' }, { id: 'SCR-225-ST9', label: '빈 자리 선택' }, { id: 'SCR-225-ST10', label: '경고 후보(경기 수 차이)' }, { id: 'SCR-225-ST11', label: '선택 불가 후보' }, { id: 'SCR-225-ST8', label: '경기 수 차이 확인' }, { id: 'SCR-225-ST12', label: '저장 중' }, { id: 'SCR-225-ST4', label: '저장 실패' }, { id: 'SCR-225-ST3', label: '고를 사람 없음(팀당 2명)' }, { id: 'SCR-225-ST3-IND4', label: '개인전 4명(맞교환만)' }, { id: 'SCR-225-ST7', label: '확정 후 교체(청백전 상세)' }, { id: 'SCR-225-ST13', label: '같은 라운드 출전 후보(선택 불가)' }], render: (s) => <Scr225 key={s} stateId={s} /> },
  "SCR-245": { id: 'SCR-245', title: '청백전 생성 · 확정', platform: 'responsive', states: [{ id: 'SCR-245-ST1', label: '기본(팀전)' }, { id: 'SCR-245-ST1-IND', label: '기본(개인전)' }, { id: 'SCR-245-ST1-EDIT', label: '편집한 대진(실제 경기 수·수동 변경)' }, { id: 'SCR-245-ST7', label: '검증 실패' }, { id: 'SCR-245-ST8', label: '확정 확인' }, { id: 'SCR-245-ST9', label: '라운드 검증 실패' }], render: (s) => <Scr245 key={s} stateId={s} /> },
  "SCR-226": { id: 'SCR-226', title: '대체 선수 지정(시트)', platform: 'responsive', states: [{ id: 'SCR-226-ST1', label: '중도 귀가 · 대체(팀전)' }, { id: 'SCR-226-ST1-IND', label: '중도 귀가 · 대체(개인전)' }, { id: 'SCR-226-ST8', label: '대체 불가 경기 취소 확인' }, { id: 'SCR-226-ST9', label: '취소 경기 복원' }, { id: 'SCR-226-ST10', label: '복원 불가' }], render: (s) => <Scr226 key={s} stateId={s} /> },
  "SCR-246": { id: 'SCR-246', title: '선택한 참가자(시트)', platform: 'responsive', states: [{ id: 'SCR-246-ST1', label: '기본' }, { id: 'SCR-246-ST3', label: '빈 상태' }], render: (s) => <Scr246 key={s} stateId={s} /> },
  "SCR-211": { id: 'SCR-211', title: '명단', platform: 'responsive', states: [{ id: 'SCR-211-ST1', label: '기본' }], render: (s) => <Scr211 stateId={s} /> },
  "SCR-212": { id: 'SCR-212', title: '회원·게스트 편집(시트)', platform: 'responsive', states: [{ id: 'SCR-212-ST1', label: '회원' }, { id: 'SCR-212-ST7', label: '게스트' }], render: (s) => <Scr212 stateId={s} /> },
  "SCR-213": { id: 'SCR-213', title: '사람 추가(시트)', platform: 'responsive', states: [{ id: 'SCR-213-ST1', label: '게스트 추가(중첩)' }, { id: 'SCR-213-ST7', label: '회원 직접 추가' }], render: (s) => <Scr213 stateId={s} /> },
}
