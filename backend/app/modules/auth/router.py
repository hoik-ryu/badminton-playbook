"""인증(FLOW-001, FR-001–003): 카카오 Authorization Code → 앱 세션.

- /kakao/login: state 생성 → 서명 쿠키(10분) → 카카오 인가 페이지로 302
- /kakao/callback: state 대조(CSRF) → 서버에서 토큰 교환·회원번호 조회(토큰 저장 안 함)
  → 가입된 계정이면 세션 쿠키 + 상태별 화면
  → 아니면 서명된 가입 티켓 쿠키(30분, DB 저장 없음) + /signup
- 실패·취소·state 불일치 → /login?error=kakao_failed (FE가 실패 횟수를 셈, UXD-019)
"""

import hmac
import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.deps import (
    AppSettings,
    CurrentUser,
    DbSession,
    end_session,
    now_utc,
    start_session,
    verify_origin,
)
from app.modules.auth.kakao import KakaoClient, KakaoError, authorize_url, get_kakao_client
from app.modules.auth.security import safe_next, sign, unsign
from app.modules.user.models import User, UserIdentity
from app.modules.user.schemas import MeRead, SignupCreate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

STATE_COOKIE = "smapsh_oauth_state"
STATE_COOKIE_PATH = "/api/auth/kakao"
STATE_TTL = 600
TICKET_COOKIE = "smapsh_signup_ticket"
TICKET_COOKIE_PATH = "/api/auth"
TICKET_TTL = 1800
HOME = "/tutorial"
LOGIN_FAILED = "/login?error=kakao_failed"


def _cookie(
    response: Response, settings: AppSettings, name: str, value: str, path: str, ttl: int
) -> None:
    response.set_cookie(
        name,
        value,
        max_age=ttl,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path=path,
    )


def _clear(response: Response, settings: AppSettings, name: str, path: str) -> None:
    response.delete_cookie(
        name, path=path, httponly=True, secure=settings.session_cookie_secure, samesite="lax"
    )


def _identity(db: Session, provider: str, provider_user_id: str) -> UserIdentity | None:
    return db.scalars(
        select(UserIdentity).where(
            UserIdentity.provider == provider, UserIdentity.provider_user_id == provider_user_id
        )
    ).first()


@router.get("/kakao/login")
def kakao_login(settings: AppSettings, next: str | None = None) -> RedirectResponse:  # noqa: A002
    if not settings.kakao_configured:
        logger.error("kakao login is not configured (KAKAO_REST_API_KEY / KAKAO_REDIRECT_URI)")
        return RedirectResponse(LOGIN_FAILED, status.HTTP_302_FOUND)
    state = secrets.token_urlsafe(24)
    response = RedirectResponse(authorize_url(settings, state), status.HTTP_302_FOUND)
    value = sign(settings, "oauth_state", {"state": state, "next": safe_next(next)}, STATE_TTL)
    _cookie(response, settings, STATE_COOKIE, value, STATE_COOKIE_PATH, STATE_TTL)
    return response


@router.get("/kakao/callback")
def kakao_callback(
    request: Request,
    db: DbSession,
    settings: AppSettings,
    kakao: Annotated[KakaoClient, Depends(get_kakao_client)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    saved = unsign(settings, "oauth_state", request.cookies.get(STATE_COOKIE))

    def fail(reason: str) -> RedirectResponse:
        logger.info("kakao login failed: %s", reason)
        response = RedirectResponse(LOGIN_FAILED, status.HTTP_302_FOUND)
        _clear(response, settings, STATE_COOKIE, STATE_COOKIE_PATH)
        return response

    if error:
        return fail(f"kakao_error:{error[:40]}")  # 예: access_denied(사용자 취소)
    expected = saved.get("state") if saved else None
    if not isinstance(expected, str) or not state or not hmac.compare_digest(expected, state):
        return fail("state_mismatch")
    if not code:
        return fail("code_missing")
    try:
        kakao_id = kakao.fetch_user_id(code)
    except KakaoError as e:
        return fail(str(e))

    next_path = safe_next(saved.get("next") if saved else None)
    identity = _identity(db, "kakao", kakao_id)
    if identity is None:
        # 미가입: 계정은 만들지 않고 서명된 가입 티켓만(가입 정보 입력 후 POST /signup)
        response = RedirectResponse("/signup", status.HTTP_302_FOUND)
        ticket = sign(settings, "signup_ticket", {"provider": "kakao", "uid": kakao_id}, TICKET_TTL)
        _cookie(response, settings, TICKET_COOKIE, ticket, TICKET_COOKIE_PATH, TICKET_TTL)
    else:
        user = identity.user
        identity.last_login_at = now_utc()
        target = "/account-status" if user.status != "approved" else (next_path or HOME)
        response = RedirectResponse(target, status.HTTP_302_FOUND)
        end_session(db, settings, request, response)  # 같은 브라우저의 이전 세션은 정리
        start_session(db, settings, response, user.id)
        db.commit()
    _clear(response, settings, STATE_COOKIE, STATE_COOKIE_PATH)
    return response


def _ticket(request: Request, settings: AppSettings) -> dict[str, object]:
    ticket = unsign(settings, "signup_ticket", request.cookies.get(TICKET_COOKIE))
    if not ticket or ticket.get("provider") != "kakao" or not isinstance(ticket.get("uid"), str):
        raise AppError("signup_ticket_missing", "카카오 인증이 만료되었습니다", 401)
    return ticket


@router.get("/signup/ticket", status_code=status.HTTP_204_NO_CONTENT)
def signup_ticket(request: Request, settings: AppSettings) -> None:
    """가입 정보 입력 화면에 들어올 수 있는지(카카오 인증 완료·미가입).

    카카오 회원번호는 돌려주지 않음.
    """
    _ticket(request, settings)


@router.delete(
    "/signup/ticket",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_origin)],
)
def cancel_signup(response: Response, settings: AppSettings) -> None:
    _clear(response, settings, TICKET_COOKIE, TICKET_COOKIE_PATH)


