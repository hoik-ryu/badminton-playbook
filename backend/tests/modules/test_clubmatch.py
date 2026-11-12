"""청백전 I3-a — 확정 전 단계 API(SCR-221–224).

AC 매핑: AC-042 만들기(대진 미확정) / AC-070 방식 변경 시 미확정 대진 폐기·팀 초기화 /
AC-072 팀 배정안(점수 합·성별 비율) / AC-013·014·105 게스트 삭제와 청백전(C-26, U5) /
C-19·U9 확정 전 조작도 version 충돌 감지 / U6 비활성 회원은 새 참가 불가·기록 유지 /
U3·U4 순위(공동 순위, 같은 승수 안 승률→이름) / NFR-005 운영진 이상만
대진 생성·확정·결과·교체·종료(I3-b·I3-c)는 여기서 다루지 않습니다.
"""

import uuid
from collections.abc import Callable
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clubmatch import schedule
from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGamePlayer,
    ClubMatchParticipant,
)
from app.modules.roster.models import Guest, MemberRating
from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user

Factory = Callable[[], TestClient]
BASE = "/api/club-matches"


@pytest.fixture
def admin(make_client: Factory, db: Session) -> TestClient:
    c = make_client()
    make_user(db, name="운영진", role="admin", kakao_id="9001")
    kakao_login(c, "9001")
    return c


def member(db: Session, name: str, gender: str = "남", score: int | None = None, **kw: str) -> User:
    user = make_user(db, name=name, gender=gender, **kw)
    if score is not None:
        db.add(MemberRating(user_id=user.id, score=score))
        db.commit()
    return user


def guest(db: Session, name: str, gender: str = "여", score: int | None = None) -> Guest:
    g = Guest(name=name, gender=gender, grade="초심", score=score)
    db.add(g)
    db.commit()
    return g


def mkey(u: User) -> str:
    return f"member:{u.id}"


def gkey(g: Guest) -> str:
    return f"guest:{g.id}"


def create(c: TestClient, method: str = "individual", name: str = "11월 청백전") -> dict:  # type: ignore[type-arg]
    res = c.post(BASE, json={"method": method, "date": "2026-11-15", "name": name})
    assert res.status_code == 201, res.text
    return c.get(f"{BASE}/{res.json()['id']}").json()  # type: ignore[no-any-return]


def join(c: TestClient, view: dict, key: str, on: bool = True) -> dict:  # type: ignore[type-arg]
    res = c.put(
        f"{BASE}/{view['id']}/participants/{key}",
        json={"participating": on, "version": view["version"]},
    )
    assert res.status_code == 200, res.text
    return res.json()  # type: ignore[no-any-return]


def assign(c: TestClient, view: dict, key: str, team: str | None) -> dict:  # type: ignore[type-arg]
    res = c.put(f"{BASE}/{view['id']}/teams/{key}", json={"team": team, "version": view["version"]})
    assert res.status_code == 200, res.text
    return res.json()  # type: ignore[no-any-return]


def add_game(
    db: Session, match_id: str, no: int, keys: list[str], winner: int | None = None
) -> None:
    """대진 생성(I3-b) 전이라 경기를 직접 넣음: keys = [1팀 2명, 2팀 2명]."""
    mid = uuid.UUID(match_id)
    parts = db.scalars(
        select(ClubMatchParticipant).where(ClubMatchParticipant.match_id == mid)
    ).all()
    by_key = {(f"member:{p.user_id}" if p.user_id else f"guest:{p.guest_id}"): p.id for p in parts}
    game = ClubMatchGame(match_id=mid, no=no, winner=winner)
    db.add(game)
    db.flush()
    for i, k in enumerate(keys):
        db.add(
            ClubMatchGamePlayer(
                game_id=game.id, side=1 + i // 2, slot=1 + i % 2, participant_id=by_key[k]
            )
        )
    db.commit()


def set_status(db: Session, match_id: str, status: str) -> None:
    m = db.get(ClubMatch, uuid.UUID(match_id))
    assert m is not None
    m.status = status
    db.commit()


# ── 만들기·조회 ──


