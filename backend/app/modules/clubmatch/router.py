"""청백전 운영(SCR-221–226, FR-014, C-13–C-20).

- I3-a 확정 전 단계(AC-042·070·072), I3-b 대진 생성(AC-043·071·073–076),
  I3-c 확정·결과·되돌리기·교체·중도 귀가·종료(AC-044·077–081·085·088, U2·U10)
- 운영진 이상만(`admin_user`), 쓰기는 `verify_origin`(CSRF)
- 모든 변경: 청백전 행을 SELECT … FOR UPDATE로 잠그고 → 요청 version 비교(다르면 409 conflict, U9) →
  상태 확인(409 locked 등) → 변경 → version + 1 → 최신 상세(ClubMatchView) 응답
- 참가 후보: 승인 회원 + 삭제되지 않은 게스트(비활성 회원은 새로 넣을 수 없음, U6)
"""

import secrets
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.deps import AdminUser, DbSession, verify_origin
from app.modules.clubmatch import display, schedule
from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGameEvent,
    ClubMatchGamePlayer,
    ClubMatchParticipant,
)
from app.modules.clubmatch.schemas import (
    BasicUpdate,
    CancelInfo,
    ClubMatchCreate,
    ClubMatchListItem,
    ClubMatchView,
    Created,
    GameCreate,
    GameExchange,
    GameMove,
    GameView,
    GenerateRequest,
    LeaveRequest,
    MethodUpdate,
    ParticipantRow,
    ParticipantsReplace,
    ParticipationUpdate,
    Person,
    Relaxation,
    RestoreRequest,
    ResultUpdate,
    Rules,
    SettingsUpdate,
    Standing,
    Summary,
    SwapRequest,
    TeamCount,
    TeamsReplace,
    TeamUpdate,
    Versioned,
)
from app.modules.roster.models import Guest, MemberRating
from app.modules.user.models import User

router = APIRouter(
    prefix="/api/club-matches", tags=["clubmatch"], dependencies=[Depends(verify_origin)]
)

# FE CLUB_ERRORS와 같은 코드
CONFLICT = "conflict"
LOCKED = "locked"
IN_GAMES = "in_games"
NOT_FOUND = "not_found"
NOT_ELIGIBLE = "not_eligible"
DELETED_GUEST = "삭제된 게스트"
# (B10) 단계형 생성: 대진·팀 폐기 확인 필요, 미배정, 참가자 아님
CONFIRM_REQUIRED = "confirm_required"
UNASSIGNED = "unassigned"
NOT_PARTICIPANT = "not_participant"


# ── 사람(회원·게스트) ──


def member_key(user_id: uuid.UUID) -> str:
    return f"member:{user_id}"


def guest_key(guest_id: uuid.UUID) -> str:
    return f"guest:{guest_id}"


def parse_key(key: str) -> tuple[Literal["member", "guest"], uuid.UUID]:
    kind, _, raw = key.partition(":")
    try:
        pid = uuid.UUID(raw)
    except ValueError as e:
        raise AppError(NOT_FOUND, "사람을 찾을 수 없습니다", 404) from e
    if kind == "member":
        return "member", pid
    if kind == "guest":
        return "guest", pid
    raise AppError(NOT_FOUND, "사람을 찾을 수 없습니다", 404)


def _member_person(user: User, score: int | None) -> Person:
    return Person(
        key=member_key(user.id),
        id=str(user.id),
        kind="member",
        name=user.name,
        gender=user.gender,
        grade=user.grade,
        score=score,
    )


def _guest_person(guest: Guest) -> Person:
    deleted = guest.deleted_at is not None
    return Person(
        key=guest_key(guest.id),
        id=str(guest.id),
        kind="guest",
        name=DELETED_GUEST if deleted or guest.name is None else guest.name,
        # 비식별화(C안): 삭제된 게스트는 성별·급수·점수 없음(DB도 NULL)
        gender=None if deleted else guest.gender,
        grade=None if deleted else guest.grade,
        score=None if deleted else guest.score,
    )


def _people(db: Session, participants: Iterable[ClubMatchParticipant]) -> dict[str, Person]:
    """참가 후보(승인 회원 + 삭제되지 않은 게스트) + 이미 참가한 사람.

    이미 참가한 사람은 비활성·삭제여도 포함(기록 보존, U5·U6).
    """
    plist = list(participants)
    user_ids = {p.user_id for p in plist if p.user_id}
    guest_ids = {p.guest_id for p in plist if p.guest_id}
    users = db.execute(
        select(User, MemberRating.score)
        .outerjoin(MemberRating, MemberRating.user_id == User.id)
        .where((User.status == "approved") | User.id.in_(user_ids))
    ).all()
    guests = db.scalars(
        select(Guest).where(Guest.deleted_at.is_(None) | Guest.id.in_(guest_ids))
    ).all()
    out = {member_key(u.id): _member_person(u, s) for u, s in users}
    out.update({guest_key(g.id): _guest_person(g) for g in guests})
    return out


def _participant_key(p: ClubMatchParticipant) -> str:
    return member_key(p.user_id) if p.user_id else guest_key(p.guest_id)  # type: ignore[arg-type]


# ── (B15) 라운드·코트(C-36–C-38) ──
# 라운드 기반 청백전(court_count가 있음)의 모든 변경은 _finish 직전에 공통 라운드 검사를 거칩니다.
# 순서: 행 잠금(_lock) → version 확인 → 적용 → 최종 상태 검사(_check_rounds) → version + 1 → 커밋.
# 실패하면 _fail이 트랜잭션 전체를 되돌립니다(부분 변경 없음).
# 같은 라운드·코트는 DB 고유 제약도 막습니다.

ROUND_CONFLICT = "round_conflict"
COURT_FULL = "court_full"
INVALID_ROUND = "invalid_round"
ROUND_NOT_STARTED = "round_not_started"
ROUND_INCOMPLETE = "round_incomplete"
ROUND_LOCKED = "round_locked"
ROUND_HAS_RESULTS = "round_has_results"
GAME_CANCELLED = "game_cancelled"
CANCEL_NOT_ALLOWED = "cancel_not_allowed"
RESTORE_NOT_ALLOWED = "restore_not_allowed"
RESTORE_BLOCKED = "restore_blocked"
LEFT = "left"


def _is_round(m: ClubMatch) -> bool:
    """라운드 기반 청백전인가(코트 수가 있음). 없으면 라운드 정보 없는 기존 청백전(D11)."""
    return m.court_count is not None


def _round_busy(
    rows: Iterable[tuple[ClubMatchGame, tuple[str, str], tuple[str, str]]],
    rd: int | None,
    skip: uuid.UUID | None = None,
) -> set[str]:
    """그 라운드의 취소되지 않은 경기에 나오는 사람(skip 경기는 빼고)."""
    if rd is None:
        return set()
    return {
        k
        for g, t1, t2 in rows
        if g.round_no == rd and g.cancelled_at is None and g.id != skip
        for k in (*t1, *t2)
    }


def _check_rounds(db: Session, m: ClubMatch) -> None:
    """공통 라운드 검사(C-38 r13): 모든 변경 경로의 최종 상태를 같은 규칙으로 봄.

    - 모든 경기에 라운드·코트가 있음, 라운드 1..R 빈틈없음
    - 라운드마다 경기 수 ≤ 코트 수, 코트 1..n 빈틈없음
    - 같은 라운드에 한 사람은 한 경기(취소된 경기는 출전으로 세지 않음, C-37)
    - 경기 번호 = 라운드 → 코트 순 일련번호(D10)
    """
    if not _is_round(m):
        return
    db.flush()
    by_participant = {p.id: _participant_key(p) for p in _participants(db, m.id)}
    rows = _games(db, m.id, by_participant)
    if any(g.round_no is None or g.court_no is None for g, _, _ in rows):
        raise _fail(db, INVALID_ROUND, "라운드 정보가 없는 경기가 있습니다", 422)
    rounds = sorted({g.round_no for g, _, _ in rows if g.round_no is not None})
    if rounds != list(range(1, len(rounds) + 1)):
        raise _fail(db, INVALID_ROUND, "라운드 번호가 맞지 않습니다", 422, {"rounds": rounds})
    for rd in rounds:
        courts = sorted(g.court_no or 0 for g, _, _ in rows if g.round_no == rd)
        if len(courts) > (m.court_count or 0):
            raise _fail(db, COURT_FULL, f"{rd}라운드에 빈 코트가 없습니다", 422, {"round": rd})
        if courts != list(range(1, len(courts) + 1)):
            raise _fail(db, INVALID_ROUND, "코트 번호가 맞지 않습니다", 422, {"round": rd})
    dups = schedule.round_duplicates(
        (g.round_no, (*t1, *t2)) for g, t1, t2 in rows if g.cancelled_at is None
    )
    if dups:
        raise _fail(
            db,
            ROUND_CONFLICT,
            "같은 라운드에 이미 출전하는 사람이 있습니다",
            422,
            {"rounds": {str(rd): keys for rd, keys in dups.items()}},
        )
    ordered = sorted(rows, key=lambda r: (r[0].round_no or 0, r[0].court_no or 0))
    if [g.no for g, _, _ in ordered] != list(range(1, len(ordered) + 1)):
        raise _fail(db, INVALID_ROUND, "경기 번호가 맞지 않습니다", 422)


def _normalize_rounds(db: Session, m: ClubMatch) -> int:
    """빈 라운드를 지우고 뒤 라운드를 당김(D5), 라운드 안 코트를 1..n으로 당김(D3),
    경기 번호를 라운드 → 코트 순으로 다시 매김(D10). 경기 수를 돌려줌.

    고유 제약((match, no)·(match, round, court))을 피하려고 임시 번호(+1000)를 거쳐
    한 트랜잭션에서 바꿈.
    """
    db.flush()
    games = list(
        db.scalars(
            select(ClubMatchGame)
            .where(ClubMatchGame.match_id == m.id)
            .order_by(ClubMatchGame.round_no, ClubMatchGame.court_no, ClubMatchGame.no)
        ).all()
    )
    for g in games:
        g.no = g.no + 1000
        g.round_no = (g.round_no or 1) + 1000
    db.flush()
    round_map: dict[int, int] = {}
    court_next: dict[int, int] = {}
    for i, g in enumerate(games, start=1):
        old = g.round_no or 0
        rd = round_map.setdefault(old, len(round_map) + 1)
        court_next[rd] = court_next.get(rd, 0) + 1
        g.round_no = rd
        g.court_no = court_next[rd]
        g.no = i
    db.flush()
    return len(games)


# ── 상세(ClubMatchView) ──


