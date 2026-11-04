import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, KeyRound, Shield, Sliders, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { useAuth } from '@/auth/AuthContext'
import { useCan } from '@/auth/useCan'
import { useToast } from '@/components/Toast'
import { authApi } from '@/api/auth'
import { settingsApi } from '@/api/settings'

// Validation schema for password change
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

export function Settings() {
  const { user } = useAuth()
  const { can } = useCan()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'profile' | 'farm'>('profile')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Farm settings state
  const isAdmin = can('settings:manage')
  const [eggsPerCrate, setEggsPerCrate] = useState(30)
  const [currency, setCurrency] = useState('GH₵')
  const [isSavingFarm, setIsSavingFarm] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(() => isAdmin)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  })

  // Load farm settings if admin
  useEffect(() => {
    if (!isAdmin) return
    settingsApi
      .getSettings()
      .then((data) => {
        setEggsPerCrate(data.eggs_per_crate)
        setCurrency(data.currency)
      })
      .catch(() => {
        // Fallback to defaults
      })
      .finally(() => setLoadingSettings(false))
  }, [isAdmin])

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setPasswordError('')
    setPasswordSuccess(false)
    try {
      await authApi.changePassword(data.currentPassword, data.newPassword)
      setPasswordSuccess(true)
      reset()
      toast('Your password has been changed successfully.', 'success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to update password.'
      setPasswordError(typeof msg === 'string' ? msg : 'Current password is incorrect.')
    }
  }

  const onSaveFarmSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingFarm(true)
    try {
      await settingsApi.updateSettings({
        eggs_per_crate: eggsPerCrate,
        currency: currency.trim() || 'GH₵',
      })
      toast('Farm settings updated successfully.', 'success')
    } catch {
      toast('Failed to update farm settings.', 'error')
    } finally {
      setIsSavingFarm(false)
    }
  }

  return (
    <>
      <TopBar title="Settings & Profile" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-content mx-auto space-y-5 sm:space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-border gap-4 sm:gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 pb-3 font-semibold text-sm transition-colors border-b-2 -mb-px ${activeTab === 'profile'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted hover:text-ink'
                }`}
            >
              <KeyRound size={16} />
              Profile & Security
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('farm')}
                className={`flex items-center gap-2 pb-3 font-semibold text-sm transition-colors border-b-2 -mb-px ${activeTab === 'farm'
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-ink'
                  }`}
              >
                <Sliders size={16} />
                Farm Configuration
              </button>
            )}
          </div>

          {/* TAB 1: Profile & Security */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* User info card */}
              <div className="card p-6 md:col-span-1 space-y-4 h-fit">
                <div className="w-14 h-14 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-xl uppercase">
                  {user?.name.charAt(0) ?? 'U'}
                </div>
                <div>
                  <h2 className="text-title-section text-ink">{user?.name}</h2>
                  <p className="text-body-default text-muted">@{user?.username}</p>
                </div>
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted">Account Role:</span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${user?.role === 'admin'
                          ? 'bg-brand-tint text-brand'
                          : 'bg-intake-bg text-intake'
                        }`}
                    >
                      {user?.role === 'admin' ? 'Administrator' : 'Staff Worker'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted">Status:</span>
                    <span className="badge-sale">Active Account</span>
                  </div>
                </div>
              </div>

              {/* Change Password Card */}
              <div className="card p-6 md:col-span-2">
                <div className="flex items-center gap-2.5 mb-1">
                  <Shield size={20} className="text-brand" />
                  <h3 className="text-title-section text-ink">Change Password</h3>
                </div>
                <p className="text-sm text-muted mb-6">
                  Update your account password. Choose a secure password of at least 6 characters.
                </p>

                {passwordError && (
                  <div className="bg-danger-bg border border-danger-border text-danger text-sm rounded px-4 py-3 mb-5">
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div className="bg-success-bg border border-success-border text-success text-sm rounded px-4 py-3 mb-5 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>Your password was updated successfully.</span>
                  </div>
                )}

                <form onSubmit={handleSubmit(onPasswordSubmit)} noValidate className="space-y-4 max-w-form">
                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <label className="block text-label-sm text-ink">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="Enter your current password"
                        className={`input-base pr-10 ${errors.currentPassword ? 'border-danger' : ''}`}
                        {...register('currentPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded transition-colors focus:outline-none"
                        tabIndex={-1}
                        aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                      >
                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.currentPassword && (
                      <p className="text-helper-xs text-danger">{errors.currentPassword.message}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="block text-label-sm text-ink">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Minimum 6 characters"
                        className={`input-base pr-10 ${errors.newPassword ? 'border-danger' : ''}`}
                        {...register('newPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded transition-colors focus:outline-none"
                        tabIndex={-1}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.newPassword && (
                      <p className="text-helper-xs text-danger">{errors.newPassword.message}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block text-label-sm text-ink">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter your new password"
                        className={`input-base pr-10 ${errors.confirmPassword ? 'border-danger' : ''}`}
                        {...register('confirmPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded transition-colors focus:outline-none"
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-helper-xs text-danger">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary mt-4"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Updating Password…
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Farm Configuration (Admin only) */}
          {activeTab === 'farm' && isAdmin && (
            <div className="card p-6 max-w-form">
              <h3 className="text-title-section text-ink mb-1">Farm Operation Settings</h3>
              <p className="text-sm text-muted mb-6">
                These settings configure unit conversion calculations and currency display across all worker stations.
              </p>

              {loadingSettings ? (
                <div className="py-8 text-center text-muted">
                  <Loader2 size={24} className="animate-spin text-brand mx-auto mb-2" />
                  Loading farm settings…
                </div>
              ) : (
                <form onSubmit={onSaveFarmSettings} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-label-sm text-ink">Eggs per Crate</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={eggsPerCrate}
                      onChange={(e) => setEggsPerCrate(parseInt(e.target.value) || 30)}
                      className="input-base"
                    />
                    <p className="text-helper-xs text-muted">
                      Standard industry crate size in Ghana is 30 eggs per crate.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-label-sm text-ink">Currency Symbol / Token</label>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="input-base"
                    />
                    <p className="text-helper-xs text-muted">Default is Ghana Cedi (GH₵).</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingFarm}
                    className="btn-primary"
                  >
                    {isSavingFarm ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save Farm Settings'
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
