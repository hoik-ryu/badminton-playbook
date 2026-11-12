"""튜토리얼 진행(I2) — 실제 PostgreSQL 연동.

동시 저장에도 최고 점수·통과·최초 통과 시각이 손상되지 않음.

`make migrate` 후 `make test-db`(또는 DATABASE_URL 지정 `pytest -m db`).
테스트가 만든 행만 지웁니다.
"""

import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.main import create_app
from app.modules.auth.kakao import get_kakao_client
from app.modules.tutorial.models import TutorialProgress
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import ORIGIN, FakeKakao, auth_settings, kakao_login, new_kakao_id

pytestmark = pytest.mark.db
TAG = f"tdb-{uuid.uuid4().hex[:6]}"


@pytest.fixture
def pg() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        yield session
        session.rollback()
        session.execute(delete(User).where(User.name.startswith(TAG)))  # 진행 기록은 CASCADE
        session.commit()


@pytest.fixture
def member(pg: Session) -> Iterator[tuple[TestClient, uuid.UUID]]:
    app = create_app()
    settings = get_settings()
    app.dependency_overrides[get_settings] = lambda: auth_settings(settings.database_url)
    app.dependency_overrides[get_kakao_client] = lambda: FakeKakao()
    kid = new_kakao_id()
    user = User(name=f"{TAG}회원", gender="여", grade="초심", status="approved")
    user.identities.append(UserIdentity(provider="kakao", provider_user_id=kid))
    pg.add(user)
    pg.commit()
    with TestClient(app, base_url=ORIGIN, follow_redirects=False, headers={"Origin": ORIGIN}) as c:
        kakao_login(c, kid)
        yield c, user.id


def test_db_concurrent_saves_keep_best_and_first_pass(
    member: tuple[TestClient, uuid.UUID], pg: Session
) -> None:
    client, user_id = member
    scores = [2, 4, 3, 5, 1, 4, 0, 5, 3, 2] * 2

    def put(score: int) -> int:
        res = client.put("/api/me/tutorial/stages/novice-1", json={"score": score, "total": 5})
        return int(res.status_code)

    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(put, scores))
    assert set(statuses) == {200}
    rows = pg.scalars(select(TutorialProgress).where(TutorialProgress.user_id == user_id)).all()
    assert len(rows) == 1  # 동시 요청에도 한 행
    row = rows[0]
    assert (row.stage_id, row.passed, row.best) == ("novice-1", True, 5)
    assert row.first_passed_at is not None
    first = row.first_passed_at
    # 다시 보내도 최초 통과 시각은 그대로
    assert (
        client.put("/api/me/tutorial/stages/novice-1", json={"score": 4, "total": 5}).status_code
        == 200
    )
    pg.expire_all()
    again = pg.scalars(select(TutorialProgress).where(TutorialProgress.user_id == user_id)).one()
    assert (again.best, again.first_passed_at) == (5, first)


def test_db_constraints_and_cascade(pg: Session) -> None:
    user = User(name=f"{TAG}제약", gender="남", grade="C조", status="approved")
    pg.add(user)
    pg.commit()
    pg.add(TutorialProgress(user_id=user.id, stage_id="beginner-1", passed=False, best=-1))
    with pytest.raises(IntegrityError):  # CHECK best >= 0
        pg.commit()
    pg.rollback()
    pg.add(TutorialProgress(user_id=user.id, stage_id="beginner-1", passed=True, best=5))
    pg.commit()
    pg.execute(delete(User).where(User.id == user.id))
    pg.commit()
    left = pg.scalar(
        select(func.count())
        .select_from(TutorialProgress)
        .where(TutorialProgress.user_id == user.id)
    )
    assert left == 0  # 회원 삭제 시 진행 기록도 삭제(CASCADE)
