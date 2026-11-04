"""Add borrowed sales fields (is_borrowed, paid, paid_by, paid_at) to egg_events.

Revision ID: 002_add_borrowed_sales_fields
Revises: 001_create_core_tables
Create Date: 2026-11-03 15:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002_add_borrowed_sales_fields'
down_revision: Union[str, Sequence[str], None] = '001_create_core_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('egg_events', sa.Column('is_borrowed', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('egg_events', sa.Column('paid', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('egg_events', sa.Column('paid_by', sa.BigInteger(), nullable=True))
    op.add_column('egg_events', sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_egg_events_paid_by_users', 'egg_events', 'users', ['paid_by'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_egg_events_paid_by_users', 'egg_events', type_='foreignkey')
    op.drop_column('egg_events', 'paid_at')
    op.drop_column('egg_events', 'paid_by')
    op.drop_column('egg_events', 'paid')
    op.drop_column('egg_events', 'is_borrowed')

