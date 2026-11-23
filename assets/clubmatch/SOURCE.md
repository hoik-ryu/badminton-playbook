# 청백전(SCR-111) 이미지 에셋 — 최종 채택 **후보**

- 정리: 2026-11-20
- 상태(2026-11-23 갱신): 네 파일 모두 자산 등록부(`design-profile/assets.json`)에 등록됨(AST-067–070). **AST-070(laurel.png)만 권리 확인 완료**(아래 '권리 확인 기록'), AST-067–069는 권리 확인 대기·미사용 후보. `frontend/public/`에는 넣지 않았고, Design Direction r7 승인 전(현재 제출·승인 대기)에는 제품·Preview에서 쓰지 않습니다.
- 목표 디자인: `smapsh_cheongbaekje_assets_v2/reference/full_screen_reference.png`
- 원본: `cheongbaek_assets_v3/`(사용자 제작·제공, 삭제·수정하지 않음)
- 제작 도구: OpenAI ChatGPT 이미지 생성 도구(사용자 확인 2026-11-20)
- 제작 방식: AI 이미지 생성으로 신규 제작. 외부 이미지에서 잘라낸 에셋이 아님. v2의 잘라낸 저품질 PNG는 쓰지 않음
- 권리 확인: 자산 등록부 `rights`와 상태 파일(`.ai-workflow/design.json`)의 확인 기록이 기준. AST-070·AST-079는 2026-11-20 확인 완료(아래), AST-067–069는 '확인 대기'(`license: unknown`)
- 유니폼: SMAPSH 라벨·셔틀 로고를 포함한 원본을 수정하지 않고 씀. '청팀/백팀'은 유니폼 위에 겹치지 않고 유니폼 주변의 별도 UI 글자로 표시(사용자 결정 2026-11-20)

| 파일 | 원본 | 처리 | 크기(px) | sha256 |
|---|---|---|---|---|
| `team-blue-jersey.png` | `파란 배드민턴 메쉬 민소매 유니폼.png` | 그대로 복사(바이트 동일) | 1199×1312, 실제 내용 699×1252, RGBA | 9a053a2cd95fb4e532ab66a6a38c4951efcfb4a4757dbfca895f71d5c2912df1 |
| `team-white-jersey.png` | `화이트 배드민턴 스포츠 저지 상품 렌더.png` | 그대로 복사(바이트 동일) | 1199×1312, 실제 내용 704×1257, RGBA | 060b6748f1f88b93302afccc8931b5863014dc2411cd94557f21ac9456eb7a00 |
| `court-bg.png` | `청록빛 실내 배드민턴 경기장.png` | 그대로 복사(바이트 동일) | 1983×793, 불투명 RGB | 64cf674ec86ad27d9305e6603f9170f4666ad0163ef41750088c2540eb945fec |
| `laurel.png` | `민트빛 월계수 가지 일러스트.png`(원본 sha256 fa0ccc1a…13cd, 좌우 한 쌍) | 왼쪽 가지만 픽셀 그대로 잘라냄(115,83)–(623,951), 크기 변경·색 보정 없음. 오른쪽은 CSS `scaleX(-1)` | 508×868, RGBA | cdbde68a348820550b6ebf6751d26597f5f433fa83d5a8a5a8f25375a0153b12 |

## 검수 메모(2026-11-20)

- 유니폼: 실제 알파 채널, 가장자리 반투명 1.7%(정상 안티앨리어싱), 흰·짙은 청록·민트 배경 합성에서 테두리 잔여물 없음, 캔버스 끝 잘림 없음. 두 장의 옷걸이·각도·크기·조명 일치. 몸통 알파 252–254(거의 불투명, 눈에 띄지 않음). 목 라벨에 작은 'SMAPSH' 인쇄 글자와 가슴 셔틀 로고가 있음(배너 크기에서는 읽히지 않음)
- 코트: 왼쪽 1/3이 어두워 글자 배치에 적합(밝기 27 vs 오른쪽 66). 배너 3배 해상도(약 1074×450)보다 큼
- 월계수: 빛번짐(글로우)이 실제 반투명 알파. 흰 카드 위 작은 크기에서는 거의 보이지 않음. 좌우 가지 대칭(알파 차이 평균 3.3/255)
- 쓰지 않은 것: `smapsh_cheongbaekje_assets_v2`의 잘라낸 PNG 9개(사용 금지), `icons/badminton.svg`(렌더하면 라켓 형태가 아니고 획 일부가 잘림 — 대체 결정 필요). 나머지 아이콘은 Lucide(activity·clock·trophy·medal·chevron-right)로 대신함

