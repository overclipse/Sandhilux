import client from './client'
import type { TelegramSettings, User, VersionInfo } from '../types/api'

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

  getTelegram: () =>
    client.get<TelegramSettings>('/api/settings/telegram').then((r) => r.data),

  saveTelegram: (bot_token: string, chat_id: string) =>
    client.put<TelegramSettings>('/api/settings/telegram', { bot_token, chat_id }).then((r) => r.data),

  testTelegram: () =>
    client.post('/api/settings/telegram/test'),
}
