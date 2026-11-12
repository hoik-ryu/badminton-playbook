"""본인 프로필(SCR-121·122): AC-053 조회, AC-054·098 수정.

AC-017·066: 회원 응답에 운영진 전용 필드 없음.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user


def test_ac_053_profile_has_only_name_gender_grade(client: TestClient, db: Session) -> None:
    make_user(db, name="본인", gender="여", kakao_id="6001")
    kakao_login(client, "6001")
    res = client.get("/api/me/profile")
    assert res.status_code == 200
    assert res.json() == {"name": "본인", "gender": "여", "grade": "C조"}
    for forbidden in ("score", "referrer", "tutorial", "rank", "role", "status"):
        assert forbidden not in res.text


def test_ac_054_098_update_profile_reflects_everywhere(client: TestClient, db: Session) -> None:
    user = make_user(db, name="옛이름", kakao_id="6002")
    kakao_login(client, "6002")
    body = {"name": "  새이름 ", "gender": "남", "grade": "B조"}
    res = client.put("/api/me/profile", json=body)
    assert res.json() == {"name": "새이름", "gender": "남", "grade": "B조"}
    assert client.get("/api/auth/me").json()["name"] == "새이름"
    db.refresh(user)  # 운영진 명단이 읽는 같은 users 행
    assert (user.name, user.gender, user.grade) == ("새이름", "남", "B조")
    assert (user.role, user.status) == ("member", "approved")  # 역할·상태는 바꿀 수 없음


@pytest.mark.parametrize(
    "body",
    [
        {"name": " ", "gender": "남", "grade": "B조"},
        {"name": "가" * 31, "gender": "남", "grade": "B조"},
        {"name": "이름", "gender": "", "grade": "B조"},
        {"name": "이름", "gender": "남", "grade": "S조"},
        {"name": "이름", "gender": "남", "grade": "B조", "role": "admin", "status": "approved"},
    ],
)
def test_profile_validation(client: TestClient, db: Session, body: dict[str, str]) -> None:
    user = make_user(db, name="검증", kakao_id="6003")
    kakao_login(client, "6003")
    res = client.put("/api/me/profile", json=body)
    db.refresh(user)
    if "role" in body:  # 알 수 없는 필드는 무시(권한 상승 불가)
        assert res.status_code == 200 and user.role == "member"
    else:
        assert res.status_code == 422 and user.name == "검증"


@pytest.mark.parametrize("status", ["pending", "rejected", "inactive"])
def test_restricted_accounts_cannot_use_profile(
    client: TestClient, db: Session, status: str
) -> None:
    make_user(db, status=status, kakao_id="6004")
    kakao_login(client, "6004")
    assert client.get("/api/me/profile").json()["error"]["code"] == "account_restricted"


def test_profile_requires_login_and_origin(client: TestClient, db: Session) -> None:
    assert client.get("/api/me/profile").status_code == 401
    make_user(db, kakao_id="6005")
    kakao_login(client, "6005")
    res = client.put(
        "/api/me/profile",
        json={"name": "외부", "gender": "남", "grade": "A조"},
        headers={"Origin": "https://evil.example"},
    )
    assert res.json()["error"]["code"] == "csrf_origin_mismatch"
    assert db.query(User).filter(User.name == "외부").count() == 0
