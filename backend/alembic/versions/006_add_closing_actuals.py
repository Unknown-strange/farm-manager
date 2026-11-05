"""Add reconciled actual figures to daily_closings.

Revision ID: 006_add_closing_actuals
Revises: 005_add_user_permissions
Create Date: 2026-11-05 08:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_add_closing_actuals'
down_revision: Union[str, Sequence[str], None] = '005_add_user_permissions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('daily_closings', sa.Column('actual_revenue', sa.Numeric(12, 2), nullable=True))
    op.add_column('daily_closings', sa.Column('actual_expenses', sa.Numeric(12, 2), nullable=True))
    op.add_column('daily_closings', sa.Column('actual_sold_eggs', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('daily_closings', 'actual_sold_eggs')
    op.drop_column('daily_closings', 'actual_expenses')
    op.drop_column('daily_closings', 'actual_revenue')

