"""anonymize guest gender and score

게스트 삭제 비식별화 C안(사용자 결정 2026-11-12): 이름·급수(0006)에 더해 성별·점수도 지움.
- guests.gender NULL 허용, ck_guests_gender = gender IS NULL OR IN ('남','여')
- ck_guests_deleted_anonymized: 삭제 전 이름·급수·성별 필수 / 삭제 후 이름·급수·성별·점수 모두 NULL
- 이미 삭제된 게스트에도 소급(성별·점수 지움). 행·id·청백전 참가·경기 결과는 그대로

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-12 13:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0008'
down_revision: str | None = '0007'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_ANON = (
    "(deleted_at IS NULL AND name IS NOT NULL AND grade IS NOT NULL)"
    " OR (deleted_at IS NOT NULL AND name IS NULL AND grade IS NULL)"
)
NEW_ANON = (
    "(deleted_at IS NULL AND name IS NOT NULL AND grade IS NOT NULL AND gender IS NOT NULL)"
    " OR (deleted_at IS NOT NULL AND name IS NULL AND grade IS NULL"
    " AND gender IS NULL AND score IS NULL)"
)
GENDER_IN = "gender IN ('남', '여')"
# downgrade 때 되돌릴 수 없는 성별 자리표시자(원래 값은 복구 불가)
PLACEHOLDER_GENDER = '남'


def upgrade() -> None:
    op.drop_constraint('ck_guests_deleted_anonymized', 'guests', type_='check')
    op.alter_column('guests', 'gender', existing_type=sa.String(length=1), nullable=True)
    op.drop_constraint('ck_guests_gender', 'guests', type_='check')
    op.create_check_constraint('ck_guests_gender', 'guests', f'gender IS NULL OR {GENDER_IN}')
    # 소급 비식별화
    op.execute(sa.text('UPDATE guests SET gender = NULL, score = NULL WHERE deleted_at IS NOT NULL'))
    op.create_check_constraint('ck_guests_deleted_anonymized', 'guests', NEW_ANON)


def downgrade() -> None:
    # 주의: 지운 성별·점수는 복구할 수 없습니다. 성별은 자리표시자, 점수는 NULL 그대로.
    op.drop_constraint('ck_guests_deleted_anonymized', 'guests', type_='check')
    op.execute(
        sa.text('UPDATE guests SET gender = :g WHERE gender IS NULL').bindparams(
            g=PLACEHOLDER_GENDER
        )
    )
    op.drop_constraint('ck_guests_gender', 'guests', type_='check')
    op.create_check_constraint('ck_guests_gender', 'guests', GENDER_IN)
    op.alter_column('guests', 'gender', existing_type=sa.String(length=1), nullable=False)
    op.create_check_constraint('ck_guests_deleted_anonymized', 'guests', OLD_ANON)
