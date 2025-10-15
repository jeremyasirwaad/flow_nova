"""add_tools_table

Revision ID: 475d16061732
Revises: 639865f14b48
Create Date: 2025-10-14 20:31:08.391890

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '475d16061732'
down_revision: Union[str, None] = '639865f14b48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create tools table
    op.create_table(
        'tools',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('api_url', sa.String(), nullable=False),
        sa.Column('method', sa.String(), nullable=False),
        sa.Column('request_body', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('headers', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('parameters', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('id')
    )


def downgrade() -> None:
    # Drop tools table
    op.drop_table('tools')