def result_changed(m: ClubMatch, g: ClubMatchGame) -> bool:
    """종료 후 결과 수정(U10·P-10): 마지막 기록 시각이 종료 시각보다 늦음(열 추가 없이 계산)."""
    if m.finished_at is None or g.recorded_at is None:
        return False
    return _aware(g.recorded_at) > _aware(m.finished_at)


def _aware(t: datetime) -> datetime:
    """SQLite(단위 테스트)는 시간대 없이 돌려줌 → UTC로 맞춰 비교(PostgreSQL은 그대로)."""
    return t if t.tzinfo else t.replace(tzinfo=UTC)


def _participants(db: Session, match_id: uuid.UUID) -> list[ClubMatchParticipant]:
    return list(
        db.scalars(
            select(ClubMatchParticipant)
            .where(ClubMatchParticipant.match_id == match_id)
            .order_by(ClubMatchParticipant.position)
        ).all()
    )


Seats = tuple[str, str]


def _games(
    db: Session, match_id: uuid.UUID, by_participant: dict[uuid.UUID, str]
) -> list[tuple[ClubMatchGame, Seats, Seats]]:
    games = db.scalars(
        select(ClubMatchGame).where(ClubMatchGame.match_id == match_id).order_by(ClubMatchGame.no)
    ).all()
    if not games:
        return []
    players = db.scalars(
        select(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id.in_([g.id for g in games]))
    ).all()
    seats: dict[uuid.UUID, dict[tuple[int, int], str]] = {}
    for p in players:
        seats.setdefault(p.game_id, {})[(p.side, p.slot)] = by_participant[p.participant_id]
    result: list[tuple[ClubMatchGame, Seats, Seats]] = []
    for g in games:
        s = seats.get(g.id, {})
        result.append(
            (g, (s.get((1, 1), ""), s.get((1, 2), "")), (s.get((2, 1), ""), s.get((2, 2), "")))
        )
    return result


def _engine_players(
    m: ClubMatch, parts: list[ClubMatchParticipant], people: dict[str, Person]
) -> list[schedule.ClubPlayer]:
    """생성 엔진 입력: 참가자 추가 순서(position), 팀전은 팀이 있는 사람만(FE Mock과 같은 규칙)."""
    out = []
    for p in parts:
        key = _participant_key(p)
        person = people.get(key)
        if person is None or (m.method == "team" and not p.team):
            continue
        out.append(
            schedule.ClubPlayer(key, person.gender, person.score or 0, p.team)  # type: ignore[arg-type]
        )
    return out


def build_view(db: Session, m: ClubMatch) -> ClubMatchView:
    parts = _participants(db, m.id)
    people = _people(db, parts)
    by_participant = {p.id: _participant_key(p) for p in parts}
    part_by_key = {_participant_key(p): p for p in parts}
    games = _games(db, m.id, by_participant)
    # (B15, C-37) 취소된 경기는 순위·승수·사람별 경기 수·미기록에서 뺌
    live = [(g, t1, t2) for g, t1, t2 in games if g.cancelled_at is None]
    results = [schedule.GameResult(t1, t2, g.winner) for g, t1, t2 in live]

    counts: dict[str, int] = {}
    unrec: dict[str, int] = {}
    for g, t1, t2 in live:
        for k in (*t1, *t2):
            counts[k] = counts.get(k, 0) + 1
            if g.winner is None:
                unrec[k] = unrec.get(k, 0) + 1

    available = _available_keys(db, parts)
    rows: list[ParticipantRow] = []
    for key, who in people.items():
        part = part_by_key.get(key)
        rows.append(
            ParticipantRow(
                **who.model_dump(),
                participating=part is not None,
                team=part.team if part else None,
                games=counts.get(key, 0),
                left=bool(part and part.left_at),
                inUnrecorded=unrec.get(key, 0),
                # 참가하지 않은 사람은 후보 목록 자체가 승인 회원·삭제 안 된 게스트뿐
                available=part is None or key in available,
            )
        )

    in_play = [r for r in rows if r.participating and (m.method == "individual" or r.team)]
    blue = [r for r in in_play if r.team == "blue"]
    white = [r for r in in_play if r.team == "white"]
    total = max(1, m.total_games)
    sizes = {"all": len(in_play), "blue": len(blue), "white": len(white)}
    preview = schedule.distribution(m.method, sizes, total)  # type: ignore[arg-type]
    preview["proposals"] = schedule.even_proposals(m.method, sizes, total)  # type: ignore[arg-type]
    if _is_round(m):
        # (B15, C-36·AC-145) 라운드 미리보기: k·예상 경기 수·1인 경기 수(팀별)·출전·휴식·균등안
        per = schedule.per_round(m.method, sizes, m.court_count or 0)  # type: ignore[arg-type]
        planned = m.planned_rounds or schedule.default_rounds(
            m.method,  # type: ignore[arg-type]
            sizes,
            per,
        )
        preview["rounds"] = schedule.round_preview(
            m.method,  # type: ignore[arg-type]
            sizes,
            m.court_count or 0,
            planned,
        )

    def person(k: str) -> Person:
        return people.get(k) or Person(
            key=k, id=k, kind="guest", name=DELETED_GUEST, gender=None, grade=None, score=None
        )

    names = {k: p.name for k, p in people.items()}
    result_edits = [
        _aware(g.recorded_at) for g, _, _ in games if g.recorded_at and result_changed(m, g)
    ]
    standing_keys = [k for k, p in part_by_key.items() if counts.get(k) or not p.left_at]
    round_count = len({g.round_no for g, _, _ in games if g.round_no is not None})
    return ClubMatchView(
        id=str(m.id),
        name=m.name,
        date=m.match_date,
        method=m.method,
        status=m.status,
        version=m.version,
        totalGames=m.total_games,
        rules=Rules(balance=m.rule_balance, gender=m.rule_gender),
        teamProposed=m.team_proposed,
        modifiedAt=m.modified_at,
        resultModifiedAt=max(result_edits, default=None),
        rows=rows,
        summary=Summary(
            count=len(in_play),
            male=sum(1 for r in in_play if r.gender == "남"),
            female=sum(1 for r in in_play if r.gender == "여"),
            blue=TeamCount(n=len(blue), male=sum(1 for r in blue if r.gender == "남")),
            white=TeamCount(n=len(white), male=sum(1 for r in white if r.gender == "남")),
            unscored=[
                Person(**r.model_dump(include=set(Person.model_fields)))
                for r in in_play
                if r.score is None
            ],
        ),
        preview=preview,
        games=[
            GameView(
                no=g.no,
                round=g.round_no,
                court=g.court_no,
                cancelled=CancelInfo(at=_aware(g.cancelled_at), reason=g.cancel_reason)
                if g.cancelled_at
                else None,
                team1=[person(k) for k in t1],
                team2=[person(k) for k in t2],
                winner=g.winner,
                gap=schedule.gap([person(k).score for k in t1], [person(k).score for k in t2]),
                genderRelaxed=g.gender_relaxed,
                repeatedMatchup=g.repeated_matchup,
                relaxations=[Relaxation.model_validate(x) for x in g.relaxations or []],
                manual=g.manual,
                changed=g.changed,
                resultChanged=result_changed(m, g),
            )
            for g, t1, t2 in games
        ],
        standings=[
            Standing(
                **row,
                name=names.get(str(row["key"]), DELETED_GUEST),
                guest=str(row["key"]).startswith("guest:"),
            )
            for row in schedule.standings(results, standing_keys, names)
        ],
        team=schedule.team_score(results),
        unrecorded=sum(1 for g, _, _ in live if g.winner is None),
        courtCount=m.court_count,
        plannedRounds=m.planned_rounds,
        currentRound=m.current_round,
        roundCount=round_count,
    )


# ── 조회 ──


@router.get("")
def list_club_matches(_: AdminUser, db: DbSession) -> list[ClubMatchListItem]:
    """최신순(날짜 → 만든 시각). 진행 중 팀 승수·미기록 수, 종료 결과(SCR-221)."""
    matches = db.scalars(
        select(ClubMatch).order_by(ClubMatch.match_date.desc(), ClubMatch.created_at.desc())
    ).all()
    items = []
    today = display.today_kst()
    for m in matches:
        view = build_view(db, m)
        winner: str | None = None
        result: display.ClubMatchResult | None = None
        if m.status == "finished":
            result = (
                display.team_result(view.team["blue"], view.team["white"])
                if m.method == "team"
                else display.individual_result([s.name for s in view.standings if s.rank == 1])
            )
        if m.status == "finished":
            t = view.team
            if m.method == "team":
                score = f"({t['blue']} : {t['white']})"
                if t["blue"] == t["white"]:
                    winner = f"무승부 {score}"
                else:
                    winner = f"{'청팀' if t['blue'] > t['white'] else '백팀'} 승리 {score}"
            else:
                top = [s.name for s in view.standings if s.rank == 1]
                winner = f"1위 {', '.join(top)}" if top else None
        items.append(
            ClubMatchListItem(
                id=view.id,
                name=view.name,
                date=view.date,
                method=view.method,
                status=view.status,
                unrecorded=view.unrecorded,
                team=view.team if m.method == "team" and m.status != "draft" else None,
                winnerText=winner,
                participants=view.summary.count,
                games=len(view.games),
                displayStatus=display.display_status(
                    m.status, m.match_date, len(view.games) - view.unrecorded, today
                ),
                result=result,
            )
        )
    return items


def _match(db: Session, match_id: uuid.UUID, lock: bool = False) -> ClubMatch:
    query = select(ClubMatch).where(ClubMatch.id == match_id)
    m = db.scalars(query.with_for_update() if lock else query).first()
    if m is None:
        raise AppError(NOT_FOUND, "청백전을 찾을 수 없습니다", 404)
    return m


@router.get("/{match_id}")
def get_club_match(match_id: uuid.UUID, _: AdminUser, db: DbSession) -> ClubMatchView:
    return build_view(db, _match(db, match_id))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_club_match(body: ClubMatchCreate, actor: AdminUser, db: DbSession) -> Created:
    """만들기(SCR-222, AC-042): 대진 미확정, 참가자 없음."""
    m = ClubMatch(
        name=body.name,
        match_date=body.date,
        method=body.method,
        created_by_id=actor.id,
        court_count=body.courtCount,
    )
    db.add(m)
    db.commit()
    return Created(id=str(m.id))


# ── 확정 전 변경(잠금 + version + draft) ──
# (B10) 단계형 생성 페이지(SCR-241–245, C-31–C-34)의 일괄 저장 API는
# 아래 '단계형 생성' 절에 있습니다.


def _fail(
    db: Session, code: str, message: str, status_code: int, details: object = None
) -> AppError:
    """트랜잭션을 되돌리고(잠금 해제, 부분 변경 없음) 오류를 돌려줌."""
    db.rollback()
    return AppError(code, message, status_code, details)


