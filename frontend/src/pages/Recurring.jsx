import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import ConfirmModal from '../components/ConfirmModal'
import api from '../api/client'
import { formatEuro } from '../utils/format'
import { useToast } from '../context/ToastContext'

const EMPTY_FORM = {
  category_id: '',
  amount: '',
  type: 'expense',
  description: '',
  frequency: 'monthly',
  next_due_date: new Date().toISOString().slice(0, 10),
}

const FREQ_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export default function Recurring() {
  const { addToast } = useToast()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    document.title = 'Recurring — ClearLedger'
    Promise.all([api.get('/recurring'), api.get('/categories')])
      .then(([r, c]) => { setItems(r.data); setCategories(c.data) })
      .catch(() => addToast('Failed to load recurring transactions', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.post('/recurring', {
        ...form,
        amount: parseFloat(form.amount),
        category_id: parseInt(form.category_id),
      })
      setItems(prev => [res.data, ...prev])
      setShowForm(false)
      setForm(EMPTY_FORM)
      addToast('Recurring transaction created', 'success')
    } catch {
      addToast('Failed to create recurring transaction', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (item) => {
    try {
      const res = await api.patch(`/recurring/${item.id}`, { is_active: !item.is_active })
      setItems(prev => prev.map(i => i.id === item.id ? res.data : i))
      addToast(res.data.is_active ? 'Activated' : 'Paused', 'success')
    } catch {
      addToast('Failed to update', 'error')
    }
  }

  const handleEdit = async (id) => {
    try {
      const res = await api.patch(`/recurring/${id}`, {
        amount: parseFloat(editForm.amount),
        frequency: editForm.frequency,
        next_due_date: editForm.next_due_date,
        description: editForm.description,
      })
      setItems(prev => prev.map(i => i.id === id ? res.data : i))
      setEditId(null)
      addToast('Updated', 'success')
    } catch {
      addToast('Failed to update', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await api.delete(`/recurring/${deleteId}`)
      setItems(prev => prev.filter(i => i.id !== deleteId))
      addToast('Deleted', 'success')
    } catch {
      addToast('Failed to delete', 'error')
    } finally {
      setDeleteId(null)
    }
  }

  const getCat = (id) => categories.find(c => c.id === id)

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">Recurring Transactions</h2>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Recurring'}
          </button>
        </div>

        {showForm && (
          <form className="inline-form" onSubmit={handleSubmit}>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select
              value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}
              required
            >
              <option value="">Select category</option>
              {categories.filter(c => c.type === form.type).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              step="0.01" min="0.01" required
            />
            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <input
              type="text"
              placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
            <input
              type="date"
              value={form.next_due_date}
              onChange={e => setForm({ ...form, next_due_date: e.target.value })}
              required
            />
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </form>
        )}

        {loading && (
          <div className="skeleton-list">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-item" />)}
          </div>
        )}

        {!loading && (
          <div className="budget-list">
            {items.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-state-icon">🔄</div>
                <p className="empty-state-title">No recurring transactions yet</p>
                <p className="empty-state-sub">Set up automatic entries for rent, salary, subscriptions, and more</p>
                <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
                  + Create your first recurring transaction
                </button>
              </div>
            ) : (
              items.map(item => {
                const cat = getCat(item.category_id)
                return (
                  <div key={item.id} className={`budget-list-item ${!item.is_active ? 'recurring-inactive' : ''}`}>
                    <div className="budget-list-left">
                      <span className="budget-list-category">
                        {cat && (
                          <span className="category-dot" style={{ background: cat.color || '#6b7280' }} />
                        )}
                        {cat?.name || '—'}
                      </span>
                      <span className="budget-list-period">
                        {FREQ_LABELS[item.frequency]} · Next: {item.next_due_date}
                        {item.description && ` · ${item.description}`}
                      </span>
                    </div>
                    <div className="budget-list-right">
                      {editId === item.id ? (
                        <div className="edit-inline">
                          <input
                            type="number"
                            value={editForm.amount}
                            onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                            step="0.01" min="0.01"
                            style={{ width: 90 }}
                          />
                          <select
                            value={editForm.frequency}
                            onChange={e => setEditForm({ ...editForm, frequency: e.target.value })}
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                          <input
                            type="date"
                            value={editForm.next_due_date}
                            onChange={e => setEditForm({ ...editForm, next_due_date: e.target.value })}
                          />
                          <button className="btn-primary" onClick={() => handleEdit(item.id)}>Save</button>
                          <button className="btn-delete" onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span className={`budget-list-amount ${item.type === 'income' ? 'amount-income' : 'amount-expense'}`}>
                            {item.type === 'income' ? '+' : '-'}€{formatEuro(item.amount)}
                          </span>
                          <span className={`recurring-badge ${item.is_active ? 'active' : 'paused'}`}>
                            {item.is_active ? 'Active' : 'Paused'}
                          </span>
                          <button className="btn-edit" onClick={() => handleToggle(item)}>
                            {item.is_active ? 'Pause' : 'Resume'}
                          </button>
                          <button className="btn-edit" onClick={() => {
                            setEditId(item.id)
                            setEditForm({
                              amount: item.amount,
                              frequency: item.frequency,
                              next_due_date: item.next_due_date,
                              description: item.description || '',
                            })
                          }}>Edit</button>
                          <button className="btn-delete" onClick={() => setDeleteId(item.id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Delete Recurring Transaction"
        message="This template will be deleted. Transactions already generated from it will not be affected."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Delete"
        danger={true}
      />
    </div>
  )
}