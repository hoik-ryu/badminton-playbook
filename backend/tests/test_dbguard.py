"""DB 테스트·E2E 보호(app/core/dbguard.py, tests/conftest.py, APP_ENV=e2e 서버).

- 규칙: 안전한 대상만 통과. 원본 smapsh·Neon·원격·기본 포트·비테스트 이름은 거부
  (메시지에 비밀번호 없음)
- `pytest -m db`: TEST_DATABASE_URL이 없거나 안전하지 않으면 어떤 테스트도 실행 전에 중단
  (연결 시도 없음)
- APP_ENV=e2e 서버: 안전하지 않은 DATABASE_URL이면 시작하지 않음, 개발용 로그인은 local·e2e만
"""

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.core.dbguard import UnsafeDatabaseError, check_test_database_url
from app.modules.auth.security import signing_key

BACKEND = Path(__file__).parents[1]
SECRET = "x" * 40


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://app@127.0.0.1:55433/smapsh_test",
        "postgresql+psycopg://app:pw@localhost:55433/smapsh_e2e",
        "postgresql+psycopg://app@[::1]:55433/test_clubmatch",
        "postgresql+psycopg://app:app@localhost:55432/app_test",  # CI
        "postgresql+psycopg://app:app@db:5432/app",  # make test-db(compose 내부)
    ],
)
def test_safe_targets_pass(url: str) -> None:
    assert check_test_database_url(url).database


@pytest.mark.parametrize(
    ("url", "reason"),
    [
        (None, "없습니다"),
        ("", "없습니다"),
        ("not a url", "해석할 수 없습니다"),
        ("postgresql://app@127.0.0.1:55433/x_test", "드라이버"),
        ("postgresql+psycopg://smapsh:pw@localhost:5432/smapsh", "보호 대상"),  # 원본 개발 DB
        ("postgresql+psycopg://smapsh:pw@localhost:55433/smapsh", "보호 대상"),
        ("postgresql+psycopg://u:pw@ep-a-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb", "Neon"),
        ("postgresql+psycopg://u:pw@ep-a.c-4.ap-southeast-1.aws.neon.tech/x_test", "Neon"),
        ("postgresql+psycopg://u:pw@10.0.0.5:55433/x_test", "루프백"),
        ("postgresql+psycopg://u:pw@prod.example.com:5432/x_test", "루프백"),
        ("postgresql+psycopg://app@localhost/x_test", "5432"),
        ("postgresql+psycopg://app@127.0.0.1:5432/x_test", "5432"),
        ("postgresql+psycopg://app@127.0.0.1:55433/app", "이름"),
        ("postgresql+psycopg://app@127.0.0.1:55433/testing", "이름"),
        ("postgresql+psycopg://app:app@db:5432/smapsh", "보호 대상"),
    ],
)
def test_unsafe_targets_rejected_without_leaking_password(url: str | None, reason: str) -> None:
    with pytest.raises(UnsafeDatabaseError) as e:
        check_test_database_url(url)
    assert reason in str(e.value)
    assert "pw" not in str(e.value).replace("pwd", "")


def run_db_tests(test_url: str | None) -> tuple[int, str, float]:
    """실제 `pytest -m db`를 하위 프로세스로(backend/.env의 원본 DATABASE_URL이 있는 그대로)."""
    env = {k: v for k, v in os.environ.items() if k not in {"TEST_DATABASE_URL", "DATABASE_URL"}}
    if test_url is not None:
        env["TEST_DATABASE_URL"] = test_url
    started = time.monotonic()
    res = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-m",
            "db",
            "-q",
            "-p",
            "no:cacheprovider",
            "tests/test_health.py",
        ],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return res.returncode, res.stdout + res.stderr, time.monotonic() - started


@pytest.mark.parametrize(
    "test_url",
    [
        None,  # 없음 → backend/.env의 원본 DB로 가지 않고 중단
        "postgresql+psycopg://smapsh:pw@localhost:5432/smapsh",
        "postgresql+psycopg://u:pw@ep-a.c-4.ap-southeast-1.aws.neon.tech/neondb",
        # 라우팅되지 않는 주소: 연결을 시도했다면 오래 멈춤 → 빨리 끝나면 연결 전에 막힌 것
        "postgresql+psycopg://u:pw@10.255.255.1:55433/x_test",
    ],
)
def test_pytest_db_stops_before_connecting(test_url: str | None) -> None:
    code, out, elapsed = run_db_tests(test_url)
    assert code == 4, out
    assert "DB 테스트 중단(연결하지 않음)" in out
    assert "passed" not in out and "failed" not in out
    assert elapsed < 30, elapsed


def test_plain_pytest_does_not_require_test_database() -> None:
    """DB 테스트가 선택되지 않은 일반 실행은 TEST_DATABASE_URL 없이 그대로 동작."""
    env = {k: v for k, v in os.environ.items() if k != "TEST_DATABASE_URL"}
    res = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "tests/test_health.py"],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert res.returncode == 0, res.stdout + res.stderr


# ── APP_ENV=e2e 서버 ──


def settings(**kw: object) -> Settings:
    base: dict[str, object] = {
        "_env_file": None,
        "session_secret": SecretStr(SECRET),
        "database_url": "postgresql+psycopg://app@127.0.0.1:55433/smapsh_e2e",
    }
    return Settings(**{**base, **kw})  # type: ignore[arg-type]


def test_e2e_server_refuses_unsafe_database(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import main

    for url in (
        "postgresql+psycopg://smapsh:pw@localhost:5432/smapsh",
        "postgresql+psycopg://u:pw@ep-a.neon.tech/neondb",
        "postgresql+psycopg://app@127.0.0.1:55433/app",
    ):
        monkeypatch.setattr(
            main, "get_settings", lambda u=url: settings(app_env="e2e", database_url=u)
        )
        with pytest.raises(UnsafeDatabaseError):
            main.create_app()
    monkeypatch.setattr(main, "get_settings", lambda: settings(app_env="e2e"))
    assert main.create_app()  # 임시 테스트 DB면 시작


def test_dev_login_allowed_only_in_local_and_e2e() -> None:
    on = {
        "dev_login_enabled": True,
        "dev_admin_username": "a",
        "dev_admin_password": SecretStr("b"),
    }
    for env in ("local", "e2e"):
        s = settings(app_env=env, **on)
        signing_key(s)
        assert s.dev_login_active
    for env in ("production", "poc", "preview"):
        s = settings(app_env=env, **on)
        assert not s.dev_login_active
        with pytest.raises(RuntimeError, match="local or e2e"):
            signing_key(s)
