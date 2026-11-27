"""청백전 단계형 생성 API(B10, 기획 r9·r10 C-31–C-34, Q-030 결정·2026-11-24 확정 3건).

새 API: PUT …/basic · PUT …/participants(일괄) · PUT …/teams(일괄) ·
DELETE …/{id}(준비 중 물리 삭제)
확장: PUT …/settings(discard, 같은 값 무변경) · POST …/games(설정 동시 저장, 팀전 미배정 422) ·
POST …/confirm(점수 미설정·미배정 서버 재검증) · PUT …/participants/{key}(대진 있으면 확인 필요)

AC 태그: 테스트 이름의 `[AC-xxx]`(parametrize id) — product-build `tag_style = "bracket"`.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clubmatch import router as club_router
from app.modules.clubmatch import schedule
from app.modules.clubmatch.models import ClubMatch, ClubMatchGame, ClubMatchParticipant
from app.modules.roster.models import Guest
from tests.modules.authkit import kakao_login, make_user
from tests.modules.test_clubmatch_flow import BASE, err, member, new_match, ok, post

Factory = Callable[[], TestClient]
RULES = {"balance": True, "gender": True}


def ac(*ids: str) -> pytest.MarkDecorator:
    """테스트 이름에 [AC-xxx] 태그를 붙임(JUnit testcase 이름 = 함수[태그])."""
    tag = ", ".join(ids)
    return pytest.mark.parametrize("ac_tag", [tag], ids=[tag])


@pytest.fixture
def admin(make_client: Factory, db: Session) -> TestClient:
    c = make_client()
    make_user(db, name="운영진", role="admin", kakao_id="9301")
    kakao_login(c, "9301")
    return c


def mkeys(db: Session, n: int, prefix: str = "참가") -> list[str]:
    """점수 있는 회원 n명(남녀 번갈아)의 사람 키."""
    return [
        f"member:{member(db, f'{prefix}{i}', '여' if i % 2 else '남', 5 + i % 4).id}"
        for i in range(n)
    ]


def put(c: TestClient, view: Any, path: str, **body: object) -> Any:
    return c.put(f"{BASE}/{view['id']}/{path}", json={**body, "version": view["version"]})


def basic(c: TestClient, view: Any, **over: object) -> Any:
    body = {"name": view["name"], "date": str(view["date"]), "method": view["method"], **over}
    return put(c, view, "basic", **body)


def participants(c: TestClient, view: Any, keys: list[str], discard: bool = False) -> Any:
    return put(c, view, "participants", keys=keys, discard=discard)


def teams(c: TestClient, view: Any, assign: dict[str, str], discard: bool = False) -> Any:
    return put(c, view, "teams", assignments=assign, discard=discard)


def halves(keys: list[str]) -> dict[str, str]:
    return {k: "blue" if i % 2 == 0 else "white" for i, k in enumerate(keys)}


def team_ready(c: TestClient, db: Session, n: int = 8) -> tuple[Any, list[str]]:
    """팀전: 참가자 n명 저장 + 팀 배정 저장 + 대진 생성까지."""
    keys = mkeys(db, n)
    view = new_match(c, method="team", name="팀전")
    view = ok(participants(c, view, keys))
    view = ok(teams(c, view, halves(keys)))
    view = ok(post(c, view, "games", totalGames=4, rules=RULES))
    assert len(view["games"]) == 4
    return view, keys


def db_state(db: Session, match_id: str) -> tuple[list[tuple[str, str | None]], int, int]:
    """DB에서 직접 읽은 (참가자 키·팀 목록, 경기 수, version)."""
    db.expire_all()
    mid = uuid.UUID(match_id)
    parts = db.scalars(
        select(ClubMatchParticipant)
        .where(ClubMatchParticipant.match_id == mid)
        .order_by(ClubMatchParticipant.position)
    ).all()
    games = db.scalars(select(ClubMatchGame).where(ClubMatchGame.match_id == mid)).all()
    m = db.get(ClubMatch, mid)
    assert m is not None
    return (
        [(club_router._participant_key(p), p.team) for p in parts],
        len(games),
        m.version,
    )


# ── 기본정보(PUT …/basic) ──


@ac("AC-123")
def test_basic_name_rule_and_name_date_change_keeps_teams_and_games(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    long = admin.post(BASE, json={"method": "team", "date": "2026-12-13", "name": "가" * 31})
    assert err(long) == (422, "validation_error")
    assert "이름은 30자 이내로 입력해 주세요" in long.text
    view, _ = team_ready(admin, db)
    res = basic(admin, view, name="가" * 31)
    assert err(res) == (422, "validation_error")
    assert "이름은 30자 이내로 입력해 주세요" in res.text
    after = ok(basic(admin, view, name="  12월 둘째 주 청백전  ", date="2026-12-14"))
    assert (after["name"], str(after["date"])) == ("12월 둘째 주 청백전", "2026-12-14")
    assert after["games"] == view["games"]  # 팀·대진 그대로, 확인 없음
    assert [r["team"] for r in after["rows"]] == [r["team"] for r in view["rows"]]
    assert after["version"] == view["version"] + 1


@ac("AC-123", "AC-132")
def test_basic_unchanged_values_keep_version(ac_tag: str, admin: TestClient, db: Session) -> None:
    view, _ = team_ready(admin, db)
    same = ok(basic(admin, view))
    assert same["version"] == view["version"]
    assert same["games"] == view["games"]


@ac("AC-070", "AC-132")
def test_basic_method_change_needs_confirm_then_discards_games_and_teams(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, keys = team_ready(admin, db)
    res = basic(admin, view, method="individual")
    assert err(res) == (409, "confirm_required")
    assert res.json()["error"]["details"] == {"games": 4, "teams": True}
    assert db_state(db, view["id"])[1:] == (4, view["version"])  # 아무것도 안 바뀜
    after = ok(basic(admin, view, method="individual", discard=True))
    assert after["method"] == "individual" and after["games"] == []
    assert all(r["team"] is None for r in after["rows"] if r["participating"])
    assert sorted(r["key"] for r in after["rows"] if r["participating"]) == sorted(keys)


# ── 참가자 일괄(PUT …/participants) ──


@ac("AC-125", "AC-128")
def test_participants_replace_keeps_remaining_teams_and_order(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 6)
    view = new_match(admin, method="team")
    view = ok(participants(admin, view, keys[:4]))
    assert [k for k, _ in db_state(db, view["id"])[0]] == keys[:4]
    view = ok(teams(admin, view, halves(keys[:4])))
    # 2명 추가(요청 순서대로), 1명 제외 → 남은 3명 팀 유지, 추가는 미배정
    view = ok(participants(admin, view, [keys[0], keys[2], keys[3], keys[5], keys[4]]))
    state = dict(db_state(db, view["id"])[0])
    assert state == {
        keys[0]: "blue",
        keys[2]: "blue",
        keys[3]: "white",
        keys[5]: None,
        keys[4]: None,
    }
    assert [k for k, _ in db_state(db, view["id"])[0]][-2:] == [keys[5], keys[4]]
    same = ok(participants(admin, view, [keys[4], keys[0], keys[2], keys[3], keys[5]]))
    assert same["version"] == view["version"]  # 같은 사람들이면 무변경


@ac("AC-124", "AC-125")
def test_participants_reject_ineligible_with_keys(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 4)
    inactive = f"member:{make_user(db, name='비활성', status='inactive').id}"
    gone = Guest(name="삭제", gender="여", grade="초심", score=3)
    db.add(gone)
    db.commit()
    gone_key = f"guest:{gone.id}"
    admin.delete(f"/api/roster/guests/{gone.id}")
    view = new_match(admin)
    res = participants(admin, view, [*keys, inactive, gone_key])
    assert err(res) == (422, "not_eligible")
    assert sorted(res.json()["error"]["details"]["keys"]) == sorted([inactive, gone_key])
    assert db_state(db, view["id"])[0] == []  # 하나도 반영 안 됨


@ac("AC-132")
def test_participants_change_with_games_needs_confirm(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, keys = team_ready(admin, db)
    extra = mkeys(db, 1, "추가")
    res = participants(admin, view, [*keys, *extra])
    assert err(res) == (409, "confirm_required")
    assert db_state(db, view["id"])[1:] == (4, view["version"])
    after = ok(participants(admin, view, [*keys, *extra], discard=True))
    assert after["games"] == []
    state = dict(db_state(db, after["id"])[0])
    assert state[extra[0]] is None and state[keys[0]] == "blue"  # 남은 배정 유지


# ── 팀 일괄(PUT …/teams) ──


@ac("AC-127", "AC-135")
def test_teams_replace_validates_all_assigned_min_two_and_participants(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 6)
    view = ok(participants(admin, new_match(admin, method="team"), keys))
    res = teams(admin, view, {k: "blue" for k in keys[:5]})
    assert err(res) == (422, "unassigned")
    assert res.json()["error"]["details"]["keys"] == [keys[5]]
    stranger = mkeys(db, 1, "남")[0]
    res = teams(admin, view, {**halves(keys), stranger: "white"})
    assert err(res) == (422, "not_participant")
    res = teams(admin, view, {k: "blue" if i else "white" for i, k in enumerate(keys)})
    assert err(res) == (422, "min_players")
    assert "백팀이 2명 이상이어야 합니다" in res.text
    assert db_state(db, view["id"])[2] == view["version"]
    saved = ok(teams(admin, view, halves(keys)))
    assert [t for _, t in db_state(db, saved["id"])[0]] == ["blue", "white"] * 3
    same = ok(teams(admin, saved, halves(keys)))
    assert same["version"] == saved["version"]  # 같은 배정이면 무변경


@ac("AC-128")
def test_teams_uneven_sizes_allowed_with_two_each(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 7)
    view = ok(participants(admin, new_match(admin, method="team"), keys))
    uneven = {k: "white" if i < 2 else "blue" for i, k in enumerate(keys)}
    saved = ok(teams(admin, view, uneven))
    assert (saved["summary"]["blue"]["n"], saved["summary"]["white"]["n"]) == (5, 2)


@ac("AC-132")
def test_teams_change_with_games_needs_confirm_and_does_not_regenerate(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, keys = team_ready(admin, db)
    moved = {**halves(keys), keys[0]: "white", keys[1]: "blue"}
    res = teams(admin, view, moved)
    assert err(res) == (409, "confirm_required")
    assert db_state(db, view["id"])[1:] == (4, view["version"])
    after = ok(teams(admin, view, moved, discard=True))
    assert after["games"] == []  # 자동으로 다시 만들지 않음


@ac("AC-127")
def test_teams_only_for_team_method(ac_tag: str, admin: TestClient, db: Session) -> None:
    keys = mkeys(db, 4)
    view = ok(participants(admin, new_match(admin), keys))
    assert err(teams(admin, view, halves(keys))) == (409, "locked")


# ── 설정(PUT …/settings)·생성(POST …/games) ──


@ac("AC-132")
def test_settings_same_value_keeps_games_changed_value_needs_confirm(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, _ = team_ready(admin, db)
    same = ok(put(admin, view, "settings", totalGames=4, rules=RULES))
    assert same["version"] == view["version"] and same["games"] == view["games"]
    res = put(admin, view, "settings", totalGames=6, rules=RULES)
    assert err(res) == (409, "confirm_required")
    assert res.json()["error"]["details"] == {"games": 4, "teams": False}
    after = ok(put(admin, view, "settings", totalGames=6, rules=RULES, discard=True))
    assert (after["totalGames"], after["games"]) == (6, [])
    rule = ok(put(admin, after, "settings", totalGames=6, rules={**RULES, "gender": False}))
    assert rule["rules"]["gender"] is False  # 대진이 없으면 확인 없이 저장


@ac("AC-129")
def test_generate_saves_settings_with_games_in_one_request(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 9)
    view = ok(participants(admin, new_match(admin), keys))
    gen = ok(post(admin, view, "games", totalGames=8, rules={**RULES, "balance": False}))
    assert (gen["totalGames"], gen["rules"]["balance"], len(gen["games"])) == (8, False, 8)
    assert gen["version"] == view["version"] + 1


@ac("AC-071")
def test_generate_rejects_unscored_participant(ac_tag: str, admin: TestClient, db: Session) -> None:
    keys = mkeys(db, 3)
    unscored = f"member:{make_user(db, name='미설정').id}"
    view = ok(participants(admin, new_match(admin), [*keys, unscored]))
    res = post(admin, view, "games", totalGames=4, rules=RULES)
    assert err(res) == (422, "unscored_players")
    assert res.json()["error"]["details"]["keys"] == [unscored]
    assert db_state(db, view["id"])[1:] == (0, view["version"])  # 설정도 저장 안 됨


@ac("AC-128")
def test_generate_team_with_unassigned_is_rejected(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 6)
    view = ok(participants(admin, new_match(admin, method="team"), keys[:4]))
    view = ok(teams(admin, view, halves(keys[:4])))
    view = ok(participants(admin, view, keys))
    res = post(admin, view, "games", totalGames=4, rules=RULES)
    assert err(res) == (422, "unassigned")
    assert sorted(res.json()["error"]["details"]["keys"]) == sorted(keys[4:])


@ac("AC-075", "AC-076")
def test_generation_rules_unchanged_same_seed_same_games_no_repeat(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    players = [
        schedule.ClubPlayer(f"p{i}", "남" if i < 10 else "여", 3 + i % 6, None) for i in range(20)
    ]
    for gender_rule in (True, False):
        a = schedule.generate_club_games(players, 20, "individual", True, gender_rule, 1234)
        b = schedule.generate_club_games(players, 20, "individual", True, gender_rule, 1234)
        assert a == b  # 같은 입력·시드 → 같은 대진(AC-076)
        lineups = {(frozenset(g.team1), frozenset(g.team2)) for g in a if not g.repeated_matchup}
        assert len(lineups) == sum(1 for g in a if not g.repeated_matchup)  # 같은 대진 없음
    c = schedule.generate_club_games(players, 20, "individual", True, True, 99)
    assert c != a


# ── 확정(POST …/confirm) ──


@ac("AC-081", "AC-130")
def test_confirm_revalidates_and_results_only_after_confirm(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, keys = team_ready(admin, db)
    early = put(admin, view, "games/1/result", winner=1)
    assert err(early) == (409, "locked")  # 확정 전 결과 기록 불가(AC-081)
    part = db.scalars(
        select(ClubMatchParticipant).where(
            ClubMatchParticipant.match_id == uuid.UUID(view["id"]),
            ClubMatchParticipant.user_id == uuid.UUID(keys[0].split(":")[1]),
        )
    ).one()
    part.team = None  # 서버 재검증 확인용(화면을 거치지 않은 미배정)
    db.commit()
    res = post(admin, view, "confirm")
    assert err(res) == (422, "unassigned")
    part.team = "blue"
    db.commit()
    done = ok(post(admin, view, "confirm"))
    assert done["status"] == "confirmed"
    assert ok(put(admin, done, "games/1/result", winner=1))["games"][0]["winner"] == 1


# ── 1명 단위 참가(PUT …/participants/{key}) ──


@ac("AC-132")
def test_single_participant_change_with_games_needs_confirm(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 4)
    view = ok(participants(admin, new_match(admin), keys))
    view = ok(post(admin, view, "games", totalGames=1, rules=RULES))
    in_game = view["games"][0]["team1"][0]["key"]
    res = put(admin, view, f"participants/{in_game}", participating=False)
    assert err(res) == (409, "confirm_required")
    assert db_state(db, view["id"])[1:] == (1, view["version"])
    after = ok(put(admin, view, f"participants/{in_game}", participating=False, discard=True))
    assert after["games"] == [] and after["summary"]["count"] == 3
    same = ok(put(admin, after, f"participants/{in_game}", participating=False))
    assert same["version"] == after["version"]


# ── 삭제(DELETE …/{id}) ──


@ac("AC-134")
def test_delete_draft_removes_match_participants_and_games(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, keys = team_ready(admin, db)
    stale = admin.delete(f"{BASE}/{view['id']}", params={"version": view["version"] - 1})
    assert err(stale) == (409, "conflict")
    assert (
        admin.delete(f"{BASE}/{view['id']}", params={"version": view["version"]}).status_code == 204
    )
    db.expire_all()
    mid = uuid.UUID(view["id"])
    assert db.get(ClubMatch, mid) is None
    left = db.scalars(select(ClubMatchParticipant).where(ClubMatchParticipant.match_id == mid))
    assert left.all() == []
    assert err(admin.get(f"{BASE}/{view['id']}")) == (404, "not_found")
    again = admin.delete(f"{BASE}/{view['id']}", params={"version": view["version"]})
    assert err(again) == (404, "not_found")  # 재시도: 이미 삭제됨
    assert all(r["id"] != view["id"] for r in ok(admin.get(BASE)))


@ac("AC-134")
def test_confirmed_unfinished_match_can_be_deleted_and_members_cannot_delete(
    ac_tag: str, make_client: Factory, admin: TestClient, db: Session
) -> None:
    """(2026-11-27) 확정했어도 종료 전이면 운영진이 삭제(종료 거부는 test_clubmatch_delete)."""
    view, _ = team_ready(admin, db)
    done = ok(post(admin, view, "confirm"))
    res = admin.delete(f"{BASE}/{done['id']}", params={"version": done["version"]})
    assert res.status_code == 204
    draft = new_match(admin, name="준비 중")
    m = make_client()
    make_user(db, name="회원", kakao_id="9302")
    kakao_login(m, "9302")
    res = m.delete(f"{BASE}/{draft['id']}", params={"version": draft["version"]})
    assert res.status_code == 403
    assert ok(admin.get(f"{BASE}/{draft['id']}"))["id"] == draft["id"]


# ── 원자성·충돌·재시도(AC-133) ──


@ac("AC-133")
def test_failure_mid_save_changes_nothing(
    ac_tag: str, admin: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    view, keys = team_ready(admin, db)
    before = db_state(db, view["id"])
    extra = mkeys(db, 2, "추가")

    def boom(_db: Session, _m: ClubMatch) -> None:
        raise RuntimeError("저장 직전 실패(주입)")

    monkeypatch.setattr(club_router, "_finish", boom)
    with pytest.raises(RuntimeError):
        participants(admin, view, [*keys, *extra], discard=True)
    with pytest.raises(RuntimeError):
        teams(admin, view, {**halves(keys), keys[0]: "white", keys[1]: "blue"}, discard=True)
    with pytest.raises(RuntimeError):
        basic(admin, view, method="individual", discard=True)
    assert db_state(db, view["id"]) == before  # 참가자·팀·대진·version 모두 그대로


@ac("AC-133")
def test_conflict_and_repeated_request_do_not_double_apply(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    keys = mkeys(db, 6)
    view = ok(participants(admin, new_match(admin), keys[:4]))
    target = [*keys[:4], keys[4]]
    first = ok(participants(admin, view, target))
    # 응답을 잃고 같은 요청을 다시 보냄 → version이 달라 409 conflict(중복 반영 없음)
    again = participants(admin, view, target)
    assert err(again) == (409, "conflict")
    assert again.json()["error"]["details"]["version"] == first["version"]
    latest = ok(admin.get(f"{BASE}/{view['id']}"))
    assert sorted(r["key"] for r in latest["rows"] if r["participating"]) == sorted(target)
    # 최신 version으로 같은 목록을 다시 보내도 무변경(멱등)
    assert ok(participants(admin, latest, target))["version"] == latest["version"]
    # 다른 운영진이 먼저 바꾼 뒤 이전 화면으로 저장 → 충돌, 반영 안 됨
    other = ok(participants(admin, latest, keys))
    stale = participants(admin, latest, keys[:3])
    assert err(stale) == (409, "conflict")
    assert db_state(db, view["id"])[2] == other["version"]
