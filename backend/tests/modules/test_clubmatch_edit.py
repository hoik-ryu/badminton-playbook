"""청백전 대진 직접 구성·확정 전 공통 편집 API(B13, 기획 r11 C-35·C-14·C-15·C-19·C-32·C-33).

새 API: POST …/games/manual(완성 경기 추가) · DELETE …/games/{no}?version(경기 삭제, 번호 재정렬) ·
POST …/games/{no}/exchange(개인전 같은 경기 맞교환) · DELETE …/games?version(확정 전 대진 전체 폐기)
확장: POST …/games/{no}/swap(확정 전 같은 대진 허용·표시) ·
POST …/games(편집 후 다시 생성은 discard 필요) ·
POST …/confirm(항상 막는 규칙 재검사)

AC 태그: 테스트 이름의 `[AC-xxx]`(parametrize id) — product-build `tag_style = "bracket"`.
"""

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clubmatch import router as club_router
from app.modules.clubmatch.models import ClubMatch, ClubMatchGame, ClubMatchParticipant
from app.modules.user.models import User
from tests.modules.test_clubmatch_flow import (
    BASE,
    crafted,
    err,
    keys_of,
    member,
    new_match,
    ok,
    post,
)
from tests.modules.test_clubmatch_setup import (
    RULES,
    admin,  # noqa: F401 — pytest 픽스처
    db_state,
    mkeys,
    participants,
    team_ready,
    teams,
)

__all__ = ["admin"]


def ac(*ids: str) -> pytest.MarkDecorator:
    tag = ", ".join(ids)
    return pytest.mark.parametrize("ac_tag", [tag], ids=[tag])


def add(c: TestClient, view: Any, t1: list[str], t2: list[str]) -> Any:
    return post(c, view, "games/manual", team1=t1, team2=t2)


def delete_game(c: TestClient, view: Any, no: int) -> Any:
    return c.delete(f"{BASE}/{view['id']}/games/{no}", params={"version": view["version"]})


def discard_all(c: TestClient, view: Any) -> Any:
    return c.delete(f"{BASE}/{view['id']}/games", params={"version": view["version"]})


def exchange(c: TestClient, view: Any, no: int, out: str, into: str) -> Any:
    return post(c, view, f"games/{no}/exchange", out=out, **{"in": into})


def total_in_db(db: Session, match_id: str) -> int:
    db.expire_all()
    m = db.scalars(select(ClubMatch).where(ClubMatch.id == uuid.UUID(match_id))).one()
    return m.total_games


def matchup_reasons(game: Any) -> list[str]:
    return [r["reason"] for r in game["relaxations"] if r["rule"] == "matchup"]


# ── AC-143: 확정 후에는 경기 추가·삭제·맞교환·대진 폐기가 없고 기존 운영은 그대로 ──


@ac("AC-143")
def test_confirmed_rejects_add_delete_exchange_discard(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3], [0, 1, 2, 4]])  # 확정(status=confirmed)
    before = db_state(db, view["id"])
    assert err(add(admin, view, [k[0], k[5]], [k[2], k[3]])) == (409, "locked")
    assert err(delete_game(admin, view, 2)) == (409, "locked")
    assert err(exchange(admin, view, 1, k[0], k[2])) == (409, "locked")
    assert err(discard_all(admin, view)) == (409, "locked")
    assert db_state(db, view["id"]) == before  # 경기 수·version 그대로


@ac("AC-143", "AC-043")
def test_confirmed_swap_policy_unchanged(ac_tag: str, admin: TestClient, db: Session) -> None:
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3], [0, 1, 2, 4]])
    # 확정 후 같은 대진이 되는 교체는 기존처럼 거부(C-15, AC-043 r11 범위)
    assert err(post(admin, view, "games/2/swap", **{"from": k[4], "to": k[3]})) == (
        409,
        "same_matchup",
    )
    after = ok(post(admin, view, "games/2/swap", **{"from": k[4], "to": k[5]}))
    assert after["games"][1]["changed"] is True  # 회원 화면 수정 표시 그대로


