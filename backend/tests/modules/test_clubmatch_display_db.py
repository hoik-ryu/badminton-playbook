"""청백전 표시 상태·결과(UXD-087·088)와 목록 확장 필드 — 실제 PostgreSQL 연동(5-B1).

SQLite 단위 테스트(test_clubmatch_display·test_clubmatch·test_clubmatch_member)가 다루던 응답 필드를
실제 DB(timestamptz·date·잠금)에서 다시 확인합니다.
- 운영 목록: participants·games·displayStatus·result
- 회원 목록: displayStatus·result(준비 중 없음) / 회원 상세: displayStatus
- 응답 계약: 골든(tests/golden/clubmatch_api_shapes.json) 키와 같음,
  회원 응답에 운영 전용 데이터 없음
- KST 오늘: 서버가 요청마다 display.today_kst()를 부르므로 고정 날짜로 바꿔
  경계(전날·당일·다음 날)를 결정적으로 확인
테스트가 만든 행만 지웁니다(test_clubmatch_db의 TAG·pg 정리 사용).
"""

import datetime as dt
import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import create_app
from app.modules.auth.kakao import get_kakao_client
from app.modules.clubmatch import display
from app.modules.roster.models import MemberRating
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import ORIGIN, FakeKakao, auth_settings, kakao_login, new_kakao_id
from tests.modules.test_clubmatch_db import BASE, RULES, TAG, admin, new_member, pg
from tests.modules.test_clubmatch_member import DETAIL_KEYS, FORBIDDEN, LIST_KEYS, all_keys

__all__ = ["admin", "pg"]  # 다른 모듈의 픽스처를 이 파일에서 씀

pytestmark = pytest.mark.db
MEMBER = "/api/member/club-matches"
GOLDEN = json.loads(
    (Path(__file__).parents[1] / "golden" / "clubmatch_api_shapes.json").read_text(encoding="utf-8")
)["responses"]
TODAY = dt.date(2026, 11, 23)  # 고정한 'KST 오늘'


@pytest.fixture
def kst_today(monkeypatch: pytest.MonkeyPatch) -> dt.date:
    monkeypatch.setattr(display, "today_kst", lambda now=None: TODAY)
    return TODAY


@pytest.fixture
def member(pg: Session) -> Iterator[tuple[TestClient, User]]:
    """실제 회원 세션(카카오 로그인 흐름, role=member)."""
    app = create_app()
    settings = get_settings()
    app.dependency_overrides[get_settings] = lambda: auth_settings(settings.database_url)
    app.dependency_overrides[get_kakao_client] = lambda: FakeKakao()
    kid = new_kakao_id()
    user = User(name=f"{TAG}회원", gender="여", grade="C조", role="member", status="approved")
    user.identities.append(UserIdentity(provider="kakao", provider_user_id=kid))
    pg.add(user)
    pg.commit()
    pg.add(MemberRating(user_id=user.id, score=5))
    pg.commit()
    with TestClient(app, base_url=ORIGIN, follow_redirects=False, headers={"Origin": ORIGIN}) as c:
        kakao_login(c, kid)
        yield c, user


def _match(
    admin: TestClient,
    pg: Session,
    name: str,
    date: dt.date,
    *,
    with_member: User | None = None,
    games: bool = True,
    confirm: bool = True,
    record: int = 0,
    finish: bool = False,
) -> dict[str, Any]:
    """개인전 4–5명·2경기. record: 앞에서부터 기록할 경기 수."""
    res = admin.post(
        BASE, json={"method": "individual", "date": date.isoformat(), "name": f"{TAG}{name}"}
    )
    assert res.status_code == 201, res.text
    view = admin.get(f"{BASE}/{res.json()['id']}").json()
    users = [new_member(pg, f"{name}-{i}") for i in range(4)]
    for u in users:
        pg.add(MemberRating(user_id=u.id, score=6))
    pg.commit()
    people = [f"member:{u.id}" for u in users]
    if with_member is not None:
        people.append(f"member:{with_member.id}")
    for key in people:
        view = admin.put(
            f"{BASE}/{view['id']}/participants/{key}",
            json={"participating": True, "version": view["version"]},
        ).json()
    view = admin.put(
        f"{BASE}/{view['id']}/settings",
        json={"totalGames": 2, "rules": RULES, "version": view["version"]},
    ).json()
    if games:
        view = admin.post(f"{BASE}/{view['id']}/games", json={"version": view["version"]}).json()
    if games and confirm:
        view = admin.post(f"{BASE}/{view['id']}/confirm", json={"version": view["version"]}).json()
    for no in range(1, record + 1):
        res = admin.put(
            f"{BASE}/{view['id']}/games/{no}/result", json={"winner": 1, "version": view["version"]}
        )
        assert res.status_code == 200, res.text
        view = res.json()
    if finish:
        view = admin.post(f"{BASE}/{view['id']}/finish", json={"version": view["version"]}).json()
    return dict(view)


