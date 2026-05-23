import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api/client'

export default function Dashboard() {
  const [overview, setOverview] = useState([])
  const [breach, setBreach] = useState([])
  const [recent, setRecent] = useState([])
  const [categories, setCategories] = useState([])
  const [monthSummary, setMonthSummary] = useState({ income: 0, expenses: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
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
      .finally(() => setLoading(false))
  }, [])

  const totalBudget = overview.reduce((s, r) => s + Number(r.budget_limit || 0), 0)
  const totalSpent = overview.reduce((s, r) => s + Number(r.total_spent || 0), 0)

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <h2 className="page-title">Dashboard</h2>

        {error && <p className="error-text">{error}</p>}
        {loading && <p className="loading">Loading...</p>}

        {breach.length > 0 && (
          <div className="breach-banner">
            <span className="breach-icon">⚠️</span>
            <span>
              Over budget in: <strong>{breach.map(b => b.category).join(', ')}</strong>
            </span>
          </div>
        )}

        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-label">Total Budget</div>
            <div className="summary-value">€{totalBudget.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Spent</div>
            <div className="summary-value spent">€{totalSpent.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Remaining</div>
            <div className={`summary-value ${totalBudget - totalSpent < 0 ? 'over' : 'safe'}`}>
              €{(totalBudget - totalSpent).toFixed(2)}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Income This Month</div>
            <div className="summary-value safe">€{monthSummary.income.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Expenses This Month</div>
            <div className="summary-value spent">€{monthSummary.expenses.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Net Savings</div>
            <div className={`summary-value ${monthSummary.income - monthSummary.expenses < 0 ? 'over' : 'safe'}`}>
              €{(monthSummary.income - monthSummary.expenses).toFixed(2)}
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
                  <span className="budget-category">{row.category}</span>
                  <span className={`budget-status ${over ? 'over' : ''}`}>
                    {over ? '⚠ Over budget' : `€${(budget - spent).toFixed(2)} left`}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${over ? 'over' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="budget-amounts">
                  <span>€{spent.toFixed(2)} spent</span>
                  <span>€{budget.toFixed(2)} budget</span>
                </div>
              </div>
            )
          })}
          {!loading && overview.length === 0 && (
            <p className="empty-state">No budgets set yet. Go to Budgets to create one.</p>
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
                  <td>{t.date?.slice(0, 10)}</td>
                  <td>{t.description || '—'}</td>
                  <td>{categories.find(c => c.id === t.category_id)?.name || '—'}</td>
                  <td><span className={`badge ${t.type}`}>{t.type}</span></td>
                  <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                    {t.type === 'income' ? '+' : '-'}€{Number(t.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
              {!loading && recent.length === 0 && (
                <tr><td colSpan="5" className="empty-state">No transactions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}