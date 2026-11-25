// 청백전 생성 페이지(SCR-241–246) 프리뷰용 가짜 데이터 — 모두 가상 인물(실제 개인정보 아님)
// 팀 배정안(proposeTeams)은 제품 규칙(C-34, 성별마다 점수 높은 순 → 인원 적은 팀 → 점수 합 작은 팀 → 같으면 청팀)을 화면 재현용으로 옮긴 것입니다.

export type Gender = '남' | '여'
export type Team = 'blue' | 'white'
export type SetupPerson = { id: string; name: string; gender: Gender; grade: string; score: number | null; guest?: boolean }

export const SETUP_PEOPLE: SetupPerson[] = [
  { id: 'p01', name: '김민수', gender: '남', grade: 'A조', score: 8 },
  { id: 'p02', name: '박지훈', gender: '남', grade: 'B조', score: 7 },
  { id: 'p03', name: '이서연', gender: '여', grade: 'B조', score: 6 },
  { id: 'p04', name: '정다은', gender: '여', grade: 'C조', score: 5 },
  { id: 'p05', name: '최현우', gender: '남', grade: 'C조', score: 5 },
  { id: 'p06', name: '한지민', gender: '여', grade: 'B조', score: 6 },
  { id: 'p07', name: '강하늘', gender: '남', grade: 'D조', score: 4 },
  { id: 'p08', name: '남궁하늘별빛', gender: '여', grade: 'B조', score: 6 },
  { id: 'p09', name: '문하린', gender: '여', grade: 'C조', score: 5 },
  { id: 'p10', name: '서지민', gender: '여', grade: 'D조', score: 4 },
  { id: 'p11', name: '송하은', gender: '여', grade: 'B조', score: 6 },
  { id: 'p12', name: '신동욱', gender: '남', grade: '초심', score: 3 },
  { id: 'p13', name: '오세훈', gender: '남', grade: 'B조', score: 7 },
  { id: 'p14', name: '윤지아', gender: '여', grade: '초심', score: 3 },
  { id: 'p15', name: '임재현', gender: '남', grade: 'C조', score: 5 },
  { id: 'p16', name: '장도윤', gender: '남', grade: 'A조', score: 9 },
  { id: 'p17', name: '정우성', gender: '남', grade: 'C조', score: 6 },
  { id: 'p18', name: '조민재', gender: '남', grade: 'D조', score: null },
  { id: 'p19', name: '최유진', gender: '여', grade: 'C조', score: 5 },
  { id: 'p20', name: '한소희', gender: '여', grade: 'C조', score: 5 },
  { id: 'p21', name: '홍서준', gender: '남', grade: '자강조', score: 10 },
  { id: 'p22', name: '황보은채', gender: '여', grade: '왕초심', score: 2 },
  { id: 'g01', name: '유가람', gender: '여', grade: '초심', score: 4, guest: true },
  { id: 'g02', name: '배준호', gender: '남', grade: 'C조', score: null, guest: true },
]

const byName = (a: SetupPerson, b: SetupPerson) => a.name.localeCompare(b.name, 'ko')
/** 명단 순서: 회원 이름순 → 게스트 이름순(UXD-074) */
export const ROSTER = [...SETUP_PEOPLE.filter((p) => !p.guest).sort(byName), ...SETUP_PEOPLE.filter((p) => p.guest).sort(byName)]
/** (r13) 확정 후 선수 교체(SCR-225-ST7) 재현용 — SCR-112 '가을 청백전'(mock/data.ts)의 가상 인물. 참가자 설정 명단(ROSTER)에는 넣지 않음 */
export const CONFIRMED_PEOPLE: SetupPerson[] = [
  { id: 'c01', name: '김가람', gender: '남', grade: 'B조', score: 7 },
  { id: 'c02', name: '오아라', gender: '여', grade: 'C조', score: 5 },
  { id: 'c03', name: '박다온', gender: '남', grade: 'A조', score: 9 },
  { id: 'c04', name: '신자람', gender: '여', grade: '왕초심', score: 2 },
  { id: 'c05', name: '윤새벽', gender: '남', grade: '초심', score: 3 },
  { id: 'c06', name: '남보람', gender: '남', grade: 'B조', score: 7 },
  { id: 'c07', name: '이하람', gender: '여', grade: 'B조', score: 6 },
  { id: 'c11', name: '한바다', gender: '남', grade: 'C조', score: 6 },
  { id: 'c12', name: '권초록', gender: '여', grade: 'C조', score: 5 },
  { id: 'c13', name: '정마루', gender: '남', grade: 'A조', score: 8 },
  { id: 'c14', name: '문솔빛', gender: '여', grade: '초심', score: 3, guest: true },
  { id: 'c15', name: '서이든', gender: '남', grade: 'D조', score: 4 },
  { id: 'c16', name: '최라온', gender: '여', grade: 'D조', score: 4 },
  { id: 'c17', name: '하늘솔', gender: '남', grade: 'C조', score: 5 },
]
export const person = (id: string) => (SETUP_PEOPLE.find((p) => p.id === id) ?? CONFIRMED_PEOPLE.find((p) => p.id === id))!

/** 16명 선택(남 8 · 여 8, 모두 점수 있음) */
export const SELECTED_16 = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p09', 'p11', 'p13', 'p14', 'p15', 'p16', 'p17', 'p19', 'g01']
/** 점수 미설정 2명이 들어간 선택(SCR-242-ST7) */
export const SELECTED_WITH_UNSCORED = [...SELECTED_16.slice(0, 12), 'p18', 'g02']

export function proposeTeams(ids: string[]): Record<string, Team> {
  const out: Record<string, Team> = {}
  let blue = 0, white = 0, bs = 0, ws = 0
  for (const g of ['남', '여'] as Gender[]) {
    const group = ids.map(person).filter((p) => p.gender === g).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id))
    for (const p of group) {
      const toBlue = blue < white || (blue === white && bs <= ws)
      out[p.id] = toBlue ? 'blue' : 'white'
      if (toBlue) { blue++; bs += p.score ?? 0 } else { white++; ws += p.score ?? 0 }
    }
  }
  return out
}

export const initial = (name: string) => name.slice(0, 1)
export const meta = (p: SetupPerson) => `${p.gender} · ${p.grade} · ${p.score === null ? '' : `${p.score}점`}`.replace(/ · $/, '')

export type Game = { no: number; t1: [string, string]; t2: [string, string]; relaxed?: boolean }
/** 팀전 8경기(16명, 1인 4경기는 아니고 청·백 각 8명이 2경기씩) — 미리보기 재현용 고정 대진 */
export function teamGames(teams: Record<string, Team>): Game[] {
  const b = Object.keys(teams).filter((k) => teams[k] === 'blue')
  const w = Object.keys(teams).filter((k) => teams[k] === 'white')
  const pairs = (xs: string[]) => [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7]].map(([i, j]) => [xs[i], xs[j]] as [string, string])
  const pb = pairs(b), pw = pairs(w)
  return pb.map((t1, i) => ({ no: i + 1, t1, t2: pw[(i + 1) % 8], relaxed: i === 6 }))
}
export const sum = (ids: string[]) => ids.reduce((s, id) => s + (person(id).score ?? 0), 0)
