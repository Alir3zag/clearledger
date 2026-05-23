import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar
} from 'recharts'

const COLORS = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16'
]

const RADIAN = Math.PI / 180
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${pct.toFixed(1)}%`}
    </text>
  )
}

export default function Charts() {
  const [trends, setTrends] = useState([])
  const [breakdown, setBreakdown] = useState([])
  const [rank, setRank] = useState([])
  const [mom, setMom] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/trends'),
      api.get('/analytics/breakdown'),
      api.get('/analytics/rank'),
      api.get('/analytics/mom'),
    ])
      .then(([t, b, r, m]) => {
        setTrends(t.data.map(row => ({
          month: row.month?.slice(0, 7),
          savings: Number(row.net_savings || 0),
          income: Number(row.total_income || 0),
          expenses: Number(row.total_expenses || 0),
        })))
        setBreakdown(b.data.map(row => ({
          name: row.category,
          value: Number(row.spent || 0),
          pct: Number(row.pct_of_total || 0),
        })))
        setRank(r.data.map(row => ({
          category: row.category,
          spent: Number(row.total_spent || 0),
          rank: row.spend_rank,
        })))

        const momByCategory = {}
        const currentMonth = new Date().toISOString().slice(0, 7)
        const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
          .toISOString().slice(0, 7)
        m.data.forEach(row => {
          const cat = row.category
          if (!momByCategory[cat]) {
            momByCategory[cat] = { category: cat, current: 0, previous: 0 }
          }
          const monthStr = row.month?.slice(0, 7)
          if (monthStr === currentMonth) momByCategory[cat].current = Number(row.total_spent || 0)
          if (monthStr === lastMonth) momByCategory[cat].previous = Number(row.total_spent || 0)
        })
        setMom(Object.values(momByCategory))
      })
      .finally(() => setLoading(false))
  }, [])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="tooltip-value" style={{ color: p.color }}>
              {p.name}: €{Number(p.value).toFixed(2)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{payload[0].name}</p>
          <p className="tooltip-value">
            €{payload[0].value.toFixed(2)} ({payload[0].payload.pct.toFixed(1)}%)
          </p>
        </div>
      )
    }
    return null
  }

  const renderLegend = ({ payload }) => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: entry.color }} />
          <span style={{ fontSize: 13, color: '#e2e8f0' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <h2 className="page-title">Charts</h2>
        {loading && <p className="loading">Loading...</p>}

        <div className="chart-section">
          <h3 className="section-title">Income vs Expenses — Last 6 Months</h3>
          <div className="chart-card">
            {trends.length === 0 && !loading ? (
              <p className="empty-state">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trends} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis dataKey="month" stroke="#718096" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#718096" tick={{ fontSize: 12 }} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-section">
          <h3 className="section-title">Net Savings — Last 6 Months</h3>
          <div className="chart-card">
            {trends.length === 0 && !loading ? (
              <p className="empty-state">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trends} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis dataKey="month" stroke="#718096" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#718096" tick={{ fontSize: 12 }} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    name="Net Savings"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ fill: '#6366f1', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-section">
          <h3 className="section-title">Spending by Category</h3>
          <div className="chart-card">
            {breakdown.length === 0 && !loading ? (
              <p className="empty-state">No spending data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Pie
                    data={breakdown}
                    cx="50%"
                    cy="45%"
                    outerRadius={120}
                    dataKey="value"
                    nameKey="name"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} isAnimationActive={false} />
                  <Legend content={renderLegend} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-section">
          <h3 className="section-title">Category Spending Rank</h3>
          <div className="chart-card">
            {rank.length === 0 && !loading ? (
              <p className="empty-state">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rank} layout="vertical" margin={{ top: 8, right: 24, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis type="number" stroke="#718096" tick={{ fontSize: 12 }} tickFormatter={v => `€${v}`} />
                  <YAxis type="category" dataKey="category" stroke="#718096" tick={{ fontSize: 12 }} width={75} />
                  <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                  <Bar dataKey="spent" name="Spent" radius={[0, 4, 4, 0]}>
                    {rank.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-section">
          <h3 className="section-title">Month-over-Month Expenses by Category</h3>
          <div className="chart-card">
            {mom.length === 0 && !loading ? (
              <p className="empty-state">No comparison data yet. Need at least 2 months of transactions.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={mom} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis dataKey="category" stroke="#718096" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#718096" tick={{ fontSize: 12 }} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                  <Legend />
                  <Bar dataKey="current" name="This Month" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previous" name="Last Month" fill="#4a5568" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}