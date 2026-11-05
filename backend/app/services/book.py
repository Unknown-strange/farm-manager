"""Daily book calculations and stock verification logic."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case, and_, or_
from fastapi import HTTPException, status

from app.models import EggEvent, Expense, DailyClosing, User, Setting


def get_first_opening_override(db: Session) -> int:
    """Returns beginning_eggs from settings plus the earliest daily_closings opening_override (if any)."""
    setting = db.get(Setting, 1)
    base_beginning = int(setting.beginning_eggs) if setting and setting.beginning_eggs else 0

    stmt = (
        select(DailyClosing.opening_override)
        .where(DailyClosing.opening_override.isnot(None))
        .order_by(DailyClosing.business_date.asc())
        .limit(1)
    )
    result = db.scalar(stmt)
    return base_beginning + (result if result is not None else 0)


def get_beginning_money(db: Session) -> Decimal:
    """Returns the manual/beginning cash balance stored in settings."""
    setting = db.get(Setting, 1)
    return Decimal(str(setting.beginning_money)) if setting and setting.beginning_money is not None else Decimal("0.00")


# --- Recorded (raw ledger) figures for a single date ---

def recorded_paid_revenue_on(db: Session, target_date: date) -> Decimal:
    """Sum of paid sale amounts recorded on target_date (excluding voided)."""
    val = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (and_(EggEvent.type == "sold", EggEvent.paid.is_(True)), EggEvent.amount),
                        else_=0,
                    )
                ),
                0,
            )
        ).where(EggEvent.business_date == target_date, EggEvent.voided.is_(False))
    ) or 0
    return Decimal(str(val))


def recorded_expenses_on(db: Session, target_date: date) -> Decimal:
    """Sum of non-voided expense amounts recorded on target_date."""
    val = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.business_date == target_date, Expense.voided.is_(False)
        )
    ) or 0
    return Decimal(str(val))


def recorded_sold_eggs_on(db: Session, target_date: date) -> int:
    """Sum of sold eggs recorded on target_date that affect physical stock."""
    val = db.scalar(
        select(func.coalesce(func.sum(EggEvent.eggs), 0)).where(
            EggEvent.business_date == target_date,
            EggEvent.type == "sold",
            EggEvent.voided.is_(False),
            EggEvent.exclude_from_stock.is_(False),
        )
    ) or 0
    return int(val)


def get_reconciliation_adjustments(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Tuple[Decimal, Decimal, int]:
    """Returns (revenue_adj, expense_adj, sold_eggs_adj) = sum of (actual - recorded) across
    locked days that have reconciled actual figures, optionally restricted to [start_date, end_date]."""
    stmt = select(DailyClosing).where(
        DailyClosing.locked.is_(True),
        or_(
            DailyClosing.actual_revenue.isnot(None),
            DailyClosing.actual_expenses.isnot(None),
            DailyClosing.actual_sold_eggs.isnot(None),
        ),
    )
    if start_date is not None:
        stmt = stmt.where(DailyClosing.business_date >= start_date)
    if end_date is not None:
        stmt = stmt.where(DailyClosing.business_date <= end_date)

    revenue_adj = Decimal("0.00")
    expense_adj = Decimal("0.00")
    sold_adj = 0
    for c in db.scalars(stmt).all():
        if c.actual_revenue is not None:
            revenue_adj += Decimal(str(c.actual_revenue)) - recorded_paid_revenue_on(db, c.business_date)
        if c.actual_expenses is not None:
            expense_adj += Decimal(str(c.actual_expenses)) - recorded_expenses_on(db, c.business_date)
        if c.actual_sold_eggs is not None:
            sold_adj += int(c.actual_sold_eggs) - recorded_sold_eggs_on(db, c.business_date)
    return revenue_adj, expense_adj, sold_adj


def calculate_all_time_net_cash_flow(db: Session) -> Decimal:
    """Calculates all-time paid sales revenue minus all-time non-voided expenses (excluding beginning_money),
    corrected by reconciled actual figures on locked days."""
    paid_sales = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (and_(EggEvent.type == "sold", EggEvent.paid.is_(True)), EggEvent.amount),
                        else_=0,
                    )
                ),
                0,
            )
        ).where(EggEvent.voided.is_(False))
    ) or 0
    all_expenses = db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.voided.is_(False))
    ) or 0
    revenue_adj, expense_adj, _ = get_reconciliation_adjustments(db)
    return (Decimal(str(paid_sales)) + revenue_adj) - (Decimal(str(all_expenses)) + expense_adj)


def _net_egg_change_case():
    return case(
        (EggEvent.type == "received", EggEvent.eggs),
        (EggEvent.type == "cracked", -EggEvent.eggs),
        (EggEvent.type == "sold", -EggEvent.eggs),
        else_=0,
    )


def calculate_opening_stock(db: Session, target_date: date) -> int:
    """Calculates the stock at the start of target_date.

    If a locked day with a physical count exists before target_date, the most recent one is used as
    the anchor (physical count + net movement after it). Otherwise stock is accumulated from the
    beginning balance."""
    anchor = db.scalar(
        select(DailyClosing)
        .where(
            DailyClosing.business_date < target_date,
            DailyClosing.locked.is_(True),
            DailyClosing.counted_eggs.isnot(None),
        )
        .order_by(DailyClosing.business_date.desc())
        .limit(1)
    )

    if anchor is not None:
        stmt = select(func.coalesce(func.sum(_net_egg_change_case()), 0)).where(
            EggEvent.business_date > anchor.business_date,
            EggEvent.business_date < target_date,
            EggEvent.voided.is_(False),
            EggEvent.exclude_from_stock.is_(False),
        )
        return int(anchor.counted_eggs) + int(db.scalar(stmt) or 0)

    first_override = get_first_opening_override(db)

    # Net change for all dates < target_date (excluding historical debt entries marked exclude_from_stock)
    stmt = select(func.coalesce(func.sum(_net_egg_change_case()), 0)).where(
        EggEvent.business_date < target_date,
        EggEvent.voided.is_(False),
        EggEvent.exclude_from_stock.is_(False),
    )
    prior_net_change = db.scalar(stmt) or 0
    return first_override + prior_net_change


def calculate_daily_book(db: Session, target_date: date) -> Dict[str, Any]:
    """Computes the full daily book for target_date according to the paper-book order."""
    opening = calculate_opening_stock(db, target_date)
    beginning_money = get_beginning_money(db)

    # Check if opening stock is anchored by an earlier locked day's physical count
    anchor = db.scalar(
        select(DailyClosing)
        .where(
            DailyClosing.business_date < target_date,
            DailyClosing.locked.is_(True),
            DailyClosing.counted_eggs.isnot(None),
        )
        .order_by(DailyClosing.business_date.desc())
        .limit(1)
    )
    opening_anchor_date = anchor.business_date if anchor else None
    opening_anchor_eggs = int(anchor.counted_eggs) if anchor and anchor.counted_eggs is not None else None

    # Egg events aggregates for target_date
    # Physical stock counts exclude events where exclude_from_stock is True
    events_stmt = select(
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "received", EggEvent.exclude_from_stock.is_(False)), EggEvent.eggs),
                    else_=0,
                )
            ),
            0,
        ).label("gotten"),
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "cracked", EggEvent.exclude_from_stock.is_(False)), EggEvent.eggs),
                    else_=0,
                )
            ),
            0,
        ).label("cracked"),
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "sold", EggEvent.exclude_from_stock.is_(False)), EggEvent.eggs),
                    else_=0,
                )
            ),
            0,
        ).label("sold"),
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "sold", EggEvent.paid.is_(True)), EggEvent.amount),
                    else_=0,
                )
            ),
            0,
        ).label("revenue"),
        func.coalesce(
            func.sum(
                case(
                    (
                        and_(
                            EggEvent.type == "sold",
                            EggEvent.is_borrowed.is_(True),
                            EggEvent.paid.is_(False),
                        ),
                        EggEvent.amount,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("borrowed_amount"),
    ).where(
        EggEvent.business_date == target_date,
        EggEvent.voided.is_(False),
    )
    event_row = db.execute(events_stmt).one()
    gotten = int(event_row.gotten)
    cracked = int(event_row.cracked)
    sold = int(event_row.sold)
    revenue = Decimal(str(event_row.revenue))
    borrowed_amount = Decimal(str(event_row.borrowed_amount))
    total_sales_amount = revenue + borrowed_amount

    # Expenses aggregates for target_date
    expenses_stmt = select(
        func.coalesce(
            func.sum(case((Expense.category == "feed", Expense.amount), else_=0)), 0
        ).label("feed"),
        func.coalesce(
            func.sum(case((Expense.category == "other", Expense.amount), else_=0)), 0
        ).label("other"),
    ).where(
        Expense.business_date == target_date,
        Expense.voided.is_(False),
    )
    expense_row = db.execute(expenses_stmt).one()
    feed = Decimal(str(expense_row.feed))
    other = Decimal(str(expense_row.other))
    total_expenses = feed + other

    closing = opening + gotten - cracked - sold
    net_margin = revenue - total_expenses
    projected_net_margin = total_sales_amount - total_expenses

    # Check daily closing status and reconciliation overrides
    closing_record = db.get(DailyClosing, target_date)
    recorded_revenue = revenue
    recorded_expenses = total_expenses
    recorded_sold = sold
    computed_closing = closing
    actual_revenue = None
    actual_expenses = None
    actual_sold_eggs = None
    reconciled = False

    if closing_record and closing_record.locked:
        if closing_record.counted_eggs is not None:
            closing = closing_record.counted_eggs
            reconciled = True
        if closing_record.actual_revenue is not None:
            actual_revenue = closing_record.actual_revenue
            revenue = actual_revenue
            reconciled = True
        if closing_record.actual_expenses is not None:
            actual_expenses = closing_record.actual_expenses
            total_expenses = actual_expenses
            reconciled = True
        if closing_record.actual_sold_eggs is not None:
            actual_sold_eggs = closing_record.actual_sold_eggs
            sold = actual_sold_eggs
            reconciled = True

        total_sales_amount = revenue + borrowed_amount
        net_margin = revenue - total_expenses
        projected_net_margin = total_sales_amount - total_expenses

    # Aggregates by worker
    worker_stmt = select(
        User.id.label("user_id"),
        User.name.label("user_name"),
        func.coalesce(func.sum(case((EggEvent.type == "sold", EggEvent.eggs), else_=0)), 0).label("sold_eggs"),
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "sold", EggEvent.paid.is_(True)), EggEvent.amount),
                    else_=0,
                )
            ),
            0,
        ).label("sold_amount"),
        func.coalesce(
            func.sum(
                case(
                    (
                        and_(
                            EggEvent.type == "sold",
                            EggEvent.is_borrowed.is_(True),
                            EggEvent.paid.is_(False),
                        ),
                        EggEvent.amount,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("borrowed_amount"),
    ).join(User, EggEvent.user_id == User.id).where(
        EggEvent.business_date == target_date,
        EggEvent.voided.is_(False),
    ).group_by(User.id, User.name)
    workers_rows = db.execute(worker_stmt).all()
    by_worker: List[Dict[str, Any]] = [
        {
            "user_id": r.user_id,
            "user_name": r.user_name,
            "sold_eggs": int(r.sold_eggs),
            "sold_amount": Decimal(str(r.sold_amount)),
            "borrowed_amount": Decimal(str(r.borrowed_amount)),
        }
        for r in workers_rows
    ]

    # Unique staff names who logged entries on target_date
    event_users = select(User.name).join(EggEvent, EggEvent.user_id == User.id).where(
        EggEvent.business_date == target_date,
        EggEvent.voided.is_(False),
    )
    expense_users = select(User.name).join(Expense, Expense.created_by == User.id).where(
        Expense.business_date == target_date,
        Expense.voided.is_(False),
    )
    logged_by_query = event_users.union(expense_users)
    logged_by_names = sorted(list(set(db.scalars(logged_by_query).all())))

    return {
        "business_date": target_date,
        "opening": opening,
        "gotten": gotten,
        "cracked": cracked,
        "sold": sold,
        "closing": closing,
        "beginning_money": beginning_money,
        "revenue": revenue,
        "borrowed_amount": borrowed_amount,
        "total_sales_amount": total_sales_amount,
        "feed": feed,
        "other": other,
        "total_expenses": total_expenses,
        "net_margin": net_margin,
        "projected_net_margin": projected_net_margin,
        "locked": closing_record.locked if closing_record else False,
        "counted_eggs": closing_record.counted_eggs if closing_record else None,
        "actual_revenue": actual_revenue,
        "actual_expenses": actual_expenses,
        "actual_sold_eggs": actual_sold_eggs,
        "recorded_revenue": recorded_revenue,
        "recorded_expenses": recorded_expenses,
        "recorded_sold": recorded_sold,
        "computed_closing": computed_closing,
        "reconciled": reconciled,
        "closed_at": closing_record.closed_at if closing_record else None,
        "by_worker": by_worker,
        "logged_by": logged_by_names,
        "opening_anchor_date": opening_anchor_date,
        "opening_anchor_eggs": opening_anchor_eggs,
    }


def calculate_period_summary(
    db: Session,
    start_date: date,
    end_date: date,
    period_name: str = "custom",
) -> Dict[str, Any]:
    """Computes aggregated book figures across a date range [start_date, end_date],
    including present money vs projected money when borrowed sales are paid."""
    opening_eggs = calculate_opening_stock(db, start_date)
    beginning_money = get_beginning_money(db)

    events_stmt = select(
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "received", EggEvent.exclude_from_stock.is_(False)), EggEvent.eggs),
                    else_=0,
                )
            ),
            0,
        ).label("gotten_eggs"),
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "cracked", EggEvent.exclude_from_stock.is_(False)), EggEvent.eggs),
                    else_=0,
                )
            ),
            0,
        ).label("cracked_eggs"),
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "sold", EggEvent.exclude_from_stock.is_(False)), EggEvent.eggs),
                    else_=0,
                )
            ),
            0,
        ).label("sold_eggs"),
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.type == "sold", EggEvent.paid.is_(True)), EggEvent.amount),
                    else_=0,
                )
            ),
            0,
        ).label("cash_revenue"),
        func.coalesce(
            func.sum(
                case(
                    (
                        and_(
                            EggEvent.type == "sold",
                            EggEvent.is_borrowed.is_(True),
                            EggEvent.paid.is_(False),
                        ),
                        EggEvent.amount,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("borrowed_unpaid_amount"),
        func.coalesce(
            func.sum(
                case(
                    (
                        and_(
                            EggEvent.type == "sold",
                            EggEvent.is_borrowed.is_(True),
                            EggEvent.paid.is_(True),
                        ),
                        EggEvent.amount,
                    ),
                    else_=0,
                )
            ),
            0,
        ).label("borrowed_paid_amount"),
    ).where(
        EggEvent.business_date >= start_date,
        EggEvent.business_date <= end_date,
        EggEvent.voided.is_(False),
    )
    ev_row = db.execute(events_stmt).one()
    gotten_eggs = int(ev_row.gotten_eggs)
    cracked_eggs = int(ev_row.cracked_eggs)
    sold_eggs = int(ev_row.sold_eggs)
    cash_revenue = Decimal(str(ev_row.cash_revenue))
    borrowed_unpaid_amount = Decimal(str(ev_row.borrowed_unpaid_amount))
    borrowed_paid_amount = Decimal(str(ev_row.borrowed_paid_amount))
    total_sales_amount = cash_revenue + borrowed_unpaid_amount

    expenses_stmt = select(
        func.coalesce(
            func.sum(case((Expense.category == "feed", Expense.amount), else_=0)), 0
        ).label("feed_expenses"),
        func.coalesce(
            func.sum(case((Expense.category == "other", Expense.amount), else_=0)), 0
        ).label("other_expenses"),
    ).where(
        Expense.business_date >= start_date,
        Expense.business_date <= end_date,
        Expense.voided.is_(False),
    )
    exp_row = db.execute(expenses_stmt).one()
    feed_expenses = Decimal(str(exp_row.feed_expenses))
    other_expenses = Decimal(str(exp_row.other_expenses))
    total_expenses = feed_expenses + other_expenses

    # Apply reconciliation overrides within the period [start_date, end_date]
    revenue_adj, expense_adj, sold_adj = get_reconciliation_adjustments(db, start_date, end_date)
    cash_revenue = cash_revenue + revenue_adj
    total_expenses = total_expenses + expense_adj
    sold_eggs = sold_eggs + sold_adj

    closing_eggs = calculate_opening_stock(db, end_date + timedelta(days=1))

    # Fetch borrowed sales (either in the period OR currently unpaid so admin always sees open credit)
    borrowed_stmt = (
        select(EggEvent, User.name.label("user_name"))
        .join(User, EggEvent.user_id == User.id)
        .where(
            EggEvent.type == "sold",
            EggEvent.is_borrowed.is_(True),
            EggEvent.voided.is_(False),
            or_(
                and_(EggEvent.business_date >= start_date, EggEvent.business_date <= end_date),
                EggEvent.paid.is_(False),
            ),
        )
        .order_by(EggEvent.paid.asc(), EggEvent.occurred_at.desc(), EggEvent.id.desc())
    )
    borrowed_rows = db.execute(borrowed_stmt).all()

    # All-time open unpaid borrowed amount (matches the unpaid rows shown in borrowed_sales)
    all_unpaid_borrowed = sum(
        (Decimal(str(r.EggEvent.amount or 0)) for r in borrowed_rows if not r.EggEvent.paid),
        Decimal("0.00"),
    )
    borrowed_unpaid_amount = all_unpaid_borrowed
    total_sales_amount = cash_revenue + borrowed_unpaid_amount

    # Cumulative present money on hand (beginning_money + all-time paid sales - all-time expenses)
    money_left_present = beginning_money + calculate_all_time_net_cash_flow(db)
    money_left_with_borrowed = money_left_present + borrowed_unpaid_amount
    borrowed_sales = [
        {
            "id": r.EggEvent.id,
            "user_id": r.EggEvent.user_id,
            "user_name": r.user_name,
            "type": r.EggEvent.type,
            "eggs": r.EggEvent.eggs,
            "amount": r.EggEvent.amount,
            "is_borrowed": r.EggEvent.is_borrowed,
            "paid": r.EggEvent.paid,
            "paid_by": r.EggEvent.paid_by,
            "paid_at": r.EggEvent.paid_at,
            "exclude_from_stock": r.EggEvent.exclude_from_stock,
            "note": r.EggEvent.note,
            "occurred_at": r.EggEvent.occurred_at,
            "business_date": r.EggEvent.business_date,
            "voided": r.EggEvent.voided,
            "voided_by": r.EggEvent.voided_by,
            "voided_at": r.EggEvent.voided_at,
            "idempotency_key": r.EggEvent.idempotency_key,
            "created_at": r.EggEvent.created_at,
        }
        for r in borrowed_rows
    ]

    return {
        "period": period_name,
        "start_date": start_date,
        "end_date": end_date,
        "opening_eggs": opening_eggs,
        "gotten_eggs": gotten_eggs,
        "cracked_eggs": cracked_eggs,
        "sold_eggs": sold_eggs,
        "closing_eggs": closing_eggs,
        "beginning_money": beginning_money,
        "cash_revenue": cash_revenue,
        "borrowed_unpaid_amount": borrowed_unpaid_amount,
        "borrowed_paid_amount": borrowed_paid_amount,
        "total_sales_amount": total_sales_amount,
        "feed_expenses": feed_expenses,
        "other_expenses": other_expenses,
        "total_expenses": total_expenses,
        "money_left_present": money_left_present,
        "money_left_with_borrowed": money_left_with_borrowed,
        "borrowed_sales": borrowed_sales,
    }


def assert_stock_non_negative(
    db: Session,
    target_date: date,
    proposed_egg_delta: int,
) -> None:
    """Ensures that introducing proposed_egg_delta on target_date does not cause stock to fall below zero.
    
    proposed_egg_delta is negative for egg deductions (e.g. -eggs when selling or cracking).
    """
    if proposed_egg_delta >= 0:
        return

    # Check closing stock of target_date
    book = calculate_daily_book(db, target_date)
    projected_closing = book["closing"] + proposed_egg_delta
    if projected_closing < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": f"Stock cannot be negative (current available: {book['closing']} eggs)", "code": "STOCK_NEGATIVE"},
        )