def _shape_diff(actual: Any, gold: Any, where: str = "$") -> list[str]:
    """골든 형태(키 이름)와 다른 곳. 값이 null이면 비교하지 않음."""
    if gold is True or actual is None:
        return []
    if isinstance(gold, list):
        return [d for a in actual[:5] for d in _shape_diff(a, gold[0], f"{where}[]")]
    diff = [] if set(actual) == set(gold) else [f"{where}: {sorted(set(actual) ^ set(gold))}"]
    return diff + [
        d for k in gold if k in actual for d in _shape_diff(actual[k], gold[k], f"{where}.{k}")
    ]


def test_db_display_status_result_and_list_fields(
    admin: TestClient, member: tuple[TestClient, User], pg: Session, kst_today: dt.date
) -> None:
    """UXD-087·088: 표시 상태(KST)·결과·목록 확장 필드 — 운영 목록·회원 목록·회원 상세."""
    mc, me = member
    day = dt.timedelta(days=1)
    live = _match(admin, pg, "진행", kst_today, with_member=me, record=1)
    upcoming = _match(admin, pg, "예정", kst_today + day)
    yesterday = _match(admin, pg, "어제", kst_today - day)
    pending = _match(admin, pg, "준비", kst_today, games=False)
    review = _match(admin, pg, "검토", kst_today, confirm=False)
    ended = _match(admin, pg, "종료", kst_today - day, record=2, finish=True)

    ops = {x["id"]: x for x in admin.get(BASE).json()}
    expected = {
        live["id"]: "live",  # 오늘 + 기록 있음
        upcoming["id"]: "upcoming",  # 확정 + 날짜가 오늘 뒤 + 기록 없음
        yesterday["id"]: "live",  # 날짜가 지났고 기록 없음 → 진행 중
        pending["id"]: "pending",
        review["id"]: "pending",
        ended["id"]: "ended",
    }
    assert {i: ops[i]["displayStatus"] for i in expected} == expected
    # DB 상태값은 그대로(draft·confirmed·finished)
    assert [ops[i]["status"] for i in (pending["id"], live["id"], ended["id"])] == [
        "draft",
        "confirmed",
        "finished",
    ]
    assert (ops[live["id"]]["participants"], ops[live["id"]]["games"]) == (5, 2)
    assert (ops[pending["id"]]["participants"], ops[pending["id"]]["games"]) == (4, 0)
    assert ops[live["id"]]["result"] is None and ops[upcoming["id"]]["result"] is None
    result = ops[ended["id"]]["result"]
    assert result["method"] == "individual" and result["final"] is None
    assert result["text"].startswith(("1위 ", "공동 1위 · ")), result
    assert "winnerText" in ops[ended["id"]] and "status" in ops[ended["id"]]  # 기존 필드 유지
    assert _shape_diff(list(ops.values()), GOLDEN["ClubMatchListItem[]"]) == []

    # 회원 목록: 준비 중(확정 전)은 아예 없음, 같은 표시 상태·결과
    res = mc.get(MEMBER)
    assert res.status_code == 200
    items = {x["id"]: x for x in res.json()}
    assert pending["id"] not in items and review["id"] not in items
    assert {
        i: items[i]["displayStatus"]
        for i in (live["id"], upcoming["id"], yesterday["id"], ended["id"])
    } == {
        live["id"]: "live",
        upcoming["id"]: "upcoming",
        yesterday["id"]: "live",
        ended["id"]: "ended",
    }
    assert items[ended["id"]]["result"] == result
    assert items[ended["id"]]["resultText"]  # 기존 필드 유지
    assert set(all_keys(list(items.values()))) <= LIST_KEYS
    assert not set(all_keys(list(items.values()))) & FORBIDDEN
    assert _shape_diff(list(items.values()), GOLDEN["PublicClubMatchItem[]"]) == []

    # 회원 상세: 표시 상태 + 내 경기, 운영 전용 데이터 없음
    detail = mc.get(f"{MEMBER}/{live['id']}").json()
    assert detail["displayStatus"] == "live" and detail["participating"] is True
    assert any(p["me"] for g in detail["games"] for p in [*g["team1"], *g["team2"]])
    assert set(all_keys(detail)) <= DETAIL_KEYS
    assert not set(all_keys(detail)) & FORBIDDEN
    raw = json.dumps(detail, ensure_ascii=False)
    assert str(me.id) not in raw and "member:" not in raw and "guest:" not in raw
    assert _shape_diff(detail, GOLDEN["PublicClubMatch"]) == []
    assert mc.get(f"{MEMBER}/{upcoming['id']}").json()["displayStatus"] == "upcoming"
    assert mc.get(f"{MEMBER}/{ended['id']}").json()["displayStatus"] == "ended"


