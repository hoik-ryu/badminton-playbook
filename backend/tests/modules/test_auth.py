"""인증(FLOW-001, FR-001–003): 카카오 OAuth·가입·세션·로그아웃·CSRF.

AC 매핑: AC-001 가입 신청 → 승인 대기 / AC-002 중복 가입 방지 / AC-005 로그아웃 /
AC-006·007 승인·거절 후 재로그인 분기(test_approval.py) /
NFR-005 서버 권한(test_approval·test_role).
"""

from collections.abc import Callable
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.auth.deps import SESSION_COOKIE, now_utc
from app.modules.auth.kakao import TOKEN_URL, USER_ME_URL, HttpKakaoClient, KakaoError
from app.modules.auth.models import AuthSession
from app.modules.auth.router import STATE_COOKIE, TICKET_COOKIE
from app.modules.auth.security import hash_token
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import FakeKakao, auth_settings, kakao_login, make_user, signup

FAILED = "/login?error=kakao_failed"


def count(db: Session, model: type) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


# ── 카카오 인가 시작 ──


def test_login_redirects_to_kakao_with_state_cookie(client: TestClient) -> None:
    res = client.get("/api/auth/kakao/login", params={"next": "/ops/approvals"})
    assert res.status_code == 302
    url = urlparse(res.headers["location"])
    q = parse_qs(url.query)
    assert f"{url.scheme}://{url.netloc}{url.path}" == "https://kauth.kakao.com/oauth/authorize"
    assert q["response_type"] == ["code"]
    assert q["client_id"] == ["test-rest-key"]
    assert q["redirect_uri"] == ["http://localhost:5173/api/auth/kakao/callback"]
    assert len(q["state"][0]) >= 24
    cookie = res.headers["set-cookie"]
    assert STATE_COOKIE in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert "Path=/api/auth/kakao" in cookie
    assert "test-client-secret" not in res.headers["location"]  # 시크릿은 브라우저로 가지 않음


# ── 콜백 실패: state 불일치·state 없음·사용자 취소·토큰 교환 실패 ──


def test_callback_state_mismatch_fails(client: TestClient, kakao: FakeKakao) -> None:
    client.get("/api/auth/kakao/login")
    res = client.get("/api/auth/kakao/callback", params={"code": "111", "state": "forged"})
    assert res.headers["location"] == FAILED
    assert kakao.codes == []  # state가 틀리면 토큰 교환을 시도하지 않음
    assert SESSION_COOKIE not in res.cookies


def test_callback_without_state_cookie_fails(
    make_client: Callable[[], TestClient], kakao: FakeKakao
) -> None:
    a, b = make_client(), make_client()
    start = a.get("/api/auth/kakao/login")
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    # 다른 브라우저(쿠키 없음)로 콜백 → CSRF로 보고 실패
    res = b.get("/api/auth/kakao/callback", params={"code": "111", "state": state})
    assert res.headers["location"] == FAILED
    assert kakao.codes == []


def test_callback_user_cancel_fails(client: TestClient) -> None:
    client.get("/api/auth/kakao/login")
    res = client.get("/api/auth/kakao/callback", params={"error": "access_denied"})
    assert res.headers["location"] == FAILED


def test_callback_token_exchange_failure(client: TestClient, db: Session) -> None:
    res = kakao_login(client, "fail")
    assert res.headers["location"] == FAILED
    assert count(db, User) == 0


def test_state_cannot_be_replayed(client: TestClient) -> None:
    start = client.get("/api/auth/kakao/login")
    state = parse_qs(urlparse(start.headers["location"]).query)["state"][0]
    first = client.get("/api/auth/kakao/callback", params={"code": "222", "state": state})
    assert first.headers["location"] == "/signup"
    again = client.get("/api/auth/kakao/callback", params={"code": "222", "state": state})
    assert again.headers["location"] == FAILED  # 콜백이 state 쿠키를 지움


# ── 신규 가입(AC-001)·중복 가입(AC-002) ──


def test_new_kakao_user_gets_signup_ticket_only(client: TestClient, db: Session) -> None:
    assert client.get("/api/auth/signup/ticket").status_code == 401
    res = kakao_login(client, "1001")
    assert res.headers["location"] == "/signup"
    assert TICKET_COOKIE in res.headers["set-cookie"]
    assert client.get("/api/auth/signup/ticket").status_code == 204
    assert count(db, User) == 0  # 가입 정보 입력 전에는 계정을 만들지 않음
    assert client.get("/api/auth/me").status_code == 401


