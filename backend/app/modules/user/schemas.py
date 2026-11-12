from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.modules.user.models import User

Gender = Literal["남", "여"]
Grade = Literal["자강조", "A조", "B조", "C조", "D조", "초심", "왕초심", "입문자"]
ApiRole = Literal["member", "admin", "superAdmin"]
ApiStatus = Literal["pending", "approved", "rejected", "inactive"]

# DB 값 ↔ API 값(FE `features/auth/types.ts`)
ROLE_TO_API: dict[str, ApiRole] = {
    "member": "member",
    "admin": "admin",
    "super_admin": "superAdmin",
}


class MeRead(BaseModel):
    id: str
    name: str
    role: ApiRole
    status: ApiStatus

    @classmethod
    def of(cls, user: User) -> "MeRead":
        return cls(
            id=str(user.id),
            name=user.name,
            role=ROLE_TO_API[user.role],
            status=user.status,
        )


class SignupCreate(BaseModel):
    """SCR-002 가입 신청. 이름 최대 길이는 백엔드 스키마가 정함(F13): 30자."""

    name: str = Field(max_length=30)
    gender: Gender
    grade: Grade
    referrer: str | None = Field(default=None, max_length=30)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("이름을 입력해 주세요")
        return value

    @field_validator("referrer")
    @classmethod
    def referrer_blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None
