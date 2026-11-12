"""anonymize deleted guests

게스트 삭제 = 소프트 삭제 + 비식별화(AC-013 급수 삭제 + 이름까지 확장, 사용자 결정 U5).
- guests.name·grade를 NULL 허용으로 바꾸고, 삭제 여부와 비식별화 상태가 맞도록 CHECK 추가
- 이미 삭제된 게스트에도 소급 적용(이름·급수 지움). 행·id·참조·성별·점수는 그대로

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-12 15:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0006'
down_revision: str | None = '0005'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

GRADE_IN = "grade IN ('자강조', 'A조', 'B조', 'C조', 'D조', '초심', '왕초심', '입문자')"
ANONYMIZED = (
    "(deleted_at IS NULL AND name IS NOT NULL AND grade IS NOT NULL)"
    " OR (deleted_at IS NOT NULL AND name IS NULL AND grade IS NULL)"
)
# downgrade 시 되돌릴 수 없는 값(원래 이름·급수)을 대신 채우는 자리표시자
PLACEHOLDER_NAME = '삭제된 게스트'
PLACEHOLDER_GRADE = '입문자'


def upgrade() -> None:
    op.alter_column('guests', 'name', existing_type=sa.String(length=30), nullable=True)
    op.alter_column('guests', 'grade', existing_type=sa.String(length=10), nullable=True)
    op.drop_constraint('ck_guests_grade', 'guests', type_='check')
    op.create_check_constraint('ck_guests_grade', 'guests', f'grade IS NULL OR {GRADE_IN}')
    # 소급 비식별화
    op.execute(sa.text('UPDATE guests SET name = NULL, grade = NULL WHERE deleted_at IS NOT NULL'))
    op.create_check_constraint('ck_guests_deleted_anonymized', 'guests', ANONYMIZED)


def downgrade() -> None:
    # 주의: 지운 이름·급수는 복구할 수 없어 자리표시자로 채웁니다(데이터 손실 그대로).
    op.drop_constraint('ck_guests_deleted_anonymized', 'guests', type_='check')
    op.execute(
        sa.text(
            'UPDATE guests SET name = COALESCE(name, :n), grade = COALESCE(grade, :g)'
            ' WHERE deleted_at IS NOT NULL'
        ).bindparams(n=PLACEHOLDER_NAME, g=PLACEHOLDER_GRADE)
    )
    op.drop_constraint('ck_guests_grade', 'guests', type_='check')
    op.create_check_constraint('ck_guests_grade', 'guests', GRADE_IN)
    op.alter_column('guests', 'grade', existing_type=sa.String(length=10), nullable=False)
    op.alter_column('guests', 'name', existing_type=sa.String(length=30), nullable=False)
