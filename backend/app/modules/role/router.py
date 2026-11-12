"""역할 관리(SCR-232, FLOW-002, AC-008·009). 슈퍼 관리자만.

슈퍼 관리자 역할 자체는 API로 바꾸지 않음(CLI 전용).
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.errors import AppError
from app.modules.auth.deps import DbSession, SuperAdminUser, verify_origin
from app.modules.user.models import User
from app.modules.user.schemas import ROLE_TO_API, ApiRole

router = APIRouter(prefix="/api/roles", tags=["role"], dependencies=[Depends(verify_origin)])


class RoleMemberRead(BaseModel):
    id: str
    name: str
    role: ApiRole


class RoleUpdate(BaseModel):
    role: Literal["admin", "member"]


@router.get("")
def list_role_members(_: SuperAdminUser, db: DbSession) -> list[RoleMemberRead]:
    users = db.scalars(select(User).where(User.status == "approved").order_by(User.name)).all()
    return [RoleMemberRead(id=str(u.id), name=u.name, role=ROLE_TO_API[u.role]) for u in users]


@router.put("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def set_role(user_id: uuid.UUID, body: RoleUpdate, _: SuperAdminUser, db: DbSession) -> None:
    user = db.scalars(select(User).where(User.id == user_id).with_for_update()).first()
    if user is None or user.status != "approved" or user.role == "super_admin":
        raise AppError("role_change_not_allowed", "역할을 바꿀 수 없습니다", 409)
    if user.role == body.role:
        raise AppError("already_processed", "이미 처리된 요청입니다", 409)
    user.role = body.role
    db.commit()
