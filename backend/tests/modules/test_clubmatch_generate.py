"""청백전 I3-b — 대진 생성 서버 이전(D1).

AC 매핑: AC-043 2 대 2·팀전 청2:백2 / AC-071·075 다시 생성(새 시드) / AC-073 경기 수 차이 ≤1 /
AC-076 같은 4명·같은 팀 금지·파트너 반복 최소화 / U7 피할 수 없는 반복만 허용 + 사유 /
U8 최소 4명·팀당 2명 / ASM-026 20명·20경기 2초 / C-19·U9 version
골든 파일(`tests/golden/clubmatch_generate.json`)은
FE `generate.golden.test.ts`가 TS 엔진으로 만듭니다.
"""

import json
import random
import time
import uuid
from collections import Counter
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.clubmatch import schedule as s
from app.modules.clubmatch.models import ClubMatch
from app.modules.roster.models import MemberRating
from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user

GOLDEN: dict[str, Any] = json.loads(
    (Path(__file__).resolve().parents[1] / "golden" / "clubmatch_generate.json").read_text("utf-8")
)
BASE = "/api/club-matches"
Factory = Callable[[], TestClient]


def players_of(case: dict[str, Any]) -> list[s.ClubPlayer]:
    return [s.ClubPlayer(p["key"], p["gender"], p["score"], p["team"]) for p in case["players"]]


def run(case: dict[str, Any]) -> list[s.ClubGame]:
    r = case["rules"]
    return s.generate_club_games(
        players_of(case),
        case["totalGames"],
        case["method"],
        r["balance"],
        r["gender"],
        case["seed"],
    )


def rows(games: list[s.ClubGame]) -> list[list[object]]:
    return [[*g.team1, *g.team2, int(g.gender_relaxed), int(g.repeated_matchup)] for g in games]


def random_cases(
    n: int, seed: int = 1
) -> list[tuple[list[s.ClubPlayer], int, s.Method, bool, bool, int]]:
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        size = rnd.randint(4, 20)
        team = rnd.random() < 0.4
        blue = rnd.randint(2, size - 2) if team else 0
        ps = [
            s.ClubPlayer(
                f"member:p{j:02d}",
                rnd.choice("남여"),
                rnd.randint(1, 10),
                ("blue" if j < blue else "white") if team else None,
            )
            for j in range(size)
        ]
        method: s.Method = "team" if team else "individual"
        out.append(
            (
                ps,
                rnd.randint(1, 40),
                method,
                rnd.random() < 0.5,
                rnd.random() < 0.5,
                rnd.randrange(2**31),
            )
        )
    return out


# ── TS ↔ Python 일치 ──


@pytest.mark.parametrize("row", GOLDEN["rng"], ids=lambda r: str(r["seed"]))
def test_mulberry32_matches_typescript(row: dict[str, Any]) -> None:
    r = s.rng(row["seed"])
    assert [r() for _ in range(12)] == row["values"]  # 부동소수까지 정확히 같음


def test_golden_covers_boundaries() -> None:
    names = {c["name"] for c in GOLDEN["generate"]}
    assert len(GOLDEN["generate"]) >= 200
    assert {"ind-4x1", "ind-20x20", "team-2v2x5 (조합 1가지)", "team-10v10x20"} <= names
    seeds = {r["seed"] for r in GOLDEN["rng"]}
    assert {0, 2**31 - 1, 2**32 - 1, 2**32} <= seeds
    rules = {(c["rules"]["balance"], c["rules"]["gender"]) for c in GOLDEN["generate"]}
    assert len(rules) == 4


@pytest.mark.parametrize(
    "case",
    GOLDEN["generate"],
    ids=lambda c: (
        f"{c['name']}-{c['seed']}-{int(c['rules']['balance'])}{int(c['rules']['gender'])}"
    ),
)
def test_generate_matches_typescript(case: dict[str, Any]) -> None:
    assert rows(run(case)) == case["games"]


