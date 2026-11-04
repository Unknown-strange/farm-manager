"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import Set, Dict, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from app.permissions import ALL_PERMISSIONS


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://user:pass@localhost:5432/eggbook"
    SECRET_KEY: str = "change-me-to-a-secure-random-secret"
    ACCESS_TOKEN_MINUTES: int = 30
    TIMEZONE: str = "Africa/Accra"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Seed admin and staff configuration (used by scripts/seed_admin.py)
    SEED_ADMIN_USERNAME: str = "Farmadmin"
    SEED_ADMIN_PASSWORD: str = "adminfarmsdzidzi"
    SEED_STAFF_USERNAME: str = "farmstaff"
    SEED_STAFF_PASSWORD: str = "stafffarmsdzidzi"

    # Role permissions (comma-separated, '*' = all)
    ADMIN_PERMISSIONS: str = "*"
    STAFF_PERMISSIONS: str = (
        "events:create,events:read_own,events:edit_own,events:void_own,"
        "expenses:create,expenses:undo_own,summary:read_own"
    )

    STAFF_EXPENSE_UNDO_MINUTES: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def model_post_init(self, __context) -> None:
        # Automatically normalize Render / standard Postgres URLs to use psycopg v3 driver
        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
        elif self.DATABASE_URL.startswith("postgresql://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip().rstrip("/") for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def role_permissions(self) -> Dict[str, Set[str]]:
        def parse(value: str) -> Set[str]:
            return {p.strip() for p in value.split(",") if p.strip()}

        return {
            "admin": parse(self.ADMIN_PERMISSIONS),
            "staff": parse(self.STAFF_PERMISSIONS),
        }

    def validate_permissions(self) -> None:
        """Ensures all configured permissions exist in canonical permissions list or is '*'."""
        for role, perms in self.role_permissions.items():
            for perm in perms:
                if perm != "*" and perm not in ALL_PERMISSIONS:
                    raise ValueError(
                        f"Invalid permission '{perm}' configured for role '{role}'. "
                        f"Allowed permissions are: {sorted(list(ALL_PERMISSIONS))} or '*'"
                    )


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_permissions()
    return settings


settings = get_settings()

