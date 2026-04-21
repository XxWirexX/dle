import request from './api';
import type { Stats, AllStats } from '../types/stats';

const statsService = {
  getOne: (animeId: string): Promise<Stats> =>
    request(`/api/stats/${animeId}`),

  getAll: (): Promise<AllStats> =>
    request('/api/stats/all'),

  update: (animeId: string, data: { won: boolean; attempts: number; isDuo?: boolean; isDaily?: boolean }): Promise<Stats> =>
    request(`/api/stats/${animeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export default statsService;
