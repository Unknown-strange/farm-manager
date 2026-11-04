import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  ShoppingCart,
  Package,
  EggOff,
  Receipt,
  ClipboardList,
  LayoutDashboard,
  List,
  DollarSign,
  History,
  Moon,
  Users,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useCan } from '@/auth/useCan'
import { useMobileMenu } from './AppShell'

export interface NavItem {
  label: string
  to: string
  icon: ReactNode
  permission?: string
}

// From Home to My Entries: shown in the Top Nav Bar for Admin, and in the Sidebar for normal users
export const WORKER_NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/home', icon: <Home size={18} />, permission: 'events:create' },
  { label: 'Record Sale', to: '/sale', icon: <ShoppingCart size={18} />, permission: 'events:create' },
  { label: 'Eggs Received', to: '/received', icon: <Package size={18} />, permission: 'events:create' },
  { label: 'Cracked Eggs', to: '/cracked', icon: <EggOff size={18} />, permission: 'events:create' },
  { label: 'Add Expense', to: '/expense', icon: <Receipt size={18} />, permission: 'expenses:create' },
  { label: 'My Entries', to: '/my-entries', icon: <ClipboardList size={18} />, permission: 'events:read_own' },
]

// Admin Suite items: shown in the Sidebar for Admin
export const ADMIN_SIDEBAR_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} />, permission: 'summary:read_all' },
  { label: 'Entries', to: '/entries', icon: <List size={18} />, permission: 'events:read_all' },
  { label: 'Expenses', to: '/expenses', icon: <DollarSign size={18} />, permission: 'expenses:read' },
  { label: 'History', to: '/history', icon: <History size={18} />, permission: 'reports:read' },
  { label: 'Summary', to: '/end-of-day', icon: <Moon size={18} />, permission: 'closings:manage' },
  { label: 'Users', to: '/users', icon: <Users size={18} />, permission: 'users:manage' },
  { label: 'Settings', to: '/settings', icon: <Settings size={18} /> },
]

export const NAV_ITEMS: NavItem[] = [...WORKER_NAV_ITEMS, ...ADMIN_SIDEBAR_NAV_ITEMS]

export function Sidebar() {
  const { user, logout } = useAuth()
  const { can } = useCan()
  const navigate = useNavigate()
  const { mobileOpen, setMobileOpen } = useMobileMenu()

  const handleLogout = () => {
    setMobileOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  const isAdmin = user?.role === 'admin'

  // For Admin: Sidebar only displays ADMIN_SIDEBAR_NAV_ITEMS (Home -> My Entries are in TopBar).
  // For normal users (staff): Sidebar displays all permitted items the way it always did.
  const sidebarItems = isAdmin
    ? ADMIN_SIDEBAR_NAV_ITEMS.filter((item) => !item.permission || can(item.permission))
    : NAV_ITEMS.filter((item) => !item.permission || can(item.permission))

  return (
    <>
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-sidebar bg-card border-r border-border flex flex-col z-50 transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0 shadow-modal' : '-translate-x-full'
        } lg:translate-x-0 lg:z-40`}
        aria-label="Main navigation"
      >
        {/* Brand header */}
        <div className="px-4 pt-5 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <img
                src="/favicon.svg"
                alt="Egg Book logo"
                className="w-8 h-8 rounded-md flex-shrink-0 select-none"
              />
              <span className="text-[17px] font-bold text-ink tracking-tight">Egg Book</span>
            </div>
            <span
              className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-brand-tint text-brand' : 'bg-intake-bg text-intake'
              }`}
            >
              {isAdmin ? 'Admin Suite' : 'Worker Station'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-muted hover:text-ink hover:bg-canvas transition-colors"
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 h-11 lg:h-10 px-3 rounded text-sm font-medium transition-colors duration-100 ${
                  isActive
                    ? 'bg-brand-tint text-brand'
                    : 'text-muted hover:bg-canvas hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-brand' : 'text-muted'}>{item.icon}</span>
                  {item.label}
                  {isActive && (
                    <span className="ml-auto w-[3px] h-5 bg-brand rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + logout at bottom */}
        <div className="px-3 pb-5 pt-3 border-t border-border space-y-1">
          {user && (
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-ink truncate">{user.name}</p>
              <p className="text-xs text-muted capitalize">{user.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 h-11 lg:h-10 px-3 w-full rounded text-sm font-medium text-muted hover:bg-canvas hover:text-ink transition-colors duration-100"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}
