"""FastAPI application entrypoint with middleware, routers, and startup checks."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, get_db
from app.routers import (
    auth,
    closings,
    events,
    expenses,
    reports,
    summary,
    users,
)
from app.routers import (
    settings as settings_router,
)

logger = logging.getLogger("app.main")


def _ensure_borrowed_columns() -> None:
    """Safely adds borrowed-sale columns to egg_events and soft-delete columns to users if upgrading an existing database."""
    try:
        insp = inspect(engine)
        table_names = insp.get_table_names()
        if "egg_events" in table_names:
            cols = {c["name"] for c in insp.get_columns("egg_events")}
            with engine.begin() as conn:
                if "is_borrowed" not in cols:
                    conn.execute(text("ALTER TABLE egg_events ADD COLUMN is_borrowed BOOLEAN NOT NULL DEFAULT FALSE"))
                if "paid" not in cols:
                    conn.execute(text("ALTER TABLE egg_events ADD COLUMN paid BOOLEAN NOT NULL DEFAULT TRUE"))
                if "paid_by" not in cols:
                    conn.execute(text("ALTER TABLE egg_events ADD COLUMN paid_by BIGINT"))
                if "paid_at" not in cols:
                    conn.execute(text("ALTER TABLE egg_events ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE"))
                if "exclude_from_stock" not in cols:
                    conn.execute(text("ALTER TABLE egg_events ADD COLUMN exclude_from_stock BOOLEAN NOT NULL DEFAULT FALSE"))
        if "users" in table_names:
            u_cols = {c["name"] for c in insp.get_columns("users")}
            with engine.begin() as conn:
                if "is_deleted" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE"))
                if "deleted_at" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE"))
                if "deleted_by" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN deleted_by BIGINT"))
                if "permissions" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN permissions TEXT"))
        if "settings" in table_names:
            s_cols = {c["name"] for c in insp.get_columns("settings")}
            with engine.begin() as conn:
                if "beginning_eggs" not in s_cols:
                    conn.execute(text("ALTER TABLE settings ADD COLUMN beginning_eggs INTEGER NOT NULL DEFAULT 0"))
                if "beginning_money" not in s_cols:
                    conn.execute(text("ALTER TABLE settings ADD COLUMN beginning_money NUMERIC(12, 2) NOT NULL DEFAULT 0.00"))
        if "daily_closings" in table_names:
            dc_cols = {c["name"] for c in insp.get_columns("daily_closings")}
            with engine.begin() as conn:
                if "actual_revenue" not in dc_cols:
                    conn.execute(text("ALTER TABLE daily_closings ADD COLUMN actual_revenue NUMERIC(12, 2)"))
                if "actual_expenses" not in dc_cols:
                    conn.execute(text("ALTER TABLE daily_closings ADD COLUMN actual_expenses NUMERIC(12, 2)"))
                if "actual_sold_eggs" not in dc_cols:
                    conn.execute(text("ALTER TABLE daily_closings ADD COLUMN actual_sold_eggs INTEGER"))
        if "expenses" in table_names:
            e_cols = {c["name"] for c in insp.get_columns("expenses")}
            with engine.begin() as conn:
                if "is_borrowed" not in e_cols:
                    conn.execute(text("ALTER TABLE expenses ADD COLUMN is_borrowed BOOLEAN NOT NULL DEFAULT FALSE"))
                if "paid" not in e_cols:
                    conn.execute(text("ALTER TABLE expenses ADD COLUMN paid BOOLEAN NOT NULL DEFAULT TRUE"))
                if "paid_by" not in e_cols:
                    conn.execute(text("ALTER TABLE expenses ADD COLUMN paid_by BIGINT"))
                if "paid_at" not in e_cols:
                    conn.execute(text("ALTER TABLE expenses ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE"))
            try:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE expenses DROP CONSTRAINT IF EXISTS check_expense_category"))
                    conn.execute(
                        text(
                            "ALTER TABLE expenses ADD CONSTRAINT check_expense_category "
                            "CHECK (category IN ('feed', 'crates', 'other', 'borrowed'))"
                        )
                    )
            except Exception as exc:
                logger.debug("Constraint update skipped: %s", exc)
    except Exception as exc:
        logger.debug("Auto migration skipped: %s", exc)


def _auto_initialize_database() -> None:
    """Automatically creates tables, applies column upgrades, and seeds the default admin & settings if the database is empty."""
    try:
        from sqlalchemy import select

        from app.database import Base, SessionLocal
        from app.models import Setting, User
        from app.security import hash_password

        Base.metadata.create_all(bind=engine)
        _ensure_borrowed_columns()

        with SessionLocal() as db:
            try:
                db.execute(
                    text(
                        "UPDATE expenses SET category = 'feed', is_borrowed = TRUE "
                        "WHERE category = 'borrowed' AND LOWER(name) LIKE '%feed%'"
                    )
                )
                db.execute(
                    text(
                        "UPDATE expenses SET category = 'crates', is_borrowed = TRUE "
                        "WHERE category = 'borrowed' AND LOWER(name) LIKE '%crate%'"
                    )
                )
                db.execute(
                    text(
                        "UPDATE expenses SET category = 'other', is_borrowed = TRUE "
                        "WHERE category = 'borrowed'"
                    )
                )
                db.commit()
            except Exception as exc:
                logger.debug("Legacy expense category normalization skipped: %s", exc)

        if settings.SEED_ADMIN_USERNAME and settings.SEED_ADMIN_PASSWORD:
            with SessionLocal() as db:
                admin_username = settings.SEED_ADMIN_USERNAME.strip().lower()
                existing_admin = db.scalar(select(User).where(User.username == admin_username))
                if not existing_admin:
                    db.add(
                        User(
                            name="Farm Administrator",
                            username=admin_username,
                            password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
                            role="admin",
                            is_active=True,
                            is_deleted=False,
                        )
                    )
                if not db.get(Setting, 1):
                    db.add(Setting(id=1, eggs_per_crate=30, currency="GH₵"))
                db.commit()
    except Exception as exc:
        logger.warning("Auto database initialization encountered error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation: fail fast if permission string has any typo
    settings.validate_permissions()
    _auto_initialize_database()
    yield


app = FastAPI(
    title="Egg Book API",
    description="Operational inventory and sales tracking API for Ghana egg farms",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS setup — Bearer token auth is used (no cookies), so allow_origins=["*"]
# with allow_credentials=False guarantees full compatibility with Safari, iOS WebKit,
# Mozilla Firefox, Chrome, and Edge without wildcard+credentials preflight rejection.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

# Consistent error format per BACKEND_FLOW.md Section 11
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
    }
    error_code = code_map.get(exc.status_code, "ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail), "code": error_code},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Input validation failed",
            "code": "VALIDATION_ERROR",
            "errors": jsonable_encoder(exc.errors()),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "code": "INTERNAL_ERROR",
        },
    )


# Register routers
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(expenses.router)
app.include_router(summary.router)
app.include_router(closings.router)
app.include_router(users.router)
app.include_router(settings_router.router)
app.include_router(reports.router)


@app.get("/health", tags=["health"])
@app.get("/api/health", tags=["health"])
@app.get("/healthz", tags=["health"])
def health_check(db: Session = Depends(get_db)):
    """System health check endpoint verifying API and database connectivity."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "app": "Egg Book API",
                "version": "1.0.0",
                "database": db_status,
                "timezone": settings.TIMEZONE,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    return {
        "status": "ok",
        "app": "Egg Book API",
        "version": "1.0.0",
        "database": db_status,
        "timezone": settings.TIMEZONE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

