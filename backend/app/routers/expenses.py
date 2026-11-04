"""Expenses router: recording expenses with undo windows and privacy protection."""

from datetime import date, datetime, timedelta, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import Expense, DailyClosing, User
from app.schemas import (
    ExpenseCreate,
    ExpenseCreateResponse,
    ExpenseUpdate,
    ExpenseResponse,
)
from app.security import (
    get_current_user,
    require_permission,
    get_business_date,
)
from app.permissions import (
    EXPENSES_CREATE,
    EXPENSES_UNDO_OWN,
    EXPENSES_READ,
    EXPENSES_EDIT,
)
from app.config import settings
from app.services.audit import record_audit

router = APIRouter(prefix="/expenses", tags=["expenses"])


def check_day_not_locked(db: Session, target_date: date) -> None:
    closing = db.get(DailyClosing, target_date)
    if closing and closing.locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": f"Day {target_date} is locked", "code": "DAY_LOCKED"},
        )


@router.post("", response_model=ExpenseCreateResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(require_permission(EXPENSES_CREATE)),
    db: Session = Depends(get_db),
):
    """Creates a new expense. Returns minimal payload with undo window to protect financial privacy."""
    today = get_business_date()
    check_day_not_locked(db, today)

    now_utc = datetime.now(timezone.utc)
    undo_until = now_utc + timedelta(minutes=settings.STAFF_EXPENSE_UNDO_MINUTES)

    expense = Expense(
        category=payload.category,
        name=payload.name if payload.name else "Feed",
        quantity=payload.quantity,
        amount=payload.amount,
        business_date=today,
        created_by=current_user.id,
        created_at=now_utc,
    )
    db.add(expense)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user.id,
        action="expense.create",
        table_name="expenses",
        record_id=str(expense.id),
        new_value={
            "category": expense.category,
            "name": expense.name,
            "amount": str(expense.amount),
            "business_date": str(expense.business_date),
        },
    )
    db.commit()

    return ExpenseCreateResponse(
        id=expense.id,
        created_at=expense.created_at,
        undo_until=undo_until,
    )


@router.post("/{expense_id}/undo", status_code=status.HTTP_200_OK)
def undo_expense(
    expense_id: int,
    current_user: User = Depends(require_permission(EXPENSES_UNDO_OWN)),
    db: Session = Depends(get_db),
):
    """Allows staff to undo their own expense within the allowed time window."""
    expense = db.get(Expense, expense_id)
    if not expense or expense.voided:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Expense not found", "code": "NOT_FOUND"},
        )

    if expense.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Expense not found", "code": "NOT_FOUND"},
        )

    check_day_not_locked(db, expense.business_date)

    now_utc = datetime.now(timezone.utc)
    created_at_utc = (
        expense.created_at
        if expense.created_at.tzinfo is not None
        else expense.created_at.replace(tzinfo=timezone.utc)
    )
    max_undo_time = created_at_utc + timedelta(minutes=settings.STAFF_EXPENSE_UNDO_MINUTES)
    if now_utc > max_undo_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "Expense undo window has expired", "code": "UNDO_EXPIRED"},
        )

    expense.voided = True
    expense.voided_by = current_user.id
    expense.voided_at = now_utc

    record_audit(
        db=db,
        user_id=current_user.id,
        action="expense.undo",
        table_name="expenses",
        record_id=str(expense.id),
        old_value={"voided": False},
        new_value={"voided": True, "voided_by": current_user.id},
    )
    db.commit()
    return {"detail": "Expense successfully undone"}


