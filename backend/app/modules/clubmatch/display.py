"""청백전 목록의 표시용 상태·결과(SCR-111, UXD-087·088, DD r8 VD-055).

DB에 저장하는 상태(`draft`·`confirmed`·`finished`)는 그대로 두고,
화면에 보여 줄 상태만 응답할 때 계산합니다.
- 준비 중(pending): 확정 전(draft)
- 진행 예정(upcoming): 확정 + 청백전 날짜가 오늘(KST)보다 뒤
- 진행 중(live): 그 밖의 확정·미종료(당일, 날짜가 지났지만 종료하지 않음)
  (2026-11-27 사용자 결정: 기록된 결과로 진행 중이 되는 예외를 없애고 날짜만 봄.
  날짜 전 결과 기록은 서버가 막음)
- 종료(ended): finished
'오늘'은 클럽 기준 시간대(한국 시간, KST)의 날짜입니다.
KST는 일광 절약 시간이 없어 고정 UTC+9로 계산합니다(서버 시간대 데이터베이스에 의존하지 않음).
"""

import datetime as dt
from typing import Literal

from pydantic import BaseModel

DisplayStatus = Literal["pending", "upcoming", "live", "ended"]
KST = dt.timezone(dt.timedelta(hours=9), "KST")


def today_kst(now: dt.datetime | None = None) -> dt.date:
    """지금 시각의 KST 날짜. now가 시간대 없는 값이면 UTC로 봅니다."""
    now = now or dt.datetime.now(dt.UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=dt.UTC)
    return now.astimezone(KST).date()


def display_status(status: str, match_date: dt.date, today: dt.date) -> DisplayStatus:
    """UXD-087 표시 상태(날짜 기준, 2026-11-27)."""
    if status == "draft":
        return "pending"
    if status == "finished":
        return "ended"
    if match_date > today:
        return "upcoming"
    return "live"


class TeamFinal(BaseModel):
    blue: int
    white: int


class ClubMatchResult(BaseModel):
    """종료 결과 강조(UXD-088 정보 5, VD-055). 종료된 청백전에만 있습니다.

    - 팀전: outcome = 'blue'·'white'·'draw', final = 최종 승수(청 x : 백 y),
      text = '청팀 승리'·'백팀 승리'·'무승부'
    - 개인전: outcome = None, final = None, text = '1위 이름' 또는 '공동 1위 · n명',
      tiedCount = 1위 인원
    """

    method: Literal["individual", "team"]
    outcome: Literal["blue", "white", "draw"] | None
    final: TeamFinal | None
    text: str
    tiedCount: int | None  # noqa: N815


def team_result(blue: int, white: int) -> ClubMatchResult:
    outcome: Literal["blue", "white", "draw"] = (
        "draw" if blue == white else "blue" if blue > white else "white"
    )
    text = {"draw": "무승부", "blue": "청팀 승리", "white": "백팀 승리"}[outcome]
    return ClubMatchResult(
        method="team",
        outcome=outcome,
        final=TeamFinal(blue=blue, white=white),
        text=text,
        tiedCount=None,
    )


def individual_result(top_names: list[str]) -> ClubMatchResult | None:
    """1위 이름 목록(순위표 순서). 1명이면 '1위 이름', 여럿이면 '공동 1위 · n명'."""
    if not top_names:
        return None
    text = f"1위 {top_names[0]}" if len(top_names) == 1 else f"공동 1위 · {len(top_names)}명"
    return ClubMatchResult(
        method="individual", outcome=None, final=None, text=text, tiedCount=len(top_names)
    )
