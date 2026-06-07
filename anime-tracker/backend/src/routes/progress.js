import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

// POST /api/episodes/:id/progress
// Body: { position?: number, completed?: boolean }
// Appele par le lecteur : MAJ la position regardee et marque "vu" a la fin -> le statut se met a jour tout seul.
router.post('/:id/progress', requireAuth, (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Episode introuvable' });

  const { position = 0, completed } = req.body || {};
  const existing = db.prepare('SELECT * FROM progress WHERE user_id = ? AND episode_id = ?')
    .get(req.user.id, episode.id);

  // Une fois "vu", on ne repasse pas en non-vu automatiquement
  const isCompleted = completed === true || (existing && existing.completed === 1) ? 1 : 0;
  const newPosition = Math.max(Number(position) || 0, existing ? existing.position : 0);

  if (existing) {
    db.prepare("UPDATE progress SET position = ?, completed = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newPosition, isCompleted, existing.id);
  } else {
    db.prepare('INSERT INTO progress (user_id, episode_id, position, completed) VALUES (?, ?, ?, ?)')
      .run(req.user.id, episode.id, newPosition, isCompleted);
  }
  res.json({ ok: true, completed: !!isCompleted, position: newPosition });
});

// POST /api/episodes/:id/toggle  -> bascule manuellement vu / non-vu (bouton de secours)
router.post('/:id/toggle', requireAuth, (req, res) => {
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Episode introuvable' });
  const existing = db.prepare('SELECT * FROM progress WHERE user_id = ? AND episode_id = ?')
    .get(req.user.id, episode.id);
  const next = existing && existing.completed === 1 ? 0 : 1;
  if (existing) {
    db.prepare("UPDATE progress SET completed = ?, updated_at = datetime('now') WHERE id = ?").run(next, existing.id);
  } else {
    db.prepare('INSERT INTO progress (user_id, episode_id, position, completed) VALUES (?, ?, 0, ?)')
      .run(req.user.id, episode.id, next);
  }
  res.json({ ok: true, completed: !!next });
});

export default router;
