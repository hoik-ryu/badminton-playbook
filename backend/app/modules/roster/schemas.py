"""명단 응답·요청(운영진 전용). FE `features/roster/api.ts`의 형태 그대로."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.modules.user.schemas import Gender, Grade

PersonKind = Literal["member", "guest"]


class RosterPerson(BaseModel):
    id: str
    kind: PersonKind
    name: str
    gender: Gender
    grade: Grade
    score: int | None
    # D3 보류: '튜토리얼 권장 · 미통과'의 미통과 기준이 정해지지 않아 항상 false(임의 정책 금지)
    tutorialRecommendedUnpassed: bool = False  # noqa: N815
    # 동시 수정 감지용 토큰(내용 기반). 저장 요청에 그대로 돌려보냄
    version: str


class Roster(BaseModel):
    members: list[RosterPerson]
    guests: list[RosterPerson]


class MemberStatus(BaseModel):
    """SCR-212 회원 현황(CMP-045 ops). 랭크·전적은 I3, 튜토리얼 통과 수는 I2에서 연결."""

    referrer: str | None
    rank: Literal["S", "A", "B", "C"] | None
    gamesToRank: int | None  # noqa: N815
    record: dict[str, int]
    tutorial: dict[str, int]
    recommended: bool


class GuestDeleteInfo(BaseModel):
    """게스트 삭제 분기(C-26). 청백전은 I3-a부터 DB 기준, 실시간 대진(inRound)은 I4에서."""

    kind: Literal["none", "inRound", "confirmedMatch", "draftLineup", "participantOnly"]
    # FE GuestInvolvement와 같은 이름(해당 분기에서만 값)
    matchId: str | None = None  # noqa: N815
    matchName: str | None = None  # noqa: N815
    remaining: int | None = None
    place: str | None = None


def _clean_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("이름을 입력해 주세요")
    return value


class PersonInput(BaseModel):
    name: str = Field(max_length=30)
    gender: Gender
    grade: Grade
    # 점수 범위는 라우터에서 검사해 'invalid_score'로 응답(FE 오류 코드, AC-016)
    score: int | None = None

    _name = field_validator("name")(_clean_name)


class PersonUpdate(PersonInput):
    version: str = Field(min_length=1, max_length=64)


class MemberCreate(PersonInput):
    referrer: str | None = Field(default=None, max_length=30)

    @field_validator("referrer")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class ScoreUpdate(BaseModel):
    score: int
    # 점수만 연달아 입력(SCR-214): 화면이 알고 있던 이전 점수. 그사이 바뀌었으면 409 conflict
    previous: int | None
