# Database Flow (PostgreSQL)

## 1. Principles
- Eggs are stored as ONE integer total (16 crates + 23 eggs = 503 with 30 per crate).
- Money uses `NUMERIC(12,2)`, never float.
- Timestamps are `timestamptz` (UTC). `business_date` is a plain `date` set by the server in Africa/Accra.
- Rows are never hard deleted. They are voided (`voided = true`) and every change is audited.
- Permissions are NOT stored in the database. Only the user's role (`admin` or `staff`) is stored. The role-to-permission map lives in the backend `.env`.
- Stock balance is calculated, not stored, except as a snapshot when a day is closed.

## 2. Relationships
```
users 1 ──< egg_events
users 1 ──< expenses          (created_by)
users 1 ──< audit_log
users 1 ──< daily_closings    (closed_by)
settings  (single row)
```

## 3. Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | identity |
| name | text | not null |
| username | text | unique, not null, stored lowercase |
| password_hash | text | not null |
| role | text | not null, CHECK in ('admin','staff') |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

### egg_events
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| user_id | bigint FK users | who recorded it (set by server) |
| type | text | CHECK in ('received','sold','cracked') |
| eggs | integer | CHECK > 0 (total eggs) |
| amount | numeric(12,2) | null unless type = 'sold'; CHECK (type = 'sold' OR amount IS NULL) |
| note | text | optional |
| occurred_at | timestamptz | server time |
| business_date | date | server-set, Africa/Accra |
| voided | boolean | default false |
| voided_by | bigint FK users | nullable |
| voided_at | timestamptz | nullable |
| idempotency_key | text | unique, nullable |
| created_at | timestamptz | default now() |

Indexes: `(business_date)`, `(business_date, type)`, `(user_id, business_date)`, unique `(idempotency_key)`.

### expenses
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| category | text | CHECK in ('feed','other') |
| name | text | "Feed" for feed, item name for other |
| quantity | text | optional, e.g. "5 bags" |
| amount | numeric(12,2) | CHECK >= 0 |
| business_date | date | server-set |
| created_by | bigint FK users | server-set |
| voided | boolean | default false |
| voided_by / voided_at | | nullable |
| created_at | timestamptz | default now(), also used for the undo window |

Indexes: `(business_date)`, `(business_date, category)`, `(created_by, business_date)`.

### daily_closings
| Column | Type | Notes |
|---|---|---|
| business_date | date PK | |
| opening_override | integer | nullable. Used only for the very first day |
| closing_eggs | integer | snapshot when the day is closed |
| counted_eggs | integer | nullable, the physical count |
| locked | boolean | default false |
| closed_by | bigint FK users | nullable |
| closed_at | timestamptz | nullable |

### settings (one row)
| Column | Type | Notes |
|---|---|---|
| id | smallint PK | always 1 |
| eggs_per_crate | integer | default 30, CHECK > 0 |
| currency | text | default 'GH₵' |

### audit_log
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| user_id | bigint FK users | nullable (failed logins) |
| action | text | e.g. 'event.create', 'event.void', 'expense.undo', 'day.close', 'user.deactivate' |
| table_name | text | |
| record_id | text | |
| old_value | jsonb | |
| new_value | jsonb | |
| at | timestamptz | default now() |

Index: `(table_name, record_id)`, `(at)`.

