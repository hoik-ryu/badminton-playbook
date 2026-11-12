"""회원용 청백전 API·내 전적·랭크(I3-d2) — 정보 노출 계약 테스트.

AC 매핑: AC-066·068(회원 응답에 운영 정보 없음) / AC-069(미확정·없는 청백전 같은 404) /
AC-017(1–10 점수 비공개) / AC-045·046(랭크 10경기·70·55·40%) / AC-053(내 전적) /
AC-078(대체 선수는 실제로 뛴 사람) / AC-088·U10·P-10(대진 수정·결과 수정 표시) /
S-1(청백전 범위 키, 내부 UUID 비노출) / 릴리스 기준 3(허용 목록·OpenAPI 계약)
"""

import json
import re
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.clubmatch.record import rank_for
from app.modules.roster.models import Guest, MemberRating
from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user

Factory = Callable[[], TestClient]
ADMIN = "/api/club-matches"
MEMBER = "/api/member/club-matches"

# 허용 목록(응답 JSON의 모든 키, 중첩 포함)
LIST_KEYS = {
    "id",
    "name",
    "date",
    "method",
    "status",
    "team",
    "blue",
    "white",
    "games",
    "participants",
    "unrecorded",
    "resultText",
}
DETAIL_KEYS = {
    "id",
    "name",
    "date",
    "method",
    "status",
    "modifiedAt",
    "resultModifiedAt",
    "games",
    "standings",
    "team",
    "blue",
    "white",
    "unrecorded",
    "participating",
    # MemberGame
    "no",
    "team1",
    "team2",
    "winner",
    "changed",
    "resultChanged",
    "mySide",
    # MemberPlayer·MemberStanding
    "key",
    "guest",
    "me",
    "wins",
    "rank",
    "tied",
}
RECORD_KEYS = {"rank", "gamesToRank", "games", "wins", "losses", "rate"}
# 어디에도 있으면 안 되는 이름(운영 정보·내부 식별자)
FORBIDDEN = {
    "score",
    "scores",
    "grade",
    "gender",
    "gap",
    "relaxations",
    "genderRelaxed",
    "repeatedMatchup",
    "manual",
    "version",
    "rules",
    "seed",
    "totalGames",
    "teamProposed",
    "rows",
    "summary",
    "preview",
    "unscored",
    "referrer",
    "recommended",
    "tutorial",
    "kind",
    "user_id",
    "userId",
    "guest_id",
    "guestId",
    "recordedBy",
    "recorded_by_id",
    "rating",
}


def all_keys(value: Any) -> Iterator[str]:
    if isinstance(value, dict):
        for k, v in value.items():
            yield k
            yield from all_keys(v)
    elif isinstance(value, list):
        for v in value:
            yield from all_keys(v)


@pytest.fixture
def admin(make_client: Factory, db: Session) -> TestClient:
    c = make_client()
    make_user(db, name="운영진", role="admin", kakao_id="9301")
    kakao_login(c, "9301")
    return c


@pytest.fixture
def setup(admin: TestClient, make_client: Factory, db: Session) -> dict[str, Any]:
    """확정 청백전 1개(회원 '나' + 다른 회원 2 + 게스트 1, 2경기 중 1경기 기록) + 확정 전 1개."""
    me = make_user(db, name="나회원", kakao_id="9302", gender="여")
    others = [make_user(db, name=f"다른{i}", gender="남") for i in range(2)]
    guest = Guest(name="손님", gender="여", grade="초심", score=7)
    db.add(guest)
    for u, s in zip([me, *others], [3, 8, 9], strict=True):
        db.add(MemberRating(user_id=u.id, score=s))
    db.commit()
    keys = [f"member:{me.id}", *(f"member:{u.id}" for u in others), f"guest:{guest.id}"]

    def build(name: str, confirm: bool) -> Any:
        res = admin.post(ADMIN, json={"method": "individual", "date": "2026-11-15", "name": name})
        view = admin.get(f"{ADMIN}/{res.json()['id']}").json()
        for k in keys:
            body = {"participating": True, "version": view["version"]}
            view = admin.put(f"{ADMIN}/{view['id']}/participants/{k}", json=body).json()
        body = {
            "totalGames": 2,
            "rules": {"balance": True, "gender": True},
            "version": view["version"],
        }
        view = admin.put(f"{ADMIN}/{view['id']}/settings", json=body).json()
        view = admin.post(f"{ADMIN}/{view['id']}/games", json={"version": view["version"]}).json()
        if confirm:
            view = admin.post(
                f"{ADMIN}/{view['id']}/confirm", json={"version": view["version"]}
            ).json()
            res = admin.put(
                f"{ADMIN}/{view['id']}/games/1/result",
                json={"winner": 1, "version": view["version"]},
            )
            view = res.json()
        return view

    confirmed = build("공개 청백전", True)
    draft = build("비공개 초안", False)
    client = make_client()
    kakao_login(client, "9302")
    return {
        "member": client,
        "me": me,
        "others": others,
        "guest": guest,
        "confirmed": confirmed,
        "draft": draft,
    }


