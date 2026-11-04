"""User management router: staff creation, deactivation, soft deletion, and password resets."""

from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.schemas import (
    UserCreate,
    UserUpdate,
    PasswordResetRequest,
    UserResponse,
)
from app.security import (
    require_permission,
    hash_password,
)
from app.permissions import USERS_MANAGE
from app.services.audit import record_audit

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserResponse])
def list_users(
    include_deleted: bool = Query(True, description="Include soft-deleted accounts so historical staff data remains linked"),
    current_user: User = Depends(require_permission(USERS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Lists user accounts (Admin only). Soft-deleted users are retained so their historical data is never lost."""
    stmt = select(User)
    if not include_deleted:
        stmt = stmt.where(User.is_deleted.is_(False))
    stmt = stmt.order_by(User.is_deleted.asc(), User.created_at.asc(), User.id.asc())
    users = db.scalars(stmt).all()
    return users


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_permission(USERS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Creates a new user account with role admin or staff."""
    clean_username = payload.username.strip().lower()

    # Check unique username
    existing = db.scalar(select(User).where(User.username == clean_username))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": f"Username '{clean_username}' is already in use", "code": "USERNAME_TAKEN"},
        )

    user = User(
        name=payload.name.strip(),
        username=clean_username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        is_deleted=False,
    )
    db.add(user)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user.id,
        action="user.create",
        table_name="users",
        record_id=str(user.id),
        new_value={"name": user.name, "username": user.username, "role": user.role},
    )
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_permission(USERS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Updates user name, toggles account activation, or restores a soft-deleted user."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "User not found", "code": "NOT_FOUND"},
        )

    if user.id == current_user.id and (payload.is_active is False or payload.is_deleted is True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "You cannot deactivate or delete your own account", "code": "SELF_ACTION_FORBIDDEN"},
        )

    old_val = {"name": user.name, "is_active": user.is_active, "is_deleted": user.is_deleted}

    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.is_deleted is not None:
        user.is_deleted = payload.is_deleted
        if payload.is_deleted:
            user.is_active = False
            user.deleted_at = datetime.now(timezone.utc)
            user.deleted_by = current_user.id
        else:
            user.deleted_at = None
            user.deleted_by = None
    if payload.is_active is not None:
        user.is_active = payload.is_active
        if payload.is_active and user.is_deleted:
            user.is_deleted = False
            user.deleted_at = None
            user.deleted_by = None

    record_audit(
        db=db,
        user_id=current_user.id,
        action="user.update",
        table_name="users",
        record_id=str(user.id),
        old_value=old_val,
        new_value={"name": user.name, "is_active": user.is_active, "is_deleted": user.is_deleted},
    )
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=UserResponse)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_permission(USERS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Soft-deletes a user account so they lose system access while all their historical data is permanently preserved."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "User not found", "code": "NOT_FOUND"},
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "You cannot delete your own account", "code": "SELF_DELETE_FORBIDDEN"},
        )

    old_val = {
        "is_active": user.is_active,
        "is_deleted": user.is_deleted,
    }

    user.is_deleted = True
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc)
    user.deleted_by = current_user.id

    record_audit(
        db=db,
        user_id=current_user.id,
        action="user.soft_delete",
        table_name="users",
        record_id=str(user.id),
        old_value=old_val,
        new_value={
            "is_active": False,
            "is_deleted": True,
            "deleted_by": current_user.id,
        },
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password", status_code=status.HTTP_200_OK)
def reset_password(
    user_id: int,
    payload: PasswordResetRequest,
    current_user: User = Depends(require_permission(USERS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Resets the password for a user account."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "User not found", "code": "NOT_FOUND"},
        )

    user.password_hash = hash_password(payload.new_password)

    record_audit(
        db=db,
        user_id=current_user.id,
        action="user.password_reset",
        table_name="users",
        record_id=str(user.id),
    )
    db.commit()
    return {"detail": "Password has been successfully updated"}