def _lock(db: Session, match_id: uuid.UUID, body: Versioned) -> ClubMatch:
    m = _match(db, match_id, lock=True)
    if m.version != body.version:
        raise _fail(
            db, CONFLICT, "다른 운영진이 청백전을 변경했습니다", 409, {"version": m.version}
        )
    return m


def _begin(db: Session, match_id: uuid.UUID, body: Versioned) -> ClubMatch:
    m = _lock(db, match_id, body)
    if m.status != "draft":
        db.rollback()
        raise AppError(LOCKED, "대진 확정 후에는 바꿀 수 없습니다", 409)
    return m


def _finish(db: Session, m: ClubMatch) -> ClubMatchView:
    _check_rounds(db, m)  # (B15) 라운드 기반이면 최종 상태 공통 검사(실패 시 전체 되돌림)
    m.version += 1
    db.commit()
    db.refresh(m)
    return build_view(db, m)


def _discard_games(db: Session, m: ClubMatch) -> None:
    """확정 전 대진 폐기(방식 변경·팀 변경 시)."""
    game_ids = select(ClubMatchGame.id).where(ClubMatchGame.match_id == m.id)
    db.execute(delete(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id.in_(game_ids)))
    db.execute(delete(ClubMatchGame).where(ClubMatchGame.match_id == m.id))
    m.seed = None


def _game_count(db: Session, m: ClubMatch) -> int:
    return int(
        db.scalar(
            select(func.count()).select_from(ClubMatchGame).where(ClubMatchGame.match_id == m.id)
        )
        or 0
    )


def _unchanged(db: Session, m: ClubMatch) -> ClubMatchView:
    """(B10, C-33·U9) 실제로 바뀐 값이 없으면 저장하지 않음.

    대진·version 그대로(같은 요청 반복도 같은 결과).
    """
    db.rollback()
    return build_view(db, m)


def _confirm_or_fail(db: Session, discard: bool, *, games: int, teams: bool = False) -> None:
    """(B10, C-33) 버려질 대진·팀 배정이 있으면 폐기 확인(discard=true)이 있어야 함.

    없으면 409 confirm_required.

    details: 무엇이 버려지는지(games: 대진 경기 수, teams: 팀 배정 초기화 여부).
    """
    if (games or teams) and not discard:
        raise _fail(
            db,
            CONFIRM_REQUIRED,
            "만든 대진이나 팀 배정이 바뀝니다. 확인 후 다시 요청해 주세요",
            409,
            {"games": games, "teams": teams},
        )


