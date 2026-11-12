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

from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.deps import AdminUser, DbSession, verify_origin
from app.modules.clubmatch import schedule
from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGamePlayer,
    ClubMatchParticipant,
)
from app.modules.clubmatch.schemas import (
    ClubMatchCreate,
    ClubMatchListItem,
    ClubMatchView,
    Created,
    GameView,
    LeaveRequest,
    MethodUpdate,
    ParticipantRow,
    ParticipationUpdate,
    Person,
    Relaxation,
    ResultUpdate,
    Rules,
    SettingsUpdate,
    Standing,
    Summary,
    SwapRequest,
    TeamCount,
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
    results = [schedule.GameResult(t1, t2, g.winner) for g, t1, t2 in games]

    counts: dict[str, int] = {}
    unrec: dict[str, int] = {}
    for g, t1, t2 in games:
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

    def person(k: str) -> Person:
        return people.get(k) or Person(
            key=k, id=k, kind="guest", name=DELETED_GUEST, gender=None, grade=None, score=None
        )

    names = {k: p.name for k, p in people.items()}
    result_edits = [
        _aware(g.recorded_at) for g, _, _ in games if g.recorded_at and result_changed(m, g)
    ]
    standing_keys = [k for k, p in part_by_key.items() if counts.get(k) or not p.left_at]
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
        unrecorded=sum(1 for g, _, _ in games if g.winner is None),
    )


# ── 조회 ──


@router.get("")
def list_club_matches(_: AdminUser, db: DbSession) -> list[ClubMatchListItem]:
    """최신순(날짜 → 만든 시각). 진행 중 팀 승수·미기록 수, 종료 결과(SCR-221)."""
    matches = db.scalars(
        select(ClubMatch).order_by(ClubMatch.match_date.desc(), ClubMatch.created_at.desc())
    ).all()
    items = []
    for m in matches:
        view = build_view(db, m)
        winner: str | None = None
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
    m = ClubMatch(name=body.name, match_date=body.date, method=body.method, created_by_id=actor.id)
    db.add(m)
    db.commit()
    return Created(id=str(m.id))


# ── 확정 전 변경(잠금 + version + draft) ──


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
    """총 경기 수·규칙(밸런스·성별). 만든 대진은 다시 생성하면 반영(화면 안내)."""
    m = _begin(db, match_id, body)
    m.total_games = body.totalGames
    m.rule_balance, m.rule_gender = body.rules.balance, body.rules.gender
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
    """개인전 참가 체크(UXD-038·039). 이미 대진에 들어간 사람은 해제 불가(in_games)."""
    m = _begin(db, match_id, body)
    kind, pid = parse_key(key)
    part = _find_participant(db, m, kind, pid)
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


# ── 대진 생성(I3-b, AC-043·071·073–076, U7·U8) ──

UNSCORED = "unscored_players"
MIN_PLAYERS = "min_players"
MIN_TOTAL = 4
MIN_PER_TEAM = 2


