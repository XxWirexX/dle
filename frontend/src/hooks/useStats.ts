import { useState, useEffect, useCallback } from "react";
import useAuth from "./useAuth";
import statsService from "../services/statsService";
import type { Stats } from "../types/stats";

export default function useStats(animeId: string | undefined) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ played: 0, wins: 0, streak: 0, maxStreak: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!animeId) return;

    if (user) {
      statsService.getOne(animeId)
        .then(data => { setStats(data); setLoaded(true); })
        .catch(() => loadFromLocalStorage());
    } else {
      loadFromLocalStorage();
    }

    function loadFromLocalStorage() {
      try {
        const raw = localStorage.getItem(`stats-${animeId}`);
        if (raw) setStats(JSON.parse(raw));
      } catch { /* ignore */ }
      setLoaded(true);
    }
  }, [animeId, user]);

  const updateStats = useCallback((won: boolean, attempts = 0, isDuo = false) => {
    if (user && animeId) {
      statsService.update(animeId, { won, attempts, isDuo })
        .then(data => setStats(data))
        .catch(() => updateLocalStorage(won));
    } else {
      updateLocalStorage(won);
    }

    function updateLocalStorage(won: boolean) {
      setStats(s => {
        const next: Stats = {
          played: s.played + 1,
          wins: s.wins + (won ? 1 : 0),
          streak: won ? s.streak + 1 : 0,
          maxStreak: Math.max(s.maxStreak, won ? s.streak + 1 : 0),
        };
        try { localStorage.setItem(`stats-${animeId}`, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }
  }, [animeId, user]);

  return { stats, updateStats, loaded };
}
