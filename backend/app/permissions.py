"""Canonical permissions definitions and verification helpers."""

EVENTS_CREATE = "events:create"
EVENTS_READ_OWN = "events:read_own"
EVENTS_READ_ALL = "events:read_all"
EVENTS_EDIT_OWN = "events:edit_own"
EVENTS_EDIT_ALL = "events:edit_all"
EVENTS_VOID_OWN = "events:void_own"
EVENTS_VOID_ALL = "events:void_all"

EXPENSES_CREATE = "expenses:create"
EXPENSES_UNDO_OWN = "expenses:undo_own"
EXPENSES_READ = "expenses:read"
EXPENSES_EDIT = "expenses:edit"

SUMMARY_READ_OWN = "summary:read_own"
SUMMARY_READ_ALL = "summary:read_all"

REPORTS_READ = "reports:read"
CLOSINGS_MANAGE = "closings:manage"
USERS_MANAGE = "users:manage"
SETTINGS_MANAGE = "settings:manage"

ALL_PERMISSIONS = {
    EVENTS_CREATE,
    EVENTS_READ_OWN,
    EVENTS_READ_ALL,
    EVENTS_EDIT_OWN,
    EVENTS_EDIT_ALL,
    EVENTS_VOID_OWN,
    EVENTS_VOID_ALL,
    EXPENSES_CREATE,
    EXPENSES_UNDO_OWN,
    EXPENSES_READ,
    EXPENSES_EDIT,
    SUMMARY_READ_OWN,
    SUMMARY_READ_ALL,
    REPORTS_READ,
    CLOSINGS_MANAGE,
    USERS_MANAGE,
    SETTINGS_MANAGE,
}


def has_permission(granted_permissions: set[str], *needed: str) -> bool:
    """Returns True if the wildcard '*' is present, or if any needed permission is granted."""
    if "*" in granted_permissions:
        return True
    return any(p in granted_permissions for p in needed)

