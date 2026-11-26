"""청백전 라운드·코트(B15) — 실제 PostgreSQL(임시 테스트 DB, scripts/test-db-temp.sh)에서만.

- AC-163: 마이그레이션 0011 upgrade·downgrade, 기존(라운드 정보 없는) 데이터 보존, 라운드 청백전이
  있으면 downgrade 중단
- AC-165: 같은 version 동시 요청은 하나만 반영(행 잠금), 최신 version 재요청은
  공통 라운드 검사로 거부, 끝난 뒤 저장 상태가 라운드 규칙을 지킴,
  같은 라운드·코트는 DB 고유 제약도 막음
- AC-146·160·161: 라운드 생성·취소·종료가 PostgreSQL에서도 같게 동작

로컬 개발 DB(5432 smapsh)·Neon은 쓰지 않습니다(conftest·dbguard가 막음).
테스트가 만든 행만 지웁니다.
"""

import os
import uuid
from collections import defaultdict
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from alembic import command
from app.core.config import get_settings
from app.core.db import get_engine, get_sessionmaker
from app.main import create_app
from app.modules.auth.kakao import get_kakao_client
from app.modules.clubmatch.models import ClubMatch, ClubMatchGame, ClubMatchGameEvent
from app.modules.roster.models import MemberRating
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import ORIGIN, FakeKakao, auth_settings, kakao_login, new_kakao_id

pytestmark = pytest.mark.db
TAG = f"rnd-{uuid.uuid4().hex[:6]}"
BASE = "/api/club-matches"
RULES = {"balance": True, "gender": True}
BACKEND = Path(__file__).parents[2]


def ac(*ids: str) -> pytest.MarkDecorator:
    tag = ", ".join(ids)
    return pytest.mark.parametrize("ac_tag", [tag], ids=[tag])


@pytest.fixture
def pg() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        yield session
        session.rollback()
        session.execute(delete(ClubMatch).where(ClubMatch.name.startswith(TAG)))
        session.execute(delete(User).where(User.name.startswith(TAG)))
        session.commit()


def _client(pg: Session) -> TestClient:
    app = create_app()
    settings = get_settings()
    app.dependency_overrides[get_settings] = lambda: auth_settings(settings.database_url)
    app.dependency_overrides[get_kakao_client] = lambda: FakeKakao()
    kid = new_kakao_id()
    user = User(name=f"{TAG}운영진", gender="남", grade="A조", role="admin", status="approved")
    user.identities.append(UserIdentity(provider="kakao", provider_user_id=kid))
    pg.add(user)
    pg.commit()
    c = TestClient(app, base_url=ORIGIN, follow_redirects=False, headers={"Origin": ORIGIN})
    c.__enter__()
    kakao_login(c, kid)
    return c


@pytest.fixture
def admin(pg: Session) -> Iterator[TestClient]:
    c = _client(pg)
    yield c
    c.__exit__(None, None, None)


@pytest.fixture
def admin2(pg: Session) -> Iterator[TestClient]:
    """두 번째 운영진(다른 세션, 동시 조작)."""
    c = _client(pg)
    yield c
    c.__exit__(None, None, None)


def ok(res: Any) -> Any:
    assert res.status_code == 200, res.text
    return res.json()


def code(res: Any) -> tuple[int, str]:
    return res.status_code, res.json()["error"]["code"]


def members(pg: Session, n: int) -> list[str]:
    keys = []
    for i in range(n):
        u = User(
            name=f"{TAG}선수{i}", gender="여" if i % 2 else "남", grade="C조", status="approved"
        )
        pg.add(u)
        pg.flush()
        pg.add(MemberRating(user_id=u.id, score=3 + i % 6))
        keys.append(f"member:{u.id}")
    pg.commit()
    return keys


