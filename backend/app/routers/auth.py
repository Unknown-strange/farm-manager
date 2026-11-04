"""Authentication router: login and current user profile."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, ChangePasswordRequest, TokenResponse, MeResponse
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.services.audit import record_audit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates username and password and returns a JWT access token."""
    clean_username = payload.username.strip().lower()
    stmt = select(User).where(User.username == clean_username)
    user = db.scalar(stmt)

    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active or user.is_deleted:
        record_audit(
            db=db,
            user_id=user.id if user else None,
            action="auth.login_failed",
            table_name="users",
            record_id=str(user.id) if user else clean_username,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Wrong username or password", "code": "AUTH_FAILED"},
        )

    token = create_access_token(user_id=user.id, role=user.role)
    record_audit(
        db=db,
        user_id=user.id,
        action="auth.login_success",
        table_name="users",
        record_id=str(user.id),
    )
    db.commit()
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user profile along with granted permissions."""
    role_perms = settings.role_permissions.get(current_user.role, set())
    permissions_list = sorted(list(role_perms))

    return MeResponse(
        id=current_user.id,
        name=current_user.name,
        username=current_user.username,
        role=current_user.role,
        permissions=permissions_list,
        is_active=current_user.is_active,
    )


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allows any authenticated user to change their own password."""
    if not verify_password(payload.current_password, current_user.password_hash):
        record_audit(
            db=db,
            user_id=current_user.id,
            action="auth.change_password_failed",
            table_name="users",
            record_id=str(current_user.id),
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "Current password is incorrect", "code": "INVALID_CURRENT_PASSWORD"},
        )

    current_user.password_hash = hash_password(payload.new_password)
    record_audit(
        db=db,
        user_id=current_user.id,
        action="auth.change_password_success",
        table_name="users",
        record_id=str(current_user.id),
    )
    db.commit()
    return {"detail": "Password successfully updated"}


