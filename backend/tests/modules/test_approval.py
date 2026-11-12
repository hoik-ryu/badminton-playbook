"""가입 승인(SCR-231, AC-006·007, UXD-012·014)과 서버 권한(NFR-005)."""

import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user, signup


def admin_client(
    make_client: Callable[[], TestClient], db: Session, role: str = "admin"
) -> TestClient:
    c = make_client()
    make_user(db, name="운영진", role=role, kakao_id=f"9{role}")
    kakao_login(c, f"9{role}")
    return c


def test_ac_006_signup_approve_relogin(make_client: Callable[[], TestClient], db: Session) -> None:
    """신규 가입 → 승인 대기 → 운영진 승인 → 재로그인 → 서비스 진입."""
    applicant = make_client()
    assert signup(applicant, "3001", name="신청자").json()["status"] == "pending"
    # 승인 대기 중에는 서비스 API 거부
    assert applicant.get("/api/approvals").json()["error"]["code"] == "account_restricted"

    admin = admin_client(make_client, db)
    assert admin.get("/api/approvals/count").json() == {"count": 1}
    [row] = admin.get("/api/approvals").json()
    assert row["name"] == "신청자" and row["duplicateName"] is False and row["referrer"] is None
    assert admin.post(f"/api/approvals/{row['id']}/approve").status_code == 204
    assert admin.get("/api/approvals/count").json() == {"count": 0}

    # 같은 세션으로도 바로 반영(계정 상태 '다시 확인')
    assert applicant.get("/api/auth/me").json()["status"] == "approved"
    # 로그아웃 → 다시 카카오 로그인 → 서비스 첫 화면
    applicant.post("/api/auth/logout")
    assert kakao_login(applicant, "3001").headers["location"] == "/tutorial"
    user = db.get(User, uuid.UUID(row["id"]))
    assert user is not None
    db.refresh(user)
    assert user.decided_at is not None and user.decided_by_id is not None


def test_ac_007_reject(make_client: Callable[[], TestClient], db: Session) -> None:
    applicant = make_client()
    applicant_id = signup(applicant, "3002").json()["id"]
    admin = admin_client(make_client, db)
    assert admin.post(f"/api/approvals/{applicant_id}/reject").status_code == 204
    assert applicant.get("/api/auth/me").json()["status"] == "rejected"
    applicant.post("/api/auth/logout")
    assert kakao_login(applicant, "3002").headers["location"] == "/account-status"


def test_already_processed_conflict(make_client: Callable[[], TestClient], db: Session) -> None:
    applicant_id = signup(make_client(), "3003").json()["id"]
    admin = admin_client(make_client, db)
    assert admin.post(f"/api/approvals/{applicant_id}/approve").status_code == 204
    res = admin.post(f"/api/approvals/{applicant_id}/reject")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "already_processed"
    unknown = admin.post("/api/approvals/00000000-0000-0000-0000-000000000000/approve")
    assert unknown.json()["error"]["code"] == "already_processed"


def test_bulk_approve_is_all_or_nothing(make_client: Callable[[], TestClient], db: Session) -> None:
    ids = [signup(make_client(), f"310{i}", name=f"일괄{i}").json()["id"] for i in range(3)]
    admin = admin_client(make_client, db)
    assert admin.post(f"/api/approvals/{ids[0]}/reject").status_code == 204
    res = admin.post("/api/approvals/approve", json={"ids": ids})
    assert res.status_code == 409  # 하나라도 처리됐으면 아무것도 바꾸지 않음
    assert admin.get("/api/approvals/count").json() == {"count": 2}
    ok = admin.post("/api/approvals/approve", json={"ids": ids[1:]})
    assert ok.json() == {"approved": 2}


def test_duplicate_name_warning(make_client: Callable[[], TestClient], db: Session) -> None:
    make_user(db, name="동명이", gender="여")  # 직접 추가 회원(카카오 계정 없음)
    signup(make_client(), "3201", name="동명이")
    admin = admin_client(make_client, db)
    [row] = admin.get("/api/approvals").json()
    assert row["duplicateName"] is True


@pytest.mark.parametrize(
    ("role", "status", "code"),
    [
        (None, None, "unauthenticated"),
        ("member", "approved", "forbidden"),
        ("admin", "pending", "account_restricted"),
        ("admin", "inactive", "account_restricted"),
    ],
)
def test_approvals_permissions(
    make_client: Callable[[], TestClient],
    db: Session,
    role: str | None,
    status: str | None,
    code: str,
) -> None:
    c = make_client()
    if role and status:
        make_user(db, role=role, status=status, kakao_id="3301")
        kakao_login(c, "3301")
    for method, path in [
        ("GET", "/api/approvals"),
        ("GET", "/api/approvals/count"),
        ("POST", "/api/approvals/00000000-0000-0000-0000-000000000000/approve"),
        ("POST", "/api/approvals/approve"),
    ]:
        res = c.request(method, path, json={"ids": ["00000000-0000-0000-0000-000000000000"]})
        assert res.json()["error"]["code"] == code, (method, path)


def test_mock_role_query_does_not_bypass_server(
    make_client: Callable[[], TestClient], db: Session
) -> None:
    """FE 개발용 '?as=admin'은 서버 권한과 무관(쿼리를 붙여도 회원은 거부)."""
    c = make_client()
    make_user(db, role="member", kakao_id="3401")
    kakao_login(c, "3401")
    assert c.get("/api/approvals?as=admin").status_code == 403
    assert c.get("/api/approvals?as=superAdmin").status_code == 403