def round_match(
    c: TestClient, pg: Session, n: int, courts: int, rounds: int, method: str = "individual"
) -> tuple[Any, list[str]]:
    res = c.post(
        BASE,
        json={"method": method, "date": "2026-11-26", "name": f"{TAG}라운드", "courtCount": courts},
    )
    view = ok(c.get(f"{BASE}/{res.json()['id']}"))
    keys = members(pg, n)
    view = ok(
        c.put(f"{BASE}/{view['id']}/participants", json={"keys": keys, "version": view["version"]})
    )
    if method == "team":
        assign = {k: "blue" if i % 2 == 0 else "white" for i, k in enumerate(keys)}
        view = ok(
            c.put(
                f"{BASE}/{view['id']}/teams",
                json={"assignments": assign, "version": view["version"]},
            )
        )
    view = ok(
        c.post(
            f"{BASE}/{view['id']}/games",
            json={"rounds": rounds, "rules": RULES, "version": view["version"]},
        )
    )
    return view, keys


def players(g: Any) -> list[str]:
    return [p["key"] for p in g["team1"] + g["team2"]]


def assert_round_rules(view: Any) -> None:
    rounds: dict[int, list[Any]] = defaultdict(list)
    for g in view["games"]:
        rounds[g["round"]].append(g)
    assert sorted(rounds) == list(range(1, len(rounds) + 1))
    for gs in rounds.values():
        assert sorted(g["court"] for g in gs) == list(range(1, len(gs) + 1))
        assert len(gs) <= view["courtCount"]
        live = [k for g in gs if not g["cancelled"] for k in players(g)]
        assert len(live) == len(set(live))
    ordered = sorted(view["games"], key=lambda g: (g["round"], g["court"]))
    assert [g["no"] for g in ordered] == list(range(1, len(ordered) + 1))


def race(*calls: Callable[[], Any]) -> list[Any]:
    with ThreadPoolExecutor(max_workers=len(calls)) as pool:
        futures = [pool.submit(f) for f in calls]
        return [f.result() for f in futures]


# ── AC-146 생성(PostgreSQL) ──


@ac("AC-146")
def test_db_round_generation_persists(admin: TestClient, pg: Session, ac_tag: str) -> None:
    view, _ = round_match(admin, pg, 20, 4, 5)
    assert len(view["games"]) == 20 and view["roundCount"] == 5
    assert_round_rules(view)
    tview, _ = round_match(admin, pg, 18, 4, 5, method="team")
    assert_round_rules(tview)


# ── AC-165 동시 요청·공통 검사·DB 제약 ──


@ac("AC-165")
def test_db_concurrent_add_to_same_round(
    admin: TestClient, admin2: TestClient, pg: Session, ac_tag: str
) -> None:
    view, keys = round_match(admin, pg, 12, 2, 3)  # 라운드마다 8명·4명 휴식
    r2 = [g for g in view["games"] if g["round"] == 2]
    view = ok(
        admin.delete(
            f"{BASE}/{view['id']}/games/{r2[0]['no']}", params={"version": view["version"]}
        )
    )
    playing = {k for g in view["games"] if g["round"] == 2 for k in players(g)}
    free = [k for k in keys if k not in playing]  # 8명
    a, b = free[:4], free[4:8]

    def add(c: TestClient, four: list[str], version: int) -> Callable[[], Any]:
        body = {"team1": four[:2], "team2": four[2:], "round": 2, "version": version}
        return lambda: c.post(f"{BASE}/{view['id']}/games/manual", json=body)

    results = race(add(admin, a, view["version"]), add(admin2, b, view["version"]))
    assert sorted(r.status_code for r in results) == [200, 409]
    assert [code(r) for r in results if r.status_code == 409] == [(409, "conflict")]
    latest = ok(admin.get(f"{BASE}/{view['id']}"))
    assert latest["version"] == view["version"] + 1
    # 진 쪽이 최신 version으로 다시 보내면 빈 코트가 없어 court_full
    loser = b if any(r.status_code == 200 for r in results[:1]) else a
    res = add(admin2, loser, latest["version"])()
    assert code(res) == (422, "court_full")
    assert_round_rules(ok(admin.get(f"{BASE}/{view['id']}")))


