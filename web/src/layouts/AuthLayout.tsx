import { Outlet, Navigate } from 'react-router-dom'
import { useAppStore } from '../store'
import styles from './AuthLayout.module.css'

export function AuthLayout() {
  const token = useAppStore((s) => s.accessToken)
  if (token) return <Navigate to="/" replace />

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid} />
      <Outlet />
    </div>
  )
}
