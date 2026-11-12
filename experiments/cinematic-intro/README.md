# SMAPSH 시네마틱 인트로 — 원본 시안 보관

승인 흐름 밖의 실험이었습니다. 실험 구현(HTML·CSS·JS PoC, 로컬 서버, 브라우저 검증 스크립트)은 앱으로 옮긴 뒤
2026-11-13 정리에서 삭제했습니다. 지금 이 폴더에는 **원본 시안만** 남아 있습니다.

## 현재 구현 위치

| 내용 | 위치 |
|---|---|
| 인트로 화면·장면 컷 | `frontend/src/features/intro/` (`IntroOverlay.tsx`, `intro.css`, `assets/v4/cut*.jpg`) |
| 타임라인(장면 정의) | `frontend/src/features/intro/timeline.ts` (PoC의 `intro.js` `PHASES`를 옮김) |
| 최초 방문 1회 정책 | `frontend/src/features/intro/introPolicy.ts` (PoC의 `policy.js`에 해당) |
| 브라우저 회귀 | `experiments/frontend-layout/check-b0.mjs`·`check-b1.mjs` |

삭제한 PoC 파일과 이전 장면 이미지(`shot*.jpg`, `assets/brand/`)는 Git 이력(커밋 `1770bab`)에서 꺼낼 수 있습니다.

## 남은 원본

| 파일 | 내용 | 크기 |
|---|---|---|
| `assets/source/storyboard-6cut.png` | 사용자 제공 6컷 시안(2026-11-11). 첫 PoC 장면 컷의 원본 | 1242×1266 |
| `assets/source/storyboard-v4-6cut.png` | 사용자 제공 6컷 보드(2026-11-12). 현재 앱 장면 컷(`frontend/src/features/intro/assets/v4/cut*.jpg`)의 원본 | |

- 시안 컷은 **임시 자산**입니다(사용자 결정 2026-11-11). 사용 권한은 사용자 확보를 전제로 하며, 외부에서 내려받은 이미지는 없습니다.
- 시안의 로고 장면 컷은 실제 SMAPSH 로고와 달라 쓰지 않고, 실제 로고 + CSS 빛 효과로 만들었습니다.
- 정식 자산은 컷마다 세로 1080×1920 이상, WebP·AVIF 장당 120KB 이하를 권장합니다.

## 로컬 결과물

`results/`는 삭제한 PoC 검증 스크립트가 만든 로컬 산출물입니다. Git에서 제외되어 있으며(`.gitignore`) 지워도 됩니다.
