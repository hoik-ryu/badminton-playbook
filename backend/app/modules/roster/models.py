import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.modules.user.models import GENDERS, GRADES

SCORE_CHECK = "score BETWEEN 1 AND 10"


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


class MemberRating(Base):
    """운영진 평가(1–10 점수, FR-004·006·C-21). 회원 기본 프로필(users)과 분리.

    회원 권한 API는 이 테이블을 읽지 않음(AC-017·066). 점수 미설정 = 행 없음.
    """

    __tablename__ = "member_ratings"
    __table_args__ = (CheckConstraint(SCORE_CHECK, name="ck_member_ratings_score"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    score: Mapped[int] = mapped_column(SmallInteger)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class Guest(Base):
    """게스트(카카오 계정·가입 기록 없음).

    삭제는 소프트 삭제(deleted_at) + 비식별화: 이름·급수·성별·점수를 지움
    (AC-013 급수 삭제 + 이름·성별·점수까지 확장, 사용자 결정 U5·C안).
    행과 참조(청백전 참가·경기 기록)는 남아 지난 기록은 '삭제된 게스트'로 표시(ASM-019).
    """

    __tablename__ = "guests"
    __table_args__ = (
        CheckConstraint(f"gender IS NULL OR {_in('gender', GENDERS)}", name="ck_guests_gender"),
        CheckConstraint(f"grade IS NULL OR {_in('grade', GRADES)}", name="ck_guests_grade"),
        CheckConstraint(f"score IS NULL OR ({SCORE_CHECK})", name="ck_guests_score"),
        # 삭제 전에는 이름·급수·성별 필수, 삭제 후에는 이름·급수·성별·점수 모두 비어 있음(DB가 보장)
        CheckConstraint(
            "(deleted_at IS NULL AND name IS NOT NULL AND grade IS NOT NULL"
            " AND gender IS NOT NULL)"
            " OR (deleted_at IS NOT NULL AND name IS NULL AND grade IS NULL"
            " AND gender IS NULL AND score IS NULL)",
            name="ck_guests_deleted_anonymized",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str | None] = mapped_column(String(30))
    gender: Mapped[str | None] = mapped_column(String(1))
    grade: Mapped[str | None] = mapped_column(String(10))
    score: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
