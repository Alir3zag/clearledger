import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api/client'

export default function Dashboard() {
  const [overview, setOverview] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/analytics/overview')
      .then(res => setOverview(res.data))
      .catch(() => setError('Failed to load overview'))
      .finally(() => setLoading(false))
  }, [])

  const totalBudget = overview.reduce((s, r) => s + Number(r.budget_limit || 0), 0)
  const totalSpent = overview.reduce((s, r) => s + Number(r.total_spent || 0), 0)

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <h2 className="page-title">Dashboard</h2>

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
        </div>

        {loading && <p className="loading">Loading...</p>}
        {error && <p className="error-text">{error}</p>}

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
                    {over ? 'Over budget' : `€${(budget - spent).toFixed(2)} left`}
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
      </div>
    </div>
  )
}