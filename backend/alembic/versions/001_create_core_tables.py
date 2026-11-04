"""Create core tables: users, settings, daily_closings, egg_events, expenses, audit_log.

Revision ID: 001_create_core_tables
Revises: 
Create Date: 2026-11-03 09:49:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_create_core_tables'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('username', sa.Text(), nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('role', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'staff')", name='check_user_role'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
    )
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # 2. settings
    op.create_table(
        'settings',
        sa.Column('id', sa.SmallInteger(), server_default='1', nullable=False),
        sa.Column('eggs_per_crate', sa.Integer(), server_default='30', nullable=False),
        sa.Column('currency', sa.Text(), server_default='GH₵', nullable=False),
        sa.CheckConstraint('id = 1', name='check_settings_single_row'),
        sa.CheckConstraint('eggs_per_crate > 0', name='check_eggs_per_crate_positive'),
        sa.PrimaryKeyConstraint('id'),
    )

    # 3. daily_closings
    op.create_table(
        'daily_closings',
        sa.Column('business_date', sa.Date(), nullable=False),
        sa.Column('opening_override', sa.Integer(), nullable=True),
        sa.Column('closing_eggs', sa.Integer(), nullable=True),
        sa.Column('counted_eggs', sa.Integer(), nullable=True),
        sa.Column('locked', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('closed_by', sa.BigInteger(), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['closed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('business_date'),
    )

    # 4. egg_events
    op.create_table(
        'egg_events',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('type', sa.Text(), nullable=False),
        sa.Column('eggs', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('business_date', sa.Date(), nullable=False),
        sa.Column('voided', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('voided_by', sa.BigInteger(), nullable=True),
        sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('idempotency_key', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("type IN ('received', 'sold', 'cracked')", name='check_event_type'),
        sa.CheckConstraint('eggs > 0', name='check_event_eggs_positive'),
        sa.CheckConstraint('amount IS NULL OR amount >= 0', name='check_event_amount_positive'),
        sa.CheckConstraint("type = 'sold' OR amount IS NULL", name='check_event_sold_amount'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['voided_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('idempotency_key'),
    )
    op.create_index('ix_egg_events_business_date_type', 'egg_events', ['business_date', 'type'])
    op.create_index('ix_egg_events_user_business_date', 'egg_events', ['user_id', 'business_date'])

    # 5. expenses
    op.create_table(
        'expenses',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('category', sa.Text(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('quantity', sa.Text(), nullable=True),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('business_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.BigInteger(), nullable=False),
        sa.Column('voided', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('voided_by', sa.BigInteger(), nullable=True),
        sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("category IN ('feed', 'other')", name='check_expense_category'),
        sa.CheckConstraint('amount >= 0', name='check_expense_amount_positive'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['voided_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_expenses_business_date_category', 'expenses', ['business_date', 'category'])
    op.create_index('ix_expenses_created_by_business_date', 'expenses', ['created_by', 'business_date'])

    # 6. audit_log
    op.create_table(
        'audit_log',
        sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=True),
        sa.Column('action', sa.Text(), nullable=False),
        sa.Column('table_name', sa.Text(), nullable=True),
        sa.Column('record_id', sa.Text(), nullable=True),
        sa.Column('old_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_log_table_record', 'audit_log', ['table_name', 'record_id'])
    op.create_index('ix_audit_log_at', 'audit_log', ['at'])


def downgrade() -> None:
    op.drop_table('audit_log')
    op.drop_table('expenses')
    op.drop_table('egg_events')
    op.drop_table('daily_closings')
    op.drop_table('settings')
    op.drop_table('users')

