"""Add soft delete fields (is_deleted, deleted_at, deleted_by) to users.

Revision ID: 003_add_user_soft_delete
Revises: 002_add_borrowed_sales_fields
Create Date: 2026-11-03 16:22:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003_add_user_soft_delete'
down_revision: Union[str, Sequence[str], None] = '002_add_borrowed_sales_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('deleted_by', sa.BigInteger(), nullable=True))
    op.create_foreign_key('fk_users_deleted_by_users', 'users', 'users', ['deleted_by'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_users_deleted_by_users', 'users', type_='foreignkey')
    op.drop_column('users', 'deleted_by')
    op.drop_column('users', 'deleted_at')
    op.drop_column('users', 'is_deleted')

