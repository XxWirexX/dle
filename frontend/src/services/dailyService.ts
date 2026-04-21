import request from './api';

interface DailyInfo {
  characterIndex: number;
  date: string;
  dayNumber: number;
}

const dailyService = {
  getDaily: (id: string): Promise<DailyInfo> => request(`/api/daily/${id}`),
  getCustomDaily: (id: string): Promise<DailyInfo> => request(`/api/custom-dles/${id}/daily`),
};

export default dailyService;
