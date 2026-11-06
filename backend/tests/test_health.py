from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core import db as db_module
from app.core.db import get_db
from app.main import create_app


class _FakeSession:
    def __init__(self, fail: bool) -> None:
        self.fail = fail

    def execute(self, *_: object) -> None:
        if self.fail:
            raise RuntimeError("db down")

    def close(self) -> None:
        pass


def _client_with_db(fail: bool) -> TestClient:
    app = create_app()

    def override() -> Iterator[Session]:
        yield _FakeSession(fail)  # type: ignore[misc]

    app.dependency_overrides[get_db] = override
    return TestClient(app)


def test_health_ok_when_database_reachable() -> None:
    res = _client_with_db(fail=False).get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert {"app", "version", "environment"} <= body.keys()


def test_health_degraded_when_database_unreachable() -> None:
    res = _client_with_db(fail=True).get("/health")
    assert res.status_code == 503
    assert res.json()["status"] == "degraded"
    assert res.json()["database"] == "unavailable"


def test_unknown_route_uses_error_envelope(client: TestClient) -> None:
    res = client.get("/does-not-exist")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "http_404"


@pytest.mark.db
def test_real_database_connection() -> None:
    """Runs only with `pytest -m db` against a live PostgreSQL (see `make test-db`)."""
    session = db_module.get_sessionmaker()()
    try:
        assert db_module.check_database(session) is True
    finally:
        session.close()
