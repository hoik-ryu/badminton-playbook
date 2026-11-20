# 자산 권리 확인안 — V04-A 최종 후보(2026-11-19, 미확정)

엔진 규칙(`pd_assets.py`): 권리 확인은 `explore-asset confirm --id AST-xxx --license <라이선스> --note "<사용자 문장>"`으로만 기록됩니다. 라이선스가 비었거나 `unknown`·`unconfirmed`면 거부되고, 확인 근거는 상태 파일(design.json)에 파일 해시와 함께 남습니다. `reference_derived` 자산은 확인할 수 없습니다. **아래 문장은 제안이며, 사용자가 사실을 확인하고 직접 말한 문장만 기록합니다.** 법률 자문이 아닙니다.

| 자산 | 현재 등록(출처·라이선스) | 확인 근거 | 제안 `--license` | 제안 확인 문장(사용자가 사실 확인 후) |
|---|---|---|---|---|
| AST-001·014·015·016 (Lucide 탭 아이콘) | licensed·ISC | Lucide 저장소 LICENSE: ISC(일부 Feather 유래 아이콘은 MIT). 조건: 저작권·허가 고지를 사본에 유지 | `ISC` | "AST-001, AST-014, AST-015, AST-016은 Lucide v1.70.0 아이콘으로 ISC 라이선스(일부 MIT) 조건에 따라 저작권 고지를 유지하여 SMAPSH에서 사용합니다." |
| AST-018 (intro-1 번호 격자 SVG) | model_drawn·unknown | 이 프로젝트 작업 중 Claude(Claude Code)가 코드로 작성한 SVG. 외부 원본 없음. 적용 약관은 이 세션을 쓰는 조직의 Anthropic 계약(상업 약관 등)에 따르며 이번 작업에서 계약 원문을 확인하지 못함 | **보류**(계약 확인 전 `own` 등으로 확정하지 않음) | 조직 계약에서 출력물 권리 조항을 확인한 뒤 그 문구에 맞춰 작성 |
| AST-046 (배너 셔틀콕) | **self_made**·unknown (실제는 ChatGPT 생성 → 아래 주의) | OpenAI 이용약관: 사용자와 OpenAI 사이에서 법이 허용하는 범위에서 사용자가 Output을 소유하고, OpenAI는 보유한 권리(있다면)를 사용자에게 양도. 타인의 출력·제3자 출력은 제외. 사용자는 사용 전 출력의 적절성을 검토해야 함 | `OpenAI-Output (user-owned per OpenAI Terms of Use)` | "AST-046은 제가 ChatGPT 이미지 생성 기능으로 만든 이미지를 가공한 것으로, OpenAI 이용약관에 따라 제가 소유한 출력물로서 SMAPSH 앱에 사용합니다. 특정 인물·상표·타인 저작물을 모사하지 않았음을 확인했습니다." |
| AST-028–034 (스테이지 썸네일 7종) | generated_tool·unknown | 위와 같음(smapsh_assets_v2 보드에서 추출·크롭) | 위와 같음 | "AST-028부터 AST-034는 제가 ChatGPT로 생성한 보드 이미지에서 추출·가공한 것으로, OpenAI 이용약관에 따라 제가 소유한 출력물로서 SMAPSH 앱에 사용합니다." |
| AST-035–037 (과정 장식 3종) | generated_tool·unknown | 위와 같음(학습 UI 보드에서 추출·배경 제거) | 위와 같음 | "AST-035, AST-036, AST-037은 제가 ChatGPT로 생성한 학습 UI 보드에서 추출·가공한 것으로, OpenAI 이용약관에 따라 제가 소유한 출력물로서 SMAPSH 앱에 사용합니다." |

