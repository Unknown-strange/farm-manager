"""Reports router: historical summaries and CSV export."""

import csv
import io
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.permissions import REPORTS_READ
from app.schemas import ReportRow
from app.security import get_business_date, require_permission
from app.services.book import calculate_daily_book

router = APIRouter(prefix="/reports", tags=["reports"])


def get_dates_in_range(start_date: date, end_date: date) -> List[date]:
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")
    delta = (end_date - start_date).days
    return [start_date + timedelta(days=i) for i in range(delta + 1)]


@router.get("", response_model=List[ReportRow])
def get_reports(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    current_user: User = Depends(require_permission(REPORTS_READ)),
    db: Session = Depends(get_db),
):
    """Returns daily book summary rows over a specified date range."""
    today = get_business_date()
    start = from_date if from_date else (today - timedelta(days=30))
    end = to_date if to_date else today

    # Check which dates in range have data or closings
    dates = get_dates_in_range(start, end)
    results: List[ReportRow] = []

    for d in dates:
        book = calculate_daily_book(db, d)
        results.append(
            ReportRow(
                business_date=book["business_date"],
                opening=book["opening"],
                gotten=book["gotten"],
                cracked=book["cracked"],
                sold=book["sold"],
                closing=book["closing"],
                revenue=book["revenue"],
                borrowed_amount=book["borrowed_amount"],
                feed=book["feed"],
                other=book["other"],
                total_expenses=book["total_expenses"],
                net_margin=book["net_margin"],
                projected_net_margin=book["projected_net_margin"],
                logged_by=book.get("logged_by", []),
                reconciled=book.get("reconciled", False),
            )
        )
    return results


@router.get("/export")
def export_reports_csv(
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    current_user: User = Depends(require_permission(REPORTS_READ)),
    db: Session = Depends(get_db),
):
    """Exports daily book summary rows as a downloadable CSV."""
    today = get_business_date()
    start = from_date if from_date else (today - timedelta(days=30))
    end = to_date if to_date else today

    dates = get_dates_in_range(start, end)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Business Date",
        "Opening Eggs",
        "Gotten Eggs",
        "Cracked Eggs",
        "Sold Eggs",
        "Closing Eggs",
        "Sales Revenue (GH₵)",
        "Feed Expenses (GH₵)",
        "Other Expenses (GH₵)",
        "Total Expenses (GH₵)",
        "Net Margin (GH₵)",
        "Logged By Staff",
    ])

    for d in dates:
        book = calculate_daily_book(db, d)
        logged_by_str = ", ".join(book.get("logged_by", [])) if book.get("logged_by") else "None"
        writer.writerow([
            str(book["business_date"]),
            book["opening"],
            book["gotten"],
            book["cracked"],
            book["sold"],
            book["closing"],
            f"{book['revenue']:.2f}",
            f"{book['feed']:.2f}",
            f"{book['other']:.2f}",
            f"{book['total_expenses']:.2f}",
            f"{book['net_margin']:.2f}",
            logged_by_str,
        ])

    output.seek(0)
    filename = f"eggbook_report_{start}_{end}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