def test_db_display_status_follows_kst_day_and_results(
    admin: TestClient, member: tuple[TestClient, User], pg: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """UXD-087(2026-11-27 날짜만 봄): 'KST 오늘'이 날짜가 되면 진행 예정 → 진행 중.

    날짜 전에는 결과를 기록할 수 없고(409 match_not_started) 상태도 그대로 진행 예정."""
    mc, _ = member
    day = dt.date(2026, 11, 24)
    monkeypatch.setattr(display, "today_kst", lambda now=None: day - dt.timedelta(days=1))
    view = _match(admin, pg, "경계", day)

    def status() -> tuple[str, str]:
        ops = next(x for x in admin.get(BASE).json() if x["id"] == view["id"])
        return ops["displayStatus"], mc.get(f"{MEMBER}/{view['id']}").json()["displayStatus"]

    assert status() == ("upcoming", "upcoming")  # 전날
    rec = admin.put(
        f"{BASE}/{view['id']}/games/1/result", json={"winner": 2, "version": view["version"]}
    )
    assert (rec.status_code, rec.json()["error"]["code"]) == (409, "match_not_started")
    assert status() == ("upcoming", "upcoming")  # 거부되면 아무것도 바뀌지 않음
    monkeypatch.setattr(display, "today_kst", lambda now=None: day)
    assert status() == ("live", "live")  # 당일
    rec = admin.put(
        f"{BASE}/{view['id']}/games/1/result", json={"winner": 2, "version": view["version"]}
    )
    assert rec.status_code == 200  # 당일부터 기록 가능


def test_db_member_permissions_on_extended_api(
    admin: TestClient, member: tuple[TestClient, User], pg: Session, kst_today: dt.date
) -> None:
    """회원: 운영 API 403, 준비 중 청백전은 없는 청백전과 같은 404(AC-069).

    운영진은 같은 청백전을 운영 API로 봄.
    """
    mc, _ = member
    pending = _match(admin, pg, "권한준비", kst_today, games=False)
    assert mc.get(BASE).status_code == 403
    assert mc.get(f"{BASE}/{pending['id']}").status_code == 403
    hidden = mc.get(f"{MEMBER}/{pending['id']}")
    missing = mc.get(f"{MEMBER}/00000000-0000-0000-0000-000000000000")
    assert hidden.status_code == missing.status_code == 404
    assert hidden.json() == missing.json()
    assert admin.get(f"{BASE}/{pending['id']}").json()["status"] == "draft"
