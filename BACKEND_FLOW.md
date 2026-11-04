# Backend Flow (FastAPI)

## 1. Stack
- FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL
- Pydantic v2 for request/response schemas
- JWT auth (python-jose or PyJWT), bcrypt/argon2 password hashing
- pytest + httpx for tests

## 2. Project structure
```
backend/
├── app/
│   ├── main.py            # app, CORS, router registration, startup checks
│   ├── config.py          # loads .env, parses role -> permission map
│   ├── database.py        # engine, SessionLocal, get_db
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic schemas
│   ├── security.py        # hashing, JWT, get_current_user, require_permission
│   ├── permissions.py     # permission constants + has_permission()
│   ├── services/
│   │   ├── book.py        # daily book calculation
│   │   └── audit.py       # write audit_log rows
│   └── routers/
│       ├── auth.py
│       ├── events.py
│       ├── expenses.py
│       ├── summary.py
│       ├── closings.py
│       ├── users.py
│       └── settings.py
├── alembic/
├── scripts/seed_admin.py
├── tests/
├── requirements.txt
└── .env
```

## 3. Roles and permissions (defined in .env)

There are two roles: `admin` and `staff`. The role is stored on the user.
Permissions are NOT stored per user. They come from the env, per role.

### .env
```
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/eggbook
SECRET_KEY=change-me
ACCESS_TOKEN_MINUTES=30
TIMEZONE=Africa/Accra
CORS_ORIGINS=http://localhost:5173

# first admin, used only by scripts/seed_admin.py
SEED_ADMIN_USERNAME=owner
SEED_ADMIN_PASSWORD=change-me-now

# role permissions
ADMIN_PERMISSIONS=*
STAFF_PERMISSIONS=events:create,events:read_own,events:edit_own,events:void_own,expenses:create,expenses:undo_own,summary:read_own

# rules
STAFF_EXPENSE_UNDO_MINUTES=10
```

### Permission list
| Permission | Meaning |
|---|---|
| `events:create` | record sale / received / cracked |
| `events:read_own` / `events:read_all` | view own / everyone's entries |
| `events:edit_own` / `events:edit_all` | edit own (same day) / any |
| `events:void_own` / `events:void_all` | void own (same day) / any |
| `expenses:create` | add an expense |
| `expenses:undo_own` | undo own expense within the undo window |
| `expenses:read` | view expense list and totals |
| `expenses:edit` | edit or void any expense |
| `summary:read_own` / `summary:read_all` | own totals / full daily book |
| `reports:read` | history and exports |
| `closings:manage` | end-of-day count and day locking |
| `users:manage` | create, deactivate, reset passwords |
| `settings:manage` | eggs per crate, currency |

`*` means every permission.

### How config loads (config.py shape)
```python
class Settings(BaseSettings):
    ADMIN_PERMISSIONS: str = "*"
    STAFF_PERMISSIONS: str = ""
    ...
    @property
    def role_permissions(self) -> dict[str, set[str]]:
        def parse(v): return {p.strip() for p in v.split(",") if p.strip()}
        return {"admin": parse(self.ADMIN_PERMISSIONS),
                "staff": parse(self.STAFF_PERMISSIONS)}
```

On startup, validate that every permission in the env exists in `permissions.py`
and fail fast if one is misspelled. Changing permissions means editing .env and
restarting the API. No code change and no database change.

### Dependency used on every route
```python
def require_permission(*needed: str):
    def checker(user: User = Depends(get_current_user)):
        granted = settings.role_permissions.get(user.role, set())
        if "*" in granted or any(p in granted for p in needed):
            return user
        raise HTTPException(403, "Not allowed")
    return checker
```

## 4. Ownership scoping (important)
A permission says whether you may call a route. Ownership decides which rows you get.

- If the user has `events:read_all` -> query all rows.
- Otherwise (only `events:read_own`) -> the query ALWAYS adds `WHERE user_id = :me`.
- Put this in one helper (`scope_events(query, user)`) used by every events query so it cannot be forgotten.
- Edit/void with only `_own` permission: row must belong to the user AND business_date == today.

## 5. Auth flow
1. `POST /auth/login` (username + password)
   - Find user, check `is_active`, verify hash.
   - Return `access_token` (JWT with `sub=user_id`, `role`, `exp`) and the user object.
   - Same error for wrong username or wrong password: "Wrong username or password".
   - Rate limit this route.
2. Every protected request sends `Authorization: Bearer <token>`.
3. `get_current_user` decodes the token, loads the user from the DB, rejects if missing or inactive.
   Deactivating a user therefore blocks them immediately.
4. `GET /auth/me` returns `{id, name, username, role, permissions: [...]}`.
   The frontend uses `permissions` to decide what to show.
5. Passwords: staff cannot self-register. Only `users:manage` creates accounts.

## 6. Request lifecycle
```
Request
  -> CORS
  -> get_current_user (JWT -> user)
  -> require_permission(...)
  -> Pydantic validation
  -> ownership scoping / rule checks (same day, undo window, locked day)
  -> service logic (book calc, stock check)
  -> write DB + audit_log
  -> Pydantic response schema (never return password_hash or fields the role must not see)
```