@ac("AC-165")
def test_db_concurrent_swaps_into_same_round(
    admin: TestClient, admin2: TestClient, pg: Session, ac_tag: str
) -> None:
    view, keys = round_match(admin, pg, 10, 2, 3)  # 라운드마다 2명 휴식
    view = ok(admin.post(f"{BASE}/{view['id']}/confirm", json={"version": view["version"]}))
    r2 = [g for g in view["games"] if g["round"] == 2]
    resting = [k for k in keys if k not in {p for g in r2 for p in players(g)}]
    i = resting[0]

    def swap(c: TestClient, g: Any, version: int) -> Callable[[], Any]:
        body = {"from": players(g)[0], "to": i, "version": version}
        return lambda: c.post(f"{BASE}/{view['id']}/games/{g['no']}/swap", json=body)

    results = race(swap(admin, r2[0], view["version"]), swap(admin2, r2[1], view["version"]))
    assert sorted(r.status_code for r in results) == [200, 409]
    latest = ok(admin.get(f"{BASE}/{view['id']}"))
    winner = 0 if results[0].status_code == 200 else 1
    res = swap(admin2, r2[1 - winner], latest["version"])()
    assert code(res) == (422, "round_conflict")
    final = ok(admin.get(f"{BASE}/{view['id']}"))
    assert final["version"] == view["version"] + 1
    assert_round_rules(final)


@ac("AC-165")
def test_db_concurrent_move_and_add(
    admin: TestClient, admin2: TestClient, pg: Session, ac_tag: str
) -> None:
    view, keys = round_match(admin, pg, 12, 2, 3)
    r1 = [g for g in view["games"] if g["round"] == 1]
    view = ok(
        admin.delete(
            f"{BASE}/{view['id']}/games/{r1[0]['no']}", params={"version": view["version"]}
        )
    )
    freed = players(r1[0])
    # 3라운드 경기를 1라운드로 옮기기와 1라운드에 경기 추가를 동시에(같은 version)
    r3 = [g for g in view["games"] if g["round"] == 3]
    r1_keys = {k for x in view["games"] if x["round"] == 1 for k in players(x)}
    movable = next((g for g in r3 if not set(players(g)) & r1_keys), r3[0])
    mv = {"round": 1, "version": view["version"]}
    ad = {"team1": freed[:2], "team2": freed[2:], "round": 1, "version": view["version"]}
    results = race(
        lambda: admin.post(f"{BASE}/{view['id']}/games/{movable['no']}/move", json=mv),
        lambda: admin2.post(f"{BASE}/{view['id']}/games/manual", json=ad),
    )
    assert sum(1 for r in results if r.status_code == 200) <= 1
    assert all(
        r.status_code == 200 or code(r)[1] in {"conflict", "round_conflict"} for r in results
    )
    final = ok(admin.get(f"{BASE}/{view['id']}"))
    assert_round_rules(final)
    assert final["version"] <= view["version"] + 1


