"""청백전 운영 응답·요청(운영진 전용).

FE `features/clubmatch/api.ts`의 ClubMatchView·ClubMatchListItem 형태.

회원용 응답(점수·실력차·급수 없음)은 I3-d에서 별도 스키마로 둡니다(AC-066).
"""

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.modules.user.schemas import Gender, Grade

Method = Literal["individual", "team"]
Status = Literal["draft", "confirmed", "finished"]
Team = Literal["blue", "white"]


class Person(BaseModel):
    key: str
    id: str
    kind: Literal["member", "guest"]
    name: str
    # 삭제된(비식별화된) 게스트는 성별·급수·점수 없음(C안)
    gender: Gender | None
    grade: Grade | None
    score: int | None


class ParticipantRow(Person):
    participating: bool
    team: Team | None
    games: int
    left: bool
    inUnrecorded: int  # noqa: N815
    # 새 참가·교체·대체 대상이 될 수 있음(승인 회원·삭제 안 된 게스트, U6·P-5). 운영진 전용
    available: bool


class TeamCount(BaseModel):
    n: int
    male: int


class Summary(BaseModel):
    count: int
    male: int
    female: int
    blue: TeamCount
    white: TeamCount
    unscored: list[Person]


class Rules(BaseModel):
    balance: bool
    gender: bool


class Relaxation(BaseModel):
    """규칙 완화(U7·C-03): 무엇을 왜 지키지 못했는지.

    reason: exhausted(규칙을 지키는 조합이 없음) · higher_priority(더 높은 우선순위 규칙 때문) ·
    search_limit(지킬 수 있었지만 생성 탐색이 못 찾음 — I3-c 보강 뒤로는 관찰되지 않음) ·
    manual(운영진이 선수를 직접 바꾼 결과 — 성별 등 허용되는 위반만, P-4) ·
    substitute_exhausted(중도 귀가 대체에서 같은 대진을 피할 후보가 없음을 서버가 검증, P-4-b)
    """

    rule: Literal["matchup", "gender"]
    reason: Literal[
        "exhausted", "higher_priority", "search_limit", "manual", "substitute_exhausted"
    ]


class GameView(BaseModel):
    no: int
    team1: list[Person]
    team2: list[Person]
    winner: Literal[1, 2] | None
    gap: int | None
    genderRelaxed: bool  # noqa: N815
    # U7: 앞선 경기와 같은 4명·같은 팀(DB club_match_games.repeated_matchup)
    repeatedMatchup: bool  # noqa: N815
    relaxations: list[Relaxation]
    # 운영진이 선수를 직접 바꾼 경기(확정 전 포함). changed는 확정 후 대진 수정 표시(C-15)
    manual: bool
    changed: bool
    # 종료 후 결과 수정(U10·P-10): 기록 시각 > 종료 시각. 대진 수정(changed)과 따로 안내
    resultChanged: bool  # noqa: N815


class Standing(BaseModel):
    key: str
    name: str
    guest: bool
    wins: int
    games: int
    rank: int
    tied: bool


class ClubMatchView(BaseModel):
    id: str
    name: str
    date: dt.date
    method: Method
    status: Status
    version: int
    totalGames: int  # noqa: N815
    rules: Rules
    teamProposed: bool  # noqa: N815
    # 확정 후 대진 수정 시각(C-15, 교체·중도 귀가)
    modifiedAt: dt.datetime | None  # noqa: N815
    # 종료 후 결과 수정 시각(U10·P-10) = 종료 뒤 고친 경기 중 가장 늦은 기록 시각
    resultModifiedAt: dt.datetime | None  # noqa: N815
    rows: list[ParticipantRow]
    summary: Summary
    preview: dict[str, object]
    games: list[GameView]
    standings: list[Standing]
    team: dict[str, int]
    unrecorded: int


class ClubMatchListItem(BaseModel):
    id: str
    name: str
    date: dt.date
    method: Method
    status: Status
    unrecorded: int
    team: dict[str, int] | None
    winnerText: str | None  # noqa: N815


class Created(BaseModel):
    id: str


class ClubMatchCreate(BaseModel):
    method: Method
    date: dt.date
    name: str = Field(max_length=30)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("이름을 입력해 주세요")
        return value


class Versioned(BaseModel):
    """동시 조작 감지(C-19·U9): 화면이 본 version."""

    version: int


class MethodUpdate(Versioned):
    method: Method


class SettingsUpdate(Versioned):
    totalGames: int = Field(ge=1, le=200)  # noqa: N815
    rules: Rules


class ParticipationUpdate(Versioned):
    participating: bool


class TeamUpdate(Versioned):
    team: Team | None


class ResultUpdate(Versioned):
    """결과 기록·수정·되돌리기(AC-044·081·085, U2): 이긴 쪽 1·2, 되돌리기는 null."""

    winner: Literal[1, 2] | None


class SwapRequest(Versioned):
    """선수 교체(AC-064·077·079): from → to."""

    from_: str = Field(alias="from")
    to: str


class LeaveAssignment(BaseModel):
    gameNo: int  # noqa: N815
    to: str


class LeaveRequest(Versioned):
    """중도 귀가(AC-078): 남은 미기록 경기마다 대체 선수, 제외와 한 번에."""

    assignments: list[LeaveAssignment]