@router.get("", response_model=List[ExpenseResponse])
def list_expenses(
    target_date: Optional[date] = Query(None, alias="date"),
    category: Optional[str] = None,
    user_id: Optional[int] = None,
    current_user: User = Depends(require_permission(EXPENSES_READ)),
    db: Session = Depends(get_db),
):
    """Lists expenses. Forbidden for staff users who lack expenses:read permission."""
    query = select(Expense, User.name.label("creator_name")).join(User, Expense.created_by == User.id)

    if target_date:
        query = query.where(Expense.business_date == target_date)
    if category:
        query = query.where(Expense.category == category)
    if user_id:
        query = query.where(Expense.created_by == user_id)

    query = query.order_by(Expense.created_at.desc(), Expense.id.desc())
    rows = db.execute(query).all()

    return [
        ExpenseResponse(
            id=r.Expense.id,
            category=r.Expense.category,
            name=r.Expense.name,
            quantity=r.Expense.quantity,
            amount=r.Expense.amount,
            business_date=r.Expense.business_date,
            created_by=r.Expense.created_by,
            created_by_name=r.creator_name,
            voided=r.Expense.voided,
            voided_by=r.Expense.voided_by,
            voided_at=r.Expense.voided_at,
            created_at=r.Expense.created_at,
        )
        for r in rows
    ]


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(require_permission(EXPENSES_EDIT)),
    db: Session = Depends(get_db),
):
    """Updates an expense record (admin only)."""
    expense = db.get(Expense, expense_id)
    if not expense or expense.voided:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Expense not found", "code": "NOT_FOUND"},
        )

    check_day_not_locked(db, expense.business_date)

    old_val = {
        "category": expense.category,
        "name": expense.name,
        "quantity": expense.quantity,
        "amount": str(expense.amount),
    }

    if payload.category is not None:
        expense.category = payload.category
    if payload.name is not None:
        expense.name = payload.name
    if payload.quantity is not None:
        expense.quantity = payload.quantity
    if payload.amount is not None:
        expense.amount = payload.amount

    record_audit(
        db=db,
        user_id=current_user.id,
        action="expense.edit",
        table_name="expenses",
        record_id=str(expense.id),
        old_value=old_val,
        new_value={
            "category": expense.category,
            "name": expense.name,
            "quantity": expense.quantity,
            "amount": str(expense.amount),
        },
    )
    db.commit()
    db.refresh(expense)

    creator = db.get(User, expense.created_by)
    return ExpenseResponse(
        id=expense.id,
        category=expense.category,
        name=expense.name,
        quantity=expense.quantity,
        amount=expense.amount,
        business_date=expense.business_date,
        created_by=expense.created_by,
        created_by_name=creator.name if creator else None,
        voided=expense.voided,
        voided_by=expense.voided_by,
        voided_at=expense.voided_at,
        created_at=expense.created_at,
    )


@router.post("/{expense_id}/void", response_model=ExpenseResponse)
@router.delete("/{expense_id}", response_model=ExpenseResponse)
def void_expense(
    expense_id: int,
    current_user: User = Depends(require_permission(EXPENSES_EDIT)),
    db: Session = Depends(get_db),
):
    """Soft-voids (soft-deletes) an expense (admin only). Records are never hard-deleted."""
    expense = db.get(Expense, expense_id)
    if not expense or expense.voided:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "Expense not found", "code": "NOT_FOUND"},
        )

    check_day_not_locked(db, expense.business_date)

    expense.voided = True
    expense.voided_by = current_user.id
    expense.voided_at = datetime.now(timezone.utc)

    record_audit(
        db=db,
        user_id=current_user.id,
        action="expense.void",
        table_name="expenses",
        record_id=str(expense.id),
        old_value={"voided": False},
        new_value={"voided": True, "voided_by": current_user.id},
    )
    db.commit()
    db.refresh(expense)

    creator = db.get(User, expense.created_by)
    return ExpenseResponse(
        id=expense.id,
        category=expense.category,
        name=expense.name,
        quantity=expense.quantity,
        amount=expense.amount,
        business_date=expense.business_date,
        created_by=expense.created_by,
        created_by_name=creator.name if creator else None,
        voided=expense.voided,
        voided_by=expense.voided_by,
        voided_at=expense.voided_at,
        created_at=expense.created_at,
    )

