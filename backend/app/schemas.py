"""Pydantic v2 schemas for request validation and response serialization."""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, model_validator


# --- Auth Schemas ---

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    name: str
    username: str
    role: str
    permissions: List[str]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# --- Event Schemas ---

class EventCreate(BaseModel):
    type: str = Field(..., pattern="^(received|sold|cracked)$")
    eggs: Optional[int] = Field(None, gt=0)
    crates: Optional[int] = Field(None, gt=0)
    price_per_crate: Optional[Decimal] = Field(None, ge=0)
    price_per_egg: Optional[Decimal] = Field(None, ge=0)
    amount: Optional[Decimal] = Field(None, ge=0)
    is_borrowed: bool = False
    exclude_from_stock: bool = False
    business_date: Optional[date] = None
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_sold_and_eggs(self):
        if self.type == "sold":
            if self.crates is not None and self.price_per_crate is not None:
                computed = round(Decimal(self.crates) * Decimal(self.price_per_crate), 2)
                self.amount = computed
            elif self.eggs is not None and self.price_per_egg is not None:
                computed = round(Decimal(self.eggs) * Decimal(self.price_per_egg), 2)
                self.amount = computed
            if self.amount is None:
                raise ValueError(
                    "Amount (or crates + price_per_crate, or eggs + price_per_egg) is required when event type is 'sold'"
                )
        else:
            if self.amount is not None:
                raise ValueError("Amount can only be provided when event type is 'sold'")
            if self.price_per_crate is not None:
                raise ValueError("price_per_crate can only be provided when event type is 'sold'")
            if self.price_per_egg is not None:
                raise ValueError("price_per_egg can only be provided when event type is 'sold'")
            if self.is_borrowed:
                raise ValueError("Only sold events can be marked as borrowed")

        if self.eggs is None and self.crates is None:
            raise ValueError("Either 'eggs' or 'crates' must be provided")

        return self


class EventUpdate(BaseModel):
    eggs: Optional[int] = Field(None, gt=0)
    crates: Optional[int] = Field(None, gt=0)
    price_per_crate: Optional[Decimal] = Field(None, ge=0)
    price_per_egg: Optional[Decimal] = Field(None, ge=0)
    amount: Optional[Decimal] = Field(None, ge=0)
    is_borrowed: Optional[bool] = None
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_update(self):
        if self.crates is not None and self.price_per_crate is not None and self.amount is None:
            self.amount = round(Decimal(self.crates) * Decimal(self.price_per_crate), 2)
        elif self.eggs is not None and self.price_per_egg is not None and self.amount is None:
            self.amount = round(Decimal(self.eggs) * Decimal(self.price_per_egg), 2)
        return self


class EventResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    type: str
    eggs: int
    amount: Optional[Decimal] = None
    is_borrowed: bool = False
    paid: bool = True
    paid_by: Optional[int] = None
    paid_at: Optional[datetime] = None
    exclude_from_stock: bool = False
    note: Optional[str] = None
    occurred_at: datetime
    business_date: date
    voided: bool
    voided_by: Optional[int] = None
    voided_at: Optional[datetime] = None
    idempotency_key: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Expense Schemas ---

class ExpenseCreate(BaseModel):
    category: str = Field(..., pattern="^(feed|other)$")
    name: Optional[str] = None
    quantity: Optional[str] = None
    amount: Decimal = Field(..., ge=0)
    business_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_name_by_category(self):
        if self.category == "other" and not (self.name and self.name.strip()):
            raise ValueError("Name is required when expense category is 'other'")
        if self.category == "feed" and not self.name:
            self.name = "Feed"
        return self


class ExpenseCreateResponse(BaseModel):
    id: int
    created_at: datetime
    undo_until: datetime


class ExpenseUpdate(BaseModel):
    category: Optional[str] = Field(None, pattern="^(feed|other)$")
    name: Optional[str] = None
    quantity: Optional[str] = None
    amount: Optional[Decimal] = Field(None, ge=0)


class ExpenseResponse(BaseModel):
    id: int
    category: str
    name: str
    quantity: Optional[str] = None
    amount: Decimal
    business_date: date
    created_by: int
    created_by_name: Optional[str] = None
    voided: bool
    voided_by: Optional[int] = None
    voided_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Daily Closings Schemas ---

class CloseDayRequest(BaseModel):
    counted_eggs: int = Field(..., ge=0)
    opening_override: Optional[int] = None


class ClosingResponse(BaseModel):
    business_date: date
    opening_override: Optional[int] = None
    closing_eggs: Optional[int] = None
    counted_eggs: Optional[int] = None
    difference_eggs: Optional[int] = None
    locked: bool
    closed_by: Optional[int] = None
    closed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Summary & Book Schemas ---

class WorkerSalesSummary(BaseModel):
    user_id: int
    user_name: str
    sold_eggs: int
    sold_amount: Decimal
    borrowed_amount: Decimal = Decimal("0.00")


class DailyBookResponse(BaseModel):
    business_date: date
    opening: int
    gotten: int
    cracked: int
    sold: int
    closing: int
    beginning_money: Decimal = Decimal("0.00")
    revenue: Decimal
    borrowed_amount: Decimal = Decimal("0.00")
    total_sales_amount: Decimal = Decimal("0.00")
    feed: Decimal
    other: Decimal
    total_expenses: Decimal
    net_margin: Decimal
    projected_net_margin: Decimal = Decimal("0.00")
    locked: bool
    counted_eggs: Optional[int] = None
    closed_at: Optional[datetime] = None
    by_worker: List[WorkerSalesSummary]


class PeriodSummaryResponse(BaseModel):
    period: str
    start_date: date
    end_date: date
    opening_eggs: int
    gotten_eggs: int
    cracked_eggs: int
    sold_eggs: int
    closing_eggs: int
    beginning_money: Decimal = Decimal("0.00")
    cash_revenue: Decimal
    borrowed_unpaid_amount: Decimal
    borrowed_paid_amount: Decimal
    total_sales_amount: Decimal
    feed_expenses: Decimal
    other_expenses: Decimal
    total_expenses: Decimal
    money_left_present: Decimal
    money_left_with_borrowed: Decimal
    borrowed_sales: List[EventResponse]


class StaffSummaryResponse(BaseModel):
    business_date: date
    sales_count: int
    sales_total: Decimal
    borrowed_total: Decimal = Decimal("0.00")


# --- User Schemas ---

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=4)
    role: str = Field(..., pattern="^(admin|staff)$")


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    is_active: Optional[bool] = None
    is_deleted: Optional[bool] = None


class PasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=4)


class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    role: str
    is_active: bool
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Settings Schemas ---

class SettingsResponse(BaseModel):
    id: int
    eggs_per_crate: int
    currency: str
    beginning_eggs: int = 0
    beginning_money: Decimal = Decimal("0.00")

    model_config = ConfigDict(from_attributes=True)


class SettingsUpdate(BaseModel):
    eggs_per_crate: Optional[int] = Field(None, gt=0)
    currency: Optional[str] = Field(None, min_length=1)
    beginning_eggs: Optional[int] = Field(None, ge=0)
    beginning_money: Optional[Decimal] = None
    target_present_money: Optional[Decimal] = None


# --- Reports Schemas ---

class ReportRow(BaseModel):
    business_date: date
    opening: int
    gotten: int
    cracked: int
    sold: int
    closing: int
    revenue: Decimal
    borrowed_amount: Decimal = Decimal("0.00")
    feed: Decimal
    other: Decimal
    total_expenses: Decimal
    net_margin: Decimal
    projected_net_margin: Decimal = Decimal("0.00")