def test_ac_042_create_draft_and_list(admin: TestClient, db: Session) -> None:
    a = member(db, "가회원", score=5)
    view = create(admin)
    assert (view["status"], view["method"], view["version"]) == ("draft", "individual", 1)
    assert view["games"] == [] and view["totalGames"] == 8
    assert view["rules"] == {"balance": True, "gender": True} and view["teamProposed"] is False
    row = next(r for r in view["rows"] if r["key"] == mkey(a))
    assert (row["participating"], row["score"], row["kind"]) == (False, 5, "member")
    items = admin.get(BASE).json()
    assert items[0]["id"] == view["id"] and items[0]["status"] == "draft"
    assert items[0]["team"] is None and items[0]["winnerText"] is None
    bad = admin.post(BASE, json={"method": "individual", "date": "2026-11-15", "name": "  "})
    assert bad.status_code == 422
    assert (
        admin.post(BASE, json={"method": "x", "date": "2026-11-15", "name": "a"}).status_code == 422
    )


def test_list_newest_first(admin: TestClient) -> None:
    admin.post(BASE, json={"method": "team", "date": "2026-11-01", "name": "이전"})
    admin.post(BASE, json={"method": "team", "date": "2026-11-20", "name": "다음"})
    assert [x["name"] for x in admin.get(BASE).json()] == ["다음", "이전"]


def test_not_found_and_bad_key(admin: TestClient) -> None:
    assert admin.get(f"{BASE}/{uuid.uuid4()}").json()["error"]["code"] == "not_found"
    view = create(admin)
    res = admin.put(
        f"{BASE}/{view['id']}/participants/member:nope",
        json={"participating": True, "version": view["version"]},
    )
    assert res.status_code == 404


# ── 권한(NFR-005) ──


def test_permissions_admin_only(make_client: Factory, db: Session, admin: TestClient) -> None:
    view = create(admin)
    anon = make_client()
    assert anon.get(BASE).status_code == 401
    m = make_client()
    make_user(db, name="일반회원", kakao_id="9002")
    kakao_login(m, "9002")
    assert m.get(BASE).json()["error"]["code"] == "forbidden"
    assert m.get(f"{BASE}/{view['id']}").status_code == 403
    assert (
        m.post(BASE, json={"method": "team", "date": "2026-11-15", "name": "x"}).status_code == 403
    )
    res = m.put(
        f"{BASE}/{view['id']}/settings",
        json={"totalGames": 3, "rules": {"balance": True, "gender": True}, "version": 1},
    )
    assert res.status_code == 403
    no_origin = admin.post(
        BASE, json={"method": "team", "date": "2026-11-15", "name": "x"}, headers={"Origin": ""}
    )
    assert no_origin.status_code == 403  # CSRF


# ── 참가자·설정 ──


def test_participants_summary_and_preview(admin: TestClient, db: Session) -> None:
    people = [member(db, f"남{i}", "남", score=5) for i in range(4)]
    women = [member(db, f"여{i}", "여") for i in range(2)]
    view = create(admin)
    for u in people + women:
        view = join(admin, view, mkey(u))
    assert view["version"] == 7  # 변경마다 +1
    s = view["summary"]
    assert (s["count"], s["male"], s["female"]) == (6, 4, 2)
    assert sorted(p["name"] for p in s["unscored"]) == ["여0", "여1"]  # 점수 미설정 안내(C-24)
    # 6명 × 8경기 = 32자리 → 2명 6경기, 4명 5경기
    assert view["preview"]["groups"] == [{"games": 6, "people": 2}, {"games": 5, "people": 4}]
    assert view["preview"]["even"] is False
    assert [p["totalGames"] for p in view["preview"]["proposals"]] == [6, 9]
    view = join(admin, view, mkey(women[0]), on=False)
    assert view["summary"]["count"] == 5
    res = admin.put(
        f"{BASE}/{view['id']}/settings",
        json={
            "totalGames": 5,
            "rules": {"balance": False, "gender": True},
            "version": view["version"],
        },
    )
    after = res.json()
    assert (after["totalGames"], after["rules"]["balance"]) == (5, False)
    assert after["preview"]["even"] is True  # 5명 × 5경기 = 20자리 → 모두 4경기
    for bad in (0, 201):
        r = admin.put(
            f"{BASE}/{view['id']}/settings",
            json={
                "totalGames": bad,
                "rules": {"balance": True, "gender": True},
                "version": after["version"],
            },
        )
        assert r.status_code == 422


