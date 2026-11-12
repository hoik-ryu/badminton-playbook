"""테스트·E2E가 원본 DB에 붙지 못하게 하는 연결 대상 검사(연결하기 전에 URL만 보고 판정).

쓰는 곳:
- `pytest -m db`(tests/conftest.py): `TEST_DATABASE_URL`을 반드시 요구하고,
  통과한 값만 `DATABASE_URL`로 씀
- `APP_ENV=e2e` 서버(app/main.py): 시작할 때 `DATABASE_URL`이 이 규칙을 통과해야 함

허용 규칙(하나라도 어기면 UnsafeDatabaseError):
- 드라이버는 `postgresql+psycopg`
- Neon 등 원격 호스트 차단(`*.neon.tech`, 루프백·compose 내부 이름 외 모든 호스트)
- 보호 DB 이름 차단: `smapsh`(로컬 개발 원본 DB), `neondb`(Neon 기본 DB)
- compose 내부 호스트 `db`(make test-db, 컨테이너 안에서만 해석됨): 위 이름 제한만 적용
- 루프백(localhost·127.0.0.1·::1): 기본 포트 5432 금지(로컬 원본 DB `smapsh`가 쓰는 포트),
  DB 이름은 `*_test`·`*_e2e`·`test_*`·`e2e_*` 형식만
"""

import re

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError

LOOPBACK = frozenset({"localhost", "127.0.0.1", "::1"})
COMPOSE_HOSTS = frozenset({"db"})
PROTECTED_NAMES = frozenset({"smapsh", "neondb"})
DEFAULT_PORT = 5432
TEST_NAME = re.compile(r"^(test|e2e)_[a-z0-9_]+$|^[a-z0-9_]+_(test|e2e)$")


class UnsafeDatabaseError(RuntimeError):
    """테스트·E2E 연결 대상이 안전하지 않음(연결을 시도하지 않음)."""


def check_test_database_url(url: str | None, *, source: str = "TEST_DATABASE_URL") -> URL:
    """안전하면 파싱한 URL을, 아니면 UnsafeDatabaseError. 메시지에 비밀번호를 넣지 않음."""
    if not url:
        raise UnsafeDatabaseError(
            f"{source}가 없습니다. 임시 테스트 DB를 명시하세요 "
            "(예: postgresql+psycopg://app@127.0.0.1:55433/smapsh_test)"
        )
    try:
        parsed = make_url(url)
    except ArgumentError as e:
        raise UnsafeDatabaseError(f"{source} 형식을 해석할 수 없습니다") from e
    where = f"{parsed.host}:{parsed.port or DEFAULT_PORT}/{parsed.database}"
    if parsed.drivername != "postgresql+psycopg":
        raise UnsafeDatabaseError(f"{source}: 드라이버는 postgresql+psycopg여야 합니다")
    host = (parsed.host or "").lower()
    name = (parsed.database or "").lower()
    if host.endswith(".neon.tech") or "neon" in host:
        raise UnsafeDatabaseError(f"{source}: Neon DB에는 테스트로 연결하지 않습니다 ({where})")
    if name in PROTECTED_NAMES:
        raise UnsafeDatabaseError(f"{source}: 보호 대상 DB '{name}'에는 연결하지 않습니다")
    if host in COMPOSE_HOSTS:
        return parsed
    if host not in LOOPBACK:
        raise UnsafeDatabaseError(f"{source}: 로컬 루프백 외 호스트는 허용하지 않습니다 ({where})")
    if (parsed.port or DEFAULT_PORT) == DEFAULT_PORT:
        raise UnsafeDatabaseError(
            f"{source}: 로컬 기본 포트 5432는 개발 DB 서버라 허용하지 않습니다 ({where})"
        )
    if not TEST_NAME.match(name):
        raise UnsafeDatabaseError(
            f"{source}: DB 이름은 *_test·*_e2e·test_*·e2e_* 형식이어야 합니다 ({where})"
        )
    return parsed
