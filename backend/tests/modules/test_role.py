"""역할 관리(SCR-232, AC-008·009)와 최초 슈퍼 관리자 지정 CLI(ASM-015)."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.modules.user import cli
from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user


def login_as(make_client: Callable[[], TestClient], db: Session, role: str, kid: str) -> TestClient:
    c = make_client()
    make_user(db, name=f"{role}-{kid}", role=role, kakao_id=kid)
    kakao_login(c, kid)
    return c


def test_ac_008_super_admin_appoints_and_dismisses_admin(
    make_client: Callable[[], TestClient], db: Session
) -> None:
    sup = login_as(make_client, db, "super_admin", "4001")
    target = make_user(db, name="후보")  # 카카오 계정 없는 직접 추가 회원도 대상
    assert sup.put(f"/api/roles/{target.id}", json={"role": "admin"}).status_code == 204
    roles = {r["name"]: r["role"] for r in sup.get("/api/roles").json()}
    assert roles["후보"] == "admin" and roles["super_admin-4001"] == "superAdmin"
    again = sup.put(f"/api/roles/{target.id}", json={"role": "admin"})
    assert again.json()["error"]["code"] == "already_processed"
    assert sup.put(f"/api/roles/{target.id}", json={"role": "member"}).status_code == 204


def test_ac_009_admin_cannot_manage_roles(
    make_client: Callable[[], TestClient], db: Session
) -> None:
    admin = login_as(make_client, db, "admin", "4002")
    target = make_user(db, name="대상")
    assert admin.get("/api/roles").json()["error"]["code"] == "forbidden"
    res = admin.put(f"/api/roles/{target.id}", json={"role": "admin"})
    assert res.json()["error"]["code"] == "forbidden"


def test_super_admin_role_cannot_be_changed_via_api(
    make_client: Callable[[], TestClient], db: Session
) -> None:
    sup = login_as(make_client, db, "super_admin", "4003")
    other = make_user(db, name="다른슈퍼", role="super_admin")
    pending = make_user(db, name="대기", status="pending")
    for uid in (other.id, pending.id):
        res = sup.put(f"/api/roles/{uid}", json={"role": "member"})
        assert res.json()["error"]["code"] == "role_change_not_allowed"
    # 슈퍼 관리자로 올리는 값은 스키마에서 거부
    assert sup.put(f"/api/roles/{pending.id}", json={"role": "super_admin"}).status_code == 422


# ── CLI: 최초 슈퍼 관리자 ──


@pytest.fixture
def cli_db(
    db_factory: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> sessionmaker[Session]:
    monkeypatch.setattr(cli, "get_sessionmaker", lambda: db_factory)
    return db_factory


def test_cli_grants_first_super_admin(cli_db: sessionmaker[Session], db: Session) -> None:
    applicant = make_user(db, name="최초관리자", status="pending", kakao_id="5001")
    assert cli.main(["grant-super-admin", str(applicant.id)]) == 0
    db.refresh(applicant)
    assert (applicant.role, applicant.status) == ("super_admin", "approved")


def test_cli_refuses_second_super_admin_without_flag(
    cli_db: sessionmaker[Session], db: Session
) -> None:
    make_user(db, name="기존", role="super_admin")
    second = make_user(db, name="두번째", status="approved")
    assert cli.main(["grant-super-admin", str(second.id)]) == 1
    db.refresh(second)
    assert second.role == "member"
    assert cli.main(["grant-super-admin", str(second.id), "--additional"]) == 0


@pytest.mark.parametrize("status", ["rejected", "inactive"])
def test_cli_refuses_restricted_user(
    cli_db: sessionmaker[Session], db: Session, status: str
) -> None:
    user = make_user(db, status=status)
    assert cli.main(["grant-super-admin", str(user.id)]) == 1


def test_cli_rejects_unknown_or_invalid_id(cli_db: sessionmaker[Session]) -> None:
    assert cli.main(["grant-super-admin", "not-a-uuid"]) == 2
    assert cli.main(["grant-super-admin", "00000000-0000-0000-0000-000000000000"]) == 1


def test_cli_list(
    cli_db: sessionmaker[Session], db: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    make_user(db, name="목록대기", status="pending", kakao_id="5002")
    make_user(db, name="직접회원")
    assert cli.main(["list", "--status", "pending"]) == 0
    out = capsys.readouterr().out
    assert "목록대기" in out and "카카오" in out and "직접회원" not in out
    assert db.query(User).count() == 2
