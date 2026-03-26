import client from './client'
import type { User, VersionInfo } from '../types/api'

export const settingsApi = {
  getVersion: () =>
    client.get<VersionInfo>('/api/version').then((r) => r.data),


  getUsers: () =>
    client.get<User[]>('/api/settings/users').then((r) => r.data),

  updateUserRole: (userId: string, role: 'admin' | 'viewer') =>
    client.put<User>(`/api/settings/users/${userId}/role`, { role }).then((r) => r.data),

  removeUser: (userId: string) =>
    client.delete(`/api/settings/users/${userId}`),

  changePassword: (current: string, newPassword: string) =>
    client.put('/api/settings/password', { current_password: current, new_password: newPassword }),
}
