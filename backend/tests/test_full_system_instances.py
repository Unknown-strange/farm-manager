"""Comprehensive integration tests for all Egg Book backend system instances."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select

from app.models import EggEvent, Expense, DailyClosing, AuditLog, User
from app.security import get_business_date, hash_password, create_access_token


def test_events_edit_and_void_same_day_vs_past_day(client, staff_headers, admin_headers, staff_user, db_session):
    """Tests event edit & void rules: staff can edit/void today's own events, but not past days; admin can edit/void any day."""
    today = get_business_date()
    yesterday = today - timedelta(days=1)

    # 1. Receive 500 eggs today so stock is positive
    r_rec = client.post("/events", json={"type": "received", "eggs": 500, "note": "Morning harvest"}, headers=staff_headers)
    assert r_rec.status_code == 201

    # 2. Staff records a sale today
    r_sale = client.post("/events", json={"type": "sold", "eggs": 60, "amount": 90.00, "note": "Customer A"}, headers=staff_headers)
    assert r_sale.status_code == 201
    sale_id = r_sale.json()["id"]

    # 3. Staff edits their own sale today -> 200 OK
    r_edit = client.patch(
        f"/events/{sale_id}",
        json={"eggs": 90, "amount": 135.00, "note": "Customer A updated"},
        headers=staff_headers,
    )
    assert r_edit.status_code == 200
    assert r_edit.json()["eggs"] == 90
    assert float(r_edit.json()["amount"]) == 135.00
    assert r_edit.json()["note"] == "Customer A updated"

    # 4. Create a past-day event owned by staff_user
    past_ev = EggEvent(
        user_id=staff_user.id,
        type="received",
        eggs=120,
        note="Yesterday harvest",
        occurred_at=datetime.now(timezone.utc) - timedelta(days=1),
        business_date=yesterday,
    )
    db_session.add(past_ev)
    db_session.commit()
    db_session.refresh(past_ev)

    # 5. Staff attempts to edit past-day event -> 403 SAME_DAY_ONLY
    r_past_staff = client.patch(f"/events/{past_ev.id}", json={"eggs": 150}, headers=staff_headers)
    assert r_past_staff.status_code == 403
    assert r_past_staff.json()["code"] == "SAME_DAY_ONLY"

    # 6. Staff attempts to void past-day event -> 403 SAME_DAY_ONLY
    r_past_void_staff = client.post(f"/events/{past_ev.id}/void", headers=staff_headers)
    assert r_past_void_staff.status_code == 403
    assert r_past_void_staff.json()["code"] == "SAME_DAY_ONLY"

    # 7. Admin edits past-day event -> 200 OK
    r_past_admin = client.patch(f"/events/{past_ev.id}", json={"eggs": 150}, headers=admin_headers)
    assert r_past_admin.status_code == 200
    assert r_past_admin.json()["eggs"] == 150

    # 8. Staff voids today's sale -> 200 OK and excluded from daily book
    r_void = client.post(f"/events/{sale_id}/void", headers=staff_headers)
    assert r_void.status_code == 200
    assert r_void.json()["voided"] is True

    book = client.get(f"/summary?date={today}", headers=admin_headers).json()
    assert book["sold"] == 0
    assert float(book["revenue"]) == 0.0


def test_expenses_undo_window_and_admin_lifecycle(client, staff_headers, admin_headers, db_session):
    """Tests expense creation, staff undo within window, expired undo rejection, and admin edit/void."""
    # 1. Staff creates an expense
    res = client.post(
        "/expenses",
        json={"category": "other", "name": "Egg Trays", "quantity": "10 bundles", "amount": 220.00},
        headers=staff_headers,
    )
    assert res.status_code == 201
    exp_id = res.json()["id"]

    # 2. Staff undoes within the 2-minute window -> 200 OK
    undo_res = client.post(f"/expenses/{exp_id}/undo", headers=staff_headers)
    assert undo_res.status_code == 200

    # 3. Create another expense and backdate created_at by 10 minutes to simulate expired window
    res2 = client.post(
        "/expenses",
        json={"category": "feed", "quantity": "4 bags", "amount": 800.00},
        headers=staff_headers,
    )
    assert res2.status_code == 201
    exp2_id = res2.json()["id"]

    exp2 = db_session.get(Expense, exp2_id)
    exp2.created_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    db_session.commit()

    # 4. Staff attempts undo after window expired -> 400 UNDO_EXPIRED
    expired_res = client.post(f"/expenses/{exp2_id}/undo", headers=staff_headers)
    assert expired_res.status_code == 400
    assert expired_res.json()["code"] == "UNDO_EXPIRED"

    # 5. Admin edits the expense -> 200 OK
    edit_res = client.patch(
        f"/expenses/{exp2_id}",
        json={"amount": 750.00, "quantity": "3.5 bags"},
        headers=admin_headers,
    )
    assert edit_res.status_code == 200
    assert float(edit_res.json()["amount"]) == 750.00
    assert edit_res.json()["quantity"] == "3.5 bags"

    # 6. Admin voids the expense -> 200 OK
    void_res = client.post(f"/expenses/{exp2_id}/void", headers=admin_headers)
    assert void_res.status_code == 200
    assert void_res.json()["voided"] is True