def test_ac_001_signup_creates_pending_user_with_session(client: TestClient, db: Session) -> None:
    res = signup(client, "1002", name="  김신입  ")
    assert res.status_code == 200
    me = res.json()
    assert me["name"] == "김신입" and me["status"] == "pending" and me["role"] == "member"
    assert client.get("/api/auth/me").json() == me
    assert client.get("/api/auth/signup/ticket").status_code == 401  # 티켓은 한 번만
    user = db.scalars(select(User)).one()
    assert (user.gender, user.grade, user.referrer) == ("여", "D조", None)
    identity = db.scalars(select(UserIdentity)).one()
    assert (identity.provider, identity.provider_user_id) == ("kakao", "1002")
    # DB에는 토큰 해시만(쿠키 원문은 저장하지 않음)
    token = client.cookies.get(SESSION_COOKIE)
    assert token and db.scalars(select(AuthSession.token_hash)).one() == hash_token(token)


def test_ac_002_duplicate_signup_reuses_existing_account(
    make_client: Callable[[], TestClient], db: Session
) -> None:
    a, b = make_client(), make_client()
    # 두 브라우저가 같은 카카오 계정으로 동시에 가입 화면까지 옴
    assert kakao_login(a, "1003").headers["location"] == "/signup"
    assert kakao_login(b, "1003").headers["location"] == "/signup"
    first = a.post("/api/auth/signup", json={"name": "첫째", "gender": "남", "grade": "A조"})
    second = b.post("/api/auth/signup", json={"name": "둘째", "gender": "남", "grade": "A조"})
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["name"] == "첫째"
    assert count(db, User) == 1
    # 이미 가입된 계정으로 다시 로그인하면 가입 화면이 아니라 상태 안내로
    assert kakao_login(make_client(), "1003").headers["location"] == "/account-status"


