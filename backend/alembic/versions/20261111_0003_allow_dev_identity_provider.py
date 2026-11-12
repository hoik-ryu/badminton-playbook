"""allow dev identity provider

로컬 개발용 운영진 ID/PW 로그인 계정을 user_identities(provider='dev')로 연결하기 위해
provider CHECK 제약을 넓힙니다. 비밀번호는 DB에 저장하지 않습니다(환경변수에서만 읽음).

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-11

"""
from collections.abc import Sequence

from alembic import op

revision: str = '0003'
down_revision: str | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint('ck_user_identities_provider', 'user_identities', type_='check')
    op.create_check_constraint(
        'ck_user_identities_provider', 'user_identities', "provider IN ('kakao', 'dev')"
    )


def downgrade() -> None:
    # 개발용 계정 연결을 지운 뒤 원래 제약으로 되돌림(사용자 행은 남음)
    op.execute("DELETE FROM user_identities WHERE provider = 'dev'")
    op.drop_constraint('ck_user_identities_provider', 'user_identities', type_='check')
    op.create_check_constraint(
        'ck_user_identities_provider', 'user_identities', "provider IN ('kakao')"
    )
