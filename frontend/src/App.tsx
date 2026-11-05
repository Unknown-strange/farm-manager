import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'
import { useCan } from '@/auth/useCan'
import { ToastProvider } from '@/components/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { RequirePermission } from '@/auth/RequirePermission'

// Pages
import { Login } from '@/pages/Login'
import { Home } from '@/pages/Home'
import { RecordSale } from '@/pages/RecordSale'
import { EggsReceived } from '@/pages/EggsReceived'
import { CrackedEggs } from '@/pages/CrackedEggs'
import { AddExpense } from '@/pages/AddExpense'
import { MyEntries } from '@/pages/MyEntries'
import { Dashboard } from '@/pages/Dashboard'
import { Entries } from '@/pages/Entries'
import { Expenses } from '@/pages/Expenses'
import { History } from '@/pages/History'
import { EndOfDay } from '@/pages/EndOfDay'
import { BeginningEntry } from '@/pages/BeginningEntry'
import { Users } from '@/pages/Users'
import { Settings } from '@/pages/Settings'
import { NotFound } from '@/pages/NotFound'
import { Forbidden } from '@/pages/Forbidden'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function IndexRedirect() {
  const canReadSummaryAll = useCan('summary:read_all')
  return <Navigate to={canReadSummaryAll ? '/dashboard' : '/home'} replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />

              {/* Protected — wrapped in AppShell */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <Routes>
                        <Route index element={<IndexRedirect />} />
                        <Route
                          path="home"
                          element={
                            <RequirePermission permission="events:create,summary:read_own,events:read_own,events:read_all">
                              <Home />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="sale"
                          element={
                            <RequirePermission permission="events:create">
                              <RecordSale />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="received"
                          element={
                            <RequirePermission permission="events:create">
                              <EggsReceived />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="cracked"
                          element={
                            <RequirePermission permission="events:create">
                              <CrackedEggs />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="expense"
                          element={
                            <RequirePermission permission="expenses:create">
                              <AddExpense />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="my-entries"
                          element={
                            <RequirePermission permission="events:read_own">
                              <MyEntries />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="dashboard"
                          element={
                            <RequirePermission permission="summary:read_all">
                              <Dashboard />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="entries"
                          element={
                            <RequirePermission permission="events:read_all">
                              <Entries />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="expenses"
                          element={
                            <RequirePermission permission="expenses:read">
                              <Expenses />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="history"
                          element={
                            <RequirePermission permission="reports:read">
                              <History />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="end-of-day"
                          element={
                            <RequirePermission permission="closings:manage">
                              <EndOfDay />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="manual-entry"
                          element={
                            <RequirePermission permission="closings:manage">
                              <BeginningEntry />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="beginning-entry"
                          element={
                            <RequirePermission permission="closings:manage">
                              <BeginningEntry />
                            </RequirePermission>
                          }
                        />
                        <Route
                          path="users"
                          element={
                            <RequirePermission permission="users:manage">
                              <Users />
                            </RequirePermission>
                          }
                        />
                        <Route path="settings" element={<Settings />} />
                        <Route path="forbidden" element={<Forbidden />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
