"""튜토리얼 진행 기록(I2): AC-094 저장 규칙·멱등, 서버 재계산, 본인 것만, 운영진 명단 통과 수(C-23).

NFR-006: 응답·저장에 상황별 선택 기록 없음 /
D3: '권장·미통과' 판정은 보류(명단 tutorialRecommendedUnpassed=false 유지).
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.tutorial.models import TutorialProgress
from app.modules.tutorial.registry import get_registry
from tests.modules.authkit import kakao_login, make_user

Factory = Callable[[], TestClient]
PUT = "/api/me/tutorial/stages/{}"


def member(make_client: Factory, db: Session, kid: str, **kw: str) -> TestClient:
    c = make_client()
    make_user(db, name=kw.get("name", f"회원{kid}"), role=kw.get("role", "member"), kakao_id=kid)
    kakao_login(c, kid)
    return c


def save(
    c: TestClient, stage: str, score: int, total: int = 5, **extra: object
) -> dict[str, object]:
    res = c.put(PUT.format(stage), json={"score": score, "total": total, **extra})
    assert res.status_code == 200, res.text
    return res.json()  # type: ignore[no-any-return]


def test_registry_matches_mvp_scope() -> None:
    """C-22: 입문자·왕초보 각 3스테이지 × 5상황, 통과 70%."""
    r = get_registry()
    assert sorted(r.stages) == [
        "beginner-1",
        "beginner-2",
        "beginner-3",
        "novice-1",
        "novice-2",
        "novice-3",
    ]
    assert {s.situations for s in r.stages.values()} == {5}
    assert [r.passed(s, 5) for s in range(6)] == [False, False, False, False, True, True]


def test_ac_094_pass_then_lower_score_keeps_best_and_first_pass(
    make_client: Factory, db: Session
) -> None:
    c = member(make_client, db, "9001")
    first = save(c, "beginner-1", 4)
    assert first["passed"] is True and first["best"] == 4 and first["firstPassedAt"]
    second = save(c, "beginner-1", 3)
    assert second == first  # 3점으로 최고 점수·통과·최초 통과 시각이 나빠지지 않음
    higher = save(c, "beginner-1", 5)
    assert (higher["best"], higher["firstPassedAt"]) == (5, first["firstPassedAt"])
    assert c.get("/api/me/tutorial/progress").json() == {"beginner-1": higher}


def test_idempotent_resend_creates_one_row(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9002")
    results = [save(c, "novice-2", 4) for _ in range(3)]  # 재시도·응답 시간 초과 재전송
    assert results[0] == results[1] == results[2]
    count = db.scalar(select(func.count()).select_from(TutorialProgress))
    assert count == 1  # 시도마다 행이 늘지 않음(C-23)


def test_fail_first_pass_later_sets_first_pass_time_then(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9003")
    failed = save(c, "beginner-2", 2)
    assert failed == {"passed": False, "best": 2, "firstPassedAt": None}
    passed = save(c, "beginner-2", 4)
    assert passed["passed"] is True and passed["firstPassedAt"] is not None


def test_server_recomputes_pass_and_ignores_client_claims(
    make_client: Factory, db: Session
) -> None:
    c = member(make_client, db, "9004")
    res = save(c, "beginner-3", 1, passed=True, best=5, firstPassedAt="2020-01-01T00:00:00Z")
    assert res == {"passed": False, "best": 1, "firstPassedAt": None}


@pytest.mark.parametrize(
    ("stage", "body", "status", "code"),
    [
        ("intermediate-1", {"score": 3, "total": 5}, 404, "stage_not_found"),  # 준비 중 난이도
        ("beginner-1", {"score": 3, "total": 6}, 409, "content_mismatch"),  # 콘텐츠 어긋남
        ("beginner-1", {"score": 6, "total": 5}, 422, "invalid_score"),
        ("beginner-1", {"score": -1, "total": 5}, 422, "invalid_score"),
        ("beginner-1", {"score": 3.5, "total": 5}, 422, "validation_error"),
        ("beginner-1", {"total": 5}, 422, "validation_error"),
    ],
)
def test_input_validation(
    make_client: Factory, db: Session, stage: str, body: dict[str, object], status: int, code: str
) -> None:
    c = member(make_client, db, "9005")
    res = c.put(PUT.format(stage), json=body)
    assert (res.status_code, res.json()["error"]["code"]) == (status, code)
    assert db.scalar(select(func.count()).select_from(TutorialProgress)) == 0


def test_only_own_records(make_client: Factory, db: Session) -> None:
    a = member(make_client, db, "9006")
    b = member(make_client, db, "9007")
    save(a, "beginner-1", 5)
    assert b.get("/api/me/tutorial/progress").json() == {}  # 남의 기록은 보이지 않음
    save(b, "beginner-1", 2)
    assert a.get("/api/me/tutorial/progress").json()["beginner-1"]["best"] == 5


@pytest.mark.parametrize(
    ("role", "status", "code"),
    [(None, None, "unauthenticated"), ("member", "pending", "account_restricted")],
)
def test_permissions(
    make_client: Factory, db: Session, role: str | None, status: str | None, code: str
) -> None:
    c = make_client()
    if role and status:
        make_user(db, role=role, status=status, kakao_id="9008")
        kakao_login(c, "9008")
    assert c.get("/api/me/tutorial/progress").json()["error"]["code"] == code
    assert (
        c.put(PUT.format("beginner-1"), json={"score": 5, "total": 5}).json()["error"]["code"]
        == code
    )


def test_csrf_on_save(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9009")
    res = c.put(
        PUT.format("beginner-1"),
        json={"score": 5, "total": 5},
        headers={"Origin": "https://evil.example"},
    )
    assert res.json()["error"]["code"] == "csrf_origin_mismatch"


def test_nfr_006_no_per_situation_data(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9010")
    save(c, "beginner-1", 4, choices=["a", "b"])  # 보내도 저장·응답하지 않음
    assert set(c.get("/api/me/tutorial/progress").json()["beginner-1"]) == {
        "passed",
        "best",
        "firstPassedAt",
    }
    assert {col.name for col in TutorialProgress.__table__.columns} == {
        "user_id",
        "stage_id",
        "passed",
        "best",
        "first_passed_at",
        "updated_at",
    }


def test_c_23_roster_status_uses_real_passed_counts(make_client: Factory, db: Session) -> None:
    m = member(make_client, db, "9011", name="통과회원")
    save(m, "beginner-1", 5)
    save(m, "beginner-2", 4)
    save(m, "beginner-3", 2)  # 미통과
    save(m, "novice-1", 4)
    admin = member(make_client, db, "9012", role="admin")
    target = next(x for x in admin.get("/api/roster").json()["members"] if x["name"] == "통과회원")
    status = admin.get(f"/api/roster/members/{target['id']}/status").json()
    assert status["tutorial"] == {"beginner": 2, "novice": 1, "total": 3}
    assert target["tutorialRecommendedUnpassed"] is False  # D3 보류 유지
