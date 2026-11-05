"""Tests for egg events, idempotency, negative stock protection, and daily book math."""

from datetime import date
from app.models import DailyClosing, User
from app.security import hash_password, create_access_token, get_business_date


def test_egg_receipt_and_stock_flow(client, staff_headers):
    # 1. Receive 300 eggs
    res = client.post(
        "/events",
        json={"type": "received", "eggs": 300},
        headers=staff_headers,
    )
    assert res.status_code == 201
    event = res.json()
    assert event["eggs"] == 300
    assert event["type"] == "received"


def test_idempotency_key_deduplication(client, staff_headers):
    key = "idem-key-test-123"
    headers = {**staff_headers, "Idempotency-Key": key}

    # First receipt
    res1 = client.post("/events", json={"type": "received", "eggs": 100}, headers=headers)
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    # Duplicate request with same key
    res2 = client.post("/events", json={"type": "received", "eggs": 100}, headers=headers)
    assert res2.status_code == 201 or res2.status_code == 200
    id2 = res2.json()["id"]

    # Must return identical record, not duplicate
    assert id1 == id2


def test_negative_stock_rejection(client, staff_headers):
    # Attempting to sell 500 eggs when there are 0 or fewer available
    res = client.post(
        "/events",
        json={"type": "sold", "eggs": 500, "amount": 600.00},
        headers=staff_headers,
    )
    assert res.status_code == 400
    assert res.json()["code"] == "STOCK_NEGATIVE"


def test_locked_day_rejects_writes(client, staff_headers, admin_headers, db_session):
    from app.security import get_business_date
    today = get_business_date()

    # Admin closes/locks today
    client.post(
        f"/closings/{today}",
        json={"counted_eggs": 0},
        headers=admin_headers,
    )

    # Subsequent event creation on locked day must be rejected with 409
    res = client.post(
        "/events",
        json={"type": "received", "eggs": 50},
        headers=staff_headers,
    )
    assert res.status_code == 409
    assert res.json()["code"] == "DAY_LOCKED"


def test_staff_events_scoping(client, staff_headers, db_session):
    # Create another staff user
    other_staff = User(
        name="Other Staff",
        username="staff2",
        password_hash=hash_password("staffpass"),
        role="staff",
        is_active=True,
    )
    db_session.add(other_staff)
    db_session.commit()
    other_token = create_access_token(user_id=other_staff.id, role="staff")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # staff1 records receipt
    client.post("/events", json={"type": "received", "eggs": 120}, headers=staff_headers)

    # staff2 records receipt
    client.post("/events", json={"type": "received", "eggs": 80}, headers=other_headers)

    # staff1 lists events -> sees only their own
    res1 = client.get("/events", headers=staff_headers)
    assert res1.status_code == 200
    for ev in res1.json():
        assert ev["user_id"] != other_staff.id


def test_daily_book_math(client, admin_headers):
    from app.security import get_business_date
    today = get_business_date()

    # 1. Receive 1000 eggs
    client.post("/events", json={"type": "received", "eggs": 1000}, headers=admin_headers)

    # 2. Crack 10 eggs
    client.post("/events", json={"type": "cracked", "eggs": 10}, headers=admin_headers)

    # 3. Sell 300 eggs for 450 GHS
    client.post("/events", json={"type": "sold", "eggs": 300, "amount": 450.00}, headers=admin_headers)

    # 4. Expense: 100 GHS feed, 50 GHS other
    client.post("/expenses", json={"category": "feed", "name": "Feed", "amount": 100.00}, headers=admin_headers)
    client.post("/expenses", json={"category": "other", "name": "Bags", "amount": 50.00}, headers=admin_headers)

    # 5. Fetch Daily Book
    res = client.get(f"/summary?date={today}", headers=admin_headers)
    assert res.status_code == 200
    book = res.json()

    assert book["gotten"] == 1000
    assert book["cracked"] == 10
    assert book["sold"] == 300
    assert book["closing"] == 1000 - 10 - 300  # 690
    assert float(book["revenue"]) == 450.00
    assert float(book["feed"]) == 100.00
    assert float(book["other"]) == 50.00
    assert float(book["total_expenses"]) == 150.00
    assert float(book["net_margin"]) == 450.00 - 150.00  # 300.00


