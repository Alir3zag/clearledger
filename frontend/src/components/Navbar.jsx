import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { logout } = useAuth()
  const { pathname } = useLocation()

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/transactions', label: 'Transactions' },
    { to: '/budgets', label: 'Budgets' },
    { to: '/charts', label: 'Charts' },
    { to: '/recurring', label: 'Recurring' },
  ]

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-brand">ClearLedger</Link>
      <div className="navbar-links">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={pathname === l.to ? 'active' : ''}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <button className="navbar-logout" onClick={logout}>Logout</button>
    </nav>
  )
}