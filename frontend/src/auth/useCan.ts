import { useAuth } from './AuthContext'

export function useCan(): { can: (permission: string) => boolean }
export function useCan(permission: string): boolean
export function useCan(permission?: string): { can: (permission: string) => boolean } | boolean {
  const { permissions } = useAuth()

  const can = (perm: string): boolean =>
    permissions.includes('*') || permissions.includes(perm)

  if (typeof permission === 'string') {
    return can(permission)
  }

  return { can }
}
