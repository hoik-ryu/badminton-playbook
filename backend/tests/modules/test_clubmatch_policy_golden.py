"""I3-d FE Mock ↔ 서버 정책 일치(골든 JSON, FE `policy.golden.test.ts`가 만듦).

- U3·U4 개인전 순위(승수 → 승률 → 이름 → 키, 공동 순위)
- P-4·P-4-b 교체·중도 귀가 뒤 반복·완화 사유 재계산(`refresh_after_swap`)
- P-4-b 중도 귀가 대체 판정(`substitute_decision`: 피할 수 있는 중복 거부·불가피한 중복 예외)
"""

import json
from pathlib import Path
from typing import Any

import pytest

from app.modules.clubmatch import schedule

GOLDEN = json.loads(
    (Path(__file__).parents[1] / "golden" / "clubmatch_policy.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", GOLDEN["standings"])
def test_u3_u4_standings_match_frontend(case: dict[str, Any]) -> None:
    games = [schedule.GameResult((g[0], g[1]), (g[2], g[3]), g[4]) for g in case["games"]]
    assert schedule.standings(games, case["participants"], case["names"]) == case["out"]


@pytest.mark.parametrize("case", GOLDEN["refresh"])
def test_p4_refresh_after_swap_matches_frontend(case: dict[str, Any]) -> None:
    states = [
        schedule.GameState(
            g["no"],
            tuple(g["team1"]),
            tuple(g["team2"]),
            g["manual"],
            g["genderRelaxed"],
            g["repeatedMatchup"],
            [dict(x) for x in g["relaxations"]],
        )
        for g in case["input"]
    ]
    schedule.refresh_after_swap(states, case["genders"], case["rule"], frozenset(case["forced"]))
    got = [
        {
            "no": s.no,
            "team1": list(s.team1),
            "team2": list(s.team2),
            "manual": s.manual,
            "genderRelaxed": s.gender_relaxed,
            "repeatedMatchup": s.repeated_matchup,
            "relaxations": s.relaxations,
        }
        for s in states
    ]
    assert got == case["out"]


@pytest.mark.parametrize("case", GOLDEN["substitute"])
def test_p4b_substitute_decision_matches_frontend(case: dict[str, Any]) -> None:
    seats = {no: ((s[0][0], s[0][1]), (s[1][0], s[1][1])) for no, s in case["seats"]}
    picks = {no: to for no, to in case["picks"]}
    cands: dict[str, list[str]] = case["candidates"]
    avoidable, forced = schedule.substitute_decision(
        seats, case["leaver"], picks, lambda no: cands[str(no)]
    )
    assert {"avoidable": avoidable, "forced": sorted(forced)} == case["out"]


def test_golden_covers_all_policy_outcomes() -> None:
    outs = [c["out"] for c in GOLDEN["substitute"]]
    assert any(o["avoidable"] for o in outs) and any(o["forced"] for o in outs)
    assert any(not o["avoidable"] and not o["forced"] for o in outs)
    reasons = {
        f"{x['rule']}:{x['reason']}"
        for c in GOLDEN["refresh"]
        for g in c["out"]
        for x in g["relaxations"]
    }
    assert {"matchup:substitute_exhausted", "matchup:manual", "gender:manual"} <= reasons