## 2026-11-20 추가: 통합 배너(V08 탐색 후보)

- 상태(2026-11-23 갱신): **권리 확인 완료**, Design Direction r7 VD-052로 제출됨(승인 대기). Design Direction 승인 전에는 제품·Preview에서 쓰지 않음.
- 사용 목적: SCR-111 청백전 소개 배너(CMP-051) 배경. 오른쪽 청팀 VS 백팀 그래픽·월계수·셔틀콕이 이미지에 들어 있고, 왼쪽 빈 곳에 HTML/CSS 글자('SMAPSH 청백전' 배지·제목·설명)를 놓음. 그래픽은 CSS·다른 이미지로 다시 만들지 않음.
- 원본: 사용자 제공(2026-11-20, 대화 첨부 이미지 2장 중 글씨 없는 판).
- 제작 도구: OpenAI ChatGPT 이미지 생성 도구(사용자 확인 2026-11-20). 자산 등록부 `source: generated_tool`.
- 권리: **확인 완료**(2026-11-20, `explore-asset confirm`) — 아래 '권리 확인 기록'. ~~확인 대기(`rights.license: unknown`, `confirmed_by_user: false`)~~
- 함께 받은 글씨 있는 판은 서비스 에셋이 아니라 글자 배치 레퍼런스로만 씀: `design-explore/references/REF-003/`(원본 Git 제외, 권리 미상·참고 전용). 여기에 두지 않음.
  - REF-003 개인정보: 모델 점검 '개인정보 없음', 사용자 확인 '개인정보 없음'(2026-11-20, "청백전 UI 디자인을 위해 생성한 이미지이며, 실제 사용자 개인정보가 포함되지 않았음을 확인합니다").

| 파일 | 원본 | 처리 | 크기(px) | sha256 | 자산 등록부 |
|---|---|---|---|---|---|
| `clubmatch-banner.png` | 사용자 제공 글씨 없는 배너 | 그대로 복사(바이트 동일, 크기 변경·색 보정 없음) | 2172×724(3:1), 불투명 RGB | 20b509f6e838385e6685b00f599796fe4b324b8138b0183b5a8b63283310c701 | AST-079(image·decorative·SCR-111) |

### 기존 에셋 사용처 확인과 분류(삭제하지 않음)

사용처 검색 범위: 저장소 전체(`frontend/`·`design-preview/`·`docs/`·`design-explore/` 포함, `node_modules`·측정 스크린샷 제외).

| 파일 | 자산 ID | 사용처 | 분류 |
|---|---|---|---|
| `court-bg.png` | AST-067 | V06-A·V06-B·V07-A 탐색 시안(이력)만. 제품 코드·Preview·문서 없음 | **미사용 후보**(V08에서 통합 배너로 대체) |
| `team-blue-jersey.png` | AST-068 | 위와 같음 | **미사용 후보** |
| `team-white-jersey.png` | AST-069 | 위와 같음 | **미사용 후보** |
| `laurel.png` | AST-070 | V06·V07 배너·점수판, **V08-A 점수판(CMP-052)에서 계속 사용** | 사용 중(배너에서만 제외). 권리 확인 완료, Design Direction r7 VD-058로 제출됨(승인 대기) |

- 미사용 후보도 V06·V07 탐색 이력(시안·측정 기록·자산 등록부)이 참조하므로 지우지 않음. 정리는 Design Direction 결정 뒤 사용자 확인으로 따로 함.

## 제품 적용 시(승인 후)

- 표시 크기에 맞춘 WebP 파생본을 만들어 쓰고(원본 PNG 1.4–1.7MB), 파생 과정은 임시 폴더(`~/smapsh-work/`)에서 처리
- ~~승인되면 자산 등록부(`design-profile/assets.json`)에 출처·권리와 함께 등록~~ 등록은 완료(AST-067–070·079). 공식 사용 여부는 Design Direction 승인 기록의 자산 스냅샷이 기준

