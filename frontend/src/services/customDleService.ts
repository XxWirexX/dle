import request from './api';
import type {
  CreateCustomDlePayload,
  CustomDleDetail,
  CustomDleGame,
  CustomDleListItem,
} from '../types/customDle';

const customDleService = {
  create: (payload: CreateCustomDlePayload): Promise<{ id: string }> =>
    request('/api/custom-dles', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: CreateCustomDlePayload): Promise<{ success: boolean }> =>
    request(`/api/custom-dles/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getMine: (): Promise<CustomDleListItem[]> =>
    request('/api/custom-dles/mine'),

  getPublic: (): Promise<CustomDleListItem[]> =>
    request('/api/custom-dles/public'),

  getGame: (id: string): Promise<CustomDleGame> =>
    request(`/api/custom-dles/${id}`),

  getDetail: (id: string): Promise<CustomDleDetail> =>
    request(`/api/custom-dles/${id}?view=detail`),

  delete: (id: string): Promise<{ success: boolean }> =>
    request(`/api/custom-dles/${id}`, { method: 'DELETE' }),
};

export default customDleService;
