import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

interface Props {
  role: 'admin'
  fallback?: ReactNode
  children: ReactNode
}

export function RoleGuard({ role, fallback = null, children }: Props) {
  const { user } = useAuth()
  if (user?.role !== role) return <>{fallback}</>
  return <>{children}</>
}
