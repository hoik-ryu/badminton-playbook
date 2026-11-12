"""회원용 청백전 조회(SCR-111·112, FLOW-008, US-023, FR-024, C-18)·내 전적(SCR-121).

- 승인된 사용자(회원·운영진·슈퍼 관리자) 모두 같은 응답(`approved_user`). 대기·거절·비활성은 403
- 확정된 청백전만(진행 중·종료). 확정 전·없는 청백전·잘못된 id는 같은 404(존재 여부 비공개, AC-069)
- 응답은 `member_schemas`의 허용 필드만 DB에서 직접 만듦(운영진 응답을 가공하지 않음, AC-066·068)
- '나'는 서버가 세션으로 판정
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.deps import ApprovedUser, DbSession, verify_origin
from app.modules.clubmatch import schedule
from app.modules.clubmatch.member_schemas import (
    MemberGame,
    MemberPlayer,
    MemberStanding,
    MyRecord,
    PublicClubMatch,
    PublicClubMatchItem,
    TeamWins,
)
from app.modules.clubmatch.models import ClubMatch, ClubMatchParticipant
from app.modules.clubmatch.record import club_record, rank_for
from app.modules.clubmatch.router import (
    DELETED_GUEST,
    _aware,
    _games,
    _participants,
    result_changed,
)
from app.modules.roster.models import Guest
from app.modules.user.models import User

router = APIRouter(
    prefix="/api/member/club-matches",
    tags=["clubmatch-member"],
    dependencies=[Depends(verify_origin)],
)
record_router = APIRouter(prefix="/api/me", tags=["user"], dependencies=[Depends(verify_origin)])

CLUB_NOT_FOUND = "club_match_not_found"


def _not_found() -> AppError:
    return AppError(CLUB_NOT_FOUND, "청백전을 찾을 수 없습니다", 404)


def public_key(p: ClubMatchParticipant) -> str:
    """S-1: 청백전 범위 키(내부 회원·게스트 id를 내보내지 않음)."""
    return f"p:{p.id}"


class _Match:
    """한 청백전의 회원용 계산 재료(이름·경기·결과). 점수·성별·급수는 읽지 않음."""

    def __init__(self, db: Session, m: ClubMatch, me: uuid.UUID) -> None:
        self.m = m
        parts = _participants(db, m.id)
        self.parts = parts
        users = {p.user_id for p in parts if p.user_id}
        guests = {p.guest_id for p in parts if p.guest_id}
        user_rows = db.execute(select(User.id, User.name).where(User.id.in_(users))).tuples()
        user_names = {uid: name for uid, name in user_rows}
        guest_rows = db.execute(
            select(Guest.id, Guest.name, Guest.deleted_at).where(Guest.id.in_(guests))
        ).tuples()
        guest_names = {
            gid: (DELETED_GUEST if deleted or not name else name)
            for gid, name, deleted in guest_rows
        }
        self.names: dict[str, str] = {}
        self.guest: dict[str, bool] = {}
        self.me_key: str | None = None
        for p in parts:
            k = public_key(p)
            if p.user_id:
                self.names[k] = user_names.get(p.user_id, "")
                self.guest[k] = False
                if p.user_id == me:
                    self.me_key = k
            else:
                gid = p.guest_id
                self.names[k] = guest_names.get(gid, DELETED_GUEST) if gid else DELETED_GUEST
                self.guest[k] = True
        self.games = _games(db, m.id, {p.id: public_key(p) for p in parts})
        self.results = [schedule.GameResult(t1, t2, g.winner) for g, t1, t2 in self.games]

    def player(self, k: str) -> MemberPlayer:
        return MemberPlayer(
            key=k,
            name=self.names.get(k, DELETED_GUEST),
            guest=self.guest.get(k, True),
            me=k == self.me_key,
        )

    def standings(self) -> list[MemberStanding]:
        counts: dict[str, int] = {}
        for _, t1, t2 in self.games:
            for k in (*t1, *t2):
                counts[k] = counts.get(k, 0) + 1
        keys = [public_key(p) for p in self.parts if counts.get(public_key(p)) or not p.left_at]
        return [
            MemberStanding(
                key=str(row["key"]),
                name=self.names.get(str(row["key"]), DELETED_GUEST),
                guest=self.guest.get(str(row["key"]), True),
                me=row["key"] == self.me_key,
                wins=int(row["wins"]),  # type: ignore[call-overload]
                games=int(row["games"]),  # type: ignore[call-overload]
                rank=int(row["rank"]),  # type: ignore[call-overload]
                tied=bool(row["tied"]),
            )
            for row in schedule.standings(self.results, keys, self.names)
        ]

    def team(self) -> TeamWins:
        return TeamWins(**schedule.team_score(self.results))

    def unrecorded(self) -> int:
        return sum(1 for g, _, _ in self.games if g.winner is None)

    def result_text(self) -> str | None:
        """종료 결과(UXD-075): 팀전 청팀 승리·백팀 승리·무승부 / 개인전 1위·공동 1위 이름 외 n명."""
        if self.m.status != "finished":
            return None
        if self.m.method == "team":
            t = self.team()
            return (
                "무승부" if t.blue == t.white else "청팀 승리" if t.blue > t.white else "백팀 승리"
            )
        top = [s for s in self.standings() if s.rank == 1]
        if not top:
            return None
        return (
            f"1위 {top[0].name}" if len(top) == 1 else f"공동 1위 {top[0].name} 외 {len(top) - 1}명"
        )


def _public(db: Session, match_id: str) -> ClubMatch:
    try:
        mid = uuid.UUID(match_id)
    except ValueError as e:
        raise _not_found() from e
    m = db.get(ClubMatch, mid)
    if m is None or m.status == "draft":
        raise _not_found()
    return m


@router.get("")
def list_public_club_matches(user: ApprovedUser, db: DbSession) -> list[PublicClubMatchItem]:
    """SCR-111: 확정된 청백전 최신순(미확정은 날짜·이름도 없음, AC-069·089)."""
    matches = db.scalars(
        select(ClubMatch)
        .where(ClubMatch.status != "draft")
        .order_by(ClubMatch.match_date.desc(), ClubMatch.created_at.desc())
    ).all()
    items = []
    for m in matches:
        x = _Match(db, m, user.id)
        players = {k for _, t1, t2 in x.games for k in (*t1, *t2)}
        items.append(
            PublicClubMatchItem(
                id=str(m.id),
                name=m.name,
                date=m.match_date,
                method=m.method,
                status=m.status,
                team=x.team() if m.method == "team" else None,
                games=len(x.games),
                participants=len(players),
                unrecorded=x.unrecorded(),
                resultText=x.result_text(),
            )
        )
    return items


@router.get("/{match_id}")
def get_public_club_match(match_id: str, user: ApprovedUser, db: DbSession) -> PublicClubMatch:
    """SCR-112: 확정된 청백전 하나(대진·결과·순위·팀 승수, 나 표시)."""
    m = _public(db, match_id)
    x = _Match(db, m, user.id)
    games = []
    for g, t1, t2 in x.games:
        side = 1 if x.me_key in t1 else 2 if x.me_key in t2 else None
        games.append(
            MemberGame(
                no=g.no,
                team1=[x.player(k) for k in t1],
                team2=[x.player(k) for k in t2],
                winner=g.winner,
                changed=g.changed,
                resultChanged=result_changed(m, g),
                mySide=side,
            )
        )
    edits = [_aware(g.recorded_at) for g, _, _ in x.games if g.recorded_at and result_changed(m, g)]
    return PublicClubMatch(
        id=str(m.id),
        name=m.name,
        date=m.match_date,
        method=m.method,
        status=m.status,
        modifiedAt=m.modified_at,
        resultModifiedAt=max(edits, default=None),
        games=games,
        standings=x.standings(),
        team=x.team(),
        unrecorded=x.unrecorded(),
        participating=any(g.mySide is not None for g in games),
    )


@record_router.get("/record")
def my_record(user: ApprovedUser, db: DbSession) -> MyRecord:
    """SCR-121 내 전적·랭크(본인 것만)."""
    wins, losses = club_record(db, user.id)
    games = wins + losses
    rank, to_rank, rate = rank_for(games, wins)
    return MyRecord(
        rank=rank, gamesToRank=to_rank, games=games, wins=wins, losses=losses, rate=rate
    )
