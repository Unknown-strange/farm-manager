import { type ReactNode, createContext, useContext, useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  ShoppingCart,
  Package,
  EggOff,
  ClipboardList,
  LayoutDashboard,
  List,
  DollarSign,
  History,
  Moon,
} from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/auth/AuthContext'

interface MobileMenuContextValue {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  toggleMobileMenu: () => void
}

const MobileMenuContext = createContext<MobileMenuContextValue>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobileMenu: () => {},
})

export function useMobileMenu() {
  return useContext(MobileMenuContext)
}

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Close mobile drawer automatically on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.search])

  const bottomNavItems = isAdmin
    ? [
        { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={19} /> },
        { label: 'Entries', to: '/entries', icon: <List size={19} /> },
        { label: 'Expenses', to: '/expenses', icon: <DollarSign size={19} /> },
        { label: 'Summary', to: '/end-of-day', icon: <Moon size={19} /> },
        { label: 'History', to: '/history', icon: <History size={19} /> },
      ]
    : [
        { label: 'Home', to: '/home', icon: <Home size={19} /> },
        { label: 'Sale', to: '/sale', icon: <ShoppingCart size={19} /> },
        { label: 'Received', to: '/received', icon: <Package size={19} /> },
        { label: 'Cracked', to: '/cracked', icon: <EggOff size={19} /> },
        { label: 'My Entries', to: '/my-entries', icon: <ClipboardList size={19} /> },
      ]

  return (
    <MobileMenuContext.Provider
      value={{
        mobileOpen,
        setMobileOpen,
        toggleMobileMenu: () => setMobileOpen((prev) => !prev),
      }}
    >
      <div className="flex h-screen bg-canvas overflow-hidden">
        <Sidebar />

        {/* Main workspace — full width on mobile/tablet, offset by sidebar on desktop */}
        <main className="flex-1 w-full min-w-0 ml-0 lg:ml-sidebar flex flex-col overflow-hidden">
          {children}
        </main>

        {/* Mobile Bottom Quick-Navigation Bar */}
        <nav
          aria-label="Mobile quick navigation"
          className="fixed bottom-0 inset-x-0 h-16 bg-card border-t border-border z-30 flex items-center justify-around px-1 lg:hidden shadow-card"
        >
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 h-full py-1 px-1 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-brand' : 'text-muted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`p-1 rounded-md ${
                      isActive ? 'bg-brand-tint text-brand' : 'text-muted'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate max-w-[68px] mt-0.5">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </MobileMenuContext.Provider>
  )
}
