import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api/client'

const EMPTY_FORM = {
  amount: '',
  type: 'expense',
  category_id: '',
  description: '',
  date: new Date().toISOString().slice(0, 10)
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const fetchTransactions = () => {
    setLoading(true)
    const params = {}
    if (filterType) params.type = filterType
    if (filterCategory) params.category_id = filterCategory
    if (filterFrom) params.from_date = filterFrom
    if (filterTo) params.to_date = filterTo
    api.get('/transactions', { params })
      .then(res => setTransactions(res.data.items || res.data))
      .catch(() => setError('Failed to load transactions'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data))
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [filterType, filterCategory, filterFrom, filterTo])

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return
    await api.delete(`/transactions/${id}`)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        category_id: form.category_id || null,
        date: form.date,
      }
      const res = await api.post('/transactions', payload)
      setTransactions(prev => [res.data, ...prev])
      setShowForm(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add transaction')
    } finally {
      setSubmitting(false)
    }
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">Transactions</h2>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Transaction'}
          </button>
        </div>

        {showForm && (
          <form className="inline-form" onSubmit={handleSubmit}>
            <input
              type="number"
              placeholder="Amount"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              step="0.01" min="0.01" required
            />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value="">No category</option>
              {categories
                .filter(c => c.type === form.type)
                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              type="text"
              placeholder="Description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              required
            />
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
            {error && <span className="error-text">{error}</span>}
          </form>
        )}

        {/* Summary bar */}
        <div className="tx-summary">
          <div className="tx-summary-item">
            <span className="summary-label">Showing</span>
            <span className="summary-value" style={{ fontSize: 16 }}>{transactions.length} transactions</span>
          </div>
          <div className="tx-summary-item">
            <span className="summary-label">Income</span>
            <span className="summary-value safe" style={{ fontSize: 16 }}>+€{totalIncome.toFixed(2)}</span>
          </div>
          <div className="tx-summary-item">
            <span className="summary-label">Expenses</span>
            <span className="summary-value spent" style={{ fontSize: 16 }}>-€{totalExpense.toFixed(2)}</span>
          </div>
          <div className="tx-summary-item">
            <span className="summary-label">Net</span>
            <span className={`summary-value ${totalIncome - totalExpense < 0 ? 'over' : 'safe'}`} style={{ fontSize: 16 }}>
              €{(totalIncome - totalExpense).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            style={{ background: '#2d3748', border: '1px solid #4a5568', borderRadius: 6, padding: '7px 12px', color: '#e2e8f0', fontSize: 13 }}
            placeholder="From"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            style={{ background: '#2d3748', border: '1px solid #4a5568', borderRadius: 6, padding: '7px 12px', color: '#e2e8f0', fontSize: 13 }}
            placeholder="To"
          />
          {(filterType || filterCategory || filterFrom || filterTo) && (
            <button className="btn-delete" onClick={() => { setFilterType(''); setFilterCategory(''); setFilterFrom(''); setFilterTo('') }}>
              Clear filters
            </button>
          )}
        </div>

        {loading && <p className="loading">Loading...</p>}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{t.date?.slice(0, 10)}</td>
                  <td>{t.description || '—'}</td>
                  <td>{categories.find(c => c.id === t.category_id)?.name || '—'}</td>
                  <td><span className={`badge ${t.type}`}>{t.type}</span></td>
                  <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                    {t.type === 'income' ? '+' : '-'}€{Number(t.amount).toFixed(2)}
                  </td>
                  <td>
                    <button className="btn-delete" onClick={() => handleDelete(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan="6" className="empty-state">No transactions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}