# ── 허용 목록·금지 필드(AC-066·068, 릴리스 기준 3) ──


def test_ac_066_list_and_detail_keys_within_allowlist(setup: dict[str, Any]) -> None:
    c: TestClient = setup["member"]
    items = c.get(MEMBER).json()
    assert [i["name"] for i in items] == ["공개 청백전"]  # 확정 전은 목록에도 없음(AC-069)
    assert set(all_keys(items)) <= LIST_KEYS
    detail = c.get(f"{MEMBER}/{setup['confirmed']['id']}").json()
    assert set(all_keys(detail)) <= DETAIL_KEYS
    assert not set(all_keys(detail)) & FORBIDDEN
    assert not set(all_keys(items)) & FORBIDDEN


def test_s1_no_internal_uuid_in_member_responses(setup: dict[str, Any]) -> None:
    """내부 회원·게스트 UUID와 member:/guest: 키가 어디에도 없음. 키는 청백전 범위 p:<참가자 id>."""
    c: TestClient = setup["member"]
    detail = c.get(f"{MEMBER}/{setup['confirmed']['id']}").json()
    text = json.dumps(detail, ensure_ascii=False) + json.dumps(c.get(MEMBER).json())
    ids = [setup["me"].id, *(u.id for u in setup["others"]), setup["guest"].id]
    for pid in ids:
        assert str(pid) not in text
    assert "member:" not in text and "guest:" not in text
    keys = {p["key"] for g in detail["games"] for p in g["team1"] + g["team2"]}
    assert keys and all(re.fullmatch(r"p:[0-9a-f-]{36}", k) for k in keys)
    assert {s["key"] for s in detail["standings"]} >= keys


def test_s1_keys_differ_between_matches_for_same_person(
    setup: dict[str, Any], admin: TestClient
) -> None:
    c: TestClient = setup["member"]
    view = setup["draft"]
    admin.post(f"{ADMIN}/{view['id']}/confirm", json={"version": view["version"]})
    a = c.get(f"{MEMBER}/{setup['confirmed']['id']}").json()
    b = c.get(f"{MEMBER}/{view['id']}").json()

    def mine(d: Any) -> str:
        return str(next(s["key"] for s in d["standings"] if s["me"]))

    assert mine(a) != mine(b)
    assert mine(a) == mine(c.get(f"{MEMBER}/{setup['confirmed']['id']}").json())  # 안정적


def test_ac_068_no_scores_even_as_values(setup: dict[str, Any]) -> None:
    """키 이름뿐 아니라 값으로도 점수 합·실력차가 새지 않음(개인 점수 3·8·9·7)."""
    c: TestClient = setup["member"]
    detail = c.get(f"{MEMBER}/{setup['confirmed']['id']}").json()
    for g in detail["games"]:
        assert set(g) == {"no", "team1", "team2", "winner", "changed", "resultChanged", "mySide"}
        for p in g["team1"] + g["team2"]:
            assert set(p) == {"key", "name", "guest", "me"}


def openapi_names(schema: dict[str, Any], node: Any, seen: set[str]) -> Iterator[str]:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            name = ref.rsplit("/", 1)[-1]
            if name not in seen:
                seen.add(name)
                yield from openapi_names(schema, schema["components"]["schemas"][name], seen)
        for k, v in node.items():
            if k == "properties" and isinstance(v, dict):
                yield from v.keys()
            yield from openapi_names(schema, v, seen)
    elif isinstance(node, list):
        for v in node:
            yield from openapi_names(schema, v, seen)


