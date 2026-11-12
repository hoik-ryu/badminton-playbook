import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class TutorialProgress(Base):
    """회원 × 스테이지 진행 기록(C-23, AC-094).

    저장 항목은 통과 여부·최고 점수·최초 통과 시각 3개뿐.

    상황별 선택·시도 기록은 두지 않음(NFR-006). 한 행을 원자적으로 갱신(멱등).
    """

    __tablename__ = "tutorial_progress"
    __table_args__ = (CheckConstraint("best >= 0", name="ck_tutorial_progress_best"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    stage_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    best: Mapped[int] = mapped_column(SmallInteger, default=0)
    first_passed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
