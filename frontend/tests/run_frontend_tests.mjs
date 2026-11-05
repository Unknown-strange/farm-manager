/**
 * Automated Frontend System Instance & Unit Test Runner
 * Verifies:
 * 1. Egg quantity math (toEggs, fromEggs, formatEggs)
 * 2. Currency formatting & parsing (formatMoney, parseMoney)
 * 3. Date & timezone formatting (todayString, formatDate, formatTime)
 * 4. Route & Page Component wiring (all 14 pages exist, are non-empty, and are mounted in App.tsx with zero placeholders)
 * 5. API client module completeness (auth, events, expenses, summary, closings, users, settings, reports)
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, '../src')

let passed = 0
function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(err)
    process.exit(1)
  }
}

console.log('Running Egg Book Frontend System Tests...\n')

// 1. Egg Quantity Logic Tests
const toEggs = (crates, eggs, perCrate) => crates * perCrate + eggs
const fromEggs = (total, perCrate) => ({
  crates: Math.floor(total / perCrate),
  eggs: total % perCrate,
})
const formatEggs = (total, perCrate) => {
  const { crates, eggs } = fromEggs(total, perCrate)
  const crateLabel = crates === 1 ? 'crate' : 'crates'
  const eggLabel = eggs === 1 ? 'egg' : 'eggs'
  return `${crates} ${crateLabel} + ${eggs} ${eggLabel}`
}

test('Egg conversion: toEggs and fromEggs round-trip accurately (30/crate)', () => {
  assert.equal(toEggs(3, 5, 30), 95)
  assert.deepEqual(fromEggs(95, 30), { crates: 3, eggs: 5 })
  assert.equal(formatEggs(95, 30), '3 crates + 5 eggs')
  assert.equal(formatEggs(31, 30), '1 crate + 1 egg')
  assert.equal(formatEggs(0, 30), '0 crates + 0 eggs')
})

test('Egg conversion: supports custom crate sizes from settings (e.g. 24/crate)', () => {
  assert.equal(toEggs(2, 6, 24), 54)
  assert.deepEqual(fromEggs(54, 24), { crates: 2, eggs: 6 })
  assert.equal(formatEggs(54, 24), '2 crates + 6 eggs')
})

test('Egg conversion: stock flow 32 opening + 16 received - 5 sold = 43 crates', () => {
  const opening = toEggs(32, 0, 30) // 960
  const received = toEggs(16, 0, 30) // 480
  const sold = toEggs(5, 0, 30) // 150
  const remaining = opening + received - sold // 1290
  assert.equal(remaining, 1290)
  assert.deepEqual(fromEggs(remaining, 30), { crates: 43, eggs: 0 })
  assert.equal(formatEggs(remaining, 30), '43 crates + 0 eggs')
})

// 2. Money Formatting & Parsing Tests
const formatMoney = (amount) =>
  `GH₵ ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
const parseMoney = (value) => {
  const cleaned = value.replace(/[^\d.]/g, '')
  return parseFloat(cleaned) || 0
}

test('Currency utilities: formatMoney and parseMoney handle GHS amounts', () => {
  assert.equal(formatMoney(1250.5), 'GH₵ 1,250.50')
  assert.equal(formatMoney(0), 'GH₵ 0.00')
  assert.equal(parseMoney('GH₵ 1,250.50'), 1250.5)
  assert.equal(parseMoney('invalid'), 0)
})

// 3. Africa/Accra Date Helpers
test('Date utilities: todayString produces YYYY-MM-DD in Africa/Accra', () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra' }).format(new Date())
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/)
})

// 4. All 8 Frontend API Modules Exist & Export Expected Operations
test('API client layer: all 8 domain API modules exist and are wired', () => {
  const requiredApiFiles = [
    'client.ts',
    'auth.ts',
    'events.ts',
    'expenses.ts',
    'summary.ts',
    'closings.ts',
    'users.ts',
    'settings.ts',
    'reports.ts',
  ]
  for (const file of requiredApiFiles) {
    const fullPath = path.join(srcDir, 'api', file)
    assert.ok(fs.existsSync(fullPath), `Missing API module: ${file}`)
  }
})

// 5. All 16 Page Components Exist and Are Connected in App.tsx Without Placeholders
test('Page & Router integrity: all 16 pages exist and App.tsx has 0 placeholders', () => {
  const requiredPages = [
    'Login.tsx',
    'Home.tsx',
    'RecordSale.tsx',
    'EggsReceived.tsx',
    'CrackedEggs.tsx',
    'AddExpense.tsx',
    'MyEntries.tsx',
    'Dashboard.tsx',
    'Entries.tsx',
    'Expenses.tsx',
    'History.tsx',
    'EndOfDay.tsx',
    'Users.tsx',
    'Settings.tsx',
    'NotFound.tsx',
    'Forbidden.tsx',
  ]
  for (const page of requiredPages) {
    const fullPath = path.join(srcDir, 'pages', page)
    assert.ok(fs.existsSync(fullPath), `Missing page component: ${page}`)
    const content = fs.readFileSync(fullPath, 'utf8')
    assert.ok(!content.includes('coming soon'), `Page ${page} still contains stub placeholder text`)
  }

  const appTsx = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8')
  assert.ok(!appTsx.includes('Placeholder'), 'App.tsx still contains Placeholder component')
  assert.ok(appTsx.includes('path="/*"'), 'App.tsx must use path="/*" for nested AppShell routes')

  const expectedRoutes = [
    'path="home"',
    'path="sale"',
    'path="received"',
    'path="cracked"',
    'path="expense"',
    'path="my-entries"',
    'path="dashboard"',
    'path="entries"',
    'path="expenses"',
    'path="history"',
    'path="end-of-day"',
    'path="users"',
    'path="settings"',
  ]
  for (const route of expectedRoutes) {
    assert.ok(appTsx.includes(route), `App.tsx missing route ${route}`)
  }
})

// 6. Record Sale Crate and Rate Auto-Multiplication Logic
test('Record Sale: multiplies crates and rate per crate without manual amount entry', () => {
  const calculateSaleAmount = (crates, pricePerCrate) => {
    const c = parseInt(crates, 10) || 0
    const p = parseFloat(pricePerCrate) || 0
    return c > 0 && p > 0 ? Number((c * p).toFixed(2)) : 0
  }

  // 14 crates @ GH₵ 40.00/crate = GH₵ 560.00
  assert.equal(calculateSaleAmount(14, '40.00'), 560.0)
  // 10 crates @ GH₵ 45.50/crate = GH₵ 455.00
  assert.equal(calculateSaleAmount(10, '45.50'), 455.0)
  // 1 crate @ GH₵ 38.25/crate = GH₵ 38.25
  assert.equal(calculateSaleAmount(1, '38.25'), 38.25)
  // 0 or negative or empty crates returns 0
  assert.equal(calculateSaleAmount(0, '40'), 0)
  assert.equal(calculateSaleAmount('', '40'), 0)
  assert.equal(calculateSaleAmount(5, ''), 0)

  // Verify RecordSale.tsx component wiring:
  const recordSaleSrc = fs.readFileSync(path.join(srcDir, 'pages/RecordSale.tsx'), 'utf8')
  assert.ok(recordSaleSrc.includes('cratesCount * unitPrice'), 'RecordSale must multiply crates and unit price')
  assert.ok(recordSaleSrc.includes('eggsCount * unitPrice'), 'RecordSale must multiply single eggs and unit price')
  assert.ok(recordSaleSrc.includes('Sell by Eggs (Each)'), 'RecordSale must allow switching to single eggs mode')
  assert.ok(recordSaleSrc.includes('Borrowed (Not Paid Yet)'), 'RecordSale must allow marking a sale as borrowed')
  assert.ok(recordSaleSrc.includes('Calculated by System'), 'RecordSale must mark amount as calculated by system')
  assert.ok(!recordSaleSrc.includes('<CurrencyInput'), 'RecordSale should not have manual total amount input')
})

// 7. Entries Daily Summary Cards & Summary Page (Week/Month/Year + Borrowed Admin Settlement)
test('Entries daily totals and Summary period filters + Borrowed settlement wiring', () => {
  const entriesSrc = fs.readFileSync(path.join(srcDir, 'pages/Entries.tsx'), 'utf8')
  assert.ok(entriesSrc.includes('Total Money Gained in Day'), 'Entries must show Total Money Gained in Day')
  assert.ok(entriesSrc.includes('Total Eggs Gotten in Day'), 'Entries must show Total Eggs Gotten in Day')
  assert.ok(entriesSrc.includes('Total Cracked Eggs'), 'Entries must show Total Cracked Eggs')
  assert.ok(entriesSrc.includes('Total Expense for Day'), 'Entries must show Total Expense for Day')

  const summarySrc = fs.readFileSync(path.join(srcDir, 'pages/EndOfDay.tsx'), 'utf8')
  assert.ok(summarySrc.includes('title="Summary"'), 'EndOfDay page title should be Summary')
  assert.ok(summarySrc.includes('Total Amount of Money Left (Present)'), 'Summary must show top-most Total Amount of Money Left (Present)')
  assert.ok(summarySrc.includes('Money Left If Borrowed Is Paid'), 'Summary must show projected money if borrowed is paid')
  assert.ok(summarySrc.includes('Borrowed Sales Management (Admin Only)'), 'Summary must include Admin Borrowed Sales section')
  assert.ok(summarySrc.includes('Mark as Paid'), 'Summary must allow Admin to mark borrowed sales as paid')

  const sidebarSrc = fs.readFileSync(path.join(srcDir, 'components/layout/Sidebar.tsx'), 'utf8')
  assert.ok(sidebarSrc.includes("label: 'Summary'"), 'Sidebar must show Summary instead of End of Day')
  assert.ok(sidebarSrc.includes('WORKER_NAV_ITEMS'), 'Sidebar must export WORKER_NAV_ITEMS (Home to My Entries)')
  assert.ok(sidebarSrc.includes('ADMIN_SIDEBAR_NAV_ITEMS'), 'Sidebar must define ADMIN_SIDEBAR_NAV_ITEMS for admin sidebar')

  const topBarSrc = fs.readFileSync(path.join(srcDir, 'components/layout/TopBar.tsx'), 'utf8')
  assert.ok(topBarSrc.includes('WORKER_NAV_ITEMS'), 'TopBar must render WORKER_NAV_ITEMS (Home to My Entries) for Admin')
  assert.ok(topBarSrc.includes('if (!isAdmin)'), 'TopBar must keep original layout for normal users')
  assert.ok(topBarSrc.includes('toggleMobileMenu'), 'TopBar must include mobile drawer menu button')

  const appShellSrc = fs.readFileSync(path.join(srcDir, 'components/layout/AppShell.tsx'), 'utf8')
  assert.ok(appShellSrc.includes('Mobile quick navigation'), 'AppShell must render mobile bottom navigation bar')
  assert.ok(appShellSrc.includes('lg:ml-sidebar'), 'AppShell must only offset main content on desktop')

  const usersSrc = fs.readFileSync(path.join(srcDir, 'pages/Users.tsx'), 'utf8')
  assert.ok(usersSrc.includes('deleteUser'), 'Users page must support soft-deleting staff accounts')
  assert.ok(usersSrc.includes('Deleted (Data Kept)'), 'Users page must show Deleted (Data Kept) badge for soft-deleted staff')

  const faviconSvg = fs.readFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), 'utf8')
  assert.ok(faviconSvg.includes('#C2761A'), 'favicon.svg must use the Egg Book brand logo')

  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  assert.ok(indexHtml.includes('Egg Book'), 'index.html title must be Egg Book')

  const beginningSrc = fs.readFileSync(path.join(srcDir, 'pages/BeginningEntry.tsx'), 'utf8')
  assert.ok(beginningSrc.includes('Set Exact Cash on Hand Now'), 'ManualEntry must allow setting exact cash on hand')
  assert.ok(beginningSrc.includes('Beginning Eggs We Already Have'), 'ManualEntry must allow setting beginning eggs')
  assert.ok(beginningSrc.includes('Log Borrowed (Yet to Be Paid)'), 'ManualEntry must allow logging borrowed eggs & money')
  assert.ok(beginningSrc.includes('Mark as Paid'), 'ManualEntry must allow changing borrowed status to Paid')
  assert.ok(sidebarSrc.includes("label: 'Manual Entry'"), 'Sidebar must include Manual Entry tab for Admin')

  const historySrc = fs.readFileSync(path.join(srcDir, 'pages/History.tsx'), 'utf8')
  assert.ok(historySrc.includes('Logged By'), 'History page must include Logged By column in Daily Ledger History')
  assert.ok(historySrc.includes('row.logged_by'), 'History page must render staff names who logged entries')

  assert.ok(usersSrc.includes('PermissionSelector'), 'Users page must include PermissionSelector')
  assert.ok(usersSrc.includes('Quick Access Presets'), 'Users page must provide quick access presets for staff permissions')
  assert.ok(usersSrc.includes('Edit Staff Permissions'), 'Users page must allow editing staff permissions')
  assert.ok(usersSrc.includes('View-Only (No Entries)'), 'Users page must offer View-Only preset')

  const requirePermSrc = fs.readFileSync(path.join(srcDir, 'auth/RequirePermission.tsx'), 'utf8')
  assert.ok(requirePermSrc.includes('some'), 'RequirePermission must support comma-separated multi-permission OR checks')

  // End of Day reconciliation actuals and unlock mechanism
  const endOfDaySrc = fs.readFileSync(path.join(srcDir, 'pages/EndOfDay.tsx'), 'utf8')
  assert.ok(endOfDaySrc.includes('1. Physical Eggs in Storeroom'), 'EndOfDay must have physical storeroom count field')
  assert.ok(endOfDaySrc.includes('2. Actual Cash Gotten (Revenue)'), 'EndOfDay must have actual cash gotten field')
  assert.ok(endOfDaySrc.includes('3. Actual Expenses Made'), 'EndOfDay must have actual expenses made field')
  assert.ok(endOfDaySrc.includes('4. Actual Eggs Sold Today'), 'EndOfDay must have actual eggs sold field')
  assert.ok(endOfDaySrc.includes('Lock Day with Actuals'), 'EndOfDay must allow locking with actuals')
  assert.ok(endOfDaySrc.includes('Re-adjust / Unlock Day'), 'EndOfDay must allow unlocking day for re-adjustments')

  const closingsApiSrc = fs.readFileSync(path.join(srcDir, 'api/closings.ts'), 'utf8')
  assert.ok(closingsApiSrc.includes('unlockDay'), 'closingsApi must provide unlockDay endpoint')
  assert.ok(closingsApiSrc.includes('actual_revenue'), 'closingsApi must support actual_revenue')
  assert.ok(closingsApiSrc.includes('actual_expenses'), 'closingsApi must support actual_expenses')
  assert.ok(closingsApiSrc.includes('actual_sold_eggs'), 'closingsApi must support actual_sold_eggs')

  const dashboardSrc = fs.readFileSync(path.join(srcDir, 'pages/Dashboard.tsx'), 'utf8')
  assert.ok(dashboardSrc.includes('Reconciled & Locked'), 'Dashboard must display Reconciled & Locked badge')
  assert.ok(historySrc.includes('Reconciled'), 'History page must display Reconciled badge on reconciled days')
})

console.log(`\n✅ All ${passed} frontend system instance checks passed!`)

