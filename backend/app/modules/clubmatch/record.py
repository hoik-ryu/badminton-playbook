"""회원 누적 전적·랭크(C-07·C-17, AC-045·046). FE `features/me/rank.ts`와 같은 기준.

- 대상: 확정·종료 청백전(개인전·팀전 모두)의 결과가 기록된 경기. 대체 선수는 실제로 뛴 사람(AC-078)
- 게스트는 랭크 대상 아님(C-09). 저장하지 않고 조회 때 계산(결과가 바뀌면 자동 반영)
- 랭크: 10경기 이상, 승률 S ≥ 70% · A ≥ 55% · B ≥ 40% · C < 40%(정수 비교로 경계 오차 없음)
"""

import uuid
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGamePlayer,
    ClubMatchParticipant,
)

Rank = Literal["S", "A", "B", "C"]
RANK_MIN_GAMES = 10


def club_record(db: Session, user_id: uuid.UUID) -> tuple[int, int]:
    """(승, 패)."""
    rows = db.execute(
        select(ClubMatchGamePlayer.side, ClubMatchGame.winner)
        .join(ClubMatchGame, ClubMatchGame.id == ClubMatchGamePlayer.game_id)
        .join(ClubMatchParticipant, ClubMatchParticipant.id == ClubMatchGamePlayer.participant_id)
        .join(ClubMatch, ClubMatch.id == ClubMatchGame.match_id)
        .where(
            ClubMatchParticipant.user_id == user_id,
            ClubMatchGame.winner.is_not(None),
            ClubMatch.status != "draft",
        )
    ).all()
    wins = sum(1 for side, winner in rows if side == winner)
    return wins, len(rows) - wins


def rank_for(games: int, wins: int) -> tuple[Rank | None, int | None, float | None]:
    """(랭크, 랭크까지 남은 경기 수, 승률)."""
    rate = wins / games if games else None
    if games < RANK_MIN_GAMES:
        return None, RANK_MIN_GAMES - games, rate
    pct = wins * 100
    rank: Rank = (
        "S"
        if pct >= 70 * games
        else "A"
        if pct >= 55 * games
        else "B"
        if pct >= 40 * games
        else "C"
    )
    return rank, None, rate