## 권리 확인 기록(2026-11-20, 자산 등록부·상태 파일과 같은 내용)

| 자산 | 파일 | 라이선스 기록 값 | 확인 | 연결 VD |
|---|---|---|---|---|
| AST-079 | `design-profile/assets/AST-079.png`(= `clubmatch-banner.png`, sha256 20b509f6…c701) | `OpenAI-Output (user-owned per OpenAI Terms of Use)` | 사용자 확인 2026-11-20T08:52:35Z | VD-052 |
| AST-070 | `design-profile/assets/AST-070.png`(= `laurel.png`, sha256 cdbde68a…3b12) | `OpenAI-Output (user-owned per OpenAI Terms of Use)` | 사용자 확인 2026-11-20T08:52:35Z | VD-058 |

- 사용자 확인 문장(원문 그대로): "AST-079 통합 배너와 AST-070 월계수는 모두 제가 OpenAI ChatGPT 이미지 생성 도구를 이용해 신규 제작한 이미지입니다. 외부 웹사이트의 이미지를 가져오거나 기존 상업용 이미지를 복사하여 제작한 것이 아닙니다. AST-070은 생성된 원본 이미지에서 왼쪽 월계수 가지를 추출한 파생본입니다. 두 이미지를 SMAPSH 프로젝트의 디자인 및 서비스 화면에 사용하는 것을 확인합니다. 이 값은 프로젝트 내부의 생성 이미지 출처 및 이용 권한 분류이며, 독점 저작권이나 제3자 권리 비침해에 대한 법적 보증을 의미하지 않습니다."
- 공식 기준은 자산 등록부와 `.ai-workflow/design.json`(`exploration.asset_rights`)이며, 이 문서는 설명용 사본입니다.
- 참고: 등록부 `depicts` 설명 끝의 '권리 확인 필요' 문구는 등록 당시 설명입니다. 이 항목은 Design Direction 제출 스냅샷(entry 해시)에 포함되므로 제출 뒤에는 고치지 않았습니다. 권리 상태의 기준은 `rights` 필드입니다.

## 제품 파생본(2026-11-24, 청백전 구현 1단계)

Design Direction r8(VD-052 '제품 적용 시 표시 크기에 맞춘 WebP 사본(같은 비율)')·Preview r5 승인 뒤 제품(`frontend/public/clubmatch/`)용으로 만든 사본입니다. 원본(자산 등록부 파일)은 바꾸지 않았습니다. 변환: Pillow(LANCZOS 축소), 저장소 밖에서 실행.

| 제품 파일 | 원본(자산 ID, sha256 앞 16자) | 크기 | 설정 | 품질 확인 | sha256 |
|---|---|---|---|---|---|
| `frontend/public/clubmatch/banner-1200.webp` | AST-079 `design-profile/assets/AST-079.png`(2172×724, `20b509f6e838385e`) | 1200×400(3:1 그대로), 42.3KB | WebP quality 88, method 6 | 같은 크기 PNG 대비 PSNR 38.0dB, 눈으로 비교 차이 없음. 표시 최대 568px(데스크톱 2배)·358px(모바일 3배)를 덮음 | `833467fd158775c42d470cd11511a8d1e83e1ef2753cd31517e4637563212d5d` |
| `frontend/public/clubmatch/laurel-160.webp` | AST-070 `design-profile/assets/AST-070.png`(508×868 RGBA, `cdbde68a34882055`) | 94×160(비율 0.585 → 0.588), 9.1KB | WebP quality 90, alpha_quality 100, method 6 | 알파 차이 0, 흰·surface·page·어두운 바탕 합성 PSNR 39.9dB. 표시 24×40의 4배 | `a6ff40a273272892f1fd20804d5d14605bc3c813b881d64e358fe728862447a9` |

- 권리: 원본과 같음(AST-079·070 권리 확인 2026-11-20, 라이선스 기록 값 `OpenAI-Output (user-owned per OpenAI Terms of Use)`). 파생본은 크기·형식만 바꾼 사본입니다.
- 제품 코드는 `frontend/src/features/clubmatch/ui/assets.ts`의 경로로만 참조합니다(장식, `aria-hidden`).