def test_u6_inactive_member_excluded_but_record_kept(admin: TestClient, db: Session) -> None:
    a, b, c, d = (member(db, n, score=5) for n in ("가", "나", "다", "라"))
    gone = member(db, "휴면", status="inactive")
    view = create(admin)
    assert all(r["key"] != mkey(gone) for r in view["rows"])  # 후보에 없음
    res = admin.put(
        f"{BASE}/{view['id']}/participants/{mkey(gone)}",
        json={"participating": True, "version": view["version"]},
    )
    assert res.json()["error"]["code"] == "not_eligible"
    for u in (a, b, c, d):
        view = join(admin, view, mkey(u))
    add_game(db, view["id"], 1, [mkey(a), mkey(b), mkey(c), mkey(d)], winner=1)
    a_row = db.get(User, a.id)
    assert a_row is not None
    a_row.status = "inactive"
    db.commit()
    view = admin.get(f"{BASE}/{view['id']}").json()
    row = next(r for r in view["rows"] if r["key"] == mkey(a))
    assert (row["participating"], row["games"]) == (True, 1)  # 이미 참가한 기록은 유지
    top = next(s for s in view["standings"] if s["key"] == mkey(a))
    assert (top["wins"], top["rank"]) == (1, 1)


def test_in_games_participant_cannot_be_removed(admin: TestClient, db: Session) -> None:
    us = [member(db, n) for n in ("가", "나", "다", "라")]
    view = create(admin)
    for u in us:
        view = join(admin, view, mkey(u))
    add_game(db, view["id"], 1, [mkey(u) for u in us])
    view = admin.get(f"{BASE}/{view['id']}").json()
    res = admin.put(
        f"{BASE}/{view['id']}/participants/{mkey(us[0])}",
        json={"participating": False, "version": view["version"]},
    )
    assert (res.status_code, res.json()["error"]["code"]) == (409, "in_games")
    assert admin.get(f"{BASE}/{view['id']}").json()["version"] == view["version"]  # 그대로


# ── 방식·팀(AC-070·072) ──


def test_ac_070_method_change_discards_games_and_teams(admin: TestClient, db: Session) -> None:
    us = [member(db, n) for n in ("가", "나", "다", "라")]
    view = create(admin, method="team")
    for u, t in zip(us, ("blue", "blue", "white", "white"), strict=True):
        view = assign(admin, view, mkey(u), t)
    add_game(db, view["id"], 1, [mkey(u) for u in us])
    view = admin.get(f"{BASE}/{view['id']}").json()
    assert len(view["games"]) == 1
    res = admin.put(
        f"{BASE}/{view['id']}/method", json={"method": "individual", "version": view["version"]}
    )
    after = res.json()
    assert after["method"] == "individual" and after["games"] == []
    assert all(r["team"] is None for r in after["rows"])
    assert sum(r["participating"] for r in after["rows"]) == 4  # 참가자는 유지


def test_team_assign_and_unassign(admin: TestClient, db: Session) -> None:
    a = member(db, "가")
    view = create(admin, method="team")
    view = assign(admin, view, mkey(a), "blue")
    assert view["summary"]["blue"] == {"n": 1, "male": 1}
    view = assign(admin, view, mkey(a), "white")
    assert view["summary"]["white"]["n"] == 1 and view["summary"]["blue"]["n"] == 0
    view = assign(admin, view, mkey(a), None)
    assert view["summary"]["count"] == 0
    assert not next(r for r in view["rows"] if r["key"] == mkey(a))["participating"]


def test_ac_072_team_proposal_balances_score_and_gender(admin: TestClient, db: Session) -> None:
    men = [member(db, f"남{s}", "남", score=s) for s in (9, 7, 5, 3)]
    women = [member(db, f"여{s}", "여", score=s) for s in (8, 4)]
    view = create(admin, method="team")
    for u in men + women:
        view = assign(admin, view, mkey(u), "blue")  # 일단 모두 청
    res = admin.post(f"{BASE}/{view['id']}/teams/propose", json={"version": view["version"]})
    after = res.json()
    assert after["teamProposed"] is True
    s = after["summary"]
    assert (s["blue"]["n"], s["white"]["n"]) == (3, 3)
    assert (s["blue"]["male"], s["white"]["male"]) == (2, 2)
    sums = {"blue": 0, "white": 0}
    for r in after["rows"]:
        if r["team"]:
            sums[r["team"]] += r["score"]
    # 성별마다 점수순 지그재그(인원 적은 쪽 → 점수 합 작은 쪽): 남 9·3 + 여 8 / 남 7·5 + 여 4
    assert sums == {"blue": 20, "white": 16}
    indiv = create(admin, method="individual", name="개인전")
    res = admin.post(f"{BASE}/{indiv['id']}/teams/propose", json={"version": indiv["version"]})
    assert res.json()["error"]["code"] == "locked"


# ── 동시 조작·확정 후 잠금(C-19, U9) ──


