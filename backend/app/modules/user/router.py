"""본인 프로필(SCR-121·122, US-019, AC-053·054·098, C-21). 승인된 본인만.

응답에는 이름·성별·급수만 있습니다(1–10 점수·지인·튜토리얼 권장 여부 없음, AC-017·066).
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.modules.auth.deps import ApprovedUser, DbSession, verify_origin
from app.modules.user.models import User
from app.modules.user.schemas import Gender, Grade

router = APIRouter(prefix="/api/me", tags=["user"], dependencies=[Depends(verify_origin)])


class ProfileRead(BaseModel):
    name: str
    gender: Gender
    grade: Grade

    @classmethod
    def of(cls, user: User) -> "ProfileRead":
        return cls(name=user.name, gender=user.gender, grade=user.grade)


class ProfileUpdate(BaseModel):
    name: str = Field(max_length=30)
    gender: Gender
    grade: Grade

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("이름을 입력해 주세요")
        return value


@router.get("/profile")
def get_profile(user: ApprovedUser) -> ProfileRead:
    return ProfileRead.of(user)


@router.put("/profile")
def update_profile(body: ProfileUpdate, db: DbSession, user: ApprovedUser) -> ProfileRead:
    """이름·성별·급수 저장(AC-054). 운영진 명단(같은 users 행)에도 그대로 반영."""
    user.name, user.gender, user.grade = body.name, body.gender, body.grade
    db.commit()
    return ProfileRead.of(user)
