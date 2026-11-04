# Frontend Flow (React)

## 1. Stack
- React 18 + Vite + TypeScript
- React Router v6
- TanStack Query (server state)
- Axios (API client)
- React Hook Form + Zod (forms and validation)
- Tailwind CSS (or your preferred styling)
- Desktop layout first. Mobile responsiveness is added afterwards.

## 2. Project structure
```
frontend/src/
├── api/
│   ├── client.ts            # axios instance + interceptors
│   ├── auth.ts  events.ts  expenses.ts  summary.ts  users.ts  closings.ts  settings.ts
├── auth/
│   ├── AuthContext.tsx      # user, permissions, login(), logout()
│   ├── ProtectedRoute.tsx   # needs login
│   ├── RequirePermission.tsx# needs a permission
│   └── useCan.ts            # can("expenses:read")
├── lib/
│   ├── eggs.ts              # toEggs(), fromEggs(), formatEggs()
│   ├── money.ts             # formatMoney() -> GH₵ 1,250.00
│   └── dates.ts             # today in Africa/Accra, date helpers
├── components/
│   ├── layout/ Sidebar.tsx TopBar.tsx AppShell.tsx
│   ├── EggQuantityInput.tsx
│   ├── CurrencyInput.tsx
│   ├── DataTable.tsx
│   ├── TypeTag.tsx
│   ├── StatCard.tsx  BookRow.tsx
│   ├── ConfirmDialog.tsx  Modal.tsx  Toast.tsx
│   └── DatePicker.tsx
├── pages/
│   ├── Login.tsx
│   ├── Home.tsx                 # staff home (action cards)
│   ├── RecordSale.tsx  EggsReceived.tsx  CrackedEggs.tsx  AddExpense.tsx
│   ├── MyEntries.tsx
│   ├── Dashboard.tsx            # admin daily book
│   ├── Entries.tsx  Expenses.tsx  History.tsx
│   ├── EndOfDay.tsx  Users.tsx  Settings.tsx
│   └── NotFound.tsx  Forbidden.tsx
├── App.tsx  main.tsx
└── .env   # VITE_API_URL=http://localhost:8000
```

## 3. Permission-driven UI
The backend is the real gatekeeper. The frontend only mirrors it so people don't see buttons that will fail.

- After login, `GET /auth/me` returns `{ role, permissions: [...] }`.
- `AuthContext` stores `user` and `permissions`.
- `useCan("expenses:read")` returns true when the list contains the permission or `*`.
- Sidebar items, buttons and routes check permissions, not role names.
  That way a permission change in the backend `.env` flows to the UI with no frontend code change.

```tsx
<RequirePermission permission="expenses:read"><Expenses /></RequirePermission>
{can("events:void_own") && <Button>Void</Button>}
```

## 4. Auth flow
1. App loads -> `AuthContext` looks for a stored token.
2. No token -> redirect to `/login`.
3. Login form submits to `POST /auth/login` -> store token -> `GET /auth/me`.
4. Redirect after login:
   - has `summary:read_all` -> `/dashboard`
   - otherwise -> `/home`
5. Axios request interceptor adds `Authorization: Bearer <token>`.
6. Axios response interceptor: on 401, clear auth and go to `/login`. On 403, show a "Not allowed" toast.
7. Logout clears the token and the TanStack Query cache.

Token storage: keep it in memory plus sessionStorage for refresh survival, or use an httpOnly cookie if the backend adds refresh tokens.

## 5. Routes
| Path | Screen | Needs permission |
|---|---|---|
| /login | Login | public |
| /home | Staff home | events:create |
| /sale | Record Sale | events:create |
| /received | Eggs Received | events:create |
| /cracked | Cracked Eggs | events:create |
| /expense | Add Expense | expenses:create |
| /my-entries | My Entries | events:read_own |
| /dashboard | Daily Book | summary:read_all |
| /entries | All Entries | events:read_all |
| /expenses | Expense list | expenses:read |
| /history | History | reports:read |
| /end-of-day | End of Day | closings:manage |
| /users | Users | users:manage |
| /settings | Settings | settings:manage |

Unknown route -> NotFound. Missing permission -> Forbidden page.

## 6. Layout (desktop)
- Fixed left sidebar (240px): logo, nav items filtered by `can(...)`, Log out at bottom.
- Top bar: page title, date picker where relevant, user name with dropdown.
- Content: max width 1100px, centered, 32px padding.
- Forms: centered card, max width 560px.

Sidebar items by permission:
- Home, Record Sale, Eggs Received, Cracked Eggs -> `events:create`
- Add Expense -> `expenses:create`
- My Entries -> `events:read_own`
- Dashboard -> `summary:read_all`
- Entries -> `events:read_all`
- Expenses -> `expenses:read`
- History -> `reports:read`
- End of Day -> `closings:manage`
- Users -> `users:manage`
- Settings -> `settings:manage`

