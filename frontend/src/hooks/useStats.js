import { useState, useEffect, useCallback } from "react";
import useAuth from "./useAuth";
import statsService from "../services/statsService.js";

export default function useStats(animeId) {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({ played: 0, wins: 0, streak: 0, maxStreak: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!animeId) return;

    if (token && user) {
      statsService.getOne(animeId, token)
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
  }, [animeId, token, user]);

  const updateStats = useCallback((won, attempts = 0, isDuo = false) => {
    if (token && user) {
      statsService.update(animeId, token, { won, attempts, isDuo })
        .then(data => setStats(data))
        .catch(() => updateLocalStorage(won));
    } else {
      updateLocalStorage(won);
    }

    function updateLocalStorage(won) {
      setStats(s => {
        const next = {
          played: s.played + 1,
          wins: s.wins + (won ? 1 : 0),
          streak: won ? s.streak + 1 : 0,
          maxStreak: Math.max(s.maxStreak, won ? s.streak + 1 : 0)
        };
        try { localStorage.setItem(`stats-${animeId}`, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    }
  }, [animeId, token, user]);

  return { stats, updateStats, loaded };
}
