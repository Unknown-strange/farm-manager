"""Add beginning_eggs, beginning_money to settings and exclude_from_stock to egg_events.

Revision ID: 004_add_beginning_balances
Revises: 003_add_user_soft_delete
Create Date: 2026-11-04 21:44:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_add_beginning_balances'
down_revision: Union[str, Sequence[str], None] = '003_add_user_soft_delete'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('settings', sa.Column('beginning_eggs', sa.Integer(), server_default=sa.text('0'), nullable=False))
    op.add_column('settings', sa.Column('beginning_money', sa.Numeric(12, 2), server_default=sa.text('0.00'), nullable=False))
    op.add_column('egg_events', sa.Column('exclude_from_stock', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade() -> None:
    op.drop_column('egg_events', 'exclude_from_stock')
    op.drop_column('settings', 'beginning_money')
    op.drop_column('settings', 'beginning_eggs')

