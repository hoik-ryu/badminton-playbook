from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.db import Base, get_db
from app.main import create_app
from app.modules.auth.kakao import get_kakao_client
from tests.modules.authkit import ORIGIN, FakeKakao, auth_settings


@pytest.fixture
def db_factory() -> Iterator[sessionmaker[Session]]:
    """DB 없이 도는 단위 테스트용 메모리 SQLite(스키마는 모델에서 생성)."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def db(db_factory: sessionmaker[Session]) -> Iterator[Session]:
    with db_factory() as session:
        yield session


@pytest.fixture
def kakao() -> FakeKakao:
    return FakeKakao()


@pytest.fixture
def settings_patch() -> dict[str, Any]:
    """테스트 모듈에서 재정의해 설정을 바꿈(예: 개발용 로그인 켜기)."""
    return {}


@pytest.fixture
def make_client(
    db_factory: sessionmaker[Session], kakao: FakeKakao, settings_patch: dict[str, Any]
) -> Iterator[Callable[[], TestClient]]:
    """브라우저 1개 = 클라이언트 1개(쿠키 따로). Origin은 허용된 프런트 주소."""
    app = create_app()

    def override_db() -> Iterator[Session]:
        with db_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = lambda: auth_settings().model_copy(
        update=settings_patch
    )
    app.dependency_overrides[get_kakao_client] = lambda: kakao
    clients: list[TestClient] = []

    def factory() -> TestClient:
        c = TestClient(app, base_url=ORIGIN, follow_redirects=False, headers={"Origin": ORIGIN})
        clients.append(c)
        return c

    yield factory
    for c in clients:
        c.close()


@pytest.fixture
def client(make_client: Callable[[], TestClient]) -> TestClient:
    return make_client()
