"""로컬 개발용 운영진 ID/PW 로그인: FastAPI 검증, 기존 세션·로그아웃 재사용, 로컬 전용."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.auth.security import signing_key
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import auth_settings, make_user

CREDS = {"username": "super_admin", "password": "local-dev-password"}


@pytest.fixture
def settings_patch() -> dict[str, Any]:
    return {
        "dev_login_enabled": True,
        "dev_admin_username": "super_admin",
        "dev_admin_password": SecretStr("local-dev-password"),
    }


def test_dev_login_status_enabled(client: TestClient) -> None:
    assert client.get("/api/auth/dev-login").json() == {"enabled": True}


def test_dev_login_success_creates_super_admin_session(client: TestClient, db: Session) -> None:
    res = client.post("/api/auth/dev-login", json=CREDS)
    assert res.status_code == 200
    me = res.json()
    assert (me["role"], me["status"]) == ("superAdmin", "approved")
    # 새로고침(같은 쿠키로 다시 조회)해도 유지
    assert client.get("/api/auth/me").json() == me
    # 운영진·슈퍼 관리자 기능 전부 접근
    assert client.get("/api/approvals").status_code == 200
    assert client.get("/api/approvals/count").status_code == 200
    assert client.get("/api/roles").status_code == 200
    # 비밀번호는 DB에 없음: 사용자 1명 + provider='dev' 연결만
    identity = db.scalars(select(UserIdentity)).one()
    assert (identity.provider, identity.provider_user_id) == ("dev", "super_admin")
    assert "local-dev-password" not in str([c for c in User.__table__.columns])


def test_dev_login_reuses_same_user_and_logout(
    make_client: Callable[[], TestClient], db: Session
) -> None:
    a, b = make_client(), make_client()
    id_a = a.post("/api/auth/dev-login", json=CREDS).json()["id"]
    id_b = b.post("/api/auth/dev-login", json=CREDS).json()["id"]
    assert id_a == id_b
    assert db.scalar(select(func.count()).select_from(User)) == 1
    assert a.post("/api/auth/logout").status_code == 204
    assert a.get("/api/auth/me").status_code == 401
    assert a.get("/api/approvals").status_code == 401
    assert b.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize(
    "body",
    [
        {"username": "super_admin", "password": "wrong"},
        {"username": "admin", "password": "local-dev-password"},
        {"username": "", "password": ""},
    ],
)
def test_dev_login_wrong_credentials(client: TestClient, db: Session, body: dict[str, str]) -> None:
    res = client.post("/api/auth/dev-login", json=body)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_credentials"
    assert client.get("/api/auth/me").status_code == 401
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_dev_login_requires_allowed_origin(client: TestClient) -> None:
    res = client.post("/api/auth/dev-login", json=CREDS, headers={"Origin": "https://evil.example"})
    assert res.json()["error"]["code"] == "csrf_origin_mismatch"


def test_dev_login_does_not_touch_kakao_users(client: TestClient, db: Session) -> None:
    kakao_user = make_user(db, name="카카오회원", kakao_id="7001")
    client.post("/api/auth/dev-login", json=CREDS)
    db.refresh(kakao_user)
    assert kakao_user.role == "member"


@pytest.mark.parametrize(
    "patch",
    [
        {"dev_login_enabled": False},  # 기본값: 꺼짐
        {"app_env": "production"},  # 운영 환경
        {"dev_admin_password": SecretStr("")},  # 비밀번호 미설정
    ],
)
def test_dev_login_disabled(
    make_client: Callable[[], TestClient], settings_patch: dict[str, Any], patch: dict[str, Any]
) -> None:
    settings_patch.update(patch)
    c = make_client()
    assert c.get("/api/auth/dev-login").json() == {"enabled": False}
    res = c.post("/api/auth/dev-login", json=CREDS)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "dev_login_disabled"


def test_dev_login_defaults_off() -> None:
    assert auth_settings().dev_login_active is False


def test_server_refuses_to_start_with_dev_login_outside_local() -> None:
    settings = auth_settings().model_copy(
        update={
            "app_env": "production",
            "dev_login_enabled": True,
            "session_secret": SecretStr("x" * 48),
        }
    )
    with pytest.raises(RuntimeError, match="DEV_LOGIN_ENABLED"):
        signing_key(settings)
