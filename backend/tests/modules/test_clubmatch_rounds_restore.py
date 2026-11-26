"""AC-164(취소 경기 복원) 전제 상태의 실제 API 도달 가능성(B15 승인 전 추가 확인).

확인할 시나리오(사용자 요청): 같은 라운드에 경기 여럿 → 중도 귀가·대체 부족으로 첫 경기 취소 →
추가 중도 귀가로 같은 라운드의 다른 경기 취소 → 그 경기의 정상 참가자가 라운드 출전에서 빠짐 →
그 사람을 대체 선수로 지정해 첫 취소 경기 복원.

승인된 정책(C-37 Q-032 A3: 대체 후보가 없는 경기만 취소,
후보 = 그 라운드에 출전하지 않는 적격 참가자, 팀전은 같은 팀)을 바꾸지 않고
API만으로 시도합니다. 정책·검사 조건을 완화하지 않습니다.

- 시나리오 테스트: 개인전·팀전에서 위 단계를 그대로 밟고, 막히는 지점과 오류 코드를 확인
- 무작위 탐색: 시드 고정 무작위 API 순서(중도 귀가·교체·결과 입력)를 반복하고,
  매 단계 모든 취소 경기에 가능한 모든 대체 조합으로 복원을 요청해 한 번도 성공하지 않음을 확인
"""

import itertools
import random
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.modules.test_clubmatch_flow import BASE, err, ok, post, result
from tests.modules.test_clubmatch_rounds import (
    _leave,
    ac,
    add,
    confirm,
    new_round_match,
    players,
)
from tests.modules.test_clubmatch_setup import (
    admin,  # noqa: F401 — pytest 픽스처
    mkeys,
    participants,
    teams,
)

__all__ = ["admin"]


def restore(c: TestClient, view: Any, no: int, repl: dict[str, str]) -> Any:
    return post(c, view, f"games/{no}/restore", replacements=repl)


def one_round(c: TestClient, keys: list[str], method: str) -> Any:
    """코트 2·1라운드 확정: 1번 경기 k0·k1 대 k2·k3, 2번 경기 k4·k5 대 k6·k7(나머지는 휴식).

    팀전은 k0·k1·k4·k5(+ 짝수 번째 추가 인원) 청, k2·k3·k6·k7(+ 홀수 번째) 백.
    """
    view = ok(participants(c, new_round_match(c, method, courts=2), keys))
    if method == "team":
        blue = {keys[i] for i in (0, 1, 4, 5)} | set(keys[8::2])
        view = ok(teams(c, view, {k: "blue" if k in blue else "white" for k in keys}))
    view = ok(add(c, view, keys[0:2], keys[2:4], 1))
    view = ok(add(c, view, keys[4:6], keys[6:8], 1))
    return confirm(c, view)


def game(view: Any, no: int) -> Any:
    return next(g for g in view["games"] if g["no"] == no)


# ── 시나리오: 사용자 요청 단계 그대로 ──