def test_sale_crates_and_price_auto_multiplication(client, staff_headers):
    # 1. Staff receives stock so stock is available to sell
    client.post("/events", json={"type": "received", "eggs": 500}, headers=staff_headers)

    # 2. Staff records sale providing only crates and price_per_crate (no amount, no eggs)
    res = client.post(
        "/events",
        json={
            "type": "sold",
            "crates": 10,
            "price_per_crate": 45.50,
            "note": "Wholesale customer",
        },
        headers=staff_headers,
    )
    assert res.status_code == 201
    data = res.json()
    # Eggs should default to 10 * 30 = 300 eggs
    assert data["eggs"] == 300
    # Amount should be multiplied: 10 * 45.50 = 455.00
    assert float(data["amount"]) == 455.00
    assert data["note"] == "Wholesale customer"

    # 3. Staff records another sale with crates and price_per_crate
    res2 = client.post(
        "/events",
        json={
            "type": "sold",
            "crates": 4,
            "price_per_crate": 40.00,
        },
        headers=staff_headers,
    )
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["eggs"] == 120
    assert float(data2["amount"]) == 160.00


def test_sale_missing_amount_and_price_rejected(client, staff_headers):
    # Missing amount AND missing (crates + price_per_crate)
    res = client.post(
        "/events",
        json={"type": "sold", "eggs": 30},
        headers=staff_headers,
    )
    assert res.status_code == 422


def test_single_eggs_borrowed_sale_admin_pay_and_period_summaries(client, staff_headers, admin_headers):
    from app.security import get_business_date
    today = get_business_date()

    # 1. Receive 500 eggs
    client.post("/events", json={"type": "received", "eggs": 500}, headers=staff_headers)

    # 2. Paid sale by crates: 5 crates @ 40.00 = 200.00 (150 eggs)
    r_paid = client.post(
        "/events",
        json={"type": "sold", "crates": 5, "price_per_crate": 40.00, "is_borrowed": False},
        headers=staff_headers,
    )
    assert r_paid.status_code == 201
    assert r_paid.json()["eggs"] == 150
    assert float(r_paid.json()["amount"]) == 200.00
    assert r_paid.json()["is_borrowed"] is False
    assert r_paid.json()["paid"] is True

    # 3. Borrowed (unpaid) sale by single eggs: 25 eggs @ 2.00 each = 50.00
    r_borrowed = client.post(
        "/events",
        json={
            "type": "sold",
            "eggs": 25,
            "price_per_egg": 2.00,
            "is_borrowed": True,
            "note": "Auntie Ama credit",
        },
        headers=staff_headers,
    )
    assert r_borrowed.status_code == 201
    borrowed_data = r_borrowed.json()
    borrowed_id = borrowed_data["id"]
    assert borrowed_data["eggs"] == 25
    assert float(borrowed_data["amount"]) == 50.00
    assert borrowed_data["is_borrowed"] is True
    assert borrowed_data["paid"] is False

    # 4. Record an expense of 80.00
    client.post(
        "/expenses",
        json={"category": "feed", "name": "Feed", "amount": 80.00},
        headers=staff_headers,
    )

    # 5. Check Daily Book & Period Summary (week, month, year) BEFORE borrowed is paid
    for p in ("day", "week", "month", "year"):
        p_res = client.get(f"/summary/period?period={p}&date={today}", headers=admin_headers)
        assert p_res.status_code == 200
        ps = p_res.json()
        assert ps["gotten_eggs"] == 500
        assert ps["sold_eggs"] == 175
        assert ps["closing_eggs"] == 325
        # Present money gained is 200.00, borrowed unpaid is 50.00, total sales is 250.00
        assert float(ps["cash_revenue"]) == 200.00
        assert float(ps["borrowed_unpaid_amount"]) == 50.00
        assert float(ps["total_sales_amount"]) == 250.00
        assert float(ps["total_expenses"]) == 80.00
        # Money left present now = 200 - 80 = 120.00
        assert float(ps["money_left_present"]) == 120.00
        # Money to be had if borrowed is paid = 250 - 80 = 170.00
        assert float(ps["money_left_with_borrowed"]) == 170.00
        assert len(ps["borrowed_sales"]) == 1
        assert ps["borrowed_sales"][0]["id"] == borrowed_id
        assert ps["borrowed_sales"][0]["paid"] is False

    # 6. Staff cannot mark borrowed sale as paid -> 403 FORBIDDEN
    staff_pay = client.post(f"/events/{borrowed_id}/pay", headers=staff_headers)
    assert staff_pay.status_code == 403

    # 7. Admin marks borrowed sale as paid -> 200 OK
    admin_pay = client.post(f"/events/{borrowed_id}/pay", headers=admin_headers)
    assert admin_pay.status_code == 200
    assert admin_pay.json()["paid"] is True
    assert admin_pay.json()["is_borrowed"] is True

    # 8. Verify Period Summary AFTER borrowed sale is paid by Admin
    ps_after = client.get(f"/summary/period?period=week&date={today}", headers=admin_headers).json()
    assert float(ps_after["cash_revenue"]) == 250.00
    assert float(ps_after["borrowed_unpaid_amount"]) == 0.00
    assert float(ps_after["borrowed_paid_amount"]) == 50.00
    assert float(ps_after["money_left_present"]) == 170.00
    assert float(ps_after["money_left_with_borrowed"]) == 170.00


