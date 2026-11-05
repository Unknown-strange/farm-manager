"""Tests for authentication and role-based permissions."""

from app.config import Settings
import pytest


def test_env_wildcard_permission():
    s = Settings(ADMIN_PERMISSIONS="*", STAFF_PERMISSIONS="events:create")
    assert "*" in s.role_permissions["admin"]
    assert "events:create" in s.role_permissions["staff"]


def test_env_unknown_permission_fails_startup():
    s = Settings(STAFF_PERMISSIONS="events:create,non_existent_perm")
    with pytest.raises(ValueError, match="Invalid permission 'non_existent_perm'"):
        s.validate_permissions()


def test_login_success(client, staff_user):
    res = client.post("/auth/login", json={"username": "staff1", "password": "staffpass"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, staff_user):
    res = client.post("/auth/login", json={"username": "staff1", "password": "wrongpassword"})
    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_FAILED"


def test_change_password_success(client, staff_user, staff_headers):
    # 1. Attempt change with wrong current password -> 400
    res_fail = client.post(
        "/auth/change-password",
        json={"current_password": "wrongpass", "new_password": "brandnewpassword"},
        headers=staff_headers,
    )
    assert res_fail.status_code == 400
    assert res_fail.json()["code"] == "INVALID_CURRENT_PASSWORD"

    # 2. Change password with correct current password -> 200
    res_ok = client.post(
        "/auth/change-password",
        json={"current_password": "staffpass", "new_password": "brandnewpassword"},
        headers=staff_headers,
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["detail"] == "Password successfully updated"

    # 3. Old password now fails login
    old_login = client.post("/auth/login", json={"username": "staff1", "password": "staffpass"})
    assert old_login.status_code == 401

    # 4. New password succeeds login
    new_login = client.post("/auth/login", json={"username": "staff1", "password": "brandnewpassword"})
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()



def test_deactivated_user_token_blocked(client, staff_user, db_session):
    from app.security import create_access_token
    token = create_access_token(user_id=staff_user.id, role=staff_user.role)
    headers = {"Authorization": f"Bearer {token}"}

    # Verify active works
    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 200

    # Deactivate user
    staff_user.is_active = False
    db_session.commit()

    # Immediate rejection on next request
    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 401


def test_staff_cannot_read_expenses(client, staff_headers):
    # Staff can create expense
    create_res = client.post(
        "/expenses",
        json={"category": "feed", "name": "Feed", "amount": 150.00},
        headers=staff_headers,
    )
    assert create_res.status_code == 201
    assert "undo_until" in create_res.json()

    # Staff forbidden from reading expenses list
    list_res = client.get("/expenses", headers=staff_headers)
    assert list_res.status_code == 403


def test_admin_can_read_expenses(client, admin_headers, staff_headers):
    # Create an expense
    client.post(
        "/expenses",
        json={"category": "other", "name": "Disinfectant", "amount": 45.00},
        headers=staff_headers,
    )

    # Admin reads expenses list
    res = client.get("/expenses", headers=admin_headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    assert items[0]["name"] == "Disinfectant"


def test_health_check_endpoints(client):
    for endpoint in ("/health", "/api/health", "/healthz"):
        res = client.get(endpoint)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["app"] == "Egg Book API"
        assert data["database"] == "connected"
        assert "timestamp" in data


def test_granular_staff_permissions_and_daily_ledger_attribution(client, admin_headers):
    # 1. Admin creates a view-only staff member
    auditor_res = client.post(
        "/users",
        json={
            "name": "Kofi Auditor",
            "username": "kofi_auditor",
            "password": "auditorpass",
            "role": "staff",
            "permissions": ["events:read_all", "expenses:read", "summary:read_all", "reports:read"],
        },
        headers=admin_headers,
    )
    assert auditor_res.status_code == 201
    auditor_data = auditor_res.json()
    assert auditor_data["username"] == "kofi_auditor"
    assert "events:read_all" in auditor_data["permissions"]
    assert "events:create" not in auditor_data["permissions"]
    auditor_id = auditor_data["id"]

    # 2. Login as Kofi Auditor
    login_res = client.post("/auth/login", json={"username": "kofi_auditor", "password": "auditorpass"})
    assert login_res.status_code == 200
    auditor_token = login_res.json()["access_token"]
    auditor_headers = {"Authorization": f"Bearer {auditor_token}"}

    # Verify /auth/me returns Kofi's granted permissions
    me_res = client.get("/auth/me", headers=auditor_headers)
    assert me_res.status_code == 200
    assert "events:read_all" in me_res.json()["permissions"]
    assert "events:create" not in me_res.json()["permissions"]

    # View-only can read reports and expenses
    assert client.get("/reports", headers=auditor_headers).status_code == 200
    assert client.get("/expenses", headers=auditor_headers).status_code == 200

    # View-only CANNOT create entries or expenses (403 Forbidden)
    post_event = client.post("/events", json={"type": "sold", "crates": 1, "price_per_crate": "40.00"}, headers=auditor_headers)
    assert post_event.status_code == 403
    post_exp = client.post("/expenses", json={"category": "feed", "name": "Feed", "amount": 50.00}, headers=auditor_headers)
    assert post_exp.status_code == 403

    # 3. Create a staff member with sales permissions and record entries
    worker_res = client.post(
        "/users",
        json={
            "name": "Esi Seller",
            "username": "esi_seller",
            "password": "sellerpass",
            "role": "staff",
            "permissions": ["events:create", "events:read_own", "summary:read_own"],
        },
        headers=admin_headers,
    )
    assert worker_res.status_code == 201
    worker_token = client.post("/auth/login", json={"username": "esi_seller", "password": "sellerpass"}).json()["access_token"]
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    # First receive eggs as admin so stock exists
    client.post("/events", json={"type": "received", "eggs": 60}, headers=admin_headers)

    # Esi records a sale
    sale_res = client.post("/events", json={"type": "sold", "crates": 1, "price_per_crate": "42.00"}, headers=worker_headers)
    assert sale_res.status_code == 201

    # 4. Check Daily Ledger Reports attribution: 'Esi Seller' must be listed in logged_by
    report_res = client.get("/reports", headers=admin_headers)
    assert report_res.status_code == 200
    report_rows = report_res.json()
    assert len(report_rows) > 0
    today_row = report_rows[-1]
    assert "Esi Seller" in today_row["logged_by"]

    # Also check CSV export
    csv_res = client.get("/reports/export", headers=admin_headers)
    assert csv_res.status_code == 200
    assert "Logged By Staff" in csv_res.text
    assert "Esi Seller" in csv_res.text

    # 5. Admin grants events:create to Kofi Auditor via update_user
    patch_res = client.patch(
        f"/users/{auditor_id}",
        json={"permissions": ["events:read_all", "expenses:read", "summary:read_all", "reports:read", "events:create"]},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert "events:create" in patch_res.json()["permissions"]

    # Now Kofi can create an event!
    post_event_ok = client.post("/events", json={"type": "received", "eggs": 30}, headers=auditor_headers)
    assert post_event_ok.status_code == 201



