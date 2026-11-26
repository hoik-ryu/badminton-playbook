"""(B15, C-36·AC-145–147) 라운드 기반 생성·미리보기 FE ↔ BE 일치.

골든 파일은 FE `rounds.golden.test.ts`가 만듭니다(UPDATE_GOLDEN=1).
같은 입력·시드·규칙이면 라운드·코트·경기 번호·조·규칙 완화 사유까지
같아야 합니다(NFR-003 r12 결정성).

AC 태그: 테스트 이름의 `[AC-xxx]`(parametrize id).
"""

import json
from pathlib import Path
from typing import Any

import pytest

from app.modules.clubmatch import schedule

GOLDEN = Path(__file__).resolve().parents[1] / "golden" / "clubmatch_rounds.json"
DATA: dict[str, Any] = json.loads(GOLDEN.read_text(encoding="utf-8"))


def test_golden_has_cases() -> None:
    assert len(DATA["generate"]) == 90 and len(DATA["preview"]) > 400


@pytest.mark.parametrize("ac_tag", ["AC-146, AC-147"], ids=["AC-146, AC-147"])
@pytest.mark.parametrize("case", DATA["generate"], ids=[c["name"] for c in DATA["generate"]])
def test_round_generation_matches_frontend(case: dict[str, Any], ac_tag: str) -> None:
    players = [
        schedule.ClubPlayer(p["key"], p["gender"], p["score"], p["team"]) for p in case["players"]
    ]
    games = schedule.generate_round_games(
        players,
        case["rounds"],
        case["courts"],
        case["method"],
        case["rules"]["balance"],
        case["rules"]["gender"],
        case["seed"],
    )
    got = [
        {
            "no": g.no,
            "round": g.round,
            "court": g.court,
            "team1": list(g.team1),
            "team2": list(g.team2),
            "genderRelaxed": g.gender_relaxed,
            "repeatedMatchup": g.repeated_matchup,
            "relaxations": g.relaxations or [],
        }
        for g in games
    ]
    assert got == case["games"]


@pytest.mark.parametrize("ac_tag", ["AC-145"], ids=["AC-145"])
def test_round_preview_matches_frontend(ac_tag: str) -> None:
    for case in DATA["preview"]:
        got = schedule.round_preview(case["method"], case["sizes"], case["courts"], case["rounds"])
        assert got == case["preview"], case