## 4. SQL sketch
```sql
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','staff')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE egg_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('received','sold','cracked')),
  eggs INTEGER NOT NULL CHECK (eggs > 0),
  amount NUMERIC(12,2) CHECK (amount >= 0),
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  business_date DATE NOT NULL,
  voided BOOLEAN NOT NULL DEFAULT FALSE,
  voided_by BIGINT REFERENCES users(id),
  voided_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (type = 'sold' OR amount IS NULL)
);
CREATE INDEX ON egg_events (business_date, type);
CREATE INDEX ON egg_events (user_id, business_date);

CREATE TABLE expenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('feed','other')),
  name TEXT NOT NULL,
  quantity TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  business_date DATE NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id),
  voided BOOLEAN NOT NULL DEFAULT FALSE,
  voided_by BIGINT REFERENCES users(id),
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON expenses (business_date, category);
CREATE INDEX ON expenses (created_by, business_date);

CREATE TABLE daily_closings (
  business_date DATE PRIMARY KEY,
  opening_override INTEGER,
  closing_eggs INTEGER,
  counted_eggs INTEGER,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  closed_by BIGINT REFERENCES users(id),
  closed_at TIMESTAMPTZ
);

CREATE TABLE settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  eggs_per_crate INTEGER NOT NULL DEFAULT 30 CHECK (eggs_per_crate > 0),
  currency TEXT NOT NULL DEFAULT 'GH₵'
);
INSERT INTO settings DEFAULT VALUES;

CREATE TABLE audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_value JSONB,
  new_value JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 5. Daily book queries

### Totals for one day
```sql
SELECT
  COALESCE(SUM(eggs) FILTER (WHERE type='received'),0) AS gotten,
  COALESCE(SUM(eggs) FILTER (WHERE type='cracked'),0)  AS cracked,
  COALESCE(SUM(eggs) FILTER (WHERE type='sold'),0)     AS sold,
  COALESCE(SUM(amount) FILTER (WHERE type='sold'),0)   AS revenue
FROM egg_events
WHERE business_date = :d AND NOT voided;

SELECT
  COALESCE(SUM(amount) FILTER (WHERE category='feed'),0)  AS feed,
  COALESCE(SUM(amount) FILTER (WHERE category='other'),0) AS other
FROM expenses
WHERE business_date = :d AND NOT voided;
```

### Opening stock (carry-over)
Opening for date D = closing of the latest earlier day with data. The closing of any day is
`opening + gotten - cracked - sold`. For history, compute per day with a window function:
```sql
WITH daily AS (
  SELECT business_date,
         SUM(CASE type WHEN 'received' THEN eggs
                       WHEN 'cracked'  THEN -eggs
                       WHEN 'sold'     THEN -eggs END) AS net_change
  FROM egg_events WHERE NOT voided GROUP BY business_date
)
SELECT business_date,
       COALESCE(:first_opening,0) + COALESCE(SUM(net_change) OVER (
         ORDER BY business_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS opening,
       COALESCE(:first_opening,0) + SUM(net_change) OVER (
         ORDER BY business_date) AS closing
FROM daily ORDER BY business_date;
```
`:first_opening` comes from `daily_closings.opening_override` on the first day.

### Staff own summary (no stock, no expenses)
```sql
SELECT COUNT(*) AS sales_count, COALESCE(SUM(amount),0) AS sales_total
FROM egg_events
WHERE user_id = :me AND business_date = :d AND type='sold' AND NOT voided;
```

## 6. Rules the database enforces
- Role limited to `admin` or `staff`.
- `eggs > 0`, `amount >= 0`.
- Only sold events can carry an amount.
- Duplicate submissions blocked by unique `idempotency_key`.
- Foreign keys keep every entry tied to a real user.

Rules the API enforces (not the database): permissions, ownership scoping, same-day edits,
undo window, negative stock, locked days.

## 7. Day closing flow
1. Admin opens End of Day for a date, the API computes `closing_eggs`.
2. Admin enters `counted_eggs`, the API returns the difference.
3. On confirm: upsert `daily_closings` with `closing_eggs`, `counted_eggs`, `locked = true`, `closed_by`, `closed_at`.
4. While `locked`, the API rejects any event or expense create, edit or void for that `business_date` (409).
5. Unlocking is an admin-only action and is audited.

## 8. Migrations (Alembic)
```bash
alembic revision --autogenerate -m "create core tables"
alembic upgrade head
```
Migration order: users -> settings -> daily_closings -> egg_events -> expenses -> audit_log.
Never edit an applied migration. Add a new one.

## 9. Seed data
`scripts/seed_admin.py` reads `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` from `.env`,
creates the first user with `role = 'admin'` (hashed password) if none exists, and makes sure the
`settings` row exists. All later users are created from the Users screen.

## 10. Operations
- Daily automatic backups, and test a restore at least once.
- Keep voided rows forever (they are small and they protect you in disputes).
- Archive `audit_log` rows older than 12 months to cold storage if it grows large.
- Run `ANALYZE` after large imports. The indexes above are enough for a business of this size.