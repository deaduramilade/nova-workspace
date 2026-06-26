"""Add memories table for Nova Memory Phase 1

Revision ID: d7e8f9g0h1i2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7e8f9g0h1i2'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create memories table."""
    op.create_table(
        'memories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('memory_type', sa.String(), nullable=False, server_default='note'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', sa.JSON(), nullable=True),
        sa.Column('source_meeting_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for common queries
    op.create_index(op.f('ix_memories_id'), 'memories', ['id'], unique=False)
    op.create_index(op.f('ix_memories_workspace_id'), 'memories', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_memories_user_id'), 'memories', ['user_id'], unique=False)
    op.create_index(op.f('ix_memories_memory_type'), 'memories', ['memory_type'], unique=False)
    op.create_index(op.f('ix_memories_created_at'), 'memories', ['created_at'], unique=False)


def downgrade() -> None:
    """Drop memories table."""
    op.drop_index(op.f('ix_memories_created_at'), table_name='memories')
    op.drop_index(op.f('ix_memories_memory_type'), table_name='memories')
    op.drop_index(op.f('ix_memories_user_id'), table_name='memories')
    op.drop_index(op.f('ix_memories_workspace_id'), table_name='memories')
    op.drop_index(op.f('ix_memories_id'), table_name='memories')
    op.drop_table('memories')