@router.post("/signup", dependencies=[Depends(verify_origin)])
def signup(
    body: SignupCreate,
    request: Request,
    response: Response,
    db: DbSession,
    settings: AppSettings,
) -> MeRead:
    """가입 신청(AC-001) → 승인 대기 + 세션.

    이미 가입된 카카오 계정이면 새로 만들지 않고 기존 계정으로 로그인(AC-002).
    """
    uid = str(_ticket(request, settings)["uid"])
    identity = _identity(db, "kakao", uid)
    if identity is None:
        user = User(
            name=body.name,
            gender=body.gender,
            grade=body.grade,
            referrer=body.referrer,
            role="member",
            status="pending",
        )
        user.identities.append(UserIdentity(provider="kakao", provider_user_id=uid))
        db.add(user)
        try:
            db.flush()
        except IntegrityError:
            # 같은 카카오 계정의 동시 가입(두 번 누름 등) → 먼저 만들어진 계정을 씀
            db.rollback()
            identity = _identity(db, "kakao", uid)
            if identity is None:
                raise
            user = identity.user
    else:
        user = identity.user
    end_session(db, settings, request, response)
    start_session(db, settings, response, user.id)
    _clear(response, settings, TICKET_COOKIE, TICKET_COOKIE_PATH)
    db.commit()
    return MeRead.of(user)


@router.get("/me")
def me(user: CurrentUser) -> MeRead:
    """내 계정(상태 무관). 비로그인 401 unauthenticated."""
    return MeRead.of(user)


@router.post(
    "/logout", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_origin)]
)
def logout(request: Request, response: Response, db: DbSession, settings: AppSettings) -> None:
    """로그아웃(AC-005): 세션 행 삭제 + 쿠키 제거. 세션이 없어도 성공."""
    end_session(db, settings, request, response)
    db.commit()


# ── 개발용 운영진 ID/PW 로그인(로컬 전용) ──
# DEV_LOGIN_ENABLED=true + APP_ENV=local 일 때만 동작(그 밖에서는 404).
# 켜 둔 채 local 밖에서 시작하면 서버가 시작을 거부함(security.signing_key).
# 비밀번호는 환경변수에서만 읽고 DB에 저장하지 않음. 사용자 행은 provider='dev' 외부 계정으로 연결.
DEV_PROVIDER = "dev"


class DevLoginStatus(BaseModel):
    enabled: bool


class DevLoginBody(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


@router.get("/dev-login")
def dev_login_status(settings: AppSettings) -> DevLoginStatus:
    """로그인 화면이 '운영진 로그인하기'를 보여 줄지(값·계정 정보는 돌려주지 않음)."""
    return DevLoginStatus(enabled=settings.dev_login_active)


@router.post("/dev-login", dependencies=[Depends(verify_origin)])
def dev_login(
    body: DevLoginBody,
    request: Request,
    response: Response,
    db: DbSession,
    settings: AppSettings,
) -> MeRead:
    if not settings.dev_login_active:
        raise AppError("dev_login_disabled", "사용할 수 없는 로그인 방식입니다", 404)
    # 아이디·비밀번호 모두 상수 시간 비교(어느 쪽이 틀렸는지 알려 주지 않음)
    user_ok = hmac.compare_digest(body.username.encode(), settings.dev_admin_username.encode())
    expected = settings.dev_admin_password.get_secret_value().encode()
    pass_ok = hmac.compare_digest(body.password.encode(), expected)
    if not (user_ok and pass_ok):
        logger.warning("dev login failed")
        raise AppError("invalid_credentials", "아이디 또는 비밀번호가 올바르지 않습니다", 401)
    identity = _identity(db, DEV_PROVIDER, settings.dev_admin_username)
    if identity is None:
        user = User(name="개발용 관리자", gender="남", grade="자강조")
        user.identities.append(
            UserIdentity(provider=DEV_PROVIDER, provider_user_id=settings.dev_admin_username)
        )
        db.add(user)
    else:
        user = identity.user
        identity.last_login_at = now_utc()
    # 개발용 계정은 항상 승인된 슈퍼 관리자
    user.role = "super_admin"
    user.status = "approved"
    db.flush()
    end_session(db, settings, request, response)
    start_session(db, settings, response, user.id)
    db.commit()
    return MeRead.of(user)