@router.post("/{match_id}/games")
def generate_games(
    match_id: uuid.UUID, body: Versioned, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """대진 생성·다시 생성: 서버 엔진(FE generateClubGames와 같은 결과), 새 시드.

    오류(FE CLUB_ERRORS, Mock과 같은 순서): 점수 미설정 422 `unscored_players` →
    인원 부족 422 `min_players`(최소 4명, 팀전 팀당 2명, U8).
    """
    m = _begin(db, match_id, body)
    parts = _participants(db, m.id)
    people = _people(db, parts)
    in_play = [
        p for p in parts if _participant_key(p) in people and (m.method == "individual" or p.team)
    ]
    unscored = [_participant_key(p) for p in in_play if people[_participant_key(p)].score is None]
    if unscored:
        db.rollback()
        raise AppError(UNSCORED, "점수 미설정 참가자가 있습니다", 422, {"keys": unscored})
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
    m.status = "confirmed"
    m.confirmed_at = _now()
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
    if body.winner is None and m.status == "finished":
        raise _fail(db, LOCKED, "종료된 청백전은 결과를 미기록으로 되돌릴 수 없습니다", 409)
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
        .where(ClubMatchGame.match_id == m.id, ClubMatchGame.winner.is_(None))
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
    rows = _games(db, m.id, by_participant)
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
    parts_by_key = {_participant_key(p): p for p in _participants(db, m.id)}
    leaver = parts_by_key.get(body.from_)
    if leaver is None:
        raise _fail(db, CONFLICT, "대진이 바뀌었습니다", 409, {"version": m.version})
    to = _active_participant(db, m, body.to, parts_by_key)
    _replace(db, m, g, leaver, to)
    db.flush()
    keys = _matchup_keys(db, m)
    twins = [o for o, k in keys.items() if o != no and k == keys[no]]
    if twins:
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
    return _finish(db, m)


def _matchup_keys(db: Session, m: ClubMatch) -> dict[int, str]:
    by_participant = {p.id: _participant_key(p) for p in _participants(db, m.id)}
    return {g.no: schedule.matchup_key(t1, t2) for g, t1, t2 in _games(db, m.id, by_participant)}


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


@router.post("/{match_id}/participants/{key}/leave")
def leave(
    match_id: uuid.UUID, key: str, body: LeaveRequest, _: AdminUser, db: DbSession
) -> ClubMatchView:
    """중도 귀가(AC-078): 이후 대진에서 제외 + 남은 미기록 경기 대체를 한 번에(원자적, P-7).

    - 남은 경기와 assignments가 정확히 맞아야 함(아니면 409 conflict — 그사이 대진이 바뀜)
    - 대체할 사람이 아무도 없는 경기가 있으면 422 `no_substitute`(`details.games`) — 처리 불가
    - 같은 4명·같은 팀 구성(P-4-b): 그 경기에 중복을 만들지 않는 대체 후보가 있으면
      409 `same_matchup`(`details.games`). 다른 후보가 모두 중복이면(서버가 확인) 예외로 허용하고
      사유 `substitute_exhausted`로 표시. 판정은 같은 요청의 다른 대체를 모두 반영한 최종 대진 기준
    - 기존 경기·결과는 그대로, 순위·기록 유지(제외된 사람도 뛴 경기가 있으면 순위표에 남음)
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
    by_participant = {p.id: _participant_key(p) for p in parts}
    rows = _games(db, m.id, by_participant)
    seats = {g.no: (t1, t2) for g, t1, t2 in rows}
    remaining = sorted(g.no for g, t1, t2 in rows if g.winner is None and key in (*t1, *t2))
    asked = [a.gameNo for a in body.assignments]
    if sorted(asked) != remaining:
        raise _fail(
            db,
            CONFLICT,
            "남은 경기가 바뀌었습니다",
            409,
            {"version": m.version, "games": remaining},
        )
    playable = _playable_keys(db, parts) - {key}

    def candidates(no: int) -> list[str]:
        t1, t2 = seats[no]
        return [
            c
            for c in playable
            if c not in (*t1, *t2)
            and (m.method == "individual" or parts_by_key[c].team == leaver.team)
        ]

    stuck = [no for no in remaining if not candidates(no)]
    if stuck:
        raise _fail(
            db,
            NO_SUBSTITUTE,
            "대체할 수 있는 선수가 없는 경기가 있어 중도 귀가를 처리할 수 없습니다",
            422,
            {"games": stuck},
        )
    for a in body.assignments:
        if a.to == key:
            raise _fail(db, NOT_ELIGIBLE, "제외할 선수로는 대체할 수 없습니다", 422)
        to = _active_participant(db, m, a.to, parts_by_key)
        _replace(db, m, _game(db, m, a.gameNo), leaver, to)

    # 최종 대진(모든 대체 반영)에서 같은 대진 판정(FE substituteDecision과 같음)
    avoidable, forced = schedule.substitute_decision(
        seats, key, {a.gameNo: a.to for a in body.assignments}, candidates
    )
    if avoidable:
        raise _fail(
            db,
            SAME_MATCHUP,
            "같은 4명·같은 팀 구성을 피할 수 있는 대체 선수가 있습니다",
            409,
            {"games": sorted(avoidable)},
        )
    leaver.left_at = _now()
    if body.assignments:
        m.modified_at = _now()
        _refresh_flags(db, m, frozenset(forced))
    return _finish(db, m)
