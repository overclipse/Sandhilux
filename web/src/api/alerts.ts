import client from "./client";
import type { Alert, AlertStatus, AlertType } from "../types/api";

export interface AlertsFilter {
  status?: AlertStatus | "all";
  period?: "today" | "7d" | "30d";
  type?: AlertType | "all";
  endpoint_id?: string;
  limit?: number;
  offset?: number;
}

export const alertsApi = {
  list: (filter?: AlertsFilter) =>
    client.get<Alert[]>("/api/alerts", { params: filter }).then((r) => r.data),

  resolve: (id: string) =>
    client.put<Alert>(`/api/alerts/${id}/resolve`).then((r) => r.data),
};