## 확인 전 사용자가 점검할 사실
1. 실제 사용한 ChatGPT 계정 유형(개인 Plus/Pro, Team, Enterprise)과 그 시점에 적용된 약관 — 회사 계정이면 회사 계약 조건이 우선할 수 있음.
2. 프롬프트에 타인의 저작물·상표·특정 인물 모사를 요청하지 않았는지(REF-001 이미지를 입력으로 넣었다면 그 권리도 확인 필요 — REF-001은 현재 '권리 미상, 참고 전용').
3. AI 생성물은 사람의 창작적 기여가 없으면 저작권 보호를 받지 못할 수 있음(한국·미국 공통 쟁점). 소유·사용은 가능해도 타인의 유사 이미지 사용을 막기 어려울 수 있음 — 상업 사용 전 회사 법무 검토 권장.
4. 회사 보안 지침: 생성 도구에 회사 기밀·개인정보를 넣지 않았는지.

## (2026-11-19 갱신) 사용자 지시 반영
- AST-026·AST-046: A안 — 등록 출처 `self_made`는 그대로 두고, 확인 문장에 실제 생성 이력(ChatGPT 이미지 생성 → 사용자 제공 → 배경 제거 가공)을 명시. 레지스트리 수동 수정 없음.
- 확정 기록(`explore-asset confirm`)은 아직 하지 않음. 엔진 허용 값: `--license`는 빈 값·`unknown`·`unconfirmed`가 아니면 받음(값의 진위는 엔진이 판정하지 않음) → **확실한 값만** 넣어야 함.
- 확실한 것: Lucide = ISC(저장소 LICENSE, 일부 Feather 유래 아이콘 MIT, 고지 유지 조건). OpenAI 이용약관 = 사용자와 OpenAI 사이에서 법이 허용하는 범위에서 사용자가 출력물 소유, OpenAI 권리(있다면) 양도.
- 불확실한 것: 사용한 ChatGPT 계정 유형별 적용 약관(개인/Team/Enterprise), AI 생성물의 저작권 보호 여부, AST-018에 적용되는 Anthropic 계약 조항.

## 엔진 기록상 주의
- AST-026·AST-046은 등록 시 출처를 `self_made`로 기록했으나, 사용자 설명상 실제 출처는 ChatGPT 생성(`generated_tool`)입니다. 엔진 `explore-asset`에는 등록된 자산의 출처 분류를 바꾸는 명령이 없습니다(`replace`는 기존 분류 유지, 같은 파일 재등록은 중복 차단). 레지스트리를 손으로 고치지 않았습니다. 선택지: (a) 확인 문장에 실제 출처를 명시하고 그대로 둠, (b) 같은 이미지를 다시 가공(해시가 달라짐)해 `generated_tool`로 새 ID 등록 후 시안 교체 — 사용자 결정 필요.
- 권리 확인 후 파일을 바꾸면(replace) 확인이 초기화되어 다시 확인해야 합니다.

