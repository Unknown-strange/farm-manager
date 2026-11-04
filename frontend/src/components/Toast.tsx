import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle size={18} className="text-success" />,
  error: <XCircle size={18} className="text-danger" />,
  info: <Info size={18} className="text-brand" />,
}

const BG: Record<ToastVariant, string> = {
  success: 'border-l-4 border-success bg-card',
  error: 'border-l-4 border-danger bg-card',
  info: 'border-l-4 border-brand bg-card',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-[100] flex flex-col gap-2 sm:min-w-[280px] sm:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${BG[t.variant]} shadow-modal rounded flex items-start gap-3 px-4 py-3 animate-in fade-in slide-in-from-right-4 duration-200`}
          >
            <span className="flex-shrink-0 mt-0.5">{ICONS[t.variant]}</span>
            <p className="text-body-default text-ink flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink ml-1">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.toast
}

