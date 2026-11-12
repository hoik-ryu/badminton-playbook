"""회원용 청백전 응답(SCR-111·112·121, AC-017·066·068·069) — 운영진 스키마와 분리된 허용 목록.

운영진 `ClubMatchView`를 만든 뒤 필드를 지우는 방식을 쓰지 않습니다(필드가 늘면 새어 나감).
여기 정의한 필드만 응답에 나갑니다. 넣지 않는 것: 1–10 점수, 급수, 성별, 실력차, 팀 점수 합,
규칙 완화(사유·genderRelaxed·repeatedMatchup·manual), version, 규칙, 시드, 설정, 참가자 전체 목록,
내부 회원·게스트 UUID, 다른 회원의 랭크, 기록자.

사람 키(S-1): `p:<청백전 참가자 행 id>` — 그 청백전 안에서만 유효(같은 사람도 청백전마다 다름).
"""

import datetime as dt
from typing import Literal

from pydantic import BaseModel

Method = Literal["individual", "team"]
PublicStatus = Literal["confirmed", "finished"]


class MemberPlayer(BaseModel):
    key: str
    name: str
    guest: bool
    me: bool


class MemberGame(BaseModel):
    no: int
    team1: list[MemberPlayer]
    team2: list[MemberPlayer]
    winner: Literal[1, 2] | None
    # 확정 후 대진 수정(교체·중도 귀가, C-15·AC-088)
    changed: bool
    # 종료 후 결과 수정(U10·P-10)
    resultChanged: bool  # noqa: N815
    mySide: Literal[1, 2] | None  # noqa: N815


class MemberStanding(BaseModel):
    key: str
    name: str
    guest: bool
    me: bool
    wins: int
    games: int
    rank: int
    tied: bool


class TeamWins(BaseModel):
    blue: int
    white: int


class PublicClubMatch(BaseModel):
    id: str
    name: str
    date: dt.date
    method: Method
    status: PublicStatus
    modifiedAt: dt.datetime | None  # noqa: N815
    resultModifiedAt: dt.datetime | None  # noqa: N815
    games: list[MemberGame]
    standings: list[MemberStanding]
    team: TeamWins
    unrecorded: int
    participating: bool


class PublicClubMatchItem(BaseModel):
    id: str
    name: str
    date: dt.date
    method: Method
    status: PublicStatus
    team: TeamWins | None
    games: int
    participants: int
    unrecorded: int
    resultText: str | None  # noqa: N815


class MyRecord(BaseModel):
    """본인 누적 전적·랭크(C-07·C-17, AC-045·046·053). 본인 것만."""

    rank: Literal["S", "A", "B", "C"] | None
    gamesToRank: int | None  # noqa: N815
    games: int
    wins: int
    losses: int
    rate: float | None