def test_u9_stale_version_conflicts_on_every_draft_change(admin: TestClient, db: Session) -> None:
    a = member(db, "가")
    view = create(admin, method="team")
    stale = view["version"]
    fresh = assign(admin, view, mkey(a), "blue")
    rules = {"balance": True, "gender": True}
    calls: list[tuple[str, str, dict[str, object]]] = [
        ("put", f"{BASE}/{view['id']}/method", {"method": "individual"}),
        ("put", f"{BASE}/{view['id']}/settings", {"totalGames": 3, "rules": rules}),
        ("put", f"{BASE}/{view['id']}/participants/{mkey(a)}", {"participating": False}),
        ("put", f"{BASE}/{view['id']}/teams/{mkey(a)}", {"team": "white"}),
        ("post", f"{BASE}/{view['id']}/teams/propose", {}),
    ]
    for verb, url, body in calls:
        res = getattr(admin, verb)(url, json={**body, "version": stale})
        assert (res.status_code, res.json()["error"]["code"]) == (409, "conflict"), url
        assert res.json()["error"]["details"] == {"version": fresh["version"]}
    now = admin.get(f"{BASE}/{view['id']}").json()
    assert now["version"] == fresh["version"] and now["totalGames"] == 8  # 아무것도 안 바뀜
    assert admin.put(f"{BASE}/{view['id']}/method", json={"method": "team"}).status_code == 422


def test_changes_locked_after_confirm(admin: TestClient, db: Session) -> None:
    a = member(db, "가")
    view = create(admin)
    set_status(db, view["id"], "confirmed")
    v = view["version"]
    rules = {"balance": True, "gender": True}
    for url, body in (
        (f"{BASE}/{view['id']}/method", {"method": "team"}),
        (f"{BASE}/{view['id']}/settings", {"totalGames": 3, "rules": rules}),
        (f"{BASE}/{view['id']}/participants/{mkey(a)}", {"participating": True}),
        (f"{BASE}/{view['id']}/teams/{mkey(a)}", {"team": "blue"}),
    ):
        res = admin.put(url, json={**body, "version": v})
        assert (res.status_code, res.json()["error"]["code"]) == (409, "locked"), url


# ── 게스트 참조·비식별화(AC-013, C-26, U5) ──


def test_deleted_guest_shown_anonymized_in_finished_match(admin: TestClient, db: Session) -> None:
    a, b, c = (member(db, n) for n in ("가", "나", "다"))
    g = guest(db, "손님", score=4)
    view = create(admin)
    for k in (mkey(a), mkey(b), mkey(c), gkey(g)):
        view = join(admin, view, k)
    add_game(db, view["id"], 1, [mkey(a), gkey(g), mkey(b), mkey(c)], winner=1)
    set_status(db, view["id"], "finished")
    assert admin.delete(f"/api/roster/guests/{g.id}").status_code == 204
    after = admin.get(f"{BASE}/{view['id']}").json()
    row = next(r for r in after["rows"] if r["key"] == gkey(g))
    assert (row["name"], row["grade"], row["participating"], row["games"]) == (
        "삭제된 게스트",
        None,
        True,
        1,
    )
    assert after["games"][0]["team1"][1]["name"] == "삭제된 게스트"
    st = next(s for s in after["standings"] if s["key"] == gkey(g))
    assert (st["name"], st["guest"], st["wins"]) == ("삭제된 게스트", True, 1)
    stored = db.scalars(
        select(ClubMatchParticipant).where(ClubMatchParticipant.guest_id == g.id)
    ).one()
    assert stored is not None  # 참조 유지
    new = create(admin, name="다음")
    assert all(r["key"] != gkey(g) for r in new["rows"])  # 새 청백전 후보에서 빠짐
    res = admin.put(
        f"{BASE}/{new['id']}/participants/{gkey(g)}",
        json={"participating": True, "version": new["version"]},
    )
    assert res.json()["error"]["code"] == "not_eligible"


def test_guest_delete_blocked_by_confirmed_unrecorded_game(admin: TestClient, db: Session) -> None:
    a, b, c = (member(db, n) for n in ("가", "나", "다"))
    g = guest(db, "손님")
    view = create(admin, name="확정전")
    for k in (mkey(a), mkey(b), mkey(c), gkey(g)):
        view = join(admin, view, k)
    add_game(db, view["id"], 1, [mkey(a), gkey(g), mkey(b), mkey(c)])
    set_status(db, view["id"], "confirmed")
    info = admin.get(f"/api/roster/guests/{g.id}/delete-info").json()
    assert info == {
        "kind": "confirmedMatch",
        "matchId": view["id"],
        "matchName": "확정전",
        "remaining": 1,
    }
    res = admin.delete(f"/api/roster/guests/{g.id}")
    assert (res.status_code, res.json()["error"]["code"]) == (409, "guest_delete_blocked")
    kept = db.get(Guest, g.id)
    db.refresh(kept)
    assert kept is not None and kept.deleted_at is None and kept.name == "손님"


