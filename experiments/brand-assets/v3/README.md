# SMAPSH 브랜드 v3(확정본, 2026-11-11)

- 원본: `../source/brand-board.png`(사용자 제공 브랜드 보드). 새로 그리거나 AI로 다시 만들지 않았습니다.
- 생성: `node experiments/brand-assets/v3/extract-v3.mjs` → `out/`(같은 입력이면 같은 결과). 비교: `compare/sheet.jpg`
- v2(`../symbol-v2/`)와 차이: 왼쪽 아래 바깥 스피드 라인 구역만 밝은 중심선 기준(a 0.80–0.92)으로 다시 분리하고 가우시안(σ1.2) 후 재임계로 가장자리를 매끈하게 함. 깃털 3개·코르크·안쪽 곡선·전체 실루엣은 v2 기준 그대로. 밝은 배경 뿌리 색만 최소 보정(#3FD2C2 → #2BBFAF, 사용자 결정 A안).

| 파일(`out/`) | 크기 | 용도 | 적용 위치 |
|---|---|---|---|
| `smapsh-symbol-dark.png` / `-light.png` | 560×315(같은 알파) | 심볼 단독 | — |
| `smapsh-wordmark-dark.png` / `-light.png` | 846×97 | 워드마크(보드에서 같은 방법으로 재추출) | 인트로(dark) |
| `smapsh-lockup-stacked-dark.png` / `-light.png` | 846×378 | 세로형(보드 메인 배치 그대로) | 인트로 로고 장면 배치 기준 |
| `smapsh-lockup-horizontal-light.png` / `-dark.png` | 1120×175 | 가로형(보드 '로그인 화면 사용 예시' 실측 배치) | `frontend/src/assets/brand/`(로그인) |
| `smapsh-icon-{512,192,180,48,32,16}.png`, `favicon.ico` | | 앱 아이콘·파비콘(어두운 바탕 + 원본색 심볼) | `frontend/public/` |
| `meta.json` | | 설정값, 세로형 배치 좌표, 지운 조각 수 | — |

한계: 래스터 보드 추출이라 원본 픽셀 해상도가 한계(심볼 본체 500×255). 16px 파비콘은 깃이 뭉쳐 '청록 부채꼴'로만 읽힘(32px 이상 식별 가능). 인쇄·대형 그래픽은 디자이너 원본(벡터) 필요.
