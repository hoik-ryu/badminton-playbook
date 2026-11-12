"""카카오 OAuth(REST API, Authorization Code). 토큰은 사용자 ID 조회에만 쓰고 저장하지 않습니다."""

import logging
from typing import Annotated, Protocol
from urllib.parse import urlencode

import httpx
from fastapi import Depends

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize"
TOKEN_URL = "https://kauth.kakao.com/oauth/token"
USER_ME_URL = "https://kapi.kakao.com/v2/user/me"


class KakaoError(Exception):
    """카카오 인증 실패(사유 코드만 담고 응답 본문·토큰은 담지 않음)."""


def authorize_url(settings: Settings, state: str) -> str:
    query = urlencode(
        {
            "response_type": "code",
            "client_id": settings.kakao_rest_api_key.get_secret_value(),
            "redirect_uri": settings.kakao_redirect_uri,
            "state": state,
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


class KakaoClient(Protocol):
    def fetch_user_id(self, code: str) -> str:
        """인가 코드 → (서버에서) 토큰 교환 → 카카오 회원번호."""
        ...


class HttpKakaoClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self._settings = settings
        self._transport = transport

    def fetch_user_id(self, code: str) -> str:
        s = self._settings
        data = {
            "grant_type": "authorization_code",
            "client_id": s.kakao_rest_api_key.get_secret_value(),
            "redirect_uri": s.kakao_redirect_uri,
            "code": code,
        }
        secret = s.kakao_client_secret.get_secret_value()
        if secret:
            data["client_secret"] = secret
        with httpx.Client(timeout=10.0, transport=self._transport) as client:
            try:
                token_res = client.post(TOKEN_URL, data=data)
            except httpx.HTTPError as e:
                raise KakaoError("token_request_failed") from e
            if token_res.status_code != 200:
                # 카카오 오류 코드(KOE...)만 남김. 본문 전체·코드 값은 로그에 쓰지 않음
                logger.warning(
                    "kakao token exchange failed: status=%s error_code=%s",
                    token_res.status_code,
                    _safe_json(token_res).get("error_code"),
                )
                raise KakaoError("token_exchange_failed")
            access_token = _safe_json(token_res).get("access_token")
            if not isinstance(access_token, str) or not access_token:
                raise KakaoError("token_missing")
            try:
                me_res = client.get(
                    USER_ME_URL, headers={"Authorization": f"Bearer {access_token}"}
                )
            except httpx.HTTPError as e:
                raise KakaoError("user_request_failed") from e
            # access_token은 이 함수 밖으로 나가지 않음(저장·반환하지 않음)
            if me_res.status_code != 200:
                logger.warning("kakao user lookup failed: status=%s", me_res.status_code)
                raise KakaoError("user_lookup_failed")
            kakao_id = _safe_json(me_res).get("id")
            if not isinstance(kakao_id, int):
                raise KakaoError("user_id_missing")
            return str(kakao_id)


def _safe_json(res: httpx.Response) -> dict[str, object]:
    try:
        data = res.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def get_kakao_client(settings: Annotated[Settings, Depends(get_settings)]) -> KakaoClient:
    return HttpKakaoClient(settings)