def test_seed_wraps_like_javascript() -> None:
    a, b = s.rng(2**32), s.rng(0)
    assert [a() for _ in range(5)] == [b() for _ in range(5)]  # seed >>> 0


def test_reproducible_and_seed_sensitive() -> None:
    case = next(c for c in GOLDEN["generate"] if c["name"] == "ind-20x20")
    assert rows(run(case)) == rows(run(case))
    other = dict(case, seed=case["seed"] + 1)
    assert rows(run(other)) != rows(run(case))


# ── 대진 성질(AC-043·073·076) ──


def test_properties_on_golden_and_random_inputs() -> None:
    inputs = [
        (
            players_of(c),
            c["totalGames"],
            c["method"],
            c["rules"]["balance"],
            c["rules"]["gender"],
            c["seed"],
        )
        for c in GOLDEN["generate"]
    ] + random_cases(300)
    for ps, total, method, balance, gender, seed in inputs:
        games = s.generate_club_games(ps, total, method, balance, gender, seed)
        assert [g.no for g in games] == list(range(1, total + 1))
        team_of = {p.key: p.team for p in ps}
        counts: Counter[str] = Counter()
        for g in games:
            four = [*g.team1, *g.team2]
            assert len(set(four)) == 4  # 한 경기에 같은 사람 두 번 없음
            if method == "team":  # 청 2 대 백 2
                assert [team_of[k] for k in four] == ["blue", "blue", "white", "white"]
            counts.update(four)
        if method == "team":
            for team in ("blue", "white"):
                vals = [counts[p.key] for p in ps if p.team == team]
                assert max(vals) - min(vals) <= 1
        else:
            vals = [counts[p.key] for p in ps]
            assert max(vals) - min(vals) <= 1  # 경기 수 차이 ≤ 1(C-14)


# ── U7 같은 4명·같은 팀: 피할 수 있으면 피함, 소진됐을 때만 허용 ──


def test_u7_every_repeat_in_golden_and_random_is_truly_exhausted() -> None:
    checked = 0
    inputs = [
        (
            players_of(c),
            c["totalGames"],
            c["method"],
            c["rules"]["balance"],
            c["rules"]["gender"],
            c["seed"],
        )
        for c in GOLDEN["generate"]
    ] + random_cases(500, seed=7)
    for ps, total, method, balance, gender, seed in inputs:
        games = s.generate_club_games(ps, total, method, balance, gender, seed)
        rel = s.relaxations(ps, games, method, gender)
        for g in games:
            matchup = [x for x in rel.get(g.no, []) if x["rule"] == "matchup"]
            assert bool(matchup) == g.repeated_matchup
            if matchup:
                checked += 1
                assert matchup[0]["reason"] == "exhausted", (ps, total, method, seed, g.no)
    assert checked > 500  # 소진 사례가 충분히 들어 있음


def test_u7_four_players_exhaust_three_splits_then_repeat() -> None:
    ps = [s.ClubPlayer(f"member:p{i}", "남", 5) for i in range(4)]
    games = s.generate_club_games(ps, 5, "individual", True, False, 3)
    assert [g.repeated_matchup for g in games] == [False, False, False, True, True]
    rel = s.relaxations(ps, games, "individual", False)
    assert rel == {
        4: [{"rule": "matchup", "reason": "exhausted"}],
        5: [{"rule": "matchup", "reason": "exhausted"}],
    }


def test_u7_team_two_vs_two_has_one_matchup() -> None:
    ps = [s.ClubPlayer(f"member:p{i}", "남", 5, "blue" if i < 2 else "white") for i in range(4)]
    games = s.generate_club_games(ps, 3, "team", True, True, 11)
    assert [g.repeated_matchup for g in games] == [False, True, True]