@ac("AC-164", "AC-159")
def test_individual_second_cancel_needs_first_games_players_gone(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    k = mkeys(db, 8, "개인")
    view = one_round(admin, k, "individual")
    # 1) k0 귀가: 1라운드에 남는 사람이 없음 → 1번 경기 취소
    view = ok(_leave(admin, view, k[0], {}, [1]))
    assert game(view, 1)["cancelled"]
    # 2) k4 귀가로 2번 경기 취소 시도:
    # 취소된 1번 경기의 k1·k2·k3이 1라운드 출전으로 세지 않아 후보 → 취소 불가
    res = _leave(admin, view, k[4], {}, [2])
    assert err(res) == (422, "cancel_not_allowed")
    # 2-a) (같은 단계의 다른 청백전) 후보가 있으니 대체가 정답:
    # k1로 대체하면 k1은 2번 경기에 출전 중이라
    # 1번 경기(k1 자리 포함)를 복원하면 같은 라운드 중복 → round_conflict
    alt = ok(_leave(admin, one_round(admin, k, "individual"), k[0], {}, [1]))
    alt = ok(_leave(admin, alt, k[4], {2: k[1]}, []))
    res = restore(admin, alt, 1, {})
    assert err(res) == (422, "restore_blocked")
    assert res.json()["error"]["details"]["candidates"] == {k[0]: 0}
    assert err(restore(admin, alt, 1, {k[0]: k[5]})) == (422, "round_conflict")
    # 3) 2번 경기를 취소하려면 k1·k2·k3이 먼저 귀가해야 함(1라운드 경기가 없어 바로 처리)
    for x in k[1:4]:
        view = ok(_leave(admin, view, x, {}, []))
    view = ok(_leave(admin, view, k[4], {}, [2]))
    assert game(view, 2)["cancelled"]
    # 4) 2번 경기의 k5·k6·k7은 1라운드 출전에서 빠졌지만,
    # 1번 경기는 귀가 자리가 4개(k0–k3) → 3명으로 못 채움
    res = restore(admin, view, 1, {k[0]: k[5], k[1]: k[6], k[2]: k[7]})
    assert err(res) == (422, "restore_blocked")
    assert res.json()["error"]["details"]["keys"] == [k[3]]
    full = {k[0]: k[5], k[1]: k[6], k[2]: k[7], k[3]: k[5]}
    assert err(restore(admin, view, 1, full)) == (422, "duplicate_player")
    # 2번 경기도 귀가 자리(k4)에 넣을 사람이 없음(k0–k3 귀가)
    res = restore(admin, view, 2, {})
    assert err(res) == (422, "restore_blocked")
    assert res.json()["error"]["details"]["candidates"] == {k[4]: 0}


@ac("AC-164", "AC-159")
def test_team_second_cancel_needs_first_games_same_team_gone(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    k = mkeys(db, 8, "팀원")  # 청 k0·k1·k4·k5, 백 k2·k3·k6·k7
    view = one_round(admin, k, "team")
    # 1) 청 k0 귀가: 1라운드에 쉬는 청팀이 없음 → 1번 경기 취소
    view = ok(_leave(admin, view, k[0], {}, [1]))
    # 2) 2번 경기 취소 시도: 백 k6 귀가 → 백 k2·k3이, 청 k4 귀가 → 청 k1이 후보 → 취소 불가
    assert err(_leave(admin, view, k[6], {}, [2])) == (422, "cancel_not_allowed")
    assert err(_leave(admin, view, k[4], {}, [2])) == (422, "cancel_not_allowed")
    # 3-a) 청 k1이 먼저 귀가하면 청 k4 귀가로 2번 경기 취소 가능
    a = ok(_leave(admin, view, k[1], {}, []))
    a = ok(_leave(admin, a, k[4], {}, [2]))
    # 4-a) 2번 경기의 청 k5가 빠졌지만 1번 경기 청 자리는 둘(k0·k1) → 청 한 명으로 못 채움
    res = restore(admin, a, 1, {k[0]: k[5]})
    assert err(res) == (422, "restore_blocked")
    assert res.json()["error"]["details"]["keys"] == [k[1]]
    assert err(restore(admin, a, 1, {k[0]: k[5], k[1]: k[5]})) == (422, "duplicate_player")


@ac("AC-164", "AC-159")
def test_team_second_cancel_after_substitution_leaves_no_candidate(
    admin: TestClient, db: Session, ac_tag: str
) -> None:
    k = mkeys(db, 8, "팀대")
    view = one_round(admin, k, "team")
    view = ok(_leave(admin, view, k[0], {}, [1]))
    # 3-b) 청 k4 귀가 → 쉬는 청 k1로 대체(취소 불가),
    # 이어서 청 k5 귀가 → 쉬는 청 없음 → 2번 경기 취소
    view = ok(_leave(admin, view, k[4], {2: k[1]}, []))
    view = ok(_leave(admin, view, k[5], {}, [2]))
    assert game(view, 2)["cancelled"]
    # 4-b) 2번 경기가 취소되어 k1은 1라운드 출전에서 빠졌지만 k1은 이미 1번 경기 자리.
    # k0 자리에 넣을 다른 청(k4·k5)은 귀가 → 후보 0
    res = restore(admin, view, 1, {})
    assert err(res) == (422, "restore_blocked")
    assert res.json()["error"]["details"]["candidates"] == {k[0]: 0}
    # k1을 k0 자리에 넣으면 이미 그 경기 자리에 있는 사람 → conflict(서버 _replace)
    assert err(restore(admin, view, 1, {k[0]: k[1]})) == (409, "conflict")


# ── 무작위 API 탐색: 어떤 순서로도 복원 성공 상태에 이르지 않음 ──


def _free(view: Any, rd: int) -> set[str]:
    busy = {p for g in view["games"] if g["round"] == rd and not g["cancelled"] for p in players(g)}
    return {
        r["key"]
        for r in view["rows"]
        if r["participating"] and not r["left"] and r["available"] and r["key"] not in busy
    }


def _team(view: Any) -> dict[str, str | None]:
    return {r["key"]: r["team"] for r in view["rows"] if r["participating"]}


def _try_all_restores(c: TestClient, view: Any) -> int:
    """취소된 모든 경기에 가능한 모든 대체 조합으로 복원 요청(귀가하지 않은 다른 참가자, 팀 무관).

    보낸 요청 수를 돌려줌.
    """
    left = {r["key"] for r in view["rows"] if r["left"]}
    alive = [r["key"] for r in view["rows"] if r["participating"] and not r["left"]]
    sent = 0
    for g in [x for x in view["games"] if x["cancelled"]]:
        seats = players(g)
        gone = [p for p in seats if p in left]
        pool = [p for p in alive if p not in seats]
        picks = itertools.permutations(pool, len(gone))
        tries = [dict(zip(gone, pick, strict=True)) for pick in picks]
        for repl in [{}, *tries]:
            res = restore(c, view, g["no"], repl)
            sent += 1
            assert res.status_code != 200, (g["no"], repl, view["games"])
    return sent


WALKS = [("individual", 8), ("individual", 10), ("team", 8), ("team", 10)]


@ac("AC-164")
@pytest.mark.parametrize(("method", "n"), WALKS)
def test_random_api_walks_never_reach_restorable_cancel(
    admin: TestClient, db: Session, ac_tag: str, method: str, n: int
) -> None:
    keys = mkeys(db, n, f"탐색{method}{n}")
    rng = random.Random(f"AC-164-{method}-{n}")
    two_cancelled = 0
    restores = 0
    for _ in range(25):
        view = one_round(admin, keys, method)
        for _ in range(10):
            team = _team(view)
            alive = [r["key"] for r in view["rows"] if r["participating"] and not r["left"]]
            live = [g for g in view["games"] if not g["cancelled"] and g["winner"] is None]
            op = rng.choice(["leave", "leave", "swap", "result"])
            if op == "leave" and alive:
                who = rng.choice(alive)
                picks: dict[int, str] = {}
                cancel: list[int] = []
                for g in [g for g in live if who in players(g)]:
                    cands = sorted(
                        p
                        for p in _free(view, g["round"]) - set(players(g))
                        if method == "individual" or team[p] == team[who]
                    )
                    if cands:
                        picks[g["no"]] = rng.choice(cands)
                    else:
                        cancel.append(g["no"])
                res = _leave(admin, view, who, picks, cancel)
            elif op == "swap" and live:
                g = rng.choice(live)
                out = rng.choice(players(g))
                cands = sorted(
                    p
                    for p in _free(view, g["round"]) - set(players(g))
                    if method == "individual" or team[p] == team[out]
                )
                if not cands:
                    continue
                body = {"from": out, "to": rng.choice(cands)}
                res = post(admin, view, f"games/{g['no']}/swap", **body)
            elif op == "result" and live:
                res = result(admin, view, rng.choice(live)["no"], rng.choice([1, 2]))
            else:
                continue
            if res.status_code == 200:
                view = res.json()
            else:  # 같은 대진 거부 등 정책상 거절은 상태를 바꾸지 않음
                assert res.status_code in (409, 422), res.text
            if sum(1 for g in view["games"] if g["cancelled"]) >= 2:
                two_cancelled += 1
            restores += _try_all_restores(admin, view)
    # 탐색이 '같은 라운드 두 경기 취소' 상태를 실제로 지나갔는지(시나리오를 덮었는지)
    assert two_cancelled > 0
    assert restores > 0
    assert ok(admin.get(f"{BASE}/{view['id']}"))["id"] == view["id"]
