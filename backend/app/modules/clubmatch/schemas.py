"""청백전 운영 응답·요청(운영진 전용).

FE `features/clubmatch/api.ts`의 ClubMatchView·ClubMatchListItem 형태.

회원용 응답(점수·실력차·급수 없음)은 I3-d에서 별도 스키마로 둡니다(AC-066).
"""

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.modules.clubmatch.display import ClubMatchResult, DisplayStatus
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


class CancelInfo(BaseModel):
    """(B15, C-37) 취소된 경기: 시각·사유(중도 귀가 'left')."""

    at: dt.datetime
    reason: str | None


class GameView(BaseModel):
    no: int
    # (B15, C-36) 라운드·코트(라운드 정보 없는 기존 청백전은 None)
    round: int | None = None
    court: int | None = None
    cancelled: CancelInfo | None = None
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
    # (B15, C-36·C-37) 라운드 기반이면 코트 수·자동 생성 기준 라운드 수·진행 라운드·실제 라운드 수
    courtCount: int | None = None  # noqa: N815
    plannedRounds: int | None = None  # noqa: N815
    currentRound: int | None = None  # noqa: N815
    roundCount: int = 0  # noqa: N815


class ClubMatchListItem(BaseModel):
    id: str
    name: str
    date: dt.date
    method: Method
    status: Status
    unrecorded: int
    team: dict[str, int] | None
    winnerText: str | None  # noqa: N815
    # (SCR-111 r6, 하위 호환 추가) 통합 목록용: 참가 인원(선정된 참가자), 경기 수,
    # 표시 상태(UXD-087, KST), 구조화한 종료 결과
    participants: int
    games: int
    displayStatus: DisplayStatus  # noqa: N815
    result: ClubMatchResult | None


class Created(BaseModel):
    id: str


NAME_MAX = 30


def _clean_name(value: str) -> str:
    """이름: 앞뒤 공백 제외 1–30자(AC-123). 넘으면 필드 오류(일반 저장 실패가 아님)."""
    value = value.strip()
    if not value:
        raise ValueError("이름을 입력해 주세요")
    if len(value) > NAME_MAX:
        raise ValueError("이름은 30자 이내로 입력해 주세요")
    return value


class ClubMatchCreate(BaseModel):
    method: Method
    date: dt.date
    # (B10) 앞뒤 공백 제외 1–30자. 넘으면 "이름은 30자 이내로 입력해 주세요"(AC-123 필드 오류)
    name: str = Field(max_length=200)
    # (B15, C-36) 사용 코트 수 1–8. 없으면 라운드 정보 없는 기존 방식(D11 호환)
    courtCount: int | None = Field(default=None, ge=1, le=8)  # noqa: N815

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        return _clean_name(value)


class Versioned(BaseModel):
    """동시 조작 감지(C-19·U9): 화면이 본 version."""

    version: int


class MethodUpdate(Versioned):
    method: Method


class SettingsUpdate(Versioned):
    # 라운드 정보 없는 기존 청백전은 totalGames, 라운드 기반은 rounds(C-14 r12)
    totalGames: int | None = Field(default=None, ge=1, le=200)  # noqa: N815
    rounds: int | None = Field(default=None, ge=1, le=200)
    rules: Rules
    # (B10, C-33) 값이 바뀌고 대진이 있으면 폐기 확인이 필요(없으면 409 confirm_required)
    discard: bool = False


class ParticipationUpdate(Versioned):
    participating: bool
    # (B10) 대진이 있을 때 참가자를 바꾸려면 폐기 확인이 필요(불변식: 남은 대진은 현재 입력과 맞음)
    discard: bool = False


class BasicUpdate(Versioned):
    """(B10) 생성 페이지 기본정보 저장(C-32·C-33, AC-123): 이름·날짜·방식.

    이름·날짜만 바뀌면 팀·대진 유지. 방식이 바뀌고 팀 배정·대진이 있으면 discard=true여야 함(C-13).
    """

    name: str
    date: dt.date
    method: Method
    discard: bool = False
    # (B15, C-36) 사용 코트 수(없으면 그대로)
    courtCount: int | None = Field(default=None, ge=1, le=8)  # noqa: N815

    @field_validator("name")
    @classmethod
    def name_rule(cls, value: str) -> str:
        return _clean_name(value)


class ParticipantsReplace(Versioned):
    """(B10) 참가자 일괄 저장(C-32·C-34, AC-125).

    최종 참가자 전체 목록(사람 키), 추가 순서 = 목록 순서.
    """

    keys: list[str] = Field(max_length=500)
    discard: bool = False


class TeamsReplace(Versioned):
    """(B10) 팀 배정 일괄 저장(C-34, AC-127·128·135): 모든 참가자의 청·백."""

    assignments: dict[str, Team]
    discard: bool = False


class GenerateRequest(Versioned):
    """대진 생성·다시 생성.

    (B10) 대진 설정 단계는 총 경기 수·규칙을 함께 보내 한 번에 저장(C-32).
    """

    totalGames: int | None = Field(default=None, ge=1, le=200)  # noqa: N815
    # (B15) 라운드 기반: 자동 생성 기준 라운드 수(범위는 서버가 k로 판정, invalid_round)
    rounds: int | None = Field(default=None, ge=1, le=200)
    rules: Rules | None = None
    # (B13, C-33·C-35) 운영진이 편집한 경기가 있으면 확인 후 다시 생성(아니면 409 confirm_required)
    discard: bool = False


class TeamUpdate(Versioned):
    team: Team | None


class ResultUpdate(Versioned):
    """결과 기록·수정·되돌리기(AC-044·081·085, U2): 이긴 쪽 1·2, 되돌리기는 null."""

    winner: Literal[1, 2] | None


class GameCreate(Versioned):
    """(B13, C-35) 확정 전 완성 경기 추가: 1팀(팀전 청팀) 2명 · 2팀(팀전 백팀) 2명(사람 키)."""

    team1: list[str]
    team2: list[str]
    # (B15) 라운드 기반: 넣을 라운드(기존 라운드 또는 마지막 + 1)
    round: int | None = None


class GameMove(Versioned):
    """(B15, C-36 D6) 확정 전 완성 경기를 다른 기존 라운드로 옮김."""

    round: int


class GameExchange(Versioned):
    """(B13, C-35) 개인전 확정 전 같은 경기 맞교환: out(대상) ↔ in(같은 경기 상대 조)."""

    out: str
    in_: str = Field(alias="in")


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
    # (B15, C-37) 대체할 사람이 없어 운영진이 취소를 확인한 경기 번호
    cancel: list[int] = Field(default_factory=list)
