"""청백전 I3-a — 실제 PostgreSQL(마이그레이션 0006·0007 적용) 연동.

제약 조건(CHECK·UNIQUE·RESTRICT·CASCADE), 동시 조작 시 version 충돌(C-19·U9),
게스트 삭제(비식별화)와 참가 추가가 동시에 와도 삭제된 게스트가 확정 전 청백전에 남지 않음(C-26·U5).
테스트가 만든 행만 지웁니다.
"""

import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.main import create_app
from app.modules.auth.kakao import get_kakao_client
from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGamePlayer,
    ClubMatchParticipant,
)
from app.modules.roster.models import Guest, MemberRating
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import ORIGIN, FakeKakao, auth_settings, kakao_login, new_kakao_id

pytestmark = pytest.mark.db
TAG = f"db-{uuid.uuid4().hex[:6]}"
GUESTS: list[uuid.UUID] = []  # 비식별화로 이름이 지워지므로 id로 정리
BASE = "/api/club-matches"
RULES = {"balance": True, "gender": True}


@pytest.fixture
def pg() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        yield session
        session.rollback()
        # 참가자가 회원·게스트를 RESTRICT로 참조하므로 청백전(→ CASCADE)부터 지움
        session.execute(delete(ClubMatch).where(ClubMatch.name.startswith(TAG)))
        session.execute(delete(Guest).where(Guest.id.in_(GUESTS)))
        session.execute(delete(User).where(User.name.startswith(TAG)))
        session.commit()


@pytest.fixture
def admin(pg: Session) -> Iterator[TestClient]:
    app = create_app()
    settings = get_settings()
    app.dependency_overrides[get_settings] = lambda: auth_settings(settings.database_url)
    app.dependency_overrides[get_kakao_client] = lambda: FakeKakao()
    kid = new_kakao_id()
    user = User(name=f"{TAG}운영진", gender="남", grade="A조", role="admin", status="approved")
    user.identities.append(UserIdentity(provider="kakao", provider_user_id=kid))
    pg.add(user)
    pg.commit()
    with TestClient(app, base_url=ORIGIN, follow_redirects=False, headers={"Origin": ORIGIN}) as c:
        kakao_login(c, kid)
        yield c


def new_member(pg: Session, name: str) -> User:
    u = User(name=f"{TAG}{name}", gender="남", grade="C조", status="approved")
    pg.add(u)
    pg.commit()
    return u


def new_guest(pg: Session, name: str) -> Guest:
    g = Guest(name=f"{TAG}{name}", gender="여", grade="초심", score=4)
    pg.add(g)
    pg.commit()
    GUESTS.append(g.id)
    return g


def create(c: TestClient, name: str = "청백전") -> dict:  # type: ignore[type-arg]
    res = c.post(BASE, json={"method": "individual", "date": "2026-11-15", "name": f"{TAG}{name}"})
    assert res.status_code == 201, res.text
    return c.get(f"{BASE}/{res.json()['id']}").json()  # type: ignore[no-any-return]


def test_db_constraints_restrict_and_cascade(pg: Session) -> None:
    u = new_member(pg, "회원")
    g = new_guest(pg, "손님")
    m = ClubMatch(name=f"{TAG}제약", match_date=date(2026, 11, 15), method="team")
    pg.add(m)
    pg.commit()
    for bad in (
        ClubMatchParticipant(match_id=m.id, position=1),  # 사람 없음
        ClubMatchParticipant(match_id=m.id, user_id=u.id, guest_id=g.id, position=1),  # 둘 다
        ClubMatchParticipant(match_id=m.id, user_id=u.id, team="red", position=1),
    ):
        pg.add(bad)
        with pytest.raises(IntegrityError):
            pg.commit()
        pg.rollback()
    pu = ClubMatchParticipant(match_id=m.id, user_id=u.id, team="blue", position=1)
    pgst = ClubMatchParticipant(match_id=m.id, guest_id=g.id, team="white", position=2)
    pg.add_all([pu, pgst])
    pg.commit()
    pg.add(ClubMatchParticipant(match_id=m.id, user_id=u.id, position=3))
    with pytest.raises(IntegrityError):
        pg.commit()  # 같은 청백전에 같은 회원 두 번
    pg.rollback()
    game = ClubMatchGame(match_id=m.id, no=1)
    pg.add(game)
    pg.commit()
    pg.add(ClubMatchGamePlayer(game_id=game.id, side=1, slot=1, participant_id=pu.id))
    pg.add(ClubMatchGamePlayer(game_id=game.id, side=2, slot=1, participant_id=pgst.id))
    pg.commit()
    for stmt in (
        ClubMatchGamePlayer(game_id=game.id, side=3, slot=1, participant_id=pu.id),  # side CHECK
        ClubMatchGamePlayer(
            game_id=game.id, side=2, slot=2, participant_id=pu.id
        ),  # 한 경기 두 자리
        ClubMatchGame(match_id=m.id, no=1),  # 경기 번호 중복
        ClubMatchGame(match_id=m.id, no=2, winner=3),
    ):
        pg.add(stmt)
        with pytest.raises(IntegrityError):
            pg.commit()
        pg.rollback()
    m_row = pg.get(ClubMatch, m.id)
    assert m_row is not None
    m_row.total_games = 0
    with pytest.raises(IntegrityError):
        pg.commit()
    pg.rollback()
    # 기록이 있는 회원·게스트는 물리 삭제 불가(RESTRICT) — 지난 기록 보존
    for target in (delete(User).where(User.id == u.id), delete(Guest).where(Guest.id == g.id)):
        with pytest.raises(IntegrityError):
            pg.execute(target)
            pg.commit()
        pg.rollback()
    # 경기 선수가 참가자를 RESTRICT로 참조 → 참가자만 따로 지울 수 없음
    with pytest.raises(IntegrityError):
        pg.execute(delete(ClubMatchParticipant).where(ClubMatchParticipant.id == pu.id))
        pg.commit()
    pg.rollback()
    # 청백전 자체를 지우면 경기·선수·참가자가 함께 지워짐(CASCADE)
    pg.execute(delete(ClubMatch).where(ClubMatch.id == m.id))
    pg.commit()
    assert pg.scalars(select(ClubMatchGame).where(ClubMatchGame.match_id == m.id)).first() is None
    assert (
        pg.scalars(
            select(ClubMatchParticipant).where(ClubMatchParticipant.match_id == m.id)
        ).first()
        is None
    )


