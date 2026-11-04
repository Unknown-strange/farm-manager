import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Already logged in → redirect immediately
  if (user) {
    const dest = user.permissions.includes('*') || user.permissions.includes('summary:read_all')
      ? '/dashboard'
      : '/home'
    navigate(dest, { replace: true })
    return null
  }

  const onSubmit = async (data: FormValues) => {
    setServerError('')
    try {
      const me = await login(data.username, data.password)
      const hasAdminAccess = me.permissions.includes('*') || me.permissions.includes('summary:read_all')
      const defaultDest = hasAdminAccess ? '/dashboard' : '/home'
      const dest = sessionStorage.getItem('postLoginRedirect') ?? defaultDest
      sessionStorage.removeItem('postLoginRedirect')
      navigate(dest, { replace: true })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      if (!axiosErr.response) {
        setServerError('Cannot connect to backend server. Make sure the API is running at http://localhost:8000.')
      } else {
        const detail = axiosErr.response?.data?.detail
        setServerError(typeof detail === 'string' ? detail : 'Wrong username or password.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-login">
        {/* Logo & title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/favicon.svg"
              alt="Egg Book logo"
              className="w-14 h-14 rounded-xl shadow-card select-none"
            />
          </div>
          <h1 className="text-title-page text-ink">Egg Book</h1>
          <p className="text-body-default text-muted mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="card p-5 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Server error */}
            {serverError && (
              <div className="bg-danger-bg border border-danger-border text-danger text-sm rounded px-4 py-3">
                {serverError}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-label-sm text-ink">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoFocus
                autoComplete="username"
                className={`input-base ${errors.username ? 'border-danger' : ''}`}
                placeholder="Enter your username"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-helper-xs text-danger">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-label-sm text-ink">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={`input-base ${errors.password ? 'border-danger' : ''}`}
                placeholder="Enter your password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-helper-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-helper-xs text-muted mt-6">
          Egg Book — Farm Management System
        </p>
      </div>
    </div>
  )
}

