import type React from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: React.ReactNode
  confirmLabel?: string
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isLoading,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex gap-3 mb-5">
        <AlertTriangle size={20} className="text-warn flex-shrink-0 mt-0.5" />
        <div className="text-body-default text-ink flex-1">{message}</div>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-outline" disabled={isLoading}>
          Cancel
        </button>
        <button
          onClick={() => onConfirm()}
          className="btn-danger"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

