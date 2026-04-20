import request from './api';

interface DailyInfo {
  characterIndex: number;
  date: string;
  dayNumber: number;
}

const dailyService = {
  getDaily: (id: string): Promise<DailyInfo> => request(`/api/daily/${id}`),
};

export default dailyService;
