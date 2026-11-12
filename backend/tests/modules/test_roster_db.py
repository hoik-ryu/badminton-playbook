"""명단 I1 — 실제 PostgreSQL(마이그레이션 0004 적용) 연동: 제약 조건, 소프트 삭제, 충돌 감지.

`make migrate` 후 `make test-db`(또는 DATABASE_URL 지정 `pytest -m db`).
테스트가 만든 행만 지웁니다.
"""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.main import create_app
from app.modules.auth.deps import now_utc
from app.modules.auth.kakao import get_kakao_client
from app.modules.roster.models import Guest, MemberRating
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import ORIGIN, FakeKakao, auth_settings, kakao_login, new_kakao_id

pytestmark = pytest.mark.db
TAG = f"db-{uuid.uuid4().hex[:6]}"  # 이 테스트가 만든 행 표시(이름 접두사)
# 삭제(비식별화)되면 이름이 지워지므로 id로도 정리
CREATED_GUESTS: list[uuid.UUID] = []


@pytest.fixture
def pg() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        yield session
        session.rollback()
        session.execute(
            delete(Guest).where(Guest.name.startswith(TAG) | Guest.id.in_(CREATED_GUESTS))
        )
        session.execute(
            delete(User).where(User.name.startswith(TAG))
        )  # 평가·세션·외부 계정은 CASCADE
        session.commit()


@pytest.fixture
def admin(pg: Session) -> Iterator[TestClient]:
    app = create_app()
    settings = get_settings()
    app.dependency_overrides[get_settings] = lambda: auth_settings(settings.database_url)
    app.dependency_overrides[get_kakao_client] = lambda: FakeKakao()
    kid = new_kakao_id()
    user = User(name=f"{TAG}운영진", gender="남", grade="A조", role="admin", status="approved")
    user.identities.append(UserIdentity(provider="kakao", provider_user_id=kid))
    pg.add(user)
    pg.commit()
    with TestClient(app, base_url=ORIGIN, follow_redirects=False, headers={"Origin": ORIGIN}) as c:
        kakao_login(c, kid)
        yield c


def test_db_constraints(pg: Session) -> None:
    user = User(name=f"{TAG}회원", gender="여", grade="B조", status="approved")
    pg.add(user)
    pg.commit()
    pg.add(MemberRating(user_id=user.id, score=11))
    with pytest.raises(IntegrityError):
        pg.commit()  # 1–10 CHECK
    pg.rollback()
    pg.add(Guest(name=f"{TAG}손님", gender="여", grade="S조"))
    with pytest.raises(IntegrityError):
        pg.commit()  # 급수 CHECK
    pg.rollback()
    # 비식별화 CHECK: 삭제 전에는 이름·급수 필수, 삭제 후에는 둘 다 비어 있어야 함
    pg.add(Guest(name=None, gender="여", grade=None))
    with pytest.raises(IntegrityError):
        pg.commit()
    pg.rollback()
    pg.add(Guest(name=f"{TAG}삭제", gender="여", grade="C조", deleted_at=now_utc()))
    with pytest.raises(IntegrityError):
        pg.commit()
    pg.rollback()
    # 삭제됐는데 성별·점수가 남아 있으면 거부(C안)
    for leftover in ({"gender": "여"}, {"score": 5}):
        pg.add(Guest(name=None, grade=None, deleted_at=now_utc(), **leftover))
        with pytest.raises(IntegrityError):
            pg.commit()
        pg.rollback()
    # 삭제 전에는 성별 필수
    pg.add(Guest(name=f"{TAG}성별없음", gender=None, grade="C조"))
    with pytest.raises(IntegrityError):
        pg.commit()
    pg.rollback()
    pg.add(MemberRating(user_id=user.id, score=7))
    pg.commit()
    pg.execute(delete(User).where(User.id == user.id))
    pg.commit()
    assert pg.get(MemberRating, user.id) is None  # 회원 삭제 시 평가도 삭제(CASCADE)


def test_db_roster_flow_soft_delete_and_conflict(admin: TestClient, pg: Session) -> None:
    g = admin.post(
        "/api/roster/guests",
        json={"name": f"{TAG}게스트", "gender": "남", "grade": "C조", "score": 5},
    ).json()
    CREATED_GUESTS.append(uuid.UUID(g["id"]))
    m = admin.post(
        "/api/roster/members",
        json={"name": f"{TAG}직접", "gender": "여", "grade": "D조", "score": 3},
    ).json()
    roster = admin.get("/api/roster").json()
    assert any(x["id"] == g["id"] for x in roster["guests"])
    assert any(x["id"] == m["id"] and x["score"] == 3 for x in roster["members"])
    ok = admin.put(
        f"/api/roster/members/{m['id']}",
        json={
            "name": f"{TAG}직접",
            "gender": "여",
            "grade": "C조",
            "score": 4,
            "version": m["version"],
        },
    )
    assert ok.status_code == 200
    stale = admin.put(
        f"/api/roster/members/{m['id']}",
        json={
            "name": f"{TAG}직접",
            "gender": "여",
            "grade": "B조",
            "score": 9,
            "version": m["version"],
        },
    )
    assert stale.json()["error"]["code"] == "conflict"
    assert admin.delete(f"/api/roster/guests/{g['id']}").status_code == 204
    kept = pg.scalars(select(Guest).where(Guest.id == uuid.UUID(g["id"]))).one()
    assert kept.deleted_at is not None
    # 비식별화(U5·C안)
    assert (kept.name, kept.grade, kept.gender, kept.score) == (None, None, None, None)
    assert all(x["id"] != g["id"] for x in admin.get("/api/roster").json()["guests"])
