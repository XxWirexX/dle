export interface Stats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  duoPlayed?: number;
  duoWins?: number;
  totalAttempts?: number;
}

export interface GlobalStats {
  totalPlayed: number;
  totalWins: number;
  winRate: number;
  soloPlayed: number;
  soloWins: number;
  soloWinRate: number;
  duoPlayed: number;
  duoWins: number;
  duoWinRate: number;
  avgAttempts: number;
  bestStreak: number;
}

export interface AllStats {
  global: GlobalStats;
  byAnime: Record<string, Stats>;
}