@ac("AC-165", "AC-155")
def test_db_concurrent_next_round_and_leave_vs_swap(
    admin: TestClient, admin2: TestClient, pg: Session, ac_tag: str
) -> None:
    view, keys = round_match(admin, pg, 10, 2, 3)
    view = ok(admin.post(f"{BASE}/{view['id']}/confirm", json={"version": view["version"]}))
    for g in [x for x in view["games"] if x["round"] == 1]:
        view = ok(
            admin.put(
                f"{BASE}/{view['id']}/games/{g['no']}/result",
                json={"winner": 1, "version": view["version"]},
            )
        )
    nxt = {"version": view["version"]}
    results = race(
        lambda: admin.post(f"{BASE}/{view['id']}/rounds/next", json=nxt),
        lambda: admin2.post(f"{BASE}/{view['id']}/rounds/next", json=nxt),
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    view = ok(admin.get(f"{BASE}/{view['id']}"))
    assert view["currentRound"] == 2
    # 중도 귀가(대체 I)와 다른 경기에 I를 넣는 교체를 동시에
    r2 = [g for g in view["games"] if g["round"] == 2]
    resting = [k for k in keys if k not in {p for g in r2 for p in players(g)}]
    leaver = players(r2[0])[0]
    remaining = [
        g
        for g in view["games"]
        if g["winner"] is None and not g["cancelled"] and leaver in players(g)
    ]
    picks = []
    for g in remaining:
        busy = {k for x in view["games"] if x["round"] == g["round"] for k in players(x)}
        picks.append({"gameNo": g["no"], "to": sorted(set(keys) - busy - {leaver})[0]})
    target = next(p["to"] for p in picks if p["gameNo"] == r2[0]["no"])
    assert target in resting
    leave = {"assignments": picks, "cancel": [], "version": view["version"]}
    swap = {"from": players(r2[1])[0], "to": target, "version": view["version"]}
    results = race(
        lambda: admin.post(f"{BASE}/{view['id']}/participants/{leaver}/leave", json=leave),
        lambda: admin2.post(f"{BASE}/{view['id']}/games/{r2[1]['no']}/swap", json=swap),
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    final = ok(admin.get(f"{BASE}/{view['id']}"))
    assert final["version"] == view["version"] + 1
    assert_round_rules(final)


@ac("AC-165")
def test_db_unique_round_court_constraint(admin: TestClient, pg: Session, ac_tag: str) -> None:
    view, _ = round_match(admin, pg, 8, 2, 2)
    mid = uuid.UUID(view["id"])
    games = pg.scalars(
        select(ClubMatchGame).where(ClubMatchGame.match_id == mid).order_by(ClubMatchGame.no)
    ).all()
    games[1].court_no = games[0].court_no
    games[1].round_no = games[0].round_no
    with pytest.raises(IntegrityError):
        pg.commit()
    pg.rollback()
    g = pg.scalars(select(ClubMatchGame).where(ClubMatchGame.match_id == mid)).first()
    assert g is not None
    g.winner = 1
    g.cancelled_at = datetime.now(UTC)
    with pytest.raises(IntegrityError):  # 결과와 취소 동시 금지
        pg.commit()
    pg.rollback()


@ac("AC-163")
def test_db_game_event_action_allows_only_cancel(
    admin: TestClient, pg: Session, ac_tag: str
) -> None:
    """(B18, 기획 r14) 이력은 취소만 남김: 마이그레이션 0011의 action 제약은 'cancel'만 허용."""
    view, _ = round_match(admin, pg, 8, 2, 2)
    mid = uuid.UUID(view["id"])
    g = pg.scalars(select(ClubMatchGame).where(ClubMatchGame.match_id == mid)).first()
    assert g is not None
    pg.add(ClubMatchGameEvent(match_id=mid, game_id=g.id, action="cancel", reason="left"))
    pg.commit()
    pg.add(ClubMatchGameEvent(match_id=mid, game_id=g.id, action="restore"))
    with pytest.raises(IntegrityError):
        pg.commit()
    pg.rollback()


# ── AC-160·161 취소·종료(PostgreSQL) ──


@ac("AC-160", "AC-161")
def test_db_cancel_and_finish(admin: TestClient, pg: Session, ac_tag: str) -> None:
    view, keys = round_match(admin, pg, 8, 2, 2)
    view = ok(admin.post(f"{BASE}/{view['id']}/confirm", json={"version": view["version"]}))
    for g in [x for x in view["games"] if x["round"] == 1]:
        view = ok(
            admin.put(
                f"{BASE}/{view['id']}/games/{g['no']}/result",
                json={"winner": 1, "version": view["version"]},
            )
        )
    view = ok(admin.post(f"{BASE}/{view['id']}/rounds/next", json={"version": view["version"]}))
    f = players([g for g in view["games"] if g["round"] == 2][0])[0]
    rem = [g["no"] for g in view["games"] if g["winner"] is None and f in players(g)]
    view = ok(
        admin.post(
            f"{BASE}/{view['id']}/participants/{f}/leave",
            json={"assignments": [], "cancel": rem, "version": view["version"]},
        )
    )
    for g in [x for x in view["games"] if x["round"] == 2 and not x["cancelled"]]:
        view = ok(
            admin.put(
                f"{BASE}/{view['id']}/games/{g['no']}/result",
                json={"winner": 2, "version": view["version"]},
            )
        )
    view = ok(admin.post(f"{BASE}/{view['id']}/finish", json={"version": view["version"]}))
    assert view["status"] == "finished"
    played = {s["key"]: s["games"] for s in view["standings"]}
    assert played[f] == 1  # 1라운드 1경기만(취소 경기 제외)


# ── AC-163 마이그레이션·기존 데이터 호환 ──


def _alembic() -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    return cfg


def _columns(table: str) -> set[str]:
    return {c["name"] for c in inspect(get_engine()).get_columns(table)}


@ac("AC-163")
def test_db_migration_0011_keeps_legacy_and_guards_downgrade(
    admin: TestClient, pg: Session, ac_tag: str
) -> None:
    assert os.environ.get("DATABASE_URL") == os.environ.get("TEST_DATABASE_URL")
    # 기존(라운드 정보 없는) 청백전: 확정된 X, 준비 중 Z
    keys = members(pg, 8)
    legacy = []
    for name, confirm in (("X", True), ("Z", False)):
        res = admin.post(
            BASE, json={"method": "individual", "date": "2026-11-26", "name": f"{TAG}{name}"}
        )
        v = ok(admin.get(f"{BASE}/{res.json()['id']}"))
        v = ok(
            admin.put(
                f"{BASE}/{v['id']}/participants", json={"keys": keys, "version": v["version"]}
            )
        )
        v = ok(
            admin.post(
                f"{BASE}/{v['id']}/games",
                json={"totalGames": 4, "rules": RULES, "version": v["version"]},
            )
        )
        if confirm:
            v = ok(admin.post(f"{BASE}/{v['id']}/confirm", json={"version": v["version"]}))
        legacy.append(v)

    def snapshot() -> list[tuple[Any, ...]]:
        with get_engine().connect() as conn:
            return [
                tuple(r)
                for r in conn.execute(
                    text(
                        "SELECT m.id, m.status, m.total_games, m.version, g.no, g.winner, g.manual"
                        " FROM club_matches m JOIN club_match_games g ON g.match_id = m.id"
                        " WHERE m.name LIKE :tag ORDER BY m.name, g.no"
                    ),
                    {"tag": f"{TAG}%"},
                )
            ]

    before = snapshot()
    assert before
    # 라운드 청백전이 있으면 downgrade 중단(데이터 보존)
    rv, _ = round_match(admin, pg, 8, 2, 2)
    with pytest.raises(RuntimeError, match="라운드 기반 청백전"):
        command.downgrade(_alembic(), "0010")
    assert "court_count" in _columns("club_matches")
    pg.execute(delete(ClubMatch).where(ClubMatch.id == uuid.UUID(rv["id"])))
    pg.commit()
    other_rounds = pg.scalar(
        select(ClubMatch.id).where(ClubMatch.court_count.is_not(None)).limit(1)
    )
    if other_rounds is not None:
        pytest.skip("다른 테스트가 남긴 라운드 청백전이 있어 downgrade를 건너뜀")
    pg.close()
    get_engine().dispose()
    command.downgrade(_alembic(), "0010")
    assert "court_count" not in _columns("club_matches")
    assert "round_no" not in _columns("club_match_games")
    assert "club_match_game_events" not in inspect(get_engine()).get_table_names()
    assert snapshot() == before
    command.upgrade(_alembic(), "head")
    get_engine().dispose()
    assert snapshot() == before
    # 기존 청백전은 새 열이 비어 있고 기존 방식 그대로
    x = ok(admin.get(f"{BASE}/{legacy[0]['id']}"))
    assert x["courtCount"] is None and x["currentRound"] is None
    assert all(g["round"] is None and g["cancelled"] is None for g in x["games"])
    ok(
        admin.put(
            f"{BASE}/{x['id']}/games/{x['games'][0]['no']}/result",
            json={"winner": 1, "version": x["version"]},
        )
    )
