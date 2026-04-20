import request from './api';
import type { User } from '../types/auth';

interface AuthResponse {
  user: User;
  token: string;
  message?: string;
}

const authService = {
  me: (): Promise<{ user: User }> =>
    request('/api/auth/me'),

  login: (email: string, password: string): Promise<AuthResponse> =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (email: string, password: string, username: string): Promise<AuthResponse> =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, username }) }),

  forgotPassword: (email: string): Promise<{ message: string }> =>
    request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string): Promise<{ message: string }> =>
    request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  verifyEmail: (token: string): Promise<{ message: string }> =>
    request('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

  updateAvatar: (avatarImage: string | null): Promise<{ user: User }> =>
    request('/api/auth/avatar', { method: 'PUT', body: JSON.stringify({ avatarImage }) }),
};

export default authService;
