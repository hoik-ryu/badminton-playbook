"""서명 쿠키·세션 토큰 도우미(외부 의존성 없이 HMAC-SHA256)."""

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.core.config import DEV_LOGIN_ENVS, Settings

# 로컬에서 SESSION_SECRET을 비워 둔 경우에만 쓰는 프로세스 임시 비밀값.
# (재시작하면 진행 중인 로그인 state·가입 티켓이 무효가 됨)
_EPHEMERAL_SECRET = secrets.token_bytes(32)


def signing_key(settings: Settings) -> bytes:
    value = settings.session_secret.get_secret_value()
    if settings.app_env != "local" and (len(value) < 32 or value.startswith("change-me")):
        raise RuntimeError("SESSION_SECRET must be a random value of 32+ chars outside local")
    if settings.dev_login_enabled and settings.app_env not in DEV_LOGIN_ENVS:
        raise RuntimeError("DEV_LOGIN_ENABLED is only allowed when APP_ENV=local or e2e")
    if value:
        return value.encode()
    return _EPHEMERAL_SECRET


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign(settings: Settings, purpose: str, payload: dict[str, Any], ttl_seconds: int) -> str:
    """purpose별로 분리된 서명 값. 만료 시각(exp)을 함께 서명."""
    body = _b64(json.dumps({**payload, "exp": int(time.time()) + ttl_seconds}).encode())
    mac = hmac.new(signing_key(settings), f"{purpose}.{body}".encode(), hashlib.sha256)
    return f"{body}.{_b64(mac.digest())}"


def unsign(settings: Settings, purpose: str, value: str | None) -> dict[str, Any] | None:
    """서명·만료가 맞으면 payload, 아니면 None(사유는 로그에만, 값은 남기지 않음)."""
    if not value or value.count(".") != 1:
        return None
    body, sig = value.split(".")
    mac = hmac.new(signing_key(settings), f"{purpose}.{body}".encode(), hashlib.sha256)
    try:
        if not hmac.compare_digest(_unb64(sig), mac.digest()):
            return None
        payload = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or int(payload.get("exp", 0)) < time.time():
        return None
    return payload


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def safe_next(value: str | None) -> str | None:
    """서비스 안 경로만 허용(open redirect 방지, FE `safeNext`와 같은 규칙)."""
    if not value or not value.startswith("/") or value.startswith("//") or value.startswith("/\\"):
        return None
    return value
