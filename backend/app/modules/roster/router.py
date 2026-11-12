"""명단·게스트·점수(SCR-211–214, FR-004–006, AC-010·012·013·015·016·098·099·100). 운영진 이상만.

- 회원 기본 프로필은 users, 운영진 평가 점수는 member_ratings(분리).
  회원 권한 API는 점수를 읽지 않음
- 게스트는 소프트 삭제(D2). 지난 기록 보존
- 동시 수정: 응답의 version(내용 기반 토큰)을 저장 요청에 돌려받아,
  그사이 누가 바꿨으면 409 conflict.
  대상 행은 SELECT … FOR UPDATE로 잠근 뒤 비교·저장(PostgreSQL에서 동시 요청도 한 번에 하나)
"""

import hashlib
import json
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.deps import AdminUser, DbSession, now_utc, verify_origin
from app.modules.clubmatch.involvement import guest_involvement, remove_guest_from_drafts
from app.modules.clubmatch.record import club_record, rank_for
from app.modules.roster.models import Guest, MemberRating
from app.modules.roster.schemas import (
    GuestDeleteInfo,
    MemberCreate,
    MemberStatus,
    PersonInput,
    PersonUpdate,
    Roster,
    RosterPerson,
    ScoreUpdate,
)
from app.modules.tutorial.router import passed_counts
from app.modules.user.models import User

router = APIRouter(prefix="/api/roster", tags=["roster"], dependencies=[Depends(verify_origin)])

INVALID_SCORE = "invalid_score"
CONFLICT = "conflict"
NOT_FOUND = "not_found"


def check_score(score: int | None) -> None:
    """1–10 정수만(AC-016). 미설정은 None."""
    if score is not None and not 1 <= score <= 10:
        raise AppError(INVALID_SCORE, "점수는 1–10 중에서 골라 주세요", 422)


