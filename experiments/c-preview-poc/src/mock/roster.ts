// 가상 인물만 사용(docs/design-profile/figma.md 4장 SCR-211 샘플 세트). 실제 개인정보 없음.
export type Person = { name: string; gender: "남" | "여"; grade: string; score: number | null; inactive?: boolean };
export const members: Person[] = [
  { name: "권초록", gender: "여", grade: "B조", score: 6 },
  { name: "김가람", gender: "남", grade: "C조", score: 7 },
  { name: "박다온", gender: "남", grade: "A조", score: 9 },
  { name: "서이든", gender: "남", grade: "입문자", score: null },
  { name: "신자람", gender: "여", grade: "왕초심", score: 2 },
  { name: "오아라", gender: "여", grade: "D조", score: 5 },
  { name: "윤새벽", gender: "남", grade: "초심", score: 3 },
  { name: "이나래", gender: "여", grade: "C조", score: null },
  { name: "정마루", gender: "남", grade: "자강조", score: 10 },
  { name: "최라온", gender: "여", grade: "초심", score: null },
  { name: "한바다", gender: "남", grade: "B조", score: 8 },
  { name: "황하랑", gender: "남", grade: "D조", score: 6, inactive: true },
];
export const guests: Person[] = [
  { name: "남보람", gender: "남", grade: "C조", score: 7 },
  { name: "문솔빛", gender: "여", grade: "입문자", score: 4 },
];
