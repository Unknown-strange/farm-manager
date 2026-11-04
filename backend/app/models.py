"""SQLAlchemy 2.0 ORM models corresponding to DATABASE_FLOW.md."""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Any
from sqlalchemy import (
    BigInteger,
    SmallInteger,
    Integer,
    Numeric,
    Text,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    CheckConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'staff')", name="check_user_role"),
    )


class EggEvent(Base):
    __tablename__ = "egg_events"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    eggs: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    business_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_borrowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    paid_by: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    exclude_from_stock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    voided: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    voided_by: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True)
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    voider: Mapped[Optional["User"]] = relationship("User", foreign_keys=[voided_by])
    payer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[paid_by])

    __table_args__ = (
        CheckConstraint("type IN ('received', 'sold', 'cracked')", name="check_event_type"),
        CheckConstraint("eggs > 0", name="check_event_eggs_positive"),
        CheckConstraint("amount IS NULL OR amount >= 0", name="check_event_amount_positive"),
        CheckConstraint("type = 'sold' OR amount IS NULL", name="check_event_sold_amount"),
        Index("ix_egg_events_business_date_type", "business_date", "type"),
        Index("ix_egg_events_user_business_date", "user_id", "business_date"),
    )


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    business_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    voided: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    voided_by: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True)
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    voider: Mapped[Optional["User"]] = relationship("User", foreign_keys=[voided_by])

    __table_args__ = (
        CheckConstraint("category IN ('feed', 'other')", name="check_expense_category"),
        CheckConstraint("amount >= 0", name="check_expense_amount_positive"),
        Index("ix_expenses_business_date_category", "business_date", "category"),
        Index("ix_expenses_created_by_business_date", "created_by", "business_date"),
    )


class DailyClosing(Base):
    __tablename__ = "daily_closings"

    business_date: Mapped[date] = mapped_column(Date, primary_key=True)
    opening_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    closing_eggs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    counted_eggs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    closed_by: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    closer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[closed_by])


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    eggs_per_crate: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="GH₵")
    beginning_eggs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    beginning_money: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))

    __table_args__ = (
        CheckConstraint("id = 1", name="check_settings_single_row"),
        CheckConstraint("eggs_per_crate > 0", name="check_eggs_per_crate_positive"),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    table_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    record_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    old_value: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_audit_log_table_record", "table_name", "record_id"),
        Index("ix_audit_log_at", "at"),
    )