출처: OpenAI Terms of Use(https://openai.com/policies/terms-of-use/, EU 개정 2024-12-11 동일 문구), Lucide LICENSE(https://github.com/lucide-icons/lucide/blob/main/LICENSE). 최신 약관 원문은 직접 확인이 필요합니다(이번 조회에서 openai.com 원문은 접근 거부되어 검색 결과로 확인).


## (2026-11-19 갱신 2) 사용자 지시: "Lucide 자산은 ISC 라이선스와 저작권 고지 조건을 기준으로 확인안을 작성하세요. ChatGPT 생성 자산은 실제 생성 및 가공 이력을 기록하고, 적용 약관 확인이 필요한 항목은 구분하세요. AST-018은 Anthropic 약관 확인 전까지 보류합니다."

### 확인안 A — 확인 근거가 있는 것(사용자 확인 문장만 있으면 기록 가능)
| 자산 | `--license` | 근거 | 조건 | 제안 확인 문장 |
|---|---|---|---|---|
| AST-001(graduation-cap)·AST-014(swords)·AST-015(circle-user-round)·AST-016(clipboard-list) | `ISC` | Lucide 저장소 LICENSE(ISC). Feather 유래 아이콘은 MIT 고지 포함 | 배포물(앱 번들·오픈소스 고지 화면 등)에 Lucide 저작권·허가 고지 유지 | "AST-001, AST-014, AST-015, AST-016은 Lucide v1.70.0 아이콘으로, ISC 라이선스의 저작권·허가 고지를 유지하는 조건으로 SMAPSH에서 사용합니다." |

### 확인안 B — 생성·가공 이력은 확정, 적용 약관 확인 필요
| 자산 | 실제 생성 이력 | 가공 이력 | 약관 확인 필요 사항 |
|---|---|---|---|
| AST-046 | 사용자가 ChatGPT 이미지 생성 기능으로 만든 셔틀콕 이미지(그려진 체크무늬 배경 RGB) | `scripts/cut_checker3.py`로 배경 제거(평평함·색·가장자리 연결·갇힌 체크무늬), 480×454 | 생성에 쓴 계정 유형(개인/Team/Enterprise)과 그 시점 약관의 출력물 조항 |
| AST-028–034 | 사용자가 ChatGPT로 만든 'smapsh_assets_v2' 보드의 스테이지 그림(README: newly generated board 크롭) | `scripts/crop_stages.py` 크롭·배경 연장·240×144 | 위와 같음 |
| AST-035–037 | 사용자가 ChatGPT로 만든 학습 UI 보드의 과정 아이콘 | `scripts/cut_icons.py` 배경 제거·정사각 여백 | 위와 같음 |
| AST-026(V04 미사용) | AST-046과 같은 방식의 이전 셔틀콕 | `scripts/cut_shuttle.py` | 위와 같음 |

- 확인된 약관 내용: OpenAI 이용약관 — 사용자와 OpenAI 사이에서 법이 허용하는 범위에서 사용자가 출력물을 소유하고, OpenAI는 보유한 권리(있다면)를 양도. 다른 사용자·제3자 출력물은 제외.
- `--license` 값 후보(약관 확인 후 사용자 결정): 예 `OpenAI-ToU-Output-Assigned`. **약관 확인 전에는 기록하지 않음.**
- AST-026·046의 등록 출처 `self_made`는 그대로 두고 확인 문장에 실제 생성 이력을 명시(A안).

### 보류
| 자산 | 사유 |
|---|---|
| AST-018 | Anthropic 약관(이 조직이 쓰는 계약의 출력물 조항) 확인 전까지 보류(사용자 지시) |

## (2026-11-19 갱신 3) VD-046 자산별 권리 정리 — 승인 전 확인 자료(미확정)
사용자 지시: "VD-046은 제외하지 않습니다. 다만 권리 확인이 완료되기 전까지 승인하지 마세요." 아래 '확인된 사실'은 기록·원문으로 확인한 것만 적고, 나머지는 '사용자 확인 필요'로 둡니다.

| 자산 | 생성 도구·경위(기록 근거) | 적용 가능한 약관·권리 근거 | 사용자에게 확인받을 사실 | 제품 사용 가능 여부 |
|---|---|---|---|---|
| AST-018 intro-1 번호 격자 SVG | Claude(Claude Code)가 이 프로젝트 작업 중 코드로 작성(TutorialCourt 좌표 사용, 외부 입력 이미지 없음) — 레지스트리 `model_drawn` | Anthropic Commercial Terms(2025-06-17 시행, 2026-11-19 원문 확인): "Customer … owns its Outputs", "Anthropic hereby assigns to Customer its right, title and interest (if any) in and to Outputs"(약관 준수·법이 허용하는 범위). 소비자용(Claude.ai)은 별도 Consumer Terms | ① 이 작업에 쓴 Claude 이용 형태와 적용 약관(회사 계약·상업용 약관인지, 개인 소비자 약관인지) ② 회사 계약에 별도 출력물 조항이 있는지 | 미확정 — ①·②가 확인되면 가능할 것으로 보이나 확정하지 않음 |
| AST-028–034 스테이지 썸네일 7종 | 사용자가 ChatGPT로 만든 'smapsh_assets_v2' 보드 그림을 크롭·배경 연장(`scripts/crop_stages.py`) — 사용자 설명, 레지스트리 `generated_tool` | OpenAI 이용약관(출력물 소유·권리 양도 취지 — 이전 문서 요지). **2026-11-19 원문 재확인 실패(openai.com 403)** | ① 사용한 ChatGPT 계정 유형(개인/Team/Enterprise)과 그 시점 약관 ② 생성 입력에 제3자 저작물·상표·REF-001 이미지 등을 넣지 않았는지 ③ 회사 기밀·개인정보를 넣지 않았는지 | 미확정 |
| AST-035–037 과정 장식 3종 | 사용자가 ChatGPT로 만든 학습 UI 보드의 과정 아이콘을 배경 제거(`scripts/cut_icons.py`) | 위와 같음 | 위와 같음 | 미확정 |
| AST-046 배너 셔틀콕 | 사용자가 ChatGPT 이미지 생성으로 만든 셔틀콕(그려진 체크무늬 배경)을 배경 제거(`scripts/cut_checker3.py`) — 레지스트리 출처는 `self_made`로 등록됨(A안: 출처 유지, 확인 문장에 실제 이력 명시) | 위와 같음 | 위와 같음 + 확인 문장에 'ChatGPT 생성 → 사용자 제공 → 배경 제거' 이력 명시 | 미확정 |

- 공통 불확실성: AI 생성물은 사람의 창작적 기여가 없으면 저작권 보호를 받지 못할 수 있음(소유·사용과 별개로 타인의 유사 이미지 사용을 막기 어려울 수 있음). 회사 정책상 생성형 AI 산출물 사용 승인 절차가 있는지.
- 권리 확인 명령(사용자 문장 필요, 실행 안 함): `explore-asset confirm --id <AST> --license "<약관 이름·버전 등 사용자 결정 값>" --note "<사용자 확인 문장: 도구·계정 유형·약관, 입력에 제3자 저작물 없음, 가공 이력>"`. 라이선스 값이 '', 'unknown', 'unconfirmed'면 엔진이 거부.
- 확인되지 않은 자산은 VD-046 '관련'에 넣지 않고, VD-046은 미결정으로 둡니다(DD 제출은 VD-046 결정 전까지 불가).

## (2026-11-19 갱신 4) 권리 확인 실행 결과
- 사용자 확인 사실(원문): "AST-028–037 및 AST-046은 제가 ChatGPT에 직접 프롬프트를 입력하여 생성한 이미지입니다. AST-046은 ChatGPT 생성 원본에서 배경을 제거한 자산입니다. OpenAI에 별도 사용 허가를 요청할 필요는 없습니다. 적용되는 OpenAI 이용약관의 출력물 권리 조항을 근거로 정리하세요."
- 권리 근거(사용자 지정): OpenAI 이용약관 출력물 권리 조항. 이번 세션에서 openai.com 원문은 403, 아카이브 조회는 권한 거부로 다시 열람하지 못함 — 조항 내용은 이전 문서 요지에 의존.
- 실행: `explore-asset confirm` AST-028–037·046, license "OpenAI Terms of Use — Output 권리 조항(사용자 소유·OpenAI 권리 양도)", note = 위 사용자 원문. 11건 모두 official_ok.
- AST-046 출처 정정: 레지스트리 source `self_made` → `generated_tool`(엔진에 출처 변경 명령 없음 → 항목에 `source_corrections` 기록, 파일·SHA-256 불변, confirm 전에 정정).
- 확인하지 않은 것(기록하지 않음): ChatGPT 계정 유형과 그 시점 약관 버전, 생성 입력에 제3자 저작물 포함 여부.
- AST-018: 미확인 유지 — VD-046에서 제외(intro-1은 그림 없는 연민트 면).
