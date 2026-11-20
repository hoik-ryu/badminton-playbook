"""튜토리얼 진행 기록(I2): AC-094 저장 규칙·멱등, 서버 재계산, 본인 것만, 운영진 명단 통과 수(C-23).

(PRD r7) 레지스트리 = 새 과정·스테이지 ID(ASM-033·034, AC-093), 개편 전 기록 분리(AC-118·119, C-28),
과정별 통과 현황(AC-100 r7).

(3단계) 저장은 서버 판정 회차로만(save = 회차 시작 → 판정 → 완료, tests/modules/tutorialkit.py).
클라이언트 점수({score, total})는 받지 않음.

NFR-006: 응답·저장에 상황별 선택 기록 없음 /
D3: '권장·미통과' 판정은 보류(명단 tutorialRecommendedUnpassed=false 유지).
"""

import json
import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.tutorial.models import TutorialProgress, TutorialRun
from app.modules.tutorial.registry import REGISTRY_PATH, get_registry, load_registry
from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user
from tests.modules.tutorialkit import save, start

Factory = Callable[[], TestClient]
PUT = "/api/me/tutorial/stages/{}"


def member(make_client: Factory, db: Session, kid: str, **kw: str) -> TestClient:
    c = make_client()
    make_user(db, name=kw.get("name", f"회원{kid}"), role=kw.get("role", "member"), kakao_id=kid)
    kakao_login(c, kid)
    return c


def test_ac_093_registry_matches_mvp_scope() -> None:
    """AC-093·C-27: 과정 5단계 순서, MVP 8스테이지(입문자 2·왕초급 3·초급 3) × 5상황, 통과 70%."""
    r = get_registry()
    assert [(c.id, c.name, c.grid, c.released) for c in r.courses] == [
        ("intro", "입문자", "grid-2x3", True),
        ("starter", "왕초급", "grid-2x3", True),
        ("basic", "초급", "grid-3x3", True),
        ("mid", "중급", "grid-5x3", False),
        ("high", "고급", "grid-5x3", False),
    ]
    assert [r.course_stage_ids(c.id) for c in r.released_courses()] == [
        ["intro-1-v1", "intro-2-v1"],
        ["starter-1-v1", "starter-2-v1", "starter-3-v1"],
        ["basic-1-v1", "basic-2-v1", "basic-3-v1"],
    ]
    assert len(r.stages) == 8 and {s.situations for s in r.stages.values()} == {5}
    assert not any(sid.startswith(("beginner", "novice")) for sid in r.stages)  # C-28
    assert [r.passed(s, 5) for s in range(6)] == [False, False, False, False, True, True]


@pytest.mark.parametrize(
    "broken",
    [
        {"stages": [{"id": "x-1-v1", "course": "nope", "no": 1, "situations": 5}]},
        {"stages": [{"id": "intro-1-v1", "course": "intro", "no": 1, "situations": 5}] * 2},
        {
            "stages": [
                {"id": "intro-1-v1", "course": "intro", "no": 1, "situations": 5},
                {"id": "intro-9-v1", "course": "intro", "no": 1, "situations": 5},
            ]
        },
        {"stages": [{"id": "intro-" + "1" * 40, "course": "intro", "no": 1, "situations": 5}]},
    ],
)
def test_registry_rejects_inconsistent_data(broken: dict[str, object]) -> None:
    """형식 오류(알 수 없는 과정·중복 ID·중복 순번·32자 초과)는 서버 시작 때 바로 실패."""
    raw = json.loads(REGISTRY_PATH.read_text(encoding="utf-8")) | broken
    with pytest.raises(ValueError):
        load_registry(raw)


def test_ac_094_pass_then_lower_score_keeps_best_and_first_pass(
    make_client: Factory, db: Session
) -> None:
    c = member(make_client, db, "9001")
    first = save(c, "intro-1-v1", 4)
    assert first["passed"] is True and first["best"] == 4 and first["firstPassedAt"]
    second = save(c, "intro-1-v1", 3)
    assert second == first  # 3점으로 최고 점수·통과·최초 통과 시각이 나빠지지 않음
    higher = save(c, "intro-1-v1", 5)
    assert (higher["best"], higher["firstPassedAt"]) == (5, first["firstPassedAt"])
    assert c.get("/api/me/tutorial/progress").json() == {"intro-1-v1": higher}