def test_db_concurrent_changes_same_version_only_one_wins(admin: TestClient, pg: Session) -> None:
    view = create(admin, "동시")
    v = view["version"]

    def put(total: int) -> tuple[int, str | None]:
        res = admin.put(
            f"{BASE}/{view['id']}/settings",
            json={"totalGames": total, "rules": RULES, "version": v},
        )
        return res.status_code, res.json().get("error", {}).get("code")

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(put, range(2, 18)))
    assert sum(1 for s, _ in results if s == 200) == 1
    assert all(code == "conflict" for s, code in results if s != 200)
    after = admin.get(f"{BASE}/{view['id']}").json()
    assert after["version"] == v + 1


def test_db_concurrent_participant_adds_with_same_version(admin: TestClient, pg: Session) -> None:
    members = [new_member(pg, f"참가{i}") for i in range(6)]
    view = create(admin, "참가동시")

    def join(u: User) -> int:
        res = admin.put(
            f"{BASE}/{view['id']}/participants/member:{u.id}",
            json={"participating": True, "version": view["version"]},
        )
        return int(res.status_code)

    with ThreadPoolExecutor(max_workers=6) as pool:
        statuses = list(pool.map(join, members))
    assert sorted(statuses) == [200] + [409] * 5  # 같은 화면 기준 변경은 하나만
    after = admin.get(f"{BASE}/{view['id']}").json()
    assert after["summary"]["count"] == 1


def test_db_guest_delete_races_with_participant_add(admin: TestClient, pg: Session) -> None:
    for i in range(5):
        g = new_guest(pg, f"경합{i}")
        target = create(admin, f"경합{i}")

        add_url = f"{BASE}/{target['id']}/participants/guest:{g.id}"
        add_body = {"participating": True, "version": target["version"]}

        def add(url: str, body: dict[str, object]) -> int:
            return int(admin.put(url, json=body).status_code)

        def remove(url: str) -> int:
            return int(admin.delete(url).status_code)

        with ThreadPoolExecutor(max_workers=2) as pool:
            fa = pool.submit(add, add_url, add_body)
            fr = pool.submit(remove, f"/api/roster/guests/{g.id}")
            added, removed = fa.result(), fr.result()
        assert removed == 204 and added in (200, 422)
        pg.expire_all()
        left = pg.scalars(
            select(ClubMatchParticipant).where(ClubMatchParticipant.guest_id == g.id)
        ).all()
        assert left == []  # 어느 순서든 삭제된 게스트가 확정 전 청백전에 남지 않음
        row = pg.get(Guest, g.id)
        assert row is not None and (row.name, row.grade) == (None, None)