@router.put("/{match_id}/method")
def set_method(
    match_id: uuid.UUID, body: MethodUpdate, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """방식 변경(C-13, AC-070): 미확정 대진 버림, 참가자 유지, 팀 배정 초기화."""
    m = _begin(db, match_id, body)
    m.method = body.method
    _discard_games(db, m)
    m.team_proposed = False
    for p in _participants(db, m.id):
        p.team = None
    return _finish(db, m)


@router.put("/{match_id}/settings")
def set_settings(
    match_id: uuid.UUID, body: SettingsUpdate, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """총 경기 수·규칙(밸런스·성별).

    (B10, C-33·AC-132) 값이 실제로 바뀌고 대진이 있으면 폐기 확인(discard) 후
    설정 저장과 대진 폐기를 함께.
    같은 값이면 저장하지 않음(대진·version 유지).
    """
    m = _begin(db, match_id, body)
    if _is_round(m):
        # (B15, C-33·C-36) 라운드 기반: 자동 생성 기준 라운드 수·규칙.
        # 바뀌고 대진이 있으면 폐기 확인
        rounds = body.rounds if body.rounds is not None else m.planned_rounds
        if (rounds, body.rules.balance, body.rules.gender) == (
            m.planned_rounds,
            m.rule_balance,
            m.rule_gender,
        ):
            return _unchanged(db, m)
        games = _game_count(db, m)
        _confirm_or_fail(db, body.discard, games=games)
        if games:
            _discard_games(db, m)
        m.planned_rounds, m.rule_balance, m.rule_gender = (
            rounds,
            body.rules.balance,
            body.rules.gender,
        )
        return _finish(db, m)
    if body.totalGames is None:
        raise _fail(db, "validation_error", "총 경기 수를 입력해 주세요", 422)
    new = (body.totalGames, body.rules.balance, body.rules.gender)
    if new == (m.total_games, m.rule_balance, m.rule_gender):
        return _unchanged(db, m)
    games = _game_count(db, m)
    _confirm_or_fail(db, body.discard, games=games)
    if games:
        _discard_games(db, m)
    m.total_games, m.rule_balance, m.rule_gender = new
    return _finish(db, m)


def _eligible(db: Session, kind: str, pid: uuid.UUID) -> None:
    """새 참가자: 승인 회원 또는 삭제되지 않은 게스트(U6: 비활성 회원 제외).

    게스트는 FOR SHARE로 잠가 동시에 진행되는 게스트 삭제(비식별화)와 엇갈리지 않게 합니다.
    """
    if kind == "member":
        ok = db.scalars(select(User.id).where(User.id == pid, User.status == "approved")).first()
    else:
        ok = db.scalars(
            select(Guest.id)
            .where(Guest.id == pid, Guest.deleted_at.is_(None))
            .with_for_update(read=True)
        ).first()
    if ok is None:
        db.rollback()
        raise AppError(NOT_ELIGIBLE, "참가할 수 없는 사람입니다", 422)


def _find_participant(
    db: Session, m: ClubMatch, kind: str, pid: uuid.UUID
) -> ClubMatchParticipant | None:
    col = ClubMatchParticipant.user_id if kind == "member" else ClubMatchParticipant.guest_id
    return db.scalars(
        select(ClubMatchParticipant).where(ClubMatchParticipant.match_id == m.id, col == pid)
    ).first()


def _add_participant(
    db: Session, m: ClubMatch, kind: str, pid: uuid.UUID, team: str | None
) -> None:
    _eligible(db, kind, pid)
    position = db.scalar(
        select(func.coalesce(func.max(ClubMatchParticipant.position), 0)).where(
            ClubMatchParticipant.match_id == m.id
        )
    )
    db.add(
        ClubMatchParticipant(
            match_id=m.id,
            user_id=pid if kind == "member" else None,
            guest_id=pid if kind == "guest" else None,
            team=team,
            position=int(position or 0) + 1,
        )
    )


def _in_games(db: Session, part: ClubMatchParticipant) -> bool:
    return bool(
        db.scalar(
            select(func.count())
            .select_from(ClubMatchGamePlayer)
            .where(ClubMatchGamePlayer.participant_id == part.id)
        )
    )


@router.put("/{match_id}/participants/{key}")
def set_participating(
    match_id: uuid.UUID, key: str, body: ParticipationUpdate, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """개인전 참가 체크(UXD-038·039). 이미 대진에 들어간 사람은 해제 불가(in_games).

    (B10) 대진이 있으면 폐기 확인(discard)이 있어야 바꿈(남은 대진은 항상 현재 참가자와 맞음, C-33).
    """
    m = _begin(db, match_id, body)
    kind, pid = parse_key(key)
    part = _find_participant(db, m, kind, pid)
    if body.participating == (part is not None):
        return _unchanged(db, m)
    if body.participating:
        _eligible(db, kind, pid)  # 자격 오류(422)가 폐기 확인(409)보다 먼저 — 일괄 저장과 같은 순서
    games = _game_count(db, m)
    _confirm_or_fail(db, body.discard, games=games)
    if games:
        _discard_games(db, m)
        db.flush()
    if body.participating and part is None:
        _add_participant(db, m, kind, pid, None)
    elif not body.participating and part is not None:
        if _in_games(db, part):
            db.rollback()
            raise AppError(IN_GAMES, "경기에 출전한 선수는 참가를 해제할 수 없습니다", 409)
        db.delete(part)
    return _finish(db, m)


@router.put("/{match_id}/teams/{key}")
def set_team(
    match_id: uuid.UUID, key: str, body: TeamUpdate, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """팀전 청/백/불참(UXD-070). 만든 대진이 있으면 버림(화면이 확인 후 다시 생성)."""
    m = _begin(db, match_id, body)
    kind, pid = parse_key(key)
    _discard_games(db, m)
    part = _find_participant(db, m, kind, pid)
    if body.team is None:
        if part is not None:
            db.delete(part)
    elif part is None:
        _add_participant(db, m, kind, pid, body.team)
    else:
        part.team = body.team
    return _finish(db, m)


@router.post("/{match_id}/teams/propose")
def propose_teams(
    match_id: uuid.UUID, body: Versioned, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """팀 배정안(AC-072, UXD-030): 현재 참가자 전원을 점수 합·성별 비율이 비슷하게 청·백으로."""
    m = _begin(db, match_id, body)
    if m.method != "team":
        db.rollback()
        raise AppError(LOCKED, "팀전에서만 팀 배정안을 만들 수 있습니다", 409)
    parts = _participants(db, m.id)
    people = _people(db, parts)
    candidates = [
        schedule.TeamCandidate(k, people[k].gender, people[k].score)
        for k in (_participant_key(p) for p in parts)
        if k in people
    ]
    proposal = schedule.propose_teams(candidates)
    _discard_games(db, m)
    for p in parts:
        p.team = proposal.get(_participant_key(p), p.team)
    m.team_proposed = True
    return _finish(db, m)


# ── 단계형 생성(B10, C-31–C-34): 단계마다 한 번에 저장, 값이 같으면 무변경, 한 트랜잭션 ──


@router.put("/{match_id}/basic")
def save_basic(
    match_id: uuid.UUID, body: BasicUpdate, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """기본정보(AC-123·070·132): 이름·날짜만 바뀌면 팀·대진 유지.

    방식이 바뀌면 대진 폐기 + 팀 초기화(C-13, 참가자 유지) — 팀 배정·대진이 있으면 폐기 확인 필요.
    """
    m = _begin(db, match_id, body)
    court = body.courtCount if body.courtCount is not None else m.court_count
    if (body.name, body.date, body.method, court) == (
        m.name,
        m.match_date,
        m.method,
        m.court_count,
    ):
        return _unchanged(db, m)
    if court != m.court_count and body.method == m.method:
        # (B15, C-33·C-36·AC-144) 코트 수 변경: 대진이 있으면 확인 후 폐기.
        # 라운드 정보 없는 준비 중 청백전(AC-163)도 같은 방식으로 라운드 기반이 됨
        games = _game_count(db, m)
        _confirm_or_fail(db, body.discard, games=games)
        if games:
            _discard_games(db, m)
        m.planned_rounds = None
    if body.method != m.method:
        parts = _participants(db, m.id)
        _confirm_or_fail(
            db, body.discard, games=_game_count(db, m), teams=any(p.team for p in parts)
        )
        _discard_games(db, m)
        m.team_proposed = False
        for p in parts:
            p.team = None
        m.method = body.method
        m.planned_rounds = None
    m.name, m.match_date = body.name, body.date
    m.court_count = court
    return _finish(db, m)


def _parse_keys(db: Session, keys: Iterable[str]) -> list[tuple[str, str, uuid.UUID]]:
    """사람 키 목록(중복은 처음 것만) → (키, 종류, id). 형식이 틀리면 404 not_found."""
    out: list[tuple[str, str, uuid.UUID]] = []
    seen: set[str] = set()
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        try:
            kind, pid = parse_key(key)
        except AppError:
            db.rollback()
            raise
        out.append((key, kind, pid))
    return out


def _ineligible(db: Session, wanted: list[tuple[str, str, uuid.UUID]]) -> list[str]:
    """새로 넣을 사람 중 자격이 없는 키(승인 회원·삭제 안 된 게스트만, U6).

    게스트는 FOR SHARE로 잠금.
    """
    members = {pid for _, kind, pid in wanted if kind == "member"}
    guests = {pid for _, kind, pid in wanted if kind == "guest"}
    ok_members = set(
        db.scalars(select(User.id).where(User.id.in_(members), User.status == "approved")).all()
        if members
        else []
    )
    ok_guests = set(
        db.scalars(
            select(Guest.id)
            .where(Guest.id.in_(guests), Guest.deleted_at.is_(None))
            .with_for_update(read=True)
        ).all()
        if guests
        else []
    )
    return [
        key
        for key, kind, pid in wanted
        if pid not in (ok_members if kind == "member" else ok_guests)
    ]


@router.put("/{match_id}/participants")
def save_participants(
    match_id: uuid.UUID, body: ParticipantsReplace, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """참가자 일괄 저장(AC-125·128·132·133, C-33·C-34): 최종 목록으로 교체.

    남는 사람은 팀 유지, 추가는 미배정(목록 순서대로 position), 빠진 사람은 삭제(팀에서도 빠짐).
    목록이 바뀌고 대진이 있으면 폐기 확인 필요. 같은 목록이면 무변경.
    """
    m = _begin(db, match_id, body)
    wanted = _parse_keys(db, body.keys)
    parts = _participants(db, m.id)
    current = {_participant_key(p): p for p in parts}
    want_keys = [k for k, _, _ in wanted]
    if set(want_keys) == set(current):
        return _unchanged(db, m)
    added = [w for w in wanted if w[0] not in current]
    bad = _ineligible(db, added)
    if bad:
        raise _fail(db, NOT_ELIGIBLE, "참가할 수 없는 사람이 있습니다", 422, {"keys": bad})
    games = _game_count(db, m)
    _confirm_or_fail(db, body.discard, games=games)
    if games:
        _discard_games(db, m)
        db.flush()  # 경기 선수 → 참가자 FK(RESTRICT)보다 먼저 지움
    keep = set(want_keys)
    for key, p in current.items():
        if key not in keep:
            db.delete(p)
    position = max((p.position for p in parts), default=0)
    for _key, kind, pid in added:
        position += 1
        db.add(
            ClubMatchParticipant(
                match_id=m.id,
                user_id=pid if kind == "member" else None,
                guest_id=pid if kind == "guest" else None,
                team=None,
                position=position,
            )
        )
    return _finish(db, m)


@router.put("/{match_id}/teams")
def save_teams(
    match_id: uuid.UUID, body: TeamsReplace, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """팀 배정 일괄 저장(AC-127·128·135, C-34): 모든 참가자를 청·백에(미배정 0명, 팀마다 2명 이상).

    배정이 바뀌고 대진이 있으면 폐기 확인 필요(대진은 다시 만들지 않음). 같으면 무변경.
    """
    m = _begin(db, match_id, body)
    if m.method != "team":
        raise _fail(db, LOCKED, "팀전에서만 팀을 정할 수 있습니다", 409)
    parts = _participants(db, m.id)
    current = {_participant_key(p): p for p in parts}
    strangers = [k for k in body.assignments if k not in current]
    if strangers:
        raise _fail(db, NOT_PARTICIPANT, "참가자가 아닌 사람이 있습니다", 422, {"keys": strangers})
    missing = [k for k in current if k not in body.assignments]
    if missing:
        raise _fail(
            db, UNASSIGNED, f"미배정 {len(missing)}명의 팀을 골라 주세요", 422, {"keys": missing}
        )
    blue = sum(1 for t in body.assignments.values() if t == "blue")
    white = len(body.assignments) - blue
    if blue < MIN_PER_TEAM or white < MIN_PER_TEAM:
        raise _fail(
            db,
            MIN_PLAYERS,
            "청팀이 2명 이상이어야 합니다"
            if blue < MIN_PER_TEAM
            else "백팀이 2명 이상이어야 합니다",
            422,
            {
                "minTotal": MIN_TOTAL,
                "minPerTeam": MIN_PER_TEAM,
                "count": len(body.assignments),
                "blue": blue,
                "white": white,
            },
        )
    if all(current[k].team == t for k, t in body.assignments.items()):
        return _unchanged(db, m)
    games = _game_count(db, m)
    _confirm_or_fail(db, body.discard, games=games)
    if games:
        _discard_games(db, m)
    for k, t in body.assignments.items():
        current[k].team = t
    m.team_proposed = True
    return _finish(db, m)


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_club_match(match_id: uuid.UUID, version: int, _: AdminUser, db: DbSession) -> Response:
    """준비 중 청백전 삭제(AC-134, C-32): 물리 삭제(참가자·대진 함께). 확정한 청백전은 409 locked.

    경기 선수 → 경기 → 참가자 → 청백전 순서(경기 선수 → 참가자 FK가 RESTRICT).
    재시도 때의 404는 화면이 '이미 삭제됨'으로 처리.
    준비 중 청백전은 전적·랭크에 쓰이지 않음(record.py는 draft 제외).
    """
    m = _lock(db, match_id, Versioned(version=version))
    if m.status != "draft":
        raise _fail(db, LOCKED, "확정한 청백전은 삭제할 수 없습니다", 409)
    _discard_games(db, m)
    db.flush()
    db.execute(delete(ClubMatchParticipant).where(ClubMatchParticipant.match_id == m.id))
    db.delete(m)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── 대진 생성(I3-b, AC-043·071·073–076, U7·U8) ──

UNSCORED = "unscored_players"
MIN_PLAYERS = "min_players"
MIN_TOTAL = 4
MIN_PER_TEAM = 2


@router.post("/{match_id}/games")
def generate_games(
    match_id: uuid.UUID, body: GenerateRequest, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """대진 생성·다시 생성: 서버 엔진(FE generateClubGames와 같은 결과), 새 시드.

    오류(FE CLUB_ERRORS, Mock과 같은 순서): 점수 미설정 422 `unscored_players` →
    인원 부족 422 `min_players`(최소 4명, 팀전 팀당 2명, U8).
    (B10) 총 경기 수·규칙을 함께 보내면 같은 트랜잭션에서 저장한 뒤 생성(C-32).
    팀전 미배정 참가자가 있으면
    422 `unassigned`(조용히 제외하지 않음, 점수 미설정 다음 순서).
    """
    m = _begin(db, match_id, body)
    if body.totalGames is not None and not _is_round(m):
        m.total_games = body.totalGames
    if body.rounds is not None and _is_round(m):
        m.planned_rounds = body.rounds
    if body.rules is not None:
        m.rule_balance, m.rule_gender = body.rules.balance, body.rules.gender
    parts = _participants(db, m.id)
    people = _people(db, parts)
    in_play = [
        p for p in parts if _participant_key(p) in people and (m.method == "individual" or p.team)
    ]
    unscored = [_participant_key(p) for p in in_play if people[_participant_key(p)].score is None]
    if unscored:
        db.rollback()
        raise AppError(UNSCORED, "점수 미설정 참가자가 있습니다", 422, {"keys": unscored})
    unassigned = _unassigned(m, parts, people)
    if unassigned:
        raise _fail(
            db,
            UNASSIGNED,
            _unassigned_message(unassigned),
            422,
            {"keys": unassigned},
        )
    blue = sum(1 for p in in_play if p.team == "blue")
    white = sum(1 for p in in_play if p.team == "white")
    short = len(in_play) < MIN_TOTAL or (
        m.method == "team" and (blue < MIN_PER_TEAM or white < MIN_PER_TEAM)
    )
    if short:
        db.rollback()
        raise AppError(
            MIN_PLAYERS,
            "참가자가 4명 이상이어야 대진을 만들 수 있습니다"
            if m.method == "individual"
            else "청·백 팀마다 2명 이상이어야 대진을 만들 수 있습니다",
            422,
            {
                "minTotal": MIN_TOTAL,
                "minPerTeam": MIN_PER_TEAM if m.method == "team" else None,
                "count": len(in_play),
                "blue": blue if m.method == "team" else None,
                "white": white if m.method == "team" else None,
            },
        )
    # (B13, C-33·C-35) 운영진이 편집한 경기가 있으면 확인(discard) 후에만 다시 생성
    edited = db.scalar(
        select(func.count())
        .select_from(ClubMatchGame)
        .where(ClubMatchGame.match_id == m.id, ClubMatchGame.manual.is_(True))
    )
    if edited and not body.discard:
        raise _fail(
            db,
            CONFIRM_REQUIRED,
            "편집한 대진이 사라집니다. 확인 후 다시 요청해 주세요",
            409,
            {"games": _game_count(db, m), "edited": int(edited)},
        )
    if _is_round(m):
        return _generate_rounds(db, m, in_play, people, blue, white)
    _discard_games(db, m)
    db.flush()
    seed = secrets.randbelow(2**31)  # Mock과 같은 범위
    players = _engine_players(m, in_play, people)
    id_by_key = {_participant_key(p): p.id for p in in_play}
    generated = schedule.generate_club_games(
        players,
        m.total_games,
        m.method,  # type: ignore[arg-type]
        m.rule_balance,
        m.rule_gender,
        seed,
    )
    # 완화 사유는 생성 시점 상태로 계산해 저장(U7). 이후 교체 때 다시 계산
    reasons = schedule.relaxations(players, generated, m.method, m.rule_gender)  # type: ignore[arg-type]
    for g in generated:
        game = ClubMatchGame(
            match_id=m.id,
            no=g.no,
            gender_relaxed=g.gender_relaxed,
            repeated_matchup=g.repeated_matchup,
            relaxations=reasons.get(g.no, []),
        )
        db.add(game)
        db.flush()
        for side, team in ((1, g.team1), (2, g.team2)):
            for slot, key in ((1, team[0]), (2, team[1])):
                db.add(
                    ClubMatchGamePlayer(
                        game_id=game.id, side=side, slot=slot, participant_id=id_by_key[key]
                    )
                )
    m.seed = seed
    return _finish(db, m)


def _generate_rounds(
    db: Session,
    m: ClubMatch,
    in_play: list[ClubMatchParticipant],
    people: dict[str, Person],
    blue: int,
    white: int,
) -> ClubMatchView:
    """(B15, C-36·AC-146·147) 라운드 기반 생성: 라운드마다 코트를 채움(D2), 결정적(시드)."""
    sizes = {"all": len(in_play), "blue": blue, "white": white}
    k = schedule.per_round(m.method, sizes, m.court_count or 0)  # type: ignore[arg-type]
    if k <= 0:
        raise _fail(
            db,
            INVALID_ROUND,
            "팀마다 2명 이상, 전체 4명 이상이어야 경기를 만들 수 있습니다",
            422,
            {"perRound": 0},
        )
    rounds = m.planned_rounds or schedule.default_rounds(m.method, sizes, k)  # type: ignore[arg-type]
    top = schedule.max_rounds(k)
    if not 1 <= rounds <= top:
        raise _fail(
            db,
            INVALID_ROUND,
            f"라운드 수는 1–{top} 사이로 입력해 주세요",
            422,
            {"maxRounds": top, "perRound": k},
        )
    _discard_games(db, m)
    db.flush()
    seed = secrets.randbelow(2**31)
    players = _engine_players(m, in_play, people)
    id_by_key = {_participant_key(p): p.id for p in in_play}
    generated = schedule.generate_round_games(
        players,
        rounds,
        m.court_count or 0,
        m.method,  # type: ignore[arg-type]
        m.rule_balance,
        m.rule_gender,
        seed,
    )
    for g in generated:
        game = ClubMatchGame(
            match_id=m.id,
            no=g.no,
            round_no=g.round,
            court_no=g.court,
            gender_relaxed=g.gender_relaxed,
            repeated_matchup=g.repeated_matchup,
            relaxations=g.relaxations or [],
        )
        db.add(game)
        db.flush()
        for side, team in ((1, g.team1), (2, g.team2)):
            for slot, key in ((1, team[0]), (2, team[1])):
                db.add(
                    ClubMatchGamePlayer(
                        game_id=game.id, side=side, slot=slot, participant_id=id_by_key[key]
                    )
                )
    m.seed = seed
    m.planned_rounds = rounds
    m.total_games = max(1, len(generated))
    return _finish(db, m)


def _unassigned_message(keys: list[str]) -> str:
    return f"미배정 {len(keys)}명의 팀을 골라 주세요"


def _unassigned(
    m: ClubMatch, parts: list[ClubMatchParticipant], people: dict[str, Person]
) -> list[str]:
    """팀전에서 팀이 없는 참가자 키.

    삭제된 게스트처럼 사람 정보가 없는 행은 제외(기존 in_play 규칙).
    """
    if m.method != "team":
        return []
    return [_participant_key(p) for p in parts if _participant_key(p) in people and not p.team]


# ── 확정 이후(I3-c) ──

NO_GAMES = "no_games"
SAME_MATCHUP = "same_matchup"
NO_SUBSTITUTE = "no_substitute"
NOT_ALL_RECORDED = "not_all_recorded"
GAME_NOT_FOUND = "not_found"


def _now() -> datetime:
    return datetime.now(UTC)


@router.post("/{match_id}/confirm")
def confirm(match_id: uuid.UUID, body: Versioned, _: AdminUser, db: DbSession) -> ClubMatchView:
    """대진 확정(AC-077, C-13): 회원 공개. 이후 방식·다시 생성·팀 변경 불가."""
    m = _lock(db, match_id, body)
    if m.status != "draft":
        raise _fail(db, LOCKED, "이미 확정된 청백전입니다", 409)
    has_games = db.scalar(
        select(func.count()).select_from(ClubMatchGame).where(ClubMatchGame.match_id == m.id)
    )
    if not has_games:
        raise _fail(db, NO_GAMES, "대진을 먼저 만들어 주세요", 409)
    # (B10, AC-130) 화면 검증을 서버에서 한 번 더: 점수 미설정·팀전 미배정이 있으면 확정하지 않음
    parts = _participants(db, m.id)
    people = _people(db, parts)
    unscored = [
        _participant_key(p)
        for p in parts
        if _participant_key(p) in people
        and (m.method == "individual" or p.team)
        and people[_participant_key(p)].score is None
    ]
    if unscored:
        raise _fail(db, UNSCORED, "점수 미설정 참가자가 있습니다", 422, {"keys": unscored})
    unassigned = _unassigned(m, parts, people)
    if unassigned:
        raise _fail(
            db,
            UNASSIGNED,
            _unassigned_message(unassigned),
            422,
            {"keys": unassigned},
        )
    # (B13, C-19 r11·C-35) 모든 경기를 항상 막는 규칙으로 다시 검사
    parts_by_key = {_participant_key(p): p for p in parts}
    available = _available_keys(db, parts)
    by_participant = {p.id: _participant_key(p) for p in parts}
    for g, t1, t2 in _games(db, m.id, by_participant):
        _check_lineup(db, m, parts_by_key, available, list(t1), list(t2), game_no=g.no)
    m.status = "confirmed"
    m.confirmed_at = _now()
    if _is_round(m):
        m.current_round = 1  # (B15, C-37 Q-032 A1) 확정하면 1라운드가 진행 중
    return _finish(db, m)


def _game(db: Session, m: ClubMatch, no: int) -> ClubMatchGame:
    g = db.scalars(
        select(ClubMatchGame).where(ClubMatchGame.match_id == m.id, ClubMatchGame.no == no)
    ).first()
    if g is None:
        raise _fail(db, GAME_NOT_FOUND, "경기를 찾을 수 없습니다", 404)
    return g


@router.put("/{match_id}/games/{no}/result")
def record_result(
    match_id: uuid.UUID, no: int, body: ResultUpdate, actor: AdminUser, db: DbSession
) -> ClubMatchView:
    """결과 기록·수정(AC-044·081·085)·미기록으로 되돌리기(U2, winner=null).

    - 확정 후부터(확정 전 409 locked). 이긴 쪽만, 스코어 없음(C-20)
    - 종료 후에는 수정만 가능하고 되돌리기는 불가(종료 = 미기록 0 조건 유지, 409 locked)
    - 종료 후 수정(U10)은 기록 시각이 종료 시각보다 늦어지는 것으로 표시(`resultChanged`·
      `resultModifiedAt`). 대진 수정 표시(`changed`·`modifiedAt`)와 따로 안내(P-10)
    - 같은 값을 다시 보내면 아무것도 바꾸지 않고 version도 그대로(두 번 누름 대비, P-2)
    - 순위·팀 승수·전적은 저장하지 않고 조회 때 결과에서 계산 → 자동 재계산(FR-016·023)
    """
    m = _lock(db, match_id, body)
    if m.status == "draft":
        raise _fail(db, LOCKED, "확정 후에 결과를 기록할 수 있습니다", 409)
    g = _game(db, m, no)
    if g.cancelled_at is not None:
        raise _fail(db, GAME_CANCELLED, "취소된 경기는 결과를 기록할 수 없습니다", 409)
    if body.winner is None and m.status == "finished":
        raise _fail(db, LOCKED, "종료된 청백전은 결과를 미기록으로 되돌릴 수 없습니다", 409)
    if _is_round(m) and g.round_no is not None:
        current = m.current_round or 1
        if g.round_no > current:
            raise _fail(
                db,
                ROUND_NOT_STARTED,
                "아직 시작하지 않은 라운드입니다",
                409,
                {"round": g.round_no, "currentRound": current},
            )
        if body.winner is None and g.round_no < current and g.winner is not None:
            raise _fail(
                db,
                ROUND_LOCKED,
                "지난 라운드의 결과는 미기록으로 되돌릴 수 없습니다",
                409,
                {"round": g.round_no, "currentRound": current},
            )
    if g.winner == body.winner:
        db.rollback()
        return build_view(db, m)
    g.winner = body.winner
    g.recorded_at = _now() if body.winner else None
    g.recorded_by_id = actor.id if body.winner else None
    return _finish(db, m)


@router.post("/{match_id}/finish")
def finish(match_id: uuid.UUID, body: Versioned, _: AdminUser, db: DbSession) -> ClubMatchView:
    """종료(AC-085, C-20): 진행 중이고 미기록 0일 때만."""
    m = _lock(db, match_id, body)
    if m.status != "confirmed":
        raise _fail(db, LOCKED, "진행 중인 청백전만 종료할 수 있습니다", 409)
    remaining = db.scalar(
        select(func.count())
        .select_from(ClubMatchGame)
        .where(
            ClubMatchGame.match_id == m.id,
            ClubMatchGame.winner.is_(None),
            ClubMatchGame.cancelled_at.is_(None),  # (B15, C-37) 취소된 경기는 처리된 경기
        )
    )
    if _is_round(m):
        last = int(
            db.scalar(
                select(func.max(ClubMatchGame.round_no)).where(ClubMatchGame.match_id == m.id)
            )
            or 1
        )
        if (m.current_round or 1) < last:
            raise _fail(
                db,
                NOT_ALL_RECORDED,
                "마지막 라운드를 시작해야 종료할 수 있습니다",
                409,
                {"remaining": remaining, "currentRound": m.current_round, "lastRound": last},
            )
    if remaining:
        raise _fail(
            db,
            NOT_ALL_RECORDED,
            "결과가 기록되지 않은 경기가 있습니다",
            409,
            {"remaining": remaining},
        )
    m.status = "finished"
    m.finished_at = _now()
    return _finish(db, m)


def _active_participant(
    db: Session, m: ClubMatch, key: str, parts_by_key: dict[str, ClubMatchParticipant]
) -> ClubMatchParticipant:
    """대체로 들어갈 수 있는 사람: 이 청백전 참가자, 제외 안 됨, 승인 회원·삭제 안 된 게스트(U6)."""
    part = parts_by_key.get(key)
    if part is None or part.left_at is not None:
        raise _fail(db, NOT_ELIGIBLE, "이 청백전에서 뛸 수 있는 선수가 아닙니다", 422)
    if part.user_id:
        ok = db.scalars(
            select(User.id).where(User.id == part.user_id, User.status == "approved")
        ).first()
    else:
        ok = db.scalars(
            select(Guest.id)
            .where(Guest.id == part.guest_id, Guest.deleted_at.is_(None))
            .with_for_update(read=True)
        ).first()
    if ok is None:
        raise _fail(db, NOT_ELIGIBLE, "이 청백전에서 뛸 수 있는 선수가 아닙니다", 422)
    return part


def _replace(
    db: Session,
    m: ClubMatch,
    g: ClubMatchGame,
    leaver: ClubMatchParticipant,
    to: ClubMatchParticipant,
) -> None:
    """한 경기에서 선수 한 명 바꾸기(결과 없는 경기만)."""
    if g.winner is not None:
        raise _fail(db, LOCKED, "결과가 기록된 경기는 바꿀 수 없습니다", 409)
    seats = db.scalars(select(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id == g.id)).all()
    ids = {s.participant_id for s in seats}
    if leaver.id not in ids or to.id in ids:
        raise _fail(db, CONFLICT, "대진이 바뀌었습니다", 409, {"version": m.version})
    if m.method == "team" and leaver.team != to.team:
        raise _fail(db, NOT_ELIGIBLE, "팀전은 같은 팀 선수로만 바꿀 수 있습니다", 422)
    seat = next(s for s in seats if s.participant_id == leaver.id)
    seat.participant_id = to.id
    g.manual = True
    if m.status != "draft":
        g.changed = True  # 회원 화면 '바뀐 경기'(C-15, AC-088)


def _refresh_flags(db: Session, m: ClubMatch, forced: frozenset[str] = frozenset()) -> None:
    """교체 뒤 같은 대진 반복·성별 완화·사유 다시 계산(I3-c 정책, P-4·P-4-b)."""
    db.flush()
    parts = _participants(db, m.id)
    people = _people(db, parts)
    by_participant = {p.id: _participant_key(p) for p in parts}
    rows = [r for r in _games(db, m.id, by_participant) if r[0].cancelled_at is None]
    states = [
        schedule.GameState(
            g.no, t1, t2, g.manual, g.gender_relaxed, g.repeated_matchup, list(g.relaxations or [])
        )
        for g, t1, t2 in rows
    ]
    genders = {k: p.gender for k, p in people.items()}
    schedule.refresh_after_swap(states, genders, m.rule_gender, forced)
    for (g, _, _), st in zip(rows, states, strict=True):
        g.repeated_matchup = st.repeated_matchup
        g.gender_relaxed = st.gender_relaxed
        g.relaxations = st.relaxations


@router.post("/{match_id}/games/{no}/swap")
def swap(
    match_id: uuid.UUID, no: int, body: SwapRequest, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """선수 교체(AC-064·077·079): 확정 전 전체, 확정 후 결과 없는 경기만, 종료 후 불가.

    경기 수 차이가 2 이상이 되는 교체는 막지 않음(화면 경고만, AC-079).
    교체 결과가 다른 경기와 같은 4명·같은 팀이면 409 `same_matchup`(P-4, NFR-003·C-19·UXD-009).
    """
    m = _lock(db, match_id, body)
    if m.status == "finished":
        raise _fail(db, LOCKED, "종료된 청백전은 선수를 바꿀 수 없습니다", 409)
    g = _game(db, m, no)
    if g.cancelled_at is not None:
        raise _fail(db, GAME_CANCELLED, "취소된 경기는 선수를 바꿀 수 없습니다", 409)
    parts = _participants(db, m.id)
    parts_by_key = {_participant_key(p): p for p in parts}
    leaver = parts_by_key.get(body.from_)
    if leaver is None:
        raise _fail(db, CONFLICT, "대진이 바뀌었습니다", 409, {"version": m.version})
    to = _active_participant(db, m, body.to, parts_by_key)
    if _is_round(m):
        # (B15, C-36·AC-150·158) 같은 라운드의 다른 경기에 나오는 사람으로는 바꿀 수 없음
        rows = _games(db, m.id, {p.id: _participant_key(p) for p in parts})
        if body.to in _round_busy(rows, g.round_no, skip=g.id):
            raise _fail(
                db,
                ROUND_CONFLICT,
                "같은 라운드에 이미 출전하는 사람입니다",
                422,
                {"keys": [body.to], "round": g.round_no},
            )
    _replace(db, m, g, leaver, to)
    db.flush()
    keys = _matchup_keys(db, m)
    twins = [o for o, k in keys.items() if o != no and k == keys[no]]
    # (B13, AC-043 r11·AC-140) 같은 대진 거부는 확정 후 교체에만.
    # 확정 전은 허용하고 '운영진 수동 변경' 표시
    if twins and m.status != "draft":
        raise _fail(
            db,
            SAME_MATCHUP,
            "같은 4명·같은 팀 구성의 경기가 이미 있습니다",
            409,
            {"games": [no], "with": twins},
        )
    if m.status == "confirmed":
        m.modified_at = _now()
    _refresh_flags(db, m)
    _mark_draft_repeats(db, m)
    return _finish(db, m)


def _matchup_keys(db: Session, m: ClubMatch) -> dict[int, str]:
    by_participant = {p.id: _participant_key(p) for p in _participants(db, m.id)}
    return {
        g.no: schedule.matchup_key(t1, t2)
        for g, t1, t2 in _games(db, m.id, by_participant)
        if g.cancelled_at is None
    }


def _playable_keys(db: Session, parts: Iterable[ClubMatchParticipant]) -> set[str]:
    """교체·대체 가능한 참가자(P-5): 제외 안 됨 + 승인 회원·삭제 안 된 게스트(잠금 없음)."""
    return _available_keys(db, [p for p in parts if p.left_at is None])


def _available_keys(db: Session, parts: Iterable[ClubMatchParticipant]) -> set[str]:
    """참가자 중 승인 회원·삭제 안 된 게스트(제외 여부와 무관)."""
    active = list(parts)
    users = {p.user_id for p in active if p.user_id}
    guests = {p.guest_id for p in active if p.guest_id}
    ok_users = set(db.scalars(select(User.id).where(User.id.in_(users), User.status == "approved")))
    ok_guests = set(
        db.scalars(select(Guest.id).where(Guest.id.in_(guests), Guest.deleted_at.is_(None)))
    )
    return {
        _participant_key(p)
        for p in active
        if (p.user_id in ok_users) or (p.guest_id is not None and p.guest_id in ok_guests)
    }


# ── (B13) 확정 전 공통 편집: 경기 추가·삭제·맞교환·대진 폐기(C-35, AC-136–143) ──

DUPLICATE_PLAYER = "duplicate_player"
TEAM_VIOLATION = "team_violation"
NOT_TWO_VS_TWO = "not_two_vs_two"
MAX_GAMES = "max_games"
EXCHANGE_NOT_ALLOWED = "exchange_not_allowed"
MAX_TOTAL_GAMES = 200  # club_matches.total_games 제약(1–200)과 같음


def _check_lineup(
    db: Session,
    m: ClubMatch,
    parts_by_key: dict[str, ClubMatchParticipant],
    available: set[str],
    t1: list[str],
    t2: list[str],
    game_no: int | None = None,
) -> None:
    """항상 막는 규칙(C-19 r11): 2 대 2, 같은 경기 같은 선수, 참가 자격, 팀전 팀 소속.

    자동 생성 결과는 엔진이 같은 규칙을 지키고, 확정 전 편집·확정 재검사가 이 함수를 씀.
    허용 규칙(같은 대진 반복·경기 수 불균형·실력차·성별)은 여기서 거부하지 않음.
    """
    where = {"games": [game_no]} if game_no is not None else None
    if len(t1) != 2 or len(t2) != 2:
        raise _fail(db, NOT_TWO_VS_TWO, "경기는 2 대 2여야 합니다", 422, where)
    keys = [*t1, *t2]
    if len(set(keys)) != 4:
        raise _fail(
            db, DUPLICATE_PLAYER, "같은 경기에 같은 선수가 두 번 들어갈 수 없습니다", 422, where
        )
    bad = [
        k for k in keys if k not in parts_by_key or parts_by_key[k].left_at or k not in available
    ]
    if bad:
        raise _fail(
            db,
            NOT_ELIGIBLE,
            "이 청백전에서 뛸 수 있는 선수가 아닙니다",
            422,
            {"keys": bad, **(where or {})},
        )
    if m.method == "team" and (
        any(parts_by_key[k].team != "blue" for k in t1)
        or any(parts_by_key[k].team != "white" for k in t2)
    ):
        raise _fail(db, TEAM_VIOLATION, "팀전은 청팀 2명 대 백팀 2명이어야 합니다", 422, where)


def _mark_draft_repeats(db: Session, m: ClubMatch) -> None:
    """(AC-140) 확정 전 편집으로 생긴 같은 대진은 해당 경기 모두에 '운영진 수동 변경'으로 표시.

    schedule.refresh_after_swap(골든과 같은 규칙)은 뒤 경기만 반복으로 보므로, 확정 전에는
    같은 대진 묶음에 운영진 편집 경기가 있으면 앞 경기도 표시를 더함. 확정 후에는 바꾸지 않음.
    """
    if m.status != "draft":
        return
    db.flush()
    by_participant = {p.id: _participant_key(p) for p in _participants(db, m.id)}
    rows = _games(db, m.id, by_participant)
    groups: dict[str, list[ClubMatchGame]] = {}
    for g, t1, t2 in rows:
        groups.setdefault(schedule.matchup_key(t1, t2), []).append(g)
    for games in groups.values():
        if len(games) < 2 or not any(g.manual for g in games):
            continue
        for g in games:
            g.repeated_matchup = True
            if not any(x["rule"] == "matchup" for x in g.relaxations or []):
                g.relaxations = [*(g.relaxations or []), {"rule": "matchup", "reason": "manual"}]


def _renumber(db: Session, m: ClubMatch) -> int:
    """경기 번호를 1..n으로 다시 매김. n을 돌려줌.

    고유 제약 (match_id, no)을 피하려고 두 단계로 갱신.
    """
    db.flush()
    games = list(
        db.scalars(
            select(ClubMatchGame).where(ClubMatchGame.match_id == m.id).order_by(ClubMatchGame.no)
        ).all()
    )
    for g in games:
        g.no = g.no + 1000
    db.flush()
    for i, g in enumerate(games, start=1):
        g.no = i
    db.flush()
    return len(games)


def _sync_total(m: ClubMatch, count: int) -> None:
    """(C-14 r11) 대진이 있으면 실제 경기 수를 총 경기 수로 저장.

    0경기면 기준값 유지(제약 1–200).
    """
    if count > 0:
        m.total_games = count


@router.post("/{match_id}/games/manual")
def add_game(match_id: uuid.UUID, body: GameCreate, _: AdminUser, db: DbSession) -> ClubMatchView:
    """완성 경기 추가(AC-137, C-35): 확정 전만, 목록 끝 번호.

    미완성 경기는 화면 상태라 서버에 없음.
    """
    m = _begin(db, match_id, body)
    parts = _participants(db, m.id)
    parts_by_key = {_participant_key(p): p for p in parts}
    _check_lineup(db, m, parts_by_key, _available_keys(db, parts), body.team1, body.team2)
    count = _game_count(db, m)
    if count >= MAX_TOTAL_GAMES:
        raise _fail(db, MAX_GAMES, f"경기는 {MAX_TOTAL_GAMES}개까지 만들 수 있습니다", 422)
    round_no = court_no = None
    if _is_round(m):
        # (B15, C-36 D4) 기존 라운드(빈 코트가 있을 때) 또는 마지막 + 1(라운드 추가)
        rows = _games(db, m.id, {p.id: _participant_key(p) for p in parts})
        last = max((g.round_no or 0 for g, _, _ in rows), default=0)
        if body.round is None or not 1 <= body.round <= last + 1:
            raise _fail(db, INVALID_ROUND, "없는 라운드입니다", 422, {"lastRound": last})
        in_round = [g for g, _, _ in rows if g.round_no == body.round]
        if len(in_round) >= (m.court_count or 0):
            raise _fail(db, COURT_FULL, f"{body.round}라운드에 빈 코트가 없습니다", 422)
        busy = _round_busy(rows, body.round) & {*body.team1, *body.team2}
        if busy:
            raise _fail(
                db,
                ROUND_CONFLICT,
                "같은 라운드에 이미 출전하는 사람이 있습니다",
                422,
                {"keys": sorted(busy), "round": body.round},
            )
        round_no, court_no = body.round, len(in_round) + 1
    game = ClubMatchGame(
        match_id=m.id,
        no=count + 1,
        manual=True,
        relaxations=[],
        round_no=round_no,
        court_no=court_no,
    )
    db.add(game)
    db.flush()
    for side, team in ((1, body.team1), (2, body.team2)):
        for slot, key in ((1, team[0]), (2, team[1])):
            db.add(
                ClubMatchGamePlayer(
                    game_id=game.id, side=side, slot=slot, participant_id=parts_by_key[key].id
                )
            )
    if _is_round(m):
        _normalize_rounds(db, m)
    _sync_total(m, count + 1)
    _refresh_flags(db, m)
    _mark_draft_repeats(db, m)
    return _finish(db, m)


@router.delete("/{match_id}/games/{no}")
def delete_game(
    match_id: uuid.UUID, no: int, version: int, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """경기 삭제(AC-138, C-35): 확정 전만.

    번호 재정렬, 총 경기 수 = 실제 경기 수(0경기면 기준값 유지).
    """
    m = _begin(db, match_id, Versioned(version=version))
    g = _game(db, m, no)
    db.execute(delete(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id == g.id))
    db.execute(delete(ClubMatchGame).where(ClubMatchGame.id == g.id))
    # (B15, C-36 D3·D5) 라운드 기반: 코트를 당기고 빈 라운드를 지우고 번호 정리
    _sync_total(m, _normalize_rounds(db, m) if _is_round(m) else _renumber(db, m))
    _refresh_flags(db, m)
    _mark_draft_repeats(db, m)
    return _finish(db, m)


@router.delete("/{match_id}/games")
def discard_games(match_id: uuid.UUID, version: int, _: AdminUser, db: DbSession) -> ClubMatchView:
    """대진 전체 폐기(AC-136, '직접 구성' 전환): 확정 전만. 총 경기 수(기준값)는 그대로."""
    m = _begin(db, match_id, Versioned(version=version))
    _discard_games(db, m)
    return _finish(db, m)


@router.post("/{match_id}/games/{no}/move")
def move_game(
    match_id: uuid.UUID, no: int, body: GameMove, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """(B15, C-36 D6·AC-152) 확정 전 완성 경기를 다른 기존 라운드로 옮김.

    대상 라운드에 빈 코트가 있어야 하고(court_full), 네 명이 대상 라운드에 이미 나오면 안 됨
    (round_conflict). 원래 라운드는 코트를 당기고, 비면 라운드를 지우고 번호를 정리.
    """
    m = _begin(db, match_id, body)
    if not _is_round(m):
        raise _fail(db, INVALID_ROUND, "라운드 정보가 없는 청백전입니다", 422)
    g = _game(db, m, no)
    rows = _games(db, m.id, {p.id: _participant_key(p) for p in _participants(db, m.id)})
    rounds = {r[0].round_no for r in rows}
    if body.round == g.round_no or body.round not in rounds:
        raise _fail(db, INVALID_ROUND, "옮길 수 없는 라운드입니다", 422, {"round": body.round})
    target = [r for r in rows if r[0].round_no == body.round]
    if len(target) >= (m.court_count or 0):
        raise _fail(db, COURT_FULL, f"{body.round}라운드에 빈 코트가 없습니다", 422)
    mine = next(r for r in rows if r[0].id == g.id)
    busy = _round_busy(rows, body.round) & {*mine[1], *mine[2]}
    if busy:
        raise _fail(
            db,
            ROUND_CONFLICT,
            "옮길 라운드에 이미 출전하는 사람이 있습니다",
            422,
            {"keys": sorted(busy), "round": body.round},
        )
    g.round_no = body.round
    g.court_no = len(target) + 1
    g.manual = True
    _normalize_rounds(db, m)
    _refresh_flags(db, m)
    _mark_draft_repeats(db, m)
    return _finish(db, m)


def _processed(g: ClubMatchGame) -> bool:
    """(C-37) 결과 기록 또는 취소 = 처리된 경기."""
    return g.winner is not None or g.cancelled_at is not None


def _round_games(db: Session, m: ClubMatch, rd: int) -> list[ClubMatchGame]:
    return list(
        db.scalars(
            select(ClubMatchGame).where(
                ClubMatchGame.match_id == m.id, ClubMatchGame.round_no == rd
            )
        ).all()
    )


def _begin_live(db: Session, match_id: uuid.UUID, body: Versioned) -> ClubMatch:
    m = _lock(db, match_id, body)
    if m.status != "confirmed":
        raise _fail(db, LOCKED, "진행 중인 청백전에서만 할 수 있습니다", 409)
    if not _is_round(m):
        raise _fail(db, INVALID_ROUND, "라운드 정보가 없는 청백전입니다", 422)
    return m


@router.post("/{match_id}/rounds/next")
def next_round(match_id: uuid.UUID, body: Versioned, _: AdminUser, db: DbSession) -> ClubMatchView:
    """(B15, C-37 D12·AC-155) 다음 라운드 시작.

    진행 라운드의 모든 경기가 결과 기록 또는 취소일 때만.

    결과를 모두 넣어도 자동으로 넘어가지 않음. 마지막 라운드에서는 invalid_round.
    """
    m = _begin_live(db, match_id, body)
    current = m.current_round or 1
    last = int(
        db.scalar(select(func.max(ClubMatchGame.round_no)).where(ClubMatchGame.match_id == m.id))
        or 1
    )
    if current >= last:
        raise _fail(db, INVALID_ROUND, "마지막 라운드입니다", 422, {"currentRound": current})
    left = sorted(g.no for g in _round_games(db, m, current) if not _processed(g))
    if left:
        raise _fail(
            db,
            ROUND_INCOMPLETE,
            f"처리되지 않은 경기 {len(left)}개가 있습니다",
            409,
            {"games": left, "currentRound": current},
        )
    m.current_round = current + 1
    return _finish(db, m)


@router.post("/{match_id}/rounds/undo")
def undo_round(match_id: uuid.UUID, body: Versioned, _: AdminUser, db: DbSession) -> ClubMatchView:
    """(B15, C-37 Q-032 A2·AC-156) 라운드 시작 취소.

    진행 라운드에 결과·취소가 없을 때만 이전 라운드로.
    """
    m = _begin_live(db, match_id, body)
    current = m.current_round or 1
    if current <= 1:
        raise _fail(db, INVALID_ROUND, "1라운드는 시작을 취소할 수 없습니다", 422)
    if any(_processed(g) for g in _round_games(db, m, current)):
        raise _fail(
            db,
            ROUND_HAS_RESULTS,
            "이 라운드에 결과나 취소가 있어 시작을 취소할 수 없습니다",
            409,
            {"currentRound": current},
        )
    m.current_round = current - 1
    return _finish(db, m)


@router.post("/{match_id}/games/{no}/exchange")
def exchange_players(
    match_id: uuid.UUID, no: int, body: GameExchange, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """개인전 같은 경기 맞교환(AC-139, C-35): 확정 전만, 대상과 상대 조 선수의 자리를 바꿈."""
    m = _begin(db, match_id, body)
    if m.method != "individual":
        raise _fail(db, EXCHANGE_NOT_ALLOWED, "팀전은 같은 경기 맞교환을 할 수 없습니다", 422)
    g = _game(db, m, no)
    parts_by_key = {_participant_key(p): p for p in _participants(db, m.id)}
    a, b = parts_by_key.get(body.out), parts_by_key.get(body.in_)
    seats = list(db.scalars(select(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id == g.id)))
    sa = next((s for s in seats if a and s.participant_id == a.id), None)
    sb = next((s for s in seats if b and s.participant_id == b.id), None)
    if sa is None or sb is None or sa.side == sb.side:
        raise _fail(db, CONFLICT, "대진이 바뀌었습니다", 409, {"version": m.version})
    pos = {(sa.side, sa.slot): sb.participant_id, (sb.side, sb.slot): sa.participant_id}
    db.execute(
        delete(ClubMatchGamePlayer).where(
            ClubMatchGamePlayer.game_id == g.id,
            ClubMatchGamePlayer.participant_id.in_([sa.participant_id, sb.participant_id]),
        )
    )
    db.flush()
    for (side, slot), pid in pos.items():
        db.add(ClubMatchGamePlayer(game_id=g.id, side=side, slot=slot, participant_id=pid))
    g.manual = True
    _refresh_flags(db, m)
    _mark_draft_repeats(db, m)
    return _finish(db, m)


@router.post("/{match_id}/participants/{key}/leave")
def leave(
    match_id: uuid.UUID, key: str, body: LeaveRequest, actor: AdminUser, db: DbSession
) -> ClubMatchView:
    """중도 귀가(AC-078): 이후 대진에서 제외 + 남은 미기록 경기 대체를 한 번에(원자적, P-7).

    - 남은 경기와 assignments(+ cancel)가 정확히 맞아야 함(아니면 409 conflict — 그사이 대진이 바뀜)
    - 대체할 사람이 아무도 없는 경기가 있으면 422 `no_substitute`(`details.games`) — 처리 불가
    - 같은 4명·같은 팀 구성(P-4-b): 그 경기에 중복을 만들지 않는 대체 후보가 있으면
      409 `same_matchup`(`details.games`). 다른 후보가 모두 중복이면(서버가 확인) 예외로 허용하고
      사유 `substitute_exhausted`로 표시. 판정은 같은 요청의 다른 대체를 모두 반영한 최종 대진 기준
    - 기존 경기·결과는 그대로, 순위·기록 유지(제외된 사람도 뛴 경기가 있으면 순위표에 남음)
    - (B15, C-37·AC-159) 라운드 기반: 후보는 그 경기 라운드에 출전하지 않는 사람. 후보가 없는 경기는
      `cancel`로 운영진이 취소를 확인해야 함(없으면 `no_substitute`). 후보가 있는 경기의 취소는
      `cancel_not_allowed`. 같은 요청에서 같은 라운드에 같은 사람을 두 번 넣으면 `round_conflict`.
      라운드 정보 없는 기존 청백전은 기존 규칙 그대로(취소 없음)
    """
    m = _lock(db, match_id, body)
    if m.status != "confirmed":
        raise _fail(db, LOCKED, "확정 후에만 제외할 수 있습니다", 409)
    parts = _participants(db, m.id)
    parts_by_key = {_participant_key(p): p for p in parts}
    leaver = parts_by_key.get(key)
    if leaver is None:
        raise _fail(db, GAME_NOT_FOUND, "참가자를 찾을 수 없습니다", 404)
    if leaver.left_at is not None:
        raise _fail(db, CONFLICT, "이미 제외된 선수입니다", 409, {"version": m.version})
    rounds = _is_round(m)
    if body.cancel and not rounds:
        raise _fail(db, CANCEL_NOT_ALLOWED, "이 청백전은 경기를 취소할 수 없습니다", 422)
    by_participant = {p.id: _participant_key(p) for p in parts}
    rows = [r for r in _games(db, m.id, by_participant) if r[0].cancelled_at is None]
    game_by_no = {g.no: g for g, _, _ in rows}
    seats = {g.no: (t1, t2) for g, t1, t2 in rows}
    remaining = sorted(g.no for g, t1, t2 in rows if g.winner is None and key in (*t1, *t2))
    asked = [a.gameNo for a in body.assignments] + list(body.cancel)
    playable = _playable_keys(db, parts) - {key}

    def candidates(no: int) -> list[str]:
        t1, t2 = seats[no]
        busy = (
            _round_busy(rows, game_by_no[no].round_no, skip=game_by_no[no].id) if rounds else set()
        )
        return [
            c
            for c in playable
            if c not in (*t1, *t2)
            and c not in busy
            and (m.method == "individual" or parts_by_key[c].team == leaver.team)
        ]

    stuck = [no for no in remaining if not candidates(no)]
    # (B15, AC-159) 라운드 기반: 대체 불가 경기를 빼고 보낸 요청은
    # conflict가 아니라 no_substitute(취소 확인 필요)
    unasked = set(remaining) - set(asked)
    if (
        len(asked) != len(set(asked))
        or not set(asked) <= set(remaining)
        or (unasked and not (rounds and unasked <= set(stuck)))
    ):
        raise _fail(
            db,
            CONFLICT,
            "남은 경기가 바뀌었습니다",
            409,
            {"version": m.version, "games": remaining},
        )
    if rounds:
        wrong = [no for no in body.cancel if candidates(no)]
        if wrong:
            raise _fail(
                db,
                CANCEL_NOT_ALLOWED,
                "대체할 수 있는 선수가 있는 경기는 취소할 수 없습니다",
                422,
                {"games": wrong},
            )
        stuck = [no for no in stuck if no not in body.cancel]
    if stuck:
        raise _fail(
            db,
            NO_SUBSTITUTE,
            "대체할 수 있는 선수가 없는 경기가 있어 중도 귀가를 처리할 수 없습니다"
            if not rounds
            else "대체할 사람이 없는 경기의 취소를 확인해 주세요",
            422,
            {"games": stuck},
        )
    if rounds:
        per_round: dict[tuple[int | None, str], int] = {}
        for a in body.assignments:
            rk = (game_by_no[a.gameNo].round_no, a.to)
            per_round[rk] = per_round.get(rk, 0) + 1
        twice = sorted({to for (_, to), n in per_round.items() if n > 1})
        if twice:
            raise _fail(
                db,
                ROUND_CONFLICT,
                "같은 라운드에 같은 사람을 두 번 넣을 수 없습니다",
                422,
                {"keys": twice},
            )
    for a in body.assignments:
        if a.to == key:
            raise _fail(db, NOT_ELIGIBLE, "제외할 선수로는 대체할 수 없습니다", 422)
        to = _active_participant(db, m, a.to, parts_by_key)
        if rounds and a.to not in candidates(a.gameNo):
            raise _fail(
                db,
                ROUND_CONFLICT,
                "같은 라운드에 이미 출전하는 사람입니다",
                422,
                {"keys": [a.to], "games": [a.gameNo]},
            )
        _replace(db, m, _game(db, m, a.gameNo), leaver, to)

    # 최종 대진(모든 대체 반영)에서 같은 대진 판정(FE substituteDecision과 같음). 취소할 경기는 뺌
    live_seats = {no: st for no, st in seats.items() if no not in body.cancel}
    avoidable, forced = schedule.substitute_decision(
        live_seats, key, {a.gameNo: a.to for a in body.assignments}, candidates
    )
    if avoidable:
        raise _fail(
            db,
            SAME_MATCHUP,
            "같은 4명·같은 팀 구성을 피할 수 있는 대체 선수가 있습니다",
            409,
            {"games": sorted(avoidable)},
        )
    now = _now()
    for no in body.cancel:
        g = game_by_no[no]
        g.cancelled_at = now
        g.cancelled_by_id = actor.id
        g.cancel_reason = LEFT
        g.changed = True  # 회원 화면 대진 수정 표시(C-37)
        db.add(
            ClubMatchGameEvent(
                match_id=m.id, game_id=g.id, action="cancel", actor_id=actor.id, at=now, reason=LEFT
            )
        )
    leaver.left_at = now
    if body.assignments or body.cancel:
        m.modified_at = now
        _refresh_flags(db, m, frozenset(forced))
    return _finish(db, m)


@router.post("/{match_id}/games/{no}/restore")
def restore_game(
    match_id: uuid.UUID, no: int, body: RestoreRequest, actor: AdminUser, db: DbSession
) -> ClubMatchView:
    """(B15, C-37 r13·AC-164) 취소 경기 복원: 진행 중·시작 전 라운드, 종료 전에만.

    귀가한 선수 자리마다 대체 선수를 함께 지정(귀가 상태는 해제하지 않음). 항상 막는 규칙·
    라운드 규칙·확정 후 같은 대진 거부를 모두 다시 검사. 복원된 경기는 미기록, 이력을 남김.
    """
    m = _lock(db, match_id, body)
    if m.status != "confirmed" or not _is_round(m):
        raise _fail(
            db,
            RESTORE_NOT_ALLOWED,
            "종료된 청백전은 복원할 수 없습니다"
            if m.status == "finished"
            else "진행 중인 라운드 기반 청백전에서만 복원할 수 있습니다",
            409,
        )
    g = _game(db, m, no)
    if g.cancelled_at is None:
        raise _fail(db, RESTORE_NOT_ALLOWED, "취소된 경기가 아닙니다", 409)
    current = m.current_round or 1
    if (g.round_no or 0) < current:
        raise _fail(
            db,
            ROUND_LOCKED,
            "지난 라운드의 경기는 복원할 수 없습니다",
            409,
            {"round": g.round_no, "currentRound": current},
        )
    parts = _participants(db, m.id)
    parts_by_key = {_participant_key(p): p for p in parts}
    by_participant = {p.id: _participant_key(p) for p in parts}
    rows = _games(db, m.id, by_participant)
    mine = next(r for r in rows if r[0].id == g.id)
    seat_keys = [*mine[1], *mine[2]]
    gone = [k for k in seat_keys if parts_by_key[k].left_at is not None]
    unknown = [k for k in body.replacements if k not in gone]
    if unknown:
        raise _fail(
            db, CONFLICT, "대진이 바뀌었습니다", 409, {"version": m.version, "keys": unknown}
        )
    busy = _round_busy(rows, g.round_no, skip=g.id)
    playable = _playable_keys(db, parts)

    def options(out: str) -> list[str]:
        return [
            c
            for c in playable
            if c not in seat_keys
            and c not in busy
            and (m.method == "individual" or parts_by_key[c].team == parts_by_key[out].team)
        ]

    missing = [k for k in gone if k not in body.replacements]
    if missing:
        raise _fail(
            db,
            RESTORE_BLOCKED,
            "귀가한 선수 자리에 대체 선수가 필요합니다"
            if all(options(k) for k in missing)
            else "대체할 사람이 없어 복원할 수 없습니다",
            422,
            {"keys": missing, "candidates": {k: len(options(k)) for k in missing}},
        )
    picked = list(body.replacements.values())
    if len(set(picked)) != len(picked):
        raise _fail(db, DUPLICATE_PLAYER, "같은 경기에 같은 선수가 두 번 들어갈 수 없습니다", 422)
    for out, to_key in body.replacements.items():
        if to_key in busy:
            raise _fail(
                db,
                ROUND_CONFLICT,
                "같은 라운드에 이미 출전하는 사람입니다",
                422,
                {"keys": [to_key], "round": g.round_no},
            )
        to = _active_participant(db, m, to_key, parts_by_key)
        _replace(db, m, g, parts_by_key[out], to)
    db.flush()
    final = [body.replacements.get(k, k) for k in seat_keys]
    _check_lineup(
        db, m, parts_by_key, _available_keys(db, parts), final[:2], final[2:], game_no=g.no
    )
    keys = _matchup_keys(db, m)
    mine_key = schedule.matchup_key(final[:2], final[2:])
    twins = [o for o, k in keys.items() if o != no and k == mine_key]
    if twins:
        raise _fail(
            db,
            SAME_MATCHUP,
            "같은 4명·같은 팀 구성의 경기가 이미 있습니다",
            409,
            {"games": [no], "with": twins},
        )
    now = _now()
    g.cancelled_at = None
    g.cancelled_by_id = None
    g.cancel_reason = None
    g.changed = True
    m.modified_at = now
    db.add(
        ClubMatchGameEvent(
            match_id=m.id,
            game_id=g.id,
            action="restore",
            actor_id=actor.id,
            at=now,
            detail=dict(body.replacements),
        )
    )
    _refresh_flags(db, m)
    return _finish(db, m)
