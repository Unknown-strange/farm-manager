"""Settings router: farm configurations such as eggs per crate and currency."""

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DailyClosing, EggEvent, Setting, User
from app.permissions import SETTINGS_MANAGE
from app.schemas import SettingsResponse, SettingsUpdate
from app.security import (
    get_business_date,
    get_current_user,
    require_permission,
)
from app.services.audit import record_audit
from app.services.book import (
    _net_egg_change_case,
    calculate_all_time_net_cash_flow,
    calculate_all_time_net_egg_change,
)

router = APIRouter(prefix="/settings", tags=["settings"])


def get_or_create_settings(db: Session) -> Setting:
    setting = db.get(Setting, 1)
    if not setting:
        setting = Setting(
            id=1,
            eggs_per_crate=30,
            currency="GH₵",
            beginning_eggs=0,
            beginning_money=Decimal("0.00"),
        )
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
    """Updates farm settings and manual/beginning egg & money balances (Admin only)."""
    setting = get_or_create_settings(db)

    old_val = {
        "eggs_per_crate": setting.eggs_per_crate,
        "currency": setting.currency,
        "beginning_eggs": setting.beginning_eggs,
        "beginning_money": str(setting.beginning_money),
    }

    if payload.eggs_per_crate is not None:
        setting.eggs_per_crate = payload.eggs_per_crate
    if payload.currency is not None:
        setting.currency = payload.currency
    if payload.beginning_eggs is not None:
        setting.beginning_eggs = payload.beginning_eggs
        if payload.target_opening_eggs is None and payload.target_present_eggs is None:
            today_closing = db.get(DailyClosing, get_business_date())
            if today_closing is not None and not today_closing.locked:
                today_closing.opening_override = None

    if payload.target_opening_eggs is not None:
        ref_date = payload.target_opening_date or get_business_date()
        closing = db.get(DailyClosing, ref_date)
        if not closing:
            closing = DailyClosing(business_date=ref_date)
            db.add(closing)
        closing.opening_override = payload.target_opening_eggs

        prior_events = db.scalar(
            select(func.count()).where(
                EggEvent.business_date < ref_date,
                EggEvent.voided.is_(False),
                EggEvent.exclude_from_stock.is_(False),
            )
        ) or 0
        if prior_events == 0:
            setting.beginning_eggs = payload.target_opening_eggs

    if payload.target_present_eggs is not None:
        ref_date = payload.target_opening_date or get_business_date()
        day_net = int(
            db.scalar(
                select(func.coalesce(func.sum(_net_egg_change_case()), 0)).where(
                    EggEvent.business_date == ref_date,
                    EggEvent.voided.is_(False),
                    EggEvent.exclude_from_stock.is_(False),
                )
            )
            or 0
        )
        needed_opening = payload.target_present_eggs - day_net
        closing = db.get(DailyClosing, ref_date)
        if not closing:
            closing = DailyClosing(business_date=ref_date)
            db.add(closing)
        closing.opening_override = needed_opening
        if closing.locked and closing.counted_eggs is not None:
            closing.counted_eggs = payload.target_present_eggs

        all_net = calculate_all_time_net_egg_change(db, up_to_date=ref_date)
        setting.beginning_eggs = max(0, payload.target_present_eggs - all_net)

    if payload.beginning_money is not None:
        setting.beginning_money = round(Decimal(payload.beginning_money), 2)
    if payload.target_present_money is not None:
        net_flow = calculate_all_time_net_cash_flow(db)
        setting.beginning_money = round(Decimal(payload.target_present_money) - net_flow, 2)

    record_audit(
        db=db,
        user_id=current_user.id,
        action="settings.update",
        table_name="settings",
        record_id="1",
        old_value=old_val,
        new_value={
            "eggs_per_crate": setting.eggs_per_crate,
            "currency": setting.currency,
            "beginning_eggs": setting.beginning_eggs,
            "beginning_money": str(setting.beginning_money),
        },
    )
    db.commit()
    db.refresh(setting)
    return setting

