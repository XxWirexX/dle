import request, { authHeader } from './api.js';

const authService = {
  me: (token) =>
    request('/api/auth/me', { headers: authHeader(token) }),

  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),

  register: (email, password, username) =>
    request('/api/auth/register', { method: 'POST', body: { email, password, username } }),

  forgotPassword: (email) =>
    request('/api/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (token, password) =>
    request('/api/auth/reset-password', { method: 'POST', body: { token, password } }),

  verifyEmail: (token) =>
    request('/api/auth/verify-email', { method: 'POST', body: { token } }),

  updateAvatar: (token, avatarImage) =>
    request('/api/auth/avatar', { method: 'PUT', headers: authHeader(token), body: { avatarImage } }),
};

export default authService;
