from decimal import Decimal

from app.models import Expense
from app.security import get_business_date


def test_paid_and_borrowed_feed_and_crates_aggregation(client, admin_headers, db_session):
    today = get_business_date()

    # 1. Create Paid Feed: 300.00
    res = client.post(
        "/expenses",
        json={
            "category": "feed",
            "name": "Grower Mash",
            "quantity": "2 bags",
            "amount": 300.00,
            "is_borrowed": False,
        },
        headers=admin_headers,
    )
    assert res.status_code == 201

    # 2. Create Borrowed Feed: 450.00 (Bought on credit / unpaid)
    res = client.post(
        "/expenses",
        json={
            "category": "feed",
            "name": "Layer Mash",
            "quantity": "3 bags",
            "amount": 450.00,
            "is_borrowed": True,
        },
        headers=admin_headers,
    )
    assert res.status_code == 201
    borrowed_feed_id = res.json()["id"]

    # 3. Create Borrowed Crates: 120.00 (Bought on credit / unpaid)
    res = client.post(
        "/expenses",
        json={
            "category": "crates",
            "name": "Plastic Crates",
            "quantity": "40 crates",
            "amount": 120.00,
            "is_borrowed": True,
        },
        headers=admin_headers,
    )
    assert res.status_code == 201

    # 4. Create Paid Crates: 80.00
    res = client.post(
        "/expenses",
        json={
            "category": "crates",
            "name": "Paper Crates",
            "quantity": "25 crates",
            "amount": 80.00,
            "is_borrowed": False,
        },
        headers=admin_headers,
    )
    assert res.status_code == 201

    # 5. Query daily book
    book_res = client.get(f"/summary?date={today.isoformat()}", headers=admin_headers)
    assert book_res.status_code == 200
    book = book_res.json()

    # Feed total must be 300 + 450 = 750.00
    assert Decimal(str(book["feed"])) == Decimal("750.00")
    assert Decimal(str(book["feed_paid"])) == Decimal("300.00")
    assert Decimal(str(book["feed_borrowed"])) == Decimal("450.00")

    # Crates total must be 120 + 80 = 200.00
    assert Decimal(str(book["crates"])) == Decimal("200.00")
    assert Decimal(str(book["crates_paid"])) == Decimal("80.00")
    assert Decimal(str(book["crates_borrowed"])) == Decimal("120.00")

    # Total expenses incurred = 750 + 200 = 950.00
    assert Decimal(str(book["total_expenses"])) == Decimal("950.00")

    # Cash spent = 300 + 80 = 380.00
    assert Decimal(str(book["cash_spent"])) == Decimal("380.00")

    # Unpaid borrowed expenses = 450 + 120 = 570.00
    assert Decimal(str(book["borrowed_expenses_unpaid"])) == Decimal("570.00")

    # 6. Check period summary (day)
    summary_res = client.get(f"/summary/period?period=day&date={today.isoformat()}", headers=admin_headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert Decimal(str(summary["feed_expenses"])) == Decimal("750.00")
    assert Decimal(str(summary["crates_expenses"])) == Decimal("200.00")
    assert Decimal(str(summary["total_expenses"])) == Decimal("950.00")
    assert Decimal(str(summary["cash_spent"])) == Decimal("380.00")
    assert Decimal(str(summary["borrowed_expenses_unpaid"])) == Decimal("570.00")

    # 7. Mark borrowed feed as paid
    pay_res = client.post(f"/expenses/{borrowed_feed_id}/pay", headers=admin_headers)
    assert pay_res.status_code == 200

    # 8. Re-query daily book: cash spent should now include the 450
    book_after_res = client.get(f"/summary?date={today.isoformat()}", headers=admin_headers)
    book_after = book_after_res.json()
    assert Decimal(str(book_after["feed_paid"])) == Decimal("750.00")
    assert Decimal(str(book_after["feed_borrowed"])) == Decimal("0.00")
    assert Decimal(str(book_after["cash_spent"])) == Decimal("830.00")
    assert Decimal(str(book_after["borrowed_expenses_unpaid"])) == Decimal("120.00")


def test_legacy_borrowed_name_attribution(client, admin_headers, db_session):
    today = get_business_date()

    # Create an expense with legacy category="borrowed" and name="Feed concentrate"
    exp = Expense(
        category="borrowed",
        name="Feed concentrate",
        quantity="1 bag",
        amount=Decimal("200.00"),
        is_borrowed=True,
        paid=False,
        business_date=today,
        created_by=1,
    )
    db_session.add(exp)
    db_session.commit()

    # Query summary
    summary_res = client.get(f"/summary/period?period=day&date={today.isoformat()}", headers=admin_headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()

    # It must be attributed to feed_expenses!
    assert Decimal(str(summary["feed_expenses"])) >= Decimal("200.00")
    assert Decimal(str(summary["feed_borrowed"])) >= Decimal("200.00")