def test_summary_mine_and_multi_day_stock_carryover(client, staff_headers, admin_headers, staff_user, admin_user, db_session):
    """Tests /summary/mine isolation and multi-day opening stock carryover."""
    today = get_business_date()
    yesterday = today - timedelta(days=1)

    # Seed yesterday: 600 received, 100 sold -> closing = 500
    ev_y1 = EggEvent(
        user_id=admin_user.id,
        type="received",
        eggs=600,
        occurred_at=datetime.now(timezone.utc) - timedelta(days=1),
        business_date=yesterday,
    )
    ev_y2 = EggEvent(
        user_id=staff_user.id,
        type="sold",
        eggs=100,
        amount=Decimal("150.00"),
        occurred_at=datetime.now(timezone.utc) - timedelta(days=1),
        business_date=yesterday,
    )
    db_session.add_all([ev_y1, ev_y2])
    db_session.commit()

    # Today: staff sells 60 eggs for 90 GHS, admin sells 30 eggs for 45 GHS
    client.post("/events", json={"type": "sold", "eggs": 60, "amount": 90.00}, headers=staff_headers)
    client.post("/events", json={"type": "sold", "eggs": 30, "amount": 45.00}, headers=admin_headers)

    # Check /summary/mine for staff -> only sees their 1 sale of 90.00
    mine = client.get(f"/summary/mine?date={today}", headers=staff_headers)
    assert mine.status_code == 200
    mine_data = mine.json()
    assert mine_data["sales_count"] == 1
    assert float(mine_data["sales_total"]) == 90.00

    # Check /summary for admin -> opening is 500 (carried over from yesterday!), sold is 90, closing is 410
    book = client.get(f"/summary?date={today}", headers=admin_headers)
    assert book.status_code == 200
    book_data = book.json()
    assert book_data["opening"] == 500
    assert book_data["sold"] == 90
    assert book_data["closing"] == 410
    assert float(book_data["revenue"]) == 135.00
    assert len(book_data["by_worker"]) == 2


def test_closings_reconciliation_and_difference(client, admin_headers, staff_headers):
    """Tests GET and POST /closings/{date}, verifying discrepancy math and locking."""
    today = get_business_date()

    # Receive 300 eggs, sell 60 -> computed closing = 240
    client.post("/events", json={"type": "received", "eggs": 300}, headers=staff_headers)
    client.post("/events", json={"type": "sold", "eggs": 60, "amount": 100.00}, headers=staff_headers)

    # GET /closings/{today} before closing
    get_res = client.get(f"/closings/{today}", headers=admin_headers)
    assert get_res.status_code == 200
    info = get_res.json()
    assert info["closing_eggs"] == 240
    assert info["locked"] is False
    assert info["counted_eggs"] is None

    # POST /closings/{today} with physical count = 235 (short by 5 eggs)
    close_res = client.post(
        f"/closings/{today}",
        json={"counted_eggs": 235},
        headers=admin_headers,
    )
    assert close_res.status_code == 200
    closed = close_res.json()
    assert closed["closing_eggs"] == 240
    assert closed["counted_eggs"] == 235
    assert closed["difference_eggs"] == -5
    assert closed["locked"] is True


