"""청백전 라운드·코트 운영 API(B15, 기획 r13 C-36–C-38, AC-144–165).

- 생성: 코트 수(courtCount)·자동 생성 기준 라운드 수(rounds)·라운드 미리보기(preview.rounds)
- 라운드 기반 생성(schedule.generate_round_games): 라운드마다 k경기, 같은 라운드 중복 출전 0, 결정적
- 편집: 라운드별 경기 추가·라운드 추가·삭제 정리·이동(move)·같은 라운드 후보 제한
- 진행: 확정 시 1라운드, 다음 라운드 시작·시작 취소, 결과 입력 규칙, 종료 조건
- 중도 귀가 취소(cancel)·복원(restore)·이력, 취소 경기 집계 제외
- 라운드 정보 없는 기존 청백전은 기존 테스트(test_clubmatch_*.py)가 그대로 지킴(AC-163)

AC 태그: 테스트 이름의 `[AC-xxx]`(parametrize id).
"""

import uuid
from collections import Counter, defaultdict
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clubmatch import schedule
from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGameEvent,
    ClubMatchGamePlayer,
)
from tests.modules.authkit import kakao_login, make_user
from tests.modules.test_clubmatch_flow import BASE, err, ok, post, result
from tests.modules.test_clubmatch_setup import (
    RULES,
    admin,  # noqa: F401 — pytest 픽스처
    basic,
    mkeys,
    participants,
    teams,
)

__all__ = ["admin"]


def ac(*ids: str) -> pytest.MarkDecorator:
    tag = ", ".join(ids)
    return pytest.mark.parametrize("ac_tag", [tag], ids=[tag])


def new_round_match(c: TestClient, method: str = "individual", courts: int = 4) -> Any:
    res = c.post(
        BASE, json={"method": method, "date": "2026-11-26", "name": "라운드", "courtCount": courts}
    )
    assert res.status_code == 201, res.text
    return ok(c.get(f"{BASE}/{res.json()['id']}"))


def ready(
    c: TestClient, db: Session, n: int = 20, courts: int = 4, rounds: int | None = None
) -> tuple[Any, list[str]]:
    """개인전 n명·코트 courts·대진 생성까지."""
    keys = mkeys(db, n)
    view = ok(participants(c, new_round_match(c, courts=courts), keys))
    body: dict[str, Any] = {"rules": RULES}
    if rounds is not None:
        body["rounds"] = rounds
    return ok(post(c, view, "games", **body)), keys


def team_round(
    c: TestClient, db: Session, blue: int, white: int, courts: int = 4
) -> tuple[Any, list[str]]:
    keys = mkeys(db, blue + white, "팀")
    view = ok(participants(c, new_round_match(c, "team", courts), keys))
    assign = {k: ("blue" if i < blue else "white") for i, k in enumerate(keys)}
    view = ok(teams(c, view, assign))
    return ok(post(c, view, "games", rules=RULES)), keys


def players(game: Any) -> list[str]:
    return [p["key"] for p in game["team1"] + game["team2"]]


def by_round(view: Any) -> dict[int, list[Any]]:
    out: dict[int, list[Any]] = defaultdict(list)
    for g in view["games"]:
        out[g["round"]].append(g)
    return out


def assert_round_rules(view: Any) -> None:
    """공통 라운드 규칙(AC-146·165): 라운드 1..R, 코트 1..n ≤ 코트 수, 중복 출전 0, 번호 일련."""
    rounds = by_round(view)
    assert sorted(rounds) == list(range(1, len(rounds) + 1))
    for gs in rounds.values():
        assert [g["court"] for g in gs] == list(range(1, len(gs) + 1))
        assert len(gs) <= view["courtCount"]
        live = [k for g in gs if not g["cancelled"] for k in players(g)]
        assert len(live) == len(set(live))
    ordered = sorted(view["games"], key=lambda g: (g["round"], g["court"]))
    assert [g["no"] for g in ordered] == list(range(1, len(ordered) + 1))


def move(c: TestClient, view: Any, no: int, rd: int) -> Any:
    return post(c, view, f"games/{no}/move", round=rd)


def add(c: TestClient, view: Any, t1: list[str], t2: list[str], rd: int | None) -> Any:
    return post(c, view, "games/manual", team1=t1, team2=t2, round=rd)


def delete_game(c: TestClient, view: Any, no: int) -> Any:
    return c.delete(f"{BASE}/{view['id']}/games/{no}", params={"version": view["version"]})


def confirm(c: TestClient, view: Any) -> Any:
    return ok(post(c, view, "confirm"))


