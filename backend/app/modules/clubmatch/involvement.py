"""게스트 삭제와 청백전 연결(C-26, SCR-212 ST8·ST10·ST11).

FE Mock `guestClubInvolvement`와 같은 규칙.

- 확정된 미종료 청백전에서 미기록 경기에 들어 있음 → 삭제 거부(confirmedMatch)
- 확정 전 청백전 대진에 들어 있음 → 삭제하면 그 대진을 버림(draftLineup)
- 확정 전 청백전 참가자로만 → 삭제하면 참가자에서 뺌(participantOnly)
- 확정·종료 청백전의 참가 기록은 그대로 남고 '삭제된 게스트'로 표시(U5)

잠금 순서: 게스트(FOR UPDATE) → 관련 청백전(FOR UPDATE, id 순). 청백전 쪽 참가 추가는
청백전 → 게스트(FOR SHARE) 순이지만, 그 청백전에는 아직 이 게스트가 없으므로 서로 기다리지 않습니다.
"""

import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGamePlayer,
    ClubMatchParticipant,
)


@dataclass(frozen=True)
class Involvement:
    kind: Literal["none", "confirmedMatch", "draftLineup", "participantOnly"]
    match_id: uuid.UUID | None = None
    match_name: str | None = None
    remaining: int | None = None
    place: str | None = None


def _matches_with_guest(db: Session, guest_id: uuid.UUID, lock: bool) -> list[ClubMatch]:
    query = (
        select(ClubMatch)
        .join(ClubMatchParticipant, ClubMatchParticipant.match_id == ClubMatch.id)
        .where(ClubMatchParticipant.guest_id == guest_id, ClubMatch.status != "finished")
        .order_by(ClubMatch.match_date, ClubMatch.created_at, ClubMatch.id)
    )
    if lock:
        query = query.with_for_update(of=ClubMatch)
    return list(db.scalars(query).all())


def _games_with(db: Session, match_id: uuid.UUID, guest_id: uuid.UUID) -> list[ClubMatchGame]:
    return list(
        db.scalars(
            select(ClubMatchGame)
            .join(ClubMatchGamePlayer, ClubMatchGamePlayer.game_id == ClubMatchGame.id)
            .join(
                ClubMatchParticipant,
                ClubMatchParticipant.id == ClubMatchGamePlayer.participant_id,
            )
            .where(ClubMatchGame.match_id == match_id, ClubMatchParticipant.guest_id == guest_id)
        ).all()
    )


def guest_involvement(db: Session, guest_id: uuid.UUID, lock: bool = False) -> Involvement:
    matches = _matches_with_guest(db, guest_id, lock)
    for m in matches:
        if m.status == "confirmed":
            remaining = sum(1 for g in _games_with(db, m.id, guest_id) if g.winner is None)
            if remaining:
                return Involvement("confirmedMatch", m.id, m.name, remaining=remaining)
    for m in matches:
        if m.status == "draft" and _games_with(db, m.id, guest_id):
            return Involvement("draftLineup", place=m.name)
    for m in matches:
        return Involvement("participantOnly", match_name=m.name)
    return Involvement("none")


def remove_guest_from_drafts(db: Session, guest_id: uuid.UUID) -> None:
    """확정 전 청백전에서 대진 폐기·참가자 제거(삭제와 같은 트랜잭션, 청백전 version 증가)."""
    for m in _matches_with_guest(db, guest_id, lock=True):
        if m.status != "draft":
            continue
        if _games_with(db, m.id, guest_id):
            game_ids = select(ClubMatchGame.id).where(ClubMatchGame.match_id == m.id)
            db.execute(delete(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id.in_(game_ids)))
            db.execute(delete(ClubMatchGame).where(ClubMatchGame.match_id == m.id))
            m.seed = None
        db.execute(
            delete(ClubMatchParticipant).where(
                ClubMatchParticipant.match_id == m.id, ClubMatchParticipant.guest_id == guest_id
            )
        )
        m.version += 1