## 7. Server-controlled fields
The client may NEVER send these. The server sets them:
`user_id`, `created_by`, `occurred_at`, `created_at`, `business_date`, `voided`.

`business_date` = today in `Africa/Accra` at the moment of the request.
Only users with `events:edit_all` may correct a business_date.

## 8. Endpoints

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | /auth/login | public | returns token |
| GET | /auth/me | any logged in | includes permissions list |
| POST | /events | events:create | needs `Idempotency-Key` header |
| GET | /events?date=&user_id=&type= | events:read_own or read_all | scoped by ownership |
| PATCH | /events/{id} | events:edit_own or edit_all | own + same day, or any |
| POST | /events/{id}/void | events:void_own or void_all | soft delete, audited |
| POST | /expenses | expenses:create | sets created_by, business_date |
| POST | /expenses/{id}/undo | expenses:undo_own | own, within undo window |
| GET | /expenses?date=&category=&user_id= | expenses:read | staff get 403 |
| PATCH | /expenses/{id} | expenses:edit | |
| POST | /expenses/{id}/void | expenses:edit | |
| GET | /summary?date= | summary:read_all | full daily book |
| GET | /summary/mine?date= | summary:read_own | own sales count and amount only |
| GET | /reports?from=&to= | reports:read | one row per day |
| GET | /reports/export?from=&to= | reports:read | CSV |
| GET | /closings/{date} | closings:manage | computed closing + counted |
| POST | /closings/{date} | closings:manage | save physical count, lock day |
| GET | /users | users:manage | |
| POST | /users | users:manage | role must be `admin` or `staff` |
| PATCH | /users/{id} | users:manage | activate/deactivate, name |
| POST | /users/{id}/reset-password | users:manage | |
| GET | /settings | any logged in | eggs_per_crate, currency |
| PATCH | /settings | settings:manage | |

## 9. Business rules

### Events
- `eggs` is an integer total (crates * eggs_per_crate + loose eggs). Must be > 0.
- `type = sold` requires `amount >= 0`. Other types must have no amount.
- Stock check: if a sold or cracked event would push computed stock below zero,
  return 400 with a clear message (or accept with a `warning` flag, your choice).
- Idempotency: unique `idempotency_key` per event. Same key twice returns the first record, not a duplicate.
- Locked day: any create/edit/void on a locked business_date returns 409.

### Expenses
- `category`: `feed` or `other`. Name required when category is `other`, set to "Feed" otherwise.
- Staff can create but never read. The create response returns only `{id, created_at, undo_until}`, with no totals and no list.
- Undo allowed only if `created_by == me` and `now - created_at <= STAFF_EXPENSE_UNDO_MINUTES`.

### Daily book (services/book.py)
```
opening  = previous day's closing (first day: opening_override)
gotten   = SUM(eggs) received
cracked  = SUM(eggs) cracked
sold     = SUM(eggs) sold
revenue  = SUM(amount) sold
feed     = SUM(expense.amount) category feed
other    = SUM(expense.amount) category other
closing  = opening + gotten - cracked - sold
net      = revenue - (feed + other)
```
All sums exclude voided rows. Calculate on read so a backdated edit corrects later days.
When a day is closed, store the snapshot in daily_closings, and reads of locked days may use it.

## 10. Audit logging
Every create, edit, void, undo, close-day, user change and login failure threshold writes to `audit_log`:
who, action, table, record id, old value (JSON), new value (JSON), time.

## 11. Errors (consistent shape)
```json
{ "detail": "Human readable message", "code": "STOCK_NEGATIVE" }
```
| Status | When |
|---|---|
| 400 | validation / stock would go negative |
| 401 | missing or expired token |
| 403 | role lacks permission, or row not owned |
| 404 | not found (also for rows a staff user is not allowed to see, to avoid leaking) |
| 409 | day locked, duplicate |
| 422 | Pydantic validation failure |

## 12. Dev flow
```bash
docker compose up -d db
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python scripts/seed_admin.py        # creates admin from SEED_ADMIN_* env values
uvicorn app.main:app --reload       # docs at /docs
```
Daily loop: change model -> `alembic revision --autogenerate -m "msg"` -> `alembic upgrade head`
-> write endpoint -> test in `/docs` -> write pytest -> PR.

## 13. Tests to write first
- Env parsing: `*` grants all, unknown permission fails startup
- Staff can POST /expenses (201) but GET /expenses returns 403
- Staff GET /events returns only their own rows
- Staff cannot edit another user's event or a previous day's event
- Staff cannot undo an expense after the window
- Admin sees all events and expenses
- Opening stock carries over; empty day returns zeros
- Negative stock blocked
- Locked day rejects writes
- Same idempotency key creates one record
- Deactivated user's token stops working

## 14. Deployment
- Docker image, `gunicorn -k uvicorn.workers.UvicornWorker app.main:app`
- Managed PostgreSQL with daily automatic backups
- HTTPS only, CORS limited to the frontend origin
- Secrets only in environment variables, never in git
- Restart the API after any `.env` permission change