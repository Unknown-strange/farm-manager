"""Egg events router: recording sales, receipts, breakages, with scoping and idempotency."""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, Header, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import EggEvent, DailyClosing, User, Setting
from app.schemas import EventCreate, EventUpdate, EventResponse
from app.security import (
    get_current_user,
    require_permission,
    scope_events,
    get_business_date,
)
from app.permissions import (
    EVENTS_CREATE,
    EVENTS_READ_OWN,
    EVENTS_READ_ALL,
    EVENTS_EDIT_OWN,
    EVENTS_EDIT_ALL,
    EVENTS_VOID_OWN,
    EVENTS_VOID_ALL,
    CLOSINGS_MANAGE,
    has_permission,
)
from app.config import settings
from app.services.book import assert_stock_non_negative
from app.services.audit import record_audit

router = APIRouter(prefix="/events", tags=["events"])


def check_day_not_locked(db: Session, target_date: date) -> None:
    """Raises 409 Conflict if target_date has already been locked by admin."""
    closing = db.get(DailyClosing, target_date)
    if closing and closing.locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": f"Day {target_date} is closed and locked for entries", "code": "DAY_LOCKED"},
        )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(require_permission(EVENTS_CREATE)),
    db: Session = Depends(get_db),
):
    """Records an egg event (sale, received, or cracked)."""
    # 1. Idempotency check
    if idempotency_key:
        stmt = select(EggEvent).where(EggEvent.idempotency_key == idempotency_key)
        existing = db.scalar(stmt)
        if existing:
            return existing

    today = get_business_date()
    granted = settings.role_permissions.get(current_user.role, set())
    can_edit_all = has_permission(granted, EVENTS_EDIT_ALL)

    target_date = payload.business_date if (payload.business_date and can_edit_all) else today
    check_day_not_locked(db, target_date)

    # 2. Resolve eggs and amount if crates/price_per_crate are provided
    setting = db.get(Setting, 1)
    per_crate = setting.eggs_per_crate if setting else 30

    total_eggs = payload.eggs
    if total_eggs is None and payload.crates is not None:
        total_eggs = payload.crates * per_crate

    total_amount = payload.amount
    if payload.type == "sold":
        if payload.crates is not None and payload.price_per_crate is not None:
            total_amount = round(Decimal(payload.crates) * Decimal(payload.price_per_crate), 2)
        elif total_eggs is not None and payload.price_per_egg is not None:
            total_amount = round(Decimal(total_eggs) * Decimal(payload.price_per_egg), 2)

    exclude_from_stock = bool(payload.exclude_from_stock) if can_edit_all else False

    # Stock feasibility check for egg deductions (unless historical debt entry excluded from current physical stock)
    if payload.type == "sold" and not exclude_from_stock:
        assert_stock_non_negative(db, target_date, -total_eggs)

    is_borrowed = bool(payload.is_borrowed) if payload.type == "sold" else False
    paid = not is_borrowed

    # 3. Create event
    event = EggEvent(
        user_id=current_user.id,
        type=payload.type,
        eggs=total_eggs,
        amount=total_amount,
        is_borrowed=is_borrowed,
        paid=paid,
        exclude_from_stock=exclude_from_stock,
        note=payload.note,
        occurred_at=datetime.now(timezone.utc),
        business_date=target_date,
        idempotency_key=idempotency_key,
    )
    db.add(event)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user.id,
        action="event.create",
        table_name="egg_events",
        record_id=str(event.id),
        new_value={
            "type": event.type,
            "eggs": event.eggs,
            "amount": str(event.amount) if event.amount else None,
            "is_borrowed": event.is_borrowed,
            "paid": event.paid,
            "exclude_from_stock": event.exclude_from_stock,
            "business_date": str(event.business_date),
        },
    )
    db.commit()
    db.refresh(event)

    return EventResponse(
        id=event.id,
        user_id=event.user_id,
        user_name=current_user.name,
        type=event.type,
        eggs=event.eggs,
        amount=event.amount,
        is_borrowed=event.is_borrowed,
        paid=event.paid,
        paid_by=event.paid_by,
        paid_at=event.paid_at,
        exclude_from_stock=event.exclude_from_stock,
        note=event.note,
        occurred_at=event.occurred_at,
        business_date=event.business_date,
        voided=event.voided,
        voided_by=event.voided_by,
        voided_at=event.voided_at,
        idempotency_key=event.idempotency_key,
        created_at=event.created_at,
    )


