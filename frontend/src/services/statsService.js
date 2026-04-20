import request, { authHeader } from './api.js';

const statsService = {
  getOne: (animeId, token) =>
    request(`/api/stats/${animeId}`, { headers: authHeader(token) }),

  getAll: (token) =>
    request('/api/stats/all', { headers: authHeader(token) }),

  update: (animeId, token, data) =>
    request(`/api/stats/${animeId}`, {
      method: 'PUT',
      headers: authHeader(token),
      body: data,
    }),
};

export default statsService;
