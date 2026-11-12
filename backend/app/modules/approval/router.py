"""가입 승인(SCR-231, FLOW-001-S2·S3, AC-006·007, UXD-012·014). 운영진 이상만."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.deps import AdminUser, DbSession, now_utc, verify_origin
from app.modules.user.models import User
from app.modules.user.schemas import Gender, Grade

router = APIRouter(
    prefix="/api/approvals", tags=["approval"], dependencies=[Depends(verify_origin)]
)

ALREADY_PROCESSED = "already_processed"


class ApplicantRead(BaseModel):
    id: str
    name: str
    gender: Gender
    grade: Grade
    referrer: str | None
    appliedAt: datetime  # noqa: N815 — FE 응답 형태(camelCase) 그대로
    duplicateName: bool  # noqa: N815


class CountRead(BaseModel):
    count: int


class BulkApprove(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=200)


class BulkApproved(BaseModel):
    approved: int


@router.get("/count")
def pending_count(_: AdminUser, db: DbSession) -> CountRead:
    n = db.scalar(select(func.count()).select_from(User).where(User.status == "pending"))
    return CountRead(count=n or 0)


@router.get("")
def list_applicants(_: AdminUser, db: DbSession) -> list[ApplicantRead]:
    """승인 대기 신청자(신청 순서). 같은 이름·성별 회원이 명단에 있으면 표시(UXD-014)."""
    pending = db.scalars(
        select(User).where(User.status == "pending").order_by(User.created_at, User.id)
    ).all()
    roster = {
        (name, gender)
        for name, gender in db.execute(
            select(User.name, User.gender).where(User.status.in_(("approved", "inactive")))
        ).all()
    }
    return [
        ApplicantRead(
            id=str(u.id),
            name=u.name,
            gender=u.gender,
            grade=u.grade,
            referrer=u.referrer,
            appliedAt=u.created_at,
            duplicateName=(u.name, u.gender) in roster,
        )
        for u in pending
    ]


def _decide(db: Session, ids: list[uuid.UUID], decision: str, actor: User) -> int:
    """모두 승인 대기일 때만 한 번에 처리.

    일부라도 이미 처리됐으면 아무것도 바꾸지 않음(SCR-231-ST4).
    """
    unique = list(dict.fromkeys(ids))
    targets = db.scalars(select(User).where(User.id.in_(unique)).with_for_update()).all()
    if len(targets) != len(unique) or any(u.status != "pending" for u in targets):
        db.rollback()
        raise AppError(ALREADY_PROCESSED, "이미 처리된 신청입니다", 409)
    at = now_utc()
    for u in targets:
        u.status = decision
        u.decided_at = at
        u.decided_by_id = actor.id
    db.commit()
    return len(targets)


@router.post("/approve")
def approve_many(body: BulkApprove, actor: AdminUser, db: DbSession) -> BulkApproved:
    """선택 일괄 승인(확인 창 없음, UXD-012)."""
    return BulkApproved(approved=_decide(db, body.ids, "approved", actor))


@router.post("/{user_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve(user_id: uuid.UUID, actor: AdminUser, db: DbSession) -> None:
    _decide(db, [user_id], "approved", actor)


@router.post("/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject(user_id: uuid.UUID, actor: AdminUser, db: DbSession) -> None:
    _decide(db, [user_id], "rejected", actor)
