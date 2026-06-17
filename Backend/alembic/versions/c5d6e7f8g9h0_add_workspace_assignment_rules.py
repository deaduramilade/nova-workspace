"""Add workspace_assignment_rules table

Revision ID: c5d6e7f8g9h0
Revises: a1b2c3d4e5f6
Create Date: 2026-06-17 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8g9h0'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workspace_assignment_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('rule_type', sa.Enum('role_based', 'user_specific', 'round_robin', 'custom', name='assignmentruletype'), nullable=False),
        sa.Column('target_role', sa.String(), nullable=True),
        sa.Column('target_user_id', sa.Integer(), nullable=True),
        sa.Column('criteria', sa.JSON(), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default=sa.text('100')),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('conditions', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.create_index(op.f('ix_workspace_assignment_rules_id'), 'workspace_assignment_rules', ['id'], unique=False)
    op.create_index(op.f('ix_workspace_assignment_rules_workspace_id'), 'workspace_assignment_rules', ['workspace_id'], unique=False)
    op.create_index(op.f('ix_workspace_assignment_rules_target_user_id'), 'workspace_assignment_rules', ['target_user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_workspace_assignment_rules_target_user_id'), table_name='workspace_assignment_rules')
    op.drop_index(op.f('ix_workspace_assignment_rules_workspace_id'), table_name='workspace_assignment_rules')
    op.drop_index(op.f('ix_workspace_assignment_rules_id'), table_name='workspace_assignment_rules')
    op.drop_table('workspace_assignment_rules')