@router.get("", response_model=List[EventResponse])
def list_events(
    target_date: Optional[date] = Query(None, alias="date"),
    user_id: Optional[int] = None,
    event_type: Optional[str] = Query(None, alias="type"),
    borrowed_only: Optional[bool] = Query(None, alias="borrowed"),
    paid_filter: Optional[bool] = Query(None, alias="paid"),
    current_user: User = Depends(require_permission(EVENTS_READ_OWN, EVENTS_READ_ALL)),
    db: Session = Depends(get_db),
):
    """Lists egg events, scoped automatically by ownership and optional filters."""
    query = select(EggEvent, User.name.label("user_name")).join(User, EggEvent.user_id == User.id)

    # Ownership scoping
    query = scope_events(query, current_user)

    if target_date:
        query = query.where(EggEvent.business_date == target_date)
    if user_id:
        query = query.where(EggEvent.user_id == user_id)
    if event_type:
        query = query.where(EggEvent.type == event_type)
    if borrowed_only is not None:
        query = query.where(EggEvent.is_borrowed.is_(borrowed_only))
    if paid_filter is not None:
        query = query.where(EggEvent.paid.is_(paid_filter))

    query = query.order_by(EggEvent.occurred_at.desc(), EggEvent.id.desc())
    rows = db.execute(query).all()

    return [
        EventResponse(
            id=r.EggEvent.id,
            user_id=r.EggEvent.user_id,
            user_name=r.user_name,
            type=r.EggEvent.type,
            eggs=r.EggEvent.eggs,
            amount=r.EggEvent.amount,
            is_borrowed=r.EggEvent.is_borrowed,
            paid=r.EggEvent.paid,
            paid_by=r.EggEvent.paid_by,
            paid_at=r.EggEvent.paid_at,
            note=r.EggEvent.note,
            occurred_at=r.EggEvent.occurred_at,
            business_date=r.EggEvent.business_date,
            voided=r.EggEvent.voided,
            voided_by=r.EggEvent.voided_by,
            voided_at=r.EggEvent.voided_at,
            idempotency_key=r.EggEvent.idempotency_key,
            created_at=r.EggEvent.created_at,
        )
        for r in rows
    ]


