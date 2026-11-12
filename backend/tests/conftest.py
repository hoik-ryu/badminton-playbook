import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core import db as db_module
from app.core.config import get_settings
from app.core.dbguard import UnsafeDatabaseError, check_test_database_url
from app.main import create_app

# ── DB 테스트 보호(pytest -m db) ──
# 실제 DB 테스트는 TEST_DATABASE_URL(임시 테스트 DB)만 씀.
# backend/.env의 DATABASE_URL(원본 smapsh)은 쓰지 않음. 값이 없거나 안전 규칙(app/core/dbguard.py)에
# 어긋나면 어떤 테스트도 실행하기 전에 중단(연결 시도 없음).
DB_GUARD_EXIT = 4


def pytest_collection_finish(session: pytest.Session) -> None:
    if not any(item.get_closest_marker("db") for item in session.items):
        return
    url = os.environ.get("TEST_DATABASE_URL")
    try:
        check_test_database_url(url)
    except UnsafeDatabaseError as e:
        pytest.exit(f"DB 테스트 중단(연결하지 않음): {e}", returncode=DB_GUARD_EXIT)
    os.environ["DATABASE_URL"] = url  # type: ignore[assignment]  # 검사 통과
    get_settings.cache_clear()
    db_module.get_engine.cache_clear()
    db_module.get_sessionmaker.cache_clear()


@pytest.fixture(autouse=True)
def _db_target_is_test_database(request: pytest.FixtureRequest) -> None:
    """이중 확인: db 테스트가 실제로 쓰는 엔진 주소가 TEST_DATABASE_URL과 같은지."""
    if request.node.get_closest_marker("db") is None:
        return
    expected = check_test_database_url(os.environ.get("TEST_DATABASE_URL"))
    actual = db_module.get_engine().url
    assert (actual.host, actual.port, actual.database) == (
        expected.host,
        expected.port,
        expected.database,
    ), "db 테스트가 TEST_DATABASE_URL이 아닌 DB를 가리킵니다"


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
