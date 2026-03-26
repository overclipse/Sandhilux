import { create } from "zustand";
import type { Alert, Endpoint, User } from "../types/api";
import { fetchMe } from "../api/auth";

type Locale = "en" | "ru";
type Theme = "dark" | "light";

interface AppState {
  // Auth
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  authLoading: boolean;
  setAuth: (token: string, user: User, refreshToken?: string | null) => void;
  clearAuth: () => void;
  initAuth: () => Promise<void>;

  // Endpoints
  endpoints: Endpoint[];
  setEndpoints: (endpoints: Endpoint[]) => void;
  updateEndpoint: (patch: {
    endpoint_id: string;
    is_up: boolean;
    latency_ms: number;
    status_code: number;
    status: Endpoint["status"];
    checked_at: string;
  }) => void;

  // Alerts
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  resolveAlert: (alertId: string) => void;

  // Active alerts count (for sidebar badge)
  activeAlertsCount: number;

  // UI preferences
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth
  accessToken: localStorage.getItem("token"),
  refreshToken: localStorage.getItem("refresh_token"),
  user: null,
  authLoading: true,
  setAuth: (token, user, refreshToken) => {
    localStorage.setItem("token", token);
    if (refreshToken) {
      localStorage.setItem("refresh_token", refreshToken);
    }
    set({
      accessToken: token,
      refreshToken: refreshToken ?? localStorage.getItem("refresh_token"),
      user,
    });
  },
  clearAuth: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    set({ accessToken: null, refreshToken: null, user: null });
  },
  initAuth: async () => {
    // In mock mode — auto-login as admin, skip server call
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const mockUser: User = { id: 'mock-1', name: 'Demo User', email: 'demo', role: 'admin', avatar_url: '', created_at: '' };
      set({ user: mockUser, accessToken: 'mock', authLoading: false });
      return;
    }

    const token = get().accessToken;
    if (!token) {
      set({ authLoading: false });
      return;
    }
    try {
      const user = await fetchMe();
      set({ user, authLoading: false });
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        authLoading: false,
      });
    }
  },

  // Endpoints
  endpoints: [],
  setEndpoints: (endpoints) => set({ endpoints }),
  updateEndpoint: (patch) =>
    set((state) => ({
      endpoints: state.endpoints.map((ep) =>
        ep.id === patch.endpoint_id
          ? {
              ...ep,
              status: patch.status,
              avg_latency: patch.latency_ms,
              last_checked_at: patch.checked_at,
            }
          : ep,
      ),
    })),

  // Alerts
  alerts: [],
  setAlerts: (alerts) =>
    set({
      alerts,
      activeAlertsCount: alerts.filter((a) => a.status === "active").length,
    }),
  addAlert: (alert) =>
    set((state) => {
      const alerts = [alert, ...state.alerts];
      return {
        alerts,
        activeAlertsCount: alerts.filter((a) => a.status === "active").length,
      };
    }),
  resolveAlert: (alertId) =>
    set((state) => {
      const alerts = state.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status: "resolved" as const,
              resolved_at: new Date().toISOString(),
            }
          : a,
      );
      return {
        alerts,
        activeAlertsCount: alerts.filter((a) => a.status === "active").length,
      };
    }),

  activeAlertsCount: 0,

  // UI preferences
  locale: (localStorage.getItem("locale") as Locale) || "en",
  setLocale: (locale) => {
    localStorage.setItem("locale", locale);
    set({ locale });
  },
  theme: (localStorage.getItem("theme") as Theme) || "dark",
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  sidebarCollapsed: localStorage.getItem("sidebarCollapsed") === "true",
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
}));
