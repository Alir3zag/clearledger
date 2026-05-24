import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import ConfirmModal from '../components/ConfirmModal'
import api from '../api/client'
import { formatEuro } from '../utils/format'
import { useToast } from '../context/ToastContext'

const EMPTY_FORM = { category_id: '', amount: '', period_start: new Date().toISOString().slice(0, 7) + '-01' }

export default function Budgets() {
  const { addToast } = useToast()
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    document.title = 'Budgets — ClearLedger'
    Promise.all([api.get('/budgets'), api.get('/categories')])
      .then(([b, c]) => { setBudgets(b.data); setCategories(c.data) })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.post('/budgets', {
        category_id: form.category_id,
        amount: parseFloat(form.amount),
        period_start: form.period_start,
      })
      setBudgets(prev => [res.data, ...prev])
      setShowForm(false)
      setForm(EMPTY_FORM)
      addToast('Budget created successfully', 'success')
    } catch (err) {
      if (err.response?.status === 409) {
        addToast('Budget already exists for this month', 'error')
      } else {
        addToast('Failed to create budget', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (id) => {
    try {
      const res = await api.patch(`/budgets/${id}`, { amount: parseFloat(editAmount) })
      setBudgets(prev => prev.map(b => b.id === id ? res.data : b))
      setEditId(null)
      addToast('Budget updated', 'success')
    } catch {
      addToast('Failed to update budget', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await api.delete(`/budgets/${deleteId}`)
      setBudgets(prev => prev.filter(b => b.id !== deleteId))
      addToast('Budget deleted', 'success')
    } catch {
      addToast('Failed to delete budget', 'error')
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
          <h2 className="page-title">Budgets</h2>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Budget'}
          </button>
        </div>

        {showForm && (
          <form className="inline-form" onSubmit={handleSubmit}>
            <select
              value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}
              required
            >
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount (€)"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              step="0.01" min="0.01" required
            />
            <input
              type="month"
              value={form.period_start.slice(0, 7)}
              onChange={e => setForm({ ...form, period_start: e.target.value + '-01' })}
              required
            />
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Budget'}
            </button>
          </form>
        )}

        {loading && (
          <div className="skeleton-list">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-item" />)}
          </div>
        )}

        {!loading && (
          <div className="budget-list-compact">
            {budgets.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-state-icon">💰</div>
                <p className="empty-state-title">No budgets yet</p>
                <p className="empty-state-sub">Set monthly limits for your spending categories</p>
                <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
                  + Create your first budget
                </button>
              </div>
            ) : (
              budgets.map(b => {
                const cat = getCat(b.category_id)
                return (
                  <div key={b.id} className="budget-compact-item">
                    {/* Left: dot + name + period */}
                    <div className="budget-compact-left">
                      <span className="category-dot" style={{ background: cat?.color || '#6b7280' }} />
                      <div>
                        <span className="budget-compact-name">{cat?.name || '—'}</span>
                        <span className="budget-compact-period">{b.period_start?.slice(0, 7)}</span>
                      </div>
                    </div>

                    {/* Right: amount + actions */}
                    <div className="budget-compact-right">
                      {editId === b.id ? (
                        <div className="edit-inline">
                          <input
                            type="number"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            step="0.01" min="0.01"
                            style={{ width: 100 }}
                          />
                          <button className="btn-primary" onClick={() => handleEdit(b.id)}>Save</button>
                          <button className="btn-delete" onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span className="budget-compact-amount">€{formatEuro(b.amount)}</span>
                          <button
                            className="btn-edit"
                            onClick={() => { setEditId(b.id); setEditAmount(b.amount) }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => setDeleteId(b.id)}
                          >
                            Delete
                          </button>
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
        title="Delete Budget"
        message="This budget will be permanently removed. Transactions already recorded will not be affected."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Delete"
        danger={true}
      />
    </div>
  )
}