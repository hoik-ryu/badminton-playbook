"""add club match rounds, courts, cancellation and events

(B15, 기획 r13 C-36–C-38) 청백전 라운드·코트 운영.

- club_matches: court_count(1–8)·planned_rounds(자동 생성 기준)·current_round(진행 라운드)
- club_match_games: round_no·court_no(서버가 매김)·취소 정보(현재 상태)
- club_match_game_events: 취소 이력(추가만). (B18, 기획 r14) 복원은 폐기되어 동작은 'cancel'만 허용
  (로컬 개발 DB·Neon 미적용 상태에서 사용자 결정 2026-11-26으로 이 리비전을 수정)
- 기존 행은 바꾸지 않습니다. 새 열이 비어 있으면 '라운드 정보 없는 기존 청백전'으로 기존 방식 그대로(D11).
- downgrade: 라운드 기반 청백전이 하나라도 있으면 데이터 손실을 막기 위해 멈춥니다(C-38).
  없으면 새 열·제약·테이블을 지웁니다.

주의: 작성·검증은 임시 PostgreSQL에서만 합니다. 로컬 개발 DB·운영 DB(Neon) 적용은 별도 승인 뒤에 합니다.

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-26 09:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0011'
down_revision: str | None = '0010'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('club_matches', sa.Column('court_count', sa.SmallInteger(), nullable=True))
    op.add_column('club_matches', sa.Column('planned_rounds', sa.SmallInteger(), nullable=True))
    op.add_column('club_matches', sa.Column('current_round', sa.SmallInteger(), nullable=True))
    op.create_check_constraint(
        'ck_club_matches_court_count', 'club_matches',
        'court_count IS NULL OR court_count BETWEEN 1 AND 8',
    )
    op.create_check_constraint(
        'ck_club_matches_planned_rounds', 'club_matches',
        'planned_rounds IS NULL OR planned_rounds BETWEEN 1 AND 200',
    )
    op.create_check_constraint(
        'ck_club_matches_current_round', 'club_matches',
        'current_round IS NULL OR current_round >= 1',
    )

    op.add_column('club_match_games', sa.Column('round_no', sa.SmallInteger(), nullable=True))
    op.add_column('club_match_games', sa.Column('court_no', sa.SmallInteger(), nullable=True))
    op.add_column('club_match_games', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('club_match_games', sa.Column('cancelled_by_id', sa.Uuid(), nullable=True))
    op.add_column('club_match_games', sa.Column('cancel_reason', sa.String(length=20), nullable=True))
    op.create_foreign_key(
        'club_match_games_cancelled_by_id_fkey', 'club_match_games', 'users',
        ['cancelled_by_id'], ['id'], ondelete='SET NULL',
    )
    op.create_unique_constraint(
        'uq_club_match_games_court', 'club_match_games', ['match_id', 'round_no', 'court_no']
    )
    op.create_check_constraint(
        'ck_club_match_games_round_court', 'club_match_games',
        '(round_no IS NULL AND court_no IS NULL) OR (round_no >= 1 AND court_no BETWEEN 1 AND 8)',
    )
    op.create_check_constraint(
        'ck_club_match_games_cancelled', 'club_match_games',
        'winner IS NULL OR cancelled_at IS NULL',
    )

    op.create_table('club_match_game_events',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('match_id', sa.Uuid(), nullable=False),
    sa.Column('game_id', sa.Uuid(), nullable=False),
    sa.Column('action', sa.String(length=10), nullable=False),
    sa.Column('actor_id', sa.Uuid(), nullable=True),
    sa.Column('at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('reason', sa.String(length=20), nullable=True),
    sa.Column('detail', sa.JSON(), server_default='{}', nullable=False),
    sa.CheckConstraint("action IN ('cancel')", name='ck_club_match_game_events_action'),
    sa.ForeignKeyConstraint(['match_id'], ['club_matches.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['game_id'], ['club_match_games.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_club_match_game_events_match_id', 'club_match_game_events', ['match_id'], unique=False)
    op.create_index('ix_club_match_game_events_game_id', 'club_match_game_events', ['game_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    rounds = bind.execute(
        sa.text('SELECT count(*) FROM club_matches WHERE court_count IS NOT NULL')
    ).scalar()
    if rounds:
        raise RuntimeError(
            f'라운드 기반 청백전 {rounds}개가 있어 되돌리면 라운드·코트·취소 정보가 사라집니다. '
            '백업 후 데이터를 정리한 뒤 다시 시도하세요(C-38).'
        )
    op.drop_index('ix_club_match_game_events_game_id', table_name='club_match_game_events')
    op.drop_index('ix_club_match_game_events_match_id', table_name='club_match_game_events')
    op.drop_table('club_match_game_events')
    op.drop_constraint('ck_club_match_games_cancelled', 'club_match_games', type_='check')
    op.drop_constraint('ck_club_match_games_round_court', 'club_match_games', type_='check')
    op.drop_constraint('uq_club_match_games_court', 'club_match_games', type_='unique')
    op.drop_constraint('club_match_games_cancelled_by_id_fkey', 'club_match_games', type_='foreignkey')
    op.drop_column('club_match_games', 'cancel_reason')
    op.drop_column('club_match_games', 'cancelled_by_id')
    op.drop_column('club_match_games', 'cancelled_at')
    op.drop_column('club_match_games', 'court_no')
    op.drop_column('club_match_games', 'round_no')
    op.drop_constraint('ck_club_matches_current_round', 'club_matches', type_='check')
    op.drop_constraint('ck_club_matches_planned_rounds', 'club_matches', type_='check')
    op.drop_constraint('ck_club_matches_court_count', 'club_matches', type_='check')
    op.drop_column('club_matches', 'current_round')
    op.drop_column('club_matches', 'planned_rounds')
    op.drop_column('club_matches', 'court_count')