# ── AC-140: 확정 전 같은 대진은 경고와 함께 허용, 항상 막는 규칙은 거부 ──


@ac("AC-140", "AC-043")
def test_draft_swap_into_same_matchup_allowed_and_both_marked(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, k = crafted(admin, db, ["남"] * 5, [[0, 1, 2, 3], [0, 1, 2, 4]], status="draft")
    after = ok(post(admin, view, "games/2/swap", **{"from": k[4], "to": k[3]}))
    g1, g2 = after["games"]
    assert g2["manual"] is True
    assert (g1["repeatedMatchup"], g2["repeatedMatchup"]) == (True, True)
    assert matchup_reasons(g1) == ["manual"] and matchup_reasons(g2) == ["manual"]
    # 반복이 풀리면 두 경기 모두 표시가 사라짐
    back = ok(post(admin, after, "games/2/swap", **{"from": k[3], "to": k[4]}))
    assert [g["repeatedMatchup"] for g in back["games"]] == [False, False]
    assert all(matchup_reasons(g) == [] for g in back["games"])


@ac("AC-140")
def test_draft_add_same_matchup_allowed_and_marked(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, k = crafted(admin, db, ["남"] * 5, [[0, 1, 2, 3]], status="draft")
    after = ok(add(admin, view, [k[1], k[0]], [k[3], k[2]]))  # 같은 4명·같은 조(순서만 다름)
    assert len(after["games"]) == 2
    assert all(g["repeatedMatchup"] and matchup_reasons(g) == ["manual"] for g in after["games"])
    assert after["games"][1]["manual"] is True


@ac("AC-140")
def test_always_blocked_rules_rejected_before_and_after_confirm(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3]], status="draft")
    before = db_state(db, view["id"])
    assert err(add(admin, view, [k[0], k[0]], [k[2], k[3]])) == (422, "duplicate_player")
    assert err(add(admin, view, [k[0], k[1]], [k[2]])) == (422, "not_two_vs_two")
    outsider = f"member:{member(db, '참가 안 함').id}"
    assert err(add(admin, view, [k[0], outsider], [k[2], k[3]])) == (422, "not_eligible")
    # 비활성 회원(참가자였어도)은 새 경기에 넣을 수 없음
    u = db.get(User, uuid.UUID(k[5].split(":")[1]))
    assert u is not None
    u.status = "inactive"
    db.commit()
    assert err(add(admin, view, [k[0], k[5]], [k[2], k[3]])) == (422, "not_eligible")
    # 교체도 같은 경기 중복은 거부(기존 409 conflict: 화면이 본 대진과 다름)
    assert err(post(admin, view, "games/1/swap", **{"from": k[0], "to": k[1]}))[0] == 409
    assert db_state(db, view["id"]) == before


