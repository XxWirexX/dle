import request from './api.js';

const animeService = {
  getAll: () => request('/api/animes'),
  getDetail: (id) => request(`/api/anime/${id}?view=detail`),
  getGame: (id) => request(`/api/anime/${id}`),
  getAllAvatars: () => request('/api/animes/avatars'),
};

export default animeService;
