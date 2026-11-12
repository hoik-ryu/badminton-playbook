"""세션·권한 의존성. 화면 가드와 별개로 서버가 최종 권한을 판단합니다(NFR-005)."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.modules.auth.models import AuthSession
from app.modules.auth.security import hash_token, new_session_token
from app.modules.user.models import User

SESSION_COOKIE = "smapsh_session"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def now_utc() -> datetime:
    return datetime.now(UTC)


def start_session(db: Session, settings: Settings, response: Response, user_id: uuid.UUID) -> None:
    """새 세션 행 + httpOnly 쿠키(SameSite=Lax). 토큰 원문은 쿠키에만."""
    token = new_session_token()
    ttl = timedelta(days=settings.session_ttl_days)
    db.add(AuthSession(token_hash=hash_token(token), user_id=user_id, expires_at=now_utc() + ttl))
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(ttl.total_seconds()),
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def end_session(db: Session, settings: Settings, request: Request, response: Response) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


def optional_user(request: Request, db: DbSession) -> User | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    return db.scalars(
        select(User)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token_hash == hash_token(token), AuthSession.expires_at > now_utc())
    ).first()


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise AppError("unauthenticated", "로그인이 필요합니다", 401)
    return user


def approved_user(user: Annotated[User, Depends(current_user)]) -> User:
    """승인 대기·거절·비활성은 서비스 기능을 쓸 수 없음."""
    if user.status != "approved":
        raise AppError("account_restricted", "이용할 수 없는 계정 상태입니다", 403)
    return user


def admin_user(user: Annotated[User, Depends(approved_user)]) -> User:
    if user.role not in ("admin", "super_admin"):
        raise AppError("forbidden", "권한이 없습니다", 403)
    return user


def super_admin_user(user: Annotated[User, Depends(approved_user)]) -> User:
    if user.role != "super_admin":
        raise AppError("forbidden", "권한이 없습니다", 403)
    return user


def verify_origin(request: Request, settings: AppSettings) -> None:
    """CSRF 방어(SameSite=Lax 쿠키와 함께): 상태를 바꾸는 요청은 허용된 Origin에서만."""
    if request.method not in UNSAFE_METHODS:
        return
    allowed = settings.cors_origin_list
    origin = request.headers.get("origin")
    if origin is None:
        referer = request.headers.get("referer", "")
        if any(referer == o or referer.startswith(o + "/") for o in allowed):
            return
        raise AppError("csrf_origin_missing", "요청 출처를 확인할 수 없습니다", 403)
    if origin not in allowed:
        raise AppError("csrf_origin_mismatch", "허용되지 않은 요청 출처입니다", 403)


CurrentUser = Annotated[User, Depends(current_user)]
ApprovedUser = Annotated[User, Depends(approved_user)]
AdminUser = Annotated[User, Depends(admin_user)]
SuperAdminUser = Annotated[User, Depends(super_admin_user)]
