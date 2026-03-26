import axios from "axios";
import { useAppStore } from "../store";

export const API_URL = import.meta.env.VITE_API_URL ?? "";

const client = axios.create({
  baseURL: API_URL,
});

function decodeUserFromToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.user_id,
      email: payload.email,
      role: payload.role,
      name: payload.name || "",
      avatar_url: payload.avatar_url || "",
      created_at: "",
    };
  } catch {
    return null;
  }
}

// Attach access token to every request
client.interceptors.request.use((config) => {
  const token = useAppStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 → clear auth and redirect to login
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as any;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshToken = useAppStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const token = data?.access_token || data?.token;
          const nextRefresh = data?.refresh_token || refreshToken;
          const user = token ? decodeUserFromToken(token) : null;
          if (token && user) {
            useAppStore.getState().setAuth(token, user, nextRefresh);
            original.headers = original.headers ?? {};
            original.headers.Authorization = `Bearer ${token}`;
            return client(original);
          }
        } catch {
          // fall through to clear auth
        }
      }
      useAppStore.getState().clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default client;