def record_round(c: TestClient, view: Any, rd: int) -> Any:
    for g in [x for x in view["games"] if x["round"] == rd and not x["cancelled"]]:
        if g["winner"] is None:
            view = ok(result(c, view, g["no"], 1))
    return view


# ── 코트 수·라운드 수·미리보기(AC-144·145) ──


@ac("AC-144")
def test_court_count_saved_and_change_with_games_needs_confirm(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, _ = ready(admin, db, 8)
    assert view["courtCount"] == 4 and len(view["games"]) > 0
    # 범위 밖은 검증 오류
    assert basic(admin, view, courtCount=9).status_code == 422
    assert basic(admin, view, courtCount=0).status_code == 422
    # 같은 값은 무변경(version 그대로)
    same = ok(basic(admin, view, courtCount=4))
    assert same["version"] == view["version"] and len(same["games"]) == len(view["games"])
    # 대진이 있을 때 바꾸면 폐기 확인 필요 → 확인 후 코트 수 저장 + 대진 폐기
    assert err(basic(admin, view, courtCount=3)) == (409, "confirm_required")
    after = ok(basic(admin, view, courtCount=3, discard=True))
    assert after["courtCount"] == 3 and after["games"] == []


@ac("AC-145")
def test_round_preview_defaults_ranges_and_team_split(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    keys = mkeys(db, 20)
    view = ok(participants(admin, new_round_match(admin), keys))
    pv = view["preview"]["rounds"]
    assert (pv["perRound"], pv["defaultRounds"], pv["maxRounds"], pv["games"]) == (4, 5, 50, 20)
    assert pv["each"] == {"all": {"min": 4, "max": 4}}
    assert pv["playing"] == {"all": 16} and pv["resting"] == {"all": 4}
    # 범위 밖 라운드 수는 생성하지 않음
    assert err(post(admin, view, "games", rounds=51, rules=RULES)) == (422, "invalid_round")
    # 18명 → 1인 4–5경기, 균등안 9라운드(모두 8경기)
    p18 = schedule.round_preview("individual", {"all": 18, "blue": 0, "white": 0}, 4, 5)
    assert p18["each"] == {"all": {"min": 4, "max": 5}} and p18["resting"] == {"all": 2}
    proposals: list[dict[str, int]] = p18["proposals"]  # type: ignore[assignment]
    assert proposals[0] == {"rounds": 9, "all": 8}
    # 팀전 청 9·백 7 → k 3, 기본 6라운드(⌈2×9÷3⌉), 청 1인 4경기·백 1인 5–6경기
    team = schedule.round_preview("team", {"all": 16, "blue": 9, "white": 7}, 4, 6)
    assert (team["perRound"], team["defaultRounds"], team["games"]) == (3, 6, 18)
    assert team["each"] == {"blue": {"min": 4, "max": 4}, "white": {"min": 5, "max": 6}}
    assert team["resting"] == {"blue": 3, "white": 1}
    # k = 0이면 기본값·생성 없음
    assert schedule.per_round("team", {"all": 5, "blue": 1, "white": 4}, 4) == 0
    assert schedule.default_rounds("team", {"all": 5, "blue": 1, "white": 4}, 0) == 0
    # 200경기 상한: 기본값이 ⌊200÷k⌋를 넘지 않고, 평균 4경기 미달을 알림
    big = schedule.round_preview("individual", {"all": 900, "blue": 0, "white": 0}, 1, 200)
    assert big["defaultRounds"] == 200 and big["belowTarget"] is True


# ── 라운드 기반 생성(AC-146·147, 기존 AC-073–076) ──


@ac("AC-146", "AC-073")
def test_generate_fills_courts_per_round_without_duplicates(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, keys = ready(admin, db, 20)
    assert len(view["games"]) == 20 and view["roundCount"] == 5 and view["plannedRounds"] == 5
    rounds = by_round(view)
    assert all(len(gs) == 4 for gs in rounds.values())
    assert_round_rules(view)
    counts = Counter(k for g in view["games"] for k in players(g))
    assert set(counts.values()) == {4} and set(counts) == set(keys)
    # 팀전 청 10·백 10: 모든 경기 청 2 대 백 2
    tview, _ = team_round(admin, db, 10, 10)
    assert_round_rules(tview)
    team_of = {r["key"]: r["team"] for r in tview["rows"]}
    for g in tview["games"]:
        assert [team_of[p["key"]] for p in g["team1"]] == ["blue", "blue"]
        assert [team_of[p["key"]] for p in g["team2"]] == ["white", "white"]


def _people(n: int, team_split: int | None = None) -> list[schedule.ClubPlayer]:
    genders = ["남", "여"]
    return [
        schedule.ClubPlayer(
            f"p{i:02d}",
            genders[i % 2],
            3 + i % 7,
            None if team_split is None else ("blue" if i < team_split else "white"),
        )
        for i in range(n)
    ]


def _rest_report(games: list[schedule.RoundGame], ps: list[schedule.ClubPlayer]) -> int:
    played: dict[int, set[str]] = defaultdict(set)
    for g in games:
        played[g.round] |= {*g.team1, *g.team2}
    prev: set[str] = set()
    consecutive = 0
    for rd in sorted(played):
        rest = {p.key for p in ps} - played[rd]
        consecutive += len(rest & prev)
        prev = rest
    return consecutive


@ac("AC-147", "AC-075", "AC-076")
@pytest.mark.parametrize(
    ("n", "split", "rounds"), [(20, None, 5), (18, None, 5), (16, 9, 4), (18, 9, 5)]
)
def test_generation_balance_rest_and_determinism(
    n: int, split: int | None, rounds: int, ac_tag: str
) -> None:
    ps = _people(n, split)
    method: schedule.Method = "individual" if split is None else "team"
    a = schedule.generate_round_games(ps, rounds, 4, method, True, True, 12345)
    b = schedule.generate_round_games(ps, rounds, 4, method, True, True, 12345)
    assert [(g.round, g.court, g.team1, g.team2) for g in a] == [
        (g.round, g.court, g.team1, g.team2) for g in b
    ]
    c = schedule.generate_round_games(ps, rounds, 4, method, True, True, 999)
    assert [(g.team1, g.team2) for g in c] != [(g.team1, g.team2) for g in a]
    counts = Counter(k for g in a for k in (*g.team1, *g.team2))
    groups = [[p for p in ps if p.team == t] for t in ("blue", "white")] if split else [ps]
    for grp in groups:
        values = [counts.get(p.key, 0) for p in grp]
        assert max(values) - min(values) <= 1
    # 휴식 인원 ≤ 출전 인원이면 연속 휴식 0(팀전은 팀별 같은 조건)
    assert _rest_report(a, ps) == 0
    # 같은 대진 0(가능한 조합이 있는 한)
    keys = [schedule.matchup_key(g.team1, g.team2) for g in a]
    repeats = [g for g in a if g.repeated_matchup]
    assert len(keys) - len(set(keys)) == len(repeats)
    assert all(x["reason"] == "exhausted" for g in repeats for x in g.relaxations or [])


def test_previous_rester_goes_first() -> None:
    """직전 라운드 휴식자는 경기 수가 같은 다른 사람보다 먼저 출전(AC-147)."""
    ps = _people(18)
    games = schedule.generate_round_games(ps, 3, 4, "individual", False, False, 7)
    r1 = {k for g in games if g.round == 1 for k in (*g.team1, *g.team2)}
    r2 = {k for g in games if g.round == 2 for k in (*g.team1, *g.team2)}
    rested1 = {p.key for p in ps} - r1
    assert rested1 <= r2


# ── 확정 전 라운드 편집(AC-149–152, 기존 AC-137·138·139) ──


@ac("AC-149", "AC-150", "AC-137")
def test_add_game_to_round_with_free_court_and_new_round(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, keys = ready(admin, db, 12, courts=3, rounds=2)  # k 3: 라운드마다 12명 전원
    r2 = by_round(view)[2]
    # 꽉 찬 라운드에 추가 → court_full
    assert err(add(admin, view, keys[:2], keys[2:4], 2)) == (422, "court_full")
    # 없는 라운드(마지막 + 2) → invalid_round
    assert err(add(admin, view, keys[:2], keys[2:4], 4)) == (422, "invalid_round")
    # 2라운드 경기 하나를 지우면 빈 코트 → 같은 라운드 출전자로는 round_conflict
    view = ok(delete_game(admin, view, r2[0]["no"]))
    busy = players(by_round(view)[2][0])
    assert err(add(admin, view, busy[:2], busy[2:], 2)) == (422, "round_conflict")
    freed = players(r2[0])
    view = ok(add(admin, view, freed[:2], freed[2:], 2))
    assert len(by_round(view)[2]) == 3 and by_round(view)[2][-1]["court"] == 3
    assert_round_rules(view)
    # 라운드 추가(마지막 + 1)
    view = ok(add(admin, view, keys[:2], keys[2:4], 3))
    assert view["roundCount"] == 3 and by_round(view)[3][0]["court"] == 1
    assert_round_rules(view)


@ac("AC-151", "AC-138")
def test_delete_pulls_courts_and_removes_empty_round(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, keys = ready(admin, db, 8, courts=2, rounds=3)  # k 2: 라운드마다 2경기
    r1 = by_round(view)[1]
    view = ok(delete_game(admin, view, r1[0]["no"]))
    assert [g["court"] for g in by_round(view)[1]] == [1]
    assert len(view["games"]) == 5 and view["totalGames"] == 5
    # 1라운드의 남은 경기를 지우면 1라운드가 사라지고 2·3라운드가 1·2라운드로
    view = ok(delete_game(admin, view, by_round(view)[1][0]["no"]))
    assert view["roundCount"] == 2 and sorted(by_round(view)) == [1, 2]
    assert_round_rules(view)
    # 마지막까지 지우면 0경기(기준 라운드 수 유지)
    while view["games"]:
        view = ok(delete_game(admin, view, view["games"][0]["no"]))
    assert view["roundCount"] == 0 and view["plannedRounds"] == 3


@ac("AC-152")
def test_move_game_between_rounds(admin: TestClient, db: Session, ac_tag: str) -> None:
    keys = mkeys(db, 12)
    view = ok(participants(admin, new_round_match(admin, courts=2), keys))
    a, b, c3 = keys[0:4], keys[4:8], keys[8:12]
    view = ok(add(admin, view, a[:2], a[2:], 1))
    view = ok(add(admin, view, b[:2], b[2:], 1))
    view = ok(add(admin, view, c3[:2], c3[2:], 2))
    view = ok(add(admin, view, [a[0], b[0]], [c3[0], c3[1]], 3))
    view = ok(add(admin, view, [a[1], b[1]], [c3[2], c3[3]], 3))
    # 3라운드는 꽉 참 → court_full, 같은 라운드 → invalid_round
    assert err(move(admin, view, 2, 3)) == (422, "court_full")
    assert err(move(admin, view, 2, 1)) == (422, "invalid_round")
    # 2번(B조 경기)을 2라운드로: 빈 코트 1, 겹침 없음 → 2라운드 코트 2
    view = ok(move(admin, view, 2, 2))
    r = by_round(view)
    assert [players(g) for g in r[2]] == [c3, b] and [g["court"] for g in r[2]] == [1, 2]
    assert [g["court"] for g in r[1]] == [1]
    assert_round_rules(view)
    # 1라운드 경기(a)를 3라운드로: 빈 코트 없음, 2라운드로: 겹침 없음이지만 꽉 참
    assert err(move(admin, view, 1, 2)) == (422, "court_full")
    # 겹치는 라운드로는 round_conflict: 3라운드 경기 하나를 지워 빈 코트를 만든 뒤
    view = ok(delete_game(admin, view, by_round(view)[3][1]["no"]))
    assert err(move(admin, view, 1, 3)) == (422, "round_conflict")
    # 마지막 경기만 있는 라운드에서 옮기면 그 라운드가 사라짐
    view = ok(delete_game(admin, view, by_round(view)[3][0]["no"]))
    view = ok(add(admin, view, [a[0], a[1]], [a[2], a[3]], 3))
    assert view["roundCount"] == 3
    # 확정 후에는 옮길 수 없음
    confirmed = confirm(admin, view)
    assert err(move(admin, confirmed, 1, 2)) == (409, "locked")


@ac("AC-150", "AC-139", "AC-158")
def test_swap_rejects_player_already_in_round(admin: TestClient, db: Session, ac_tag: str) -> None:
    view, _ = ready(admin, db, 12, courts=2, rounds=2)  # 라운드마다 8명, 4명 휴식
    r1 = by_round(view)[1]
    other = players(r1[1])[0]
    target = players(r1[0])[0]
    swap = {"from": target, "to": other}
    assert err(post(admin, view, f"games/{r1[0]['no']}/swap", **swap)) == (422, "round_conflict")
    resting = next(
        r["key"]
        for r in view["rows"]
        if r["participating"] and r["key"] not in {k for g in r1 for k in players(g)}
    )
    view = ok(post(admin, view, f"games/{r1[0]['no']}/swap", **{"from": target, "to": resting}))
    assert_round_rules(view)
    # 확정 후 교체도 같은 제약
    view = confirm(admin, view)
    r1 = by_round(view)[1]
    busy = players(r1[1])[0]
    res = post(admin, view, f"games/{r1[0]['no']}/swap", **{"from": players(r1[0])[0], "to": busy})
    assert err(res) == (422, "round_conflict")


# ── 확정·진행(AC-153–157·161, 기존 AC-077·081·085·109) ──


@ac("AC-153", "AC-165")
def test_confirm_rechecks_round_rules(admin: TestClient, db: Session, ac_tag: str) -> None:
    view, _ = ready(admin, db, 12, courts=2, rounds=2)
    # 저장소에 같은 라운드 중복 출전을 직접 만든 상태(다른 경로 우회 가정)
    mid = uuid.UUID(view["id"])
    g1, g2 = db.scalars(
        select(ClubMatchGame)
        .where(ClubMatchGame.match_id == mid, ClubMatchGame.round_no == 1)
        .order_by(ClubMatchGame.court_no)
    ).all()
    seat1 = db.scalars(select(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id == g1.id))
    seat2 = db.scalars(select(ClubMatchGamePlayer).where(ClubMatchGamePlayer.game_id == g2.id))
    p1 = next(iter(seat1))
    s2 = next(iter(seat2))
    s2.participant_id = p1.participant_id
    db.commit()
    assert err(post(admin, view, "confirm")) == (422, "round_conflict")
    m = db.get(ClubMatch, mid)
    db.refresh(m)
    assert m is not None and m.status == "draft" and m.version == view["version"]


@ac("AC-154", "AC-081", "AC-077")
def test_confirm_starts_round_one_and_locks_future_rounds(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, _ = ready(admin, db, 12, courts=2, rounds=3)
    view = confirm(admin, view)
    assert view["currentRound"] == 1
    r = by_round(view)
    ok(result(admin, view, r[1][0]["no"], 1))
    view = ok(admin.get(f"{BASE}/{view['id']}"))
    assert err(result(admin, view, r[2][0]["no"], 1)) == (409, "round_not_started")
    # 새로 불러와도 진행 라운드 유지(서버 저장)
    assert ok(admin.get(f"{BASE}/{view['id']}"))["currentRound"] == 1


@ac("AC-155")
def test_next_round_requires_all_processed_and_never_auto(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, _ = ready(admin, db, 12, courts=2, rounds=3)
    view = confirm(admin, view)
    first = by_round(view)[1][0]
    view = ok(result(admin, view, first["no"], 1))
    assert err(post(admin, view, "rounds/next")) == (409, "round_incomplete")
    view = record_round(admin, view, 1)
    assert view["currentRound"] == 1  # 결과를 모두 넣어도 자동으로 넘어가지 않음
    view = ok(post(admin, view, "rounds/next"))
    assert view["currentRound"] == 2
    view = record_round(admin, view, 2)
    view = ok(post(admin, view, "rounds/next"))
    assert view["currentRound"] == 3
    view = record_round(admin, view, 3)
    assert err(post(admin, view, "rounds/next")) == (422, "invalid_round")
    # 동시 조작: 이전 version으로 보내면 conflict
    stale = {**view, "version": view["version"] - 1}
    assert err(post(admin, stale, "rounds/next")) == (409, "conflict")


@ac("AC-156")
def test_undo_round_start_only_when_untouched(admin: TestClient, db: Session, ac_tag: str) -> None:
    view, _ = ready(admin, db, 12, courts=2, rounds=3)
    view = confirm(admin, view)
    assert err(post(admin, view, "rounds/undo")) == (422, "invalid_round")
    view = record_round(admin, view, 1)
    view = ok(post(admin, view, "rounds/next"))
    view = ok(post(admin, view, "rounds/undo"))
    assert view["currentRound"] == 1
    # 1라운드 미기록 되돌리기가 다시 가능
    view = ok(result(admin, view, by_round(view)[1][0]["no"], None))
    view = record_round(admin, view, 1)
    view = ok(post(admin, view, "rounds/next"))
    view = ok(result(admin, view, by_round(view)[2][0]["no"], 2))
    assert err(post(admin, view, "rounds/undo")) == (409, "round_has_results")


@ac("AC-157", "AC-109")
def test_past_round_change_allowed_but_not_revert(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, _ = ready(admin, db, 12, courts=2, rounds=2)
    view = confirm(admin, view)
    view = record_round(admin, view, 1)
    view = ok(post(admin, view, "rounds/next"))
    past = by_round(view)[1][0]
    view = ok(result(admin, view, past["no"], 2))  # 승패 바꾸기는 허용
    assert err(result(admin, view, past["no"], None)) == (409, "round_locked")
    cur = by_round(view)[2][0]
    view = ok(result(admin, view, cur["no"], 1))
    view = ok(result(admin, view, cur["no"], None))  # 진행 라운드는 되돌리기 가능


# ── 중도 귀가 취소·복원·집계(AC-159·160·161·164, 기존 AC-078·082·085·108) ──


def _leave(c: TestClient, view: Any, key: str, picks: dict[int, str], cancel: list[int]) -> Any:
    body = {"assignments": [{"gameNo": n, "to": t} for n, t in picks.items()], "cancel": cancel}
    return post(c, view, f"participants/{key}/leave", **body)


def _remaining(view: Any, key: str) -> list[Any]:
    return [
        g for g in view["games"] if g["winner"] is None and not g["cancelled"] and key in players(g)
    ]


@ac("AC-159", "AC-078")
def test_leave_candidates_are_round_resters_and_no_sub_needs_cancel(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    # 8명·코트 2: 라운드마다 8명 전원 출전 → 대체할 사람이 없음
    view, keys = ready(admin, db, 8, courts=2, rounds=3)
    view = confirm(admin, view)
    view = record_round(admin, view, 1)
    view = ok(post(admin, view, "rounds/next"))
    f = players(by_round(view)[2][0])[0]
    rem = [g["no"] for g in _remaining(view, f)]
    assert len(rem) == 2
    assert err(_leave(admin, view, f, {}, [])) == (422, "no_substitute")
    assert err(_leave(admin, view, f, {}, rem[:1])) == (422, "no_substitute")
    view = ok(_leave(admin, view, f, {}, rem))
    cancelled = [g for g in view["games"] if g["cancelled"]]
    assert [g["no"] for g in cancelled] == rem
    assert all(g["cancelled"]["reason"] == "left" for g in cancelled)
    assert next(r for r in view["rows"] if r["key"] == f)["left"]
    # 1라운드 결과는 그대로
    assert all(g["winner"] for g in by_round(view)[1])
    events = db.scalars(select(ClubMatchGameEvent).where(ClubMatchGameEvent.action == "cancel"))
    assert len(list(events)) == 2


@ac("AC-159")
def test_leave_rejects_cancel_with_candidates_and_double_use(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, keys = ready(admin, db, 10, courts=2, rounds=3)  # 라운드마다 2명 휴식
    view = confirm(admin, view)
    f = players(by_round(view)[1][0])[0]
    rem = _remaining(view, f)
    nos = [g["no"] for g in rem]
    assert err(_leave(admin, view, f, {}, nos)) == (422, "cancel_not_allowed")
    playing = {rd: {k for g in gs for k in players(g)} for rd, gs in by_round(view).items()}
    # 같은 라운드에 이미 출전하는 사람으로는 대체할 수 없음
    g0 = rem[0]
    busy = next(k for k in playing[g0["round"]] if k not in players(g0))
    picks = {g["no"]: busy for g in rem}
    assert err(_leave(admin, view, f, picks, [])) == (422, "round_conflict")
    rest = {g["no"]: sorted(set(keys) - playing[g["round"]] - {f})[0] for g in rem}
    view = ok(_leave(admin, view, f, rest, []))
    assert_round_rules(view)
    assert not any(g["cancelled"] for g in view["games"])


@ac("AC-160", "AC-082", "AC-084", "AC-045", "AC-053")
def test_cancelled_games_excluded_and_frozen(admin: TestClient, db: Session, ac_tag: str) -> None:
    view, keys = ready(admin, db, 8, courts=2, rounds=2)
    view = confirm(admin, view)
    view = record_round(admin, view, 1)
    view = ok(post(admin, view, "rounds/next"))
    f = players(by_round(view)[2][0])[0]
    rem = [g["no"] for g in _remaining(view, f)]
    view = ok(_leave(admin, view, f, {}, rem))
    gone = next(g for g in view["games"] if g["cancelled"])
    assert err(result(admin, view, gone["no"], 1)) == (409, "game_cancelled")
    other = next(k for k in keys if k not in players(gone))
    swap = {"from": players(gone)[1], "to": other}
    assert err(post(admin, view, f"games/{gone['no']}/swap", **swap)) == (409, "game_cancelled")
    # 순위표 경기 수·미기록에 취소 경기를 넣지 않음
    games_of = {s["key"]: s["games"] for s in view["standings"]}
    for k in players(gone):
        assert games_of.get(k, 0) == 1  # 1라운드 1경기만
    assert view["unrecorded"] == sum(
        1 for g in view["games"] if g["winner"] is None and not g["cancelled"]
    )
    # 진행 라운드의 나머지를 기록하면 처리 완료 → 종료 가능(마지막 라운드)
    view = record_round(admin, view, 2)
    view = ok(post(admin, view, "finish"))
    assert view["status"] == "finished"


@ac("AC-161", "AC-085")
def test_finish_requires_last_round_and_processed(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    view, _ = ready(admin, db, 8, courts=2, rounds=2)
    view = confirm(admin, view)
    view = record_round(admin, view, 1)
    assert err(post(admin, view, "finish")) == (409, "not_all_recorded")
    view = ok(post(admin, view, "rounds/next"))
    assert err(post(admin, view, "finish")) == (409, "not_all_recorded")
    view = record_round(admin, view, 2)
    assert ok(post(admin, view, "finish"))["status"] == "finished"


def _cancel_directly(db: Session, match_id: str, no: int) -> None:
    """AC-164 전제(두 경기가 취소된 상태)를 저장소에 직접 만듦: 현재 규칙(A3)에서는 대체 후보가
    생기면 다음 취소가 막혀 API만으로는 '두 경기 모두 취소'에 이를 수 없음(보고 대상)."""
    g = db.scalars(
        select(ClubMatchGame).where(
            ClubMatchGame.match_id == uuid.UUID(match_id), ClubMatchGame.no == no
        )
    ).one()
    from datetime import UTC, datetime

    g.cancelled_at = datetime.now(UTC)
    g.cancel_reason = "left"
    db.commit()


@ac("AC-164")
def test_restore_blocked_cases(admin: TestClient, db: Session, ac_tag: str) -> None:
    # 8명·코트 2·3라운드: 2라운드 진행 중 F 귀가 → 2·3라운드 경기 취소(휴식자 없음)
    view, keys = ready(admin, db, 8, courts=2, rounds=3)
    view = confirm(admin, view)
    view = record_round(admin, view, 1)
    view = ok(post(admin, view, "rounds/next"))
    f = players(by_round(view)[2][0])[0]
    view = ok(_leave(admin, view, f, {}, [g["no"] for g in _remaining(view, f)]))
    x2 = next(g for g in view["games"] if g["cancelled"] and g["round"] == 2)
    x3 = next(g for g in view["games"] if g["cancelled"] and g["round"] == 3)
    # 대체 없이 → restore_blocked(후보 없음), 귀가 상태는 그대로
    res = post(admin, view, f"games/{x3['no']}/restore", replacements={})
    assert err(res) == (422, "restore_blocked")
    assert res.json()["error"]["details"]["keys"] == [f]
    # 같은 라운드의 살아 있는 경기 출전자로는 round_conflict
    busy = players(next(g for g in by_round(view)[3] if not g["cancelled"]))[0]
    res = post(admin, view, f"games/{x3['no']}/restore", replacements={f: busy})
    assert err(res) == (422, "round_conflict")
    # 취소되지 않은 경기·귀가 선수가 아닌 자리 → restore_not_allowed / conflict
    live = next(g for g in view["games"] if not g["cancelled"] and g["round"] == 3)
    assert err(post(admin, view, f"games/{live['no']}/restore")) == (409, "restore_not_allowed")
    # 진행 라운드가 지나면 round_locked
    view = record_round(admin, view, 2)
    view = ok(post(admin, view, "rounds/next"))
    res = post(admin, view, f"games/{x2['no']}/restore", replacements={f: keys[0]})
    assert err(res) == (409, "round_locked")
    assert next(r for r in view["rows"] if r["key"] == f)["left"]


@ac("AC-164", "AC-088")
def test_restore_success_records_event_and_unrecorded(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    # AC-164 전제: 3라운드 진행 중, G의 경기 Y는 중도 귀가로 취소(대체 후보 없음),
    # F의 경기 X도 취소된 상태 → X를 Y의 선수 H로 F 자리를 채워 복원
    view, keys = ready(admin, db, 8, courts=2, rounds=3)
    view = confirm(admin, view)
    for rd in (1, 2):
        view = record_round(admin, view, rd)
        view = ok(post(admin, view, "rounds/next"))
    x, y = by_round(view)[3]
    g_ = players(y)[0]
    view = ok(_leave(admin, view, g_, {}, [y["no"]]))
    f = players(x)[0]
    team_f = next(r for r in view["rows"] if r["key"] == f)
    _cancel_directly(db, view["id"], x["no"])
    from app.modules.clubmatch.models import ClubMatchParticipant

    part = db.scalars(
        select(ClubMatchParticipant).where(ClubMatchParticipant.match_id == uuid.UUID(view["id"]))
    ).all()
    from datetime import UTC, datetime

    for p in part:
        if f == f"member:{p.user_id}":
            p.left_at = datetime.now(UTC)
    db.commit()
    view = ok(admin.get(f"{BASE}/{view['id']}"))
    assert team_f["left"] is False and next(r for r in view["rows"] if r["key"] == f)["left"]
    h = players(y)[1]  # Y가 취소되어 3라운드 출전으로 세지 않음
    view = ok(post(admin, view, f"games/{x['no']}/restore", replacements={f: h}))
    back = next(g for g in view["games"] if g["no"] == x["no"])
    assert back["cancelled"] is None and back["winner"] is None and back["changed"]
    assert h in players(back) and f not in players(back)
    assert view["modifiedAt"] is not None
    assert next(r for r in view["rows"] if r["key"] == f)["left"]  # 귀가 상태 그대로
    events = list(db.scalars(select(ClubMatchGameEvent)))
    restore = [e for e in events if e.action == "restore"]
    assert len(restore) == 1 and restore[0].detail == {f: h}
    assert_round_rules(view)
    # 복원된 경기는 미기록이라 3라운드가 다시 처리 전 → 종료 불가
    assert err(post(admin, view, "finish")) == (409, "not_all_recorded")
    view = record_round(admin, view, 3)
    view = ok(post(admin, view, "finish"))
    code = err(post(admin, view, f"games/{y['no']}/restore", replacements={}))
    assert code == (409, "restore_not_allowed")


# ── 기존 청백전 호환·권한(AC-163) ──


@ac("AC-163")
def test_legacy_match_keeps_old_behavior_and_draft_converts(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    keys = mkeys(db, 8)
    res = admin.post(BASE, json={"method": "individual", "date": "2026-11-26", "name": "기존"})
    view = ok(admin.get(f"{BASE}/{res.json()['id']}"))
    assert view["courtCount"] is None
    view = ok(participants(admin, view, keys))
    view = ok(post(admin, view, "games", totalGames=4, rules=RULES))
    assert len(view["games"]) == 4 and all(g["round"] is None for g in view["games"])
    # 기존 청백전에는 라운드 API를 쓰지 않음
    assert err(move(admin, view, 1, 1)) == (422, "invalid_round")
    # 준비 중 기존 청백전에 코트 수를 정하면 대진 폐기 확인 → 라운드 기반으로
    assert err(basic(admin, view, courtCount=4)) == (409, "confirm_required")
    view = ok(basic(admin, view, courtCount=4, discard=True))
    assert view["courtCount"] == 4 and view["games"] == []
    view = ok(post(admin, view, "games", rules=RULES))
    assert_round_rules(view)
    # 확정된 기존 청백전은 다음 라운드 API를 쓰지 않음
    res = admin.post(BASE, json={"method": "individual", "date": "2026-11-26", "name": "기존2"})
    old = ok(admin.get(f"{BASE}/{res.json()['id']}"))
    old = ok(participants(admin, old, keys))
    old = confirm(admin, ok(post(admin, old, "games", totalGames=2, rules=RULES)))
    assert old["currentRound"] is None
    assert err(post(admin, old, "rounds/next")) == (422, "invalid_round")
    assert err(_leave(admin, old, keys[0], {}, [1])) == (422, "cancel_not_allowed")


def test_round_endpoints_need_admin(make_client: Any, db: Session) -> None:
    c = make_client()
    make_user(db, name="회원", kakao_id="9401")
    kakao_login(c, "9401")
    mid = uuid.uuid4()
    for path in ("rounds/next", "rounds/undo", "games/1/move", "games/1/restore"):
        assert c.post(f"{BASE}/{mid}/{path}", json={"version": 1, "round": 1}).status_code == 403


@ac("AC-162")
def test_member_view_has_round_fields_and_excludes_cancelled(
    admin: TestClient, make_client: Any, db: Session, ac_tag: str
) -> None:
    view, keys = ready(admin, db, 8, courts=2, rounds=2)
    view = confirm(admin, view)
    view = record_round(admin, view, 1)
    view = ok(post(admin, view, "rounds/next"))
    f = players(by_round(view)[2][0])[0]
    view = ok(_leave(admin, view, f, {}, [g["no"] for g in _remaining(view, f)]))
    mem = make_client()
    make_user(db, name="보는회원", kakao_id="9402")
    kakao_login(mem, "9402")
    detail = ok(mem.get(f"/api/member/club-matches/{view['id']}"))
    assert detail["currentRound"] == 2
    games = detail["games"]
    assert all({"round", "court", "cancelled"} <= set(g) for g in games)
    assert sum(1 for g in games if g["cancelled"]) == 1
    assert detail["unrecorded"] == sum(
        1 for g in games if g["winner"] is None and not g["cancelled"]
    )
