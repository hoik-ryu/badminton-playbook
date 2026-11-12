# SMAPSH 시네마틱 인트로 PoC (실험 경로)

승인 흐름 밖의 실험입니다. `frontend/`, `design-preview/`, 승인 문서, 엔진은 건드리지 않습니다.

## 실행

```bash
node experiments/cinematic-intro/serve.mjs        # http://localhost:55190/
node experiments/cinematic-intro/verify.mjs       # 브라우저 검증(서버가 떠 있어야 함)
```

| 주소 | 내용 |
|---|---|
| `/` | 열 때마다 재생(PoC 기본). 끝나면 로그인 모사 화면, '인트로 다시 재생'으로 반복 |
| `/?policy=first-visit` | 최초 방문 1회 정책 적용(`policy.js`). 같은 브라우저에서 새로고침하면 생략 |
| `/?fail=1` | 이미지 로딩 실패 시험 → 인트로 없이 바로 로그인 모사 화면 |

## 구성

- 의존성 없음: HTML·CSS·JS 모듈, 애니메이션은 브라우저 내장 Web Animations API. 영상·음원 파일 없음(무음).
- 로고 장면(3.0–3.8초, 2026-11-11 브랜드 교체): 빛줄기가 왼쪽 아래에서 날아와 심볼 속도 궤적 꼬리에 닿음(3.0–3.12) → 심볼이 궤적 방향으로 그려짐 → 기울어진 워드마크가 미끄러져 들어옴 → 워드마크 위 반짝임 → 밝은 로그인(가로형 밝은 로고)
- 타임라인 4.1초(`intro.js` `PHASES`): 셔틀콕 0–0.7 → 스매시 0.7–1.4(플래시 1회) → 대각선 분할 복식 1.4–2.3 → 라켓 2.3–3.0 → 로고 강조 3.0–3.8 → 밝은 로그인 전환 3.8–4.1.
- 건너뛰기 버튼(44px, 처음부터 포커스)과 Esc. `prefers-reduced-motion: reduce`면 재생하지 않음. 이미지 2.5초 안에 준비 안 되면 생략.
- 모바일은 화면 전체, PC(≥1024px)는 실제 앱과 같은 가운데 600px 열 안에서 재생.
- 토큰 밖 실험 값: 네온 `#2CF0D6`, 무대 배경 `#02090A`, 그 밖의 빛 효과 색. 실제 반영 시 04 토큰 추가(②) 또는 테마 결정 필요.

## 이미지 자산과 출처

| 파일 | 장면 | 출처 | 원본 크기 → 가공 |
|---|---|---|---|
| `assets/shot1-shuttle.jpg` | 셔틀콕 클로즈업 | 사용자 제공 6컷 시안(2026-11-11 대화 첨부) 1번 컷에서 잘라냄 | 364×482, JPEG 82 |
| `assets/shot2-smash.jpg` | 스매시 | 같은 시안 2번 컷 | 364×482 |
| `assets/shot3a-player.jpg` | 선수 클로즈업 | 같은 시안 3번 컷 위쪽 | 364×215 |
| `assets/shot3b-doubles.jpg` | 복식 경기 | 같은 시안 3번 컷 아래쪽 | 364×252 |
| `assets/shot4-racket.jpg` | 라켓 클로즈업('PLAY TOGETHER' 글자는 시안에 포함된 그대로) | 같은 시안 4번 컷 | 364×486 |
| `assets/brand/smapsh-symbol-dark.png`, `smapsh-wordmark-dark.png` | 로고 장면(심볼·워드마크 따로 움직임) | 브랜드 보드(2026-11-11 확정)에서 분리 — `experiments/brand-assets/` | 577×294, 864×126 |
| `assets/brand/smapsh-horizontal-light.png`, `favicon.ico` | 로그인 모사·탭 아이콘 | 같음 | 1179×192 |
| `assets/source/storyboard-6cut.png` | 원본 시안 | 사용자 제공 | 1242×1266 |

- 시안 컷은 **임시 자산**입니다(사용자 결정 2026-11-11). 사용 권한은 사용자 확보를 전제로 하며, 외부에서 내려받은 이미지는 없습니다.
- 시안의 5번 컷(로고 장면)은 실제 SMAPSH 로고와 달라 쓰지 않고, 실제 로고 + CSS 빛 효과로 만들었습니다.
- 해상도가 낮아 화면에서 1.5–2.7배(고해상도 기기에서는 3–5배) 확대됩니다. 정식 자산은 컷마다 세로 1080×1920 이상, WebP·AVIF 장당 120KB 이하를 권장합니다.

## 결과

`results/`: `results.json`(단계 시점·배치·이미지·예외 경우), `frames/`(폭별 대표 시점 정지 화면), `video/intro-mobile-390.webm`(실제 시간 녹화), `contact-sheet-mobile-390.jpg`.
