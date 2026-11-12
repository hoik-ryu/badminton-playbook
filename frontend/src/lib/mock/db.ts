import type { AccountStatus, Gender, Grade, Role } from '../../features/auth/types'

// Mock 어댑터의 가짜 저장소(VITE_DATA_SOURCE=mock). 브라우저 localStorage에 저장해 새로고침·여러 탭에서도 흐름이 이어집니다.
// 가상 인물만 씁니다(실제 개인정보 금지). 실제 백엔드 연결 시 이 파일은 쓰이지 않습니다.
export type MockUser = {
  id: string
  /** 카카오 회원번호(직접 추가 회원은 null) */
  kakaoId: string | null
  name: string
  gender: Gender
  grade: Grade
  referrer: string | null
  role: Role
  status: AccountStatus
  /** 가입 신청 시각(ISO) */
  appliedAt: string
  /** 1–10 실력 점수(운영진만, 미설정 null) */
  score: number | null
  /** 튜토리얼 통과 현황(난이도별 통과 스테이지 수 / 3) */
  tutorial: { beginner: number; novice: number }
  /** 서버가 판정하는 '튜토리얼 미통과'(정의는 명세 미확정 — docs/workflow-proposals/frontend-implementation-deviations.md) */
  tutorialUnpassed: boolean
  /** 랭크(S/A/B/C) 또는 없음 + 랭크까지 남은 경기 수 */
  rank: 'S' | 'A' | 'B' | 'C' | null
  gamesToRank: number | null
  record: { games: number; wins: number; losses: number }
}

/** 게스트는 회원과 따로 저장(카카오 계정·가입 레코드 없음, B2 사용자 결정) */
export type GuestInvolvement =
  | { kind: 'none' }
  | { kind: 'inRound' } // 진행 중 라운드 출전(SCR-212-ST8)
  | { kind: 'confirmedMatch'; matchId: string; matchName: string; remaining: number } // 확정된 미종료 청백전 미기록 경기(ST8)
  | { kind: 'draftLineup'; place: string } // 확정 전 대진(오늘 운동 또는 청백전 이름, ST10)
  | { kind: 'participantOnly'; matchName: string } // 청백전 참가자로만 등록(ST11)

export type MockGuest = {
  id: string
  name: string
  gender: Gender
  grade: Grade
  score: number | null
  /** (B2 임시값, 지금은 모두 none) 대진·청백전 포함 여부는 세션·청백전 데이터로 판정 */
  involvement: GuestInvolvement
}

/** 실시간 대진 세션(SCR-202–205, C-25). 사람 키: 'member:<id>' | 'guest:<id>' */
export type MockRound = {
  no: number
  seed: number
  status: 'draft' | 'inProgress' | 'completed'
  courts: { no: number; team1: [string, string]; team2: [string, string]; relaxations: ('noRepeat' | 'gender' | 'balance')[] }[]
  waiting: string[]
}
export type MockSession = {
  id: string
  /** 생성 시점 KST 날짜 YYYY-MM-DD(자정이 지나도 바뀌지 않음) */
  date: string
  status: 'open' | 'closed'
  /** 참석자 → 참석 체크 순서(C-04 동점 기준) */
  attendance: Record<string, number>
  checkSeq: number
  /** 진행 중 라운드에서 참석 해제된 사람(다음 라운드부터 제외, FLOW-004-S8a) */
  excludedNext: string[]
  options: { method: 'level' | 'random'; rules: { balance: boolean; gender: boolean; fairness: boolean; noRepeat: boolean } }
  rounds: MockRound[]
  /** 동시 조작 감지용(C-10): 대진이 바뀔 때마다 증가 */
  version: number
}

/** 청백전(SCR-221–226, C-13–C-20). 사람 키: 'member:<id>' | 'guest:<id>' */
export type MockClubMatch = {
  id: string
  name: string
  date: string
  method: 'individual' | 'team'
  status: 'draft' | 'confirmed' | 'finished'
  /** 참가자 → 팀(개인전 null), 중도 귀가 */
  participants: Record<string, { team: 'blue' | 'white' | null; left: boolean }>
  totalGames: number
  rules: { balance: boolean; gender: boolean }
  /** 확정 전에는 미확정 대진, 확정 후에는 확정 대진 */
  games: MockClubGame[]
  seed: number | null
  /** 팀 배정안을 채웠는지(팀전 패널 처음 열기, AC-072) */
  teamProposed: boolean
  /** 확정 후 대진 수정 시각(회원 화면 '대진이 수정되었습니다', C-15) */
  modifiedAt: string | null
  /** 종료 후 결과 수정 시각(U10·P-10, 대진 수정과 따로 안내) */
  resultModifiedAt?: string | null
  version: number
}

