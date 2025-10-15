"""add_user_id_to_tools

Revision ID: 35c0805d6136
Revises: 475d16061732
Create Date: 2025-10-14 20:38:01.187968

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '35c0805d6136'
down_revision: Union[str, None] = '475d16061732'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add user_id column to tools table
    op.add_column('tools', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key('fk_tools_user_id', 'tools', 'users', ['user_id'], ['id'])

    # Note: Since this is a new table and likely empty, we can make it NOT NULL
    # If there's data, you'd need to set a default user_id first
    op.alter_column('tools', 'user_id', nullable=False)


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_tools_user_id', 'tools', type_='foreignkey')

    # Drop user_id column
    op.drop_column('tools', 'user_id')
