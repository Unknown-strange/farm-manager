"""Centralized audit logging service."""

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import AuditLog


def record_audit(
    db: Session,
    user_id: Optional[int],
    action: str,
    table_name: Optional[str] = None,
    record_id: Optional[str] = None,
    old_value: Optional[Any] = None,
    new_value: Optional[Any] = None,
) -> AuditLog:
    """Inserts a new audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=str(record_id) if record_id is not None else None,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(entry)
    db.flush()
    return entry

