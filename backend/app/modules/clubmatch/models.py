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
        # (B15, C-36·C-38) 라운드 기반 청백전: 코트 수 1–8. 기존 청백전은 NULL(기존 방식, D11)
        CheckConstraint(
            "court_count IS NULL OR court_count BETWEEN 1 AND 8", name="ck_club_matches_court_count"
        ),
        CheckConstraint(
            "planned_rounds IS NULL OR planned_rounds BETWEEN 1 AND 200",
            name="ck_club_matches_planned_rounds",
        ),
        CheckConstraint(
            "current_round IS NULL OR current_round >= 1", name="ck_club_matches_current_round"
        ),
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
    # (B15, C-36) 사용 코트 수. NULL이면 라운드 정보 없는 기존 청백전
    court_count: Mapped[int | None] = mapped_column(SmallInteger)
    # (B15, C-36) 자동 생성 기준 라운드 수(기준값). 실제 라운드 수는 경기에서 셈
    planned_rounds: Mapped[int | None] = mapped_column(SmallInteger)
    # (B15, C-37) 진행 중인 라운드(확정 전 NULL, 확정하면 1)
    current_round: Mapped[int | None] = mapped_column(SmallInteger)
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
        # (B15, C-36·C-38) 같은 청백전·라운드·코트는 하나(공통 검사의 마지막 방어선)
        UniqueConstraint("match_id", "round_no", "court_no", name="uq_club_match_games_court"),
        CheckConstraint(
            "(round_no IS NULL AND court_no IS NULL)"
            " OR (round_no >= 1 AND court_no BETWEEN 1 AND 8)",
            name="ck_club_match_games_round_court",
        ),
        # (B15, C-37) 결과와 취소는 동시에 있을 수 없음
        CheckConstraint(
            "winner IS NULL OR cancelled_at IS NULL", name="ck_club_match_games_cancelled"
        ),
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
    # (B15, C-36) 라운드·코트(서버가 매김). 기존 청백전은 NULL
    round_no: Mapped[int | None] = mapped_column(SmallInteger)
    court_no: Mapped[int | None] = mapped_column(SmallInteger)
    # (B15, C-37) 중도 귀가로 취소된 경기(현재 상태, 되돌리지 않음 — 기획 r14).
    # 이력은 club_match_game_events
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    cancel_reason: Mapped[str | None] = mapped_column(String(20))


class ClubMatchGameEvent(Base):
    """(B15, C-37·C-38) 경기 취소 이력. 추가만 하고 고치거나 지우지 않음.

    (B18, 기획 r14) 동작은 'cancel'만.
    """

    __tablename__ = "club_match_game_events"
    __table_args__ = (
        CheckConstraint("action IN ('cancel')", name="ck_club_match_game_events_action"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("club_matches.id", ondelete="CASCADE"), index=True
    )
    game_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("club_match_games.id", ondelete="CASCADE"), index=True
    )
    action: Mapped[str] = mapped_column(String(10))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reason: Mapped[str | None] = mapped_column(String(20))
    # 취소 이력의 추가 정보(JSON). 지금은 비워 둠
    detail: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, server_default="{}")


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
