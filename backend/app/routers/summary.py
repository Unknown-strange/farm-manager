"""Summary router: admin daily book, period summaries (week/month/year), and worker shift sales totals."""

import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case, and_

from app.database import get_db
from app.models import EggEvent, User
from app.schemas import DailyBookResponse, PeriodSummaryResponse, StaffSummaryResponse
from app.security import (
    require_permission,
    get_business_date,
)
from app.permissions import SUMMARY_READ_ALL, SUMMARY_READ_OWN
from app.services.book import calculate_daily_book, calculate_period_summary

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("", response_model=DailyBookResponse)
def get_daily_book(
    target_date: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(require_permission(SUMMARY_READ_ALL)),
    db: Session = Depends(get_db),
):
    """Returns the full paper-book calculations and daily financial summary (Admin only)."""
    selected_date = target_date if target_date else get_business_date()
    book = calculate_daily_book(db, selected_date)
    return DailyBookResponse(**book)


@router.get("/period", response_model=PeriodSummaryResponse)
def get_period_summary(
    period: str = Query("week", pattern="^(day|week|month|year|custom)$"),
    target_date: Optional[date] = Query(None, alias="date"),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    current_user: User = Depends(require_permission(SUMMARY_READ_ALL)),
    db: Session = Depends(get_db),
):
    """Returns aggregated financial and stock summary for day, week, month, year, or custom range."""
    ref_date = target_date if target_date else get_business_date()

    if period == "day":
        start_date = ref_date
        end_date = ref_date
    elif period == "week":
        # Monday to Sunday of the week containing ref_date
        start_date = ref_date - timedelta(days=ref_date.weekday())
        end_date = start_date + timedelta(days=6)
    elif period == "month":
        start_date = date(ref_date.year, ref_date.month, 1)
        last_day = calendar.monthrange(ref_date.year, ref_date.month)[1]
        end_date = date(ref_date.year, ref_date.month, last_day)
    elif period == "year":
        start_date = date(ref_date.year, 1, 1)
        end_date = date(ref_date.year, 12, 31)
    else:
        start_date = from_date if from_date else (ref_date - timedelta(days=6))
        end_date = to_date if to_date else ref_date
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="Start date cannot be after end date")

    summary = calculate_period_summary(db, start_date, end_date, period_name=period)
    return PeriodSummaryResponse(**summary)


@router.get("/mine", response_model=StaffSummaryResponse)
def get_my_summary(
    target_date: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(require_permission(SUMMARY_READ_OWN)),
    db: Session = Depends(get_db),
):
    """Returns own sales count, paid revenue total, and borrowed total for the day (Worker Station)."""
    selected_date = target_date if target_date else get_business_date()

    stmt = select(
        func.count().label("sales_count"),
        func.coalesce(
            func.sum(
                case(
                    (EggEvent.paid.is_(True), EggEvent.amount),
                    else_=0,
                )
            ),
            0,
        ).label("sales_total"),
        func.coalesce(
            func.sum(
                case(
                    (and_(EggEvent.is_borrowed.is_(True), EggEvent.paid.is_(False)), EggEvent.amount),
                    else_=0,
                )
            ),
            0,
        ).label("borrowed_total"),
    ).where(
        EggEvent.user_id == current_user.id,
        EggEvent.business_date == selected_date,
        EggEvent.type == "sold",
        EggEvent.voided.is_(False),
    )
    row = db.execute(stmt).one()

    return StaffSummaryResponse(
        business_date=selected_date,
        sales_count=int(row.sales_count),
        sales_total=Decimal(str(row.sales_total)),
        borrowed_total=Decimal(str(row.borrowed_total)),
    )

