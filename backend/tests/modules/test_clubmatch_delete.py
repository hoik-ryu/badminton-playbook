"""청백전 삭제 범위 확대(변경 계약 CP-001, 기획 r15 C-32·AC-166).

기존 DELETE /api/club-matches/{id}?version= 를 그대로 씁니다.
삭제 가능: 준비 중, 진행 예정(확정 + 날짜가 오늘(KST)보다 뒤 + 기록된 결과 없음).
확정 때 1라운드가 진행 중으로 설정된 것만으로는 막지 않음.
삭제 불가(409 locked): 진행 중(날짜가 오늘 이전이거나 결과 있음)·종료,
진행 예정이라도 운영 이력(경기 취소, 중도 귀가 제외).
회원은 403, 오래된 version은 409 conflict. 회원·게스트·명단 점수는 지우지 않음.
날짜는 오늘과 관계없게 먼 미래(2099-12-31)·지난 날(2026-11-15)을 씁니다.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGamePlayer,
    ClubMatchParticipant,
)
from app.modules.roster.models import MemberRating
from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user
from tests.modules.test_clubmatch_flow import BASE, err, member, ok, post

Factory = Callable[[], TestClient]
RULES = {"balance": True, "gender": True}
FUTURE = "2099-12-31"
PAST = "2026-11-15"


def ac(*ids: str) -> pytest.MarkDecorator:
    tag = ", ".join(ids)
    return pytest.mark.parametrize("ac_tag", [tag], ids=[tag])


@pytest.fixture
def admin(make_client: Factory, db: Session) -> TestClient:
    c = make_client()
    make_user(db, name="운영진", role="admin", kakao_id="9401")
    kakao_login(c, "9401")
    return c


def keys_of(db: Session, n: int, prefix: str) -> list[str]:
    return [
        f"member:{member(db, f'{prefix}{i}', '여' if i % 2 else '남', 5 + i % 4).id}"
        for i in range(n)
    ]


def confirmed(
    c: TestClient, db: Session, *, date: str, n: int = 8, rounds: int = 2, prefix: str = "삭"
) -> tuple[Any, list[str]]:
    """라운드 기반(코트 2) 개인전 n명을 만들어 rounds라운드로 생성하고 확정(= 1라운드 진행 중)."""
    keys = keys_of(db, n, prefix)
    res = c.post(
        BASE,
        json={"method": "individual", "date": date, "name": f"{prefix} 청백전", "courtCount": 2},
    )
    view = ok(c.get(f"{BASE}/{res.json()['id']}"))
    view = ok(
        c.put(f"{BASE}/{view['id']}/participants", json={"keys": keys, "version": view["version"]})
    )
    view = ok(post(c, view, "games", rounds=rounds, rules=RULES))
    view = ok(post(c, view, "confirm"))
    assert view["status"] == "confirmed" and view["currentRound"] == 1
    return view, keys


def delete(c: TestClient, view: Any, version: int | None = None) -> Any:
    return c.delete(
        f"{BASE}/{view['id']}", params={"version": view["version"] if version is None else version}
    )


def rows(db: Session, match_id: str) -> tuple[int, int, int, int]:
    db.expire_all()
    mid = uuid.UUID(match_id)
    games = db.scalars(select(ClubMatchGame.id).where(ClubMatchGame.match_id == mid)).all()
    seats = (
        db.scalar(
            select(func.count())
            .select_from(ClubMatchGamePlayer)
            .where(ClubMatchGamePlayer.game_id.in_(games))
        )
        if games
        else 0
    )
    parts = db.scalar(
        select(func.count())
        .select_from(ClubMatchParticipant)
        .where(ClubMatchParticipant.match_id == mid)
    )
    return int(db.get(ClubMatch, mid) is not None), int(parts or 0), len(games), int(seats or 0)


@ac("AC-166")
def test_upcoming_match_is_deleted_with_its_lineup_and_shared_data_stays(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    view, keys = confirmed(admin, db, date=FUTURE)
    other, _ = confirmed(admin, db, date=FUTURE, prefix="남김")
    assert rows(db, view["id"])[0:2] == (1, 8)
    res = delete(admin, view)
    assert res.status_code == 204, res.text
    assert rows(db, view["id"]) == (0, 0, 0, 0)
    # 회원·명단 점수·다른 청백전은 그대로
    ids = [uuid.UUID(k.split(":", 1)[1]) for k in keys]
    assert db.scalar(select(func.count()).select_from(User).where(User.id.in_(ids))) == 8
    assert (
        db.scalar(
            select(func.count()).select_from(MemberRating).where(MemberRating.user_id.in_(ids))
        )
        == 8
    )
    assert rows(db, other["id"])[0:2] == (1, 8)
    assert admin.get(f"{BASE}/{view['id']}").status_code == 404


@ac("AC-166")
def test_unfinished_matches_are_deleted_even_with_results_and_finished_ones_are_locked(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    """(2026-11-27 사용자 결정) 종료 전이면 진행 중·결과 있음도 운영진이 삭제. 종료만 409 locked."""
    # 날짜가 지난 확정 청백전(결과 없음) = 진행 중 → 삭제
    past, _ = confirmed(admin, db, date=PAST, prefix="지남")
    assert delete(admin, past).status_code == 204
    assert rows(db, past["id"]) == (0, 0, 0, 0)
    # 진행 중 + 결과 기록 → 경기·결과와 함께 삭제
    live, _ = confirmed(admin, db, date=PAST, prefix="결과")
    live = ok(
        admin.put(
            f"{BASE}/{live['id']}/games/1/result", json={"winner": 1, "version": live["version"]}
        )
    )
    assert delete(admin, live).status_code == 204
    assert rows(db, live["id"]) == (0, 0, 0, 0)
    # (2026-11-27) 날짜 전에는 결과를 기록할 수 없음(match_not_started)
    up, _ = confirmed(admin, db, date=FUTURE, prefix="예정")
    res = admin.put(
        f"{BASE}/{up['id']}/games/1/result", json={"winner": 1, "version": up["version"]}
    )
    assert err(res) == (409, "match_not_started")
    # 종료 → 삭제 불가(아무것도 지우지 않음)
    done, _ = confirmed(admin, db, date=PAST, rounds=1, prefix="종료")
    for g in done["games"]:
        done = ok(
            admin.put(
                f"{BASE}/{done['id']}/games/{g['no']}/result",
                json={"winner": 1, "version": done["version"]},
            )
        )
    done = ok(post(admin, done, "finish"))
    assert err(delete(admin, done)) == (409, "locked")
    assert rows(db, done["id"])[0:2] == (1, 8)


@ac("AC-166")
def test_match_with_operation_history_is_deleted(
    ac_tag: str, admin: TestClient, db: Session
) -> None:
    """(2026-11-27) 경기 취소·중도 귀가 이력이 있어도 종료 전이면 삭제(이력 행도 함께)."""
    # 경기 취소 이력: 8명·코트 2라 모두 출전 → 귀가자의 경기는 대체 불가 → 취소
    view, keys = confirmed(admin, db, date=FUTURE, prefix="취소")
    leaver = view["games"][0]["team1"][0]["key"]
    mine = [g["no"] for g in view["games"] if leaver in [p["key"] for p in g["team1"] + g["team2"]]]
    view = ok(
        admin.post(
            f"{BASE}/{view['id']}/participants/{leaver}/leave",
            json={"assignments": [], "cancel": mine, "version": view["version"]},
        )
    )
    assert any(g["cancelled"] for g in view["games"])
    assert delete(admin, view).status_code == 204
    # 중도 귀가 제외만(남은 경기 없음): 9명·코트 2·1라운드에서 쉬는 사람
    rest_view, rkeys = confirmed(admin, db, n=9, rounds=1, date=FUTURE, prefix="휴식")
    playing = {p["key"] for g in rest_view["games"] for p in g["team1"] + g["team2"]}
    rester = next(k for k in rkeys if k not in playing)
    rest_view = ok(
        admin.post(
            f"{BASE}/{rest_view['id']}/participants/{rester}/leave",
            json={"assignments": [], "version": rest_view["version"]},
        )
    )
    assert delete(admin, rest_view).status_code == 204
    assert rows(db, view["id"]) == (0, 0, 0, 0) and rows(db, rest_view["id"]) == (0, 0, 0, 0)


@ac("AC-166")
def test_members_cannot_delete_and_a_stale_version_conflicts(
    ac_tag: str, make_client: Factory, admin: TestClient, db: Session
) -> None:
    view, _ = confirmed(admin, db, date=FUTURE, prefix="권한")
    m = make_client()
    make_user(db, name="회원", kakao_id="9402")
    kakao_login(m, "9402")
    assert delete(m, view).status_code == 403
    assert err(delete(admin, view, view["version"] - 1)) == (409, "conflict")
    assert rows(db, view["id"])[0:2] == (1, 8)
    assert delete(admin, view).status_code == 204
