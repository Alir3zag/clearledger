import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import api from '../api/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16'
]

const RADIAN = Math.PI / 180
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, pct }) => {
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/analytics/trends'), api.get('/analytics/breakdown')])
      .then(([t, b]) => {
        setTrends(t.data.map(r => ({
          month: r.month?.slice(0, 7),
          savings: Number(r.net_savings || 0),
        })))
        setBreakdown(b.data.map(r => ({
          name: r.category,
          value: Number(r.spent || 0),
          pct: Number(r.pct_of_total || 0),
        })))
      })
      .finally(() => setLoading(false))
  }, [])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-value">€{payload[0].value.toFixed(2)}</p>
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

  const renderLegend = (props) => {
    const { payload } = props
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
        {payload.map((entry, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: entry.color }} />
            <span style={{ fontSize: 13, color: '#e2e8f0' }}>{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <h2 className="page-title">Charts</h2>

        {loading && <p className="loading">Loading...</p>}

        <div className="chart-section">
          <h3 className="section-title">Net Savings — Last 6 Months</h3>
          <div className="chart-card">
            {trends.length === 0 && !loading ? (
              <p className="empty-state">No data yet. Add some transactions to see trends.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trends} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis dataKey="month" stroke="#718096" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#718096" tick={{ fontSize: 12 }} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="savings"
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
                  <Tooltip content={<PieTooltip />} />
                  <Legend content={renderLegend} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}