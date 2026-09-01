import axios, { AxiosError } from 'axios';
import type { RefreshResponse, ApiResponse } from '../types/api';

/**
 * Configured Axios instance.
 * Uses Vite's proxy to forward /api requests to the backend in development.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HttpOnly refresh token cookie
});

// ── Token storage (in-memory only, NOT localStorage) ─────────────────────────
// Memory storage survives page interactions but not full page refresh.
// On refresh, the /api/auth/refresh endpoint restores the access token using the
// HttpOnly cookie (which DOES persist).

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ── Request interceptor — attach Bearer token ─────────────────────────────────

apiClient.interceptors.request.use(
  config => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// ── Response interceptor — handle 401 and token refresh ──────────────────────

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string): void {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    // Don't retry if it's already a retry, or if the endpoint is refresh itself
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Wait for the in-flight refresh to complete
        return new Promise(resolve => {
          refreshSubscribers.push((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await apiClient.post<ApiResponse<RefreshResponse>>('/auth/refresh');
        const newToken = res.data.data?.accessToken ?? '';
        setAccessToken(newToken);
        onRefreshed(newToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — clear token and redirect to login
        setAccessToken(null);
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
