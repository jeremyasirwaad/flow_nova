"""Add workflow_runs and workflow_ledger tables with relationships

Revision ID: 14b46a8e774b
Revises: 12c3dc1a833f
Create Date: 2025-10-14 14:57:58.537980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '14b46a8e774b'
down_revision: Union[str, None] = '12c3dc1a833f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Get connection to check if tables exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # Create workflow_runs table only if it doesn't exist
    if 'workflow_runs' not in existing_tables:
        op.create_table(
            'workflow_runs',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('input_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('output_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.ForeignKeyConstraint(['node_id'], ['workflow_nodes.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('id')
        )
        op.create_index('ix_workflow_runs_node_id', 'workflow_runs', ['node_id'])
        op.create_index('ix_workflow_runs_workflow_created', 'workflow_runs', ['workflow_id', 'created_at'])
        op.create_index('ix_workflow_runs_workflow_id', 'workflow_runs', ['workflow_id'])

    # Create workflow_ledger table only if it doesn't exist
    if 'workflow_ledger' not in existing_tables:
        op.create_table(
            'workflow_ledger',
            sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('input_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('output_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('workflow_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('node_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('run_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.ForeignKeyConstraint(['node_id'], ['workflow_nodes.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['run_id'], ['workflow_runs.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('id')
        )
        op.create_index('ix_workflow_ledger_node_id', 'workflow_ledger', ['node_id'])
        op.create_index('ix_workflow_ledger_run_id', 'workflow_ledger', ['run_id'])
        op.create_index('ix_workflow_ledger_workflow_created', 'workflow_ledger', ['workflow_id', 'created_at'])
        op.create_index('ix_workflow_ledger_workflow_id', 'workflow_ledger', ['workflow_id'])
    else:
        # Table exists, check if run_id column exists and add it if not
        columns = [col['name'] for col in inspector.get_columns('workflow_ledger')]
        if 'run_id' not in columns:
            # Add run_id column
            op.add_column('workflow_ledger', sa.Column('run_id', postgresql.UUID(as_uuid=True), nullable=True))
            # Create foreign key constraint
            op.create_foreign_key(
                'fk_workflow_ledger_run_id',
                'workflow_ledger',
                'workflow_runs',
                ['run_id'],
                ['id'],
                ondelete='CASCADE'
            )
            # Create index
            op.create_index('ix_workflow_ledger_run_id', 'workflow_ledger', ['run_id'])


def downgrade() -> None:
    # Drop workflow_ledger table and indexes
    op.drop_index('ix_workflow_ledger_workflow_id', table_name='workflow_ledger')
    op.drop_index('ix_workflow_ledger_workflow_created', table_name='workflow_ledger')
    op.drop_index('ix_workflow_ledger_run_id', table_name='workflow_ledger')
    op.drop_index('ix_workflow_ledger_node_id', table_name='workflow_ledger')
    op.drop_table('workflow_ledger')

    # Drop workflow_runs table and indexes
    op.drop_index('ix_workflow_runs_workflow_id', table_name='workflow_runs')
    op.drop_index('ix_workflow_runs_workflow_created', table_name='workflow_runs')
    op.drop_index('ix_workflow_runs_node_id', table_name='workflow_runs')
    op.drop_table('workflow_runs')
