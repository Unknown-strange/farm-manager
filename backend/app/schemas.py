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
    actual_revenue: Optional[Decimal] = None
    actual_expenses: Optional[Decimal] = None
    actual_sold_eggs: Optional[int] = Field(None, ge=0)


class ClosingResponse(BaseModel):
    business_date: date
    opening_override: Optional[int] = None
    closing_eggs: Optional[int] = None
    counted_eggs: Optional[int] = None
    difference_eggs: Optional[int] = None
    actual_revenue: Optional[Decimal] = None
    actual_expenses: Optional[Decimal] = None
    actual_sold_eggs: Optional[int] = None
    recorded_revenue: Optional[Decimal] = None
    recorded_expenses: Optional[Decimal] = None
    recorded_sold_eggs: Optional[int] = None
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
    actual_revenue: Optional[Decimal] = None
    actual_expenses: Optional[Decimal] = None
    actual_sold_eggs: Optional[int] = None
    recorded_revenue: Optional[Decimal] = None
    recorded_expenses: Optional[Decimal] = None
    recorded_sold: Optional[int] = None
    computed_closing: Optional[int] = None
    reconciled: bool = False
    closed_at: Optional[datetime] = None
    by_worker: List[WorkerSalesSummary]
    logged_by: List[str] = Field(default_factory=list)
    opening_anchor_date: Optional[date] = None
    opening_anchor_eggs: Optional[int] = None


class DailyFinancialSummaryItem(BaseModel):
    date: date
    day_name: str
    opening_money: Decimal
    cash_revenue: Decimal
    borrowed_amount: Decimal
    total_sales_value: Decimal
    feed_expenses: Decimal
    other_expenses: Decimal
    total_expenses: Decimal
    net_cash_flow: Decimal
    closing_money: Decimal
    logged_by: List[str] = Field(default_factory=list)
    sales_count: int = 0
    expenses_count: int = 0


class DailyEggStockItem(BaseModel):
    date: date
    day_name: str
    opening_eggs: int
    received_eggs: int
    sold_eggs: int
    cracked_eggs: int
    adjustment_eggs: int = 0  # physical count correction from a locked day (+/-)
    closing_eggs: int
    locked: bool = False


class PeriodExpenseItem(BaseModel):
    id: int
    business_date: date
    category: str
    name: str
    quantity: Optional[str] = None
    amount: Decimal
    created_by_name: str
    created_at: datetime


class FinancialTransactionItem(BaseModel):
    id: str
    kind: str  # "sale_cash", "sale_borrowed", "expense_feed", "expense_other", "settlement"
    business_date: date
    occurred_at: datetime
    title: str
    description: Optional[str] = None
    amount: Decimal
    is_cash_in: bool
    user_name: str
    crates: Optional[int] = None
    eggs: Optional[int] = None
    paid: bool = True


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
    daily_financials: List[DailyFinancialSummaryItem] = Field(default_factory=list)
    expenses: List[PeriodExpenseItem] = Field(default_factory=list)
    financial_transactions: List[FinancialTransactionItem] = Field(default_factory=list)
    stock_adjustment_eggs: int = 0
    daily_egg_stock: List[DailyEggStockItem] = Field(default_factory=list)
    unpaid_borrowed_all_time: Decimal = Decimal("0.00")
    unpaid_borrowed_outside_period: Decimal = Decimal("0.00")


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
    permissions: Optional[List[str]] = None


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    is_active: Optional[bool] = None
    is_deleted: Optional[bool] = None
    permissions: Optional[List[str]] = None


class PasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=4)


class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    role: str
    permissions: List[str] = Field(default_factory=list)
    is_active: bool
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def populate_permissions(cls, data):
        if hasattr(data, "role"):
            role = getattr(data, "role", "staff")
            raw_perms = getattr(data, "permissions", None)
            if isinstance(raw_perms, str):
                perms = [p.strip() for p in raw_perms.split(",") if p.strip()]
            elif isinstance(raw_perms, list):
                perms = raw_perms
            elif role == "admin":
                perms = ["*"]
            else:
                perms = [
                    "events:create",
                    "events:read_own",
                    "events:edit_own",
                    "events:void_own",
                    "expenses:create",
                    "expenses:undo_own",
                    "summary:read_own",
                ]
            if isinstance(data, dict):
                data["permissions"] = perms
                return data
            return {
                "id": data.id,
                "name": data.name,
                "username": data.username,
                "role": data.role,
                "permissions": perms,
                "is_active": data.is_active,
                "is_deleted": getattr(data, "is_deleted", False),
                "deleted_at": getattr(data, "deleted_at", None),
                "deleted_by": getattr(data, "deleted_by", None),
                "created_at": getattr(data, "created_at", None),
            }
        return data


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
    target_present_eggs: Optional[int] = Field(None, ge=0)
    target_opening_eggs: Optional[int] = Field(None, ge=0)
    target_opening_date: Optional[date] = None
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
    logged_by: List[str] = Field(default_factory=list)
    reconciled: bool = False

