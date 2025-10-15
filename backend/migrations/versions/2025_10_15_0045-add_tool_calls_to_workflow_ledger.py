"""add_tool_calls_to_workflow_ledger

Revision ID: a7f8e9d2c1b3
Revises: 35c0805d6136
Create Date: 2025-10-15 00:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a7f8e9d2c1b3'
down_revision: Union[str, None] = '35c0805d6136'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add tool_calls column to workflow_ledger table
    op.add_column('workflow_ledger', sa.Column('tool_calls', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    # Remove tool_calls column from workflow_ledger table
    op.drop_column('workflow_ledger', 'tool_calls')