@router.patch("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    payload: EventUpdate,
    current_user: User = Depends(require_permission(EVENTS_EDIT_OWN, EVENTS_EDIT_ALL)),
    db: Session = Depends(get_db),
):
    """Updates an existing egg event respecting same-day and ownership constraints."""
    event = db.get(EggEvent, event_id)
    if not event or event.voided:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Event not found", "code": "NOT_FOUND"},
        )

    check_day_not_locked(db, event.business_date)
    today = get_business_date()

    granted = settings.role_permissions.get(current_user.role, set())
    can_edit_all = has_permission(granted, EVENTS_EDIT_ALL)

    # Ownership and same-day rule for staff
    if not can_edit_all:
        if event.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"detail": "Event not found", "code": "NOT_FOUND"},
            )
        if event.business_date != today:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "Can only edit entries recorded today", "code": "SAME_DAY_ONLY"},
            )

    old_val = {
        "eggs": event.eggs,
        "amount": str(event.amount) if event.amount else None,
        "is_borrowed": event.is_borrowed,
        "paid": event.paid,
        "note": event.note,
    }

    setting = db.get(Setting, 1)
    per_crate = setting.eggs_per_crate if setting else 30

    new_eggs = payload.eggs
    if new_eggs is None and payload.crates is not None:
        new_eggs = payload.crates * per_crate

    new_amount = payload.amount
    if payload.crates is not None and payload.price_per_crate is not None and new_amount is None:
        new_amount = round(Decimal(payload.crates) * Decimal(payload.price_per_crate), 2)
    elif (new_eggs or event.eggs) is not None and payload.price_per_egg is not None and new_amount is None:
        eggs_for_calc = new_eggs if new_eggs is not None else event.eggs
        new_amount = round(Decimal(eggs_for_calc) * Decimal(payload.price_per_egg), 2)

    if new_eggs is not None:
        delta = new_eggs - event.eggs
        if event.type == "sold":
            assert_stock_non_negative(db, event.business_date, -delta)
        event.eggs = new_eggs

    if new_amount is not None:
        if event.type != "sold":
            raise HTTPException(status_code=400, detail="Only sold events can carry an amount")
        event.amount = new_amount

    if payload.is_borrowed is not None:
        if event.type != "sold":
            raise HTTPException(status_code=400, detail="Only sold events can be marked as borrowed")
        event.is_borrowed = payload.is_borrowed
        if not payload.is_borrowed:
            event.paid = True

    if payload.note is not None:
        event.note = payload.note

    record_audit(
        db=db,
        user_id=current_user.id,
        action="event.edit",
        table_name="egg_events",
        record_id=str(event.id),
        old_value=old_val,
        new_value={
            "eggs": event.eggs,
            "amount": str(event.amount) if event.amount else None,
            "is_borrowed": event.is_borrowed,
            "paid": event.paid,
            "note": event.note,
        },
    )
    db.commit()
    db.refresh(event)

    user = db.get(User, event.user_id)
    return EventResponse(
        id=event.id,
        user_id=event.user_id,
        user_name=user.name if user else None,
        type=event.type,
        eggs=event.eggs,
        amount=event.amount,
        is_borrowed=event.is_borrowed,
        paid=event.paid,
        paid_by=event.paid_by,
        paid_at=event.paid_at,
        note=event.note,
        occurred_at=event.occurred_at,
        business_date=event.business_date,
        voided=event.voided,
        voided_by=event.voided_by,
        voided_at=event.voided_at,
        idempotency_key=event.idempotency_key,
        created_at=event.created_at,
    )