def test_openapi_member_response_schemas_have_no_forbidden_fields(admin: TestClient) -> None:
    schema = admin.app.openapi()  # type: ignore[attr-defined]
    paths = {
        p: v for p, v in schema["paths"].items() if p.startswith(MEMBER) or p == "/api/me/record"
    }
    assert set(paths) == {MEMBER, f"{MEMBER}/{{match_id}}", "/api/me/record"}
    for path, ops in paths.items():
        assert set(ops) == {"get"}, path  # 회원 경로는 조회만
        ok = ops["get"]["responses"]["200"]
        names = set(openapi_names(schema, ok, set()))
        assert names, path
        assert not names & FORBIDDEN, (path, names & FORBIDDEN)
        allowed = RECORD_KEYS if path == "/api/me/record" else LIST_KEYS | DETAIL_KEYS
        assert names <= allowed, (path, names - allowed)


# ── 404 동일(AC-069)·권한 ──


def test_ac_069_draft_missing_and_invalid_ids_same_404(setup: dict[str, Any]) -> None:
    c: TestClient = setup["member"]
    responses = [
        c.get(f"{MEMBER}/{setup['draft']['id']}"),
        c.get(f"{MEMBER}/{uuid.uuid4()}"),
        c.get(f"{MEMBER}/not-a-uuid"),
    ]
    assert {r.status_code for r in responses} == {404}
    bodies = [r.json() for r in responses]
    assert bodies[0] == bodies[1] == bodies[2]
    assert bodies[0]["error"]["code"] == "club_match_not_found"


def test_pending_and_inactive_users_forbidden(make_client: Factory, db: Session) -> None:
    for i, status in enumerate(["pending", "rejected", "inactive"]):
        make_user(db, name=f"제한{i}", status=status, kakao_id=f"94{i}")
        c = make_client()
        kakao_login(c, f"94{i}")
        for path in (MEMBER, "/api/me/record"):
            assert c.get(path).status_code == 403, (status, path)


def test_member_cannot_use_admin_routes(setup: dict[str, Any]) -> None:
    c: TestClient = setup["member"]
    assert c.get(ADMIN).status_code == 403
    assert c.get(f"{ADMIN}/{setup['confirmed']['id']}").status_code == 403


def test_member_routes_are_read_only(setup: dict[str, Any]) -> None:
    c: TestClient = setup["member"]
    mid = setup["confirmed"]["id"]
    for method in ("post", "put", "delete", "patch"):
        assert getattr(c, method)(f"{MEMBER}/{mid}").status_code == 405


# ── 내용(나 표시·순위·수정 표시) ──


def test_me_flags_and_standings(setup: dict[str, Any]) -> None:
    c: TestClient = setup["member"]
    admin_view = setup["confirmed"]
    detail = c.get(f"{MEMBER}/{admin_view['id']}").json()
    assert detail["status"] == "confirmed" and detail["unrecorded"] == 1
    mine = [s for s in detail["standings"] if s["me"]]
    assert len(mine) == 1 and mine[0]["name"] == "나회원"
    my_key = f"member:{setup['me'].id}"
    for ag, mg in zip(admin_view["games"], detail["games"], strict=True):
        in1 = my_key in [p["key"] for p in ag["team1"]]
        in2 = my_key in [p["key"] for p in ag["team2"]]
        assert mg["mySide"] == (1 if in1 else 2 if in2 else None)
        assert [p["name"] for p in mg["team1"]] == [p["name"] for p in ag["team1"]]
        assert mg["winner"] == ag["winner"]
    assert detail["participating"] is any(g["mySide"] for g in detail["games"])
    # 순위 숫자·승수는 운영진 화면과 같음(키만 다름)
    by_name = {s["name"]: (s["wins"], s["games"], s["rank"]) for s in admin_view["standings"]}
    assert {s["name"]: (s["wins"], s["games"], s["rank"]) for s in detail["standings"]} == by_name
    guest = next(s for s in detail["standings"] if s["name"] == "손님")
    assert guest["guest"] is True


