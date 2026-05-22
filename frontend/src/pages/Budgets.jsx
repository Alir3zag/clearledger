import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api/client'

const EMPTY_FORM = { category_id: '', amount: '', period_start: new Date().toISOString().slice(0, 7) + '-01' }

export default function Budgets() {
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editAmount, setEditAmount] = useState('')

  useEffect(() => {
    Promise.all([api.get('/budgets'), api.get('/categories')])
      .then(([b, c]) => {
        setBudgets(b.data)
        setCategories(c.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post('/budgets', {
        category_id: form.category_id,
        amount: parseFloat(form.amount),
        period_start: form.period_start,
      })
      setBudgets(prev => [res.data, ...prev])
      setShowForm(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      if (err.response?.status === 409) {
        setError('A budget already exists for this category and month.')
      } else {
        setError(err.response?.data?.detail || 'Failed to create budget')
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
    } catch {
      alert('Failed to update budget')
    }
  }

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '—'

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
              step="0.01"
              min="0.01"
              required
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
            {error && <span className="error-text">{error}</span>}
          </form>
        )}

        {loading && <p className="loading">Loading...</p>}

        <div className="budget-list">
          {budgets.map(b => (
            <div key={b.id} className="budget-list-item">
              <div className="budget-list-left">
                <span className="budget-list-category">{getCategoryName(b.category_id)}</span>
                <span className="budget-list-period">{b.period_start?.slice(0, 7)}</span>
              </div>
              <div className="budget-list-right">
                {editId === b.id ? (
                  <div className="edit-inline">
                    <input
                      type="number"
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      step="0.01"
                      min="0.01"
                    />
                    <button className="btn-primary" onClick={() => handleEdit(b.id)}>Save</button>
                    <button className="btn-delete" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="budget-list-amount">€{Number(b.amount).toFixed(2)}</span>
                    <button className="btn-edit" onClick={() => { setEditId(b.id); setEditAmount(b.amount) }}>Edit</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!loading && budgets.length === 0 && (
            <p className="empty-state">No budgets yet. Create one above.</p>
          )}
        </div>
      </div>
    </div>
  )
}