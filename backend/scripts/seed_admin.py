"""Seed script to create/update the initial administrator, default staff user, and settings."""

import os
import sys

# Ensure backend root is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Setting, User
from app.security import hash_password


def seed():
    print("🌱 Running Egg Book user & settings seed...")
    # Ensure tables exist in PostgreSQL
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin_username = settings.SEED_ADMIN_USERNAME.strip().lower()
        admin_password = settings.SEED_ADMIN_PASSWORD

        # 1. Seed or update admin user
        admin = db.scalar(select(User).where(User.username == admin_username))
        if admin:
            admin.password_hash = hash_password(admin_password)
            admin.role = "admin"
            admin.is_active = True
            db.commit()
            print(f"✅ Updated existing admin user '{admin_username}' (ID: {admin.id}) with credentials from .env.")
        else:
            admin = User(
                name="Farm Administrator",
                username=admin_username,
                password_hash=hash_password(admin_password),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"✅ Created initial admin user '{admin_username}' (ID: {admin.id}).")

        # 2. Seed or update default staff user (only if configured)
        staff_username = settings.SEED_STAFF_USERNAME.strip().lower()
        staff_password = settings.SEED_STAFF_PASSWORD
        if staff_username and staff_password:
            staff = db.scalar(select(User).where(User.username == staff_username))
            if staff:
                staff.password_hash = hash_password(staff_password)
                staff.role = "staff"
                staff.is_active = True
                db.commit()
                print(f"✅ Updated existing staff user '{staff_username}' (ID: {staff.id}) with credentials from .env.")
            else:
                staff = User(
                    name="Farm Staff Member",
                    username=staff_username,
                    password_hash=hash_password(staff_password),
                    role="staff",
                    is_active=True,
                )
                db.add(staff)
                db.commit()
                db.refresh(staff)
                print(f"✅ Created initial staff user '{staff_username}' (ID: {staff.id}).")
        else:
            print("ℹ️  Skipping initial staff user seed (SEED_STAFF_USERNAME not set).")

        # 3. Seed default settings
        setting = db.get(Setting, 1)
        if setting:
            print(f"ℹ️  Settings already initialized (Eggs per crate: {setting.eggs_per_crate}, Currency: {setting.currency}).")
        else:
            setting = Setting(id=1, eggs_per_crate=30, currency="GH₵")
            db.add(setting)
            db.commit()
            print("✅ Created default settings row (30 eggs/crate, GH₵ currency).")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
