import { Navigate } from 'react-router-dom'
import { useCan } from './useCan'
import { type ReactNode } from 'react'

interface RequirePermissionProps {
  permission: string
  children: ReactNode
}

export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can } = useCan()
  const perms = permission.split(',').map((p) => p.trim()).filter(Boolean)
  const isAllowed = perms.length === 0 || perms.some((p) => can(p))

  if (!isAllowed) {
    return <Navigate to="/forbidden" replace />
  }

  return <>{children}</>
}