def test_guest_delete_cleans_draft_lineup_and_participants(admin: TestClient, db: Session) -> None:
    a, b, c = (member(db, n) for n in ("가", "나", "다"))
    g = guest(db, "손님")
    lineup = create(admin, name="대진있음")
    for k in (mkey(a), mkey(b), mkey(c), gkey(g)):
        lineup = join(admin, lineup, k)
    add_game(db, lineup["id"], 1, [mkey(a), gkey(g), mkey(b), mkey(c)])
    only = join(admin, create(admin, name="참가만"), gkey(g))
    info = admin.get(f"/api/roster/guests/{g.id}/delete-info").json()
    assert info == {"kind": "draftLineup", "place": "대진있음"}
    assert admin.delete(f"/api/roster/guests/{g.id}").status_code == 204
    v1 = admin.get(f"{BASE}/{lineup['id']}").json()
    assert v1["games"] == [] and v1["summary"]["count"] == 3  # 대진 폐기·게스트만 빠짐
    assert v1["version"] == lineup["version"] + 1  # 다른 운영진 화면은 충돌로 감지
    v2 = admin.get(f"{BASE}/{only['id']}").json()
    assert v2["summary"]["count"] == 0 and v2["version"] == only["version"] + 1


def test_guest_delete_info_participant_only(admin: TestClient, db: Session) -> None:
    g = guest(db, "손님")
    join(admin, create(admin, name="참가만"), gkey(g))
    info = admin.get(f"/api/roster/guests/{g.id}/delete-info").json()
    assert info == {"kind": "participantOnly", "matchName": "참가만"}


# ── 집계(U3·U4) ──


def test_u3_u4_standings_shared_rank_and_order() -> None:
    gr = schedule.GameResult
    games = [
        gr(("가", "나"), ("다", "라"), 1),
        gr(("다", "마"), ("가", "라"), 1),
        gr(("나", "마"), ("다", "가"), None),  # 미기록: 경기 수에는 들어감
    ]
    names = {"가": "가", "나": "나", "다": "다", "라": "라", "마": "마"}
    rows = schedule.standings(games, ["가", "나", "다", "라", "마"], names)
    # 승수: 가1 나1 다1 마1 라0. 같은 승수 안 승률: 나 1/2, 마 1/2, 가 1/3, 다 1/3 → 이름순
    assert [(r["key"], r["rank"], r["tied"]) for r in rows] == [
        ("나", 1, True),
        ("마", 1, True),
        ("가", 1, True),
        ("다", 1, True),
        ("라", 5, False),
    ]
    two = schedule.standings(
        [gr(("a", "b"), ("c", "d"), 1), gr(("a", "c"), ("b", "d"), 1)],
        ["a", "b", "c", "d"],
        {},
    )
    assert [(r["key"], r["rank"]) for r in two] == [("a", 1), ("b", 2), ("c", 2), ("d", 4)]


def test_team_score_and_gap() -> None:
    gr = schedule.GameResult
    assert schedule.team_score(
        [gr(("a", "b"), ("c", "d"), 1), gr(("a", "b"), ("c", "d"), None)]
    ) == {
        "blue": 1,
        "white": 0,
    }
    assert schedule.gap([5, 3], [4, 4]) == 0
    assert schedule.gap([5, None], [4, 4]) is None


def test_list_shows_team_score_and_winner_text(admin: TestClient, db: Session) -> None:
    us = [member(db, n) for n in ("가", "나", "다", "라")]
    view = create(admin, method="team", name="팀전")
    for u, t in zip(us, ("blue", "blue", "white", "white"), strict=True):
        view = assign(admin, view, mkey(u), t)
    add_game(db, view["id"], 1, [mkey(u) for u in us], winner=2)
    set_status(db, view["id"], "finished")
    item = next(x for x in admin.get(BASE).json() if x["id"] == view["id"])
    assert item["team"] == {"blue": 0, "white": 1}
    assert item["winnerText"] == "백팀 승리 (0 : 1)"
    assert date.fromisoformat(item["date"]) == date(2026, 11, 15)