/** 청백전 경기(서버 club_match_games와 같은 의미). 선택 필드는 이전 Mock 저장본 호환용 */
export type MockClubGame = {
  no: number
  team1: [string, string]
  team2: [string, string]
  winner: 1 | 2 | null
  genderRelaxed: boolean
  /** 확정 후 대진 수정(교체·중도 귀가) */
  changed?: boolean
  /** 앞선 경기와 같은 4명·같은 팀(U7) */
  repeatedMatchup?: boolean
  /** 규칙 완화 사유(U7·C-03) */
  relaxations?: { rule: 'matchup' | 'gender'; reason: 'exhausted' | 'higher_priority' | 'search_limit' | 'manual' | 'substitute_exhausted' }[]
  /** 운영진이 선수를 직접 바꾼 경기 */
  manual?: boolean
  /** 종료 후 결과 수정(U10·P-10) */
  resultChanged?: boolean
}

export type MockDb = {
  version: 2
  clubMatches?: MockClubMatch[]
  users: MockUser[]
  guests: MockGuest[]
  sessions: MockSession[]
  /** 동호회 설정 코트 수(C-06 기본 4, 세션 중 바꾸지 않음) */
  courtCount: number
  /** 현재 로그인한 사용자 id(앱 세션) */
  session: string | null
  /** 이 기기에서 '카카오로 시작하기'를 누르면 쓰이는 가짜 카카오 회원번호 */
  kakaoId: string
  /** 카카오 인증은 됐지만 가입 전(가입 티켓). 가입 신청·그만두기로 지워짐 */
  signupTicket: string | null
  /** 개발 도구: 다음 카카오 로그인을 실패로 */
  failNextKakao: boolean
  /** 튜토리얼 진행(C-23: 회원 × 스테이지마다 통과 여부·최고 점수·최초 통과 시각만). 처음 읽을 때 샘플 회원의 tutorial 개수로 채움 */
  tutorialProgress?: Record<string, Record<string, MockStageProgress>>
  /** 개발·테스트: 다음 튜토리얼 진행 불러오기 / 저장을 실패로 */
  failNextTutorialLoad?: boolean
  failNextTutorialSave?: boolean
}

export type MockStageProgress = { passed: boolean; best: number; firstPassedAt: string | null }

const KEY = 'smapsh.mock.db.v1' // 키는 유지, version이 다르면 새 샘플로 초기화

const day = (d: number) => new Date(Date.UTC(2026, 10, d, 1, 0, 0)).toISOString()
type Extra = Partial<Pick<MockUser, 'score' | 'tutorial' | 'tutorialUnpassed' | 'rank' | 'gamesToRank' | 'record' | 'kakaoId'>>
const u = (id: string, name: string, gender: Gender, grade: Grade, role: Role, status: AccountStatus, appliedAt: string, referrer: string | null = null, extra: Extra = {}): MockUser => ({
  id,
  kakaoId: `kakao-${id}`,
  name,
  gender,
  grade,
  referrer,
  role,
  status,
  appliedAt,
  score: null,
  tutorial: { beginner: 0, novice: 0 },
  tutorialUnpassed: false,
  rank: null,
  gamesToRank: 10,
  record: { games: 0, wins: 0, losses: 0 },
  ...extra,
})
const rec = (games: number, wins: number) => ({ record: { games, wins, losses: games - wins } })

