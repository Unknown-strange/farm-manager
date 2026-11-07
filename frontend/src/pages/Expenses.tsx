import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Ban, Loader2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { DatePicker } from '@/components/DatePicker'
import { StatCard } from '@/components/StatCard'
import { TypeTag } from '@/components/TypeTag'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CurrencyInput } from '@/components/CurrencyInput'
import { useToast } from '@/components/Toast'
import { useCan } from '@/auth/useCan'
import { expensesApi, type Expense, type ExpenseCategory } from '@/api/expenses'
import { formatMoney } from '@/lib/money'
import { todayString, formatDate, formatTime } from '@/lib/dates'

export function Expenses() {
  const today = todayString()
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | ''>('')
  const toast = useToast()
  const queryClient = useQueryClient()

  const canEdit = useCan('expenses:edit')
  const canVoid = useCan('expenses:edit')

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [newCategory, setNewCategory] = useState<'feed' | 'crates' | 'other'>('feed')
  const [newIsBorrowed, setNewIsBorrowed] = useState<boolean>(false)
  const [newName, setNewName] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'borrowed'>('all')

  // Edit Modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editCategory, setEditCategory] = useState<'feed' | 'crates' | 'other'>('feed')
  const [editIsBorrowed, setEditIsBorrowed] = useState<boolean>(false)
  const [editName, setEditName] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editAmount, setEditAmount] = useState('')

  // Void Dialog state
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null)

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', { date: selectedDate, category: selectedCategory }],
    queryFn: () =>
      expensesApi.getExpenses({
        date: selectedDate,
        category: selectedCategory,
      }),
  })

  // Normalize legacy category == 'borrowed' based on name
  const getNormCat = (e: Expense): 'feed' | 'crates' | 'other' => {
    if (e.category === 'feed') return 'feed'
    if (e.category === 'crates') return 'crates'
    if (e.category === 'borrowed') {
      const nl = (e.name || '').toLowerCase()
      if (nl.includes('feed')) return 'feed'
      if (nl.includes('crate')) return 'crates'
    }
    return 'other'
  }

  const activeExpenses = expenses.filter((e) => !e.voided)

  const feedPaidTotal = activeExpenses
    .filter((e) => getNormCat(e) === 'feed' && e.paid !== false)
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const feedBorrowedTotal = activeExpenses
    .filter((e) => getNormCat(e) === 'feed' && e.paid === false)
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const feedTotal = feedPaidTotal + feedBorrowedTotal

  const cratesPaidTotal = activeExpenses
    .filter((e) => getNormCat(e) === 'crates' && e.paid !== false)
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const cratesBorrowedTotal = activeExpenses
    .filter((e) => getNormCat(e) === 'crates' && e.paid === false)
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const cratesTotal = cratesPaidTotal + cratesBorrowedTotal

  const otherPaidTotal = activeExpenses
    .filter((e) => getNormCat(e) === 'other' && e.paid !== false)
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const otherBorrowedTotal = activeExpenses
    .filter((e) => getNormCat(e) === 'other' && e.paid === false)
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const otherTotal = otherPaidTotal + otherBorrowedTotal

  const borrowedUnpaidTotal = activeExpenses
    .filter((e) => e.paid === false)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const grandTotalSpent = feedPaidTotal + cratesPaidTotal + otherPaidTotal
  const grandTotalExpenses = feedTotal + cratesTotal + otherTotal

  const createMutation = useMutation({
    mutationFn: () =>
      expensesApi.createExpense({
        category: newCategory,
        name:
          newCategory === 'feed'
            ? newName.trim() || 'Feed'
            : newCategory === 'crates'
              ? newName.trim() || 'Crates'
              : newName.trim(),
        quantity: newQuantity.trim() || undefined,
        amount: parseFloat(newAmount),
        is_borrowed: newIsBorrowed,
        business_date: selectedDate,
      }),
    onSuccess: () => {
      const catLabel = newCategory === 'feed' ? 'Feed' : newCategory === 'crates' ? 'Crates' : 'Expense'
      toast(
        newIsBorrowed
          ? `Borrowed ${catLabel} added (pending payment)`
          : `${catLabel} expense added and deducted from cash`,
        'success',
      )
      setCreateOpen(false)
      setNewName('')
      setNewQuantity('')
      setNewAmount('')
      setNewIsBorrowed(false)
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to add expense'
      toast(msg, 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: number
      category: ExpenseCategory
      name: string
      quantity?: string
      amount: number
      is_borrowed?: boolean
    }) =>
      expensesApi.updateExpense(payload.id, {
        category: payload.category,
        name: payload.name,
        quantity: payload.quantity,
        amount: payload.amount,
        is_borrowed: payload.is_borrowed,
      }),
    onSuccess: () => {
      toast('Expense updated', 'success')
      setEditingExpense(null)
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update expense'
      toast(msg, 'error')
    },
  })

  const voidMutation = useMutation({
    mutationFn: (id: number) => expensesApi.voidExpense(id),
    onSuccess: () => {
      toast('Expense voided', 'info')
      setVoidingExpense(null)
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to void expense'
      toast(msg, 'error')
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCategory === 'other' && !newName.trim()) {
      toast('Item name is required for Other expenses', 'error')
      return
    }
    const amt = parseFloat(newAmount)
    if (isNaN(amt) || amt <= 0) {
      toast('Enter a valid amount', 'error')
      return
    }
    createMutation.mutate()
  }

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp)
    setEditCategory(getNormCat(exp))
    setEditIsBorrowed(Boolean(exp.is_borrowed || exp.category === 'borrowed' || exp.paid === false))
    setEditName(exp.name)
    setEditQuantity(exp.quantity ?? '')
    setEditAmount(String(exp.amount))
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExpense) return
    const amt = parseFloat(editAmount)
    if (isNaN(amt) || amt <= 0) {
      toast('Enter a valid amount', 'error')
      return
    }
    updateMutation.mutate({
      id: editingExpense.id,
      category: editCategory,
      name:
        editCategory === 'feed'
          ? editName.trim() || 'Feed'
          : editCategory === 'crates'
            ? editName.trim() || 'Crates'
            : editName.trim() || 'Expense',
      quantity: editQuantity.trim() || undefined,
      amount: amt,
      is_borrowed: editIsBorrowed,
    })
  }

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => expensesApi.markPaid(id),
    onSuccess: (updated) => {
      toast(
        `Borrowed expense marked as Paid! ${formatMoney(Number(updated.amount))} deducted from Money We Have.`,
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: () => toast('Failed to mark borrowed expense as paid', 'error'),
  })

  const markUnpaidMutation = useMutation({
    mutationFn: (id: number) => expensesApi.markUnpaid(id),
    onSuccess: () => {
      toast('Reverted borrowed expense to Unpaid.', 'info')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: () => toast('Failed to update borrowed expense status', 'error'),
  })

  const categoryChips: { label: string; value: ExpenseCategory | '' }[] = [
    { label: 'All Categories', value: '' },
    { label: 'Feed', value: 'feed' },
    { label: 'Crates', value: 'crates' },
    { label: 'Other', value: 'other' },
  ]

  const displayedExpenses = activeExpenses.filter((e) => {
    if (selectedCategory && getNormCat(e) !== selectedCategory) return false
    if (statusFilter === 'paid' && e.paid === false) return false
    if (statusFilter === 'borrowed' && e.paid !== false) return false
    return true
  })

  return (
    <>
      <TopBar
        title="Expenses"
        right={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary h-10 px-3.5 text-xs"
            >
              <Plus size={15} />
              Add Expense
            </button>
            <DatePicker value={selectedDate} onChange={setSelectedDate} />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-page mx-auto space-y-5 sm:space-y-6">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Feed Total"
              value={formatMoney(feedTotal)}
              helper={`Paid: ${formatMoney(feedPaidTotal)} · Borrowed: ${formatMoney(feedBorrowedTotal)}`}
              variant="brand"
            />
            <StatCard
              label="Crates Total"
              value={formatMoney(cratesTotal)}
              helper={`Paid: ${formatMoney(cratesPaidTotal)} · Borrowed: ${formatMoney(cratesBorrowedTotal)}`}
              variant="intake"
            />
            <StatCard
              label="Other Total"
              value={formatMoney(otherTotal)}
              helper={`Paid: ${formatMoney(otherPaidTotal)} · Borrowed: ${formatMoney(otherBorrowedTotal)}`}
              variant="neutral"
            />
            <StatCard
              label="Borrowed (Unpaid)"
              value={formatMoney(borrowedUnpaidTotal)}
              helper="Not deducted from cash until paid"
              variant="warn"
            />
            <StatCard
              label="Grand Total Spent (Cash)"
              value={formatMoney(grandTotalSpent)}
              helper={`Total: ${formatMoney(grandTotalExpenses)} · Cash: ${formatMoney(grandTotalSpent)}`}
              variant="danger"
            />
          </div>

          {/* Filter Chips & Sub-status Controls */}
          <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted mr-1">Category:</span>
              {categoryChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setSelectedCategory(chip.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    selectedCategory === chip.value
                      ? 'bg-brand text-white'
                      : 'bg-canvas text-muted hover:text-ink border border-border'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-xs font-semibold text-muted mr-1">Status:</span>
              {(['all', 'paid', 'borrowed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                    statusFilter === st
                      ? 'bg-ink text-canvas border-ink'
                      : 'bg-card text-muted border-border hover:text-ink'
                  }`}
                >
                  {st === 'all' ? 'All' : st === 'paid' ? 'Paid' : 'Borrowed'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="py-12 flex items-center justify-center text-muted gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading expenses...</span>
              </div>
            ) : displayedExpenses.length === 0 ? (
              <div className="py-12 text-center text-muted text-body-default">
                No matching expenses found for {formatDate(selectedDate)}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-canvas border-b border-border">
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Time
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Category
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Item Name
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Quantity
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Recorded By
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Amount
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {displayedExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className={`hover:bg-canvas/60 transition-colors ${exp.voided ? 'opacity-50 line-through' : ''
                          }`}
                      >
                        <td className="py-3.5 px-6 text-muted tabular-nums whitespace-nowrap">
                          {formatTime(exp.created_at)}
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <TypeTag type={getNormCat(exp)} />
                            {exp.paid === false ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warn-bg text-warn border border-warn/30">
                                Borrowed (Unpaid)
                              </span>
                            ) : (exp.is_borrowed || exp.category === 'borrowed') ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success-bg text-success border border-success/30">
                                Paid Borrowed
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-canvas text-muted border border-border">
                                Paid
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-6 font-medium text-ink">{exp.name}</td>
                        <td className="py-3.5 px-6 text-muted">{exp.quantity || '—'}</td>
                        <td className="py-3.5 px-6 text-muted">
                          {exp.created_by_name || `User #${exp.created_by}`}
                        </td>
                        <td className="py-3.5 px-6 text-right font-semibold text-ink tabular-nums whitespace-nowrap">
                          {formatMoney(Number(exp.amount))}
                        </td>
                        <td className="py-3.5 px-6 text-right whitespace-nowrap">
                          {exp.voided ? (
                            <span className="badge-neutral">Voided</span>
                          ) : (
                            <div className="inline-flex items-center gap-3">
                              {canEdit && exp.paid === false && (
                                <button
                                  onClick={() => markPaidMutation.mutate(exp.id)}
                                  disabled={markPaidMutation.isPending}
                                  className="text-xs font-semibold text-success hover:underline inline-flex items-center gap-1"
                                >
                                  Mark as Paid
                                </button>
                              )}
                              {canEdit && exp.paid === true && (exp.is_borrowed || exp.category === 'borrowed') && (
                                <button
                                  onClick={() => markUnpaidMutation.mutate(exp.id)}
                                  disabled={markUnpaidMutation.isPending}
                                  className="text-xs font-semibold text-warn hover:underline inline-flex items-center gap-1"
                                >
                                  Revert Unpaid
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  onClick={() => openEditModal(exp)}
                                  className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
                                >
                                  <Pencil size={13} />
                                  Edit
                                </button>
                              )}
                              {canVoid && (
                                <button
                                  onClick={() => setVoidingExpense(exp)}
                                  className="text-xs font-semibold text-danger hover:underline inline-flex items-center gap-1"
                                >
                                  <Ban size={13} />
                                  Void
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Expense"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-label-sm text-ink mb-1.5">1. Category</label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-canvas rounded border border-border">
              <button
                type="button"
                onClick={() => setNewCategory('feed')}
                className={`h-9 rounded text-xs font-semibold ${newCategory === 'feed' ? 'bg-card text-brand shadow-card' : 'text-muted'
                  }`}
              >
                Feed
              </button>
              <button
                type="button"
                onClick={() => setNewCategory('crates')}
                className={`h-9 rounded text-xs font-semibold ${newCategory === 'crates' ? 'bg-card text-brand shadow-card' : 'text-muted'
                  }`}
              >
                Crates
              </button>
              <button
                type="button"
                onClick={() => setNewCategory('other')}
                className={`h-9 rounded text-xs font-semibold ${newCategory === 'other' ? 'bg-card text-brand shadow-card' : 'text-muted'
                  }`}
              >
                Other
              </button>
            </div>
          </div>

          <div>
            <label className="block text-label-sm text-ink mb-1.5">2. Payment Status</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-canvas rounded border border-border">
              <button
                type="button"
                onClick={() => setNewIsBorrowed(false)}
                className={`py-1.5 px-3 rounded text-xs font-semibold ${
                  !newIsBorrowed ? 'bg-success text-white shadow-sm' : 'text-muted'
                }`}
              >
                Paid (Deduct from Cash)
              </button>
              <button
                type="button"
                onClick={() => setNewIsBorrowed(true)}
                className={`py-1.5 px-3 rounded text-xs font-semibold ${
                  newIsBorrowed ? 'bg-warn text-white shadow-sm' : 'text-muted'
                }`}
              >
                Borrowed (On Credit)
              </button>
            </div>
          </div>

          {newIsBorrowed && (
            <div className="bg-warn-bg/40 border border-warn/40 rounded px-3 py-2 text-xs text-ink">
              <strong className="text-warn">Borrowed Expense:</strong> Added to {newCategory} expenses, but will not be deducted from cash until marked as Paid.
            </div>
          )}

          <div>
            <label className="block text-label-sm text-ink mb-1.5">
              Item Description {newCategory === 'other' ? <span className="text-danger">*</span> : <span className="text-muted">(optional)</span>}
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={
                newCategory === 'feed'
                  ? 'e.g. Layer Mash, Grower Mash (Default: Feed)'
                  : newCategory === 'crates'
                    ? 'e.g. Plastic Crates, Paper Trays (Default: Crates)'
                    : 'e.g. Fuel, Medication'
              }
              className="input-base"
              required={newCategory === 'other'}
            />
          </div>

          <div>
            <label className="block text-label-sm text-ink mb-1.5">Quantity (optional)</label>
            <input
              type="text"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              placeholder="e.g. 5 bags"
              className="input-base"
            />
          </div>

          <CurrencyInput
            label="Amount (GH₵) *"
            value={newAmount}
            onChange={setNewAmount}
            required
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        title="Edit Expense"
      >
        {editingExpense && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-label-sm text-ink mb-1.5">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as 'feed' | 'crates' | 'other')}
                className="input-base"
              >
                <option value="feed">Feed</option>
                <option value="crates">Crates</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-label-sm text-ink mb-1.5">Payment Status</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-canvas rounded border border-border">
                <button
                  type="button"
                  onClick={() => setEditIsBorrowed(false)}
                  className={`py-1.5 px-3 rounded text-xs font-semibold ${
                    !editIsBorrowed ? 'bg-success text-white shadow-sm' : 'text-muted'
                  }`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setEditIsBorrowed(true)}
                  className={`py-1.5 px-3 rounded text-xs font-semibold ${
                    editIsBorrowed ? 'bg-warn text-white shadow-sm' : 'text-muted'
                  }`}
                >
                  Borrowed (On Credit)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-label-sm text-ink mb-1.5">
                Item Description {editCategory === 'other' ? <span className="text-danger">*</span> : <span className="text-muted">(optional)</span>}
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input-base"
                required={editCategory === 'other'}
              />
            </div>

            <div>
              <label className="block text-label-sm text-ink mb-1.5">Quantity</label>
              <input
                type="text"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="input-base"
              />
            </div>

            <CurrencyInput
              label="Amount (GH₵)"
              value={editAmount}
              onChange={setEditAmount}
              required
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Void Confirmation */}
      <ConfirmDialog
        isOpen={!!voidingExpense}
        onClose={() => setVoidingExpense(null)}
        onConfirm={() => {
          if (voidingExpense) voidMutation.mutate(voidingExpense.id)
        }}
        title="Void Expense"
        message="Void this expense? It will remain visible as voided and will be excluded from daily expense totals."
        confirmLabel="Void Expense"
        isLoading={voidMutation.isPending}
      />
    </>
  )
}