def test_users_management_instance(client, admin_headers, staff_headers):
    """Tests full user management lifecycle: list, create, duplicate check, password reset, deactivate."""
    # Staff cannot list or create users
    assert client.get("/users", headers=staff_headers).status_code == 403

    # Admin creates new staff user
    create_res = client.post(
        "/users",
        json={
            "name": "Ama Mensah",
            "username": "AmaWorker",
            "password": "initialpassword",
            "role": "staff",
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    new_user = create_res.json()
    assert new_user["username"] == "amaworker"
    assert new_user["role"] == "staff"
    assert new_user["is_active"] is True
    uid = new_user["id"]

    # Duplicate username -> 409 Conflict
    dup_res = client.post(
        "/users",
        json={
            "name": "Another Ama",
            "username": "amaworker",
            "password": "password123",
            "role": "staff",
        },
        headers=admin_headers,
    )
    assert dup_res.status_code == 409

    # Admin resets user's password
    reset_res = client.post(
        f"/users/{uid}/reset-password",
        json={"new_password": "resetpassword99"},
        headers=admin_headers,
    )
    assert reset_res.status_code == 200

    # New user logs in with reset password
    login_res = client.post(
        "/auth/login",
        json={"username": "amaworker", "password": "resetpassword99"},
    )
    assert login_res.status_code == 200

    # Admin deactivates user
    patch_res = client.patch(
        f"/users/{uid}",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_active"] is False

    # Deactivated user can no longer log in
    blocked_login = client.post(
        "/auth/login",
        json={"username": "amaworker", "password": "resetpassword99"},
    )
    assert blocked_login.status_code == 401


def test_settings_instance(client, admin_headers, staff_headers):
    """Tests GET and PATCH /settings for both staff and admin."""
    # Both staff and admin can read settings
    s_res = client.get("/settings", headers=staff_headers)
    assert s_res.status_code == 200
    assert s_res.json()["eggs_per_crate"] == 30
    assert s_res.json()["currency"] == "GH₵"

    # Staff cannot update settings
    assert client.patch("/settings", json={"eggs_per_crate": 24}, headers=staff_headers).status_code == 403

    # Admin updates settings
    u_res = client.patch(
        "/settings",
        json={"eggs_per_crate": 24, "currency": "GHS"},
        headers=admin_headers,
    )
    assert u_res.status_code == 200
    assert u_res.json()["eggs_per_crate"] == 24
    assert u_res.json()["currency"] == "GHS"


def test_reports_and_csv_export_instance(client, admin_headers, staff_headers):
    """Tests GET /reports and GET /reports/export CSV streaming."""
    today = get_business_date()
    start = today - timedelta(days=2)

    # Record activity today
    client.post("/events", json={"type": "received", "eggs": 180}, headers=staff_headers)
    client.post("/events", json={"type": "sold", "eggs": 30, "amount": 50.00}, headers=staff_headers)
    client.post("/expenses", json={"category": "feed", "amount": 20.00}, headers=staff_headers)

    # Staff cannot access reports
    assert client.get(f"/reports?from={start}&to={today}", headers=staff_headers).status_code == 403

    # Admin fetches JSON report rows
    rep_res = client.get(f"/reports?from={start}&to={today}", headers=admin_headers)
    assert rep_res.status_code == 200
    rows = rep_res.json()
    assert len(rows) == 3
    today_row = rows[-1]
    assert today_row["business_date"] == str(today)
    assert today_row["gotten"] == 180
    assert today_row["sold"] == 30
    assert today_row["closing"] == 150
    assert float(today_row["revenue"]) == 50.00
    assert float(today_row["total_expenses"]) == 20.00
    assert float(today_row["net_margin"]) == 30.00

    # Admin exports CSV
    csv_res = client.get(f"/reports/export?from={start}&to={today}", headers=admin_headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    csv_text = csv_res.text
    assert "Business Date,Opening Eggs,Gotten Eggs,Cracked Eggs,Sold Eggs" in csv_text
    assert str(today) in csv_text


def test_audit_log_recorded_across_mutations(client, admin_headers, staff_headers, db_session):
    """Verifies that mutating operations append immutable records to audit_log."""
    client.post("/events", json={"type": "received", "eggs": 90}, headers=staff_headers)
    client.post("/expenses", json={"category": "feed", "amount": 40.00}, headers=staff_headers)
    client.patch("/settings", json={"eggs_per_crate": 30}, headers=admin_headers)

    logs = db_session.scalars(select(AuditLog)).all()
    actions = {log.action for log in logs}
    assert "event.create" in actions
    assert "expense.create" in actions
    assert "settings.update" in actions