def test_db_finished_match_keeps_anonymized_guest(admin: TestClient, pg: Session) -> None:
    us = [new_member(pg, f"기록{i}") for i in range(3)]
    g = new_guest(pg, "기록손님")
    view = create(admin, "기록")
    for key in [f"member:{u.id}" for u in us] + [f"guest:{g.id}"]:
        view = admin.put(
            f"{BASE}/{view['id']}/participants/{key}",
            json={"participating": True, "version": view["version"]},
        ).json()
    mid = uuid.UUID(view["id"])
    parts = {
        (p.user_id or p.guest_id): p.id
        for p in pg.scalars(
            select(ClubMatchParticipant).where(ClubMatchParticipant.match_id == mid)
        ).all()
    }
    game = ClubMatchGame(match_id=mid, no=1, winner=1)
    pg.add(game)
    pg.flush()
    seats = [us[0].id, g.id, us[1].id, us[2].id]
    for i, pid in enumerate(seats):
        pg.add(
            ClubMatchGamePlayer(
                game_id=game.id, side=1 + i // 2, slot=1 + i % 2, participant_id=parts[pid]
            )
        )
    m = pg.get(ClubMatch, mid)
    assert m is not None
    m.status = "finished"
    pg.commit()
    assert admin.delete(f"/api/roster/guests/{g.id}").status_code == 204
    after = admin.get(f"{BASE}/{view['id']}").json()
    st = next(s for s in after["standings"] if s["key"] == f"guest:{g.id}")
    assert (st["name"], st["wins"], st["rank"]) == ("삭제된 게스트", 1, 1)
    assert after["games"][0]["team1"][1]["grade"] is None


# ── I3-b 대진 생성 ──


def _scored_match(admin: TestClient, pg: Session, n: int, total: int) -> dict:  # type: ignore[type-arg]
    view = create(admin, f"생성{n}")
    for i in range(n):
        u = new_member(pg, f"생성{n}-{i}")
        pg.add(MemberRating(user_id=u.id, score=1 + i % 10))
        pg.commit()
        view = admin.put(
            f"{BASE}/{view['id']}/participants/member:{u.id}",
            json={"participating": True, "version": view["version"]},
        ).json()
    return admin.put(  # type: ignore[no-any-return]
        f"{BASE}/{view['id']}/settings",
        json={"totalGames": total, "rules": RULES, "version": view["version"]},
    ).json()


def test_db_generate_persists_and_regenerate_replaces(admin: TestClient, pg: Session) -> None:
    view = _scored_match(admin, pg, 20, 20)
    first = admin.post(f"{BASE}/{view['id']}/games", json={"version": view["version"]}).json()
    mid = uuid.UUID(view["id"])
    stored = pg.scalars(select(ClubMatchGame).where(ClubMatchGame.match_id == mid)).all()
    assert len(stored) == 20
    old_ids = {g.id for g in stored}
    seats = pg.scalars(
        select(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id.in_(old_ids))
    ).all()
    assert len(seats) == 80
    second = admin.post(f"{BASE}/{view['id']}/games", json={"version": first["version"]}).json()
    pg.expire_all()
    again = pg.scalars(select(ClubMatchGame).where(ClubMatchGame.match_id == mid)).all()
    assert len(again) == 20 and {g.id for g in again}.isdisjoint(old_ids)
    assert second["version"] == first["version"] + 1


def test_db_concurrent_generate_only_one_wins(admin: TestClient, pg: Session) -> None:
    view = _scored_match(admin, pg, 8, 6)

    def post(_: int) -> int:
        res = admin.post(f"{BASE}/{view['id']}/games", json={"version": view["version"]})
        return int(res.status_code)

    with ThreadPoolExecutor(max_workers=6) as pool:
        statuses = sorted(pool.map(post, range(6)))
    assert statuses == [200] + [409] * 5
    mid = uuid.UUID(view["id"])
    pg.expire_all()
    assert len(pg.scalars(select(ClubMatchGame).where(ClubMatchGame.match_id == mid)).all()) == 6


# ── I3-c 확정 이후 동시 조작 ──


def _confirmed(admin: TestClient, pg: Session, n: int, total: int) -> dict:  # type: ignore[type-arg]
    view = _scored_match(admin, pg, n, total)
    view = admin.post(f"{BASE}/{view['id']}/games", json={"version": view["version"]}).json()
    res = admin.post(f"{BASE}/{view['id']}/confirm", json={"version": view["version"]})
    assert res.status_code == 200, res.text
    return res.json()  # type: ignore[no-any-return]


def test_db_concurrent_results_same_version_one_wins(admin: TestClient, pg: Session) -> None:
    view = _confirmed(admin, pg, 8, 6)

    def record(no: int) -> int:
        res = admin.put(
            f"{BASE}/{view['id']}/games/{no}/result",
            json={"winner": 1 + no % 2, "version": view["version"]},
        )
        return int(res.status_code)

    with ThreadPoolExecutor(max_workers=6) as pool:
        statuses = sorted(pool.map(record, range(1, 7)))
    assert statuses == [200] + [409] * 5
    pg.expire_all()
    mid = uuid.UUID(view["id"])
    recorded = pg.scalars(
        select(ClubMatchGame).where(
            ClubMatchGame.match_id == mid, ClubMatchGame.winner.is_not(None)
        )
    ).all()
    assert len(recorded) == 1


