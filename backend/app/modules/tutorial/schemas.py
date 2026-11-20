"""튜토리얼 응답 스키마.

공개 콘텐츠(`StageRead` 등)에는 판정 전에 화면에 필요한 것만 넣습니다.
정답·허용 칸, 떨어지는 지점·도착 칸, 파트너 목표, 칸별 이동 목표점, 해설은 넣지 않습니다
(서버 판정, 사용자 결정 2026-11-19 D-T2 — 판정 응답(3단계)에서만 공개).
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CoursePassCount(BaseModel):
    """운영진 회원 현황의 과정별 통과 수(AC-100 r7: 입문자 n/2, 왕초급 n/3, 초급 n/3)."""

    course: str
    name: str
    passed: int
    total: int


class GridRead(BaseModel):
    """코트 분할(C-27): 내 편 반 코트를 열 × 행으로 균등 분할(ASM-035), 번호는 왼→오, 위→아래."""

    id: str
    cols: int
    rows: int


class PassRule(BaseModel):
    """통과 기준(C-22): 상황 수 × numerator/denominator 이상."""

    numerator: int
    denominator: int


class CourseStageRead(BaseModel):
    id: str
    no: int
    version: int
    title: str
    minutes: int
    thumbnail: str | None
    situations: int


class CourseRead(BaseModel):
    id: str
    name: str
    order: int
    grid: GridRead
    released: bool
    guided: bool
    description: str | None  # 과정 카드 설명
    icon: str | None  # 과정 장식 자산 ID(AST-…)
    stages: list[CourseStageRead]  # 미출시 과정은 빈 목록('준비 중', AC-093)


class CoursesRead(BaseModel):
    courses: list[CourseRead]
    passRule: PassRule  # noqa: N815


class StartRead(BaseModel):
    me: list[float]
    partner: list[float]
    opponents: list[list[float]]


class ShuttleRead(BaseModel):
    """재생 연출용: 상대가 치는 지점과 선택 대기 중 멈추는 지점만. 떨어지는 지점은 판정 뒤 공개."""

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    from_: list[float] = Field(alias="from")
    stop: list[float]


class SituationRead(BaseModel):
    no: int
    description: str
    question: str
    start: StartRead
    shuttle: ShuttleRead | None


class StageRead(BaseModel):
    id: str
    course: str
    courseName: str  # noqa: N815
    no: int
    version: int
    title: str
    minutes: int
    thumbnail: str | None
    guided: bool
    grid: GridRead
    passRule: PassRule  # noqa: N815
    situations: list[SituationRead]


# ── 서버 판정 회차(3단계, D-T4 (b)) ──

Verdict = Literal["correct", "allow", "wrong"]


class RunStartRead(BaseModel):
    runId: uuid.UUID  # noqa: N815
    stageId: str  # noqa: N815
    situations: int
    expiresAt: datetime  # noqa: N815


class JudgeBody(BaseModel):
    """판정 요청: 상황 번호(1..n)와 고른 칸 번호. 고른 칸은 저장하지 않음(NFR-006)."""

    model_config = ConfigDict(extra="forbid")
    situation: int
    cell: int


class MoveRead(BaseModel):
    """그 칸을 골랐을 때의 이동: 내 이동 목표점(칸별 목표점 또는 칸 중심)과 파트너 목표."""

    cell: int
    me: list[float]
    partnerCell: int  # noqa: N815
    partner: list[float]


class JudgeRead(BaseModel):
    """판정 결과(판정 뒤에만 정답 데이터 공개). 같은 요청을 다시 보내도 같은 응답."""

    situation: int
    verdict: Verdict  # 이번 선택의 판정
    firstVerdict: Verdict  # noqa: N815 — 점수에 반영되는 첫 판정
    points: int  # 이 상황의 점수(첫 판정이 정답이면 1, 아니면 0 — 재도전 정답도 0)
    answer: int
    allow: list[int]
    landing: list[float] | None
    landingCell: int | None  # noqa: N815
    move: MoveRead
    correctMove: MoveRead  # noqa: N815 — '올바른 움직임 보기'
    reason: str  # 이번 판정의 해설(정답 이유·더 좋은 위치·오답 이유)
    correctReason: str  # noqa: N815
    judged: int  # 지금까지 첫 판정이 끝난 상황 수


class CompleteBody(BaseModel):
    """결과 저장 요청(기존 PUT /stages/{id}). 옛 {score, total}은 받지 않음(422)."""

    model_config = ConfigDict(extra="forbid")
    runId: uuid.UUID  # noqa: N815


class WrongRead(BaseModel):
    no: int
    kind: Literal["allow", "wrong"]


class RunResultRead(BaseModel):
    score: int
    total: int
    passed: bool
    wrong: list[WrongRead]  # SCR-103 틀린 상황(첫 판정 기준)


class StageSaveRead(BaseModel):
    """저장 후 진행 기록(기존 응답 키 그대로) + 이번 회차 결과."""

    passed: bool
    best: int
    firstPassedAt: datetime | None  # noqa: N815
    run: RunResultRead


class ReviewSituationRead(BaseModel):
    """완료된 본인 회차의 틀린(허용·오답) 상황 다시 보기 — 판정 때 이미 공개한 정답 데이터만."""

    no: int
    kind: Literal["allow", "wrong"]
    description: str
    start: StartRead
    shuttle: ShuttleRead | None
    answer: int
    allow: list[int]
    landing: list[float] | None
    landingCell: int | None  # noqa: N815
    correctMove: MoveRead  # noqa: N815
    correctReason: str  # noqa: N815


class RunReviewRead(BaseModel):
    """완료된 본인 회차 조회(SCR-103 복구·틀린 상황 다시 보기). 읽기만 — 진행 기록을 안 바꿈."""

    runId: uuid.UUID  # noqa: N815
    stageId: str  # noqa: N815
    run: RunResultRead
    review: list[ReviewSituationRead]  # 틀린 상황만(첫 판정 기준)
