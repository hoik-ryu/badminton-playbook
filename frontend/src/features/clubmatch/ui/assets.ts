// 청백전 이미지 자산(DD r8 VD-052·058) — 제품용 WebP 파생본(public/clubmatch/). 원본·권리: design-profile/assets.json AST-079·AST-070,
// 파생 기록: assets/clubmatch/SOURCE.md '제품 파생본'. 둘 다 장식(aria-hidden, CSS 배경)이며 실패하면 숨깁니다(fallback: hide).
const BASE = import.meta.env.BASE_URL

/** AST-079 통합 배너(3:1, 1200×400). 배너 상자도 3:1, background-size: contain(VD-052) */
export const CLUBMATCH_BANNER_URL = `${BASE}clubmatch/banner-1200.webp`
/** AST-070 월계수 왼쪽 가지(94×160). 오른쪽은 CSS scaleX(-1), 표시 24×40·불투명도 28%(VD-058) */
export const CLUBMATCH_LAUREL_URL = `${BASE}clubmatch/laurel-160.webp`