def test_u7_checker_flags_an_avoidable_repeat_as_search_limit() -> None:
    """벌점이 붙었다는 사실로 '불가피'라 하지 않음.

    다른 분할이 남아 있는데 반복하면 search_limit.
    """
    ps = [s.ClubPlayer(f"member:p{i}", "남", 5) for i in range(4)]
    k = [p.key for p in ps]
    games = [
        s.ClubGame(1, (k[0], k[1]), (k[2], k[3]), False, False),
        s.ClubGame(2, (k[0], k[1]), (k[2], k[3]), False, True),  # (0,2)/(1,3) 등이 남아 있음
    ]
    assert s.relaxations(ps, games, "individual", False) == {
        2: [{"rule": "matchup", "reason": "search_limit"}]
    }


def test_gender_relaxation_reasons() -> None:
    men3 = [s.ClubPlayer("member:a", "남", 5), s.ClubPlayer("member:b", "남", 5)]
    men3 += [s.ClubPlayer("member:c", "남", 5), s.ClubPlayer("member:d", "여", 5)]
    games = s.generate_club_games(men3, 1, "individual", False, True, 1)
    assert games[0].gender_relaxed  # 남3·여1은 어떤 조합도 규칙 위반
    assert s.relaxations(men3, games, "individual", True) == {
        1: [{"rule": "gender", "reason": "exhausted"}]
    }
    mixed = [
        s.ClubPlayer("member:a", "남", 5),
        s.ClubPlayer("member:b", "남", 5),
        s.ClubPlayer("member:c", "여", 5),
        s.ClubPlayer("member:d", "여", 5),
    ]
    forced = [s.ClubGame(1, ("member:a", "member:b"), ("member:c", "member:d"), True, False)]
    assert s.relaxations(mixed, forced, "individual", True) == {
        1: [{"rule": "gender", "reason": "search_limit"}]  # 혼복 분할이 있었음
    }
    assert s.relaxations(mixed, forced, "individual", False) == {}  # 성별 규칙을 끄면 완화 아님


# ── 성능(ASM-026) ──


def test_performance_20_players_20_games_under_2s() -> None:
    worst = 0.0
    for gender in (True, False):
        for balance in (True, False):
            for method in ("individual", "team"):
                ps = [
                    s.ClubPlayer(
                        f"member:p{i:02d}",
                        "남" if i % 3 else "여",
                        1 + i % 10,
                        ("blue" if i < 10 else "white") if method == "team" else None,
                    )
                    for i in range(20)
                ]
                for seed in (1, 2**31 - 1, 12345):
                    t = time.perf_counter()
                    games = s.generate_club_games(ps, 20, method, balance, gender, seed)
                    s.relaxations(ps, games, method, gender)
                    worst = max(worst, time.perf_counter() - t)
    assert worst < 2.0, worst


# ── API(SCR-223, AC-071·075, U8·U9) ──


@pytest.fixture
def admin(make_client: Factory, db: Session) -> TestClient:
    c = make_client()
    make_user(db, name="운영진", role="admin", kakao_id="9101")
    kakao_login(c, "9101")
    return c


def member(db: Session, name: str, gender: str = "남", score: int | None = 5) -> User:
    u = make_user(db, name=name, gender=gender)
    if score is not None:
        db.add(MemberRating(user_id=u.id, score=score))
        db.commit()
    return u


def setup(c: TestClient, db: Session, n: int, method: str = "individual", total: int = 6) -> dict:  # type: ignore[type-arg]
    created = {"method": method, "date": "2026-11-15", "name": "생성"}
    view = c.get(f"{BASE}/{c.post(BASE, json=created).json()['id']}").json()
    for i in range(n):
        u = member(db, f"선수{i:02d}", "여" if i % 2 else "남", score=1 + i % 10)
        key = f"member:{u.id}"
        if method == "team":
            body: dict[str, object] = {
                "team": "blue" if i % 2 == 0 else "white",
                "version": view["version"],
            }
            view = c.put(f"{BASE}/{view['id']}/teams/{key}", json=body).json()
        else:
            body = {"participating": True, "version": view["version"]}
            view = c.put(f"{BASE}/{view['id']}/participants/{key}", json=body).json()
    rules = {"balance": True, "gender": True}
    return c.put(  # type: ignore[no-any-return]
        f"{BASE}/{view['id']}/settings",
        json={"totalGames": total, "rules": rules, "version": view["version"]},
    ).json()


