"""청백전 목록 표시 상태·결과(SCR-111 r6, UXD-087·088, DD r8 VD-055) — 순수 계산 테스트(DB 불필요).

UXD-087: 준비 중(draft) / 진행 예정(확정 + 날짜가 오늘(KST)보다 뒤 + 기록된 결과 없음) /
진행 중(그 밖의 확정) / 종료.
UXD-088 정보 5: 팀전 '청팀 승리'·'백팀 승리'·'무승부' + '최종 x : y',
개인전 '1위 이름' 또는 '공동 1위 · n명'.
"""

import datetime as dt

import pytest

from app.modules.clubmatch.display import (
    display_status,
    individual_result,
    team_result,
    today_kst,
)

D = dt.date(2026, 11, 15)


@pytest.mark.parametrize(
    ("status", "match_date", "today", "expected"),
    [
        ("draft", D, dt.date(2026, 11, 1), "pending"),
        ("draft", D, dt.date(2026, 12, 1), "pending"),  # 날짜와 무관하게 확정 전은 준비 중
        ("finished", D, dt.date(2026, 11, 1), "ended"),
        ("confirmed", D, dt.date(2026, 11, 14), "upcoming"),  # 날짜가 오늘보다 뒤
        ("confirmed", D, D, "live"),  # 당일은 진행 중(뒤가 아님)
        ("confirmed", D, dt.date(2026, 11, 16), "live"),  # 날짜가 지났는데 미종료
    ],
)
def test_uxd_087_display_status(
    status: str, match_date: dt.date, today: dt.date, expected: str
) -> None:
    """(2026-11-27) 날짜만 봄: 날짜 전이면 기록된 결과가 있어도 진행 예정.

    날짜 전 기록은 서버가 막음."""
    assert display_status(status, match_date, today) == expected


def test_uxd_087_today_is_kst_date_at_utc_boundary() -> None:
    """KST 자정 = UTC 15:00. 그 전후로 '오늘'이 바뀜(서버 시간대와 무관)."""
    utc = dt.UTC
    assert today_kst(dt.datetime(2026, 11, 14, 14, 59, 59, tzinfo=utc)) == dt.date(2026, 11, 14)
    assert today_kst(dt.datetime(2026, 11, 14, 15, 0, 0, tzinfo=utc)) == dt.date(2026, 11, 15)
    # 시간대 없는 값은 UTC로 봄
    assert today_kst(dt.datetime(2026, 11, 14, 15, 0, 0)) == dt.date(2026, 11, 15)
    # 다른 시간대 값도 KST로 바꿔 판정(미국 동부 11/14 23:00 = KST 11/15 13:00)
    est = dt.timezone(dt.timedelta(hours=-5))
    assert today_kst(dt.datetime(2026, 11, 14, 23, 0, tzinfo=est)) == dt.date(2026, 11, 15)


def test_uxd_087_kst_boundary_changes_upcoming_to_live() -> None:
    """11/15 청백전: KST 11/14 23:59까지 진행 예정, KST 11/15 00:00부터 진행 중."""
    before = today_kst(dt.datetime(2026, 11, 14, 14, 59, tzinfo=dt.UTC))
    after = today_kst(dt.datetime(2026, 11, 14, 15, 0, tzinfo=dt.UTC))
    assert display_status("confirmed", D, before) == "upcoming"
    assert display_status("confirmed", D, after) == "live"


def test_uxd_088_team_result_with_final_score() -> None:
    r = team_result(8, 5)
    assert (r.outcome, r.text, r.final and (r.final.blue, r.final.white)) == (
        "blue",
        "청팀 승리",
        (8, 5),
    )
    r = team_result(1, 3)
    assert (r.outcome, r.text) == ("white", "백팀 승리")
    r = team_result(5, 5)
    assert (r.outcome, r.text, r.tiedCount) == ("draw", "무승부", None)


def test_uxd_088_individual_result_single_and_tied() -> None:
    one = individual_result(["김가람"])
    assert one is not None and (one.text, one.tiedCount, one.final) == ("1위 김가람", 1, None)
    tied = individual_result(["김가람", "박다온"])
    assert tied is not None and (tied.text, tied.tiedCount) == ("공동 1위 · 2명", 2)
    assert individual_result([]) is None
