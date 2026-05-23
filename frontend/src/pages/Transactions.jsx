import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import ConfirmModal from '../components/ConfirmModal'
import api from '../api/client'
import { formatEuro, formatRelativeDate } from '../utils/format'
import { useToast } from '../context/ToastContext'

const EMPTY_FORM = {
  amount: '',
  type: 'expense',
  category_id: '',
  description: '',
  date: new Date().toISOString().slice(0, 10)
}

const PAGE_SIZE = 10

export default function Transactions() {
  const { addToast } = useToast()
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const fetchTransactions = () => {
    setLoading(true)
    const params = {}
    if (filterType) params.type = filterType
    if (filterCategory) params.category_id = filterCategory
    if (filterFrom) params.from_date = filterFrom
    if (filterTo) params.to_date = filterTo
    api.get('/transactions', { params })
      .then(res => setTransactions(res.data.items || res.data))
      .catch(() => addToast('Failed to load transactions', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data))
  }, [])

  useEffect(() => {
    fetchTransactions()
    setPage(1)
  }, [filterType, filterCategory, filterFrom, filterTo])

  const handleDelete = async () => {
    try {
      await api.delete(`/transactions/${deleteId}`)
      setTransactions(prev => prev.filter(t => t.id !== deleteId))
      addToast('Transaction deleted', 'success')
    } catch {
      addToast('Failed to delete transaction', 'error')
    } finally {
      setDeleteId(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
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
      setPage(1)
      addToast('Transaction added successfully', 'success')
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? 'Please fill all required fields' : (detail || 'Failed to add transaction')
      addToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Sort
  const sorted = [...transactions].sort((a, b) => {
    let aVal = a[sortBy]
    let bVal = b[sortBy]
    if (sortBy === 'amount') {
      aVal = Number(a.amount)
      bVal = Number(b.amount)
    } else if (sortBy === 'date') {
      aVal = new Date(a.date)
      bVal = new Date(b.date)
    } else {
      aVal = String(aVal || '').toLowerCase()
      bVal = String(bVal || '').toLowerCase()
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
    setPage(1)
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>
    return <span style={{ marginLeft: 4, color: '#6366f1' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
            <select
              value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}
              required
            >
              <option value="">Select category</option>
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
          </form>
        )}

        <div className="tx-summary">
          <div className="tx-summary-item">
            <span className="summary-label">Showing</span>
            <span className="summary-value" style={{ fontSize: 16 }}>{transactions.length} transactions</span>
          </div>
          <div className="tx-summary-item">
            <span className="summary-label">Income</span>
            <span className="summary-value safe" style={{ fontSize: 16 }}>+€{formatEuro(totalIncome)}</span>
          </div>
          <div className="tx-summary-item">
            <span className="summary-label">Expenses</span>
            <span className="summary-value spent" style={{ fontSize: 16 }}>-€{formatEuro(totalExpense)}</span>
          </div>
          <div className="tx-summary-item">
            <span className="summary-label">Net</span>
            <span className={`summary-value ${totalIncome - totalExpense < 0 ? 'over' : 'safe'}`} style={{ fontSize: 16 }}>
              €{formatEuro(totalIncome - totalExpense)}
            </span>
          </div>
        </div>

        <div className="filter-bar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}>
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1) }}
            style={{ background: '#2d3748', border: '1px solid #4a5568', borderRadius: 6, padding: '7px 12px', color: '#e2e8f0', fontSize: 13 }}
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1) }}
            style={{ background: '#2d3748', border: '1px solid #4a5568', borderRadius: 6, padding: '7px 12px', color: '#e2e8f0', fontSize: 13 }}
          />
          {(filterType || filterCategory || filterFrom || filterTo) && (
            <button className="btn-delete" onClick={() => { setFilterType(''); setFilterCategory(''); setFilterFrom(''); setFilterTo(''); setPage(1) }}>
              Clear filters
            </button>
          )}
        </div>

        {loading && (
          <div className="skeleton-list">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-item" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('date')} className="sortable-th">
                      Date <SortIcon col="date" />
                    </th>
                    <th onClick={() => handleSort('description')} className="sortable-th">
                      Description <SortIcon col="description" />
                    </th>
                    <th>Category</th>
                    <th onClick={() => handleSort('type')} className="sortable-th">
                      Type <SortIcon col="type" />
                    </th>
                    <th onClick={() => handleSort('amount')} className="sortable-th">
                      Amount <SortIcon col="amount" />
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(t => (
                    <tr key={t.id}>
                      <td title={t.date?.slice(0, 10)}>{formatRelativeDate(t.date)}</td>
                      <td>{t.description || '—'}</td>
                      <td>
                        <span className="category-cell">
                          {categories.find(c => c.id === t.category_id) ? (
                            <>
                              <span
                                className="category-dot"
                                style={{ background: categories.find(c => c.id === t.category_id)?.color || '#6b7280' }}
                              />
                              {categories.find(c => c.id === t.category_id)?.name}
                            </>
                          ) : '—'}
                        </span>
                      </td>
                      <td><span className={`badge ${t.type}`}>{t.type}</span></td>
                      <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                        {t.type === 'income' ? '+' : '-'}€{formatEuro(t.amount)}
                      </td>
                      <td>
                        <button className="btn-delete" onClick={() => setDeleteId(t.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan="6">
                        <div className="empty-state-box">
                          <div className="empty-state-icon">💸</div>
                          <p className="empty-state-title">No transactions found</p>
                          <p className="empty-state-sub">Try adjusting your filters or add a new transaction</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Prev
                </button>
                <div className="page-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && arr[i - 1] !== p - 1) acc.push('...')
                      acc.push(p)
                      return acc
                    }, [])
                    .map((p, i) => p === '...' ? (
                      <span key={`dots-${i}`} className="page-dots">...</span>
                    ) : (
                      <button
                        key={p}
                        className={`page-btn ${page === p ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                </div>
                <button
                  className="page-btn"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Delete Transaction"
        message="This transaction will be permanently removed. This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Delete"
        danger={true}
      />
    </div>
  )
}