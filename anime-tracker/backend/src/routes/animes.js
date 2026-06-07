import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = Router();

export function statusFromCounts(watched, total) {
  if (total === 0) return 'a_voir';
  if (watched === 0) return 'a_voir';
  if (watched >= total) return 'termine';
  return 'en_cours';
}

// Renvoie l'id du "spectateur cible" : soi-meme si viewer, sinon le premier viewer (pour que l'admin voie l'avancee de son frere)
function targetViewerId(user) {
  if (user.role === 'viewer') return user.id;
  const v = db.prepare("SELECT id FROM users WHERE role = 'viewer' ORDER BY id ASC LIMIT 1").get();
  return v ? v.id : null;
}

// GET /api/animes  -> liste avec avancement du spectateur
router.get('/', requireAuth, (req, res) => {
  const viewerId = targetViewerId(req.user);
  const animes = db.prepare('SELECT * FROM animes ORDER BY title COLLATE NOCASE').all();
  const result = animes.map((a) => {
    const total = db.prepare('SELECT COUNT(*) AS c FROM episodes WHERE anime_id = ?').get(a.id).c;
    let watched = 0;
    if (viewerId) {
      watched = db.prepare(`
        SELECT COUNT(*) AS c FROM progress p
        JOIN episodes e ON e.id = p.episode_id
        WHERE e.anime_id = ? AND p.user_id = ? AND p.completed = 1
      `).get(a.id, viewerId).c;
    }
    return {
      ...a,
      episodeCount: total,
      watchedCount: watched,
      status: statusFromCounts(watched, total),
    };
  });
  res.json({ animes: result });
});

// GET /api/animes/:id  -> detail + episodes avec etat "vu"
router.get('/:id', requireAuth, (req, res) => {
  const viewerId = targetViewerId(req.user);
  const anime = db.prepare('SELECT * FROM animes WHERE id = ?').get(req.params.id);
  if (!anime) return res.status(404).json({ error: 'Anime introuvable' });
  const episodes = db.prepare('SELECT * FROM episodes WHERE anime_id = ? ORDER BY number ASC').all(anime.id);
  const withProgress = episodes.map((e) => {
    const p = viewerId
      ? db.prepare('SELECT position, completed FROM progress WHERE user_id = ? AND episode_id = ?').get(viewerId, e.id)
      : null;
    return {
      ...e,
      watched: p ? !!p.completed : false,
      position: p ? p.position : 0,
    };
  });
  const watched = withProgress.filter((e) => e.watched).length;
  res.json({
    anime: { ...anime, episodeCount: episodes.length, watchedCount: watched, status: statusFromCounts(watched, episodes.length) },
    episodes: withProgress,
  });
});

// --- Gestion (admin uniquement) ---

// POST /api/animes
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { title, synopsis = '', cover_url = '' } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Titre requis' });
  const info = db.prepare('INSERT INTO animes (title, synopsis, cover_url) VALUES (?, ?, ?)')
    .run(title.trim(), synopsis, cover_url);
  const anime = db.prepare('SELECT * FROM animes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ anime });
});

// PUT /api/animes/:id
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const anime = db.prepare('SELECT * FROM animes WHERE id = ?').get(req.params.id);
  if (!anime) return res.status(404).json({ error: 'Anime introuvable' });
  const { title = anime.title, synopsis = anime.synopsis, cover_url = anime.cover_url } = req.body || {};
  db.prepare('UPDATE animes SET title = ?, synopsis = ?, cover_url = ? WHERE id = ?')
    .run(title, synopsis, cover_url, anime.id);
  res.json({ anime: db.prepare('SELECT * FROM animes WHERE id = ?').get(anime.id) });
});

// DELETE /api/animes/:id
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM animes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/animes/:id/episodes
router.post('/:id/episodes', requireAuth, requireAdmin, (req, res) => {
  const anime = db.prepare('SELECT * FROM animes WHERE id = ?').get(req.params.id);
  if (!anime) return res.status(404).json({ error: 'Anime introuvable' });
  let { number, title = '', video_url } = req.body || {};
  if (!video_url || !video_url.trim()) return res.status(400).json({ error: 'Lien video requis' });
  if (number == null) {
    const max = db.prepare('SELECT MAX(number) AS m FROM episodes WHERE anime_id = ?').get(anime.id).m;
    number = (max || 0) + 1;
  }
  try {
    const info = db.prepare('INSERT INTO episodes (anime_id, number, title, video_url) VALUES (?, ?, ?, ?)')
      .run(anime.id, number, title, video_url.trim());
    res.status(201).json({ episode: db.prepare('SELECT * FROM episodes WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: `L'episode ${number} existe deja` });
    }
    throw e;
  }
});

// DELETE /api/episodes/:id  (monte separement plus bas)
router.delete('/episodes/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM episodes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