def gen(c: TestClient, view: dict) -> Any:  # type: ignore[type-arg]
    return c.post(f"{BASE}/{view['id']}/games", json={"version": view["version"]})


def test_api_generate_and_regenerate(admin: TestClient, db: Session) -> None:
    view = setup(admin, db, 8, total=6)
    res = gen(admin, view)
    assert res.status_code == 200, res.text
    v1 = res.json()
    assert len(v1["games"]) == 6 and v1["version"] == view["version"] + 1
    assert all(len(g["team1"]) == 2 and len(g["team2"]) == 2 for g in v1["games"])
    played = [r["games"] for r in v1["rows"] if r["participating"]]
    assert max(played) - min(played) <= 1  # AC-073
    assert all("relaxations" in g and "repeatedMatchup" in g for g in v1["games"])
    m = db.get(ClubMatch, uuid.UUID(v1["id"]))
    db.refresh(m)
    assert m is not None and m.seed is not None and 0 <= m.seed < 2**31
    # 저장된 시드로 엔진을 다시 돌리면 같은 대진(결정성)
    keys = {r["key"]: r for r in v1["rows"] if r["participating"]}
    ps = [s.ClubPlayer(k, r["gender"], r["score"]) for k, r in keys.items()]
    again = s.generate_club_games(ps, 6, "individual", True, True, m.seed)
    assert [[*g.team1, *g.team2] for g in again] == [
        [p["key"] for p in g["team1"] + g["team2"]] for g in v1["games"]
    ]
    v2 = gen(admin, v1).json()  # 다시 생성(AC-075): 대진 교체
    assert len(v2["games"]) == 6 and v2["version"] == v1["version"] + 1
    stale = gen(admin, v1)  # 이전 화면 version
    assert (stale.status_code, stale.json()["error"]["code"]) == (409, "conflict")


def test_api_generated_games_lock_participant_removal(admin: TestClient, db: Session) -> None:
    view = gen(admin, setup(admin, db, 4, total=1)).json()
    key = view["games"][0]["team1"][0]["key"]
    res = admin.put(
        f"{BASE}/{view['id']}/participants/{key}",
        json={"participating": False, "version": view["version"]},
    )
    assert res.json()["error"]["code"] == "in_games"
    after = admin.put(
        f"{BASE}/{view['id']}/method", json={"method": "team", "version": view["version"]}
    ).json()
    assert after["games"] == []  # 방식 변경은 대진 폐기(AC-070)


def test_api_u7_repeat_reported_with_reason(admin: TestClient, db: Session) -> None:
    view = gen(admin, setup(admin, db, 4, total=5)).json()
    flags = [g["repeatedMatchup"] for g in view["games"]]
    assert flags == [False, False, False, True, True]
    for g in view["games"]:
        matchup = [x for x in g["relaxations"] if x["rule"] == "matchup"]
        assert matchup == (
            [{"rule": "matchup", "reason": "exhausted"}] if g["repeatedMatchup"] else []
        )


def test_api_u8_min_players(admin: TestClient, db: Session) -> None:
    three = setup(admin, db, 3)
    res = gen(admin, three)
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "min_players"
    assert err["details"] == {
        "minTotal": 4,
        "minPerTeam": None,
        "count": 3,
        "blue": None,
        "white": None,
    }
    team = setup(admin, db, 3, method="team")  # 청 2 · 백 1
    err = gen(admin, team).json()["error"]
    assert err["code"] == "min_players" and (err["details"]["blue"], err["details"]["white"]) == (
        2,
        1,
    )
    assert err["details"]["minPerTeam"] == 2
    assert admin.get(f"{BASE}/{team['id']}").json()["version"] == team["version"]  # 변경 없음


