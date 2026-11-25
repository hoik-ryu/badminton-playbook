#!/bin/sh
# 격리된 임시 PostgreSQL에서 DB 연동 테스트(pytest -m db)를 실행합니다(Docker 불필요).
# - 대상: TEST_DATABASE_URL(기본 postgresql+psycopg://app@127.0.0.1:55433/smapsh_test)
# - 개발 DB(로컬 5432·compose db)·원본 smapsh·Neon은 app/core/dbguard.py가 연결 전에 거부합니다.
# - 매 실행마다 테스트 DB를 새로 만들고(drop → create) 최신 마이그레이션을 적용한 뒤 테스트합니다.
# - 임시 PostgreSQL 서버는 미리 띄워 둡니다(예: pg_ctl -D <저장소 밖 폴더> -o "-p 55433" start).
# - 리포트: $PB_REPORT_DIR/db.xml(product-build 검증 단계), 없으면 backend/.pytest-db.xml 대신 출력만.
set -eu

URL="${TEST_DATABASE_URL:-postgresql+psycopg://app@127.0.0.1:55433/smapsh_test}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

# 1) 안전 검사(연결 전): 실패하면 아무 DB에도 접속하지 않음
uv run python -c "from app.core.dbguard import check_test_database_url as c; import sys; c(sys.argv[1])" "$URL"

# 2) 같은 서버의 postgres DB에 접속해 테스트 DB만 새로 만듦(이름은 위 검사로 *_test·*_e2e 형식 보장)
uv run python - "$URL" <<'PY'
import sys

import psycopg
from sqlalchemy.engine import make_url

u = make_url(sys.argv[1])
name = u.database
with psycopg.connect(
    host=u.host, port=u.port, user=u.username, password=u.password, dbname="postgres", autocommit=True
) as conn:
    conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
    conn.execute(f'CREATE DATABASE "{name}"')
PY

# 3) 최신 마이그레이션 적용 후 DB 테스트
DATABASE_URL="$URL" uv run alembic upgrade head
if [ -n "${PB_REPORT_DIR:-}" ]; then
  TEST_DATABASE_URL="$URL" uv run pytest -m db --junitxml="$PB_REPORT_DIR/db.xml"
else
  TEST_DATABASE_URL="$URL" uv run pytest -m db
fi
