import { type ReactNode, useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, User as UserIcon, LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useCan } from '@/auth/useCan'
import { WORKER_NAV_ITEMS } from './Sidebar'
import { useMobileMenu } from './AppShell'

interface TopBarProps {
  title: string
  right?: ReactNode
}

export function TopBar({ title, right }: TopBarProps) {
  const { user, logout } = useAuth()
  const { can } = useCan()
  const navigate = useNavigate()
  const { toggleMobileMenu } = useMobileMenu()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isAdmin = user?.role === 'admin'
  const topAdminItems = WORKER_NAV_ITEMS.filter(
    (item) => !item.permission || can(item.permission),
  )

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const hamburgerButton = (
    <button
      type="button"
      onClick={toggleMobileMenu}
      className="lg:hidden p-2 -ml-1 rounded-md text-ink hover:bg-canvas transition-colors flex-shrink-0"
      aria-label="Open navigation menu"
    >
      <Menu size={22} />
    </button>
  )

  const userProfileDropdown = user && (
    <div className="relative flex-shrink-0" ref={menuRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg border border-transparent hover:border-border hover:bg-canvas transition-colors"
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
      >
        <div className="w-8 h-8 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-xs uppercase">
          {user.name.charAt(0)}
        </div>
        <div className="text-left hidden md:block">
          <span className="block text-sm font-semibold text-ink leading-tight">{user.name}</span>
          <span className="block text-[11px] text-muted capitalize leading-none">{user.role}</span>
        </div>
        <ChevronDown size={14} className="text-muted" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-modal py-1.5 z-50">
          <div className="px-4 py-2 border-b border-border mb-1">
            <p className="text-xs text-muted">Signed in as</p>
            <p className="text-sm font-semibold text-ink truncate">@{user.username}</p>
          </div>

          <button
            onClick={() => {
              setDropdownOpen(false)
              navigate('/settings')
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-canvas hover:text-brand transition-colors text-left"
          >
            <UserIcon size={16} className="text-muted" />
            Profile &amp; Settings
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger-bg transition-colors text-left border-t border-border mt-1 pt-2"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )

  // Normal users (staff): keep single top bar layout, with mobile hamburger menu button
  if (!isAdmin) {
    return (
      <header className="min-h-[60px] py-2 bg-card border-b border-border flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 flex-shrink-0 relative">
        <div className="flex items-center gap-2.5 min-w-0">
          {hamburgerButton}
          <h1 className="text-lg sm:text-title-page font-bold text-ink truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          {right}
          {userProfileDropdown}
        </div>
      </header>
    )
  }

  // Admin: Top Nav Bar with Home -> My Entries + Page Header Bar
  return (
    <header className="bg-card border-b border-border flex-shrink-0 relative">
      {/* Top Navbar Row for Admin: Home -> My Entries */}
      <div className="px-4 sm:px-6 lg:px-8 py-2 border-b border-border/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hamburgerButton}
          <nav
            className="flex items-center gap-1 overflow-x-auto py-0.5 flex-1"
            aria-label="Admin station quick navigation"
          >
            {topAdminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors duration-100 flex-shrink-0 ${
                    isActive
                      ? 'bg-brand-tint text-brand'
                      : 'text-muted hover:bg-canvas hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-brand' : 'text-muted'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {userProfileDropdown}
      </div>

      {/* Page Title & Actions Row */}
      <div className="min-h-[52px] py-2 px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2 bg-canvas/30">
        <h1 className="text-lg sm:text-title-page font-bold text-ink">{title}</h1>
        {right && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{right}</div>}
      </div>
    </header>
  )
}
