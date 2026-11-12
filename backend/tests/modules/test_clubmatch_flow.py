"""청백전 I3-c — 확정 이후(SCR-223·225·226).

AC 매핑: AC-077 확정(이후 잠금) / AC-044·081 결과 기록·수정(이긴 쪽만) / U2 미기록으로 되돌리기 /
AC-085 종료(미기록 0)·종료 후 수정 /
U10·P-10 종료 후 결과 수정 표시(resultChanged·resultModifiedAt, 대진 수정 표시와 분리) /
P-1 종료 후 되돌리기 금지 / P-2 같은 결과 무변경 / P-3 no_games /
AC-064·077·079 선수 교체(결과 없는 경기만) / AC-088 바뀐 경기 표시 / AC-078 중도 귀가(원자적) /
I3-c 정책: 교체 뒤 같은 대진 반복·성별 완화 사유 재계산 / P-4 교체 중복 409 same_matchup /
P-4-b 중도 귀가 불가피 중복 예외(substitute_exhausted)·no_substitute /
P-5 대상 제외 / P-6 재퇴장 409 / P-7 원자적 /
C안 비식별화의 지난 기록 영향 / C-19·U9 version
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

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
RULES = {"balance": True, "gender": True}


@pytest.fixture
def admin(make_client: Factory, db: Session) -> TestClient:
    c = make_client()
    make_user(db, name="운영진", role="admin", kakao_id="9201")
    kakao_login(c, "9201")
    return c


def member(db: Session, name: str, gender: str = "남", score: int = 5) -> User:
    u = make_user(db, name=name, gender=gender)
    db.add(MemberRating(user_id=u.id, score=score))
    db.commit()
    return u


def new_match(c: TestClient, method: str = "individual", name: str = "흐름") -> Any:
    res = c.post(BASE, json={"method": method, "date": "2026-11-15", "name": name})
    return c.get(f"{BASE}/{res.json()['id']}").json()


def join(c: TestClient, view: Any, key: str, team: str | None = None) -> Any:
    if view["method"] == "team":
        body: dict[str, object] = {"team": team, "version": view["version"]}
        return c.put(f"{BASE}/{view['id']}/teams/{key}", json=body).json()
    body = {"participating": True, "version": view["version"]}
    return c.put(f"{BASE}/{view['id']}/participants/{key}", json=body).json()


def settings(c: TestClient, view: Any, total: int, gender: bool = True) -> Any:
    rules = {"balance": True, "gender": gender}
    body = {"totalGames": total, "rules": rules, "version": view["version"]}
    return c.put(f"{BASE}/{view['id']}/settings", json=body).json()


def post(c: TestClient, view: Any, path: str, **body: object) -> Any:
    return c.post(f"{BASE}/{view['id']}/{path}", json={**body, "version": view["version"]})


def result(c: TestClient, view: Any, no: int, winner: int | None) -> Any:
    return c.put(
        f"{BASE}/{view['id']}/games/{no}/result",
        json={"winner": winner, "version": view["version"]},
    )


def ok(res: Any) -> Any:
    assert res.status_code == 200, res.text
    return res.json()


def err(res: Any) -> tuple[int, str]:
    return res.status_code, res.json()["error"]["code"]


def generated(c: TestClient, db: Session, n: int = 6, total: int = 4) -> Any:
    view = new_match(c)
    for i in range(n):
        view = join(c, view, f"member:{member(db, f'선수{i}', '여' if i % 2 else '남').id}")
    view = settings(c, view, total)
    return ok(post(c, view, "games"))


def crafted(
    c: TestClient, db: Session, people: list[str], games: list[list[int]], status: str = "confirmed"
) -> tuple[Any, list[str]]:
    """대진을 직접 넣은 청백전: people = 성별 목록, games = 사람 번호 4개씩(1팀 2명, 2팀 2명)."""
    view = new_match(c)
    keys = []
    for i, gender in enumerate(people):
        key = f"member:{member(db, f'사람{i}', gender).id}"
        keys.append(key)
        view = join(c, view, key)
    mid = uuid.UUID(view["id"])
    parts = db.scalars(select(ClubMatchParticipant).where(ClubMatchParticipant.match_id == mid))
    pid = {f"member:{p.user_id}": p.id for p in parts}
    for no, four in enumerate(games, start=1):
        g = ClubMatchGame(match_id=mid, no=no)
        db.add(g)
        db.flush()
        for i, idx in enumerate(four):
            db.add(
                ClubMatchGamePlayer(
                    game_id=g.id, side=1 + i // 2, slot=1 + i % 2, participant_id=pid[keys[idx]]
                )
            )
    m = db.get(ClubMatch, mid)
    assert m is not None
    m.status = status
    db.commit()
    return c.get(f"{BASE}/{view['id']}").json(), keys


def keys_of(game: Any) -> list[str]:
    return [p["key"] for p in game["team1"] + game["team2"]]


# ── 확정(AC-077) ──


def test_ac_077_confirm_then_draft_changes_locked(admin: TestClient, db: Session) -> None:
    empty = new_match(admin, name="빈 대진")
    assert err(post(admin, empty, "confirm")) == (409, "no_games")
    view = generated(admin, db)
    assert err(admin.post(f"{BASE}/{view['id']}/confirm", json={"version": 0})) == (409, "conflict")
    done = ok(post(admin, view, "confirm"))
    assert done["status"] == "confirmed" and done["version"] == view["version"] + 1
    m = db.get(ClubMatch, uuid.UUID(view["id"]))
    db.refresh(m)
    assert m is not None and m.confirmed_at is not None
    assert err(post(admin, done, "confirm")) == (409, "locked")
    assert err(post(admin, done, "games")) == (409, "locked")  # 다시 생성 불가
    put = admin.put(
        f"{BASE}/{done['id']}/method", json={"method": "team", "version": done["version"]}
    )
    assert err(put) == (409, "locked")


# ── 결과(AC-044·081, U2) ──


def test_results_record_change_revert_and_recalculate(admin: TestClient, db: Session) -> None:
    view = generated(admin, db, n=4, total=3)
    assert err(result(admin, view, 1, 1)) == (409, "locked")  # 확정 전
    view = ok(post(admin, view, "confirm"))
    v1 = ok(result(admin, view, 1, 1))
    assert v1["games"][0]["winner"] == 1 and v1["unrecorded"] == 2
    winners = set(keys_of(v1["games"][0])[:2])
    assert {s["key"] for s in v1["standings"] if s["wins"] == 1} == winners
    same = ok(result(admin, v1, 1, 1))  # 같은 값 다시 → 변경 없음
    assert same["version"] == v1["version"]
    v2 = ok(result(admin, v1, 1, 2))  # 반대로 수정(AC-081)
    assert {s["key"] for s in v2["standings"] if s["wins"] == 1} == set(keys_of(v2["games"][0])[2:])
    v3 = ok(result(admin, v2, 1, None))  # 미기록으로 되돌리기(U2)
    assert v3["games"][0]["winner"] is None and v3["unrecorded"] == 3
    assert all(s["wins"] == 0 for s in v3["standings"])  # 재계산
    g = db.scalars(select(ClubMatchGame).where(ClubMatchGame.no == 1)).first()
    assert g is not None
    db.refresh(g)
    assert (g.recorded_at, g.recorded_by_id) == (None, None)
    assert (
        v3["games"][0]["changed"] is False and v3["modifiedAt"] is None
    )  # 진행 중 수정은 표시 안 함
    assert err(result(admin, v3, 99, 1)) == (404, "not_found")
    assert result(admin, v3, 1, 3).status_code == 422
    assert err(result(admin, v1, 1, 1)) == (409, "conflict")  # 이전 화면 version


def test_team_score_recalculated(admin: TestClient, db: Session) -> None:
    view = new_match(admin, method="team")
    for i in range(4):
        u = member(db, f"팀{i}")
        view = join(admin, view, f"member:{u.id}", "blue" if i < 2 else "white")
    view = ok(post(admin, settings(admin, view, 2), "games"))
    view = ok(post(admin, view, "confirm"))
    view = ok(result(admin, view, 1, 2))
    view = ok(result(admin, view, 2, 2))
    assert view["team"] == {"blue": 0, "white": 2}
    view = ok(result(admin, view, 2, None))
    assert view["team"] == {"blue": 0, "white": 1}


# ── 종료(AC-085)·종료 후 수정(U10) ──


def test_finish_and_edit_after_finish_marks_modified(admin: TestClient, db: Session) -> None:
    view = ok(post(admin, generated(admin, db, n=4, total=2), "confirm"))
    view = ok(result(admin, view, 1, 1))
    res = post(admin, view, "finish")
    assert err(res) == (409, "not_all_recorded")
    assert res.json()["error"]["details"] == {"remaining": 1}
    view = ok(result(admin, view, 2, 2))
    done = ok(post(admin, view, "finish"))
    assert done["status"] == "finished" and done["modifiedAt"] is None
    assert err(post(admin, done, "finish")) == (409, "locked")
    assert done["resultModifiedAt"] is None
    assert [g["resultChanged"] for g in done["games"]] == [False, False]
    edited = ok(result(admin, done, 1, 2))  # 종료 후 수정 가능(AC-085)
    # U10·P-10: 결과 수정은 resultChanged·resultModifiedAt, 대진 수정 표시(changed)는 그대로
    g1, g2 = edited["games"]
    assert (g1["resultChanged"], g1["changed"]) == (True, False)
    assert (g2["resultChanged"], g2["changed"]) == (False, False)
    assert edited["resultModifiedAt"] is not None and edited["modifiedAt"] is None
    same = ok(result(admin, edited, 1, 2))  # P-2: 같은 값 → 무변경
    assert same["version"] == edited["version"]
    assert same["resultModifiedAt"] == edited["resultModifiedAt"]
    assert err(result(admin, edited, 1, None)) == (409, "locked")  # 종료 후 되돌리기 불가
    key = keys_of(edited["games"][0])[0]
    other = keys_of(edited["games"][1])[0]
    swap = post(admin, edited, "games/1/swap", **{"from": key, "to": other})
    assert err(swap) == (409, "locked")  # 종료 후 교체 불가
    leave = post(admin, edited, f"participants/{key}/leave", assignments=[])
    assert err(leave) == (409, "locked")


# ── 선수 교체(AC-064·077·079·088) ──


def test_swap_confirmed_unrecorded_game_only(admin: TestClient, db: Session) -> None:
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3], [0, 1, 2, 4]])
    res = post(admin, view, "games/1/swap", **{"from": k[3], "to": k[5]})
    after = ok(res)
    g1 = after["games"][0]
    assert k[5] in keys_of(g1) and k[3] not in keys_of(g1)
    assert (g1["manual"], g1["changed"]) == (True, True) and after["modifiedAt"] is not None
    assert after["games"][1]["changed"] is False
    after = ok(result(admin, after, 1, 1))
    assert err(post(admin, after, "games/1/swap", **{"from": k[0], "to": k[3]})) == (409, "locked")
    # 경기에 없는 사람 → 대진이 바뀜, 이미 같은 경기 → 대진이 바뀜
    assert err(post(admin, after, "games/2/swap", **{"from": k[3], "to": k[5]})) == (
        409,
        "conflict",
    )
    assert err(post(admin, after, "games/2/swap", **{"from": k[0], "to": k[1]})) == (
        409,
        "conflict",
    )
    outsider = f"member:{member(db, '밖사람').id}"
    swap = post(admin, after, "games/2/swap", **{"from": k[0], "to": outsider})
    assert err(swap) == (422, "not_eligible")
    assert err(post(admin, after, "games/9/swap", **{"from": k[0], "to": k[5]})) == (
        404,
        "not_found",
    )


def test_swap_in_draft_is_manual_but_not_member_visible_change(
    admin: TestClient, db: Session
) -> None:
    view, k = crafted(admin, db, ["남"] * 5, [[0, 1, 2, 3]], status="draft")
    after = ok(post(admin, view, "games/1/swap", **{"from": k[3], "to": k[4]}))
    g = after["games"][0]
    assert (g["manual"], g["changed"], after["modifiedAt"]) == (True, False, None)


def test_swap_team_mode_same_team_only(admin: TestClient, db: Session) -> None:
    view = new_match(admin, method="team")
    keys = []
    for i in range(6):
        k = f"member:{member(db, f'팀원{i}').id}"
        keys.append(k)
        view = join(admin, view, k, "blue" if i < 3 else "white")
    view = ok(post(admin, ok(post(admin, settings(admin, view, 1), "games")), "confirm"))
    game = view["games"][0]
    blue_in = game["team1"][0]["key"]
    blue_out = next(k for k in keys[:3] if k not in keys_of(game))
    white_out = next(k for k in keys[3:] if k not in keys_of(game))
    cross = post(admin, view, "games/1/swap", **{"from": blue_in, "to": white_out})
    assert err(cross) == (422, "not_eligible")
    ok(post(admin, view, "games/1/swap", **{"from": blue_in, "to": blue_out}))


def test_p4_swap_into_same_matchup_rejected(admin: TestClient, db: Session) -> None:
    """P-4(NFR-003·C-19·UXD-009): 교체 결과가 다른 경기와 같은 4명·같은 팀이면 409 same_matchup."""
    # 1경기 (0,1)/(2,3), 2경기 (0,1)/(2,4) → 2경기 4를 3으로 바꾸면 1경기와 같은 대진
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3], [0, 1, 2, 4]])
    res = post(admin, view, "games/2/swap", **{"from": k[4], "to": k[3]})
    assert err(res) == (409, "same_matchup")
    assert res.json()["error"]["details"] == {"games": [2], "with": [1]}
    # 앞 경기를 바꿔 뒤 경기(손대지 않은)와 같아지는 경우도 거부
    res = post(admin, view, "games/1/swap", **{"from": k[3], "to": k[4]})
    assert err(res) == (409, "same_matchup")
    assert res.json()["error"]["details"] == {"games": [1], "with": [2]}
    same = admin.get(f"{BASE}/{view['id']}").json()
    assert same["version"] == view["version"] and same["games"] == view["games"]  # 아무것도 안 바뀜
    after = ok(post(admin, view, "games/2/swap", **{"from": k[4], "to": k[5]}))  # 중복 아님 → 허용
    assert after["games"][1]["repeatedMatchup"] is False and after["games"][1]["relaxations"] == []


def test_p4_draft_swap_also_rejected(admin: TestClient, db: Session) -> None:
    view, k = crafted(admin, db, ["남"] * 5, [[0, 1, 2, 3], [0, 1, 2, 4]], status="draft")
    assert err(post(admin, view, "games/2/swap", **{"from": k[4], "to": k[3]})) == (
        409,
        "same_matchup",
    )


def test_swap_recomputes_gender_relaxation(admin: TestClient, db: Session) -> None:
    # 혼복 (남0,여1)/(남2,여3), 남4 대기 → 여1을 남4로 바꾸면 남3·여1 = 성별 위반(사유 manual)
    view, k = crafted(admin, db, ["남", "여", "남", "여", "남"], [[0, 1, 2, 3]])
    assert view["games"][0]["genderRelaxed"] is False
    after = ok(post(admin, view, "games/1/swap", **{"from": k[1], "to": k[4]}))
    g = after["games"][0]
    assert g["genderRelaxed"] is True
    assert g["relaxations"] == [{"rule": "gender", "reason": "manual"}]
    m = db.get(ClubMatch, uuid.UUID(view["id"]))
    assert m is not None
    m.rule_gender = False  # 성별 규칙을 끈 청백전에서는 완화가 아님
    db.commit()
    back = ok(post(admin, after, "games/1/swap", **{"from": k[4], "to": k[1]}))
    assert back["games"][0]["genderRelaxed"] is False and back["games"][0]["relaxations"] == []


def test_generation_stores_relaxation_reasons(admin: TestClient, db: Session) -> None:
    view = generated(admin, db, n=4, total=5)
    reasons = [g["relaxations"] for g in view["games"]]
    matchup = [[x for x in r if x["rule"] == "matchup"] for r in reasons]
    assert matchup[3:] == [[{"rule": "matchup", "reason": "exhausted"}]] * 2
    stored = db.scalars(select(ClubMatchGame).where(ClubMatchGame.no == 4)).first()
    assert stored is not None
    assert {"rule": "matchup", "reason": "exhausted"} in stored.relaxations


# ── 중도 귀가(AC-078) ──


def test_leave_replaces_remaining_games_atomically(admin: TestClient, db: Session) -> None:
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3], [0, 4, 1, 5], [0, 2, 4, 5]])
    view = ok(result(admin, view, 1, 1))  # 0은 1경기 기록됨, 2·3경기 남음
    bad = post(admin, view, f"participants/{k[0]}/leave", assignments=[{"gameNo": 2, "to": k[3]}])
    assert err(bad) == (409, "conflict")
    assert bad.json()["error"]["details"]["games"] == [2, 3]
    # 하나는 맞고 하나는 잘못된 대체(이미 그 경기에 있는 사람) → 아무것도 바뀌지 않음
    half = post(
        admin,
        view,
        f"participants/{k[0]}/leave",
        assignments=[{"gameNo": 2, "to": k[3]}, {"gameNo": 3, "to": k[2]}],
    )
    assert err(half) == (409, "conflict")
    same = admin.get(f"{BASE}/{view['id']}").json()
    assert same["version"] == view["version"] and k[0] in keys_of(same["games"][1])
    self_sub = post(
        admin,
        view,
        f"participants/{k[0]}/leave",
        assignments=[{"gameNo": 2, "to": k[0]}, {"gameNo": 3, "to": k[1]}],
    )
    assert err(self_sub) == (422, "not_eligible")
    done = ok(
        post(
            admin,
            view,
            f"participants/{k[0]}/leave",
            assignments=[{"gameNo": 2, "to": k[3]}, {"gameNo": 3, "to": k[1]}],
        )
    )
    row = next(r for r in done["rows"] if r["key"] == k[0])
    assert row["left"] is True and row["games"] == 1  # 기록된 1경기는 그대로
    assert k[0] not in keys_of(done["games"][1]) + keys_of(done["games"][2])
    assert done["games"][0]["changed"] is False and done["games"][1]["changed"] is True
    assert done["modifiedAt"] is not None
    st = next(s for s in done["standings"] if s["key"] == k[0])
    assert st["wins"] == 1  # 기록 유지
    again = post(admin, done, f"participants/{k[0]}/leave", assignments=[])
    assert err(again) == (409, "conflict")
    to_left = post(admin, done, "games/2/swap", **{"from": k[3], "to": k[0]})
    assert err(to_left) == (422, "not_eligible")  # 제외된 사람은 대체로 못 들어감


def test_p4b_leave_unavoidable_duplicate_allowed_with_reason(
    admin: TestClient, db: Session
) -> None:
    """P-4-b: 대체 후보가 모두 같은 대진이면 서버가 확인하고 예외 허용(substitute_exhausted)."""
    # 5명. 1경기 (0,1)/(2,3) 기록, 2경기 (0,1)/(2,4). 4 귀가 → 2경기 후보는 3뿐(0·1·2는 경기에 있음)
    view, k = crafted(admin, db, ["남"] * 5, [[0, 1, 2, 3], [0, 1, 2, 4]])
    view = ok(result(admin, view, 1, 1))
    done = ok(
        post(admin, view, f"participants/{k[4]}/leave", assignments=[{"gameNo": 2, "to": k[3]}])
    )
    g2 = done["games"][1]
    assert keys_of(g2) == keys_of(done["games"][0])
    assert g2["repeatedMatchup"] is True and g2["manual"] is True and g2["changed"] is True
    assert g2["relaxations"] == [{"rule": "matchup", "reason": "substitute_exhausted"}]
    stored = db.scalars(
        select(ClubMatchGame).where(
            ClubMatchGame.match_id == uuid.UUID(view["id"]), ClubMatchGame.no == 2
        )
    ).one()
    db.refresh(stored)
    assert stored.relaxations == [{"rule": "matchup", "reason": "substitute_exhausted"}]


def test_p4b_leave_avoidable_duplicate_rejected(admin: TestClient, db: Session) -> None:
    """P-4-b: 중복 없는 후보(5)가 있는데 중복(3)을 고르면 409 same_matchup, 아무것도 안 바뀜."""
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3], [0, 1, 2, 4]])
    res = post(admin, view, f"participants/{k[4]}/leave", assignments=[{"gameNo": 2, "to": k[3]}])
    assert err(res) == (409, "same_matchup")
    assert res.json()["error"]["details"] == {"games": [2]}
    same = admin.get(f"{BASE}/{view['id']}").json()
    assert same["version"] == view["version"]
    assert not next(r for r in same["rows"] if r["key"] == k[4])["left"]
    done = ok(
        post(admin, view, f"participants/{k[4]}/leave", assignments=[{"gameNo": 2, "to": k[5]}])
    )
    assert done["games"][1]["repeatedMatchup"] is False


def test_p4b_leave_checks_final_lineup_across_assignments(admin: TestClient, db: Session) -> None:
    """같은 요청의 두 대체가 서로 같은 대진을 만들면(다른 후보로 피할 수 있으므로) 거부."""
    # 1·2경기 모두 (0,1)/(2,5)(생성 시 소진으로 반복된 상태). 5 귀가 → 둘 다 3이면 서로 같아짐
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 5], [0, 1, 2, 5]])
    both3 = [{"gameNo": 1, "to": k[3]}, {"gameNo": 2, "to": k[3]}]
    res = post(admin, view, f"participants/{k[5]}/leave", assignments=both3)
    assert err(res) == (409, "same_matchup")
    assert res.json()["error"]["details"] == {"games": [1, 2]}
    split = [{"gameNo": 1, "to": k[3]}, {"gameNo": 2, "to": k[4]}]
    done = ok(post(admin, view, f"participants/{k[5]}/leave", assignments=split))
    assert [g["repeatedMatchup"] for g in done["games"]] == [False, False]
    assert [g["relaxations"] for g in done["games"]] == [[], []]


def test_p4b_leave_without_any_substitute_rejected(admin: TestClient, db: Session) -> None:
    """대체 자체가 불가능(남은 경기에 넣을 사람이 없음) → 422 no_substitute, 제외도 안 됨."""
    view, k = crafted(admin, db, ["남"] * 4, [[0, 1, 2, 3], [0, 1, 2, 3]])
    view = ok(result(admin, view, 1, 1))
    res = post(admin, view, f"participants/{k[3]}/leave", assignments=[{"gameNo": 2, "to": k[0]}])
    assert err(res) == (422, "no_substitute")
    assert res.json()["error"]["details"] == {"games": [2]}
    same = admin.get(f"{BASE}/{view['id']}").json()
    assert not next(r for r in same["rows"] if r["key"] == k[3])["left"]


def test_p5_inactive_member_and_deleted_guest_cannot_substitute(
    admin: TestClient, db: Session
) -> None:
    view, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3]])
    u = db.get(User, uuid.UUID(k[4].split(":")[1]))
    assert u is not None
    u.status = "inactive"
    db.commit()
    rows = {r["key"]: r for r in admin.get(f"{BASE}/{view['id']}").json()["rows"]}
    assert (rows[k[4]]["available"], rows[k[4]]["participating"]) == (False, True)
    assert rows[k[5]]["available"] is True
    assert err(post(admin, view, "games/1/swap", **{"from": k[3], "to": k[4]})) == (
        422,
        "not_eligible",
    )
    res = post(admin, view, f"participants/{k[3]}/leave", assignments=[{"gameNo": 1, "to": k[4]}])
    assert err(res) == (422, "not_eligible")
    ok(post(admin, view, "games/1/swap", **{"from": k[3], "to": k[5]}))


def test_leave_only_when_confirmed(admin: TestClient, db: Session) -> None:
    view, k = crafted(admin, db, ["남"] * 4, [[0, 1, 2, 3]], status="draft")
    res = post(admin, view, f"participants/{k[0]}/leave", assignments=[])
    assert err(res) == (409, "locked")


# ── 비식별화 영향(C안) ──


def test_deleted_guest_c_plan_effect_on_history(admin: TestClient, db: Session) -> None:
    view = new_match(admin)
    keys = [f"member:{member(db, f'회원{i}', score=4 + i).id}" for i in range(3)]
    g = Guest(name="손님", gender="여", grade="초심", score=6)
    db.add(g)
    db.commit()
    keys.append(f"guest:{g.id}")
    for k in keys:
        view = join(admin, view, k)
    view = ok(post(admin, settings(admin, view, 3, gender=False), "games"))
    view = ok(post(admin, view, "confirm"))
    for no in (1, 2, 3):
        view = ok(result(admin, view, no, 1))
    before = ok(post(admin, view, "finish"))
    assert admin.delete(f"/api/roster/guests/{g.id}").status_code == 204
    after = admin.get(f"{BASE}/{view['id']}").json()
    # 결과·순위·팀 승수·참가 관계는 그대로
    strip = ["name", "guest"]
    assert [{k: v for k, v in s.items() if k not in strip} for s in after["standings"]] == [
        {k: v for k, v in s.items() if k not in strip} for s in before["standings"]
    ]
    assert [x["winner"] for x in after["games"]] == [x["winner"] for x in before["games"]]
    assert after["team"] == before["team"]
    gk = f"guest:{g.id}"
    row = next(r for r in after["rows"] if r["key"] == gk)
    assert (row["name"], row["gender"], row["grade"], row["score"]) == (
        "삭제된 게스트",
        None,
        None,
        None,
    )
    assert row["participating"] is True and row["games"] == before_games(before, gk)
    # 운영진 화면 영향: 게스트가 낀 경기의 실력차는 '계산 불가'(None), 다른 경기는 그대로
    for b, a in zip(before["games"], after["games"], strict=True):
        if gk in keys_of(a):
            assert a["gap"] is None and b["gap"] is not None
        else:
            assert a["gap"] == b["gap"]
        assert a["relaxations"] == b["relaxations"] and a["genderRelaxed"] == b["genderRelaxed"]


def before_games(view: Any, key: str) -> int:
    return int(next(r for r in view["rows"] if r["key"] == key)["games"])


def _mk(t1: tuple[str, str], t2: tuple[str, str]) -> str:
    from app.modules.clubmatch.schedule import matchup_key

    return matchup_key(t1, t2)


def test_p4b_random_leave_decisions_match_independent_check(admin: TestClient, db: Session) -> None:
    """무작위 중도 귀가 40건: 서버 판정 = 테스트가 따로 계산한 판정.

    기대: 각 대체 경기의 최종 대진이 다른 경기와 같고, 그 경기에 중복 없는 다른 후보가 있으면 거부
    (same_matchup). 모든 후보가 중복이면 허용 + 사유 substitute_exhausted. 중복이 없으면 허용.
    """
    import random

    r = random.Random(20261112)
    seen = {"accepted": 0, "forced": 0, "rejected": 0}
    for case in range(40):
        n = r.randint(5, 6)
        games = []
        for _ in range(r.randint(2, 4)):
            four = r.sample(range(n), 4)
            games.append(four)
        leaver_idx = games[-1][r.randint(0, 3)]
        view, k = crafted(admin, db, ["남"] * n, games)
        seats = {
            g["no"]: (
                (g["team1"][0]["key"], g["team1"][1]["key"]),
                (g["team2"][0]["key"], g["team2"][1]["key"]),
            )
            for g in view["games"]
        }
        leaver = k[leaver_idx]
        remaining = [no for no, (a, b) in seats.items() if leaver in (*a, *b)]

        def sub(
            no: int, to: str, lv: str = leaver, st: dict[int, Any] = seats
        ) -> tuple[tuple[str, str], tuple[str, str]]:
            a, b = st[no]
            return (
                (to if a[0] == lv else a[0], to if a[1] == lv else a[1]),
                (to if b[0] == lv else b[0], to if b[1] == lv else b[1]),
            )

        cands = {
            no: [x for x in k if x != leaver and x not in (*seats[no][0], *seats[no][1])]
            for no in remaining
        }
        picks = {no: r.choice(cands[no]) for no in remaining}
        final = {no: (sub(no, picks[no]) if no in picks else seats[no]) for no in seats}
        keys = {no: _mk(*s) for no, s in final.items()}
        avoidable: list[int] = []
        forced: list[int] = []
        for no in remaining:
            others = {v for o, v in keys.items() if o != no}
            if keys[no] not in others:
                continue
            alt = any(_mk(*sub(no, c)) not in others for c in cands[no])
            (avoidable if alt else forced).append(no)
        res = post(
            admin,
            view,
            f"participants/{leaver}/leave",
            assignments=[{"gameNo": no, "to": t} for no, t in picks.items()],
        )
        if avoidable:
            assert err(res) == (409, "same_matchup"), case
            assert res.json()["error"]["details"]["games"] == sorted(avoidable), case
            seen["rejected"] += 1
            continue
        body = ok(res)
        reasons = [x for g in body["games"] for x in g["relaxations"] if x["rule"] == "matchup"]
        if forced:
            assert {"rule": "matchup", "reason": "substitute_exhausted"} in reasons, case
            seen["forced"] += 1
        else:
            seen["accepted"] += 1
        # 반복 표시는 최종 대진 기준(앞 경기와 같으면 반복)
        firsts: set[str] = set()
        for g in body["games"]:
            kk = _mk(
                (g["team1"][0]["key"], g["team1"][1]["key"]),
                (g["team2"][0]["key"], g["team2"][1]["key"]),
            )
            assert g["repeatedMatchup"] is (kk in firsts), case
            firsts.add(kk)
    assert all(seen.values()), seen  # 세 경우가 모두 나왔는지
