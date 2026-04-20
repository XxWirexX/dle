import request from './api';
import type { AnimeListItem, AnimeGame, AvatarGroup } from '../types/anime';

interface AnimeDetail extends AnimeListItem {
  attributes: import('../types/anime').Attribute[];
}

const animeService = {
  getAll: (): Promise<AnimeListItem[]> => request('/api/animes'),
  getDetail: (id: string): Promise<AnimeDetail> => request(`/api/anime/${id}?view=detail`),
  getGame: (id: string): Promise<AnimeGame> => request(`/api/anime/${id}`),
  getAllAvatars: (): Promise<AvatarGroup[]> => request('/api/animes/avatars'),
};

export default animeService;