def test_signup_requires_ticket(client: TestClient) -> None:
    res = client.post("/api/auth/signup", json={"name": "무티켓", "gender": "남", "grade": "A조"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "signup_ticket_missing"


def test_signup_rejects_tampered_ticket(client: TestClient, db: Session) -> None:
    kakao_login(client, "1004")
    ticket = client.cookies.get(TICKET_COOKIE)
    assert ticket
    body, sig = ticket.split(".")
    client.cookies.set(TICKET_COOKIE, f"{body}x.{sig}", path="/api/auth")
    res = client.post("/api/auth/signup", json={"name": "변조", "gender": "남", "grade": "A조"})
    assert res.status_code == 401
    assert count(db, User) == 0


@pytest.mark.parametrize(
    "body",
    [
        {"name": "   ", "gender": "남", "grade": "A조"},
        {"name": "가" * 31, "gender": "남", "grade": "A조"},
        {"name": "성별", "gender": "기타", "grade": "A조"},
        {"name": "급수", "gender": "남", "grade": "S조"},
    ],
)
def test_signup_validation(client: TestClient, body: dict[str, str]) -> None:
    kakao_login(client, "1005")
    res = client.post("/api/auth/signup", json=body)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_cancel_signup_clears_ticket(client: TestClient) -> None:
    kakao_login(client, "1006")
    assert client.delete("/api/auth/signup/ticket").status_code == 204
    assert client.get("/api/auth/signup/ticket").status_code == 401


# ── 기존 계정 로그인·세션 유지·로그아웃(AC-005) ──


def test_approved_user_login_goes_to_next_or_home(client: TestClient, db: Session) -> None:
    make_user(db, kakao_id="2001")
    assert kakao_login(client, "2001", "/ops/approvals").headers["location"] == "/ops/approvals"
    assert kakao_login(client, "2001", "//evil.example").headers["location"] == "/tutorial"
    assert kakao_login(client, "2001").headers["location"] == "/tutorial"
    # 같은 브라우저의 이전 세션은 정리(세션 행 1개만)
    assert count(db, AuthSession) == 1


@pytest.mark.parametrize("status", ["pending", "rejected", "inactive"])
def test_restricted_user_login_goes_to_account_status(
    client: TestClient, db: Session, status: str
) -> None:
    make_user(db, kakao_id="2002", status=status)
    assert kakao_login(client, "2002", "/ops").headers["location"] == "/account-status"
    assert client.get("/api/auth/me").json()["status"] == status


def test_session_survives_reload(client: TestClient, db: Session) -> None:
    make_user(db, kakao_id="2003", name="유지")
    kakao_login(client, "2003")
    for _ in range(3):  # 새로고침 = 같은 쿠키로 다시 조회
        assert client.get("/api/auth/me").json()["name"] == "유지"


def test_ac_005_logout(make_client: Callable[[], TestClient], db: Session) -> None:
    make_user(db, kakao_id="2004")
    a, b = make_client(), make_client()
    kakao_login(a, "2004")
    kakao_login(b, "2004")  # 다른 기기
    assert a.post("/api/auth/logout").status_code == 204
    assert a.get("/api/auth/me").status_code == 401
    assert b.get("/api/auth/me").status_code == 200  # 다른 기기 세션은 그대로
    assert count(db, AuthSession) == 1
    assert a.post("/api/auth/logout").status_code == 204  # 이미 로그아웃이어도 성공


def test_expired_session_is_rejected(client: TestClient, db: Session) -> None:
    make_user(db, kakao_id="2005")
    kakao_login(client, "2005")
    session = db.scalars(select(AuthSession)).one()
    session.expires_at = now_utc() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_forged_session_cookie_is_rejected(client: TestClient) -> None:
    client.cookies.set(SESSION_COOKIE, "not-a-real-token")
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthenticated"


# ── CSRF: 상태 변경 요청은 허용된 Origin만 ──


def test_csrf_foreign_origin_rejected(client: TestClient, db: Session) -> None:
    make_user(db, kakao_id="2006")
    kakao_login(client, "2006")
    res = client.post("/api/auth/logout", headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "csrf_origin_mismatch"
    assert client.get("/api/auth/me").status_code == 200  # 로그아웃되지 않음


def test_csrf_missing_origin_rejected_unless_same_origin_referer(
    make_client: Callable[[], TestClient],
) -> None:
    c = make_client()
    del c.headers["Origin"]
    assert c.post("/api/auth/logout").json()["error"]["code"] == "csrf_origin_missing"
    ok = c.post("/api/auth/logout", headers={"Referer": "http://localhost:5173/account-status"})
    assert ok.status_code == 204
    bad = c.post("/api/auth/logout", headers={"Referer": "http://localhost:5173.evil.example/"})
    assert bad.status_code == 403


# ── 카카오 HTTP 클라이언트(서버 측 토큰 교환) ──


def _transport(token_status: int = 200, me_status: int = 200) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == TOKEN_URL:
            form = parse_qs(request.content.decode())
            assert form["grant_type"] == ["authorization_code"]
            assert form["client_secret"] == ["test-client-secret"]
            assert form["code"] == ["auth-code"]
            if token_status != 200:
                return httpx.Response(token_status, json={"error_code": "KOE320"})
            return httpx.Response(
                200, json={"access_token": "kakao-access", "token_type": "bearer"}
            )
        assert str(request.url) == USER_ME_URL
        assert request.headers["authorization"] == "Bearer kakao-access"
        if me_status != 200:
            return httpx.Response(me_status)
        return httpx.Response(200, json={"id": 4242424242, "properties": {"nickname": "x"}})

    return httpx.MockTransport(handler)


def test_http_kakao_client_exchanges_code_server_side() -> None:
    client = HttpKakaoClient(auth_settings(), transport=_transport())
    assert client.fetch_user_id("auth-code") == "4242424242"  # 회원번호만 반환(토큰은 반환 안 함)


@pytest.mark.parametrize(("token_status", "me_status"), [(400, 200), (200, 401)])
def test_http_kakao_client_failures(token_status: int, me_status: int) -> None:
    client = HttpKakaoClient(auth_settings(), transport=_transport(token_status, me_status))
    with pytest.raises(KakaoError):
        client.fetch_user_id("auth-code")


# ── 설정 안전장치 ──


@pytest.mark.parametrize("secret", ["", "change-me-to-a-long-random-string", "short"])
def test_weak_session_secret_refused_outside_local(secret: str) -> None:
    from pydantic import SecretStr

    from app.modules.auth.security import signing_key

    settings = auth_settings().model_copy(
        update={"app_env": "production", "session_secret": SecretStr(secret)}
    )
    with pytest.raises(RuntimeError):
        signing_key(settings)
