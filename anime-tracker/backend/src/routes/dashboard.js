import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { statusFromCounts } from './animes.js';

const router = Router();

// GET /api/dashboard  -> avancement de chaque spectateur sur chaque anime (toi tu suis ton frere)
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const viewers = db.prepare("SELECT id, username FROM users WHERE role = 'viewer' ORDER BY username").all();
  const animes = db.prepare('SELECT id, title, cover_url FROM animes ORDER BY title COLLATE NOCASE').all();

  const data = viewers.map((viewer) => {
    let totalWatched = 0;
    let totalEpisodes = 0;
    let finished = 0;
    let inProgress = 0;

    const perAnime = animes.map((a) => {
      const total = db.prepare('SELECT COUNT(*) AS c FROM episodes WHERE anime_id = ?').get(a.id).c;
      const watched = db.prepare(`
        SELECT COUNT(*) AS c FROM progress p
        JOIN episodes e ON e.id = p.episode_id
        WHERE e.anime_id = ? AND p.user_id = ? AND p.completed = 1
      `).get(a.id, viewer.id).c;
      const last = db.prepare(`
        SELECT MAX(p.updated_at) AS t FROM progress p
        JOIN episodes e ON e.id = p.episode_id
        WHERE e.anime_id = ? AND p.user_id = ?
      `).get(a.id, viewer.id).t;

      const status = statusFromCounts(watched, total);
      totalWatched += watched;
      totalEpisodes += total;
      if (status === 'termine' && total > 0) finished += 1;
      else if (status === 'en_cours') inProgress += 1;

      return { animeId: a.id, title: a.title, cover_url: a.cover_url, watched, total, status, lastActivity: last };
    });

    return {
      viewer,
      summary: { totalWatched, totalEpisodes, finished, inProgress, animeCount: animes.length },
      animes: perAnime,
    };
  });

  res.json({ viewers: data });
});

export default router;
