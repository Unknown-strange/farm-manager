"""Settings router: farm configurations such as eggs per crate and currency."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Setting, User
from app.schemas import SettingsResponse, SettingsUpdate
from app.security import (
    get_current_user,
    require_permission,
)
from app.permissions import SETTINGS_MANAGE
from app.services.audit import record_audit

router = APIRouter(prefix="/settings", tags=["settings"])


def get_or_create_settings(db: Session) -> Setting:
    setting = db.get(Setting, 1)
    if not setting:
        setting = Setting(id=1, eggs_per_crate=30, currency="GH₵")
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.get("", response_model=SettingsResponse)
def get_settings_view(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns application configuration for all authenticated users."""
    return get_or_create_settings(db)


@router.patch("", response_model=SettingsResponse)
def update_settings(
    payload: SettingsUpdate,
    current_user: User = Depends(require_permission(SETTINGS_MANAGE)),
    db: Session = Depends(get_db),
):
    """Updates farm settings (Admin only)."""
    setting = get_or_create_settings(db)

    old_val = {"eggs_per_crate": setting.eggs_per_crate, "currency": setting.currency}

    if payload.eggs_per_crate is not None:
        setting.eggs_per_crate = payload.eggs_per_crate
    if payload.currency is not None:
        setting.currency = payload.currency

    record_audit(
        db=db,
        user_id=current_user.id,
        action="settings.update",
        table_name="settings",
        record_id="1",
        old_value=old_val,
        new_value={"eggs_per_crate": setting.eggs_per_crate, "currency": setting.currency},
    )
    db.commit()
    db.refresh(setting)
    return setting

