"""청백전 계산 FE ↔ BE 일치(D1). 골든 파일은 FE `schedule.golden.test.ts`가 만듭니다.

경기 수 분포·균등안(AC-074, UXD-071)·팀 배정안(AC-072)이 프런트 Mock과 같은 결과인지 확인합니다.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from app.modules.clubmatch import schedule

GOLDEN = Path(__file__).resolve().parents[1] / "golden" / "clubmatch_schedule.json"
DATA: dict[str, Any] = json.loads(GOLDEN.read_text(encoding="utf-8"))


def test_golden_has_cases() -> None:
    assert len(DATA["distribution"]) > 500 and len(DATA["proposeTeams"]) == 30


@pytest.mark.parametrize("case", DATA["distribution"])
def test_distribution_and_even_proposals_match_frontend(case: dict[str, Any]) -> None:
    preview = schedule.distribution(case["method"], case["counts"], case["totalGames"])
    proposals = schedule.even_proposals(case["method"], case["counts"], case["totalGames"])
    assert (preview, proposals) == (case["preview"], case["proposals"])


@pytest.mark.parametrize("case", DATA["proposeTeams"])
def test_propose_teams_matches_frontend(case: dict[str, Any]) -> None:
    players = [schedule.TeamCandidate(p["key"], p["gender"], p["score"]) for p in case["players"]]
    assert schedule.propose_teams(players) == case["teams"]
