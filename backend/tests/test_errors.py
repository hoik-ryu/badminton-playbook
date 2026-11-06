from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, field_validator

from app.core.errors import AppError
from app.main import create_app


class _Body(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def reject(cls, value: str) -> str:
        raise ValueError("invalid name")


def _client() -> TestClient:
    app = create_app()

    @app.get("/_app-error")
    def app_error() -> None:
        raise AppError(code="example_conflict", message="Already exists", status_code=409)

    @app.get("/_http-error")
    def http_error() -> None:
        raise HTTPException(401, "Unauthorized", headers={"WWW-Authenticate": "Bearer"})

    @app.post("/_validate")
    def validate(body: _Body) -> None:
        pass

    @app.get("/_crash")
    def crash() -> None:
        raise RuntimeError("boom")

    return TestClient(app, raise_server_exceptions=False)


def test_app_error_is_serialized() -> None:
    res = _client().get("/_app-error")
    assert res.status_code == 409
    assert res.json() == {
        "error": {"code": "example_conflict", "message": "Already exists", "details": None}
    }


def test_http_exception_keeps_headers() -> None:
    res = _client().get("/_http-error")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "http_401"
    assert res.headers["www-authenticate"] == "Bearer"


def test_validation_error_with_custom_validator_is_serializable() -> None:
    res = _client().post("/_validate", json={"name": "x"})
    assert res.status_code == 422
    body = res.json()["error"]
    assert body["code"] == "validation_error"
    assert body["details"][0]["loc"] == ["body", "name"]


def test_unhandled_exception_uses_error_envelope() -> None:
    res = _client().get("/_crash")
    assert res.status_code == 500
    assert res.json() == {
        "error": {"code": "internal_error", "message": "Internal server error", "details": None}
    }
