"""청백전(SCR-221–226, C-13–C-20).

사람은 회원(users) 또는 게스트(guests)를 참조하고 물리 삭제하지 않음.

- 회원은 비활성 처리, 게스트는 소프트 삭제 + 비식별화 → 지난 경기·결과는 그대로 남음(U5·U6)
- 참가자 → 사람 FK는 RESTRICT(기록 있는 사람의 물리 삭제 방지), 경기 선수 → 참가자도 RESTRICT
- 전적·순위·팀 승수는 저장하지 않고 경기 결과에서 계산(결과가 바뀌면 자동으로 다시 계산)
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ClubMatch(Base):
    __tablename__ = "club_matches"
    __table_args__ = (
        CheckConstraint("method IN ('individual', 'team')", name="ck_club_matches_method"),
        CheckConstraint(
            "status IN ('draft', 'confirmed', 'finished')", name="ck_club_matches_status"
        ),
        CheckConstraint("total_games BETWEEN 1 AND 200", name="ck_club_matches_total_games"),
        CheckConstraint("version >= 1", name="ck_club_matches_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(30))
    match_date: Mapped[date] = mapped_column(Date)
    method: Mapped[str] = mapped_column(String(12))
    status: Mapped[str] = mapped_column(String(12), default="draft", server_default="draft")
    total_games: Mapped[int] = mapped_column(SmallInteger, default=8, server_default="8")
    rule_balance: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    rule_gender: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # 대진 생성 시드(같은 입력이면 같은 대진, AC-076). 대진이 없으면 NULL
    seed: Mapped[int | None] = mapped_column(BigInteger)
    team_proposed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # 확정 후 대진 수정 시각(교체·중도 귀가, 회원 화면 "대진이 수정되었습니다", C-15).
    # 종료 후 결과 수정은 club_match_games.recorded_at > finished_at으로 따로 계산(U10·P-10)
    modified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # 동시 조작 감지(C-19·U9): 모든 변경에서 1씩 증가
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ClubMatchParticipant(Base):
    __tablename__ = "club_match_participants"
    __table_args__ = (
        CheckConstraint(
            "(user_id IS NOT NULL AND guest_id IS NULL)"
            " OR (user_id IS NULL AND guest_id IS NOT NULL)",
            name="ck_club_match_participants_person",
        ),
        CheckConstraint(
            "team IS NULL OR team IN ('blue', 'white')", name="ck_club_match_participants_team"
        ),
        UniqueConstraint("match_id", "user_id", name="uq_club_match_participants_user"),
        UniqueConstraint("match_id", "guest_id", name="uq_club_match_participants_guest"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("club_matches.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    guest_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("guests.id", ondelete="RESTRICT"), index=True
    )
    team: Mapped[str | None] = mapped_column(String(5))
    # 중도 귀가('이후 대진에서 제외', C-15)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # 추가 순서 = 대진 생성 입력 순서(결정성, AC-076)
    position: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClubMatchGame(Base):
    __tablename__ = "club_match_games"
    __table_args__ = (
        CheckConstraint("no >= 1", name="ck_club_match_games_no"),
        CheckConstraint("winner IS NULL OR winner IN (1, 2)", name="ck_club_match_games_winner"),
        UniqueConstraint("match_id", "no", name="uq_club_match_games_no"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("club_matches.id", ondelete="CASCADE"), index=True
    )
    no: Mapped[int] = mapped_column(SmallInteger)
    winner: Mapped[int | None] = mapped_column(SmallInteger)
    gender_relaxed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # 같은 4명·같은 팀 구성을 피할 수 없어 허용한 경기(U7 경고)
    repeated_matchup: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    changed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # 운영진이 선수를 직접 바꾼 경기(확정 전 교체 포함). 규칙 완화 사유를 'manual'로 판정
    manual: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # 규칙 완화 사유 [{rule, reason}] — 생성·교체 시점에 계산해 저장(U7·C-03)
    relaxations: Mapped[list[dict[str, str]]] = mapped_column(
        JSON, default=list, server_default="[]"
    )
    recorded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class ClubMatchGamePlayer(Base):
    __tablename__ = "club_match_game_players"
    __table_args__ = (
        CheckConstraint("side IN (1, 2)", name="ck_club_match_game_players_side"),
        CheckConstraint("slot IN (1, 2)", name="ck_club_match_game_players_slot"),
        UniqueConstraint("game_id", "participant_id", name="uq_club_match_game_players_person"),
    )

    game_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("club_match_games.id", ondelete="CASCADE"), primary_key=True
    )
    side: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    slot: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("club_match_participants.id", ondelete="RESTRICT"), index=True
    )
