# Backend & Database Build Plan — Egg Book

## Overview
This document specifies the step-by-step implementation plan for the **Egg Book** backend (FastAPI) and PostgreSQL database, matching [BACKEND_FLOW.md](../BACKEND_FLOW.md) and [DATABASE_FLOW.md](../DATABASE_FLOW.md).

---

## 1. Stack & Foundation
- **Framework:** FastAPI
- **ORM & Migrations:** SQLAlchemy 2.x, Alembic
- **Driver:** `psycopg[binary]` (`postgresql+psycopg://`)
- **Validation:** Pydantic v2 + `pydantic-settings`
- **Security:** PyJWT, bcrypt/passlib
- **Testing:** Pytest, HTTPX

---

## 2. Implementation Phases

### Phase 1: Core Configuration & Database Setup
- `app/config.py`: Loads `.env`, parses role-permission mappings, checks for invalid permissions on startup.
- `app/permissions.py`: All 13 system permissions + wildcard `*` resolution.
- `app/database.py`: SQLAlchemy engine, `SessionLocal`, and `get_db` FastAPI dependency.

### Phase 2: Models & Migrations
- `app/models.py`:
  - `User`: id, name, lowercase unique username, password hash, role (`admin` | `staff`), is_active.
  - `EggEvent`: id, user_id (FK), type (`received` | `sold` | `cracked`), eggs (> 0), amount, business_date, voided, idempotency_key.
  - `Expense`: id, category (`feed` | `other`), name, quantity, amount, business_date, created_by (FK), voided.
  - `DailyClosing`: business_date (PK), opening_override, closing_eggs, counted_eggs, locked, closed_by.
  - `Setting`: id=1, eggs_per_crate (default 30), currency (default `GH₵`).
  - `AuditLog`: id, user_id, action, table_name, record_id, old_value (JSONB), new_value (JSONB), timestamp.
- Alembic configuration & initial migration.

### Phase 3: Security & Authorization Engine
- `app/security.py`:
  - Bcrypt password hashing & verification.
  - JWT creation & decoding (`sub`, `role`, `exp`).
  - `get_current_user`: extracts token, checks active status in DB (instant revocation).
  - `require_permission(*needed)` route dependency.
  - `scope_events(query, user)` ownership filter.
  - Same-day edit rule validation.

### Phase 4: Services Layer
- `app/services/book.py`:
  - Daily book calculations (opening stock carry-over, gotten, cracked, sold, revenue, expenses, net margin).
  - Negative stock prevention check.
- `app/services/audit.py`:
  - Centralized audit logging helper recording before/after JSON states.

### Phase 5: Pydantic Schemas & API Routers
- `app/schemas.py`: Input/output schemas with strict omission of server-controlled fields (`business_date`, `user_id`, `voided`).
- Routers:
  - `routers/auth.py`: `/auth/login`, `/auth/me`.
  - `routers/events.py`: `/events` CRUD + void + idempotency.
  - `routers/expenses.py`: `/expenses` create, undo (10-min window), admin list/void.
  - `routers/summary.py`: `/summary` (admin daily book) & `/summary/mine` (staff sales count & amount).
  - `routers/closings.py`: `/closings/{date}` get & post lock.
  - `routers/users.py`: `/users` management (admin only).
  - `routers/settings.py`: `/settings` view & patch.
  - `routers/reports.py`: `/reports` history & CSV export.
- `app/main.py`: CORS configuration, router registration, startup validation, consistent error response formatting.

### Phase 6: Scripts & Automated Tests
- `scripts/seed_admin.py`: Creates initial admin from `.env` and default settings row.
- `tests/`: Automated tests for permissions, scoping, idempotency, negative stock, and carry-over math.

---

## 3. Verification Commands
```bash
# Apply migrations
alembic upgrade head

# Seed initial admin
python scripts/seed_admin.py

# Run test suite
pytest -v

# Run local development server
uvicorn app.main:app --reload
```

