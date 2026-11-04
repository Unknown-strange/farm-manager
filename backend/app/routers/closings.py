"""Daily closings router: reconciliation, end-of-day counts, and locking days."""

from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyClosing, User
from app.schemas import CloseDayRequest, ClosingResponse
from app.security import require_permission
from app.permissions import CLOSINGS_MANAGE
from app.services.book import calculate_daily_book
from app.services.audit import record_audit

router = APIRouter(prefix="/closings", tags=["closings"])


@router.get("/{target_date}", response_model=ClosingResponse)
def get_closing_info(
    target_date: date,
    current_user: User = Depends(require_permission(CLOSINGS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Returns computed closing stock and current reconciliation status for a date."""
    book = calculate_daily_book(db, target_date)
    computed_closing = book["closing"]

    closing = db.get(DailyClosing, target_date)
    counted = closing.counted_eggs if closing else None
    diff = (counted - computed_closing) if counted is not None else None

    return ClosingResponse(
        business_date=target_date,
        opening_override=closing.opening_override if closing else None,
        closing_eggs=computed_closing,
        counted_eggs=counted,
        difference_eggs=diff,
        locked=closing.locked if closing else False,
        closed_by=closing.closed_by if closing else None,
        closed_at=closing.closed_at if closing else None,
    )


@router.post("/{target_date}", response_model=ClosingResponse)
def close_day(
    target_date: date,
    payload: CloseDayRequest,
    current_user: User = Depends(require_permission(CLOSINGS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Submits physical egg count, records reconciliation difference, and locks the business date."""
    book = calculate_daily_book(db, target_date)
    computed_closing = book["closing"]

    closing = db.get(DailyClosing, target_date)
    if not closing:
        closing = DailyClosing(business_date=target_date)
        db.add(closing)

    if payload.opening_override is not None:
        closing.opening_override = payload.opening_override

    closing.closing_eggs = computed_closing
    closing.counted_eggs = payload.counted_eggs
    closing.locked = True
    closing.closed_by = current_user.id
    closing.closed_at = datetime.now(timezone.utc)

    record_audit(
        db=db,
        user_id=current_user.id,
        action="day.close",
        table_name="daily_closings",
        record_id=str(target_date),
        new_value={
            "closing_eggs": computed_closing,
            "counted_eggs": payload.counted_eggs,
            "difference": payload.counted_eggs - computed_closing,
            "locked": True,
        },
    )
    db.commit()
    db.refresh(closing)

    diff = closing.counted_eggs - closing.closing_eggs

    return ClosingResponse(
        business_date=closing.business_date,
        opening_override=closing.opening_override,
        closing_eggs=closing.closing_eggs,
        counted_eggs=closing.counted_eggs,
        difference_eggs=diff,
        locked=closing.locked,
        closed_by=closing.closed_by,
        closed_at=closing.closed_at,
    )

