import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    func,
)
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


class TutorialRun(Base):
    """튜토리얼 한 회차(서버 판정, D-T4 (b) — 사용자 결정 2026-11-20).

    상황별 **첫 판정**만 임시로 둡니다(`first_verdicts`: c=정답·a=허용·w=오답·-=아직,
    상황 순서대로). 고른 칸 번호와 시도별 기록은 저장하지 않습니다(NFR-006 해석,
    사용자 결정 2026-11-20: 점수 조작 방지에 필요한 첫 판정 결과만 회차 유효기간 동안
    임시 보관, 학습 분석·통계에 쓰지 않음). 수명 2시간, 만료 + 1일이 지난 행은
    회차를 시작할 때 지웁니다. 진행 기록은 tutorial_progress에만 남습니다.
    """

    __tablename__ = "tutorial_runs"
    __table_args__ = (
        CheckConstraint(
            "length(first_verdicts) BETWEEN 1 AND 16", name="ck_tutorial_runs_verdicts_len"
        ),
        Index("ix_tutorial_runs_user_stage", "user_id", "stage_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    stage_id: Mapped[str] = mapped_column(String(32))  # 콘텐츠 버전은 ID에 포함(-v1, C-28)
    content_hash: Mapped[str] = mapped_column(String(16))  # 회차 중 콘텐츠 변경 감지
    first_verdicts: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
