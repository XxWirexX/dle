import request from './api.js';

const dailyService = {
  getDaily: (id) => request(`/api/daily/${id}`),
};

export default dailyService;
