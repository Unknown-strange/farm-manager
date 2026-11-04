# 🥚 Egg Book — Farm Management System

**Egg Book** is a digital operational ledger, inventory, and financial tracking system purpose-built for poultry and egg farms. It replaces physical paper books with a fast, mobile-friendly interface for farm workers (**Worker Station**) and a comprehensive accounting, reconciliation, and analytics dashboard for farm owners (**Admin Suite**).

---

## ✨ Key Features

### 1. Worker Station (Daily Operations)
- **Record Sale**:
  - Sell by **Crates** (number of crates × price per crate) or switch to **Single Eggs** (number of eggs × price per egg) — the system automatically calculates the total sale amount.
  - Mark credit sales as **Borrowed (Not Paid Yet)** so stock is deducted immediately while revenue is tracked separately until settled.
- **Eggs Received & Cracked Eggs**:
  - Log daily egg harvests and breakages in crates and/or individual eggs with live stock validation (prevents negative stock).
- **Add Expense**:
  - Record **Feed** or **Other** farm expenses with a 10-minute self-service undo window for staff while preserving financial privacy.
- **My Entries & Offline Outbox**:
  - View personal daily totals (money gained, eggs received, cracked eggs) and automatically queue entries offline if internet connectivity drops, syncing with idempotency keys when back online.

### 2. Admin Suite (Management & Accounting)
- **Split Navigation for Admins**:
  - Quick-action worker links (**Home** → **My Entries**) live in the top navigation bar for admins, while management tools (**Dashboard** → **Settings**) live in the sidebar.
- **Dashboard & Daily Book**:
  - Real-time paper-book flow (`Opening + Gotten − Cracked − Sold = Closing`), revenue vs. expenses, net margin, and per-worker sales breakdowns.
- **Summary (Day / Week / Month / Year / Custom)**:
  - Top-level cards showing **Total Amount of Money Left (Present)** and **Money Left If Borrowed Is Paid**.
  - **Borrowed Sales Management (Admin Only)**: View all unpaid borrowed/credit sales and mark them as **Paid** with one click.
  - **End-of-Day Physical Count & Lock**: Reconcile physical egg counts against system stock and lock closed business days.
- **Entries, Expenses & History**:
  - Filterable daily and historical ledgers with CSV export.
- **Permanent Ledger Protection (Soft-Delete Only)**:
  - Deleting or deactivating a staff account immediately revokes their system access while **permanently preserving 100% of their historical sales, egg counts, expenses, and audit logs**. All deletions across the backend (`users`, `egg_events`, `expenses`) are strictly soft deletes.
- **Mobile-First & Responsive**:
  - Designed for phones, tablets, and desktops with a slide-out mobile drawer and a sticky bottom quick-navigation bar.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PyJWT, Bcrypt |
| **Database** | PostgreSQL (production / Neon / Supabase) or SQLite (local/testing) |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, React Router v7, TanStack Query |

---

## 🚀 Getting Started

### Prerequisites
- **Python** `3.11+`
- **Node.js** `18+` and **npm**
- **PostgreSQL** database (or SQLite for local testing)

---

### 1. Backend Setup & Running

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your `DATABASE_URL` and `SECRET_KEY`:
   ```bash
   cp .env.example .env
   ```
   Example `.env` values:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/eggbook
   SECRET_KEY=replace-with-a-secure-random-secret-key
   ACCESS_TOKEN_MINUTES=30
   TIMEZONE=Africa/Accra
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

   SEED_ADMIN_USERNAME=Farmadmin
   SEED_ADMIN_PASSWORD=adminfarmsdzidzi
   ```

5. **Run database migrations:**
   ```bash
   .venv/bin/alembic upgrade head
   ```

6. **Seed the initial Admin (and optional Staff) account:**
   ```bash
   .venv/bin/python -m scripts.seed_admin
   ```

7. **Start the FastAPI backend server:**
   ```bash
   .venv/bin/uvicorn app.main:app --reload --port 8000
   ```
   - **API Base URL**: `http://localhost:8000`
   - **Interactive Swagger Docs**: `http://localhost:8000/docs`
   - **Health Check Endpoint**: `http://localhost:8000/health` (also available at `/api/health` and `/healthz`)

---

### 2. Frontend Setup & Running

1. **Open a new terminal and navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node packages:**
   ```bash
   npm install
   ```

3. **(Optional) Configure API URL:**
   By default, the frontend connects to `http://localhost:8000`. To point to a custom backend URL, create `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

4. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   - Open **`http://localhost:5173`** in your browser.

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🩺 Health Check

You can verify that the API and database connection are healthy at any time without authentication:

```bash
curl http://localhost:8000/health
```

Example response (`200 OK`):
```json
{
  "status": "ok",
  "app": "Egg Book API",
  "version": "1.0.0",
  "database": "connected",
  "timezone": "Africa/Accra",
  "timestamp": "2026-11-04T08:45:00.000000+00:00"
}
```

---

## 🧪 Running Tests

- **Backend Test Suite (Pytest):**
  ```bash
  cd backend && .venv/bin/pytest
  ```

- **Frontend System Tests:**
  ```bash
  cd frontend && npm test
  ```

---

## 📂 Project Structure

```text
.
├── backend/
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── routers/          # FastAPI route handlers (auth, events, expenses, summary, closings, users, settings, reports)
│   │   ├── services/         # Daily & period book calculations and audit logging
│   │   ├── config.py         # Environment & RBAC permission configuration
│   │   ├── database.py       # SQLAlchemy engine & session management
│   │   ├── main.py           # FastAPI app entrypoint & health check
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── permissions.py    # Role-based permission constants
│   │   ├── schemas.py        # Pydantic v2 request/response schemas
│   │   └── security.py       # JWT authentication & password hashing
│   ├── scripts/              # Admin & staff seeding script (seed_admin.py)
│   └── tests/                # Pytest integration & unit tests
├── frontend/
│   ├── public/               # App logo / favicon.svg
│   ├── src/
│   │   ├── api/              # Typed Axios API client modules
│   │   ├── auth/             # AuthContext, RequireAuth, and permission hooks
│   │   ├── components/       # Layout (AppShell, Sidebar, TopBar) & shared UI components
│   │   ├── lib/              # Egg/crate math, currency formatting, offline outbox queue
│   │   └── pages/            # All 16 Worker Station & Admin Suite screens
│   └── tests/                # Frontend system verification tests
└── README.md
```

