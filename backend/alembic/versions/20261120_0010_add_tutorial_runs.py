"""add tutorial runs

튜토리얼 서버 판정용 짧은 수명의 회차 표(D-T4 (b), 사용자 결정 2026-11-20).
상황별 첫 판정(c/a/w/-)만 회차 유효기간 동안 임시 보관하고, 고른 칸 번호는 저장하지 않습니다(NFR-006 해석).
tutorial_progress는 바꾸지 않습니다.

주의: 작성만 했고 적용하지 않았습니다. 적용(`make migrate`)은 사용자 승인 뒤에 합니다.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-20 10:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0010'
down_revision: str | None = '0009'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('tutorial_runs',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('stage_id', sa.String(length=32), nullable=False),
    sa.Column('content_hash', sa.String(length=16), nullable=False),
    sa.Column('first_verdicts', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('length(first_verdicts) BETWEEN 1 AND 16', name='ck_tutorial_runs_verdicts_len'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tutorial_runs_user_stage', 'tutorial_runs', ['user_id', 'stage_id'], unique=False)
    op.create_index(op.f('ix_tutorial_runs_expires_at'), 'tutorial_runs', ['expires_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_tutorial_runs_expires_at'), table_name='tutorial_runs')
    op.drop_index('ix_tutorial_runs_user_stage', table_name='tutorial_runs')
    op.drop_table('tutorial_runs')
