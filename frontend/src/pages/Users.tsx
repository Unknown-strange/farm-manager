import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, KeyRound, UserCheck, UserX, Trash2, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { DataTable } from '@/components/DataTable'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/auth/AuthContext'
import { usersApi, type User } from '@/api/users'
import { formatDate } from '@/lib/dates'

// Validation for creating user
const createUserSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['staff', 'admin']),
})

type CreateUserFormValues = z.infer<typeof createUserSchema>

export function Users() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Add User modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addError, setAddError] = useState('')

  // Toggle active confirmation
  const [toggleTarget, setToggleTarget] = useState<User | null>(null)
  const [isToggling, setIsToggling] = useState(false)

  // Soft delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [newTempPassword, setNewTempPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  // Password visibility toggles
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)

  const [selectedRole, setSelectedRole] = useState<'staff' | 'admin'>('staff')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'staff' },
  })

  const reloadUsers = useCallback(async () => {
    try {
      const data = await usersApi.getUsers()
      setUsers(data)
    } catch {
      toast('Failed to load user accounts.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    usersApi
      .getUsers()
      .then(setUsers)
      .catch(() => toast('Failed to load user accounts.', 'error'))
      .finally(() => setIsLoading(false))
  }, [toast])

  const onAddUserSubmit = async (data: CreateUserFormValues) => {
    setAddError('')
    try {
      await usersApi.createUser({
        name: data.name.trim(),
        username: data.username.trim().toLowerCase(),
        password: data.password,
        role: data.role,
      })
      toast(`User @${data.username} created successfully.`, 'success')
      setIsAddModalOpen(false)
      reset({ role: 'staff' })
      setSelectedRole('staff')
      reloadUsers()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setAddError(typeof detail === 'string' ? detail : 'Failed to create user. Username may already exist.')
    }
  }

  const handleConfirmToggleActive = async () => {
    if (!toggleTarget) return
    setIsToggling(true)
    try {
      const newStatus = !toggleTarget.is_active
      await usersApi.updateUser(toggleTarget.id, {
        is_active: newStatus,
        is_deleted: newStatus ? false : toggleTarget.is_deleted,
      })
      toast(
        `Account @${toggleTarget.username} has been ${newStatus ? 'activated' : 'deactivated'}.`,
        'success'
      )
      setToggleTarget(null)
      reloadUsers()
    } catch {
      toast('Failed to update account status.', 'error')
    } finally {
      setIsToggling(false)
    }
  }

  const handleConfirmDeleteUser = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await usersApi.deleteUser(deleteTarget.id)
      toast(
        `@${deleteTarget.username} was removed from system access. All their historical data remains preserved.`,
        'success'
      )
      setDeleteTarget(null)
      reloadUsers()
    } catch {
      toast('Failed to delete user account.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    if (newTempPassword.length < 6) {
      setResetError('Password must be at least 6 characters.')
      return
    }
    setResetError('')
    setIsResetting(true)
    try {
      await usersApi.resetPassword(resetTarget.id, newTempPassword)
      toast(`Password for @${resetTarget.username} was reset successfully.`, 'success')
      setResetTarget(null)
      setNewTempPassword('')
    } catch {
      setResetError('Failed to reset password.')
    } finally {
      setIsResetting(false)
    }
  }

  const columns = [
    {
      key: 'user',
      header: 'Staff Member / Admin',
      render: (u: User) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
            {u.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-ink leading-tight">{u.name}</p>
            <p className="text-xs text-muted">@{u.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u: User) => (
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${u.role === 'admin'
              ? 'bg-brand-tint text-brand'
              : 'bg-intake-bg text-intake'
            }`}
        >
          {u.role === 'admin' ? 'Administrator' : 'Staff Worker'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Account Status',
      render: (u: User) => {
        if (u.is_deleted) {
          return (
            <span className="badge-cracked" title="Access revoked via soft-delete; historical records preserved">
              Deleted (Data Kept)
            </span>
          )
        }
        return (
          <span className={u.is_active ? 'badge-sale' : 'badge-neutral'}>
            {u.is_active ? 'Active' : 'Deactivated'}
          </span>
        )
      },
    },
    {
      key: 'created',
      header: 'Created On',
      render: (u: User) => (
        <span className="text-muted text-xs">{formatDate(u.created_at.slice(0, 10))}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (u: User) => {
        const isSelf = currentUser?.id === u.id
        return (
          <div className="flex items-center justify-end gap-1.5">
            {/* Reset password button */}
            {!u.is_deleted && (
              <button
                onClick={() => {
                  setResetTarget(u)
                  setNewTempPassword('')
                  setResetError('')
                  setShowResetPassword(false)
                }}
                title="Reset Password"
                className="p-1.5 rounded hover:bg-canvas text-muted hover:text-ink transition-colors"
              >
                <KeyRound size={16} />
              </button>
            )}

            {/* Toggle active / restore button */}
            {!isSelf && (
              <button
                onClick={() => setToggleTarget(u)}
                title={u.is_active ? 'Deactivate Account' : 'Restore / Activate Account'}
                className={`p-1.5 rounded transition-colors ${u.is_active
                    ? 'hover:bg-warn-bg text-muted hover:text-warn'
                    : 'hover:bg-success-bg text-muted hover:text-success'
                  }`}
              >
                {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
              </button>
            )}

            {/* Soft Delete button */}
            {!isSelf && !u.is_deleted && (
              <button
                onClick={() => setDeleteTarget(u)}
                title="Delete Staff Account (Soft Delete — Preserves Data)"
                className="p-1.5 rounded hover:bg-danger-bg text-muted hover:text-danger transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <TopBar
        title="User Accounts"
        right={
          <button
            onClick={() => {
              reset({ role: 'staff' })
              setAddError('')
              setShowAddPassword(false)
              setIsAddModalOpen(true)
            }}
            className="btn-primary"
          >
            <UserPlus size={16} />
            <span>Add User</span>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-content mx-auto space-y-5 sm:space-y-6">
          {/* Quick stats strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4">
              <span className="stat-label">Total Accounts</span>
              <p className="text-display-md font-bold text-ink mt-1">{users.length}</p>
            </div>
            <div className="card p-4">
              <span className="stat-label">Active Staff</span>
              <p className="text-display-md font-bold text-intake mt-1">
                {users.filter((u) => u.role === 'staff' && u.is_active && !u.is_deleted).length}
              </p>
            </div>
            <div className="card p-4">
              <span className="stat-label">Administrators</span>
              <p className="text-display-md font-bold text-brand mt-1">
                {users.filter((u) => u.role === 'admin' && u.is_active && !u.is_deleted).length}
              </p>
            </div>
          </div>

          {/* Data preservation banner */}
          <div className="card p-3.5 sm:px-5 bg-brand-tint/40 border-brand/20 flex items-start sm:items-center gap-3">
            <ShieldCheck size={18} className="text-brand flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm text-ink">
              <strong>Permanent Ledger Protection:</strong> Deleting or deactivating a staff member immediately revokes their login access via soft-delete, while <strong>100% of their recorded sales, egg counts, and expenses remain permanently preserved</strong> in the farm book.
            </p>
          </div>

          {/* User Table */}
          <DataTable
            columns={columns}
            data={users}
            isLoading={isLoading}
            keyFn={(u) => String(u.id)}
            emptyMessage="No users found. Click '+ Add User' to invite staff."
            rowClassName={(u) => (!u.is_active || u.is_deleted ? 'opacity-60 bg-canvas/40' : '')}
          />
        </div>
      </div>

      {/* MODAL 1: Add User */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New User Account"
        maxWidth="max-w-form"
      >
        <form onSubmit={handleSubmit(onAddUserSubmit)} noValidate className="space-y-4">
          {addError && (
            <div className="bg-danger-bg border border-danger-border text-danger text-sm rounded px-4 py-3">
              {addError}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-label-sm text-ink">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Kwame Asante"
              className={`input-base ${errors.name ? 'border-danger' : ''}`}
              {...register('name')}
            />
            {errors.name && <p className="text-helper-xs text-danger">{errors.name.message}</p>}
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-label-sm text-ink">Username (Login ID)</label>
            <input
              type="text"
              placeholder="e.g. kwame"
              className={`input-base ${errors.username ? 'border-danger' : ''}`}
              {...register('username')}
            />
            {errors.username && (
              <p className="text-helper-xs text-danger">{errors.username.message}</p>
            )}
          </div>

          {/* Initial Password */}
          <div className="space-y-1.5">
            <label className="block text-label-sm text-ink">Initial Password</label>
            <div className="relative">
              <input
                type={showAddPassword ? 'text' : 'password'}
                placeholder="Minimum 6 characters"
                className={`input-base pr-10 ${errors.password ? 'border-danger' : ''}`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowAddPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded transition-colors focus:outline-none"
                tabIndex={-1}
                aria-label={showAddPassword ? 'Hide password' : 'Show password'}
              >
                {showAddPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-helper-xs text-danger">{errors.password.message}</p>
            )}
          </div>

          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="block text-label-sm text-ink">User Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setValue('role', 'staff')
                  setSelectedRole('staff')
                }}
                className={`py-2.5 px-3 rounded text-sm font-semibold border text-center transition-colors ${selectedRole === 'staff'
                    ? 'border-brand bg-brand-tint text-brand shadow-sm'
                    : 'border-border bg-card text-muted hover:border-brand/40'
                  }`}
              >
                Staff (Worker Station)
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('role', 'admin')
                  setSelectedRole('admin')
                }}
                className={`py-2.5 px-3 rounded text-sm font-semibold border text-center transition-colors ${selectedRole === 'admin'
                    ? 'border-brand bg-brand-tint text-brand shadow-sm'
                    : 'border-border bg-card text-muted hover:border-brand/40'
                  }`}
              >
                Admin (Full Access)
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating Account…
                </>
              ) : (
                'Create User'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Reset Password */}
      <Modal
        isOpen={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Reset Password for @${resetTarget?.username}`}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-muted">
            Set a new temporary password for <strong>{resetTarget?.name}</strong>. They can change it once logged in.
          </p>

          {resetError && (
            <div className="bg-danger-bg border border-danger-border text-danger text-sm rounded px-3 py-2">
              {resetError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-label-sm text-ink">New Password</label>
            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                placeholder="Minimum 6 characters"
                value={newTempPassword}
                onChange={(e) => setNewTempPassword(e.target.value)}
                className="input-base pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowResetPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded transition-colors focus:outline-none"
                tabIndex={-1}
                aria-label={showResetPassword ? 'Hide password' : 'Show password'}
              >
                {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResetting}
              className="btn-primary"
            >
              {isResetting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Resetting…
                </>
              ) : (
                'Save Password'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM: Toggle Active */}
      <ConfirmDialog
        isOpen={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleConfirmToggleActive}
        isLoading={isToggling}
        title={toggleTarget?.is_active ? 'Deactivate User Account' : 'Restore / Activate User Account'}
        message={
          toggleTarget?.is_active
            ? `Are you sure you want to deactivate @${toggleTarget?.username}? They will be immediately blocked from logging in, while all their recorded data remains intact.`
            : `Are you sure you want to reactivate @${toggleTarget?.username}? They will be able to log in again.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
      />

      {/* CONFIRM: Soft Delete User */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteUser}
        isLoading={isDeleting}
        title="Delete Staff Account (Soft Delete)"
        message={`Are you sure you want to delete @${deleteTarget?.username} (${deleteTarget?.name})? They will immediately lose all access to the system. Their account will be soft-deleted so 100% of their recorded sales, egg counts, and expenses are permanently preserved.`}
        confirmLabel="Delete Account"
      />
    </>
  )
}
