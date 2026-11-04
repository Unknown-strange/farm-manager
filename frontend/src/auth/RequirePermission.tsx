import { Navigate } from 'react-router-dom'
import { useCan } from './useCan'
import { type ReactNode } from 'react'

interface RequirePermissionProps {
  permission: string
  children: ReactNode
}

export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can } = useCan()

  if (!can(permission)) {
    return <Navigate to="/forbidden" replace />
  }

  return <>{children}</>
}

