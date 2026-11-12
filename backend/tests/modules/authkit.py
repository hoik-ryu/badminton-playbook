"""인증 테스트 공용 도구: 가짜 카카오 클라이언트, 테스트 설정, 사용자 생성, 로그인 왕복."""

import uuid
from typing import cast
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from httpx import Response
from pydantic import SecretStr
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.auth.kakao import KakaoError
from app.modules.user.models import User, UserIdentity

ORIGIN = "http://localhost:5173"


def auth_settings(database_url: str = "sqlite://") -> Settings:
    # 실제 backend/.env(카카오 키)는 읽지 않음
    return Settings(
        _env_file=None,
        app_env="local",
        database_url=database_url,
        cors_origins=ORIGIN,
        kakao_rest_api_key=SecretStr("test-rest-key"),
        kakao_client_secret=SecretStr("test-client-secret"),
        kakao_redirect_uri=f"{ORIGIN}/api/auth/kakao/callback",
        session_secret=SecretStr("test-session-secret"),
    )


class FakeKakao:
    """인가 코드를 그대로 카카오 회원번호로 돌려줌. 'fail'이면 토큰 교환 실패."""

    def __init__(self) -> None:
        self.codes: list[str] = []

    def fetch_user_id(self, code: str) -> str:
        self.codes.append(code)
        if code == "fail":
            raise KakaoError("token_exchange_failed")
        return code


def make_user(
    db: Session,
    *,
    name: str = "홍길동",
    role: str = "member",
    status: str = "approved",
    kakao_id: str | None = None,
    gender: str = "남",
) -> User:
    user = User(name=name, gender=gender, grade="C조", role=role, status=status)
    if kakao_id:
        user.identities.append(UserIdentity(provider="kakao", provider_user_id=kakao_id))
    db.add(user)
    db.commit()
    return user


def kakao_login(client: TestClient, kakao_id: str, next_path: str | None = None) -> Response:
    """'카카오로 시작하기' → (카카오 인가 페이지 생략) → 콜백. 콜백 응답(302)을 돌려줌."""
    start = client.get("/api/auth/kakao/login", params={"next": next_path} if next_path else None)
    assert start.status_code == 302
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    res = client.get("/api/auth/kakao/callback", params={"code": kakao_id, "state": state})
    return cast(Response, res)


def signup(client: TestClient, kakao_id: str, name: str = "새회원") -> Response:
    callback = kakao_login(client, kakao_id)
    assert callback.headers["location"] == "/signup"
    res = client.post("/api/auth/signup", json={"name": name, "gender": "여", "grade": "D조"})
    return cast(Response, res)


def new_kakao_id() -> str:
    return str(uuid.uuid4().int % 10**10)
