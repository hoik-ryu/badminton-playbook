"""실제 PostgreSQL(마이그레이션 적용 DB) 연동: 가입 → 승인 → 재로그인, 중복 가입, 제약 조건.

`make migrate` 후 `make test-db`(또는 DATABASE_URL을 지정해 `pytest -m db`)로 실행.
테스트가 만든 사용자만 지웁니다(무작위 카카오 회원번호로 구분).
"""

from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.main import create_app
from app.modules.auth.kakao import get_kakao_client
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import (
    ORIGIN,
    FakeKakao,
    auth_settings,
    kakao_login,
    new_kakao_id,
    signup,
)

pytestmark = pytest.mark.db


@pytest.fixture
def pg() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        yield session


@pytest.fixture
def created(pg: Session) -> Iterator[list[str]]:
    kakao_ids: list[str] = []
    yield kakao_ids
    user_ids = pg.scalars(
        select(UserIdentity.user_id).where(
            UserIdentity.provider == "kakao", UserIdentity.provider_user_id.in_(kakao_ids)
        )
    ).all()
    pg.execute(delete(User).where(User.id.in_(user_ids)))  # 세션·외부 계정은 CASCADE
    pg.commit()


@pytest.fixture
def browser() -> Iterator[Callable[[], TestClient]]:
    app = create_app()
    settings = get_settings()
    app.dependency_overrides[get_settings] = lambda: auth_settings(settings.database_url)
    kakao = FakeKakao()
    app.dependency_overrides[get_kakao_client] = lambda: kakao
    clients: list[TestClient] = []

    def factory() -> TestClient:
        c = TestClient(app, base_url=ORIGIN, follow_redirects=False, headers={"Origin": ORIGIN})
        clients.append(c)
        return c

    yield factory
    for c in clients:
        c.close()


def test_db_signup_approve_relogin(
    browser: Callable[[], TestClient], pg: Session, created: list[str]
) -> None:
    applicant_kid, admin_kid = new_kakao_id(), new_kakao_id()
    created += [applicant_kid, admin_kid]
    admin_user = User(name="DB운영진", gender="남", grade="A조", role="admin", status="approved")
    admin_user.identities.append(UserIdentity(provider="kakao", provider_user_id=admin_kid))
    pg.add(admin_user)
    pg.commit()

    applicant = browser()
    me = signup(applicant, applicant_kid, name="DB신청자").json()
    assert me["status"] == "pending"
    # 같은 카카오 계정 재가입 → 기존 계정(AC-002)
    again = browser()
    assert kakao_login(again, applicant_kid).headers["location"] == "/account-status"

    admin = browser()
    kakao_login(admin, admin_kid)
    assert any(r["id"] == me["id"] for r in admin.get("/api/approvals").json())
    assert admin.post(f"/api/approvals/{me['id']}/approve").status_code == 204

    applicant.post("/api/auth/logout")
    assert applicant.get("/api/auth/me").status_code == 401
    assert kakao_login(applicant, applicant_kid).headers["location"] == "/tutorial"
    assert applicant.get("/api/auth/me").json()["status"] == "approved"


def test_db_constraints(pg: Session, created: list[str]) -> None:
    kid = new_kakao_id()
    created.append(kid)
    user = User(name="제약", gender="여", grade="B조")
    user.identities.append(UserIdentity(provider="kakao", provider_user_id=kid))
    pg.add(user)
    pg.commit()
    dup = User(name="중복", gender="여", grade="B조")
    dup.identities.append(UserIdentity(provider="kakao", provider_user_id=kid))
    pg.add(dup)
    with pytest.raises(IntegrityError):
        pg.commit()  # 같은 카카오 계정은 한 사용자에게만
    pg.rollback()
    pg.add(User(name="잘못된역할", gender="여", grade="B조", role="owner"))
    with pytest.raises(IntegrityError):
        pg.commit()  # CHECK 제약
    pg.rollback()
