import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { useSSE } from '../hooks/useSSE'
import { useAuth } from '../hooks/useAuth'
import logoSrc from '../assets/logo.svg'
import styles from './AppLayout.module.css'

export function AppLayout() {
  const activeAlertsCount = useAppStore((s) => s.activeAlertsCount)
  const { logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  // Start SSE for the whole app session
  useSSE()

  function navClass({ isActive }: { isActive: boolean }) {
    return `${styles.navItem} ${isActive ? styles.navActive : ''}`
  }

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo} onClick={() => navigate('/')}>
          <img src={logoSrc} className={styles.logoIcon} alt="Sandhilux" />
          <span className={styles.logoText}>Sandhilux</span>
        </div>

        <nav className={styles.nav}>
          <NavLink to="/" end className={navClass}>
            <span className={styles.navIcon}>▦</span> Dashboard
          </NavLink>
          <NavLink to="/endpoints" className={navClass}>
            <span className={styles.navIcon}>◉</span> Endpoints
          </NavLink>
          <NavLink to="/alerts" className={navClass}>
            <span className={styles.navIcon}>⚑</span> Alerts
            {activeAlertsCount > 0 && (
              <span className={styles.badge}>{activeAlertsCount}</span>
            )}
          </NavLink>
          {isAdmin && (
            <NavLink to="/settings" className={navClass}>
              <span className={styles.navIcon}>⚙</span> Settings
            </NavLink>
          )}
        </nav>

        <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={logout}>
          Sign out
        </button>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
