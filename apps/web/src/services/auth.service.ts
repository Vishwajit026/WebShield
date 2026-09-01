import apiClient, { setAccessToken } from '../lib/apiClient';
import type {
  ApiResponse,
  User,
  Session,
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
} from '../types/api';

// ── Register ──────────────────────────────────────────────────────────────────

export async function register(data: RegisterRequest): Promise<User> {
  const res = await apiClient.post<ApiResponse<{ user: User }>>('/auth/register', data);
  return res.data.data!.user;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data);
  const { user, accessToken } = res.data.data!;
  setAccessToken(accessToken);
  return { user, accessToken };
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export async function refreshAccessToken(): Promise<string> {
  const res = await apiClient.post<ApiResponse<RefreshResponse>>('/auth/refresh');
  const token = res.data.data!.accessToken;
  setAccessToken(token);
  return token;
}

// ── Current user ──────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User> {
  const res = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
  return res.data.data!.user;
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getSessions(): Promise<Session[]> {
  const res = await apiClient.get<ApiResponse<{ sessions: Session[] }>>('/auth/sessions');
  return res.data.data!.sessions;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${sessionId}`);
}

export async function revokeOtherSessions(): Promise<void> {
  await apiClient.post('/auth/sessions/revoke-others');
}
