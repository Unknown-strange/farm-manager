"""FastAPI application entrypoint with middleware, routers, and startup checks."""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, get_db
from sqlalchemy import inspect, text
from app.routers import (
    auth,
    events,
    expenses,
    summary,
    closings,
    users,
    settings as settings_router,
    reports,
)


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
        if "users" in table_names:
            u_cols = {c["name"] for c in insp.get_columns("users")}
            with engine.begin() as conn:
                if "is_deleted" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE"))
                if "deleted_at" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE"))
                if "deleted_by" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN deleted_by BIGINT"))
    except Exception:
        pass


def _auto_initialize_database() -> None:
    """Automatically creates tables, applies column upgrades, and seeds the default admin & settings if the database is empty."""
    try:
        from app.database import Base, SessionLocal
        from app.models import User, Setting
        from app.security import hash_password
        from sqlalchemy import select

        Base.metadata.create_all(bind=engine)
        _ensure_borrowed_columns()

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
    except Exception:
        pass


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

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.(onrender\.com|vercel\.app|netlify\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

