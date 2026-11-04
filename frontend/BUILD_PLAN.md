# Frontend Build Plan — Egg Book

## Overview

We are building **Egg Book**, a Ghana-based egg farm inventory and sales tracking web app. The frontend is a permission-gated React SPA (Single Page Application) with two distinct user profiles — **Worker Station** (staff) and **Admin Suite** — each with different screens and data visibility.

The build is grounded in:
- **[FRONTEND_FLOW.md](file:///Users/princeedwinnyarko/PersonalProjects/Farm%20manager/FRONTEND_FLOW.md)** — routing, permissions, auth, data fetching, component conventions
- **`pages_guide/`** — 4 pixel-accurate HTML reference screens using the "Warm Commerce Minimal" design system

---

## Design Reference Summary

| HTML File | Screen |
|---|---|
| `stitch_egg_book_web_app/` | **Sign In** (Login page) |
| `stitch_egg_book_web_app(1)/` | **Worker Station Home** (staff home) |
| `stitch_egg_book_web_app(2)/` | **Record Sale** (worker entry form) |
| `stitch_egg_book_web_app(3)/` | **Daily Book** (admin dashboard) |

Design system — "Warm Commerce Minimal":
- **Brand accent:** `#C2761A` (egg-yolk amber)
- **Canvas:** `#FAF8F3` (unbleached cream)
- **Cards:** `#FFFFFF` + `1px solid #E4DFD3` + `12px` radius
- **Font:** Inter (Google Fonts)
- **Icons:** Material Symbols Outlined / lucide-react

---

## Build Phases

### ✅ Phase 1 — Foundation Setup
Install deps, configure Tailwind with design tokens, AppShell layout (Sidebar + TopBar).

### ⬜ Phase 2 — Auth Layer
JWT auth flow, AuthContext, ProtectedRoute, `useCan` permission hook, Login page.

### ⬜ Phase 3 — Shared Components & Helpers
`eggs.ts`, `money.ts`, `dates.ts`, `StatCard`, `DataTable`, `TypeTag`, `EggQuantityInput`, `CurrencyInput`, `ConfirmDialog`, `Modal`, `Toast`, `DatePicker`.

### ⬜ Phase 4 — Staff (Worker Station) Screens
Home, RecordSale, EggsReceived, CrackedEggs, AddExpense, MyEntries.

### ⬜ Phase 5 — Admin (Admin Suite) Screens
Dashboard (Daily Book), Entries, Expenses.

### ⬜ Phase 6 — Power Screens
History (with bar chart), EndOfDay, Users, Settings.

### ⬜ Phase 7 — Polish & Mobile
Empty states, toasts, accessibility, keyboard nav, responsive/mobile pass.

---

## Route Table

| Path | Component | Permission Guard |
|---|---|---|
| `/login` | `Login` | public |
| `/home` | `Home` | `events:create` |
| `/sale` | `RecordSale` | `events:create` |
| `/received` | `EggsReceived` | `events:create` |
| `/cracked` | `CrackedEggs` | `events:create` |
| `/expense` | `AddExpense` | `expenses:create` |
| `/my-entries` | `MyEntries` | `events:read_own` |
| `/dashboard` | `Dashboard` | `summary:read_all` |
| `/entries` | `Entries` | `events:read_all` |
| `/expenses` | `Expenses` | `expenses:read` |
| `/history` | `History` | `reports:read` |
| `/end-of-day` | `EndOfDay` | `closings:manage` |
| `/users` | `Users` | `users:manage` |
| `/settings` | `Settings` | `settings:manage` |
| `*` | `NotFound` | — |
| `/forbidden` | `Forbidden` | — |

Post-login redirect: has `summary:read_all` → `/dashboard`; otherwise → `/home`.

---

## API Modules

| File | Hooks / Functions |
|---|---|
| `api/auth.ts` | `login()`, `getMe()` |
| `api/events.ts` | `useEvents()`, `createEvent()`, `editEvent()`, `voidEvent()` |
| `api/expenses.ts` | `useExpenses()`, `createExpense()`, `undoExpense()`, `voidExpense()` |
| `api/summary.ts` | `useSummary()`, `useMySummary()` |
| `api/closings.ts` | `useClosing()`, `closeDay()` |
| `api/users.ts` | `useUsers()`, `createUser()`, `toggleUser()`, `resetPassword()` |
| `api/settings.ts` | `useSettings()`, `updateSettings()` |

---

## Design Tokens (Tailwind)

| Token | Value | Usage |
|---|---|---|
| `brand` | `#C2761A` | Primary actions, active nav |
| `canvas` | `#FAF8F3` | Page background |
| `border` | `#E4DFD3` | Card borders, dividers |
| `ink` | `#1F1D1A` | Primary text |
| `muted` | `#777777` | Labels, helper text |
| `success` | `#2E7D32` | Revenue, inflow |
| `danger` | `#C62828` | Cracked, expenses |
| `intake` | `#1565C0` | Received eggs |
| `warn` | `#F59E0B` | Warnings |