def version_of(*parts: object) -> str:
    raw = json.dumps(parts, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def member_version(user: User, score: int | None) -> str:
    return version_of("m", user.name, user.gender, user.grade, user.referrer, score)


def guest_version(guest: Guest) -> str:
    return version_of("g", guest.name, guest.gender, guest.grade, guest.score)


def member_row(user: User, score: int | None) -> RosterPerson:
    return RosterPerson(
        id=str(user.id),
        kind="member",
        name=user.name,
        gender=user.gender,
        grade=user.grade,
        score=score,
        version=member_version(user, score),
    )


def guest_row(guest: Guest) -> RosterPerson:
    # 삭제된(비식별화된) 게스트는 명단에 나오지 않음
    assert guest.name is not None and guest.grade is not None and guest.gender is not None
    return RosterPerson(
        id=str(guest.id),
        kind="guest",
        name=guest.name,
        gender=guest.gender,
        grade=guest.grade,
        score=guest.score,
        version=guest_version(guest),
    )


def _rating(db: Session, user_id: uuid.UUID, lock: bool = False) -> MemberRating | None:
    query = select(MemberRating).where(MemberRating.user_id == user_id)
    return db.scalars(query.with_for_update() if lock else query).first()


def _member(db: Session, user_id: uuid.UUID, lock: bool = False) -> User:
    query = select(User).where(User.id == user_id, User.status == "approved")
    user = db.scalars(query.with_for_update() if lock else query).first()
    if user is None:
        raise AppError(NOT_FOUND, "회원을 찾을 수 없습니다", 404)
    return user


def _guest(db: Session, guest_id: uuid.UUID, lock: bool = False) -> Guest:
    query = select(Guest).where(Guest.id == guest_id, Guest.deleted_at.is_(None))
    guest = db.scalars(query.with_for_update() if lock else query).first()
    if guest is None:
        raise AppError(NOT_FOUND, "이미 삭제되었거나 찾을 수 없습니다", 404)
    return guest


def _conflict() -> AppError:
    return AppError(CONFLICT, "다른 사람이 먼저 수정했습니다. 최신 내용을 확인해 주세요", 409)


def _set_rating(db: Session, user_id: uuid.UUID, score: int | None, actor: User) -> None:
    rating = _rating(db, user_id, lock=True)
    if score is None:
        if rating is not None:
            db.delete(rating)
    elif rating is None:
        db.add(MemberRating(user_id=user_id, score=score, updated_by_id=actor.id))
    else:
        rating.score = score
        rating.updated_by_id = actor.id


# ── 조회 ──


@router.get("")
def list_roster(_: AdminUser, db: DbSession) -> Roster:
    """승인 회원(이름순, 직접 추가 회원 포함) + 게스트(삭제 제외, 이름순).

    비활성 회원은 US-020(후순위).
    """
    members = db.execute(
        select(User, MemberRating.score)
        .outerjoin(MemberRating, MemberRating.user_id == User.id)
        .where(User.status == "approved")
        .order_by(User.name, User.id)
    ).all()
    guests = db.scalars(
        select(Guest).where(Guest.deleted_at.is_(None)).order_by(Guest.name, Guest.id)
    ).all()
    return Roster(
        members=[member_row(u, score) for u, score in members],
        guests=[guest_row(g) for g in guests],
    )


@router.get("/members/{user_id}/status")
def member_status(user_id: uuid.UUID, _: AdminUser, db: DbSession) -> MemberStatus:
    """지인·권장 대상(C-23)·튜토리얼 통과 수(I2)·랭크·전적(I3-d, 확정·종료 청백전 기록)."""
    user = _member(db, user_id)
    rating = _rating(db, user.id)
    score = rating.score if rating else None
    wins, losses = club_record(db, user.id)
    rank, to_rank, _rate = rank_for(wins + losses, wins)
    return MemberStatus(
        referrer=user.referrer,
        rank=rank,
        gamesToRank=to_rank,
        record={"games": wins + losses, "wins": wins, "losses": losses},
        tutorial={**passed_counts(db, user.id), "total": 3},
        recommended=score is None or score <= 3,
    )


@router.get("/guests/{guest_id}/delete-info", response_model_exclude_none=True)
def guest_delete_info(guest_id: uuid.UUID, _: AdminUser, db: DbSession) -> GuestDeleteInfo:
    """삭제 분기(C-26). 청백전은 DB 기준(I3-a).

    실시간 대진(inRound)은 세션 DB 이관(I4) 전까지 판정하지 않습니다.
    """
    _guest(db, guest_id)
    inv = guest_involvement(db, guest_id)
    return GuestDeleteInfo(
        kind=inv.kind,
        matchId=str(inv.match_id) if inv.match_id else None,
        matchName=inv.match_name,
        remaining=inv.remaining,
        place=inv.place,
    )


# ── 수정(동시 수정 감지) ──


@router.put("/members/{user_id}")
def update_member(
    user_id: uuid.UUID, body: PersonUpdate, actor: AdminUser, db: DbSession
) -> RosterPerson:
    """이름·성별·급수(회원 프로필) + 점수(운영진 평가). 회원 본인 프로필 수정과도 충돌 감지."""
    check_score(body.score)
    user = _member(db, user_id, lock=True)
    rating = _rating(db, user.id)
    if member_version(user, rating.score if rating else None) != body.version:
        db.rollback()
        raise _conflict()
    user.name, user.gender, user.grade = body.name, body.gender, body.grade
    _set_rating(db, user.id, body.score, actor)
    db.commit()
    return member_row(user, body.score)


@router.put("/guests/{guest_id}")
def update_guest(
    guest_id: uuid.UUID, body: PersonUpdate, _: AdminUser, db: DbSession
) -> RosterPerson:
    check_score(body.score)
    guest = _guest(db, guest_id, lock=True)
    if guest_version(guest) != body.version:
        db.rollback()
        raise _conflict()
    guest.name, guest.gender, guest.grade, guest.score = (
        body.name,
        body.gender,
        body.grade,
        body.score,
    )
    db.commit()
    return guest_row(guest)


@router.put("/members/{user_id}/score")
def set_member_score(
    user_id: uuid.UUID, body: ScoreUpdate, actor: AdminUser, db: DbSession
) -> RosterPerson:
    """점수만(SCR-214). 화면이 본 이전 점수와 지금 점수가 다르면 409."""
    check_score(body.score)
    user = _member(db, user_id, lock=True)
    rating = _rating(db, user.id, lock=True)
    if (rating.score if rating else None) != body.previous:
        db.rollback()
        raise _conflict()
    _set_rating(db, user.id, body.score, actor)
    db.commit()
    return member_row(user, body.score)


@router.put("/guests/{guest_id}/score")
def set_guest_score(
    guest_id: uuid.UUID, body: ScoreUpdate, _: AdminUser, db: DbSession
) -> RosterPerson:
    check_score(body.score)
    guest = _guest(db, guest_id, lock=True)
    if guest.score != body.previous:
        db.rollback()
        raise _conflict()
    guest.score = body.score
    db.commit()
    return guest_row(guest)


# ── 추가·삭제 ──


@router.post("/guests", status_code=status.HTTP_201_CREATED)
def add_guest(body: PersonInput, actor: AdminUser, db: DbSession) -> RosterPerson:
    """게스트 등록(AC-012). 급수 필수(AC-099)."""
    check_score(body.score)
    guest = Guest(
        name=body.name,
        gender=body.gender,
        grade=body.grade,
        score=body.score,
        created_by_id=actor.id,
    )
    db.add(guest)
    db.commit()
    return guest_row(guest)


@router.post("/members", status_code=status.HTTP_201_CREATED)
def add_member(body: MemberCreate, actor: AdminUser, db: DbSession) -> RosterPerson:
    """회원 직접 추가(AC-010): 카카오 계정 없이 승인된 회원. 외부 인증 연결 없음."""
    check_score(body.score)
    user = User(
        name=body.name,
        gender=body.gender,
        grade=body.grade,
        referrer=body.referrer,
        role="member",
        status="approved",
        decided_at=now_utc(),
        decided_by_id=actor.id,
    )
    db.add(user)
    db.flush()
    _set_rating(db, user.id, body.score, actor)
    db.commit()
    return member_row(user, body.score)


@router.delete("/guests/{guest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guest(guest_id: uuid.UUID, actor: AdminUser, db: DbSession) -> None:
    """소프트 삭제 + 비식별화(AC-013, D2, U5).

    확정 청백전 미기록 경기에 있으면 거부(AC-014·105, C-26). 확정 전 청백전 대진·참가자는 함께 정리.
    진행 중 라운드(inRound) 판정은 세션 DB 이관(I4)에서 연결.
    """
    guest = _guest(db, guest_id, lock=True)
    if guest_involvement(db, guest_id, lock=True).kind == "confirmedMatch":
        db.rollback()
        raise AppError("guest_delete_blocked", "삭제할 수 없는 상태입니다", 409)
    remove_guest_from_drafts(db, guest_id)
    guest.deleted_at = now_utc()
    guest.deleted_by_id = actor.id
    # 비식별화(AC-013 + U5 + C안): 이름·급수·성별·점수 삭제. 행·id·참가·경기 결과는 유지
    guest.name = None
    guest.grade = None
    guest.gender = None
    guest.score = None
    db.commit()
