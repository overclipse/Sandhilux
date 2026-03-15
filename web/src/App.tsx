import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Endpoints } from './pages/Endpoints'
import { EndpointDetail } from './pages/EndpointDetail'
import { EndpointNew } from './pages/EndpointNew'
import { Alerts } from './pages/Alerts'
import { Settings } from './pages/Settings'
import { RoleGuard } from './components/RoleGuard'

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Protected */}
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="/endpoints" element={<Endpoints />} />
        <Route path="/endpoints/new" element={
          <RoleGuard role="admin" fallback={<Navigate to="/" replace />}>
            <EndpointNew />
          </RoleGuard>
        } />
        <Route path="/endpoints/:id" element={<EndpointDetail />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/settings" element={
          <RoleGuard role="admin" fallback={<Navigate to="/" replace />}>
            <Settings />
          </RoleGuard>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
