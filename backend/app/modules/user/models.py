import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

# 값 목록(FE `features/auth/types.ts`와 같은 값). DB enum 대신 String + CHECK.
ROLES = ("member", "admin", "super_admin")
STATUSES = ("pending", "approved", "rejected", "inactive")
GENDERS = ("남", "여")
GRADES = ("자강조", "A조", "B조", "C조", "D조", "초심", "왕초심", "입문자")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class User(Base):
    """서비스 사용자(회원).

    카카오 계정이 없는 직접 추가 회원도 있으므로 외부 인증 계정 연결은 선택(UserIdentity).
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(_in("role", ROLES), name="ck_users_role"),
        CheckConstraint(_in("status", STATUSES), name="ck_users_status"),
        CheckConstraint(_in("gender", GENDERS), name="ck_users_gender"),
        CheckConstraint(_in("grade", GRADES), name="ck_users_grade"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(30))
    gender: Mapped[str] = mapped_column(String(1))
    grade: Mapped[str] = mapped_column(String(10))
    # 누구의 지인(선택, 운영진만 열람 AC-099)
    referrer: Mapped[str | None] = mapped_column(String(30))
    role: Mapped[str] = mapped_column(String(20), default="member", server_default="member")
    status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # 승인·거절 처리 기록(누가·언제)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    identities: Mapped[list["UserIdentity"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserIdentity(Base):
    """외부 인증 계정 연결(provider='kakao' | 로컬 개발용 'dev').

    공급자 사용자 ID만 저장하고 공급자 토큰은 저장하지 않음.
    """

    __tablename__ = "user_identities"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_user_identities_provider_uid"),
        UniqueConstraint("user_id", "provider", name="uq_user_identities_user_provider"),
        CheckConstraint("provider IN ('kakao', 'dev')", name="ck_user_identities_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(20))
    provider_user_id: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="identities")