def test_deleted_guest_and_inactive_member_display(
    setup: dict[str, Any], admin: TestClient, db: Session
) -> None:
    c: TestClient = setup["member"]
    view = setup["confirmed"]
    # 게스트가 남은 미기록 경기에 있으면 삭제가 막히므로(C-26) 모두 기록 후 종료
    for g in view["games"]:
        if g["winner"] is None:
            body = {"winner": 2, "version": view["version"]}
            view = admin.put(f"{ADMIN}/{view['id']}/games/{g['no']}/result", json=body).json()
    view = admin.post(f"{ADMIN}/{view['id']}/finish", json={"version": view["version"]}).json()
    assert admin.delete(f"/api/roster/guests/{setup['guest'].id}").status_code == 204
    other: User = setup["others"][0]
    other.status = "inactive"
    db.commit()
    detail = c.get(f"{MEMBER}/{view['id']}").json()
    names = {s["name"] for s in detail["standings"]}
    assert "삭제된 게스트" in names and "손님" not in names
    assert "다른0" in names  # 비활성 회원도 지난 기록에 이름 유지
    assert "손님" not in json.dumps(detail, ensure_ascii=False)


def test_p10_member_sees_lineup_and_result_edits_separately(
    setup: dict[str, Any], admin: TestClient
) -> None:
    c: TestClient = setup["member"]
    view = setup["confirmed"]
    before = c.get(f"{MEMBER}/{view['id']}").json()
    assert before["modifiedAt"] is None and before["resultModifiedAt"] is None
    view = admin.put(
        f"{ADMIN}/{view['id']}/games/2/result", json={"winner": 2, "version": view["version"]}
    ).json()
    view = admin.post(f"{ADMIN}/{view['id']}/finish", json={"version": view["version"]}).json()
    view = admin.put(
        f"{ADMIN}/{view['id']}/games/1/result", json={"winner": 2, "version": view["version"]}
    ).json()
    after = c.get(f"{MEMBER}/{view['id']}").json()
    assert after["status"] == "finished"
    assert after["modifiedAt"] is None and after["resultModifiedAt"] is not None
    assert [(g["changed"], g["resultChanged"]) for g in after["games"]] == [
        (False, True),
        (False, False),
    ]
    items = c.get(MEMBER).json()
    assert items[0]["resultText"] is not None and items[0]["unrecorded"] == 0


# ── 내 전적·랭크(AC-045·046·053) ──


def test_ac_053_my_record_is_mine_only(setup: dict[str, Any], admin: TestClient) -> None:
    c: TestClient = setup["member"]
    view = setup["confirmed"]
    my_key = f"member:{setup['me'].id}"
    g1 = view["games"][0]
    side = (
        1
        if my_key in [p["key"] for p in g1["team1"]]
        else 2
        if my_key in [p["key"] for p in g1["team2"]]
        else 0
    )
    rec = c.get("/api/me/record").json()
    assert set(rec) == RECORD_KEYS
    assert rec["games"] == (1 if side else 0)
    assert rec["wins"] == (1 if side == 1 else 0)
    assert rec["rank"] is None and rec["gamesToRank"] == 10 - rec["games"]
    # 운영진 명단 회원 현황도 같은 계산(I1 자리표시자 대체)
    status = admin.get(f"/api/roster/members/{setup['me'].id}/status").json()
    assert status["record"] == {"games": rec["games"], "wins": rec["wins"], "losses": rec["losses"]}
    # 확정 전 청백전 경기는 세지 않음, 다른 회원 랭크는 회원 응답 어디에도 없음
    detail = c.get(f"{MEMBER}/{view['id']}").json()
    assert all(isinstance(s["rank"], int) for s in detail["standings"])  # 순위 숫자만(S/A/B/C 아님)


@pytest.mark.parametrize(
    ("games", "wins", "rank", "to_rank"),
    [
        (0, 0, None, 10),
        (9, 9, None, 1),
        (10, 7, "S", None),
        (10, 6, "A", None),
        (20, 11, "A", None),
        (20, 10, "B", None),
        (10, 4, "B", None),
        (10, 3, "C", None),
        (13, 5, "C", None),
        (30, 21, "S", None),
    ],
)
def test_ac_045_046_rank_boundaries(
    games: int, wins: int, rank: str | None, to_rank: int | None
) -> None:
    got, left, rate = rank_for(games, wins)
    assert (got, left) == (rank, to_rank)
    assert rate == (wins / games if games else None)