## 7. Core helpers

### eggs.ts
```ts
export const toEggs = (crates: number, eggs: number, perCrate: number) => crates * perCrate + eggs;
export const fromEggs = (total: number, perCrate: number) =>
  ({ crates: Math.floor(total / perCrate), eggs: total % perCrate });
export const formatEggs = (total: number, perCrate: number) => {
  const { crates, eggs } = fromEggs(total, perCrate);
  return `${crates} crate${crates === 1 ? "" : "s"} + ${eggs} egg${eggs === 1 ? "" : "s"}`;
};
```
`eggs_per_crate` is loaded once from `GET /settings` and kept in context.

### EggQuantityInput
Two number fields (Crates, Eggs) with stepper buttons. Live helper "= 503 eggs total".
If eggs >= perCrate, auto-convert. Value passed up to the form is always the single total integer.

## 8. Screen flows

### Login
Username + password -> Sign in -> error "Wrong username or password" -> redirect by permission.

### Staff Home
Four action cards (Sale, Received, Cracked, Expense) + "My entries today" table + own sales count/total from `GET /summary/mine`.
No stock, expense totals or profit.

### Record Sale / Received / Cracked
- Form: EggQuantityInput (+ CurrencyInput for sale, optional note for received/cracked).
- Submit -> `POST /events` with a fresh `Idempotency-Key` (uuid generated when the form mounts, regenerated after success).
- Disable button while pending. On success: toast, reset form, refocus first field, invalidate `["events"]`.
- Validation (Zod): eggs > 0, amount >= 0.

### Add Expense
- Segmented control Feed | Other. Name field appears only for Other.
- Quantity (optional text), Amount.
- Submit -> `POST /expenses`.
- On success show only "Expense saved" with an Undo button and countdown (from `undo_until` in the response).
  Undo -> `POST /expenses/{id}/undo`.
- Never fetch or display any expense list for users without `expenses:read`.

### My Entries
Date selector -> `GET /events?date=` (server returns only own rows for staff).
Table with Edit and Void shown only for today's rows and when `can("events:edit_own")` / `can("events:void_own")`.
Void opens ConfirmDialog.

### Dashboard (admin daily book)
- Date picker -> `GET /summary?date=`.
- Stat cards: Remaining after today, Amount from sales, Total spent, Sales minus expenses.
- Book card in paper-book order. "By worker" card (click -> Entries filtered).
- Warning banner for negative stock or unclosed day after 8 PM.
- "Quick add" dropdown reuses the same forms in a modal.

### Entries
Filters (type chips, user dropdown, date) -> `GET /events`. Edit and Void per row. Voided rows greyed.

### Expenses
Date picker, summary strip (feed, other, total), filters, table with "Recorded by". Add / edit / void.

### History
Date range -> `GET /reports?from=&to=`. Bar chart (sales vs expenses) + table. Row click -> Dashboard for that date. Export CSV button -> `/reports/export`.

### End of Day
`GET /closings/{date}` -> shows computed closing. Physical count input -> difference shown live
("Matches" / "Short by 1 crate + 4 eggs") -> "Close the day" -> ConfirmDialog -> `POST /closings/{date}`.

### Users
Table, "+ Add" modal (name, username, temporary password, role = Admin or Staff), toggle Active, Reset password.

### Settings
Eggs per crate, currency -> `PATCH /settings`.

## 9. Data fetching conventions
- One API file per resource, one TanStack Query hook per call (`useEvents(date)`, `useSummary(date)`).
- Query keys: `["events", date, filters]`, `["summary", date]`, `["expenses", date, filters]`.
- After a mutation, invalidate the related keys so the daily book refreshes.
- Never call admin-only endpoints from staff screens. Gate the hook with `enabled: can(...)`.

## 10. Forms and feedback
- Every submit button shows a spinner and is disabled while pending.
- Inline field errors from Zod, plus server error messages shown in a toast.
- Enter submits, autofocus first field, logical tab order.
- Destructive actions (void, deactivate, close day) always use ConfirmDialog.
- Empty states have an icon, one line and a button.

## 11. Dev flow
```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm run dev              # http://localhost:5173
```
Build order:
1. Vite + Tailwind + router + AppShell
2. API client, AuthContext, Login, ProtectedRoute, RequirePermission
3. eggs.ts, money.ts, EggQuantityInput, CurrencyInput
4. Staff screens: Home, Sale, Received, Cracked, Expense, My Entries
5. Admin screens: Dashboard, Entries, Expenses
6. History, End of Day, Users, Settings
7. Polish: toasts, empty states, dark mode
8. Mobile responsiveness pass

Before merging: `npm run lint && npm run build`.

## 12. Deployment
`npm run build`, serve `dist/` from Netlify, Vercel or Nginx. Set `VITE_API_URL` to the production API and add that origin to the backend `CORS_ORIGINS`.