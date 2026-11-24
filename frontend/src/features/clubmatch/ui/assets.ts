// 청백전 이미지 자산(DD r11 VD-052·VD-058) — 제품용 WebP 파생본(public/clubmatch/). 원본·권리: design-profile/assets.json AST-082·AST-070,
// 파생 기록: assets/clubmatch/SOURCE.md '제품 파생본'. 둘 다 장식이며 실패하면 숨깁니다(fallback: hide). 배너는 장식 img, 월계수는 CSS 배경.
const BASE = import.meta.env.BASE_URL

/** AST-082 통합 배너(원본 전체 구도, 1316×539 = 1692×693의 7/9, 비율 오차 0). 이미지 상자도 1692/693, img object-fit: contain(VD-052 r11) */
export const CLUBMATCH_BANNER_URL = `${BASE}clubmatch/banner-ast082-1316.webp`
/** AST-070 월계수 왼쪽 가지(94×160). 오른쪽은 CSS scaleX(-1), 표시 24×40·불투명도 28%(VD-058) */
export const CLUBMATCH_LAUREL_URL = `${BASE}clubmatch/laurel-160.webp`