def test_same_score_runs_create_one_row(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9002")
    results = [save(c, "starter-2-v1", 4) for _ in range(3)]  # 같은 점수 회차 3번
    assert results[0] == results[1] == results[2]
    count = db.scalar(select(func.count()).select_from(TutorialProgress))
    assert count == 1  # 시도마다 행이 늘지 않음(C-23)


def test_fail_first_pass_later_sets_first_pass_time_then(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9003")
    failed = save(c, "intro-2-v1", 2)
    assert failed == {"passed": False, "best": 2, "firstPassedAt": None}
    passed = save(c, "intro-2-v1", 4)
    assert passed["passed"] is True and passed["firstPassedAt"] is not None


def test_server_computes_score_and_rejects_client_claims(make_client: Factory, db: Session) -> None:
    """D-T2: 점수·통과는 서버가 회차의 첫 판정으로 계산. 클라이언트가 점수를 보내면 거부(422)."""
    c = member(make_client, db, "9004")
    run_id = start(c, "starter-1-v1")
    claims = {"runId": run_id, "score": 5, "passed": True, "best": 5}
    res = c.put(PUT.format("starter-1-v1"), json=claims)
    assert (res.status_code, res.json()["error"]["code"]) == (422, "validation_error")
    assert save(c, "starter-1-v1", 1) == {"passed": False, "best": 1, "firstPassedAt": None}


@pytest.mark.parametrize(
    ("stage", "body", "status", "code"),
    [
        ("mid-1-v1", {"runId": str(uuid.uuid4())}, 404, "stage_not_found"),  # 준비 중 과정
        (
            "intro-1-v1",
            {"score": 5, "total": 5},
            422,
            "validation_error",
        ),  # 옛 형식(클라이언트 점수)
        ("intro-1-v1", {"runId": "not-a-uuid"}, 422, "validation_error"),
        ("intro-1-v1", {}, 422, "validation_error"),
        ("intro-1-v1", {"runId": str(uuid.uuid4())}, 404, "run_not_found"),  # 없는 회차
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
    save(a, "intro-1-v1", 5)
    assert b.get("/api/me/tutorial/progress").json() == {}  # 남의 기록은 보이지 않음
    save(b, "intro-1-v1", 2)
    assert a.get("/api/me/tutorial/progress").json()["intro-1-v1"]["best"] == 5


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
    run = {"runId": str(uuid.uuid4())}
    assert c.get("/api/me/tutorial/progress").json()["error"]["code"] == code
    assert c.put(PUT.format("intro-1-v1"), json=run).json()["error"]["code"] == code
    assert c.post("/api/me/tutorial/stages/intro-1-v1/runs").json()["error"]["code"] == code
    judge = c.post(f"/api/me/tutorial/runs/{run['runId']}/judge", json={"situation": 1, "cell": 1})
    assert judge.json()["error"]["code"] == code


def test_csrf_on_save(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9009")
    evil = {"Origin": "https://evil.example"}
    res = c.put(PUT.format("intro-1-v1"), json={"runId": str(uuid.uuid4())}, headers=evil)
    assert res.json()["error"]["code"] == "csrf_origin_mismatch"
    res = c.post("/api/me/tutorial/stages/intro-1-v1/runs", headers=evil)
    assert res.json()["error"]["code"] == "csrf_origin_mismatch"


def test_nfr_006_no_per_situation_data(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9010")
    save(c, "intro-1-v1", 4)
    assert set(c.get("/api/me/tutorial/progress").json()["intro-1-v1"]) == {
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
    # 회차 표에도 고른 칸 번호 열은 없음 — 첫 판정(c/a/w/-)만 임시 보관(사용자 결정 2026-11-20)
    assert {col.name for col in TutorialRun.__table__.columns} == {
        "id",
        "user_id",
        "stage_id",
        "content_hash",
        "first_verdicts",
        "created_at",
        "expires_at",
        "completed_at",
    }
    assert set(db.scalars(select(TutorialRun.first_verdicts)).one()) <= set("caw-")


def test_ac_100_roster_status_uses_course_passed_counts(make_client: Factory, db: Session) -> None:
    """AC-100 r7·C-23: 운영진 현황은 새 과정별 '통과 스테이지 수 / 스테이지 수'."""
    m = member(make_client, db, "9011", name="통과회원")
    save(m, "intro-1-v1", 5)
    save(m, "intro-2-v1", 4)
    save(m, "starter-1-v1", 2)  # 미통과
    save(m, "basic-1-v1", 4)
    admin = member(make_client, db, "9012", role="admin")
    target = next(x for x in admin.get("/api/roster").json()["members"] if x["name"] == "통과회원")
    status = admin.get(f"/api/roster/members/{target['id']}/status").json()
    assert status["tutorial"] == [
        {"course": "intro", "name": "입문자", "passed": 2, "total": 2},
        {"course": "starter", "name": "왕초급", "passed": 0, "total": 3},
        {"course": "basic", "name": "초급", "passed": 1, "total": 3},
    ]
    assert target["tutorialRecommendedUnpassed"] is False  # D3 보류 유지


def _old_record(db: Session, user_name: str, stage_id: str) -> None:
    """개편 전 스테이지 기록(DB에 남아 있는 상태)을 직접 넣음."""
    user = db.scalars(select(User).where(User.name == user_name)).one()
    db.add(TutorialProgress(user_id=user.id, stage_id=stage_id, passed=True, best=5))
    db.commit()


def test_ac_118_old_records_not_counted(make_client: Factory, db: Session) -> None:
    """AC-118: 개편 전 beginner-1·novice-1 통과 기록은 새 진행률·운영진 현황에 합산되지 않음."""
    k = member(make_client, db, "9013", name="개편전회원")
    _old_record(db, "개편전회원", "beginner-1")
    _old_record(db, "개편전회원", "novice-1")
    assert k.get("/api/me/tutorial/progress").json() == {}
    admin = member(make_client, db, "9014", role="admin")
    target = next(
        x for x in admin.get("/api/roster").json()["members"] if x["name"] == "개편전회원"
    )
    status = admin.get(f"/api/roster/members/{target['id']}/status").json()
    assert [c["passed"] for c in status["tutorial"]] == [0, 0, 0]
    # 기록은 지우지 않음(C-28)
    assert db.scalar(select(func.count()).select_from(TutorialProgress)) == 2


def test_ac_119_old_stage_id_cannot_be_saved(make_client: Factory, db: Session) -> None:
    """AC-119: 개편 전 ID로 저장하면 404 stage_not_found, 기존 기록·새 기록은 그대로."""
    c = member(make_client, db, "9015", name="옛ID회원")
    _old_record(db, "옛ID회원", "beginner-1")
    save(c, "intro-1-v1", 3)
    res = c.put(PUT.format("beginner-1"), json={"runId": str(uuid.uuid4())})
    assert (res.status_code, res.json()["error"]["code"]) == (404, "stage_not_found")
    db.expire_all()
    rows = {r.stage_id: (r.passed, r.best) for r in db.scalars(select(TutorialProgress)).all()}
    assert rows == {"beginner-1": (True, 5), "intro-1-v1": (False, 3)}