@ac("AC-140")
def test_team_membership_enforced_for_add_and_confirm(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, keys = team_ready(admin, db)  # 청 = 짝수 번째, 백 = 홀수 번째(halves)
    blue = [k for i, k in enumerate(keys) if i % 2 == 0]
    white = [k for i, k in enumerate(keys) if i % 2 == 1]
    assert err(add(admin, view, [blue[0], white[0]], [white[1], white[2]])) == (
        422,
        "team_violation",
    )
    ok_view = ok(add(admin, view, [blue[0], blue[1]], [white[0], white[1]]))
    assert len(ok_view["games"]) == 5
    # 화면을 거치지 않고 팀이 바뀐 경우 확정 때 서버가 다시 검사
    part = db.scalars(
        select(ClubMatchParticipant).where(
            ClubMatchParticipant.user_id == uuid.UUID(blue[0].split(":")[1])
        )
    ).one()
    part.team = "white"
    db.commit()
    assert err(post(admin, ok_view, "confirm")) == (422, "team_violation")


# ── 경기 추가·삭제·총 경기 수(AC-137·138, C-14) ──


@ac("AC-137", "AC-138")
def test_add_and_delete_update_numbering_and_total(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 6)
    view = ok(participants(admin, new_match(admin), keys))
    view = ok(post(admin, view, "games", totalGames=4, rules=RULES))
    view = ok(add(admin, view, [keys[0], keys[1]], [keys[2], keys[5]]))
    assert [g["no"] for g in view["games"]] == [1, 2, 3, 4, 5]
    assert view["totalGames"] == 5 and total_in_db(db, view["id"]) == 5
    third = keys_of(view["games"][3])
    view = ok(delete_game(admin, view, 3))
    assert [g["no"] for g in view["games"]] == [1, 2, 3, 4]
    assert keys_of(view["games"][2]) == third  # 4경기였던 경기가 3경기로
    assert view["totalGames"] == 4
    counts = {r["key"]: r["games"] for r in view["rows"] if r["participating"]}
    assert sum(counts.values()) == 4 * 4
    # 모두 지우면 0경기: 화면 집계는 경기 0개, DB total_games는 마지막 기준값 유지(제약 1–200)
    for _ in range(4):
        view = ok(delete_game(admin, view, 1))
    assert view["games"] == [] and view["totalGames"] == 1
    assert all(r["games"] == 0 for r in view["rows"])
    assert err(post(admin, view, "confirm")) == (409, "no_games")
    # 경기를 추가하면 다시 실제 경기 수 저장
    view = ok(add(admin, view, [keys[0], keys[1]], [keys[2], keys[3]]))
    assert view["totalGames"] == 1 and len(view["games"]) == 1


@ac("AC-137")
def test_add_beyond_200_games_rejected(ac_tag: str, admin: TestClient, db: Session) -> None:
    view, k = crafted(admin, db, ["남"] * 4, [[0, 1, 2, 3]] * 200, status="draft")
    m = db.get(ClubMatch, uuid.UUID(view["id"]))
    assert m is not None
    m.total_games = 200
    db.commit()
    view = ok(admin.get(f"{BASE}/{view['id']}"))
    assert err(add(admin, view, [k[0], k[1]], [k[2], k[3]])) == (422, "max_games")


@ac("AC-138")
def test_delete_missing_game_is_not_found(ac_tag: str, admin: TestClient, db: Session) -> None:
    view, _ = crafted(admin, db, ["남"] * 4, [[0, 1, 2, 3]], status="draft")
    assert err(delete_game(admin, view, 7)) == (404, "not_found")


# ── 개인전 같은 경기 맞교환(AC-139) ──


@ac("AC-139")
def test_individual_exchange_with_opponent_updates_gap(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view = new_match(admin)
    scores = {"A": 7, "B": 5, "C": 6, "D": 3}
    k = {n: f"member:{member(db, n, '남', s).id}" for n, s in scores.items()}
    view = ok(participants(admin, view, list(k.values())))
    view = ok(add(admin, view, [k["A"], k["B"]], [k["C"], k["D"]]))
    assert view["games"][0]["gap"] == 3
    after = ok(exchange(admin, view, 1, k["A"], k["D"]))
    g = after["games"][0]
    assert [p["key"] for p in g["team1"]] == [k["D"], k["B"]]
    assert [p["key"] for p in g["team2"]] == [k["C"], k["A"]]
    assert g["gap"] == 5 and g["manual"] is True
    # 같은 조(파트너)와의 맞교환·경기 밖 사람은 대진이 바뀐 것으로 보고 거부
    assert err(exchange(admin, after, 1, k["D"], k["B"]))[0] == 409


@ac("AC-139")
def test_team_exchange_not_allowed(ac_tag: str, admin: TestClient, db: Session) -> None:
    view, keys = team_ready(admin, db)
    g = view["games"][0]
    res = exchange(admin, view, 1, g["team1"][0]["key"], g["team2"][0]["key"])
    assert err(res) == (422, "exchange_not_allowed")


# ── 다시 생성·대진 폐기(AC-142·136, C-33) ──


@ac("AC-142", "AC-076")
def test_regenerate_after_edit_needs_confirm(ac_tag: str, admin: TestClient, db: Session) -> None:
    keys = mkeys(db, 6)
    view = ok(participants(admin, new_match(admin), keys))
    view = ok(post(admin, view, "games", totalGames=4, rules=RULES))
    # 편집 없음: 확인 없이 새 시드(AC-076 그대로)
    view = ok(post(admin, view, "games", totalGames=4, rules=RULES))
    edited = ok(add(admin, view, [keys[0], keys[1]], [keys[2], keys[3]]))
    res = post(admin, edited, "games", totalGames=4, rules=RULES)
    assert err(res) == (409, "confirm_required")
    assert len(ok(admin.get(f"{BASE}/{view['id']}"))["games"]) == 5  # 취소 = 그대로
    again = ok(post(admin, edited, "games", totalGames=4, rules=RULES, discard=True))
    assert len(again["games"]) == 4 and again["totalGames"] == 4
    assert not any(g["manual"] for g in again["games"])


@ac("AC-136")
def test_discard_all_games_for_manual_composition(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, _ = team_ready(admin, db)
    empty = ok(discard_all(admin, view))
    assert empty["games"] == [] and empty["version"] == view["version"] + 1
    assert empty["totalGames"] == 4  # 기준값 유지
    # 참가자·팀 변경 시 대진 폐기 확인은 기존 규칙 그대로(대진이 없으면 확인 없음)
    keys = [r["key"] for r in empty["rows"] if r["participating"]]
    assert ok(teams(admin, empty, {k: ("white" if i % 2 else "blue") for i, k in enumerate(keys)}))


# ── 원자성·충돌(AC-141) ──


@ac("AC-141")
def test_edit_conflict_and_failure_change_nothing(
    ac_tag: str, admin: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3], [0, 1, 4, 5]], status="draft")
    other = ok(post(admin, view, "games/1/swap", **{"from": k[3], "to": k[5]}))
    # 다른 운영진이 먼저 바꾼 뒤 이전 화면으로 편집 → 409 conflict, 반영 없음
    assert err(delete_game(admin, view, 2)) == (409, "conflict")
    assert err(add(admin, view, [k[0], k[1]], [k[2], k[3]])) == (409, "conflict")
    assert db_state(db, view["id"])[1:] == (2, other["version"])
    before = db_state(db, view["id"])

    def boom(_db: Session, _m: ClubMatch) -> None:
        raise RuntimeError("저장 직전 실패(주입)")

    monkeypatch.setattr(club_router, "_finish", boom)
    with pytest.raises(RuntimeError):
        delete_game(admin, other, 1)
    with pytest.raises(RuntimeError):
        add(admin, other, [k[0], k[1]], [k[2], k[4]])
    assert db_state(db, view["id"]) == before
    nos = sorted(
        g.no for g in db.scalars(select(ClubMatchGame)).all() if str(g.match_id) == view["id"]
    )
    assert nos == [1, 2]


@ac("AC-143")
def test_member_cannot_edit(ac_tag: str, make_client: Any, admin: TestClient, db: Session) -> None:
    from tests.modules.authkit import kakao_login, make_user

    view, k = crafted(admin, db, ["남"] * 4, [[0, 1, 2, 3]], status="draft")
    m = make_client()
    make_user(db, name="회원", kakao_id="9399")
    kakao_login(m, "9399")
    res = m.post(
        f"{BASE}/{view['id']}/games/manual",
        json={"team1": k[:2], "team2": k[2:], "version": view["version"]},
    )
    assert res.status_code == 403