def test_api_unscored_checked_before_min_players(admin: TestClient, db: Session) -> None:
    view = setup(admin, db, 2)
    u = member(db, "점수없음", score=None)
    view = admin.put(
        f"{BASE}/{view['id']}/participants/member:{u.id}",
        json={"participating": True, "version": view["version"]},
    ).json()
    err = gen(admin, view).json()["error"]
    assert err["code"] == "unscored_players" and err["details"] == {"keys": [f"member:{u.id}"]}


def test_api_generate_locked_after_confirm(admin: TestClient, db: Session) -> None:
    view = gen(admin, setup(admin, db, 4, total=2)).json()
    m = db.get(ClubMatch, uuid.UUID(view["id"]))
    assert m is not None
    m.status = "confirmed"
    db.commit()
    assert gen(admin, view).json()["error"]["code"] == "locked"


def test_api_generate_admin_only(make_client: Factory, db: Session, admin: TestClient) -> None:
    view = setup(admin, db, 4)
    m = make_client()
    make_user(db, name="회원", kakao_id="9102")
    kakao_login(m, "9102")
    assert gen(m, view).status_code == 403


def test_api_performance_20_by_20(admin: TestClient, db: Session) -> None:
    view = setup(admin, db, 20, total=20)
    t = time.perf_counter()
    res = gen(admin, view)
    elapsed = time.perf_counter() - t
    assert res.status_code == 200 and len(res.json()["games"]) == 20
    assert elapsed < 2.0, elapsed  # 저장·응답까지 포함


def test_member_cannot_reach_any_clubmatch_or_roster_route(
    make_client: Factory, db: Session
) -> None:
    """AC-017·066: 점수·실력차·급수·게스트 정보가 있는 운영 경로는 회원에게 전부 403.

    라우트 목록을 앱에서 직접 읽어, 앞으로 경로가 늘어도 빠짐없이 확인합니다.
    """
    from app.main import create_app

    m = make_client()
    make_user(db, name="회원", kakao_id="9103")
    kakao_login(m, "9103")
    some = str(uuid.uuid4())
    checked = 0
    for raw, ops in create_app().openapi()["paths"].items():
        if not raw.startswith(("/api/club-matches", "/api/roster")):
            continue
        path = raw
        for name in ("match_id", "user_id", "guest_id"):
            path = path.replace("{" + name + "}", some)
        path = path.replace("{key}", f"member:{some}").replace("{no}", "1")
        for method in ops:
            res = m.request(method.upper(), path, json={})
            assert res.status_code == 403, (method, path, res.status_code)
            checked += 1
    assert checked >= 15


def test_i3c_gender_search_never_leaves_an_avoidable_violation() -> None:
    """I3-c 성별 탐색 보강: 60회 탐색 뒤 전수 보강으로 성별 search_limit가 0건.

    (보강 전 TS 알고리즘은 무작위 2,000건에서 158건이 search_limit였음 — 보고서 참조)
    """
    inputs = [
        (
            players_of(c),
            c["totalGames"],
            c["method"],
            c["rules"]["balance"],
            c["rules"]["gender"],
            c["seed"],
        )
        for c in GOLDEN["generate"]
    ] + random_cases(500, seed=11)
    reasons: Counter[str] = Counter()
    for ps, total, method, balance, gender, seed in inputs:
        games = s.generate_club_games(ps, total, method, balance, gender, seed)
        for found in s.relaxations(ps, games, method, gender).values():
            reasons.update(x["reason"] for x in found if x["rule"] == "gender")
    assert reasons["search_limit"] == 0
    assert reasons["exhausted"] > 100  # 성별 위반이 불가피한 사례는 충분히 들어 있음