@router.post("/{event_id}/pay", response_model=EventResponse)
def mark_borrowed_sale_paid(
    event_id: int,
    current_user: User = Depends(require_permission(CLOSINGS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Marks a borrowed (credit) sale as paid. Restricted strictly to Admin."""
    event = db.get(EggEvent, event_id)
    if not event or event.voided:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Event not found", "code": "NOT_FOUND"},
        )

    if event.type != "sold" or not event.is_borrowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "Only borrowed sales can be marked as paid", "code": "BAD_REQUEST"},
        )

    old_val = {"is_borrowed": event.is_borrowed, "paid": event.paid}
    event.paid = True
    event.paid_by = current_user.id
    event.paid_at = datetime.now(timezone.utc)

    record_audit(
        db=db,
        user_id=current_user.id,
        action="event.mark_paid",
        table_name="egg_events",
        record_id=str(event.id),
        old_value=old_val,
        new_value={"is_borrowed": event.is_borrowed, "paid": True, "paid_by": current_user.id},
    )
    db.commit()
    db.refresh(event)

    user = db.get(User, event.user_id)
    return EventResponse(
        id=event.id,
        user_id=event.user_id,
        user_name=user.name if user else None,
        type=event.type,
        eggs=event.eggs,
        amount=event.amount,
        is_borrowed=event.is_borrowed,
        paid=event.paid,
        paid_by=event.paid_by,
        paid_at=event.paid_at,
        exclude_from_stock=event.exclude_from_stock,
        note=event.note,
        occurred_at=event.occurred_at,
        business_date=event.business_date,
        voided=event.voided,
        voided_by=event.voided_by,
        voided_at=event.voided_at,
        idempotency_key=event.idempotency_key,
        created_at=event.created_at,
    )


@router.post("/{event_id}/unpay", response_model=EventResponse)
def mark_borrowed_sale_unpaid(
    event_id: int,
    current_user: User = Depends(require_permission(CLOSINGS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Reverts a borrowed (credit) sale back to unpaid status. Restricted strictly to Admin."""
    event = db.get(EggEvent, event_id)
    if not event or event.voided:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Event not found", "code": "NOT_FOUND"},
        )

    if event.type != "sold" or not event.is_borrowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "Only borrowed sales can have their paid status changed", "code": "BAD_REQUEST"},
        )

    old_val = {"is_borrowed": event.is_borrowed, "paid": event.paid}
    event.paid = False
    event.paid_by = None
    event.paid_at = None

    record_audit(
        db=db,
        user_id=current_user.id,
        action="event.mark_unpaid",
        table_name="egg_events",
        record_id=str(event.id),
        old_value=old_val,
        new_value={"is_borrowed": event.is_borrowed, "paid": False},
    )
    db.commit()
    db.refresh(event)

    user = db.get(User, event.user_id)
    return EventResponse(
        id=event.id,
        user_id=event.user_id,
        user_name=user.name if user else None,
        type=event.type,
        eggs=event.eggs,
        amount=event.amount,
        is_borrowed=event.is_borrowed,
        paid=event.paid,
        paid_by=event.paid_by,
        paid_at=event.paid_at,
        exclude_from_stock=event.exclude_from_stock,
        note=event.note,
        occurred_at=event.occurred_at,
        business_date=event.business_date,
        voided=event.voided,
        voided_by=event.voided_by,
        voided_at=event.voided_at,
        idempotency_key=event.idempotency_key,
        created_at=event.created_at,
    )


@router.post("/{event_id}/void", response_model=EventResponse)
@router.delete("/{event_id}", response_model=EventResponse)
def void_event(
    event_id: int,
    current_user: User = Depends(require_permission(EVENTS_VOID_OWN, EVENTS_VOID_ALL)),
    db: Session = Depends(get_db),
):
    """Soft-voids (soft-deletes) an egg event with audit tracking. Records are never hard-deleted."""
    event = db.get(EggEvent, event_id)
    if not event or event.voided:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Event not found", "code": "NOT_FOUND"},
        )

    check_day_not_locked(db, event.business_date)
    today = get_business_date()

    granted = settings.role_permissions.get(current_user.role, set())
    can_void_all = has_permission(granted, EVENTS_VOID_ALL)

    if not can_void_all:
        if event.user_id != current_user.id:
            raise HTTPException(status_code=404, detail={"detail": "Event not found", "code": "NOT_FOUND"})
        if event.business_date != today:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Can only void entries recorded today", "code": "SAME_DAY_ONLY"},
            )

    event.voided = True
    event.voided_by = current_user.id
    event.voided_at = datetime.now(timezone.utc)

    record_audit(
        db=db,
        user_id=current_user.id,
        action="event.void",
        table_name="egg_events",
        record_id=str(event.id),
        old_value={"voided": False},
        new_value={"voided": True, "voided_by": current_user.id},
    )
    db.commit()
    db.refresh(event)

    user = db.get(User, event.user_id)
    return EventResponse(
        id=event.id,
        user_id=event.user_id,
        user_name=user.name if user else None,
        type=event.type,
        eggs=event.eggs,
        amount=event.amount,
        is_borrowed=event.is_borrowed,
        paid=event.paid,
        paid_by=event.paid_by,
        paid_at=event.paid_at,
        note=event.note,
        occurred_at=event.occurred_at,
        business_date=event.business_date,
        voided=event.voided,
        voided_by=event.voided_by,
        voided_at=event.voided_at,
        idempotency_key=event.idempotency_key,
        created_at=event.created_at,
    )

