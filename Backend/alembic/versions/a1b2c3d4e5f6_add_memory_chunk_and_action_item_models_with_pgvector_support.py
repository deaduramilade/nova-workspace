"""Add memory_chunk and action_item models with pgvector support

Revision ID: a1b2c3d4e5f6
Revises: b3e1f1e34131
Create Date: 2026-06-17 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'b3e1f1e34131'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Create memory_chunks table
    op.create_table(
        'memory_chunks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=False),
        sa.Column('meeting_id', sa.Integer(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('chunk_type', sa.Enum('decision', 'action_item', 'discussion', 'summary', name='chunktype'), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add vector column using raw SQL
    op.execute('ALTER TABLE memory_chunks ADD COLUMN embedding vector(1536)')
    
    # Create indexes on memory_chunks
    op.create_index(op.f('ix_memory_chunks_id'), 'memory_chunks', ['id'], unique=False)
    op.create_index(op.f('ix_memory_chunks_workspace_id'), 'memory_chunks', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_memory_chunks_meeting_id'), 'memory_chunks', ['meeting_id'], unique=False)
    op.create_index(op.f('ix_memory_chunks_created_at'), 'memory_chunks', ['created_at'], unique=False)
    
    # Create IVFFLAT index for vector similarity search
    op.execute('CREATE INDEX memory_chunks_embedding_idx ON memory_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)')

    # Create action_items table
    op.create_table(
        'action_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('memory_chunk_id', sa.Integer(), nullable=False),
        sa.Column('assigned_to_user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('open', 'in_progress', 'completed', 'blocked', 'cancelled', name='actionitemstatus'), nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['assigned_to_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['memory_chunk_id'], ['memory_chunks.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes on action_items
    op.create_index(op.f('ix_action_items_id'), 'action_items', ['id'], unique=False)
    op.create_index(op.f('ix_action_items_memory_chunk_id'), 'action_items', ['memory_chunk_id'], unique=False)
    op.create_index(op.f('ix_action_items_assigned_to_user_id'), 'action_items', ['assigned_to_user_id'], unique=False)
    op.create_index(op.f('ix_action_items_due_date'), 'action_items', ['due_date'], unique=False)
    op.create_index(op.f('ix_action_items_created_at'), 'action_items', ['created_at'], unique=False)


def downgrade() -> None:
    # Drop indexes on action_items
    op.drop_index(op.f('ix_action_items_created_at'), table_name='action_items')
    op.drop_index(op.f('ix_action_items_due_date'), table_name='action_items')
    op.drop_index(op.f('ix_action_items_assigned_to_user_id'), table_name='action_items')
    op.drop_index(op.f('ix_action_items_memory_chunk_id'), table_name='action_items')
    op.drop_index(op.f('ix_action_items_id'), table_name='action_items')
    
    # Drop action_items table
    op.drop_table('action_items')

    # Drop vector index on memory_chunks
    op.execute('DROP INDEX IF EXISTS memory_chunks_embedding_idx')
    
    # Drop indexes on memory_chunks
    op.drop_index(op.f('ix_memory_chunks_created_at'), table_name='memory_chunks')
    op.drop_index(op.f('ix_memory_chunks_meeting_id'), table_name='memory_chunks')
    op.drop_index(op.f('ix_memory_chunks_workspace_id'), table_name='memory_chunks')
    op.drop_index(op.f('ix_memory_chunks_id'), table_name='memory_chunks')
    
    # Drop memory_chunks table
    op.drop_table('memory_chunks')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS actionitemstatus')
    op.execute('DROP TYPE IF EXISTS chunktype')
    
    # Disable pgvector extension
    op.execute('DROP EXTENSION IF EXISTS vector')