def test_db_finish_races_with_result_revert(admin: TestClient, pg: Session) -> None:
    view = _confirmed(admin, pg, 4, 2)
    for no in (1, 2):
        view = admin.put(
            f"{BASE}/{view['id']}/games/{no}/result", json={"winner": 1, "version": view["version"]}
        ).json()

    def do_finish(_: int) -> int:
        url = f"{BASE}/{view['id']}/finish"
        return int(admin.post(url, json={"version": view["version"]}).status_code)

    def do_revert(_: int) -> int:
        url = f"{BASE}/{view['id']}/games/1/result"
        return int(admin.put(url, json={"winner": None, "version": view["version"]}).status_code)

    with ThreadPoolExecutor(max_workers=2) as pool:
        a, b = pool.submit(do_finish, 0), pool.submit(do_revert, 0)
        statuses = sorted([a.result(), b.result()])
    assert statuses == [200, 409]
    pg.expire_all()
    m = pg.get(ClubMatch, uuid.UUID(view["id"]))
    assert m is not None
    unrecorded = pg.scalars(
        select(ClubMatchGame).where(ClubMatchGame.match_id == m.id, ClubMatchGame.winner.is_(None))
    ).all()
    # 어느 쪽이 이기든 '종료인데 미기록 경기가 있는' 상태는 생기지 않음
    assert not (m.status == "finished" and unrecorded)


def test_db_leave_and_swap_race_keeps_lineup_consistent(admin: TestClient, pg: Session) -> None:
    view = _confirmed(admin, pg, 6, 6)
    game = view["games"][0]
    leaver = game["team1"][0]["key"]
    remaining = [
        g["no"] for g in view["games"] if leaver in [p["key"] for p in g["team1"] + g["team2"]]
    ]
    playing = {p["key"] for p in game["team1"] + game["team2"]}
    bench = [r["key"] for r in view["rows"] if r["participating"] and r["key"] not in playing]

    def do_leave(_: int) -> int:
        subs = []
        for no in remaining:
            g = next(x for x in view["games"] if x["no"] == no)
            inside = {p["key"] for p in g["team1"] + g["team2"]}
            subs.append(
                {
                    "gameNo": no,
                    "to": next(
                        k for k in view["rows"] if k["participating"] and k["key"] not in inside
                    )["key"],
                }
            )
        url = f"{BASE}/{view['id']}/participants/{leaver}/leave"
        return int(
            admin.post(url, json={"assignments": subs, "version": view["version"]}).status_code
        )

    def do_swap(_: int) -> int:
        url = f"{BASE}/{view['id']}/games/1/swap"
        body = {"from": leaver, "to": bench[0], "version": view["version"]}
        return int(admin.post(url, json=body).status_code)

    with ThreadPoolExecutor(max_workers=2) as pool:
        a, b = pool.submit(do_leave, 0), pool.submit(do_swap, 0)
        statuses = sorted([a.result(), b.result()])
    assert statuses == [200, 409]
    after = admin.get(f"{BASE}/{view['id']}").json()
    for g in after["games"]:
        four = [p["key"] for p in g["team1"] + g["team2"]]
        assert len(set(four)) == 4  # 한 경기 중복 없음


def test_db_i3d_result_edit_after_finish_and_member_views(admin: TestClient, pg: Session) -> None:
    """PostgreSQL(timestamptz)에서 P-10 결과 수정 판정·회원 응답·내 전적이 맞는지."""
    view = _confirmed(admin, pg, 6, 3)
    for no in (1, 2, 3):
        body = {"winner": 1, "version": view["version"]}
        view = admin.put(f"{BASE}/{view['id']}/games/{no}/result", json=body).json()
    view = admin.post(f"{BASE}/{view['id']}/finish", json={"version": view["version"]}).json()
    assert view["resultModifiedAt"] is None
    assert [g["resultChanged"] for g in view["games"]] == [False] * 3
    body = {"winner": 2, "version": view["version"]}
    view = admin.put(f"{BASE}/{view['id']}/games/2/result", json=body).json()
    assert [g["resultChanged"] for g in view["games"]] == [False, True, False]
    assert view["resultModifiedAt"] is not None and view["modifiedAt"] is None
    member = admin.get(f"/api/member/club-matches/{view['id']}").json()
    assert [(g["changed"], g["resultChanged"]) for g in member["games"]] == [
        (False, False),
        (False, True),
        (False, False),
    ]
    assert member["resultModifiedAt"] is not None
    assert "score" not in str(member) and "version" not in member
    assert admin.get("/api/me/record").status_code == 200
