import client from './client'
import type { Endpoint, EndpointCreate, AlertRule, AlertRuleCreate, CheckRecord, EndpointStats } from '../types/api'

export const endpointsApi = {
  list: () =>
    client.get<Endpoint[]>('/api/endpoints').then((r) => r.data),

  get: (id: string) =>
    client.get<Endpoint>(`/api/endpoints/${id}`).then((r) => r.data),

  create: (body: EndpointCreate) =>
    client.post<Endpoint>('/api/endpoints', body).then((r) => r.data),

  update: (id: string, body: Partial<EndpointCreate>) =>
    client.put<Endpoint>(`/api/endpoints/${id}`, body).then((r) => r.data),

  delete: (id: string) =>
    client.delete(`/api/endpoints/${id}`),

  checkNow: (id: string) =>
    client.post<CheckRecord>(`/api/endpoints/${id}/check`).then((r) => r.data),

  // Alert rules
  getRules: (id: string) =>
    client.get<AlertRule[]>(`/api/endpoints/${id}/rules`).then((r) => r.data),

  createRule: (id: string, body: AlertRuleCreate) =>
    client.post<AlertRule>(`/api/endpoints/${id}/rules`, body).then((r) => r.data),

  deleteRule: (endpointId: string, ruleId: string) =>
    client.delete(`/api/endpoints/${endpointId}/rules/${ruleId}`),

  // Check history
  getHistory: (id: string, limit = 50, offset = 0) =>
    client
      .get<CheckRecord[]>(`/api/endpoints/${id}/history`, { params: { limit, offset } })
      .then((r) => r.data),

  // Stats
  getStats: (id: string) =>
    client.get<EndpointStats>(`/api/endpoints/${id}/stats`).then((r) => r.data),
}
