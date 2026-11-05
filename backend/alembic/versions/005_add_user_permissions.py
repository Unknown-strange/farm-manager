"""Add permissions column to users table.

Revision ID: 005_add_user_permissions
Revises: 004_add_beginning_balances
Create Date: 2026-11-05 08:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_add_user_permissions'
down_revision: Union[str, Sequence[str], None] = '004_add_beginning_balances'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('permissions', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'permissions')

