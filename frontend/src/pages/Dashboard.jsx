import { useEffect, useState, useCallback } from 'react'
import Navbar from '../components/Navbar'
import api from '../api/client'
import { formatEuro, formatRelativeDate } from '../utils/format'

export default function Dashboard() {
  const [overview, setOverview] = useState([])
  const [breach, setBreach] = useState([])
  const [recent, setRecent] = useState([])
  const [categories, setCategories] = useState([])
  const [monthSummary, setMonthSummary] = useState({ income: 0, expenses: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/breach'),
      api.get('/transactions', { params: { limit: 5 } }),
      api.get('/analytics/trends'),
      api.get('/categories'),
    ])
      .then(([ov, br, tx, tr, cat]) => {
        setOverview(ov.data)
        setBreach(br.data)
        setRecent(tx.data.items || tx.data)
        setCategories(cat.data)
        const currentMonth = new Date().toISOString().slice(0, 7)
        const thisMonth = tr.data.find(r => r.month?.slice(0, 7) === currentMonth)
        if (thisMonth) {
          setMonthSummary({
            income: Number(thisMonth.total_income || 0),
            expenses: Number(thisMonth.total_expenses || 0),
          })
        }
      })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const totalBudget = overview.reduce((s, r) => s + Number(r.budget_limit || 0), 0)
  const totalSpent = overview.reduce((s, r) => s + Number(r.total_spent || 0), 0)

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">Dashboard</h2>
          <button
            className="btn-refresh"
            onClick={() => fetchAll(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}
        {loading && <p className="loading">Loading...</p>}

        {breach.length > 0 && (
          <div className="breach-banner">
            <span className="breach-icon">⚠️</span>
            <span>Over budget in: <strong>{breach.map(b => b.category).join(', ')}</strong></span>
          </div>
        )}

        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-label">Total Budget</div>
            <div className="summary-value">€{formatEuro(totalBudget)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Spent</div>
            <div className="summary-value spent">€{formatEuro(totalSpent)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Remaining</div>
            <div className={`summary-value ${totalBudget - totalSpent < 0 ? 'over' : 'safe'}`}>
              €{formatEuro(totalBudget - totalSpent)}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Income This Month</div>
            <div className="summary-value safe">€{formatEuro(monthSummary.income)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Expenses This Month</div>
            <div className="summary-value spent">€{formatEuro(monthSummary.expenses)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Net Savings</div>
            <div className={`summary-value ${monthSummary.income - monthSummary.expenses < 0 ? 'over' : 'safe'}`}>
              €{formatEuro(monthSummary.income - monthSummary.expenses)}
            </div>
          </div>
        </div>

        <h3 className="section-title">Budget Progress</h3>
        <div className="budget-grid">
          {overview.map((row, i) => {
            const spent = Number(row.total_spent || 0)
            const budget = Number(row.budget_limit || 0)
            const pct = Math.min(Number(row.pct_used || 0), 100)
            const over = spent > budget && budget > 0
            return (
              <div key={i} className="budget-card">
                <div className="budget-card-header">
                  <span className="budget-category">
                    <span
                      className="category-dot"
                      style={{ background: categories.find(c => c.name === row.category)?.color || '#6b7280' }}
                    />
                    {row.category}
                  </span>
                  <span className={`budget-status ${over ? 'over' : ''}`}>
                    {over ? '⚠ Over budget' : `€${formatEuro(budget - spent)} left`}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${over ? 'over' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="budget-amounts">
                  <span>€{formatEuro(spent)} spent</span>
                  <span>€{formatEuro(budget)} budget</span>
                </div>
              </div>
            )
          })}
          {!loading && overview.length === 0 && (
            <div className="empty-state-box">
              <div className="empty-state-icon">📊</div>
              <p className="empty-state-title">No budgets set yet</p>
              <p className="empty-state-sub">Create a budget to start tracking your spending</p>
              <a href="/budgets" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
                + Create Budget
              </a>
            </div>
          )}
        </div>

        <h3 className="section-title" style={{ marginTop: 32 }}>Recent Transactions</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 5).map(t => (
                <tr key={t.id}>
                  <td>{formatRelativeDate(t.date)}</td>
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
                </tr>
              ))}
              {!loading && recent.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state-box">
                      <div className="empty-state-icon">💸</div>
                      <p className="empty-state-title">No transactions yet</p>
                      <p className="empty-state-sub">Add your first transaction to get started</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}