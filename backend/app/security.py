"""Security utilities: password hashing, JWT management, and permission dependencies."""

from datetime import date, datetime, timedelta, timezone
from typing import Callable, Optional
from zoneinfo import ZoneInfo

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import Select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import EggEvent, User
from app.permissions import has_permission

http_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(user_id: int, role: str) -> str:
    """Generates a signed JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """Decodes and validates a JWT access token."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_business_date() -> date:
    """Returns today's date in the configured business timezone (Africa/Accra)."""
    tz = ZoneInfo(settings.TIMEZONE)
    return datetime.now(tz).date()


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that authenticates the incoming Bearer token and returns the User."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if not user or not user.is_active or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_user_permissions(user: User) -> set[str]:
    """Returns the effective permissions set for the given user, taking custom permissions or role defaults into account."""
    if user.role == "admin":
        return settings.role_permissions.get("admin", {"*"})
    if user.permissions is not None:
        return {p.strip() for p in user.permissions.split(",") if p.strip()}
    return settings.role_permissions.get(user.role, set())


def require_permission(*needed: str) -> Callable[[User], User]:
    """Dependency factory checking whether the current user has any of the needed permissions."""
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        granted = get_user_permissions(current_user)
        if has_permission(granted, *needed):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to perform this operation",
        )

    return dependency


def scope_events(query: Select, user: User) -> Select:
    """Applies ownership filtering to an EggEvent query if the user only has events:read_own."""
    granted = get_user_permissions(user)
    if not has_permission(granted, "events:read_all"):
        return query.where(EggEvent.user_id == user.id)
    return query

