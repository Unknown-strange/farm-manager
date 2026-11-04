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