// 개발용 역할 전환 대상(devPersona)과 가입 승인 목록·명단 비교용 샘플
export const SEED_USERS: MockUser[] = [
  u('u-member', '김가람', '남', 'C조', 'member', 'approved', day(1), '박다온', { score: 7, tutorial: { beginner: 3, novice: 1 }, rank: 'B', gamesToRank: null, ...rec(24, 14) }),
  u('u-admin', '박다온', '남', 'A조', 'admin', 'approved', day(1), null, { score: 9, tutorial: { beginner: 3, novice: 3 }, rank: 'A', gamesToRank: null, ...rec(31, 20) }),
  u('u-super', '정마루', '남', '자강조', 'superAdmin', 'approved', day(1), null, { score: 10, tutorial: { beginner: 3, novice: 3 }, rank: 'S', gamesToRank: null, ...rec(40, 30) }),
  u('u-pending', '신규가입', '여', '입문자', 'member', 'pending', day(9)),
  u('u-rejected', '거절계정', '남', 'D조', 'member', 'rejected', day(5)),
  u('u-inactive', '비활성', '여', 'B조', 'member', 'inactive', day(2), null, { score: 6 }),
  // 명단(승인된 회원, design-preview SCR-211 샘플과 같은 가상 인물) — 가입 승인 중복 이름 경고 비교 대상
  u('m-1', '권초록', '여', 'B조', 'member', 'approved', day(1), null, { score: 6, tutorial: { beginner: 2, novice: 0 }, rank: 'C', gamesToRank: null, ...rec(12, 5) }),
  u('m-2', '오아라', '여', 'D조', 'member', 'approved', day(1), null, { score: 5, rank: null, gamesToRank: 4, ...rec(6, 3) }),
  u('m-3', '한바다', '남', 'B조', 'member', 'approved', day(1), null, { score: 8, tutorial: { beginner: 3, novice: 2 }, rank: 'A', gamesToRank: null, ...rec(28, 17) }),
  u('m-4', '서이든', '남', '입문자', 'member', 'approved', day(2), '김가람', { score: null, tutorialUnpassed: true }),
  u('m-5', '신자람', '여', '왕초심', 'member', 'approved', day(2), null, { score: 2, tutorial: { beginner: 1, novice: 0 }, tutorialUnpassed: true, gamesToRank: 7, ...rec(3, 1) }),
  u('m-6', '윤새벽', '남', '초심', 'member', 'approved', day(3), null, { score: 3, tutorial: { beginner: 3, novice: 0 }, gamesToRank: 6, ...rec(4, 2) }),
  u('m-7', '이나래', '여', 'C조', 'member', 'approved', day(3), null, { score: null, tutorial: { beginner: 1, novice: 0 }, tutorialUnpassed: true }),
  u('m-8', '정마음', '여', 'A조', 'member', 'approved', day(4), null, { score: 9, rank: 'S', gamesToRank: null, ...rec(35, 26) }),
  u('m-9', '최라온', '여', '초심', 'member', 'approved', day(4), null, { score: null, tutorialUnpassed: true }),
  u('m-10', '김민결', '남', '자강조', 'member', 'approved', day(5), null, { score: 10, rank: 'S', gamesToRank: null, ...rec(38, 29), kakaoId: null }), // 운영진 직접 추가 회원(카카오 없음)
  // 승인 대기 신청자(신청 순서)
  u('a-1', '이하늘', '여', 'C조', 'member', 'pending', day(7), '김가람'),
  u('a-2', '오아라', '여', '초심', 'member', 'pending', day(8)),
  u('a-3', '문새길', '남', '왕초심', 'member', 'pending', day(8), '박다온'),
]

export const SEED_GUESTS: MockGuest[] = [
  { id: 'g-1', name: '남보람', gender: '남', grade: 'C조', score: 7, involvement: { kind: 'none' } },
  { id: 'g-2', name: '문솔빛', gender: '여', grade: '입문자', score: 4, involvement: { kind: 'none' } },
  { id: 'g-3', name: '진바람', gender: '남', grade: 'D조', score: null, involvement: { kind: 'none' } },
  { id: 'g-4', name: '하솔', gender: '여', grade: '초심', score: 5, involvement: { kind: 'none' } },
  { id: 'g-5', name: '유하람', gender: '남', grade: 'B조', score: 6, involvement: { kind: 'none' } },
]

function seed(): MockDb {
  return { version: 2, users: SEED_USERS.map((x) => structuredClone(x)), guests: SEED_GUESTS.map((x) => structuredClone(x)), sessions: [], courtCount: 4, session: null, kakaoId: newKakaoId(), signupTicket: null, failNextKakao: false }
}

export function newKakaoId() {
  return `kakao-dev-${Math.random().toString(36).slice(2, 8)}`
}

let memory: MockDb | null = null // 저장소를 못 쓰는 환경(테스트 등)의 대체

export function readDb(): MockDb {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as MockDb
      if (db.version === 2) {
        db.sessions ??= [] // B3 이전에 저장된 Mock 데이터 보정
        db.courtCount ??= 4
        return db
      }
    }
  } catch {
    if (memory) return memory
  }
  const db = seed()
  writeDb(db)
  return db
}

export function writeDb(db: MockDb) {
  memory = db
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* 메모리만 사용 */
  }
}

export function updateDb<T>(fn: (db: MockDb) => T): T {
  const db = readDb()
  const result = fn(db)
  writeDb(db)
  return result
}

export function resetMockDb() {
  writeDb(seed())
}

/** 새 회원 레코드(가입 신청·운영진 직접 추가) */
export function newMockMember(input: Pick<MockUser, 'kakaoId' | 'name' | 'gender' | 'grade' | 'referrer' | 'status'> & { score?: number | null }): MockUser {
  return {
    id: `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    role: 'member',
    appliedAt: new Date().toISOString(),
    tutorial: { beginner: 0, novice: 0 },
    tutorialUnpassed: false,
    rank: null,
    gamesToRank: 10,
    record: { games: 0, wins: 0, losses: 0 },
    ...input,
    score: input.score ?? null,
  }
}