def test_soft_delete_staff_preserves_all_historical_data(client, admin_headers):
    """Verifies that soft-deleting a staff user revokes their access immediately while preserving 100% of their recorded data."""
    today = get_business_date().isoformat()

    # 1. Admin creates a new staff user
    create_res = client.post(
        "/users",
        json={
            "name": "Abena Mensah",
            "username": "abena_staff",
            "password": "secret123",
            "role": "staff",
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    abena = create_res.json()
    abena_id = abena["id"]
    assert abena["is_deleted"] is False
    assert abena["is_active"] is True

    # 2. Abena logs in and records received eggs, a sale, and an expense
    login_res = client.post("/auth/login", json={"username": "abena_staff", "password": "secret123"})
    assert login_res.status_code == 200
    abena_token = login_res.json()["access_token"]
    abena_headers = {"Authorization": f"Bearer {abena_token}"}

    r_rec = client.post("/events", json={"type": "received", "eggs": 120}, headers=abena_headers)
    assert r_rec.status_code == 201

    r_sale = client.post(
        "/events",
        json={"type": "sold", "crates": 2, "price_per_crate": "45.00", "note": "Abena customer"},
        headers=abena_headers,
    )
    assert r_sale.status_code == 201
    sale_id = r_sale.json()["id"]

    r_exp = client.post(
        "/expenses",
        json={"category": "feed", "name": "Layer Mash", "amount": "25.00"},
        headers=abena_headers,
    )
    assert r_exp.status_code == 201
    expense_id = r_exp.json()["id"]

    # 3. Admin soft-deletes Abena's user account
    del_res = client.delete(f"/users/{abena_id}", headers=admin_headers)
    assert del_res.status_code == 200
    deleted_user = del_res.json()
    assert deleted_user["is_deleted"] is True
    assert deleted_user["is_active"] is False
    assert deleted_user["deleted_at"] is not None

    # 4. Abena immediately loses access (both existing token and new login attempts fail)
    me_res = client.get("/auth/me", headers=abena_headers)
    assert me_res.status_code == 401

    relogin_res = client.post("/auth/login", json={"username": "abena_staff", "password": "secret123"})
    assert relogin_res.status_code == 401

    # 5. All of Abena's historical data (events, expenses, summaries, worker breakdown) is preserved!
    events_list = client.get(f"/events?user_id={abena_id}", headers=admin_headers).json()
    assert len(events_list) == 2
    assert all(ev["user_name"] == "Abena Mensah" for ev in events_list)

    expenses_list = client.get(f"/expenses?user_id={abena_id}", headers=admin_headers).json()
    assert len(expenses_list) == 1
    assert expenses_list[0]["created_by_name"] == "Abena Mensah"
    assert float(expenses_list[0]["amount"]) == 25.00

    daily_book = client.get(f"/summary?date={today}", headers=admin_headers).json()
    assert daily_book["gotten"] >= 120
    assert daily_book["sold"] >= 60
    assert float(daily_book["revenue"]) >= 90.00
    abena_worker_row = next((w for w in daily_book["by_worker"] if w["user_id"] == abena_id), None)
    assert abena_worker_row is not None
    assert abena_worker_row["user_name"] == "Abena Mensah"
    assert abena_worker_row["sold_eggs"] == 60
    assert float(abena_worker_row["sold_amount"]) == 90.00

    # 6. Verify DELETE on events and expenses also performs soft-delete (voided=True) rather than hard delete
    del_ev = client.delete(f"/events/{sale_id}", headers=admin_headers)
    assert del_ev.status_code == 200
    assert del_ev.json()["voided"] is True

    del_exp = client.delete(f"/expenses/{expense_id}", headers=admin_headers)
    assert del_exp.status_code == 200
    assert del_exp.json()["voided"] is True


def test_beginning_entry_balances_and_historical_borrowed_flow(client, admin_headers):
    """Tests setting beginning eggs & manual money, logging old borrowed sales, and toggling paid/unpaid status."""
    today = get_business_date().isoformat()

    # 1. Admin sets beginning eggs (300 eggs = 10 crates) and exact present money (GH₵ 1,500.00)
    patch_res = client.patch(
        "/settings",
        json={"beginning_eggs": 300, "target_present_money": "1500.00"},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["beginning_eggs"] == 300

    # Verify all-time period summary reflects 300 eggs and 1500.00 present money
    ps1 = client.get(f"/summary/period?period=all&date={today}", headers=admin_headers).json()
    assert ps1["closing_eggs"] == 300
    assert float(ps1["money_left_present"]) == 1500.00

    # 2. Admin logs an old borrowed sale (90 eggs, GH₵ 135.00 owed, exclude_from_stock=True)
    old_borrowed = client.post(
        "/events",
        json={
            "type": "sold",
            "eggs": 90,
            "amount": "135.00",
            "is_borrowed": True,
            "exclude_from_stock": True,
            "business_date": "2026-01-15",
            "note": "Old debtor Kwesi",
        },
        headers=admin_headers,
    )
    assert old_borrowed.status_code == 201
    b_id = old_borrowed.json()["id"]
    assert old_borrowed.json()["is_borrowed"] is True
    assert old_borrowed.json()["paid"] is False
    assert old_borrowed.json()["exclude_from_stock"] is True

    # Verify stock is still 300 (since exclude_from_stock=True), present money is 1500.00, and projected money is 1635.00
    ps2 = client.get(f"/summary/period?period=all&date={today}", headers=admin_headers).json()
    assert ps2["closing_eggs"] == 300
    assert float(ps2["money_left_present"]) == 1500.00
    assert float(ps2["borrowed_unpaid_amount"]) == 135.00
    assert float(ps2["money_left_with_borrowed"]) == 1635.00

    # Also verify Summary page default period=week shows the unpaid borrowed amount (135.00) and projected money (1635.00)
    ps_week = client.get(f"/summary/period?period=week&date={today}", headers=admin_headers).json()
    assert float(ps_week["money_left_present"]) == 1500.00
    assert float(ps_week["borrowed_unpaid_amount"]) == 135.00
    assert float(ps_week["money_left_with_borrowed"]) == 1635.00

    # 3. Admin marks the borrowed entry as Paid -> present money increases to 1635.00
    pay_res = client.post(f"/events/{b_id}/pay", headers=admin_headers)
    assert pay_res.status_code == 200
    assert pay_res.json()["paid"] is True

    ps3 = client.get(f"/summary/period?period=all&date={today}", headers=admin_headers).json()
    assert float(ps3["money_left_present"]) == 1635.00
    assert float(ps3["borrowed_unpaid_amount"]) == 0.00

    # 4. Admin can revert status back to Unpaid if needed -> present money returns to 1500.00
    unpay_res = client.post(f"/events/{b_id}/unpay", headers=admin_headers)
    assert unpay_res.status_code == 200
    assert unpay_res.json()["paid"] is False

    ps4 = client.get(f"/summary/period?period=all&date={today}", headers=admin_headers).json()
    assert float(ps4["money_left_present"]) == 1500.00
    assert float(ps4["borrowed_unpaid_amount"]) == 135.00


def test_reconciliation_overrides_carry_forward_and_unlock(client, admin_headers, staff_headers):
    """Tests that locking a day with physical count and actuals overrides daily book,
    anchors subsequent opening stock, adjusts Money We Have, and correctly rolls back on unlock."""
    d1 = "2026-03-01"
    d2 = "2026-03-02"

    # Reset beginning settings
    client.patch(
        "/settings",
        json={"beginning_eggs": 100, "target_present_money": "500.00"},
        headers=admin_headers,
    )

    # Log entries on d1 (using admin_headers to set specific business_date)
    client.post("/events", json={"type": "received", "eggs": 200, "business_date": d1}, headers=admin_headers)
    client.post(
        "/events",
        json={"type": "sold", "eggs": 50, "amount": "75.00", "is_borrowed": False, "business_date": d1},
        headers=admin_headers,
    )
    client.post(
        "/expenses",
        json={"category": "feed", "name": "Feed bag", "amount": "20.00", "business_date": d1},
        headers=admin_headers,
    )

    # Initial book for d1
    b1_before = client.get(f"/summary?date={d1}", headers=admin_headers).json()
    assert b1_before["opening"] == 100
    assert b1_before["closing"] == 250
    assert float(b1_before["revenue"]) == 75.00
    assert float(b1_before["total_expenses"]) == 20.00
    assert b1_before["locked"] is False
    assert b1_before["reconciled"] is False

    # Day 2 opening before reconciliation
    b2_before = client.get(f"/summary?date={d2}", headers=admin_headers).json()
    assert b2_before["opening"] == 250

    # Lock d1 with actual overrides: counted 240, actual revenue 100.00, actual expenses 30.00, actual sold 55
    lock_res = client.post(
        f"/closings/{d1}",
        json={
            "counted_eggs": 240,
            "actual_revenue": "100.00",
            "actual_expenses": "30.00",
            "actual_sold_eggs": 55,
        },
        headers=admin_headers,
    )
    assert lock_res.status_code == 200
    closing_data = lock_res.json()
    assert closing_data["locked"] is True
    assert closing_data["counted_eggs"] == 240
    assert float(closing_data["actual_revenue"]) == 100.00
    assert float(closing_data["actual_expenses"]) == 30.00
    assert closing_data["actual_sold_eggs"] == 55
    assert closing_data["difference_eggs"] == -10

    # Verify d1 daily book now reflects actuals and shows reconciled flag
    b1_after = client.get(f"/summary?date={d1}", headers=admin_headers).json()
    assert b1_after["closing"] == 240
    assert float(b1_after["revenue"]) == 100.00
    assert float(b1_after["total_expenses"]) == 30.00
    assert b1_after["sold"] == 55
    assert b1_after["locked"] is True
    assert b1_after["reconciled"] is True
    assert float(b1_after["recorded_revenue"]) == 75.00
    assert float(b1_after["recorded_expenses"]) == 20.00
    assert b1_after["recorded_sold"] == 50
    assert b1_after["computed_closing"] == 250

    # Verify d2 opening is now anchored at 240
    b2_after = client.get(f"/summary?date={d2}", headers=admin_headers).json()
    assert b2_after["opening"] == 240

    # Verify all-time Money We Have (Present) reflects overrides:
    # 500 (beginning) + 100 (actual rev) - 30 (actual exp) = 570.00
    ps_all = client.get(f"/summary/period?period=all&date={d2}", headers=admin_headers).json()
    assert float(ps_all["money_left_present"]) == 570.00
    assert ps_all["closing_eggs"] == 240

    # Unlock d1
    unlock_res = client.post(f"/closings/{d1}/unlock", headers=admin_headers)
    assert unlock_res.status_code == 200
    assert unlock_res.json()["locked"] is False

    # Verify d1 reverts to recorded values
    b1_unlocked = client.get(f"/summary?date={d1}", headers=admin_headers).json()
    assert b1_unlocked["locked"] is False
    assert b1_unlocked["reconciled"] is False
    assert b1_unlocked["closing"] == 250
    assert float(b1_unlocked["revenue"]) == 75.00
    assert float(b1_unlocked["total_expenses"]) == 20.00

    # Verify d2 opening stock reverts to 250
    b2_unlocked = client.get(f"/summary?date={d2}", headers=admin_headers).json()
    assert b2_unlocked["opening"] == 250

    # Verify Money We Have reverts: 500 + 75 - 20 = 555.00
    ps_all_unlocked = client.get(f"/summary/period?period=all&date={d2}", headers=admin_headers).json()
    assert float(ps_all_unlocked["money_left_present"]) == 555.00


def test_previous_day_32_crates_today_16_received_5_sold_equals_43_crates(client, admin_headers, staff_headers):
    """Verifies that 32 crates opening + 16 crates received - 5 crates sold = 43 crates remaining."""
    from datetime import timedelta
    d1 = date(2026, 7, 1)
    d2 = d1 + timedelta(days=1)

    # Day 1: locked storeroom count of 32 crates (32 * 30 = 960 eggs)
    lock_res = client.post(
        f"/closings/{d1}",
        json={"counted_eggs": 960},
        headers=admin_headers,
    )
    assert lock_res.status_code == 200

    # Day 2: receive 16 crates (16 * 30 = 480 eggs)
    rec_res = client.post(
        "/events",
        json={"type": "received", "eggs": 480, "business_date": str(d2)},
        headers=admin_headers,
    )
    assert rec_res.status_code == 201

    # Day 2: sell 5 crates (5 * 30 = 150 eggs)
    sale_res = client.post(
        "/events",
        json={"type": "sold", "eggs": 150, "crates": 5, "price_per_crate": 40.00, "business_date": str(d2)},
        headers=admin_headers,
    )
    assert sale_res.status_code == 201

    # Check Day 2 daily book
    book_res = client.get(f"/summary?date={d2}", headers=admin_headers)
    assert book_res.status_code == 200
    book = book_res.json()

    # Opening must be 960 eggs (32 crates)
    assert book["opening"] == 960
    assert book["opening_anchor_date"] == str(d1)
    assert book["opening_anchor_eggs"] == 960

    # Gotten = 480 (16 crates), Sold = 150 (5 crates)
    assert book["gotten"] == 480
    assert book["sold"] == 150

    # Closing must be 960 + 480 - 150 = 1290 eggs = 43 crates
    assert book["closing"] == 1290
    assert book["closing"] // 30 == 43
    assert book["closing"] % 30 == 0







